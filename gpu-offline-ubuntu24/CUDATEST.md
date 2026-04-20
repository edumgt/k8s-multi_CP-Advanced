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
- `.deb` 수집 수량: `211`
- 생성 파일: `/home/ubuntu/k8s-fss/gpu-offline-ubuntu24-20260417.tar.gz`
- 파일 크기: `3.9G`
- SHA256:
  - `31f7c92ff2d30f5a7fa8b96c8d65fc9078affdfc2a923428dbd73064a4f8a4eb`

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

---

## 9) 내 PC(RTX 3080) 사용 예시 (WSL Ubuntu)

아래는 WSL Ubuntu에서 RTX 3080을 컨테이너에 전달해 확인하는 단일 예시입니다.

```bash
# 1) 호스트에서 GPU 인식 확인 (RTX 3080 표시 확인)
nvidia-smi

# 2) Docker에서 GPU 전달 테스트
docker run --rm --gpus all nvidia/cuda:12.5.1-base-ubuntu24.04 nvidia-smi
```

정상 기준:
- 출력의 `GPU Name`에 `GeForce RTX 3080`이 보임
- 컨테이너 내부에서도 동일하게 GPU가 노출됨

---

## 10) 2026-04-17 실제 GPU 연동 작업 이력(요약)

### 10.1 클러스터/매니페스트 작업
- `manifests/apps/ml-gpu-smoke.yaml` 생성 및 이미지를 내부 레지스트리로 변경
  - `192.168.56.10:30092/app/ml-cuda-base:12.5.1-ubuntu24.04`
- `manifests/apps/nvidia-device-plugin-ds.yaml` 생성
  - 이미지: `192.168.56.10:30092/platform/nvidia-device-plugin:v0.17.1`
- Device Plugin / Smoke Pod 적용은 완료했지만, GPU 리소스가 생성되지 않아 Pod는 `Pending` 유지

### 10.2 내부 Harbor 미러링
- 다음 이미지를 내부 Harbor(로컬 레지스트리)로 미러링 완료
  - `nvcr.io/nvidia/k8s-device-plugin:v0.17.1` -> `192.168.56.10:30092/platform/nvidia-device-plugin:v0.17.1`
  - `nvidia/cuda:12.5.1-base-ubuntu24.04` -> `192.168.56.10:30092/app/ml-cuda-base:12.5.1-ubuntu24.04`

### 10.3 워커 노드 설치 작업
- `w1/w2`에 오프라인 번들 전송 및 설치 수행
- 설치 중 HTTP 저장소 제약으로 일부 의존성 누락 발생 -> `https://archive.ubuntu.com`으로 정합화 후 재설치
- `nvidia-driver-550`, `nvidia-container-toolkit`, `cuda-toolkit-12-5` 설치 자체는 완료

### 10.4 최종 블로커 확인
- 워커 노드 `lspci` 결과가 `VMware SVGA`만 표시되고 NVIDIA PCI 장치가 없음
- `modprobe nvidia` -> `No such device`
- `nvidia-smi` -> 드라이버 통신 실패
- 따라서 K8s 노드 `nvidia.com/gpu`가 끝내 생성되지 않음

결론:
- 원인은 패키지/드라이버가 아니라 **가상화 계층에서 GPU PCI 장치가 VM에 전달되지 않은 것**

---

## 11) 왜 WSL에서는 되고, Workstation VM에서는 안 되는가

- WSL2:
  - Windows GPU 스택(WDDM)을 통해 GPU를 공유(para-virtual)받는 구조
  - 별도 PCI passthrough 없이도 `nvidia-smi` 가능
- VMware Workstation VM:
  - 일반적으로 RTX 3080 같은 PCIe GPU를 VM에 Direct passthrough 불가
  - VM 내부에 NVIDIA 장치가 보이지 않아 K8s GPU 노드 구성 불가

---

## 12) BIOS/플랫폼 체크 결과

- BIOS에서 `SVM Mode = Enabled` 확인
- Windows `msinfo32` 기준 `커널 DMA 보호 = 해제`
- 노트북/모바일 ASUS BIOS 특성상 `IOMMU` 메뉴가 숨김 또는 미노출일 수 있음
- 이 상태에서는 Workstation 경로로 VM GPU passthrough 구성 불가

---

## 13) 현재 유효한 운영 경로(2번 경로 확정)

목표:
- VM K8s GPU Pod가 아니라, **Windows/WSL 호스트 GPU**를 직접 사용

확인 완료:
- Windows PowerShell: `nvidia-smi` 정상
- WSL Ubuntu: `nvidia-smi` 정상
- Docker GPU 컨테이너:
  - `docker run --rm --gpus all nvidia/cuda:12.5.1-base-ubuntu24.04 nvidia-smi` 정상

주의(해결 이력):
- `docker-credential-desktop.exe exec format error` 발생 시
  - `~/.docker/config.json`에서 `credsStore`/`credHelpers` 제거
  - 최소 설정 `{ "auths": {} }`로 재구성하면 정상 동작

---

## 14) 추가된 호스트 GPU 스크립트

생성 파일:
- `/home/ubuntu/k8s-fss/scripts/host-gpu-smoke.sh`
- `/home/ubuntu/k8s-fss/scripts/ml-gpu-smoke.sh`

실행:
```bash
cd /home/ubuntu/k8s-fss
./scripts/host-gpu-smoke.sh
./scripts/ml-gpu-smoke.sh
```

용도:
- `host-gpu-smoke.sh`: 호스트/도커 GPU 연속 확인
- `ml-gpu-smoke.sh`: `ml-gpu-smoke` 이름으로 GPU 컨테이너 1회 실행
