const core = require('@actions/core');
const shell = require('shelljs');

async function bcc() {
  core.info(`Start to build env`);
  core.debug((new Date()).toTimeString()); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
  core.info(`Linux header`);
  if (shell.exec("sudo apt-get install -y linux-headers-`uname -r`").code !== 0){
    shell.echo("fail to install linux headers");
    shell.exit(1);
  }
  let bcc_version = core.getInput('bcc_version');
  core.debug(bcc_version);
  if (bcc_version === undefined || bcc_version == null || bcc_version.length === 0) {
    bcc_version="0.25.0";
  }
  core.info(`Get BCC with version:` + bcc_version);
  if (shell.exec("wget https://github.com/sustainable-computing-io/kepler-ci-artifacts/releases/download/v"+bcc_version+"/bcc_v"+bcc_version+".tar.gz").code !==0){
    shell.echo("fail to get BCC deb");
    shell.exit(1);
  }
  if (shell.exec("tar -zxvf bcc_v"+bcc_version+".tar.gz").code !== 0) {
    shell.echo("fail to untar BCC deb");
    shell.exit(1);
  }
  if (shell.exec("sudo dpkg -i libbcc_"+bcc_version+"-1_amd64.deb").code !== 0) {
    shell.echo("fail to install BCC deb");
    shell.exit(1);
  }
  return
}

async function setup(cluster_provider) {
  let local_dev_cluster_version = core.getInput('local_dev_cluster_version');
  core.debug(local_dev_cluster_version);
  if (local_dev_cluster_version === undefined || local_dev_cluster_version == null || local_dev_cluster_version.length === 0) {
    local_dev_cluster_version="main";
  }
  core.info(`Get local-cluster-dev with version `+ local_dev_cluster_version);
  shell.exec("git clone -b "+local_dev_cluster_version+" https://github.com/sustainable-computing-io/local-dev-cluster.git --depth=1");
  let parameterExport = "export CLUSTER_PROVIDER="+cluster_provider;
  const prometheus_enable = core.getInput('prometheus_enable');
  core.debug(prometheus_enable);
  if (prometheus_enable !== undefined && prometheus_enable!=null && prometheus_enable.length!=0) {
    core.info(`use prometheus enable `+prometheus_enable);
    //  prometheus_enable, PROMETHEUS_ENABLE
    parameterExport = parameterExport + " && export PROMETHEUS_ENABLE="+prometheus_enable;
  }
  const prometheus_operator_version = core.getInput('prometheus_operator_version');
  core.debug(prometheus_operator_version);
  if (prometheus_operator_version !== undefined && prometheus_operator_version!=null && prometheus_operator_version.length!=0) {
    core.info(`use prometheus operator version `+prometheus_operator_version);
    //  prometheus_operator_version, PROMETHEUS_OPERATOR_VERSION
    parameterExport = parameterExport + " && export PROMETHEUS_OPERATOR_VERSION="+prometheus_operator_version;
  }
  const grafana_enable = core.getInput('grafana_enable');
  core.debug(grafana_enable);
  if (grafana_enable !== undefined && grafana_enable!=null && grafana_enable.length!=0) {
    core.info(`use grafana enable `+grafana_enable);
    //   grafana_enable, GRAFANA_ENABLE
    parameterExport = parameterExport + " && export GRAFANA_ENABLE="+grafana_enable;
  }
  parameterExport = parameterExport + " && "
  core.debug(parameterExport);
  shell.exec(parameterExport +` cd local-dev-cluster && bash -c './main.sh up'`)
  return
}

// most @actions toolkit packages have async methods
async function run() {
  const runningBranch = core.getInput('runningBranch');
  let cluster_provider = core.getInput('cluster_provider');
  core.debug(cluster_provider);
  try {
    if (runningBranch == 'bcc') {
      return bcc()
    }
    if (runningBranch == 'kind' || cluster_provider == 'kind') {
      bcc()
      return setup(cluster_provider)
    }
    if (runningBranch == 'microshift' || cluster_provider == 'microshift') {
      bcc()
      return setup(cluster_provider)
    }
    core.error('runningBranch should in value of [bcc, kind, microshift], or use cluster_provider as [kind, microshift] for short')
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
