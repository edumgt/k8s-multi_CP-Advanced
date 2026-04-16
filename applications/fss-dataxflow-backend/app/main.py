from pathlib import Path
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models import (
    AnalysisEnvironmentListResponse,
    AnalysisEnvironmentUpsertRequest,
    AdminSandboxOverviewResponse,
    ControlPlaneDashboardResponse,
    ControlPlaneLoginRequest,
    ControlPlaneLoginResponse,
    DataxflowAirflowRegisterRequest,
    DataxflowCatalogResponse,
    DataxflowJobCreateRequest,
    DataxflowJobItem,
    DataxflowJobListResponse,
    DataxflowJobRunResponse,
    DataxflowJobUpdateRequest,
    DataxflowOverviewResponse,
    DataxflowRunItem,
    DashboardResponse,
    DemoUserInfo,
    DemoUserLoginRequest,
    DemoUserLoginResponse,
    DemoUserSessionResponse,
    EnvironmentRequestCreateRequest,
    EnvironmentRequestItem,
    EnvironmentRequestListResponse,
    EnvironmentRequestReviewRequest,
    LabSessionRequest,
    LabConnectResponse,
    LabSessionResponse,
    ManagedUserCreateRequest,
    ManagedUserListResponse,
    ResourceRequestCreateRequest,
    ResourceRequestItem,
    ResourceRequestListResponse,
    ResourceRequestReviewRequest,
    SnapshotStatusResponse,
    TeradataBootstrapRequest,
    TeradataBootstrapResponse,
    TeradataQueryRequest,
    TeradataQueryResponse,
    UserLabPolicyResponse,
    UserUsageResponse,
)
from app.services.catalog import quick_links, runtime_profile, sample_queries
from app.services.control_plane import (
    build_control_plane_dashboard,
    build_control_plane_token,
    verify_control_plane_credentials,
    verify_control_plane_token,
)
from app.services.dataxflow_jobs import (
    build_overview as build_dataxflow_overview,
    compile_job_procedure as compile_dataxflow_job_procedure,
    create_job as create_dataxflow_job,
    list_catalog as list_dataxflow_catalog,
    list_jobs as list_dataxflow_jobs,
    register_airflow as register_dataxflow_airflow,
    run_job as run_dataxflow_job,
    update_job as update_dataxflow_job,
)
from app.services.demo_users import (
    authenticate_demo_user,
    build_admin_overview,
    create_managed_user,
    delete_auth_session,
    get_auth_session,
    build_user_usage,
    list_demo_users,
    record_demo_login,
    store_auth_session,
)
from app.services.jupyter_sessions import delete_lab_session, ensure_lab_session, get_lab_session
from app.services.jupyter_sessions import is_dynamic_route_mode
from app.services.jupyter_snapshots import create_snapshot_publish_job, get_snapshot_status
from app.services.lab_governance import (
    list_analysis_environments,
    list_environment_requests,
    list_resource_requests,
    review_environment_request,
    review_resource_request,
    submit_environment_request,
    submit_resource_request,
    upsert_analysis_environment,
    get_user_lab_launch_profile,
    get_user_lab_policy,
)
from app.services.lab_identity import canonical_username
from app.services.mongo import get_mongo_status
from app.services.redis_store import get_redis_status
from app.services.teradata import run_ansi_query, teradata_summary
from app.services.teradata_bootstrap import run_teradata_bootstrap
from app.version import BACKEND_APP_VERSION

settings = get_settings()

app = FastAPI(title="fss-dataxflow-api", version=BACKEND_APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


def list_notebooks(notebooks_path: str) -> list[str]:
    path = Path(notebooks_path)
    if not path.exists():
        return []
    return sorted(item.name for item in path.iterdir() if item.suffix == ".ipynb")


def resolve_auth_token(
    authorization: str | None,
    x_auth_token: str | None,
) -> str | None:
    if isinstance(authorization, str) and authorization:
        raw = authorization.strip()
        parts = raw.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
            return parts[1].strip()
        if raw:
            return raw

    if isinstance(x_auth_token, str) and x_auth_token:
        token = x_auth_token.strip()
        if token:
            return token

    return None


def require_control_plane_access(
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
    x_control_plane_token: str | None = Header(default=None),
):
    settings = get_settings()
    auth_token = resolve_auth_token(authorization, x_auth_token)
    auth_session = get_auth_session(settings, auth_token)
    if auth_session and auth_session.get("role") == "admin":
        return settings

    control_plane_token = x_control_plane_token.strip() if x_control_plane_token else auth_token
    if not verify_control_plane_token(settings, control_plane_token):
        raise HTTPException(
            status_code=401,
            detail="Control-plane login required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return settings


def require_authenticated_user(
    authorization: str | None = Header(default=None),
    x_auth_token: str | None = Header(default=None),
):
    settings = get_settings()
    token = resolve_auth_token(authorization, x_auth_token)
    session = get_auth_session(settings, token)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Application login required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return session


def require_admin_user(current_user=Depends(require_authenticated_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required.")
    return current_user


def authorize_username_access(current_user: dict[str, object], username: str) -> str:
    normalized = canonical_username(username)
    if current_user.get("role") == "admin":
        return normalized
    if current_user.get("username") != normalized:
        raise HTTPException(status_code=403, detail="You can only access your own Jupyter sandbox.")
    return normalized


def _lab_public_origin(settings) -> tuple[str, str]:
    parsed = urlparse(settings.frontend_url)
    scheme = parsed.scheme or "http"
    host = parsed.hostname or "dataxflow.fss.or.kr"
    return scheme, host


def _normalize_request_host(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    candidate = raw.split(",", 1)[0].strip()
    if "://" in candidate:
        return (urlparse(candidate).hostname or "").strip().lower()
    return candidate.split(":", 1)[0].strip().lower()


def _request_hosts(
    request_host: str | None = None,
    origin: str | None = None,
    referer: str | None = None,
    x_forwarded_host: str | None = None,
) -> tuple[str, ...]:
    return tuple(
        host
        for host in (
            _normalize_request_host(request_host),
            _normalize_request_host(origin),
            _normalize_request_host(referer),
            _normalize_request_host(x_forwarded_host),
        )
        if host
    )


def _is_datax_module_request(
    request_host: str | None = None,
    origin: str | None = None,
    referer: str | None = None,
    x_forwarded_host: str | None = None,
) -> bool:
    hosts = _request_hosts(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    return any(host == "dataxflow.fss.or.kr" or host.endswith(".dataxflow.fss.or.kr") for host in hosts if host)


def _is_platform_module_request(
    request_host: str | None = None,
    origin: str | None = None,
    referer: str | None = None,
    x_forwarded_host: str | None = None,
) -> bool:
    hosts = _request_hosts(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    return any(host == "platform.fss.or.kr" or host.endswith(".platform.fss.or.kr") for host in hosts if host)


def _ensure_platform_jupyter_available(
    request_host: str | None = None,
    origin: str | None = None,
    referer: str | None = None,
    x_forwarded_host: str | None = None,
) -> None:
    if _is_datax_module_request(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    ):
        raise HTTPException(status_code=404, detail="Jupyter features are not available in the datax module.")


def _ensure_datax_sql_available(
    request_host: str | None = None,
    origin: str | None = None,
    referer: str | None = None,
    x_forwarded_host: str | None = None,
) -> None:
    if _is_platform_module_request(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    ):
        raise HTTPException(status_code=404, detail="SQL query features are not available in the platform module.")


@app.get("/healthz")
def healthz() -> dict[str, object]:
    settings = get_settings()
    mongo_ok, mongo_detail = get_mongo_status(settings.mongo_url)
    redis_ok, redis_detail = get_redis_status(settings.redis_url)
    overall_status = "ok" if mongo_ok and redis_ok else "degraded"
    return {
        "status": overall_status,
        "backend_version": BACKEND_APP_VERSION,
        "checks": {
            "mongodb": {"ok": mongo_ok, "detail": mongo_detail},
            "redis": {"ok": redis_ok, "detail": redis_detail},
        },
    }


@app.get("/livez")
def livez() -> dict[str, object]:
    return {
        "status": "ok",
        "backend_version": BACKEND_APP_VERSION,
    }


@app.get("/api/notebooks")
def notebooks() -> dict[str, list[str]]:
    settings = get_settings()
    return {"items": list_notebooks(settings.notebooks_path)}


@app.get("/api/demo-users")
def demo_users() -> dict[str, object]:
    settings = get_settings()
    return {"items": list_demo_users(settings)}


@app.get("/api/admin/users", response_model=ManagedUserListResponse)
def admin_list_users(_current_user=Depends(require_admin_user)) -> ManagedUserListResponse:
    settings = get_settings()
    rows = list_demo_users(settings)
    return ManagedUserListResponse(items=[DemoUserInfo(**row) for row in rows])


@app.post("/api/admin/users", response_model=DemoUserInfo)
def admin_create_user(
    request: ManagedUserCreateRequest,
    _current_user=Depends(require_admin_user),
) -> DemoUserInfo:
    settings = get_settings()
    try:
        row = create_managed_user(
            settings=settings,
            username=request.username,
            password=request.password,
            role=request.role,
            display_name=request.display_name,
        )
        return DemoUserInfo(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/auth/login", response_model=DemoUserLoginResponse)
def login_demo_user(request: DemoUserLoginRequest) -> DemoUserLoginResponse:
    settings = get_settings()
    try:
        user = authenticate_demo_user(request.username, request.password, settings)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    session = store_auth_session(settings, user)
    record_demo_login(settings, user.username)
    return DemoUserLoginResponse(
        access_token=session["token"],
        token_type="bearer",
        expires_in=int(session["expires_in"]),
        token=session["token"],
        user=DemoUserInfo(
            username=user.username,
            role=user.role,
            display_name=user.display_name,
        ),
    )


@app.get("/api/auth/me", response_model=DemoUserSessionResponse)
def read_auth_session(current_user=Depends(require_authenticated_user)) -> DemoUserSessionResponse:
    return DemoUserSessionResponse(
        user=DemoUserInfo(
            username=str(current_user["username"]),
            role=str(current_user["role"]),
            display_name=str(current_user["display_name"]),
        )
    )


@app.post("/api/auth/logout")
def logout_demo_user(
    current_user=Depends(require_authenticated_user),
) -> dict[str, str]:
    settings = get_settings()
    delete_auth_session(settings, str(current_user.get("token") or ""))
    return {"status": "ok"}


@app.get("/api/users/me/usage", response_model=UserUsageResponse)
def read_my_usage(
    current_user=Depends(require_authenticated_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> UserUsageResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    username = str(current_user["username"])
    try:
        return UserUsageResponse(**build_user_usage(settings, username))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/dataxflow/catalog", response_model=DataxflowCatalogResponse)
def read_dataxflow_catalog(
    _current_user=Depends(require_authenticated_user),
) -> DataxflowCatalogResponse:
    settings = get_settings()
    return DataxflowCatalogResponse(**list_dataxflow_catalog(settings))


@app.get("/api/dataxflow/jobs", response_model=DataxflowJobListResponse)
def read_dataxflow_jobs(
    _current_user=Depends(require_authenticated_user),
) -> DataxflowJobListResponse:
    settings = get_settings()
    rows = list_dataxflow_jobs(settings)
    return DataxflowJobListResponse(items=[DataxflowJobItem(**row) for row in rows])


@app.post("/api/dataxflow/jobs", response_model=DataxflowJobItem)
def create_dataxflow_batch_job(
    request: DataxflowJobCreateRequest,
    current_user=Depends(require_authenticated_user),
) -> DataxflowJobItem:
    settings = get_settings()
    try:
        row = create_dataxflow_job(
            settings=settings,
            name=request.name,
            description=request.description,
            source_system_id=request.source_system_id,
            source_table=request.source_table,
            target_system_id=request.target_system_id,
            target_table=request.target_table,
            batch_frequency=request.batch_frequency,
            load_condition=request.load_condition,
            owner_username=str(current_user.get("username") or ""),
            owner_display_name=str(current_user.get("display_name") or current_user.get("username") or ""),
        )
        return DataxflowJobItem(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/dataxflow/jobs/{job_id}", response_model=DataxflowJobItem)
def patch_dataxflow_batch_job(
    job_id: str,
    request: DataxflowJobUpdateRequest,
    _current_user=Depends(require_authenticated_user),
) -> DataxflowJobItem:
    settings = get_settings()
    try:
        row = update_dataxflow_job(
            settings=settings,
            job_id=job_id,
            name=request.name,
            description=request.description,
            source_system_id=request.source_system_id,
            source_table=request.source_table,
            target_system_id=request.target_system_id,
            target_table=request.target_table,
            batch_frequency=request.batch_frequency,
            load_condition=request.load_condition,
        )
        return DataxflowJobItem(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/dataxflow/jobs/{job_id}/run", response_model=DataxflowJobRunResponse)
def run_dataxflow_batch_job(
    job_id: str,
    current_user=Depends(require_authenticated_user),
) -> DataxflowJobRunResponse:
    settings = get_settings()
    try:
        row, run_payload = run_dataxflow_job(
            settings=settings,
            job_id=job_id,
            executed_by=str(current_user.get("username") or ""),
        )
        return DataxflowJobRunResponse(
            job=DataxflowJobItem(**row),
            run=DataxflowRunItem(**run_payload),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/dataxflow/jobs/{job_id}/compile", response_model=DataxflowJobItem)
def compile_dataxflow_batch_job(
    job_id: str,
    current_user=Depends(require_authenticated_user),
) -> DataxflowJobItem:
    settings = get_settings()
    try:
        row = compile_dataxflow_job_procedure(
            settings=settings,
            job_id=job_id,
            compiled_by=str(current_user.get("username") or ""),
        )
        return DataxflowJobItem(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/dataxflow/jobs/{job_id}/airflow", response_model=DataxflowJobItem)
def register_dataxflow_batch_job_airflow(
    job_id: str,
    request: DataxflowAirflowRegisterRequest,
    current_user=Depends(require_authenticated_user),
) -> DataxflowJobItem:
    settings = get_settings()
    try:
        row = register_dataxflow_airflow(
            settings=settings,
            job_id=job_id,
            cron=request.cron,
            dag_id=request.dag_id,
            registered_by=str(current_user.get("username") or ""),
        )
        return DataxflowJobItem(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/dataxflow/overview", response_model=DataxflowOverviewResponse)
def read_dataxflow_overview(
    _current_user=Depends(require_authenticated_user),
) -> DataxflowOverviewResponse:
    settings = get_settings()
    return DataxflowOverviewResponse(**build_dataxflow_overview(settings))


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard(
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> DashboardResponse:
    settings = get_settings()
    mongo_ok, mongo_detail = get_mongo_status(settings.mongo_url)
    redis_ok, redis_detail = get_redis_status(settings.redis_url)
    datax_module_request = _is_datax_module_request(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    platform_module_request = _is_platform_module_request(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )

    services = [
        {
            "name": "backend",
            "kind": "api",
            "endpoint": "http://backend:8000",
            "ok": True,
            "detail": "FastAPI service ready",
        },
        {
            "name": "mongodb",
            "kind": "database",
            "endpoint": settings.mongo_url,
            "ok": mongo_ok,
            "detail": mongo_detail,
        },
        {
            "name": "redis",
            "kind": "cache",
            "endpoint": settings.redis_url,
            "ok": redis_ok,
            "detail": redis_detail,
        },
        {
            "name": "control-plane-dashboard",
            "kind": "cluster-admin",
            "endpoint": settings.control_plane_url,
            "ok": True,
            "detail": "Frontend control-plane dashboard with node and pod inventory after admin login",
        },
        {
            "name": "gitlab",
            "kind": "cicd",
            "endpoint": settings.gitlab_url,
            "ok": True,
            "detail": "GitLab CE web UI is exposed by ingress; SSH is available on port 30224.",
        },
    ]

    if settings.airflow_url:
        services.insert(
            4,
            {
                "name": "airflow",
                "kind": "orchestrator",
                "endpoint": settings.airflow_url,
                "ok": True,
                "detail": "Optional Airflow webserver for scheduled health checks and DAG demos",
            },
        )

    if settings.nexus_url:
        services.append(
            {
                "name": "nexus",
                "kind": "artifact-repository",
                "endpoint": settings.nexus_url,
                "ok": True,
                "detail": "Offline npm and PyPI cache for closed-network rebuilds and one-pod runtime prep",
            }
        )

    if not datax_module_request:
        services.insert(
            4,
            {
                "name": "jupyter",
                "kind": "workbench",
                "endpoint": settings.jupyter_url,
                "ok": True,
                "detail": "Shared JupyterLab plus per-user Jupyter sessions with PVC workspace restore and Harbor snapshots",
            },
        )

    return DashboardResponse(
        runtime=runtime_profile(settings),
        services=services,
        quick_links=quick_links(settings),
        sample_queries=[] if platform_module_request else sample_queries(),
        notebooks=[] if datax_module_request else list_notebooks(settings.notebooks_path),
        teradata={} if platform_module_request else teradata_summary(settings),
    )


@app.post("/api/teradata/query", response_model=TeradataQueryResponse)
def teradata_query(
    request: TeradataQueryRequest,
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> TeradataQueryResponse:
    settings = get_settings()
    _ensure_datax_sql_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    result = run_ansi_query(settings, request.sql, request.limit)
    return TeradataQueryResponse(**result)


@app.post("/api/admin/teradata/bootstrap", response_model=TeradataBootstrapResponse)
def bootstrap_teradata(
    request: TeradataBootstrapRequest,
    _current_user=Depends(require_admin_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> TeradataBootstrapResponse:
    settings = get_settings()
    _ensure_datax_sql_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    try:
        result = run_teradata_bootstrap(settings, dry_run=request.dry_run)
        return TeradataBootstrapResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/admin/analysis-environments", response_model=AnalysisEnvironmentListResponse)
def admin_list_analysis_environments(
    include_inactive: bool = True,
    _current_user=Depends(require_admin_user),
) -> AnalysisEnvironmentListResponse:
    settings = get_settings()
    items = list_analysis_environments(settings, include_inactive=include_inactive)
    return AnalysisEnvironmentListResponse(items=items)


@app.get("/api/analysis-environments", response_model=AnalysisEnvironmentListResponse)
def list_active_analysis_environments(
    _current_user=Depends(require_authenticated_user),
) -> AnalysisEnvironmentListResponse:
    settings = get_settings()
    items = list_analysis_environments(settings, include_inactive=False)
    return AnalysisEnvironmentListResponse(items=items)


@app.post("/api/admin/analysis-environments", response_model=AnalysisEnvironmentListResponse)
def admin_upsert_analysis_environment(
    request: AnalysisEnvironmentUpsertRequest,
    current_user=Depends(require_admin_user),
) -> AnalysisEnvironmentListResponse:
    settings = get_settings()
    try:
        upsert_analysis_environment(
            settings=settings,
            env_id=request.env_id,
            name=request.name,
            image=request.image,
            description=request.description,
            gpu_enabled=request.gpu_enabled,
            is_active=request.is_active,
            updated_by=str(current_user.get("username") or "admin"),
        )
        return AnalysisEnvironmentListResponse(
            items=list_analysis_environments(settings, include_inactive=True),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/resource-requests", response_model=ResourceRequestItem)
def create_resource_request(
    request: ResourceRequestCreateRequest,
    current_user=Depends(require_authenticated_user),
) -> ResourceRequestItem:
    settings = get_settings()
    username = str(current_user["username"])
    try:
        payload = submit_resource_request(
            settings=settings,
            username=username,
            vcpu=request.vcpu,
            memory_gib=request.memory_gib,
            disk_gib=request.disk_gib,
            note=request.note,
        )
        return ResourceRequestItem(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/resource-requests/me", response_model=ResourceRequestListResponse)
def list_my_resource_requests(current_user=Depends(require_authenticated_user)) -> ResourceRequestListResponse:
    settings = get_settings()
    username = str(current_user["username"])
    rows = list_resource_requests(settings, username=username)
    return ResourceRequestListResponse(items=[ResourceRequestItem(**row) for row in rows])


@app.get("/api/admin/resource-requests", response_model=ResourceRequestListResponse)
def admin_list_resource_requests(
    status: str | None = None,
    _current_user=Depends(require_admin_user),
) -> ResourceRequestListResponse:
    settings = get_settings()
    rows = list_resource_requests(settings, status=status)
    return ResourceRequestListResponse(items=[ResourceRequestItem(**row) for row in rows])


@app.post("/api/admin/resource-requests/{request_id}/review", response_model=ResourceRequestItem)
def admin_review_resource_request(
    request_id: str,
    request: ResourceRequestReviewRequest,
    current_user=Depends(require_admin_user),
) -> ResourceRequestItem:
    settings = get_settings()
    try:
        row = review_resource_request(
            settings=settings,
            request_id=request_id,
            approved=request.approved,
            reviewed_by=str(current_user.get("username") or "admin"),
            note=request.note,
        )
        return ResourceRequestItem(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/environment-requests", response_model=EnvironmentRequestItem)
def create_environment_request(
    request: EnvironmentRequestCreateRequest,
    current_user=Depends(require_authenticated_user),
) -> EnvironmentRequestItem:
    settings = get_settings()
    username = str(current_user["username"])
    try:
        row = submit_environment_request(
            settings=settings,
            username=username,
            env_id=request.env_id,
            note=request.note,
        )
        return EnvironmentRequestItem(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/environment-requests/me", response_model=EnvironmentRequestListResponse)
def list_my_environment_requests(current_user=Depends(require_authenticated_user)) -> EnvironmentRequestListResponse:
    settings = get_settings()
    username = str(current_user["username"])
    rows = list_environment_requests(settings, username=username)
    return EnvironmentRequestListResponse(items=[EnvironmentRequestItem(**row) for row in rows])


@app.get("/api/admin/environment-requests", response_model=EnvironmentRequestListResponse)
def admin_list_environment_requests(
    status: str | None = None,
    _current_user=Depends(require_admin_user),
) -> EnvironmentRequestListResponse:
    settings = get_settings()
    rows = list_environment_requests(settings, status=status)
    return EnvironmentRequestListResponse(items=[EnvironmentRequestItem(**row) for row in rows])


@app.post("/api/admin/environment-requests/{request_id}/review", response_model=EnvironmentRequestItem)
def admin_review_environment_request(
    request_id: str,
    request: EnvironmentRequestReviewRequest,
    current_user=Depends(require_admin_user),
) -> EnvironmentRequestItem:
    settings = get_settings()
    try:
        row = review_environment_request(
            settings=settings,
            request_id=request_id,
            approved=request.approved,
            reviewed_by=str(current_user.get("username") or "admin"),
            note=request.note,
        )
        return EnvironmentRequestItem(**row)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/users/me/lab-policy", response_model=UserLabPolicyResponse)
def read_my_lab_policy(
    current_user=Depends(require_authenticated_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> UserLabPolicyResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    username = str(current_user["username"])
    try:
        return UserLabPolicyResponse(**get_user_lab_policy(settings, username))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/jupyter/sessions", response_model=LabSessionResponse)
def create_jupyter_session(
    request: LabSessionRequest,
    current_user=Depends(require_authenticated_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> LabSessionResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    try:
        username = authorize_username_access(current_user, request.username)
        if settings.lab_governance_enabled:
            launch_profile = get_user_lab_launch_profile(settings, username)
            return LabSessionResponse(**ensure_lab_session(settings, username, launch_profile))
        return LabSessionResponse(**ensure_lab_session(settings, username))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/jupyter/sessions/{username}", response_model=LabSessionResponse)
def read_jupyter_session(
    username: str,
    current_user=Depends(require_authenticated_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> LabSessionResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    try:
        allowed_username = authorize_username_access(current_user, username)
        return LabSessionResponse(**get_lab_session(settings, allowed_username))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.delete("/api/jupyter/sessions/{username}", response_model=LabSessionResponse)
def remove_jupyter_session(
    username: str,
    current_user=Depends(require_authenticated_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> LabSessionResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    try:
        allowed_username = authorize_username_access(current_user, username)
        return LabSessionResponse(**delete_lab_session(settings, allowed_username))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/jupyter/connect/{username}", response_model=LabConnectResponse)
def connect_jupyter_session(
    username: str,
    current_user=Depends(require_authenticated_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> LabConnectResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    try:
        allowed_username = authorize_username_access(current_user, username)
        session = get_lab_session(settings, allowed_username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if not session.get("ready"):
        raise HTTPException(status_code=409, detail="JupyterLab session is not ready yet.")

    if is_dynamic_route_mode(settings):
        pod_name = str(session.get("pod_name") or "").strip()
        if not pod_name:
            raise HTTPException(status_code=500, detail="Session pod name is unavailable.")
        host_suffix = str(settings.jupyter_dynamic_host_suffix or "").strip().strip(".")
        if not host_suffix:
            raise HTTPException(status_code=500, detail="Dynamic route host suffix is not configured.")
        scheme = str(settings.jupyter_dynamic_scheme or "https").strip().lower() or "https"
        redirect_url = (
            f"{scheme}://{pod_name}.{host_suffix}/lab"
            f"?token={session['token']}"
        )
    else:
        if not session.get("node_port"):
            raise HTTPException(status_code=409, detail="JupyterLab session is not ready yet.")
        scheme, host = _lab_public_origin(settings)
        redirect_url = (
            f"{scheme}://{host}:{int(session['node_port'])}/lab"
            f"?token={session['token']}"
        )
    return LabConnectResponse(
        redirect_url=redirect_url,
        detail="Ownership verified. Redirect to personal JupyterLab.",
    )


@app.get("/api/jupyter/snapshots/{username}", response_model=SnapshotStatusResponse)
def read_jupyter_snapshot(
    username: str,
    current_user=Depends(require_authenticated_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> SnapshotStatusResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    try:
        allowed_username = authorize_username_access(current_user, username)
        return SnapshotStatusResponse(**get_snapshot_status(settings, allowed_username))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/jupyter/snapshots", response_model=SnapshotStatusResponse)
def publish_jupyter_snapshot(
    request: LabSessionRequest,
    current_user=Depends(require_authenticated_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> SnapshotStatusResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    try:
        username = authorize_username_access(current_user, request.username)
        return SnapshotStatusResponse(**create_snapshot_publish_job(settings, username))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/admin/sandboxes", response_model=AdminSandboxOverviewResponse)
def read_admin_sandbox_overview(
    _current_user=Depends(require_admin_user),
    request_host: str | None = Header(default=None, alias="host"),
    origin: str | None = Header(default=None),
    referer: str | None = Header(default=None),
    x_forwarded_host: str | None = Header(default=None),
) -> AdminSandboxOverviewResponse:
    settings = get_settings()
    _ensure_platform_jupyter_available(
        request_host=request_host,
        origin=origin,
        referer=referer,
        x_forwarded_host=x_forwarded_host,
    )
    try:
        return AdminSandboxOverviewResponse(**build_admin_overview(settings))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/control-plane/login", response_model=ControlPlaneLoginResponse)
def control_plane_login(request: ControlPlaneLoginRequest) -> ControlPlaneLoginResponse:
    settings = get_settings()
    try:
        user = authenticate_demo_user(request.username, request.password, settings)
    except ValueError:
        if not verify_control_plane_credentials(settings, request.username, request.password):
            raise HTTPException(status_code=401, detail="Invalid control-plane credentials.") from None
        dashboard = build_control_plane_dashboard(settings, namespace="all")
        return ControlPlaneLoginResponse(
            token=build_control_plane_token(settings, request.username),
            username=request.username,
            dashboard=ControlPlaneDashboardResponse(**dashboard),
        )

    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required for control-plane access.")

    session = store_auth_session(settings, user)
    record_demo_login(settings, user.username)
    dashboard = build_control_plane_dashboard(settings, namespace="all")
    return ControlPlaneLoginResponse(
        token=session["token"],
        username=user.username,
        dashboard=ControlPlaneDashboardResponse(**dashboard),
    )


@app.get("/api/control-plane/dashboard", response_model=ControlPlaneDashboardResponse)
def control_plane_dashboard(
    namespace: str = "all",
    settings=Depends(require_control_plane_access),
) -> ControlPlaneDashboardResponse:
    try:
        return ControlPlaneDashboardResponse(**build_control_plane_dashboard(settings, namespace))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
