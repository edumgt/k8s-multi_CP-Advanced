# 3-Control-Plane HA 운영 메모

이 문서는 이 repo 를 `Control Plane 3대` 기준으로 운영할 때의 목표 토폴로지와 최소 체크리스트를 정리한 문서다.

## 목표 노드 배치

| IP | 역할 |
|---|---|
| `192.168.56.10` | Control Plane 1 + stacked etcd member 1 |
| `192.168.56.11` | Control Plane 2 + stacked etcd member 2 |
| `192.168.56.12` | Control Plane 3 + stacked etcd member 3 |
| `192.168.56.13` | Worker Node |

## 반드시 필요한 VIP 분리

- `192.168.56.240` 은 MetalLB/Ingress VIP 이므로 Kubernetes API endpoint 로 재사용하지 않는다.
- kubeadm HA 구성을 위해 `6443/TCP` 를 받는 별도 `Control Plane VIP` 가 필요하다.
- 추천 방식은 VMware 동일 서브넷 내 미사용 IP 1개를 예약한 뒤, 각 control plane 노드에서 `keepalived + HAProxy` 로 VIP 를 운영하는 것이다.
- 예시:
  - VIP: `192.168.56.241`
  - API endpoint: `192.168.56.241:6443`
  - kubeadm `controlPlaneEndpoint`: `192.168.56.241:6443`

## 권장 kubeadm 흐름

1. 첫 번째 control plane(`192.168.56.10`)에서 `kubeadm init --control-plane-endpoint "<vip>:6443"` 로 초기화
2. CNI 배포 후 `192.168.56.11`, `192.168.56.12` 를 `kubeadm join ... --control-plane` 으로 추가
3. `192.168.56.13` 은 일반 worker 로 `kubeadm join` 수행
4. 모든 kubeconfig, automation, `kubectl` 접속 지점은 개별 노드 IP 대신 VIP 로 통일

## stacked etcd 운영 메모

- 이 repo 는 외부 etcd 클러스터보다 `kubeadm` 기본 형태인 stacked etcd 를 전제로 보는 편이 자연스럽다.
- control plane 3대면 etcd member 도 3개가 되므로 quorum 은 2다.
- 장애 복구 시에는 "한 노드 복구"가 아니라 "quorum 유지/재형성" 관점으로 접근해야 한다.
- snapshot 백업은 어느 한 healthy member 에서 떠도 되지만, 복원 절차는 전체 member 관계를 확인한 뒤 진행한다.

권장 확인 명령:

```bash
kubectl get nodes -o wide
kubectl get pods -n kube-system -o wide
sudo ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/apiserver-etcd-client.crt \
  --key=/etc/kubernetes/pki/apiserver-etcd-client.key \
  member list -w table
```

## keepalived + HAProxy 최소 역할

- `keepalived`: control plane VIP 소유권 이동
- `HAProxy`: 로컬 `6443` 또는 피어 control plane `6443` 로 TCP 전달
- 세 노드 모두 동일 설정을 두고 우선순위만 다르게 둔다.

예시 백엔드:

```txt
192.168.56.10:6443
192.168.56.11:6443
192.168.56.12:6443
```

## repo 관점에서 바뀌는 운영 기준

- 인벤토리 문서상 `192.168.56.11`, `192.168.56.12` 는 더 이상 worker 가 아니다.
- ingress 진입점과 kube-apiserver 진입점을 분리해서 문서화한다.
- etcd 백업/복원 문서는 단일 control plane 가정이 아니라 3-member quorum 기준으로 읽어야 한다.
