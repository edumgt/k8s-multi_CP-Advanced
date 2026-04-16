import os
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = os.getenv("PLATFORM_ENV_FILE", ".env")


class Settings(BaseSettings):
    app_name: str = "fss-dataxflow-api"
    env: str = "base"
    mongo_url: str = "mongodb://mongodb:27017/platform"
    redis_url: str = "redis://redis:6379/0"
    backend_url: str = "http://api.dataxflow.fss.or.kr/docs"
    frontend_url: str = "http://dataxflow.fss.or.kr"
    control_plane_url: str = "http://dataxflow.fss.or.kr/#control-plane"
    admin_url: str = "http://dataxflow.fss.or.kr/#admin"
    airflow_url: str = "http://airflow.fss.or.kr"
    jupyter_url: str = "http://jupyter.fss.or.kr/lab"
    gitlab_url: str = "http://gitlab.fss.or.kr"
    nexus_url: str = "http://nexus.fss.or.kr"
    pypi_index_url: str = "http://nexus.fss.or.kr/repository/pypi-all/simple"
    npm_registry: str = "http://nexus.fss.or.kr/repository/npm-all/"
    harbor_url: str = "https://ghcr.io"
    harbor_registry: str = "ghcr.io"
    harbor_project: str = "app"
    harbor_user: str | None = None
    harbor_password: str | None = None
    harbor_insecure_registry: bool = True
    notebooks_path: str = "/workspace/notebooks/shared"
    k8s_namespace: str = "app"
    jupyter_image: str = "ghcr.io/k8s-fss/jupter-teradata-fss:latest"
    jupyter_workspace_pvc: str = "jupyter-workspace"
    jupyter_workspace_root: str = "/workspace/user-home"
    jupyter_bootstrap_dir: str = "/opt/platform/bootstrap-workspace"
    jupyter_user_pvc_storage_class: str | None = None
    lab_governance_enabled: bool = False
    jupyter_snapshot_builder_image: str = "gcr.io/kaniko-project/executor:v1.23.2-debug"
    jupyter_access_mode: str = "dynamic-route"
    jupyter_dynamic_host_suffix: str = "service.jupyter.fss.or.kr"
    jupyter_dynamic_scheme: str = "https"
    jupyter_dynamic_subdomain: str = "jupyter-named-pod"
    jupyter_token: str = Field(default="platform123", validation_alias="JUPYTER_TOKEN")
    control_plane_username: str = "admin@test.com"
    control_plane_password: str = "123456"
    control_plane_session_secret: str = "controlplane-session"
    auth_jwt_secret: str = "platform-auth-jwt"
    auth_jwt_algorithm: str = "HS256"
    auth_jwt_ttl_seconds: int = 60 * 60 * 12
    teradata_host: str | None = None
    teradata_port: int | None = None
    teradata_user: str | None = None
    teradata_password: str | None = None
    teradata_database: str = "dbc"
    teradata_dbms: str = "teradata"
    teradata_bootstrap_sql_path: str | None = None
    teradata_fake_mode: bool = True
    teradata_encryptdata: bool = True
    cors_allow_origins: str = (
        "http://dataxflow.fss.or.kr,"
        "http://dev.dataxflow.fss.or.kr,"
        "http://www.dataxflow.fss.or.kr,"
        "http://platform.fss.or.kr,"
        "http://dev.platform.fss.or.kr,"
        "http://www.platform.fss.or.kr,"
        "https://dataxflow.fss.or.kr,"
        "https://platform.fss.or.kr"
    )
    cors_allow_origin_regex: str = r"^https?://([a-z0-9-]+\.)?(dataxflow|platform)\.fss\.or\.kr(:\d+)?$"
    cors_allow_credentials: bool = True

    model_config = SettingsConfigDict(
        env_prefix="PLATFORM_",
        env_file=ENV_FILE,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.cors_allow_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
