#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/ubuntu/k8s-fss"
IMAGE_REF="${1:-192.168.56.32/app/fss-dis-server-node:latest}"

echo "[build-server-image] building ${IMAGE_REF}"
docker build -t "${IMAGE_REF}" "${ROOT_DIR}/applications/fss-dis-server-node"

echo "[build-server-image] build complete"
echo "[build-server-image] to push:"
echo "  docker push ${IMAGE_REF}"
