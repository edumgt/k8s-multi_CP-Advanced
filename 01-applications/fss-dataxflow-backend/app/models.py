from typing import Any

from pydantic import BaseModel, Field


class ServiceStatus(BaseModel):
    name: str
    kind: str
    endpoint: str
    ok: bool
    detail: str


class QuickLink(BaseModel):
    name: str
    url: str
    description: str


class SampleQuery(BaseModel):
    name: str
    description: str
    sql: str


class DashboardResponse(BaseModel):
    runtime: dict[str, str]
    services: list[ServiceStatus]
    quick_links: list[QuickLink]
    sample_queries: list[SampleQuery]
    notebooks: list[str]
    teradata: dict[str, Any]


class TeradataQueryRequest(BaseModel):
    sql: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1, le=200)


class TeradataQueryResponse(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    source: str
    note: str


class TeradataBootstrapRequest(BaseModel):
    dry_run: bool = True


class TeradataBootstrapResponse(BaseModel):
    mode: str
    source_file: str
    statement_count: int
    executed_count: int
    dry_run: bool
    statement_previews: list[str]
    note: str


class LabSessionRequest(BaseModel):
    username: str = Field(min_length=2, max_length=48)


class LabSessionResponse(BaseModel):
    session_id: str
    username: str
    namespace: str
    pod_name: str
    service_name: str
    workspace_subpath: str
    image: str
    status: str
    phase: str
    ready: bool
    detail: str
    token: str
    node_port: int | None = None
    created_at: str | None = None
    snapshot_status: str | None = None
    snapshot_job_name: str | None = None
    snapshot_detail: str | None = None


class SnapshotStatusResponse(BaseModel):
    username: str
    session_id: str
    workspace_subpath: str
    image: str
    status: str
    job_name: str | None = None
    published_at: str | None = None
    restorable: bool
    detail: str


class DemoUserInfo(BaseModel):
    username: str
    role: str
    display_name: str


class DemoUserLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class DemoUserLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    token: str
    user: DemoUserInfo


class DemoUserSessionResponse(BaseModel):
    user: DemoUserInfo


class ManagedUserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    role: str = Field(default="user", min_length=4, max_length=16)
    display_name: str = Field(min_length=1, max_length=128)


class ManagedUserListResponse(BaseModel):
    items: list[DemoUserInfo]


class ResourceRequestCreateRequest(BaseModel):
    vcpu: int = Field(ge=1, le=64)
    memory_gib: int = Field(ge=1, le=512)
    disk_gib: int = Field(ge=1, le=2048)
    note: str | None = Field(default=None, max_length=1000)


class ResourceRequestReviewRequest(BaseModel):
    approved: bool
    note: str | None = Field(default=None, max_length=1000)


class ResourceRequestItem(BaseModel):
    request_id: str
    username: str
    vcpu: int
    memory_gib: int
    disk_gib: int
    request_note: str
    status: str
    review_note: str
    reviewed_by: str | None = None
    pvc_name: str | None = None
    created_at: str
    updated_at: str


class ResourceRequestListResponse(BaseModel):
    items: list[ResourceRequestItem]


class AnalysisEnvironmentUpsertRequest(BaseModel):
    env_id: str = Field(min_length=3, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    image: str = Field(min_length=3, max_length=512)
    description: str | None = Field(default=None, max_length=1000)
    gpu_enabled: bool = False
    is_active: bool = True


class AnalysisEnvironmentItem(BaseModel):
    env_id: str
    name: str
    image: str
    description: str
    gpu_enabled: bool
    is_active: bool
    updated_by: str
    created_at: str
    updated_at: str


class AnalysisEnvironmentListResponse(BaseModel):
    items: list[AnalysisEnvironmentItem]


class EnvironmentRequestCreateRequest(BaseModel):
    env_id: str = Field(min_length=3, max_length=64)
    note: str | None = Field(default=None, max_length=1000)


class EnvironmentRequestReviewRequest(BaseModel):
    approved: bool
    note: str | None = Field(default=None, max_length=1000)


class EnvironmentRequestItem(BaseModel):
    request_id: str
    username: str
    env_id: str
    request_note: str
    status: str
    review_note: str
    reviewed_by: str | None = None
    created_at: str
    updated_at: str


class EnvironmentRequestListResponse(BaseModel):
    items: list[EnvironmentRequestItem]


class UserLabPolicyResponse(BaseModel):
    username: str
    governance_enabled: bool
    ready: bool
    vcpu: int | None = None
    memory_gib: int | None = None
    disk_gib: int | None = None
    pvc_name: str | None = None
    analysis_env_id: str | None = None
    analysis_image: str | None = None
    detail: str


class LabConnectResponse(BaseModel):
    redirect_url: str
    detail: str


class UserUsageSummary(BaseModel):
    username: str
    display_name: str
    role: str
    current_status: str
    pod_name: str
    node_port: int | None = None
    login_count: int
    launch_count: int
    current_session_seconds: int
    total_session_seconds: int
    last_login_at: str | None = None
    last_launch_at: str | None = None
    last_stop_at: str | None = None


class UserUsageResponse(BaseModel):
    summary: UserUsageSummary


class AdminSandboxSummary(BaseModel):
    sandbox_user_count: int
    running_user_count: int
    ready_user_count: int
    total_login_count: int
    total_launch_count: int
    total_session_seconds: int


class AdminSandboxUserRow(BaseModel):
    username: str
    display_name: str
    status: str
    ready: bool
    detail: str
    pod_name: str
    service_name: str
    workspace_subpath: str
    image: str
    node_port: int | None = None
    session_id: str
    phase: str
    login_count: int
    launch_count: int
    current_session_seconds: int
    total_session_seconds: int
    last_login_at: str | None = None
    last_launch_at: str | None = None
    last_stop_at: str | None = None


class AdminSandboxOverviewResponse(BaseModel):
    summary: AdminSandboxSummary
    users: list[AdminSandboxUserRow]


class ControlPlaneLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class ControlPlaneSummary(BaseModel):
    cluster_name: str
    cluster_version: str
    current_namespace: str
    namespace_count: int
    node_count: int
    ready_node_count: int
    pod_count: int
    running_pod_count: int


class ControlPlaneNode(BaseModel):
    name: str
    ready: bool
    roles: str
    version: str
    internal_ip: str
    os_image: str
    kernel_version: str
    container_runtime: str
    created_at: str | None = None


class ControlPlanePod(BaseModel):
    namespace: str
    name: str
    ready: str
    status: str
    restarts: int
    node_name: str
    pod_ip: str | None = None
    created_at: str | None = None


class ControlPlaneDashboardResponse(BaseModel):
    summary: ControlPlaneSummary
    namespaces: list[str]
    nodes: list[ControlPlaneNode]
    pods: list[ControlPlanePod]


class ControlPlaneLoginResponse(BaseModel):
    token: str
    username: str
    dashboard: ControlPlaneDashboardResponse


class DataxflowCatalogSystem(BaseModel):
    system_id: str
    name: str
    description: str


class DataxflowCatalogTable(BaseModel):
    system_id: str
    table_name: str
    description: str


class DataxflowBatchFrequency(BaseModel):
    code: str
    label: str
    cron_example: str


class DataxflowCatalogResponse(BaseModel):
    source_systems: list[DataxflowCatalogSystem]
    source_tables: list[DataxflowCatalogTable]
    target_systems: list[DataxflowCatalogSystem]
    target_tables: list[DataxflowCatalogTable]
    batch_frequencies: list[DataxflowBatchFrequency]


class DataxflowJobCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    description: str | None = Field(default=None, max_length=1000)
    source_system_id: str = Field(min_length=3, max_length=64)
    source_table: str = Field(min_length=3, max_length=128)
    target_system_id: str = Field(min_length=3, max_length=64)
    target_table: str = Field(min_length=3, max_length=128)
    batch_frequency: str = Field(min_length=3, max_length=16)
    load_condition: str = Field(min_length=1, max_length=2000)


class DataxflowJobUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    description: str | None = Field(default=None, max_length=1000)
    source_system_id: str | None = Field(default=None, min_length=3, max_length=64)
    source_table: str | None = Field(default=None, min_length=3, max_length=128)
    target_system_id: str | None = Field(default=None, min_length=3, max_length=64)
    target_table: str | None = Field(default=None, min_length=3, max_length=128)
    batch_frequency: str | None = Field(default=None, min_length=3, max_length=16)
    load_condition: str | None = Field(default=None, min_length=1, max_length=2000)


class DataxflowJobItem(BaseModel):
    job_id: str
    name: str
    description: str
    source_system_id: str
    source_table: str
    target_system_id: str
    target_table: str
    batch_frequency: str
    load_condition: str
    status: str
    owner_username: str
    owner_display_name: str
    is_procedure_compiled: bool
    compiled_procedure_name: str | None = None
    airflow_dag_id: str | None = None
    airflow_cron: str | None = None
    last_run_status: str
    last_run_at: str | None = None
    last_run_duration_seconds: int | None = None
    run_count: int
    success_count: int
    failure_count: int
    last_compiled_by: str | None = None
    last_compiled_at: str | None = None
    last_registered_by: str | None = None
    last_registered_at: str | None = None
    created_at: str
    updated_at: str


class DataxflowJobListResponse(BaseModel):
    items: list[DataxflowJobItem]


class DataxflowRunItem(BaseModel):
    run_id: str
    job_id: str
    job_name: str
    status: str
    duration_seconds: int
    message: str
    executed_by: str
    executed_at: str


class DataxflowJobRunResponse(BaseModel):
    job: DataxflowJobItem
    run: DataxflowRunItem


class DataxflowAirflowRegisterRequest(BaseModel):
    cron: str = Field(min_length=5, max_length=120)
    dag_id: str | None = Field(default=None, min_length=3, max_length=80)


class DataxflowOverviewSummary(BaseModel):
    total_jobs: int
    draft_jobs: int
    tested_jobs: int
    compiled_jobs: int
    scheduled_jobs: int
    failed_jobs: int
    total_runs: int
    successful_runs: int
    failed_runs: int


class DataxflowScheduleBreakdownItem(BaseModel):
    frequency: str
    label: str
    count: int


class DataxflowOverviewResponse(BaseModel):
    summary: DataxflowOverviewSummary
    schedule_breakdown: list[DataxflowScheduleBreakdownItem]
    recent_runs: list[DataxflowRunItem]
    jobs: list[DataxflowJobItem]
