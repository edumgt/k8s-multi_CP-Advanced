# fss-dataxflow-airflow

ELT(`fss-dataxflow`) 워크로드를 위한 Airflow 이미지 소스입니다.

- 이미지 목적: dataxflow 배치 스케줄링/오케스트레이션
- 이미지 경로(권장): `10.111.111.72/app/fss-dataxflow-airflow:latest`
- 주요 구성:
  - `Dockerfile`
  - `requirements.txt`
  - `dags/`

호환 경로로 `apps/airflow -> apps/fss-dataxflow-airflow` 심볼릭 링크를 유지합니다.
