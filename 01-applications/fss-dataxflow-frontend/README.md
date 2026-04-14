# fss-dataxflow-frontend

`dataxflow.fss.or.kr`용 Vue3 + Quasar SPA 프론트엔드입니다.

## 배포 대상
- Harbor image: `10.111.111.72/${HARBOR_PROJECT:-app}/fss-dataxflow-frontend`
- Kubernetes deployment: `fss-dataxflow-frontend` (별도 ELT 매니페스트에서 참조)

## 환경 파일
- `.env.dev` 기본 API: `http://api.dataxflow.fss.or.kr`
- `.env.prod` 기본 API: `http://api.dataxflow.fss.or.kr`
