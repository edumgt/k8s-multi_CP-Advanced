# jupyter-pod-router

`jupyter-pod-router`는 ingress의 `/jupyter` path를 받아서
`/jupyter/lab?userid=<user>` 형태의 요청을 내부 Jupyter Pod로 프록시합니다.

브라우저에는 `podName`과 `token`을 직접 노출하지 않고, router가 백엔드
`/internal/jupyter/route-session?userid=<user>`를 호출해서 아래 정보를 받아옵니다.

- `upstream_host`
- `token`

그 뒤 실제 upstream 요청은 Kubernetes DNS
`<pod>.<headless-service>.<namespace>.svc.cluster.local:8888`로 보냅니다.

## 언제 필요한가
- 필요한 경우:
  - Ingress에서 `http://<ingress-host>/jupyter/lab?userid=<user>` 형태로 사용자 Pod에 라우팅할 때
- 필요 없는 경우:
  - 백엔드가 `podIP:port`로 직접 프록시하고, Ingress wildcard 라우팅을 쓰지 않을 때

## air-gap 빌드
외부 인터넷 없이 빌드하려면, 베이스 이미지를 내부 레지스트리에 미리 미러해두어야 합니다.
`Dockerfile`은 외부 기본 이미지를 두지 않으므로 `BASE_IMAGE`를 반드시 지정해야 합니다.

예시:
```bash
docker build \
  --build-arg BASE_IMAGE=10.111.111.72:80/library/node:22-alpine \
  -t 10.111.111.72:80/app/jupyter-pod-router:0.1.0 \
  /home/ubuntu/k8s-fss/applications/jupyter-pod-router

docker push 10.111.111.72:80/app/jupyter-pod-router:0.1.0
```

## 배포
```bash
kubectl apply -f /home/ubuntu/k8s-fss/applications/jupyter-pod-router/jupyter-pod-router.airgap.yaml
```

## 주요 환경변수
- `ROUTER_PATH_PREFIX`: ingress path prefix (기본 `/jupyter`)
- `ROUTER_BACKEND_URL`: `userid -> upstream_host/token` 조회용 백엔드 URL
- `ROUTER_SHARED_SECRET`: 백엔드 internal API 보호용 shared secret
- `ROUTER_RESOLVE_MODE`: `deterministic`이면 backend 없이 `userid -> pod/token` 직접 계산
- `ROUTER_JUPYTER_TOKEN`: deterministic 모드에서 사용할 token seed
- `ROUTER_AUTH_COOKIE_NAME`: 프론트 로그인 세션 토큰 쿠키 이름 (기본 `fss_app_session`)
- `ROUTER_USER_COOKIE_NAME`: 이후 `/jupyter/api/...` 요청에 사용할 사용자 식별 쿠키
- `ROUTER_HEADLESS_SERVICE`: headless service 이름 (기본 `jupyter-named-pod`)
- `ROUTER_TARGET_NAMESPACE`: 사용자 Pod 네임스페이스
- `ROUTER_TARGET_PORT`: Jupyter 포트 (기본 `8888`)
- Pod 대상 해석은 backend 응답의 `upstream_host`를 사용

## 요청 흐름
1. 사용자가 `/jupyter/lab?userid=test-user`로 접속
2. router가 브라우저의 `fss_app_session` 쿠키를 읽음
3. router가 backend internal API로 `userid=test-user`와 로그인 session을 같이 전달
4. backend가 session의 실제 사용자와 `userid`가 일치할 때만 `upstream_host`와 Jupyter `token` 응답
5. router가 `/jupyter/lab?token=...` 형태로 내부 upstream 요청 프록시
6. 이후 API/WebSocket 요청은 `jupyter_route_userid` 쿠키로 같은 Pod에 연결

Deterministic mode:

1. 사용자가 `/jupyter/lab?userid=test-user`로 접속
2. router가 backend 없이 `userid`에서 pod 이름과 token을 직접 계산
3. `lab-test-user-c56486f8` Pod로 바로 프록시

## 백엔드 요구사항
- backend에 `/internal/jupyter/route-session?userid=<user>`가 있어야 함
- router는 `x-router-secret` 헤더로 접근
- backend는 `x-user-session`으로 전달된 로그인 session이 실제 `userid` 사용자와 일치하는지 검사해야 함
- backend 응답 예시:

```json
{
  "username": "test-user",
  "pod_name": "lab-test-user-c56486f8",
  "upstream_host": "lab-test-user-c56486f8.jupyter-named-pod.dis.svc.cluster.local",
  "token": "..."
}
```

## 검증
```bash
kubectl -n dis get deploy,svc,ingress | egrep 'jupyter-pod-router|jupyter-user-routing'
kubectl -n dis logs deploy/jupyter-pod-router --tail=100
curl "http://<ingress-ip>/jupyter/lab?userid=test-user"
```
