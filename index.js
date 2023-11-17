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
    shell.exit(1);
  }
}

function installLinuxHeaders() {
  core.info(`Linux header`);
  executeCommand("sudo apt-get install -y linux-headers-`uname -r`", "fail to install linux headers");
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

function installLibbpf() {
  core.info(`libbpf`);
  executeCommand("sudo apt-get install -y libbpf-dev", "fail to install libbpf related package");
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
  shell.exec("git clone -b "+local_dev_cluster_version+" https://github.com/sustainable-computing-io/local-dev-cluster.git --depth=1");

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
  shell.exec(parameterExport +` cd local-dev-cluster && bash -c './main.sh up'`)
}

async function run() {
  const runningBranch = getInputOrDefault('runningBranch', '');
  const ebpfprovider = getInputOrDefault('ebpfprovider', '');

  try {
    // always install xgboost
    const artifacts_version = getInputOrDefault('artifacts_version', '0.26.0');
    const xgboost_version = getInputOrDefault('xgboost_version', '2.0.1');
    installXgboost(artifacts_version, xgboost_version);

    if (ebpfprovider == 'bcc') {
      installLinuxHeaders();
      const bcc_version = getInputOrDefault('bcc_version', '0.25.0');
      installBcc(bcc_version);
    }
    if (ebpfprovider == 'libbpf') {
      installLinuxHeaders();
      installLibbpf();
    }
    if (runningBranch == 'kind' || getInputOrDefault('cluster_provider', 'kind') == 'kind') {
      const kubectl_version = getInputOrDefault('kubectl_version', '1.25.4');
      installKubectl(kubectl_version);
      await setup();
    }
    if (runningBranch == 'microshift' || getInputOrDefault('cluster_provider', 'kind') == 'microshift') {
      const kubectl_version = getInputOrDefault('kubectl_version', '1.25.4');
      installKubectl(kubectl_version);
      await setup();
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
