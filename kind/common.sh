#!/usr/bin/env bash
#
# This file is part of the Kepler project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

#     http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Copyright 2022 The Kepler Contributors
#

set -ex pipefail

_registry_port="5001"
_registry_name="kind-registry"

CTR_CMD=${CTR_CMD-docker}

CONFIG_PATH="kind"
KIND_VERSION=${KIND_VERSION:-0.15.0}
KIND_MANIFESTS_DIR="$CONFIG_PATH/manifests"
CLUSTER_NAME=${KIND_CLUSTER_NAME:-kind}
REGISTRY_NAME=${REGISTRY_NAME:-kind-registry}
REGISTRY_PORT=${REGISTRY_PORT:-5001}
KIND_DEFAULT_NETWORK="kind"

IMAGE_REPO=${IMAGE_REPO:-localhost:5001}
ESTIMATOR_REPO=${ESTIMATOR_REPO:-quay.io/sustainable_computing_io}
MODEL_SERVER_REPO=${MODEL_SERVER_REPO:-quay.io/sustainable_computing_io}
IMAGE_TAG=${IMAGE_TAG:-devel}

PROMETHEUS_OPERATOR_VERSION=${PROMETHEUS_OPERATOR_VERSION:-v0.11.0}
PROMETHEUS_ENABLE=${PROMETHEUS_ENABLE:-true}
PROMETHEUS_REPLICAS=${PROMETHEUS_REPLICAS:-1}
GRAFANA_ENABLE=${GRAFANA_ENABLE:-false}

CONFIG_OUT_DIR=${CONFIG_OUT_DIR:-"_output/generated-manifest"}
KIND_DIR=${KIND_DIR:-"/tmp"}
rm -rf ${CONFIG_OUT_DIR}
mkdir -p ${CONFIG_OUT_DIR}

# check CPU arch
PLATFORM=$(uname -m)
case ${PLATFORM} in
x86_64* | i?86_64* | amd64*)
    ARCH="amd64"
    ;;
ppc64le)
    ARCH="ppc64le"
    ;;
aarch64* | arm64*)
    ARCH="arm64"
    ;;
*)
    echo "invalid Arch, only support x86_64, ppc64le, aarch64"
    exit 1
    ;;
esac

function _get_prometheus_operator_images {
    grep -R "image:" kube-prometheus/manifests/*prometheus-* | awk '{print $3}'
    grep -R "image:" kube-prometheus/manifests/*prometheusOperator* | awk '{print $3}'
    grep -R "prometheus-config-reloader=" kube-prometheus/manifests/ | sed 's/.*=//g'
    if [ ${GRAFANA_ENABLE,,} == "true" ]; then
        grep -R "image:" kube-prometheus/manifests/*grafana* | awk '{print $3}'
    fi
}

function _load_prometheus_operator_images_to_local_registry {
    for img in $(_get_prometheus_operator_images); do
        $CTR_CMD pull $img
        $KIND load docker-image $img
    done
} 

function _deploy_prometheus_operator {
    #kubectl wait \
    #    --for condition=Established \
    #    --all CustomResourceDefinition \
    #    --namespace=monitoring
    
    if [ ${GRAFANA_ENABLE,,} == "true" ]; then
        for file in $(ls kube-prometheus/manifests/grafana-*); do
            kubectl create -f $file
        done
    fi
    rm -rf kube-prometheus
    #_wait_containers_ready monitoring
}

function _wait_kind_up {
    echo "Waiting for kind to be ready ..."
    
    while [ -z "$($CTR_CMD exec --privileged ${CLUSTER_NAME}-control-plane kubectl --kubeconfig=/etc/kubernetes/admin.conf get nodes -o=jsonpath='{.items..status.conditions[-1:].status}' | grep True)" ]; do
        echo "Waiting for kind to be ready ..."
        sleep 10
    done
    echo "Waiting for dns to be ready ..."
}

function _wait_containers_ready {
    echo "Waiting for all containers to become ready ..."
    namespace=$1
    kubectl wait --for=condition=Ready pod --all -n $namespace --timeout 12m
}

function _get_nodes() {
    kubectl get nodes --no-headers
}

function _get_pods() {
    kubectl get pods --all-namespaces --no-headers
}

function _setup_kind() {
    kubectl cluster-info
    # wait until k8s pods are running
    while [ -n "$(_get_pods | grep -v Running)" ]; do
        echo "Waiting for all pods to enter the Running state ..."
        _get_pods | >&2 grep -v Running || true
        sleep 10
    done

    #_wait_containers_ready kube-system

    if [ ${PROMETHEUS_ENABLE,,} == "true" ]; then
        _deploy_prometheus_operator
    fi
}

function _kind_up() {
    KIND=kind
    _setup_kind
}

function main() {
    _kind_up

    echo "cluster '$CLUSTER_NAME' is ready"
}

function down() {
    if [ -z "$($KIND get clusters | grep ${CLUSTER_NAME})" ]; then
        return
    fi
    # Avoid failing an entire test run just because of a deletion error
    $KIND delete cluster --name=${CLUSTER_NAME} || "true"
    $CTR_CMD rm -f ${REGISTRY_NAME} >> /dev/null
    rm -f ${KIND_DIR}/kind.yml
}

main