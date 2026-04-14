from __future__ import annotations

import copy
import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from redis import Redis
from redis.exceptions import RedisError

from app.config import Settings

STATE_KEY = "dataxflow:state:v1"

DEFAULT_CATALOG: dict[str, list[dict[str, str]]] = {
    "source_systems": [
        {
            "system_id": "oracle-core",
            "name": "Oracle Core Banking",
            "description": "Oracle transactional DB linked through QueryGrid metadata.",
        },
        {
            "system_id": "bank-file-feed",
            "name": "Bank File Feed",
            "description": "Daily expert files from banks (CSV, fixed-width).",
        },
        {
            "system_id": "querygrid-hub",
            "name": "QueryGrid Hub",
            "description": "Federated source through Teradata QueryGrid connector.",
        },
    ],
    "source_tables": [
        {
            "system_id": "oracle-core",
            "table_name": "ORACLE_USER_TXN",
            "description": "Oracle user transaction table mirrored for ELT.",
        },
        {
            "system_id": "oracle-core",
            "table_name": "ORACLE_CUSTOMER_BASE",
            "description": "Customer profile baseline table.",
        },
        {
            "system_id": "bank-file-feed",
            "table_name": "BANK_DAILY_MSG_FILE",
            "description": "Daily transfer file metadata and payload offset.",
        },
        {
            "system_id": "bank-file-feed",
            "table_name": "BANK_BRANCH_SETTLEMENT_FILE",
            "description": "Daily branch settlement file.",
        },
        {
            "system_id": "querygrid-hub",
            "table_name": "QG_ORACLE_USER_TB",
            "description": "QueryGrid sample source table from Oracle.",
        },
    ],
    "target_systems": [
        {
            "system_id": "teradata-staging",
            "name": "Teradata Staging",
            "description": "Landing area for raw ingestion before curation.",
        },
        {
            "system_id": "teradata-datalake",
            "name": "Teradata DataLake",
            "description": "Curated serving layer for analytics and reporting.",
        },
    ],
    "target_tables": [
        {
            "system_id": "teradata-staging",
            "table_name": "STG_ORACLE_USER_TXN",
            "description": "Raw Oracle transaction staging table.",
        },
        {
            "system_id": "teradata-staging",
            "table_name": "STG_BANK_DAILY_MSG",
            "description": "Raw bank file staging table.",
        },
        {
            "system_id": "teradata-datalake",
            "table_name": "DL_USER_TXN_FACT",
            "description": "Curated user transaction fact table.",
        },
        {
            "system_id": "teradata-datalake",
            "table_name": "DL_BRANCH_SETTLEMENT_FACT",
            "description": "Curated branch settlement fact table.",
        },
    ],
    "batch_frequencies": [
        {
            "code": "MANUAL",
            "label": "Manual",
            "cron_example": "n/a",
        },
        {
            "code": "HOURLY",
            "label": "Hourly",
            "cron_example": "0 * * * *",
        },
        {
            "code": "DAILY",
            "label": "Daily",
            "cron_example": "0 2 * * *",
        },
        {
            "code": "WEEKLY",
            "label": "Weekly",
            "cron_example": "0 3 * * 1",
        },
    ],
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_now() -> str:
    return _now().isoformat()


def _parse_iso(value: str | None) -> datetime:
    if not value:
        return datetime.fromtimestamp(0, timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.fromtimestamp(0, timezone.utc)


def _normalized_frequency(value: str) -> str:
    normalized = (value or "").strip().upper()
    valid = {item["code"] for item in DEFAULT_CATALOG["batch_frequencies"]}
    if normalized not in valid:
        raise ValueError(f"batch_frequency must be one of: {', '.join(sorted(valid))}.")
    return normalized


def _redis_client(settings: Settings) -> Redis | None:
    client = None
    try:
        client = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_timeout=1.5,
            socket_connect_timeout=1.5,
        )
        client.ping()
        return client
    except RedisError:
        if client is not None:
            client.close()
        return None


def _sorted_jobs(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(rows, key=lambda item: _parse_iso(str(item.get("updated_at") or "")), reverse=True)


def _new_job_id() -> str:
    return f"job-{uuid.uuid4().hex[:10]}"


def _slugify(value: str) -> str:
    lowered = value.strip().lower()
    compact = re.sub(r"[^a-z0-9]+", "_", lowered)
    return compact.strip("_") or "job"


def _seed_jobs() -> list[dict[str, Any]]:
    created_at = _iso_now()
    first = {
        "job_id": "job-oracle-user-txn",
        "name": "Oracle 사용자 거래 적재",
        "description": "Oracle 거래정보를 Teradata DataLake fact로 적재",
        "source_system_id": "oracle-core",
        "source_table": "ORACLE_USER_TXN",
        "target_system_id": "teradata-datalake",
        "target_table": "DL_USER_TXN_FACT",
        "batch_frequency": "DAILY",
        "load_condition": "txn_date >= :last_success_dt",
        "status": "scheduled",
        "owner_username": "admin@test.com",
        "owner_display_name": "Platform Admin",
        "is_procedure_compiled": True,
        "compiled_procedure_name": "sp_elt_oracle_user_txn",
        "airflow_dag_id": "dag_oracle_user_txn_daily",
        "airflow_cron": "0 2 * * *",
        "last_run_status": "success",
        "last_run_at": created_at,
        "last_run_duration_seconds": 74,
        "run_count": 14,
        "success_count": 13,
        "failure_count": 1,
        "created_at": created_at,
        "updated_at": created_at,
    }
    second = {
        "job_id": "job-bank-branch-settlement",
        "name": "은행 지점 정산 파일 적재",
        "description": "은행 정산 파일을 Staging에 우선 적재",
        "source_system_id": "bank-file-feed",
        "source_table": "BANK_BRANCH_SETTLEMENT_FILE",
        "target_system_id": "teradata-staging",
        "target_table": "STG_BANK_DAILY_MSG",
        "batch_frequency": "HOURLY",
        "load_condition": "batch_id = :batch_id",
        "status": "tested",
        "owner_username": "test1@test.com",
        "owner_display_name": "Test User 1",
        "is_procedure_compiled": False,
        "compiled_procedure_name": None,
        "airflow_dag_id": None,
        "airflow_cron": None,
        "last_run_status": "success",
        "last_run_at": created_at,
        "last_run_duration_seconds": 52,
        "run_count": 3,
        "success_count": 3,
        "failure_count": 0,
        "created_at": created_at,
        "updated_at": created_at,
    }
    return [first, second]


def _default_state() -> dict[str, Any]:
    jobs = {item["job_id"]: item for item in _seed_jobs()}
    runs = [
        {
            "run_id": "run-seed-01",
            "job_id": "job-oracle-user-txn",
            "job_name": "Oracle 사용자 거래 적재",
            "status": "success",
            "duration_seconds": 74,
            "message": "Mock execution finished and row count check passed.",
            "executed_by": "admin@test.com",
            "executed_at": _iso_now(),
        },
        {
            "run_id": "run-seed-02",
            "job_id": "job-bank-branch-settlement",
            "job_name": "은행 지점 정산 파일 적재",
            "status": "success",
            "duration_seconds": 52,
            "message": "Mock execution finished and null constraint check passed.",
            "executed_by": "test1@test.com",
            "executed_at": _iso_now(),
        },
    ]
    return {
        "catalog": copy.deepcopy(DEFAULT_CATALOG),
        "jobs": jobs,
        "runs": runs,
    }


_memory_state: dict[str, Any] = _default_state()


def _state_from_redis(client: Redis) -> dict[str, Any] | None:
    raw = client.get(STATE_KEY)
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    if not isinstance(parsed.get("catalog"), dict):
        return None
    if not isinstance(parsed.get("jobs"), dict):
        return None
    if not isinstance(parsed.get("runs"), list):
        return None
    return parsed


def _load_state(settings: Settings) -> dict[str, Any]:
    global _memory_state

    client = _redis_client(settings)
    if client is not None:
        try:
            state = _state_from_redis(client)
            if state is None:
                state = _default_state()
                client.set(STATE_KEY, json.dumps(state, ensure_ascii=False))
            return copy.deepcopy(state)
        finally:
            client.close()

    return copy.deepcopy(_memory_state)


def _save_state(settings: Settings, state: dict[str, Any]) -> None:
    global _memory_state
    normalized = copy.deepcopy(state)

    client = _redis_client(settings)
    if client is not None:
        try:
            client.set(STATE_KEY, json.dumps(normalized, ensure_ascii=False))
            return
        finally:
            client.close()

    _memory_state = normalized


def _assert_known_reference(
    catalog: dict[str, list[dict[str, str]]],
    source_system_id: str,
    source_table: str,
    target_system_id: str,
    target_table: str,
) -> None:
    source_systems = {item["system_id"] for item in catalog.get("source_systems", [])}
    target_systems = {item["system_id"] for item in catalog.get("target_systems", [])}
    if source_system_id not in source_systems:
        raise ValueError("Unknown source_system_id.")
    if target_system_id not in target_systems:
        raise ValueError("Unknown target_system_id.")

    source_table_map = {
        item["table_name"]: item["system_id"]
        for item in catalog.get("source_tables", [])
        if item.get("table_name") and item.get("system_id")
    }
    target_table_map = {
        item["table_name"]: item["system_id"]
        for item in catalog.get("target_tables", [])
        if item.get("table_name") and item.get("system_id")
    }

    if source_table not in source_table_map:
        raise ValueError("Unknown source_table.")
    if target_table not in target_table_map:
        raise ValueError("Unknown target_table.")
    if source_table_map[source_table] != source_system_id:
        raise ValueError("source_table does not belong to source_system_id.")
    if target_table_map[target_table] != target_system_id:
        raise ValueError("target_table does not belong to target_system_id.")


def list_catalog(settings: Settings) -> dict[str, list[dict[str, str]]]:
    state = _load_state(settings)
    return copy.deepcopy(state["catalog"])


def list_jobs(settings: Settings) -> list[dict[str, Any]]:
    state = _load_state(settings)
    return _sorted_jobs(list(state["jobs"].values()))


def create_job(
    settings: Settings,
    *,
    name: str,
    description: str | None,
    source_system_id: str,
    source_table: str,
    target_system_id: str,
    target_table: str,
    batch_frequency: str,
    load_condition: str,
    owner_username: str,
    owner_display_name: str,
) -> dict[str, Any]:
    state = _load_state(settings)
    catalog = state["catalog"]

    normalized_name = name.strip()
    if not normalized_name:
        raise ValueError("name is required.")
    normalized_condition = load_condition.strip()
    if not normalized_condition:
        raise ValueError("load_condition is required.")

    normalized_source_system_id = source_system_id.strip()
    normalized_target_system_id = target_system_id.strip()
    normalized_source_table = source_table.strip().upper()
    normalized_target_table = target_table.strip().upper()
    normalized_frequency = _normalized_frequency(batch_frequency)

    _assert_known_reference(
        catalog,
        source_system_id=normalized_source_system_id,
        source_table=normalized_source_table,
        target_system_id=normalized_target_system_id,
        target_table=normalized_target_table,
    )

    now = _iso_now()
    row = {
        "job_id": _new_job_id(),
        "name": normalized_name,
        "description": (description or "").strip(),
        "source_system_id": normalized_source_system_id,
        "source_table": normalized_source_table,
        "target_system_id": normalized_target_system_id,
        "target_table": normalized_target_table,
        "batch_frequency": normalized_frequency,
        "load_condition": normalized_condition,
        "status": "draft",
        "owner_username": owner_username,
        "owner_display_name": owner_display_name,
        "is_procedure_compiled": False,
        "compiled_procedure_name": None,
        "airflow_dag_id": None,
        "airflow_cron": None,
        "last_run_status": "never",
        "last_run_at": None,
        "last_run_duration_seconds": None,
        "run_count": 0,
        "success_count": 0,
        "failure_count": 0,
        "created_at": now,
        "updated_at": now,
    }

    state["jobs"][row["job_id"]] = row
    _save_state(settings, state)
    return row


def update_job(
    settings: Settings,
    *,
    job_id: str,
    name: str | None = None,
    description: str | None = None,
    source_system_id: str | None = None,
    source_table: str | None = None,
    target_system_id: str | None = None,
    target_table: str | None = None,
    batch_frequency: str | None = None,
    load_condition: str | None = None,
) -> dict[str, Any]:
    state = _load_state(settings)
    row = state["jobs"].get(job_id)
    if row is None:
        raise ValueError("Unknown job_id.")

    requires_pipeline_reset = False

    if name is not None:
        normalized_name = name.strip()
        if not normalized_name:
            raise ValueError("name cannot be empty.")
        row["name"] = normalized_name

    if description is not None:
        row["description"] = description.strip()

    if load_condition is not None:
        normalized_condition = load_condition.strip()
        if not normalized_condition:
            raise ValueError("load_condition cannot be empty.")
        row["load_condition"] = normalized_condition
        requires_pipeline_reset = True

    if batch_frequency is not None:
        row["batch_frequency"] = _normalized_frequency(batch_frequency)
        requires_pipeline_reset = True

    if source_system_id is not None:
        row["source_system_id"] = source_system_id.strip()
        requires_pipeline_reset = True
    if source_table is not None:
        row["source_table"] = source_table.strip().upper()
        requires_pipeline_reset = True
    if target_system_id is not None:
        row["target_system_id"] = target_system_id.strip()
        requires_pipeline_reset = True
    if target_table is not None:
        row["target_table"] = target_table.strip().upper()
        requires_pipeline_reset = True

    _assert_known_reference(
        state["catalog"],
        source_system_id=str(row["source_system_id"]),
        source_table=str(row["source_table"]),
        target_system_id=str(row["target_system_id"]),
        target_table=str(row["target_table"]),
    )

    if requires_pipeline_reset:
        # Mapping/condition changes require compile and schedule registration again.
        row["is_procedure_compiled"] = False
        row["compiled_procedure_name"] = None
        row["airflow_dag_id"] = None
        row["airflow_cron"] = None
        row["status"] = "draft"
    row["updated_at"] = _iso_now()

    _save_state(settings, state)
    return row


def run_job(
    settings: Settings,
    *,
    job_id: str,
    executed_by: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    state = _load_state(settings)
    row = state["jobs"].get(job_id)
    if row is None:
        raise ValueError("Unknown job_id.")

    next_run_index = int(row.get("run_count") or 0) + 1
    signature = f"{job_id}:{next_run_index}:{row.get('load_condition', '')}".encode("utf-8")
    digest = int(hashlib.sha256(signature).hexdigest()[:8], 16)
    duration_seconds = 25 + (digest % 155)

    condition = str(row.get("load_condition") or "").upper()
    forced_failure = "FORCE_FAIL" in condition
    success = (digest % 8) != 0 and not forced_failure

    status = "success" if success else "failed"
    message = (
        "Mock execution finished. Source and target row-count check passed."
        if success
        else "Mock execution failed during validation step. Inspect the load condition and metadata mapping."
    )

    executed_at = _iso_now()
    run_payload = {
        "run_id": f"run-{uuid.uuid4().hex[:10]}",
        "job_id": job_id,
        "job_name": row["name"],
        "status": status,
        "duration_seconds": duration_seconds,
        "message": message,
        "executed_by": executed_by,
        "executed_at": executed_at,
    }
    state["runs"].insert(0, run_payload)
    state["runs"] = state["runs"][:300]

    row["run_count"] = next_run_index
    row["last_run_status"] = status
    row["last_run_at"] = executed_at
    row["last_run_duration_seconds"] = duration_seconds
    row["success_count"] = int(row.get("success_count") or 0) + (1 if success else 0)
    row["failure_count"] = int(row.get("failure_count") or 0) + (0 if success else 1)

    if success:
        row["status"] = "scheduled" if row.get("airflow_dag_id") else "tested"
    else:
        row["status"] = "failed"

    row["updated_at"] = _iso_now()
    _save_state(settings, state)
    return row, run_payload


def compile_job_procedure(
    settings: Settings,
    *,
    job_id: str,
    compiled_by: str,
) -> dict[str, Any]:
    state = _load_state(settings)
    row = state["jobs"].get(job_id)
    if row is None:
        raise ValueError("Unknown job_id.")

    if int(row.get("run_count") or 0) == 0:
        raise ValueError("Run the job at least once before compiling stored procedure.")

    base_name = _slugify(str(row.get("name") or job_id))
    source = _slugify(str(row.get("source_table") or "src"))
    target = _slugify(str(row.get("target_table") or "tgt"))
    row["compiled_procedure_name"] = f"sp_elt_{source}_{target}_{base_name}"[:63]
    row["is_procedure_compiled"] = True
    row["status"] = "scheduled" if row.get("airflow_dag_id") else "compiled"
    row["updated_at"] = _iso_now()
    row["last_compiled_by"] = compiled_by
    row["last_compiled_at"] = _iso_now()

    _save_state(settings, state)
    return row


def register_airflow(
    settings: Settings,
    *,
    job_id: str,
    cron: str,
    registered_by: str,
    dag_id: str | None,
) -> dict[str, Any]:
    state = _load_state(settings)
    row = state["jobs"].get(job_id)
    if row is None:
        raise ValueError("Unknown job_id.")

    if not row.get("is_procedure_compiled"):
        raise ValueError("Compile stored procedure before Airflow registration.")

    cron_text = cron.strip()
    if len(cron_text.split()) < 5:
        raise ValueError("cron must include at least 5 fields (m h dom mon dow).")

    computed_dag_id = (dag_id or "").strip() or f"dag_{_slugify(str(row['job_id']))}_{_slugify(str(row['name']))}"

    row["airflow_dag_id"] = computed_dag_id[:80]
    row["airflow_cron"] = cron_text
    row["status"] = "scheduled"
    row["updated_at"] = _iso_now()
    row["last_registered_by"] = registered_by
    row["last_registered_at"] = _iso_now()

    _save_state(settings, state)
    return row


def build_overview(settings: Settings) -> dict[str, Any]:
    state = _load_state(settings)
    jobs = _sorted_jobs(list(state["jobs"].values()))
    runs = sorted(state["runs"], key=lambda item: _parse_iso(str(item.get("executed_at") or "")), reverse=True)

    summary = {
        "total_jobs": len(jobs),
        "draft_jobs": sum(1 for item in jobs if item.get("status") == "draft"),
        "tested_jobs": sum(1 for item in jobs if item.get("run_count", 0) and item.get("status") in {"tested", "compiled", "scheduled", "failed"}),
        "compiled_jobs": sum(1 for item in jobs if item.get("is_procedure_compiled")),
        "scheduled_jobs": sum(1 for item in jobs if item.get("airflow_dag_id")),
        "failed_jobs": sum(1 for item in jobs if item.get("last_run_status") == "failed"),
        "total_runs": len(runs),
        "successful_runs": sum(1 for item in runs if item.get("status") == "success"),
        "failed_runs": sum(1 for item in runs if item.get("status") == "failed"),
    }

    schedule_counts: dict[str, int] = {}
    for item in jobs:
        freq = str(item.get("batch_frequency") or "MANUAL")
        schedule_counts[freq] = schedule_counts.get(freq, 0) + 1

    schedule_breakdown = [
        {
            "frequency": item["code"],
            "label": item["label"],
            "count": schedule_counts.get(item["code"], 0),
        }
        for item in state["catalog"].get("batch_frequencies", [])
    ]

    return {
        "summary": summary,
        "schedule_breakdown": schedule_breakdown,
        "recent_runs": runs[:24],
        "jobs": jobs,
    }
