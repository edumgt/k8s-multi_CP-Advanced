# 192.168.56.31

| 항목 | 값 |
|---|---|
| 서버종류 | Nexus Repository Manager 서버 |
| OS | Ubuntu 24.04 LTS |
| 호스트명 | `nexus-31` |
| 접속 | `ssh ubuntu@192.168.56.31` |
| SSH 계정 | `ubuntu / ubuntu` |
| Nexus 런타임 | Docker 컨테이너(`sonatype/nexus3:latest`) |
| 외부 접속 엔드포인트(직접) | `http://192.168.56.31:8081` |
| 외부 접속 엔드포인트(VIP/Ingress TCP) | `192.168.56.240:8081~8083` |

## 현재 역할 (2026-04-17 기준)

- 이 서버는 Docker 이미지를 저장하는 Harbor 대체가 아니라, 라이브러리 캐시(Nexus) 용도로 사용
- `applications` 의 npm/pip 의존성 설치 경로를 Nexus로 통일
- Docker 이미지 저장/조회는 기존 Harbor(`192.168.56.32`)를 사용

## Nexus 실행 상태

- 컨테이너명: `nexus3`
- 포트 바인딩:
  - `0.0.0.0:8081 -> nexus:8081` (Nexus UI / REST API)
  - `0.0.0.0:8082 -> nexus:8082`
  - `0.0.0.0:8083 -> nexus:8083`
- 데이터 경로: 컨테이너 `/nexus-data`

## Repository 구성

- `npm-proxy` (proxy): upstream `https://registry.npmjs.org`
- `npm-all` (group): `npm-proxy`를 포함한 npm 공용 진입점
- `pypi-proxy` (proxy): upstream `https://pypi.org`

## applications 연동 기준값

- npm registry:
  - `http://192.168.56.31:8081/repository/npm-all/`
- pip index:
  - `http://192.168.56.31:8081/repository/pypi-proxy/simple`

## 네트워크/방화벽

- UFW 인바운드 허용 포트:
  - `8081/tcp`, `8082/tcp`, `8083/tcp`
- ingress-nginx TCP 포워딩(클러스터 VIP `192.168.56.240`) 추가:
  - `8081 -> infra/nexus-external:8081`
  - `8082 -> infra/nexus-external:8082`
  - `8083 -> infra/nexus-external:8083`

## 운영 메모

- Nexus 기본 admin 비밀번호 파일:
  - 컨테이너 내부 `/nexus-data/admin.password`
- 익명 다운로드 정책에 따라 npm/pip 설치 시 인증 필요할 수 있음
- 대량 캐시 시딩은 최초 1회 시간이 오래 걸릴 수 있음(상위 저장소 fetch + 캐시 생성)
