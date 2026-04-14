from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any
from uuid import uuid4

from kubernetes import client
from kubernetes.client.exceptions import ApiException
from kubernetes.config.config_exception import ConfigException
from redis import Redis
from redis.exceptions import RedisError

from app.config import Settings
from app.services.demo_users import get_demo_user
from app.services.kube_client import get_core_v1_api
from app.services.lab_identity import build_lab_identity

ENV_PREFIX = "platform:lab:env:"
RESOURCE_REQUEST_PREFIX = "platform:lab:resource-request:"
ENV_REQUEST_PREFIX = "platform:lab:env-request:"
ALLOCATION_PREFIX = "platform:lab:allocation:"
ASSIGNMENT_PREFIX = "platform:lab:assignment:"

DEFAULT_ENV_ID = "jupter-teradata-fss"

_memory_envs: dict[str, dict[str, Any]] = {}
_memory_resource_requests: dict[str, dict[str, Any]] = {}
_memory_env_requests: dict[str, dict[str, Any]] = {}
_memory_allocations: dict[str, dict[str, Any]] = {}
_memory_assignments: dict[str, dict[str, Any]] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso_now() -> str:
    return _utcnow().isoformat()


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


def _load_json(client: Redis, key: str) -> dict[str, Any] | None:
    raw = client.get(key)
    if not raw:
        return None
    return json.loads(raw)


def _save_json(client: Redis, key: str, payload: dict[str, Any]) -> None:
    client.set(key, json.dumps(payload))


def _load_by_prefix(client: Redis, prefix: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for key in client.scan_iter(f"{prefix}*"):
        payload = _load_json(client, str(key))
        if payload:
            rows.append(payload)
    return rows


def _env_key(env_id: str) -> str:
    return f"{ENV_PREFIX}{env_id}"


def _resource_request_key(request_id: str) -> str:
    return f"{RESOURCE_REQUEST_PREFIX}{request_id}"


def _env_request_key(request_id: str) -> str:
    return f"{ENV_REQUEST_PREFIX}{request_id}"


def _allocation_key(username: str) -> str:
    return f"{ALLOCATION_PREFIX}{username}"


def _assignment_key(username: str) -> str:
    return f"{ASSIGNMENT_PREFIX}{username}"


def _normalize_env_id(env_id: str) -> str:
    normalized = env_id.strip().lower()
    if len(normalized) < 3 or len(normalized) > 64:
        raise ValueError("env_id must be between 3 and 64 characters.")
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-_")
    if any(ch not in allowed for ch in normalized):
        raise ValueError("env_id may contain only lowercase letters, numbers, dash, underscore.")
    return normalized


def _ensure_default_environment(settings: Settings) -> None:
    if list_analysis_environments(settings, include_inactive=True):
        return
    upsert_analysis_environment(
        settings=settings,
        env_id=DEFAULT_ENV_ID,
        name="Jupyter Teradata Extension",
        image=settings.jupyter_image,
        description="Default per-user JupyterLab image with Teradata extension.",
        gpu_enabled=False,
        is_active=True,
        updated_by="system",
    )


def list_analysis_environments(settings: Settings, include_inactive: bool = False) -> list[dict[str, Any]]:
    client = _redis_client(settings)
    if client is not None:
        try:
            rows = _load_by_prefix(client, ENV_PREFIX)
        finally:
            client.close()
    else:
        rows = list(_memory_envs.values())

    rows.sort(key=lambda item: str(item.get("env_id") or ""))
    if include_inactive:
        return rows
    return [row for row in rows if bool(row.get("is_active", True))]


def upsert_analysis_environment(
    settings: Settings,
    env_id: str,
    name: str,
    image: str,
    description: str | None,
    gpu_enabled: bool,
    is_active: bool,
    updated_by: str,
) -> dict[str, Any]:
    normalized_env_id = _normalize_env_id(env_id)
    now = _iso_now()
    payload = {
        "env_id": normalized_env_id,
        "name": name.strip() or normalized_env_id,
        "image": image.strip(),
        "description": (description or "").strip(),
        "gpu_enabled": bool(gpu_enabled),
        "is_active": bool(is_active),
        "updated_by": updated_by,
        "updated_at": now,
    }
    if not payload["image"]:
        raise ValueError("image is required.")

    client = _redis_client(settings)
    if client is not None:
        try:
            current = _load_json(client, _env_key(normalized_env_id)) or {}
            payload["created_at"] = str(current.get("created_at") or now)
            _save_json(client, _env_key(normalized_env_id), payload)
        finally:
            client.close()
    else:
        current = _memory_envs.get(normalized_env_id, {})
        payload["created_at"] = str(current.get("created_at") or now)
        _memory_envs[normalized_env_id] = dict(payload)

    return payload


def submit_resource_request(
    settings: Settings,
    username: str,
    vcpu: int,
    memory_gib: int,
    disk_gib: int,
    note: str | None,
) -> dict[str, Any]:
    user = get_demo_user(username, settings)
    request_id = f"rr-{uuid4().hex[:12]}"
    now = _iso_now()
    payload = {
        "request_id": request_id,
        "username": user.username,
        "vcpu": int(vcpu),
        "memory_gib": int(memory_gib),
        "disk_gib": int(disk_gib),
        "request_note": (note or "").strip(),
        "status": "pending",
        "review_note": "",
        "reviewed_by": None,
        "pvc_name": None,
        "created_at": now,
        "updated_at": now,
    }

    client = _redis_client(settings)
    if client is not None:
        try:
            _save_json(client, _resource_request_key(request_id), payload)
        finally:
            client.close()
    else:
        _memory_resource_requests[request_id] = dict(payload)
    return payload


def list_resource_requests(
    settings: Settings,
    username: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    client = _redis_client(settings)
    if client is not None:
        try:
            rows = _load_by_prefix(client, RESOURCE_REQUEST_PREFIX)
        finally:
            client.close()
    else:
        rows = list(_memory_resource_requests.values())

    if username:
        rows = [row for row in rows if str(row.get("username") or "") == username]
    if status:
        rows = [row for row in rows if str(row.get("status") or "") == status]
    rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return rows


def _ensure_user_home_pvc(settings: Settings, username: str, disk_gib: int) -> str:
    identity = build_lab_identity(username)
    pvc_name = f"lab-home-{identity.session_id}"[:63]

    try:
        api = get_core_v1_api()
        try:
            api.read_namespaced_persistent_volume_claim(name=pvc_name, namespace=settings.k8s_namespace)
            return pvc_name
        except ApiException as exc:
            if exc.status != 404:
                raise

        resources = client.V1ResourceRequirements(
            requests={"storage": f"{int(disk_gib)}Gi"},
        )
        spec = client.V1PersistentVolumeClaimSpec(
            access_modes=["ReadWriteOnce"],
            resources=resources,
        )
        if settings.jupyter_user_pvc_storage_class:
            spec.storage_class_name = settings.jupyter_user_pvc_storage_class

        pvc = client.V1PersistentVolumeClaim(
            metadata=client.V1ObjectMeta(
                name=pvc_name,
                labels={
                    "app.kubernetes.io/component": "jupyter-user-home",
                    "platform.dev/username": identity.username,
                },
            ),
            spec=spec,
        )
        api.create_namespaced_persistent_volume_claim(namespace=settings.k8s_namespace, body=pvc)
        return pvc_name
    except ConfigException as exc:
        raise RuntimeError("Kubernetes client configuration is unavailable.") from exc
    except ApiException as exc:
        raise RuntimeError(f"Kubernetes API error while creating user PVC: {exc.reason}") from exc


def _load_resource_request(settings: Settings, request_id: str) -> dict[str, Any]:
    client = _redis_client(settings)
    if client is not None:
        try:
            payload = _load_json(client, _resource_request_key(request_id))
        finally:
            client.close()
        if payload:
            return payload
    payload = _memory_resource_requests.get(request_id)
    if payload:
        return dict(payload)
    raise ValueError("Resource request not found.")


def review_resource_request(
    settings: Settings,
    request_id: str,
    approved: bool,
    reviewed_by: str,
    note: str | None,
) -> dict[str, Any]:
    request = _load_resource_request(settings, request_id)
    if request["status"] != "pending":
        raise ValueError("Only pending resource requests can be reviewed.")

    now = _iso_now()
    review_note = (note or "").strip()
    pvc_name = None
    if approved:
        pvc_name = _ensure_user_home_pvc(settings, str(request["username"]), int(request["disk_gib"]))
        allocation = {
            "username": str(request["username"]),
            "vcpu": int(request["vcpu"]),
            "memory_gib": int(request["memory_gib"]),
            "disk_gib": int(request["disk_gib"]),
            "pvc_name": pvc_name,
            "approved_by": reviewed_by,
            "approved_at": now,
            "updated_at": now,
        }
        client = _redis_client(settings)
        if client is not None:
            try:
                _save_json(client, _allocation_key(str(request["username"])), allocation)
            finally:
                client.close()
        else:
            _memory_allocations[str(request["username"])] = dict(allocation)

    request["status"] = "approved" if approved else "rejected"
    request["review_note"] = review_note
    request["reviewed_by"] = reviewed_by
    request["pvc_name"] = pvc_name
    request["updated_at"] = now

    client = _redis_client(settings)
    if client is not None:
        try:
            _save_json(client, _resource_request_key(request_id), request)
        finally:
            client.close()
    else:
        _memory_resource_requests[request_id] = dict(request)

    return request


def get_user_resource_allocation(settings: Settings, username: str) -> dict[str, Any] | None:
    normalized = get_demo_user(username, settings).username
    client = _redis_client(settings)
    if client is not None:
        try:
            return _load_json(client, _allocation_key(normalized))
        finally:
            client.close()
    payload = _memory_allocations.get(normalized)
    return dict(payload) if payload else None


def submit_environment_request(
    settings: Settings,
    username: str,
    env_id: str,
    note: str | None,
) -> dict[str, Any]:
    user = get_demo_user(username, settings)
    _ensure_default_environment(settings)
    normalized_env_id = _normalize_env_id(env_id)
    envs = {item["env_id"]: item for item in list_analysis_environments(settings, include_inactive=True)}
    env = envs.get(normalized_env_id)
    if env is None:
        raise ValueError("Requested analysis environment does not exist.")
    if not env.get("is_active", True):
        raise ValueError("Requested analysis environment is inactive.")

    allocation = get_user_resource_allocation(settings, user.username)
    if allocation is None:
        raise ValueError("Resource allocation must be approved before requesting analysis environment.")

    request_id = f"er-{uuid4().hex[:12]}"
    now = _iso_now()
    payload = {
        "request_id": request_id,
        "username": user.username,
        "env_id": normalized_env_id,
        "request_note": (note or "").strip(),
        "status": "pending",
        "review_note": "",
        "reviewed_by": None,
        "created_at": now,
        "updated_at": now,
    }

    client = _redis_client(settings)
    if client is not None:
        try:
            _save_json(client, _env_request_key(request_id), payload)
        finally:
            client.close()
    else:
        _memory_env_requests[request_id] = dict(payload)

    return payload


def list_environment_requests(
    settings: Settings,
    username: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    client = _redis_client(settings)
    if client is not None:
        try:
            rows = _load_by_prefix(client, ENV_REQUEST_PREFIX)
        finally:
            client.close()
    else:
        rows = list(_memory_env_requests.values())

    if username:
        rows = [row for row in rows if str(row.get("username") or "") == username]
    if status:
        rows = [row for row in rows if str(row.get("status") or "") == status]
    rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return rows


def _load_environment_request(settings: Settings, request_id: str) -> dict[str, Any]:
    client = _redis_client(settings)
    if client is not None:
        try:
            payload = _load_json(client, _env_request_key(request_id))
        finally:
            client.close()
        if payload:
            return payload
    payload = _memory_env_requests.get(request_id)
    if payload:
        return dict(payload)
    raise ValueError("Environment request not found.")


def review_environment_request(
    settings: Settings,
    request_id: str,
    approved: bool,
    reviewed_by: str,
    note: str | None,
) -> dict[str, Any]:
    request = _load_environment_request(settings, request_id)
    if request["status"] != "pending":
        raise ValueError("Only pending environment requests can be reviewed.")

    now = _iso_now()
    request["status"] = "approved" if approved else "rejected"
    request["review_note"] = (note or "").strip()
    request["reviewed_by"] = reviewed_by
    request["updated_at"] = now

    client = _redis_client(settings)
    if client is not None:
        try:
            _save_json(client, _env_request_key(request_id), request)
        finally:
            client.close()
    else:
        _memory_env_requests[request_id] = dict(request)

    if approved:
        envs = {item["env_id"]: item for item in list_analysis_environments(settings, include_inactive=True)}
        env = envs.get(str(request["env_id"]))
        if env is None:
            raise RuntimeError("Approved environment request references a missing environment.")
        assignment = {
            "username": str(request["username"]),
            "env_id": str(request["env_id"]),
            "image": str(env["image"]),
            "approved_by": reviewed_by,
            "approved_at": now,
            "updated_at": now,
        }
        client = _redis_client(settings)
        if client is not None:
            try:
                _save_json(client, _assignment_key(str(request["username"])), assignment)
            finally:
                client.close()
        else:
            _memory_assignments[str(request["username"])] = dict(assignment)

    return request


def get_user_environment_assignment(settings: Settings, username: str) -> dict[str, Any] | None:
    normalized = get_demo_user(username, settings).username
    client = _redis_client(settings)
    if client is not None:
        try:
            return _load_json(client, _assignment_key(normalized))
        finally:
            client.close()
    payload = _memory_assignments.get(normalized)
    return dict(payload) if payload else None


def get_user_lab_policy(settings: Settings, username: str) -> dict[str, Any]:
    user = get_demo_user(username, settings)
    if not settings.lab_governance_enabled:
        return {
            "username": user.username,
            "governance_enabled": False,
            "ready": True,
            "vcpu": None,
            "memory_gib": None,
            "disk_gib": None,
            "pvc_name": None,
            "analysis_env_id": None,
            "analysis_image": None,
            "detail": "Governance policy is disabled. Direct personal Jupyter launch is allowed.",
        }

    _ensure_default_environment(settings)
    allocation = get_user_resource_allocation(settings, user.username)
    assignment = get_user_environment_assignment(settings, user.username)
    ready = bool(allocation and assignment)

    detail = "Resource allocation and analysis environment approval are required."
    if allocation and not assignment:
        detail = "Resource allocation is approved. Analysis environment approval is pending."
    if ready:
        detail = "Ready to launch personal JupyterLab with approved resources and image."

    return {
        "username": user.username,
        "governance_enabled": True,
        "ready": ready,
        "vcpu": int(allocation["vcpu"]) if allocation else None,
        "memory_gib": int(allocation["memory_gib"]) if allocation else None,
        "disk_gib": int(allocation["disk_gib"]) if allocation else None,
        "pvc_name": str(allocation["pvc_name"]) if allocation else None,
        "analysis_env_id": str(assignment["env_id"]) if assignment else None,
        "analysis_image": str(assignment["image"]) if assignment else None,
        "detail": detail,
    }


def get_user_lab_launch_profile(settings: Settings, username: str) -> dict[str, Any]:
    policy = get_user_lab_policy(settings, username)
    if not policy["ready"]:
        raise ValueError(str(policy["detail"]))

    vcpu = int(policy["vcpu"])
    memory_gib = int(policy["memory_gib"])
    disk_gib = int(policy["disk_gib"])
    pvc_name = str(policy["pvc_name"])
    image = str(policy["analysis_image"])
    env_id = str(policy["analysis_env_id"])

    return {
        "image": image,
        "pvc_name": pvc_name,
        "use_workspace_subpath": False,
        "cpu_request": str(vcpu),
        "cpu_limit": str(vcpu),
        "memory_request": f"{memory_gib}Gi",
        "memory_limit": f"{memory_gib}Gi",
        "extra_env": {
            "PLATFORM_ANALYSIS_ENV_ID": env_id,
            "PLATFORM_ALLOCATED_VCPU": str(vcpu),
            "PLATFORM_ALLOCATED_MEMORY_GIB": str(memory_gib),
            "PLATFORM_ALLOCATED_DISK_GIB": str(disk_gib),
        },
    }
