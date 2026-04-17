## 2) 권장 버전 세트(예시)
- 드라이버: 550 계열
- CUDA: 12.4
- cuDNN: CUDA 12 대응 버전
- NCCL: CUDA 12 대응 버전

---

## 3) 반입 대상 패키지 목록

### 3.1 드라이버(필수)
- `nvidia-driver-550`
- `nvidia-dkms-550`
- `nvidia-utils-550`
- `libnvidia-compute-550`
- `libnvidia-decode-550`
- `libnvidia-encode-550`
- `libnvidia-extra-550`
- `libnvidia-gl-550`
- `nvidia-kernel-common-550`
- `nvidia-kernel-source-550`
- `nvidia-compute-utils-550`

### 3.2 CUDA Toolkit (필수)
- `cuda-toolkit-12-4`
- (또는 메타패키지) `cuda`

### 3.3 cuDNN (딥러닝 필수)
- `libcudnn9-cuda-12`
- `libcudnn9-dev-cuda-12`

### 3.4 NCCL (분산/멀티GPU 권장)
- `libnccl2`
- `libnccl-dev`

### 3.5 컨테이너 GPU 런타임 (K8s/도커 필수)
- `nvidia-container-toolkit`
- `nvidia-container-toolkit-base`
- `libnvidia-container1`
- `libnvidia-container-tools`

### 3.6 K8s 배포 파일(파일 반입용)
- `nvidia-device-plugin` manifest
- (선택) GPU Operator Helm chart (`.tgz`) + values 파일

---

## 4) 오프라인 번들 구조

작업 경로:
- `/home/ubuntu/k8s-fss/gpu-offline-ubuntu24/`

구조:
```text
gpu-offline-ubuntu24/
  debs/
  manifests/
  scripts/
    install-offline.sh
    make-tar.sh
  README.md
```

설명:
- `debs/`: 반입할 `.deb` 파일 저장
- `manifests/SHA256SUMS.txt`: 무결성 검증용 체크섬
- `scripts/install-offline.sh`: 반입 후 오프라인 설치 스크립트
- `scripts/make-tar.sh`: 번들 tar 생성 스크립트

---

## 5) 실제 수행 절차

### 5.1 패키지 수집(.deb)
- `apt-get --download-only` 방식으로 설치 없이 `.deb`만 수집
- 수집 위치: `/home/ubuntu/k8s-fss/gpu-offline-ubuntu24/debs`

### 5.2 체크섬 생성
```bash
cd /home/ubuntu/k8s-fss/gpu-offline-ubuntu24/debs
sha256sum *.deb > ../manifests/SHA256SUMS.txt
```

### 5.3 tar 생성
```bash
cd /home/ubuntu/k8s-fss/gpu-offline-ubuntu24
./scripts/make-tar.sh
```

---

## 6) 생성 결과
- `.deb` 수집 수량: `183`
- 생성 파일: `/home/ubuntu/k8s-fss/gpu-offline-ubuntu24-20260417.tar.gz`
- 파일 크기: `522M`
- SHA256:
  - `ab70927c8c6aed5d2dbd5be6566f6fee507ca43b22c31d3707ecde8325abcb74`

---

## 7) 반입 후 설치 방법

```bash
tar -xzf gpu-offline-ubuntu24-YYYYMMDD.tar.gz
cd gpu-offline-ubuntu24
./scripts/install-offline.sh
```

체크섬 검증을 생략하려면:
```bash
./scripts/install-offline.sh --skip-sha256
```

---

## 8) 운영 시 참고
- GPU 없는 호스트에서는 드라이버 커널 모듈이 활성화되지 않아 `nvidia-smi`는 실패할 수 있음
- 이는 정상 동작이며, 사전 반입/보관 목적에는 영향 없음
- GPU 장착 후 최종 확인:
```bash
nvidia-smi
nvcc --version
nvidia-ctk --version
```
