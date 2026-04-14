#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/omv-nfs.env"

NS="${POC_NAMESPACE}"
PODS=(nfs-mount-master nfs-mount-worker1 nfs-mount-worker2 nfs-mount-workerml)

kubectl -n "${NS}" delete pod "${PODS[@]}" --ignore-not-found=true >/dev/null 2>&1 || true

cat <<YAML | kubectl apply -f - >/dev/null
apiVersion: v1
kind: List
items:
- apiVersion: v1
  kind: Pod
  metadata: {name: nfs-mount-master, namespace: ${NS}}
  spec:
    restartPolicy: Never
    nodeName: hdlamst-devl
    containers:
    - name: c
      image: docker.io/library/busybox:1.36
      command: ["/bin/sh","-c","echo node=hdlamst-devl; df -h /mnt; sleep 120"]
      volumeMounts: [{name: nfsvol, mountPath: /mnt}]
    volumes: [{name: nfsvol, nfs: {server: ${OMV_NFS_SERVER}, path: ${OMV_NFS_EXPORT}}}]
- apiVersion: v1
  kind: Pod
  metadata: {name: nfs-mount-worker1, namespace: ${NS}}
  spec:
    restartPolicy: Never
    nodeName: hdlawork1-devl
    containers:
    - name: c
      image: docker.io/library/busybox:1.36
      command: ["/bin/sh","-c","echo node=hdlawork1-devl; df -h /mnt; sleep 120"]
      volumeMounts: [{name: nfsvol, mountPath: /mnt}]
    volumes: [{name: nfsvol, nfs: {server: ${OMV_NFS_SERVER}, path: ${OMV_NFS_EXPORT}}}]
- apiVersion: v1
  kind: Pod
  metadata: {name: nfs-mount-worker2, namespace: ${NS}}
  spec:
    restartPolicy: Never
    nodeName: hdlawork2-devl
    containers:
    - name: c
      image: docker.io/library/busybox:1.36
      command: ["/bin/sh","-c","echo node=hdlawork2-devl; df -h /mnt; sleep 120"]
      volumeMounts: [{name: nfsvol, mountPath: /mnt}]
    volumes: [{name: nfsvol, nfs: {server: ${OMV_NFS_SERVER}, path: ${OMV_NFS_EXPORT}}}]
- apiVersion: v1
  kind: Pod
  metadata: {name: nfs-mount-workerml, namespace: ${NS}}
  spec:
    restartPolicy: Never
    nodeName: hdlaworkml-devl
    containers:
    - name: c
      image: docker.io/library/busybox:1.36
      command: ["/bin/sh","-c","echo node=hdlaworkml-devl; df -h /mnt; sleep 120"]
      volumeMounts: [{name: nfsvol, mountPath: /mnt}]
    volumes: [{name: nfsvol, nfs: {server: ${OMV_NFS_SERVER}, path: ${OMV_NFS_EXPORT}}}]
YAML

sleep 15
kubectl -n "${NS}" get pods -o wide | egrep 'nfs-mount|NAME' || true
for p in "${PODS[@]}"; do
  echo "===== ${p} ====="
  kubectl -n "${NS}" logs "${p}" --tail=20 || true
done

kubectl -n "${NS}" delete pod "${PODS[@]}" --ignore-not-found=true >/dev/null
