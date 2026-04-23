#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/ubuntu/k8s-fss"
IMAGE_REF="${1:-192.168.56.32/app/jupyter:latest}"

echo "[build-jupyter-image] building ${IMAGE_REF}"
docker build -t "${IMAGE_REF}" "${ROOT_DIR}/applications/jupyter"

echo "[build-jupyter-image] build complete"
echo "[build-jupyter-image] to push:"
echo "docker push ${IMAGE_REF}"
