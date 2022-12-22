const core = require('@actions/core');
const shell = require('shelljs');
const fs = require('fs');

async function fetch_kind() {
    core.info(`get kind cli`);
    if (shell.exec('go install sigs.k8s.io/kind@v0.15.0').code !== 0) {
      shell.echo('Error: kind install failed');
      shell.exit(1);
    }
}
  
async function prepare_kind() {
    core.info("prepare kind setting to tmp folder")
    fs.writeFileSync("/tmp/kind.yml", `---
    kind: Cluster
    apiVersion: kind.x-k8s.io/v1alpha4
    # create a cluster with the local registry enabled in containerd
    containerdConfigPatches:
    - |-
      [plugins."io.containerd.grpc.v1.cri".registry.mirrors."localhost:5001"]
        endpoint = ["http://kind-registry:5000"]
    nodes:
      - role: control-plane
        extraMounts:
          - hostPath: /proc
            containerPath: /proc-host
          - hostPath: /usr/src
            containerPath: /usr/src`)
    fs.writeFileSync("/tmp/local-registry.yml", `---
    apiVersion: v1
    kind: ConfigMap
    metadata:
      name: local-registry-hosting
      namespace: kube-public
    data:
      localRegistryHosting.v1: |
        host: "localhost:5001"
        help: "https://kind.sigs.k8s.io/docs/user/local-registry/"`)
}

async function start_kind() {
    core.info("Starting kind with cluster name \"kind\"")
    if (shell.exec("kind create cluster -v=6 --name=kind --config=/tmp/kind.yml").code !==0) {
      shell.echo('Error: kind cluster create');
      shell.exit(1);
    }
    
}

async function wait_kind_ready() {
    core.info("Wait kind ready")
    if (shell.exec("kubectl cluster-info").code !==0) {
      shell.echo('Error: kubectl cluster info');
      shell.exit(1);
    }
}

async function run_registry (){
  if (shell.exec("docker run -d --restart=always -p 127.0.0.1:5001:5000 --name kind-registry registry:2").code !==0){
    shell.echo('docker run_registry');
    shell.exit(1);
  }
  if (shell.exec("docker network connect kind kind-registry").code !==0){
    shell.echo('docker run_registry network connect');
    shell.exit(1);
  }
    
  if (shell.exec("kubectl apply -f /tmp/local-registry.yml").code !==0){
    shell.echo('kubectl apply local-registry.yml');
    shell.exit(1);
  }  
}

async function deploy_prometheus_operator (){
  if (shell.exec("git clone -b v0.11.0 --depth 1 https://github.com/prometheus-operator/kube-prometheus.git").code !==0) {
    shell.echo('Error: Git clone fail');
    shell.exit(1);
  }
  let images_0 = shell.grep("image:", "kube-prometheus/manifests/*prometheus-*").toString().split("\n");
  let images_1 = shell.grep("image:", "kube-prometheus/manifests/*prometheusOperator*").toString().split("\n");
  let images_2 = shell.grep("prometheus-config-reloader=", shell.ls("kube-prometheus/manifests/*")).toString().split("\n");
  for (let i = 0; i < images_0.length;i++) {
      if (images_0[i].indexOf("image:") > -1) {
          shell.exec("docker pull "+images_0[i].split("image:")[1]);
          shell.exec("kind load "+images_0[i].split("image:")[1]);
      }
  }
  for (let i = 0; i < images_1.length;i++) {
      if (images_1[i].indexOf("image:") > -1) {
          shell.exec("docker pull "+images_1[i].split("image:")[1]);
          shell.exec("kind load "+images_1[i].split("image:")[1]);
      }
  }
  for (let i = 0; i < images_2.length;i++) {
      if (images_2[i].indexOf("prometheus-config-reloader=") > -1) {
        shell.exec("docker pull "+images_2[i].split("prometheus-config-reloader=")[1]);
        shell.exec("kind load "+images_2[i].split("prometheus-config-reloader=")[1]);
      }
  }

  shell.ls("kube-prometheus/manifests/prometheus-prometheus.yaml").forEach(function (file){
    shell.sed('-i',"replicas: 2","replicas: 1",file);
  });
  if (shell.exec(`kubectl create -f kube-prometheus/manifests/setup`).code !==0){
    shell.echo('Error: kubectl create kube-prometheus/manifests/setup');
    shell.exit(1);
  }

  shell.ls("kube-prometheus/manifests/prometheusOperator-*").forEach(function(file){
    let cmd = "kubectl create -f "+file;
    shell.exec(cmd);
  })

  shell.ls("kube-prometheus/manifests/prometheus-*").forEach(function(file){
    let cmd = "kubectl create -f "+file;
    shell.exec(cmd);
  })
}

async function kind() {
    core.info(`start k8s cluster with kind`);
    await fetch_kind()
    await prepare_kind()
    await start_kind()
    await wait_kind_ready()
    await run_registry()
    await deploy_prometheus_operator()
    core.info(`complete k8s cluster with kind`);
    return
}

module.exports = kind;