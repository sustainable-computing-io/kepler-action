const core = require('@actions/core');
const cli = require('./command');

async function bcc() {
  core.info(`Start to build env`);
  core.debug((new Date()).toTimeString()); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true
  core.info(`Linux header`);
  let linuxheader_0 = cli.ConvertCommand("sudo apt-get install -y linux-headers-5.15.0-1023-azure");
  cli.executeCommand(linuxheader_0)
      
  core.info(`BCC deb`);
  let BCC_0 = cli.ConvertCommand("wget https://github.com/sustainable-computing-io/kepler-ci-artifacts/releases/download/v0.25.0/bcc_v0.25.0.tar.gz");
  cli.executeCommand(BCC_0)
  let BCC_1 = cli.ConvertCommand("tar -zxvf bcc_v0.25.0.tar.gz");
  cli.executeCommand(BCC_1)
  let BCC_2 = cli.ConvertCommand("sudo dpkg -i libbcc_0.25.0-1_amd64.deb");
  cli.executeCommand(BCC_2)
  return
}

async function kind() {
  core.info(`kubectl`);
  let kubectl_0 = cli.ConvertCommand("curl -LO https://dl.k8s.io/release/v1.25.4/bin/linux/amd64/kubectl");
  cli.executeCommand(kubectl_0)
  //core.info(`to do for kind`);
  core.info(`kind`);
  let kubectl_1 = cli.ConvertCommand("bash -c ./kind/common.sh");
  cli.executeCommand(kubectl_1)
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
      return kind()
    }
    if (runningBranch == 'microshift') {
      core.info(`kubectl`);
      let kubectl_0 = cli.ConvertCommand("curl -LO https://dl.k8s.io/release/v1.25.4/bin/linux/amd64/kubectl");
      cli.executeCommand(kubectl_0)
      core.info(`to do for microshift`);
      return
    }
    core.error('runningBranch should in value of [bcc, kind, microshift]')
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
