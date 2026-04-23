# 192.168.56.12

| 항목 | 값 |
|---|---|
| 서버종류 | Kubernetes Control Plane 3 |
| OS | Ubuntu 24.04 LTS |
| 주요역할 | kube-apiserver, scheduler, controller-manager, etcd member 3 |
| 접속 | `ssh ubuntu@192.168.56.12` |
| 점검명령 | `kubectl get nodes -o wide` |
