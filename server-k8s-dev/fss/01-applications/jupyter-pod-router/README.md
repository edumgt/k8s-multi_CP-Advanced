## 문서 환경 기준 (VMware)

| 항목 | 값 | 설명 |
|---|---|---|
| 하이퍼바이저 | VMware Workstation/ESXi | 본 저장소 문서는 VMware 기반 리눅스 VM을 기준으로 작성 |
| VM OS | Ubuntu 24.04 LTS | 문서 내 명령은 Ubuntu 쉘 환경 기준 |
| Kubernetes 접근 | `kubectl` + `~/.kube/config` | VM 또는 관리자 PC에서 API Server(예: `192.168.56.10:6443`) 접속 |
| 기본 작업 경로 | `/home/ubuntu/k8s-fss` | 문서 명령 실행 기준 프로젝트 루트 |

# jupyter-pod-router

`*.service.jupyter.fss.or.kr` 또는 `*.service.jupyter.fss.or.kr` 같은 와일드카드 host를 받아서, host prefix를 Pod name으로 해석해
`<pod>.<headless-service>.<namespace>.svc.cluster.local:8888` 으로 프록시하는 라우터입니다.

## Environment Variables

- `PORT` (default: `8080`)
- `ROUTER_HOST_SUFFIX` (default: `service.jupyter.fss.or.kr`)
- `ROUTER_HEADLESS_SERVICE` (default: `jupyter-named-pod`)
- `ROUTER_TARGET_NAMESPACE` (default: `dis`)
- `ROUTER_TARGET_PORT` (default: `8888`)
- `ROUTER_REQUEST_TIMEOUT_MS` (default: `3600000`)

## Run

```bash
npm install
npm start
```

## Required Pod Contract

라우팅 대상 Jupyter Pod는 다음 규칙을 지켜야 합니다.

1. Pod 이름이 외부 host prefix와 동일해야 함. 예: `test-user-1234`
2. `subdomain: jupyter-named-pod` 를 지정해야 headless DNS 이름이 안정적으로 생성됨.
3. `app.kubernetes.io/component=user-jupyter` 라벨을 가져야 headless service selector와 매칭됨.
