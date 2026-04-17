# GPU Offline Bundle (Ubuntu 24.04)

작업 경로:
- `/home/ubuntu/k8s-fss/gpu-offline-ubuntu24`

구성:
- `debs/`: 오프라인 설치용 `.deb`
- `manifests/SHA256SUMS.txt`: 체크섬
- `scripts/collect-debs.sh`: 온라인 환경에서 `.deb` 수집
- `scripts/install-offline.sh`: 오프라인 설치
- `scripts/make-tar.sh`: tar 생성
- `scripts/packages.txt`: 반입 패키지 목록

## 1) 온라인 환경에서 번들 생성

```bash
cd /home/ubuntu/k8s-fss/gpu-offline-ubuntu24
./scripts/collect-debs.sh
./scripts/make-tar.sh
```

생성물 예시:
- `/home/ubuntu/k8s-fss/gpu-offline-ubuntu24-YYYYMMDD.tar.gz`
- `/home/ubuntu/k8s-fss/gpu-offline-ubuntu24-YYYYMMDD.tar.gz.sha256`

## 2) 오프라인 환경에서 설치

```bash
tar -xzf gpu-offline-ubuntu24-YYYYMMDD.tar.gz
cd gpu-offline-ubuntu24
./scripts/install-offline.sh
```

체크섬 검증 생략:

```bash
./scripts/install-offline.sh --skip-sha256
```

## 3) 참고

- GPU가 없는 호스트에서는 `nvidia-smi` 실패 가능 (정상)
- 패키지 호환성은 커널/드라이버 버전에 영향 받음
- 필요 시 `scripts/packages.txt` 수정 후 재수집
