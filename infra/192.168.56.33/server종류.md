# 192.168.56.33

| 항목 | 값 |
|---|---|
| 서버종류 | GitLab 서버 |
| OS | Ubuntu 24.04 LTS |
| 호스트명 | `gitlab-33` |
| 관리 접속 | `ssh ubuntu@192.168.56.33` |
| SSH 계정 | `ubuntu / ubuntu` |
| 주요역할 | 소스 저장소, CI/CD, GitLab Web UI |

## 현재 역할

- 이 서버는 GitLab 전용 VM으로 사용
- 소스 저장소 관리와 GitLab Web UI 제공 용도
- 필요 시 Runner/Registry/Pages 등 부가 역할은 실제 구성에 맞춰 문서 추가 갱신 필요

## 운영 메모

- 실제 GitLab 설치 방식(패키지 설치, Docker Compose, 컨테이너 단독 실행 등)은 추가 점검 후 반영 필요
- 외부 접속 URL, 포트, TLS 인증서 적용 상태는 실제 운영값 확인 후 문서 보강 필요
