# Calico CNI Token Refresh

Calico CNI reads `/etc/cni/net.d/calico-kubeconfig` on the node host. In this
cluster that file contains a short-lived service account token, so it must be
refreshed before it expires.

This directory contains:

- `rbac.yaml`: service account and RBAC that can mint tokens for
  `calico-cni-plugin`
- `refresh-calico-cni-token.sh`: host-side refresh script
- `calico-cni-token-refresh.service`: systemd oneshot unit
- `calico-cni-token-refresh.timer`: systemd timer that runs every 6 hours

Install flow:

1. `kubectl apply -f infra/calico-cni-token-refresh/rbac.yaml`
2. Read the generated token from secret
3. Install the script, kubeconfig, and timer on each node

The node-local kubeconfig should point at the control-plane VIP
`https://192.168.56.31:6443`.
