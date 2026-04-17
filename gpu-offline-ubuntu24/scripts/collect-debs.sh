#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEBS_DIR="${ROOT_DIR}/debs"
PKG_FILE="${ROOT_DIR}/scripts/packages.txt"

if [[ ! -f "${PKG_FILE}" ]]; then
  echo "[ERROR] packages.txt not found: ${PKG_FILE}" >&2
  exit 1
fi

mapfile -t PACKAGES < <(grep -vE '^\s*#|^\s*$' "${PKG_FILE}")
if [[ ${#PACKAGES[@]} -eq 0 ]]; then
  echo "[ERROR] no packages in ${PKG_FILE}" >&2
  exit 1
fi

echo "[INFO] apt index update"
sudo apt-get update

echo "[INFO] download-only install (${#PACKAGES[@]} packages requested)"
sudo apt-get -y --download-only install "${PACKAGES[@]}"

mkdir -p "${DEBS_DIR}"
echo "[INFO] collect .deb files -> ${DEBS_DIR}"
find /var/cache/apt/archives -maxdepth 1 -type f -name '*.deb' -print0 | xargs -0 -I{} cp -n {} "${DEBS_DIR}/"

cd "${DEBS_DIR}"
count=$(find . -maxdepth 1 -type f -name '*.deb' | wc -l)
echo "[INFO] collected .deb count: ${count}"

cd "${ROOT_DIR}"
mkdir -p manifests
if compgen -G "debs/*.deb" > /dev/null; then
  (cd debs && sha256sum *.deb) > manifests/SHA256SUMS.txt
  echo "[INFO] checksum written: ${ROOT_DIR}/manifests/SHA256SUMS.txt"
else
  echo "[WARN] no .deb files found in ${DEBS_DIR}"
fi
