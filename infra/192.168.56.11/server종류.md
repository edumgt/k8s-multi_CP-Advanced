# 192.168.56.11

| 항목 | 값 |
|---|---|
| 서버종류 | Kubernetes Worker Node |
| OS | Ubuntu 24.04 LTS |
| 주요역할 | 워크로드 파드 실행, CNI/Ingress 백엔드 처리 |
| 접속 | `ssh ubuntu@192.168.56.11` |
| 점검명령 | `kubectl get nodes -o wide` |
