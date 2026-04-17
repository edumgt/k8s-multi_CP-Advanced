#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEBS_DIR="${ROOT_DIR}/debs"
SHA_FILE="${ROOT_DIR}/manifests/SHA256SUMS.txt"
SKIP_SHA=0

for arg in "$@"; do
  case "$arg" in
    --skip-sha256)
      SKIP_SHA=1
      ;;
    *)
      echo "[ERROR] unknown option: $arg" >&2
      echo "usage: $0 [--skip-sha256]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "${DEBS_DIR}" ]]; then
  echo "[ERROR] debs dir not found: ${DEBS_DIR}" >&2
  exit 1
fi

if ! compgen -G "${DEBS_DIR}/*.deb" > /dev/null; then
  echo "[ERROR] no .deb files in ${DEBS_DIR}" >&2
  exit 1
fi

if [[ ${SKIP_SHA} -eq 0 ]]; then
  if [[ ! -f "${SHA_FILE}" ]]; then
    echo "[ERROR] checksum file not found: ${SHA_FILE}" >&2
    exit 1
  fi
  echo "[INFO] verify SHA256 checksums"
  (cd "${ROOT_DIR}/debs" && sha256sum -c "${SHA_FILE}")
else
  echo "[WARN] checksum verification skipped"
fi

echo "[INFO] install local debs"
# apt can resolve install order better than raw dpkg
sudo apt-get update >/dev/null 2>&1 || true
sudo apt-get -y install "${DEBS_DIR}"/*.deb

echo "[INFO] done"
echo "[INFO] version checks (may fail on non-GPU host):"
set +e
nvidia-smi
nvcc --version
nvidia-ctk --version
set -e
