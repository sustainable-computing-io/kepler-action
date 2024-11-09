# Github action for sustainable-computing-io

This repo provides the scripts to create a local kubernetes cluster to used for integration tests.

[![units-test](https://github.com/sustainable-computing-io/KeplerK8SAction/actions/workflows/test.yml/badge.svg)](https://github.com/sustainable-computing-io/KeplerK8SAction/actions/workflows/test.yml)![GitHub](https://img.shields.io/github/license/sustainable-computing-io/kepler-action)[![Contribute](https://img.shields.io/static/v1?label=Contributing&message=guide&color=blue)](https://github.com/sustainable-computing-io/kepler-action/blob/main/developer.md) 

## Usage in GHA

You can now consume the action by referencing the main branch

```yaml
      - name: use kepler action for kind cluster build
        uses: sustainable-computing-io/KeplerK8SAction@main
        with:
          cluster_provider: existing
          prometheus_enable: true
          tekton_enable: true
          grafana_enable: true
          kubeconfig_root_dir: /tmp/kubeconfig

      - name: error handle
        if: ${{ failure() }}
        run: |
          ls /tmp
          ls /tmp/kubeconfig
```

| parameters | value | comments |
|-------------|---------------|------------|
| install_containerruntime | true | Optional, set up container runtime as docker on the server |
| restartcontianerruntime | true | Optional, restart container runtime service as docker on the server |
| cluster_provider    | kind/existing         | start up a kind cluster or using existing cluster, note: KUBECONFIG_ROOT_DIR=/tmp/kubeconfig for kubeconfig     |
| config_cluster | false | Optional, if using kind cluster, and you don't want to config it, set it to false |
| prometheus_enable   | true         | Optional, set up prometheus on the cluster    |
| grafana_enable      | true         | Optional, set up grafana on the cluster       |
| tekton_enable       | true         | Optional, set up tekton on the cluster        |

## Local usage
[here](https://github.com/sustainable-computing-io/local-dev-cluster)

## Docker registry
There's a docker registry available which is exposed at `localhost:5001`.

## For developer
[here](./developer.md)