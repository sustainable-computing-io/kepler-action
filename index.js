const core = require('@actions/core');
const shell = require('shelljs');
const fs = require('fs');

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

function installXgboost(artifacts_version, xgboost_version) {
  core.info(`Get xgboost with version:` + xgboost_version);
  executeCommand("wget https://github.com/sustainable-computing-io/kepler-ci-artifacts/releases/download/v"+artifacts_version+"/xgboost-"+xgboost_version+"-Linux.sh.tar.gz", "fail to get xgboost pkg");
  executeCommand("tar -zxvf xgboost-"+xgboost_version+"-Linux.sh.tar.gz", "fail to untar xgboost pkg");
  executeCommand("sudo sh xgboost-"+xgboost_version+"-Linux.sh --skip-license  --prefix=/usr/local", "fail to install xgboost pkg");
  executeCommand("sudo ldconfig", "fail to ldconfig");
}

function installKubectl(kubectl_version,local_path) {
  core.info(`Get kubectl with version `+ kubectl_version);
  executeCommand("curl -LO https://dl.k8s.io/release/v"+kubectl_version+"/bin/linux/amd64/kubectl", "fail to install kubectl");
  executeCommand("chmod +x ./kubectl");
  executeCommand("mv ./kubectl "+local_path);
  core.info(`Get kustomize`);
  executeCommand("curl -s \"https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh\" | bash");
  executeCommand("chmod +x kustomize");
  executeCommand("mv kustomize "+local_path);
}

function installKind(kind_version,local_path) {
  core.info(`Get Kind with latest version`);
  executeCommand("curl -Lo ./kind https://kind.sigs.k8s.io/dl/v"+kind_version+"/kind-linux-amd64","fail to install kind");
  executeCommand("chmod +x ./kind");
  executeCommand("mv ./kind "+local_path);
}

async function configcluster() {
  core.info('start config cluster');
  core.info('checking kubeconf at /tmp/kubeconfig')
  let result=shell.exec("ls -al /tmp/kubeconfig");
  core.info(result.stdout);

  const prometheus_enable = getInputOrDefault('prometheus_enable', '');
  const prometheus_operator_version = getInputOrDefault('prometheus_operator_version', '');
  const grafana_enable = getInputOrDefault('grafana_enable', '');
  const tekton_enable = getInputOrDefault('tekton_enable', '');
  const kubeconfig_root_dir = getInputOrDefault('kubeconfig_root_dir', '/tmp/kubeconfig');
  let parameterExport = "export KUBECONFIG_ROOT_DIR="+kubeconfig_root_dir;
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
  if (tekton_enable.length !==0) {
    core.info(`use tekton enable `+tekton_enable);
    parameterExport = parameterExport + " && export TEKTON_ENABLE="+tekton_enable;
  }

  let command = parameterExport +` && cd local-dev-cluster && mkdir -p ./tmp && bash -xc './main.sh config'`;
  core.info('command going to be executed: ' + command);
  executeCommand(command, "fail to config cluster")
}

async function setupcluster() {
  core.info('start set up cluster');
  const cluster_provider = getInputOrDefault('cluster_provider', 'kind');
  let parameterExport = "export CLUSTER_CONFIG=false && export CLUSTER_PROVIDER="+cluster_provider;  
  let command = parameterExport +` && cd local-dev-cluster && bash -xc './main.sh up'`;
  core.info('command going to be executed: ' + command);
  executeCommand(command, "fail to setup local-dev-cluster")
  if (fs.existsSync('/tmp/kubeconfig')) {
    core.info('find exists kubeconfig, overwrite by local-dev-cluster setting');
    executeCommand(`mv /tmp/kubeconfig /tmp/kubeconfig_bak`)
  } 
  executeCommand(`mkdir -p /tmp/kubeconfig && cp ./local-dev-cluster/.kube/config /tmp/kubeconfig/`)
}

async function run() {
  // init envs
  const runningBranch = getInputOrDefault('runningBranch', '');
  const ebpfprovider = getInputOrDefault('ebpfprovider', '');
  const kubectl_version = getInputOrDefault('kubectl_version', '1.25.4');
  const local_path = getInputOrDefault('local_path','/usr/local/bin');
  // download local dev cluster
  const local_dev_cluster_version = getInputOrDefault('local_dev_cluster_version', 'main');
  core.info(`Get local-cluster-dev with version `+ local_dev_cluster_version);
  // if there is local-cluster-dev folder skip
  executeCommand("rm -rf local-dev-cluster && git clone -b "+local_dev_cluster_version+" https://github.com/sustainable-computing-io/local-dev-cluster.git --depth=1", "fail to get local-dev-cluster");
  // download kubectl and other tools
  // if there kubectl skip
  let is_kubectl = shell.exec("command -v kubectl");
  if (is_kubectl.code !== 0) {
    installKubectl(kubectl_version,local_path);
  }
  // end of prepare
  try {
    const artifacts_version = getInputOrDefault('artifacts_version', '0.26.0');
    const xgboost_version = getInputOrDefault('xgboost_version', '');
    const libbpf_version = getInputOrDefault('libbpf_version', 'v1.2.0');
    const kernel_module_names = getInputOrDefault('kernel_module_names', ''); // comma delimited names, for example: rapl,intel_rapl_common
    const install_containerruntime = getInputOrDefault('install_containerruntime', '');
    const restartcontianerruntime = getInputOrDefault('restartcontianerruntime', '');
    const config_cluster = getInputOrDefault('config_cluster', '');
    // base on a general workflow
    // Step 1 linux header, models, extramodules, ebpf
    // prerequisites
    if (kernel_module_names.length > 0 || ebpfprovider == 'libbpf')  {
      let prerequisitesExport="export LIBBPF_VERSION="+libbpf_version;
      core.debug(prerequisitesExport);
      executeCommand(prerequisitesExport +` && cd local-dev-cluster && bash -c './main.sh prerequisites'`, "fail to install prerequisites via local-dev-cluster")
      core.info(`kernel_module_names are `+ kernel_module_names);
      // loop through all kernel module names
      kernel_module_names.split(',').forEach(modprobe);
    }
    // Optional xgboost
    // if xgboost_version is empty, skip xgboost installation
    if (xgboost_version.length === 0) {
      core.info(`xgboost_version is empty, skip xgboost installation`);
    } else {
      installXgboost(artifacts_version, xgboost_version);
    }
    // Optional container runtime
    if (install_containerruntime.length > 0 ) {
      executeCommand(` cd local-dev-cluster && bash -c './main.sh containerruntime'`, "fail to install container runtime via local-dev-cluster")
      // RESTARTCONTAINERRUNTIME
      if (restartcontianerruntime.length > 0) {
        executeCommand(`sudo systemctl restart docker`,"fail to docker restart")
        // todo: for debug usage
        // executeCommand(`journalctl -u docker`, "check docker log")
        // executeCommand(`sudo systemctl status docker`,"fail to docker status")
      }
    }
    // Step 2 k8s cluster
    // run specific steps or not
    if (runningBranch == 'kind' || getInputOrDefault('cluster_provider', '') == 'kind') {
      const kind_version = getInputOrDefault('kind_version','0.22.0');
      installKind(kind_version,local_path)
      await setupcluster();
      if (config_cluster != 'false' ) {
        await configcluster();
      }
    }
    if (getInputOrDefault('cluster_provider', '') == 'existing') {
      await configcluster(); 
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
