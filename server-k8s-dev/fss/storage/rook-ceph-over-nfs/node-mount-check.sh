#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/omv-nfs.env"

NS="${POC_NAMESPACE}"
MAX_NODES="${MAX_NODES:-4}"
mapfile -t NODE_NAMES < <(
  kubectl get nodes \
    -o jsonpath='{range .items[*]}{.metadata.name}{"|"}{range .spec.taints[*]}{.key}{","}{end}{"\n"}{end}' \
    | awk -F'|' '$2 !~ /node-role.kubernetes.io\/control-plane/ {print $1}' \
    | head -n "${MAX_NODES}"
)
if [[ "${#NODE_NAMES[@]}" -eq 0 ]]; then
  mapfile -t NODE_NAMES < <(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | head -n "${MAX_NODES}")
fi
if [[ "${#NODE_NAMES[@]}" -eq 0 ]]; then
  echo "No nodes found."
  exit 1
fi

PODS=()
for i in "${!NODE_NAMES[@]}"; do
  PODS+=("nfs-mount-$((i+1))")
done

kubectl -n "${NS}" delete pod "${PODS[@]}" --ignore-not-found=true >/dev/null 2>&1 || true

{
  cat <<YAML
apiVersion: v1
kind: List
items:
YAML
  for i in "${!NODE_NAMES[@]}"; do
    pod="${PODS[$i]}"
    node="${NODE_NAMES[$i]}"
    cat <<YAML
- apiVersion: v1
  kind: Pod
  metadata:
    name: ${pod}
    namespace: ${NS}
  spec:
    restartPolicy: Never
    nodeName: ${node}
    containers:
    - name: c
      image: ghcr.io/edumgt/fss-dis-server-node:latest
      command: ["/bin/sh","-c","echo node=${node}; df -h /mnt; sleep 120"]
      volumeMounts:
      - name: nfsvol
        mountPath: /mnt
    volumes:
    - name: nfsvol
      nfs:
        server: ${OMV_NFS_SERVER}
        path: ${OMV_NFS_EXPORT}
YAML
  done
} | kubectl apply -f - >/dev/null

sleep 20
kubectl -n "${NS}" get pods -o wide | egrep 'nfs-mount|NAME' || true
for p in "${PODS[@]}"; do
  echo "===== ${p} ====="
  kubectl -n "${NS}" logs "${p}" --tail=20 || true
done

kubectl -n "${NS}" delete pod "${PODS[@]}" --ignore-not-found=true >/dev/null
