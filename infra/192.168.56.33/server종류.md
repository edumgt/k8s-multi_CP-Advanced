# 192.168.56.33

| 항목 | 값 |
|---|---|
| 서버종류 | GitLab 서버 |
| OS | Ubuntu 24.04 LTS |
| 호스트명 | `gitlab-33` |
| 관리 접속 | `ssh ubuntu@192.168.56.33` |
| SSH 계정 | `ubuntu / ubuntu` |
| 주요역할 | 소스 저장소, CI/CD, GitLab Web UI |
| GitLab 직접 접속 후보 URL | `http://192.168.56.33`, `https://192.168.56.33` |
| GitLab 포트 | 미확정 (`80/443` 여부 확인 필요) |
| GitLab Runner 사용 여부 | 미확정 |
| GitLab Container Registry 사용 여부 | 미확정 |

## 현재 역할

- 이 서버는 GitLab 전용 VM으로 사용
- 소스 저장소 관리와 GitLab Web UI 제공 용도
- 필요 시 Runner/Registry/Pages 등 부가 역할은 실제 구성에 맞춰 문서 추가 갱신 필요

## 접속/운영 확인 항목

- GitLab Web UI 직접 접속은 `http://192.168.56.33` 또는 `https://192.168.56.33` 후보 기준으로 확인 필요
- 외부 도메인, 리버스 프록시, TLS 인증서 적용 여부는 아직 repo 문서에 없음
- SSH 접속은 관리용이며, GitLab 서비스 포트와 별개로 취급

## Runner / Registry 상태

- GitLab Runner:
  - 현재 repo 문서상 사용 여부가 확인되지 않음
  - 별도 Runner VM인지, `192.168.56.33` 내장형인지 확인 필요
- GitLab Container Registry:
  - 현재 repo 문서상 사용 여부가 확인되지 않음
  - 현 시점 이미지 저장소 역할은 Harbor(`192.168.56.32`)가 담당하는 문서 구조임
  - 라이브러리 캐시는 Nexus(`192.168.56.31`) 문서에 별도 정리되어 있음

## 점검 시 우선 확인할 값

- GitLab Web UI 포트: `80`, `443`, 또는 커스텀 포트 사용 여부
- GitLab 설치 방식: 패키지 설치 / Docker / Docker Compose
- GitLab Runner 등록 여부: `gitlab-runner` 서비스 또는 컨테이너 존재 여부
- Registry 사용 여부: GitLab 설정의 registry external URL 존재 여부

## 운영 메모

- 실제 GitLab 설치 방식(패키지 설치, Docker Compose, 컨테이너 단독 실행 등)은 추가 점검 후 반영 필요
- 외부 접속 URL, 포트, TLS 인증서 적용 상태는 실제 운영값 확인 후 문서 보강 필요

## root / NewPassword123