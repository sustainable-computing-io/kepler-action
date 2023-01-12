const core = require('@actions/core');
const shell = require('shelljs');

async function bcc() {
  core.info(`Start to build env`);
  core.debug((new Date()).toTimeString()); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
  core.info(`Linux header`);
  if (shell.exec("sudo apt-get install -y linux-headers-5.15.0-1023-azure").code !== 0){
    shell.echo("fail to install linux headers");
    shell.exit(1);
  }
  core.info(`BCC deb`);
  if (shell.exec("wget https://github.com/sustainable-computing-io/kepler-ci-artifacts/releases/download/v0.25.0/bcc_v0.25.0.tar.gz").code !==0){
    shell.echo("fail to get BCC deb");
    shell.exit(1);
  }
  if (shell.exec("tar -zxvf bcc_v0.25.0.tar.gz").code !== 0) {
    shell.echo("fail to untar BCC deb");
    shell.exit(1);
  }
  if (shell.exec("sudo dpkg -i libbcc_0.25.0-1_amd64.deb").code !== 0) {
    shell.echo("fail to install BCC deb");
    shell.exit(1);
  }
  return
}

async function kubectl() {
  core.info(`kubectl`);
  if (shell.exec("curl -LO https://dl.k8s.io/release/v1.25.4/bin/linux/amd64/kubectl").code !== 0) {
    shell.echo("fail to install kubectl");
    shell.exit(1);
  }
}

async function kind() {
  core.info(`kind`);
  shell.exec("git clone https://github.com/sustainable-computing-io/KeplerK8SAction --depth=1");
  shell.exec("cd KeplerK8SAction && bash -c ./kind/common.sh")
  return
}

// most @actions toolkit packages have async methods
async function run() {
  const runningBranch = core.getInput('runningBranch');
  try {
    if (runningBranch == 'bcc') {
      return bcc()
    }
    if (runningBranch == 'kind') {
      bcc()
      kubectl()
      return kind()
    }
    if (runningBranch == 'microshift') {
      core.info(`to do for microshift`);
      return
    }
    core.error('runningBranch should in value of [bcc, kind, microshift]')
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
