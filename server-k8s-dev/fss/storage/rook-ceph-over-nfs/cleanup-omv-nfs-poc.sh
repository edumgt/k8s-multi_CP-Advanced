#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/omv-nfs.env"

kubectl -n "${POC_NAMESPACE}" delete pod omv-nfs-tester --ignore-not-found=true
kubectl -n "${POC_NAMESPACE}" delete pvc "${POC_PVC_NAME}" --ignore-not-found=true
kubectl delete pv "${POC_PV_NAME}" --ignore-not-found=true
