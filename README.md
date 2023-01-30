# Github action for sustainable-computing-io

This repo provides the scripts to create a local kubernetes cluster to used for development or integration tests.

[![units-test](https://github.com/sustainable-computing-io/KeplerK8SAction/actions/workflows/test.yml/badge.svg)](https://github.com/sustainable-computing-io/KeplerK8SAction/actions/workflows/test.yml)

## Usage in GHA

You can now consume the action by referencing the main branch

```yaml
      - name: use kepler action for kind cluster build
        uses: sustainable-computing-io/KeplerK8SAction@main
        with:
          runningBranch: kind
```

## Local usage
[here](https://github.com/sustainable-computing-io/local-dev-cluster)

## Docker registry
There's a docker registry available which is exposed at `localhost:5001`.

## For developer
[here](./developer.md)