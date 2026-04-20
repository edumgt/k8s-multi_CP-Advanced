#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/etcd}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
ENDPOINTS="${ENDPOINTS:-https://127.0.0.1:2379}"
CACERT="${CACERT:-/etc/kubernetes/pki/etcd/ca.crt}"
CERT="${CERT:-/etc/kubernetes/pki/apiserver-etcd-client.crt}"
KEY="${KEY:-/etc/kubernetes/pki/apiserver-etcd-client.key}"
CTR_NAMESPACE="${CTR_NAMESPACE:-k8s.io}"
ETCD_IMAGE="${ETCD_IMAGE:-}"
TIMESTAMP="$(date +%F-%H%M%S)"
SNAPSHOT_BASENAME="etcd-snapshot-${TIMESTAMP}"
SNAPSHOT_PATH="${BACKUP_DIR}/${SNAPSHOT_BASENAME}.db"
ARCHIVE_PATH="${SNAPSHOT_PATH}.gz"
CHECKSUM_PATH="${ARCHIVE_PATH}.sha256"

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "ERROR: required command not found: $1"
    exit 1
  fi
}

run_host_etcdctl() {
  ETCDCTL_API=3 etcdctl \
    --endpoints="${ENDPOINTS}" \
    --cacert="${CACERT}" \
    --cert="${CERT}" \
    --key="${KEY}" \
    "$@"
}

run_ctr_etcdctl() {
  local task_id="etcdctl-${TIMESTAMP}-$$"
  local image_ref

  image_ref="$(resolve_etcd_image)"

  ctr -n "${CTR_NAMESPACE}" run --rm --net-host \
    --mount "type=bind,src=/etc/kubernetes/pki,dst=/etc/kubernetes/pki,options=rbind:ro" \
    --mount "type=bind,src=${BACKUP_DIR},dst=${BACKUP_DIR},options=rbind:rw" \
    "${image_ref}" "${task_id}" \
    etcdctl \
    --endpoints="${ENDPOINTS}" \
    --cacert="${CACERT}" \
    --cert="${CERT}" \
    --key="${KEY}" \
    "$@"
}

run_host_etcdutl() {
  etcdutl "$@"
}

run_ctr_etcdutl() {
  local task_id="etcdutl-${TIMESTAMP}-$$"
  local image_ref

  image_ref="$(resolve_etcd_image)"

  ctr -n "${CTR_NAMESPACE}" run --rm \
    --mount "type=bind,src=${BACKUP_DIR},dst=${BACKUP_DIR},options=rbind:rw" \
    "${image_ref}" "${task_id}" \
    etcdutl \
    "$@"
}

resolve_etcd_image() {
  if [[ -n "${ETCD_IMAGE}" ]]; then
    printf '%s\n' "${ETCD_IMAGE}"
    return
  fi

  ctr -n "${CTR_NAMESPACE}" images ls -q | \
    grep -E '(^|/)(etcd|platform-etcd):' | \
    head -n 1
}

etcdctl_cmd() {
  if command -v etcdctl >/dev/null 2>&1; then
    run_host_etcdctl "$@"
    return
  fi

  if command -v ctr >/dev/null 2>&1; then
    if [[ -z "$(resolve_etcd_image)" ]]; then
      log "ERROR: etcdctl not found on host and no cached etcd image was detected for ctr fallback."
      exit 1
    fi
    run_ctr_etcdctl "$@"
    return
  fi

  log "ERROR: neither host etcdctl nor ctr-based fallback is available."
  exit 1
}

etcdutl_cmd() {
  if command -v etcdutl >/dev/null 2>&1; then
    run_host_etcdutl "$@"
    return
  fi

  if command -v ctr >/dev/null 2>&1; then
    if [[ -z "$(resolve_etcd_image)" ]]; then
      log "ERROR: etcdutl not found on host and no cached etcd image was detected for ctr fallback."
      exit 1
    fi
    run_ctr_etcdutl "$@"
    return
  fi

  log "ERROR: neither host etcdutl nor ctr-based fallback is available."
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  log "ERROR: run this script as root or with sudo."
  exit 1
fi

require_cmd gzip
require_cmd sha256sum
require_cmd find

if ! command -v etcdctl >/dev/null 2>&1 && ! command -v ctr >/dev/null 2>&1; then
  log "ERROR: neither etcdctl nor ctr is available on this host."
  exit 1
fi

if ! command -v etcdutl >/dev/null 2>&1 && ! command -v ctr >/dev/null 2>&1; then
  log "ERROR: neither etcdutl nor ctr is available on this host."
  exit 1
fi

if [[ ! -f "${CACERT}" || ! -f "${CERT}" || ! -f "${KEY}" ]]; then
  log "ERROR: etcd TLS files not found."
  log "       CACERT=${CACERT}"
  log "       CERT=${CERT}"
  log "       KEY=${KEY}"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

log "Starting etcd snapshot backup."
log "Backup directory: ${BACKUP_DIR}"
log "Retention days: ${RETENTION_DAYS}"
log "Endpoints: ${ENDPOINTS}"
if command -v etcdctl >/dev/null 2>&1; then
  log "Execution mode: host etcdctl"
else
  log "Execution mode: ctr fallback ($(resolve_etcd_image))"
fi

etcdctl_cmd snapshot save "${SNAPSHOT_PATH}"

if ! etcdutl_cmd snapshot status "${SNAPSHOT_PATH}" -w table; then
  log "WARNING: snapshot status validation failed; continuing because snapshot creation itself succeeded."
fi

gzip -f "${SNAPSHOT_PATH}"
sha256sum "${ARCHIVE_PATH}" > "${CHECKSUM_PATH}"

log "Snapshot archive created: ${ARCHIVE_PATH}"
log "Checksum file created: ${CHECKSUM_PATH}"

find "${BACKUP_DIR}" -maxdepth 1 -type f \
  \( -name 'etcd-snapshot-*.db.gz' -o -name 'etcd-snapshot-*.db.gz.sha256' \) \
  -mtime +"${RETENTION_DAYS}" -print -delete

log "Old backup cleanup completed."
log "etcd backup job finished successfully."
