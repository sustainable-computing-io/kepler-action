const core = require('@actions/core');
const shell = require('shelljs');

function getInputOrDefault(inputName, defaultValue) {
  const input = core.getInput(inputName);
  if (input === undefined || input == null || input.length === 0) {
    return defaultValue;
  }
  return input;
}

function executeCommand(command, errorMessage) {
  const result = shell.exec(command);
  if (result.code !== 0) {
    shell.echo(errorMessage);
    shell.exit(result.code);
  }
}

function installLinuxHeaders() {
  core.info(`Linux header`);
  executeCommand("sudo apt-get install -y linux-headers-`uname -r`", "fail to install linux headers");
}

function installLinuxModules() {
  core.info(`Linux modules`);
  executeCommand("sudo apt-get install -y linux-modules-`uname -r`", "fail to install linux modules");
}

function installLinuxExtraModules() {
  core.info(`Linux extra modules`);
  executeCommand("sudo apt-get install -y linux-modules-extra-`uname -r`", "fail to install linux extra modules");
}

function modprobe(moduleName) {
  core.info(`modprobe`);
  if (moduleName == "") {
    core.info(`module name is empty, skip modprobe`);
    return;
  }
  core.info(`modprobe `+moduleName);
  // ignore error, since this is a very os and kernel version specific command
  executeCommand("sudo modprobe "+moduleName + " || true", "fail to modprobe");
}


function installBcc(bcc_version) {
  core.info(`Get BCC with version:` + bcc_version);
  executeCommand("wget https://github.com/sustainable-computing-io/kepler-ci-artifacts/releases/download/v"+bcc_version+"/bcc_v"+bcc_version+".tar.gz", "fail to get BCC deb");
  executeCommand("tar -zxvf bcc_v"+bcc_version+".tar.gz", "fail to untar BCC deb");
  executeCommand("sudo dpkg -i libbcc_"+bcc_version+"-1_amd64.deb", "fail to install BCC deb");
}

function installXgboost(artifacts_version, xgboost_version) {
  core.info(`Get xgboost with version:` + xgboost_version);
  executeCommand("wget https://github.com/sustainable-computing-io/kepler-ci-artifacts/releases/download/v"+artifacts_version+"/xgboost-"+xgboost_version+"-Linux.sh.tar.gz", "fail to get xgboost pkg");
  executeCommand("tar -zxvf xgboost-"+xgboost_version+"-Linux.sh.tar.gz", "fail to untar xgboost pkg");
  executeCommand("sudo sh xgboost-"+xgboost_version+"-Linux.sh --skip-license  --prefix=/usr/local", "fail to install xgboost pkg");
  executeCommand("sudo ldconfig", "fail to ldconfig");
}

function installLibbpf(libbpf_version) {
  core.info(`installing libbpf version ` + libbpf_version + ` from source`);
  executeCommand("sudo apt install libelf-dev", "failed to install libelf-dev");
  executeCommand("mkdir -p temp-libbpf");
  executeCommand("cd temp-libbpf && git clone -b " + libbpf_version + " https://github.com/libbpf/libbpf");
  executeCommand("cd temp-libbpf/libbpf/src && sudo BUILD_STATIC_ONLY=y make install", "failed to install libbpf archive library");
  executeCommand("cd temp-libbpf/libbpf/src && sudo make install_uapi_headers", "failed to install libbpf headers");
  executeCommand("sudo rm -rf temp-libbpf");
}

function installKubectl(kubectl_version) {
  core.info(`Get kubectl with version `+ kubectl_version);
  executeCommand("curl -LO https://dl.k8s.io/release/v"+kubectl_version+"/bin/linux/amd64/kubectl", "fail to install kubectl");
}

async function setup() {
  const cluster_provider = getInputOrDefault('cluster_provider', 'kind');
  const local_dev_cluster_version = getInputOrDefault('local_dev_cluster_version', 'main');
  const prometheus_enable = getInputOrDefault('prometheus_enable', '');
  const prometheus_operator_version = getInputOrDefault('prometheus_operator_version', '');
  const grafana_enable = getInputOrDefault('grafana_enable', '');

  core.info(`Get local-cluster-dev with version `+ local_dev_cluster_version);
  executeCommand("git clone -b "+local_dev_cluster_version+" https://github.com/sustainable-computing-io/local-dev-cluster.git --depth=1", "fail to get local-dev-cluster");

  let parameterExport = "export CLUSTER_PROVIDER="+cluster_provider;

  if (prometheus_enable.length !== 0) {
    core.info(`use prometheus enable `+prometheus_enable);
    parameterExport = parameterExport + " && export PROMETHEUS_ENABLE="+prometheus_enable;
  }
  if (prometheus_operator_version.length !== 0) {
    core.info(`use prometheus operator version `+prometheus_operator_version);
    parameterExport = parameterExport + " && export PROMETHEUS_OPERATOR_VERSION="+prometheus_operator_version;
  }
  if (grafana_enable.length !== 0) {
    core.info(`use grafana enable `+grafana_enable);
    parameterExport = parameterExport + " && export GRAFANA_ENABLE="+grafana_enable;
  }

  parameterExport = parameterExport + " && "
  core.debug(parameterExport);
  executeCommand(parameterExport +` cd local-dev-cluster && bash -c './main.sh up'`, "fail to setup local-dev-cluster")
}

async function run() {
  const runningBranch = getInputOrDefault('runningBranch', '');
  const ebpfprovider = getInputOrDefault('ebpfprovider', '');

  try {
    const artifacts_version = getInputOrDefault('artifacts_version', '0.26.0');
    const xgboost_version = getInputOrDefault('xgboost_version', '');
    const libbpf_version = getInputOrDefault('libbpf_version', 'v1.2.0');
    const kernel_module_names = getInputOrDefault('kernel_module_names', ''); // comma limited names, for example: rapl,intel_rapl_common
  
    if (kernel_module_names.length > 0) {
      core.info(`kernel_module_names are `+ kernel_module_names);
      installLinuxModules();
      installLinuxExtraModules();
      // loop through all kernel module names
      kernel_module_names.split(',').forEach(modprobe);
    }
    
    // if xgboost_version is empty, skip xgboost installation
    if (xgboost_version.length === 0) {
      core.info(`xgboost_version is empty, skip xgboost installation`);
    } else {
      installXgboost(artifacts_version, xgboost_version);
    }

    if (ebpfprovider == 'bcc') {
      installLinuxHeaders();
      const bcc_version = getInputOrDefault('bcc_version', '0.25.0');
      installBcc(bcc_version);
    }
    if (ebpfprovider == 'libbpf') {
      installLinuxHeaders();
      installLibbpf(libbpf_version);
    }
    if (runningBranch == 'kind' || getInputOrDefault('cluster_provider', '') == 'kind') {
      const kubectl_version = getInputOrDefault('kubectl_version', '1.25.4');
      installKubectl(kubectl_version);
      await setup();
    }
    if (runningBranch == 'microshift' || getInputOrDefault('cluster_provider', '') == 'microshift') {
      const kubectl_version = getInputOrDefault('kubectl_version', '1.25.4');
      installKubectl(kubectl_version);
      await setup();
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
