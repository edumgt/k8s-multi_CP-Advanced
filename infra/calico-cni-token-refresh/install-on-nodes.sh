#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REFRESHER_TOKEN="${REFRESHER_TOKEN:?set REFRESHER_TOKEN}"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_PASSWORD="${SSH_PASSWORD:-ubuntu}"
SUDO_PASSWORD="${SUDO_PASSWORD:-$SSH_PASSWORD}"
API_SERVER="${API_SERVER:-https://192.168.56.31:6443}"

if [[ "$#" -gt 0 ]]; then
  NODES=("$@")
else
  NODES=(192.168.56.10 192.168.56.11 192.168.56.12 192.168.56.13)
fi

for node in "${NODES[@]}"; do
  echo "==> installing calico token refresher on ${node}"

  sshpass -p "${SSH_PASSWORD}" rsync -a \
    -e "ssh -o StrictHostKeyChecking=no" \
    "${REPO_ROOT}/refresh-calico-cni-token.sh" \
    "${REPO_ROOT}/calico-cni-token-refresh.service" \
    "${REPO_ROOT}/calico-cni-token-refresh.timer" \
    "${SSH_USER}@${node}:/tmp/calico-cni-token-refresh/"

  sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no "${SSH_USER}@${node}" \
    "export REFRESHER_TOKEN='${REFRESHER_TOKEN}' API_SERVER='${API_SERVER}' SUDO_PASSWORD='${SUDO_PASSWORD}'; bash -s" <<'EOF'
set -euo pipefail

CA_DATA="$(printf '%s\n' "${SUDO_PASSWORD}" | sudo -S awk '/certificate-authority-data:/ { print $2; exit }' /etc/cni/net.d/calico-kubeconfig)"

printf '%s\n' "${SUDO_PASSWORD}" | sudo -S mkdir -p /etc/calico-cni-token-refresher /usr/local/sbin
printf '%s\n' "${SUDO_PASSWORD}" | sudo -S install -m 0755 /tmp/calico-cni-token-refresh/refresh-calico-cni-token.sh /usr/local/sbin/refresh-calico-cni-token.sh
printf '%s\n' "${SUDO_PASSWORD}" | sudo -S install -m 0644 /tmp/calico-cni-token-refresh/calico-cni-token-refresh.service /etc/systemd/system/calico-cni-token-refresh.service
printf '%s\n' "${SUDO_PASSWORD}" | sudo -S install -m 0644 /tmp/calico-cni-token-refresh/calico-cni-token-refresh.timer /etc/systemd/system/calico-cni-token-refresh.timer

cat <<CFG | sudo tee /etc/calico-cni-token-refresher/kubeconfig >/dev/null
apiVersion: v1
kind: Config
clusters:
- name: local
  cluster:
    server: ${API_SERVER}
    certificate-authority-data: ${CA_DATA}
users:
- name: calico-cni-token-refresher
  user:
    token: ${REFRESHER_TOKEN}
contexts:
- name: calico-cni-token-refresher
  context:
    cluster: local
    user: calico-cni-token-refresher
current-context: calico-cni-token-refresher
CFG

printf '%s\n' "${SUDO_PASSWORD}" | sudo -S chmod 0600 /etc/calico-cni-token-refresher/kubeconfig
printf '%s\n' "${SUDO_PASSWORD}" | sudo -S systemctl daemon-reload
printf '%s\n' "${SUDO_PASSWORD}" | sudo -S systemctl enable --now calico-cni-token-refresh.timer
printf '%s\n' "${SUDO_PASSWORD}" | sudo -S systemctl start calico-cni-token-refresh.service
printf '%s\n' "${SUDO_PASSWORD}" | sudo -S systemctl status --no-pager calico-cni-token-refresh.timer | sed -n '1,12p'
EOF
done
