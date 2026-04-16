from app.config import Settings
from app.version import BACKEND_APP_VERSION


def runtime_profile(settings: Settings) -> dict[str, str]:
    return {
        "backend_version": BACKEND_APP_VERSION,
        "environment": settings.env,
        "host_os": "Ubuntu 24",
        "cluster": "Kubernetes-based ELT runtime",
        "containers": "OCI images on Kubernetes",
        "backend": "Python 3.12 / FastAPI / SQLAlchemy",
        "frontend": "Node 22.22 / Quasar Vue 3",
        "orchestration": "Apache Airflow for periodic ELT batch jobs",
        "data": "Teradata + metadata in MongoDB/Redis",
        "artifact_repositories": "Nexus (PyPI/npm offline cache), Harbor",
        "cicd": "GitLab Runner and container registry workflow",
    }


def sample_queries() -> list[dict[str, str]]:
    return [
        {
            "name": "elt_recent_runs",
            "description": "Recent ELT run status for monitoring dashboard.",
            "sql": (
                "SELECT job_name, run_status, started_at, finished_at "
                "FROM elt_run_history "
                "ORDER BY updated_at DESC;"
            ),
        },
        {
            "name": "source_target_latency",
            "description": "Latest source-to-target latency by batch job.",
            "sql": (
                "SELECT job_name, source_table, target_table, latency_seconds "
                "FROM elt_job_latency_summary "
                "QUALIFY ROW_NUMBER() OVER "
                "(PARTITION BY job_name ORDER BY measured_at DESC) <= 5;"
            ),
        },
        {
            "name": "daily_loaded_rows",
            "description": "Daily loaded row count in Teradata DataLake.",
            "sql": (
                "SELECT business_date, target_table, loaded_rows "
                "FROM elt_daily_load_volume "
                "ORDER BY business_date DESC;"
            ),
        },
    ]


def quick_links(settings: Settings) -> list[dict[str, str]]:
    links = [
        {
            "name": "Backend API",
            "url": settings.backend_url,
            "description": "FastAPI OpenAPI plus ELT batch workflow endpoints.",
        },
        {
            "name": "Frontend",
            "url": settings.frontend_url,
            "description": "Dataxflow ELT batch management web application.",
        },
        {
            "name": "GitLab",
            "url": settings.gitlab_url,
            "description": "SCM and pipeline control plane.",
        },
        {
            "name": "Harbor",
            "url": settings.harbor_url,
            "description": "Container registry for ELT and supporting runtime images.",
        },
    ]

    if settings.airflow_url:
        links.append(
            {
                "name": "Airflow",
                "url": settings.airflow_url,
                "description": "DAG registration and schedule validation target.",
            }
        )

    if settings.nexus_url:
        links.append(
            {
                "name": "Nexus",
                "url": settings.nexus_url,
                "description": "Offline package repository for PyPI and npm caches.",
            }
        )

    return links
