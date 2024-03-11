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
# Copyright 2023 The Kepler Contributors
#
set -eu -o pipefail

declare -r MONITORING_NS=${MONITORING_NS-monitoring}

rollout_status() {
	local res="$1"
	local ns="$2"
	shift 2
	kubectl rollout status "$res" --namespace "$ns" --timeout=5m || {
		echo "fail to check status of $res inside namespace $ns"
		return 1
	}
	echo "$res in $ns namespace rolled out successfully"
	return 0
}

verify_libbpf() {
	[[ ! -f /usr/lib64/libbpf.a ]] && {
		echo "archive file libbpf.a does not exist."
		return 1
	}
	[[ ! -f /usr/include/bpf/libbpf.h ]] && {
		echo "header file libbpf.h does not exist."
		return 1
	}
	[[ $(locate libbpf) ]] || {
		echo "couldnot locate libbpf related files"
		return 1
	}
	echo "libbpf check passed"
	return 0
}

verify_xgboost() {
	# basic check for xgboost
	[[ $(ldconfig -p | grep -c xgboost) == 0 ]] && {
		echo "no xgboost package found"
		return 1
	}
	echo "xgboost check passed"
	return 0
}

verify_cluster() {
	# basic command check
	which kubectl
	which kustomize
	
	# basic check for k8s cluster info

	[[ $(kubectl cluster-info) ]] || {
		echo "fail to get the cluster-info"
		return 1
	}

	# check k8s system pod is there...
	[[ $(kubectl get pods --all-namespaces | wc -l) == 0 ]] && {
		echo "it seems k8s cluster is not started"
		return 1
	}

	# check rollout status
	resources=$(
		kubectl get deployments --namespace="$MONITORING_NS" -o name
		kubectl get statefulsets --namespace="$MONITORING_NS" -o name
	)
	for res in $resources; do
		rollout_status "$res" "$MONITORING_NS"
	done
	echo "cluster check passed"
	return 0
}

verify_modprobe() {
	local modules="$1"
	shift 1

	# modules are separated by comma, loop to check each module
	for module in $(echo "$modules" | tr "," "\n"); do
		[[ $(lsmod | grep -c "$module") == 0 ]] && {
			echo "no $module module found"
			# ignore the error for now, since this is very os and kernel version specific
			return 0
		}
		echo "$module check passed"
	done
}

main() {
	local type="$1"
	local module="${2:-}"
	shift 2 || true

	# verify the deployment of cluster
	case $type in
	libbpf)
		verify_libbpf
		;;
	xgboost)
		verify_xgboost
		;;
	cluster)
		verify_cluster
		;;
	modprobe)
		verify_modprobe "$module"
		;;
	*)
		verify_cluster
		;;
	esac
}
main "$@"
