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
