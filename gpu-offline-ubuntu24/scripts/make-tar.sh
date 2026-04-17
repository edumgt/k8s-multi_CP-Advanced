#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_NAME="$(basename "${ROOT_DIR}")"
PARENT_DIR="$(dirname "${ROOT_DIR}")"
DATE_TAG="$(date +%Y%m%d)"
TAR_PATH="${PARENT_DIR}/${BASE_NAME}-${DATE_TAG}.tar.gz"

if [[ ! -d "${ROOT_DIR}/debs" ]]; then
  echo "[ERROR] debs dir not found" >&2
  exit 1
fi

if compgen -G "${ROOT_DIR}/debs/*.deb" > /dev/null; then
  mkdir -p "${ROOT_DIR}/manifests"
  (cd "${ROOT_DIR}/debs" && sha256sum *.deb) > "${ROOT_DIR}/manifests/SHA256SUMS.txt"
fi

cd "${PARENT_DIR}"
tar -czf "${TAR_PATH}" "${BASE_NAME}"
sha256sum "${TAR_PATH}" | tee "${TAR_PATH}.sha256"

echo "[INFO] tar created: ${TAR_PATH}"
