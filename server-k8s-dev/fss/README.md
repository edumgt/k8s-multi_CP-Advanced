## 문서 환경 기준 (VMware)

| 항목 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware Workstation/ESXi | 본 저장소 문서는 VMware 기반 리눅스 VM을 기준으로 작성 |
| VM OS | Ubuntu 24.04 LTS | 문서 내 명령은 Ubuntu 쉘 환경 기준 |
| Kubernetes 접근 | `kubectl` + `~/.kube/config` | VM 또는 관리자 PC에서 API Server(예: `192.168.56.10:6443`) 접속 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 문서 명령 실행 기준 프로젝트 루트 |

# FSS Jupyter K8s Blueprint

이 디렉터리는 아래 요구사항을 반영한 K8s 매니페스트 초안입니다.

- namespace 분리: `app`, `dis`, `infra`, `sample`, `unitest`
- DIS 앱:
  - `app/fss-dis-server` (Node 22, Express 5, Socket.io, Mongoose, Redis session)
  - `app/fss-dis-metrics-collector` (metrics-server API를 주기적으로 MongoDB에 적재)
  - `app/fss-dis-frontend` (Vue3 + Quasar SPA)
- 사용자 Jupyter 동적 라우팅:
  - headless service
  - wildcard ingress
  - named pod 라우팅용 router deployment
- 인프라 서비스:
  - MongoDB (root / root-password, Secret 분리)
  - Redis (ACL root / root-password, Secret 분리)

## Apply

```bash
# dev
kubectl apply -k infra/k8s/fss/overlays/dev

# prod
kubectl apply -k infra/k8s/fss/overlays/prod
```

`overlays/dev`는 `infra` namespace의 Mongo/Redis PVC 바인딩을 위해 로컬 PV(`local-pv.yaml`)를 포함합니다.

## MetalLB Access (권장)

`overlays/dev`에는 아래가 포함되어 있습니다.

- `metallb-system/fss-vpn-pool` IPAddressPool (`192.168.56.240`)
- `ingress-nginx/ingress-nginx-controller` LoadBalancer 고정 IP (`192.168.56.240`)

적용 후 확인:

```bash
kubectl -n metallb-system get ipaddresspool,l2advertisement
kubectl -n ingress-nginx get svc ingress-nginx-controller -o wide
kubectl -n app get ingress fss-dis
```

VPN 브라우저 접속:

- `http://192.168.56.240` (도메인 없이 즉시 접근)
- 도메인 준비 후 `dis.fss.or.kr -> 192.168.56.240` DNS 연결

## Dynamic Route Design

고정 ingress/service 하나로 다음 형식을 처리합니다.

- `https://test-user-1234.service.jupyter.fss.or.kr`
- `https://test-user-5678.service.jupyter.fss.or.kr`

동작 방식:

1. wildcard ingress가 `dis/jupyter-pod-router` 로 전달
2. router가 host prefix (`test-user-1234`)를 Pod name으로 해석
3. `http://<pod>.jupyter-named-pod.dis.svc.cluster.local:8888` 로 프록시

### Required Pod Contract

백엔드가 사용자 Pod 생성 시 아래를 보장해야 합니다.

1. Pod 이름: 외부 host prefix와 일치
2. Pod spec:
   - `hostname: <pod-name>`
   - `subdomain: jupyter-named-pod`
3. Label:
   - `app.kubernetes.io/component=user-jupyter`
4. 사용자 PVC mount 및 quota 적용

## Node Migration Notes

Python 기반 Jupyter 관리 로직을 Node 기반으로 전환하기 위해 아래 리소스를 추가했습니다.

- `infra/k8s/fss/base/dis-app.yaml`
  - `fss-dis-server` Deployment/Service/Ingress
  - `fss-dis-frontend` Deployment/Service
  - `fss-dis-server` ServiceAccount + ClusterRole + ClusterRoleBinding
  - 앱 ConfigMap/Secret

백엔드 소스:
- `apps/fss-dis-server-node`

프론트엔드 소스:
- `apps/fss-dis-frontend`

## Important Production Notes

`overlays/prod` 의 Mongo/Redis replica 3 패치는 "복제 수"만 올립니다.

- Mongo: 실제 운영 HA는 replica set init 및 health 정책이 추가로 필요
- Redis: 실제 운영 HA는 Sentinel 또는 Redis Cluster 구성이 추가로 필요

24x7 mission critical이 아니라면 단일 인스턴스 유지 정책도 가능합니다.

## Harbor Projects

요구사항에 맞춰 프로젝트를 다음처럼 가정합니다.

- `app`: fss-dis-server, fss-dis-batch 등
- `dis`: 사용자 Jupyter 이미지
- `library`: 공통 인프라 이미지

현재 fss base는 아래 이미지를 사용합니다.

- `docker.io/library/mongo:8.2.5`
- `docker.io/library/redis:8.6.1`
- `ghcr.io/k8s-fss/jupyter-pod-router:latest`

## Secret Management

Mongo/Redis 인증 정보는 StatefulSet 매니페스트와 분리된 Kubernetes Secret 리소스로 관리합니다.

- `base/mongodb-secret.yaml` (`mongo-auth`)
- `base/redis-secret.yaml` (`redis-auth`)

## Storage Recommendation

요구사항에서 "Rook-Ceph over NFS"를 고려했지만, 실무적으로는 아래 우선순위를 권장합니다.

1. **권장**: Rook-Ceph + CephFS 동적 PVC (PVC size quota를 스토리지 계층에서 강제)
2. NFS 강제 환경: NFS provisioner + 별도 디렉터리 quota 운영 자동화

`Rook-Ceph NFS`는 "Ceph를 NFS로 export"하는 모델이며, 기존 외부 NFS 위에 Ceph를 얹는 구조와는 다릅니다.

## Verification Examples

```bash
# namespace 확인
kubectl get ns | egrep 'app|dis|infra|sample|unitest'

# wildcard ingress / router
kubectl -n dis get ingress,svc,deploy

# infra
kubectl -n infra get sts,svc,pvc,secret

# 스토리지 검증용 busybox (sample namespace)
kubectl -n sample run io-test --image=busybox:1.36 --restart=Never -- sleep 3600
kubectl -n sample exec -it io-test -- sh
# inside pod:
# df -h
# dd if=/dev/zero of=/tmp/test.bin bs=1M count=1024

# k8s metrics collector 확인
kubectl -n app get deploy,pod | egrep 'fss-dis-metrics-collector|NAME'
kubectl -n app logs deploy/fss-dis-metrics-collector --tail=50

# MongoDB 적재 확인
kubectl -n infra exec -it mongo-0 -- sh -lc \
  'mongosh "mongodb://root:root-password@localhost:27017/fss_dis?authSource=admin" \
  --eval "db.k8s_metrics_samples.find().sort({sampled_at:-1}).limit(3).pretty()"'
```
