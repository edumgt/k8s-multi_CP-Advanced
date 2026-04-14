# fss-dis-frontend

`dis.fss.or.kr`용 Vue3 + Quasar SPA 프론트엔드입니다.

## 배포 대상
- Harbor image: `ghcr.io/k8s-fss/fss-dis-frontend`
- Kubernetes deployment: `fss-dis-frontend` (`infra/k8s/fss/base/dis-app.yaml`)

## 환경 파일
- `.env.dev`/`.env.prod` 의 `VITE_API_BASE_URL` 기본값은 비워둡니다.
- 비어 있으면 브라우저 접속 host(IP/도메인)를 자동 사용하므로 MetalLB 고정 IP와 DNS 전환을 모두 지원합니다.
