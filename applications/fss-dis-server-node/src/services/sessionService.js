import { config, isDynamicRouteMode, isIngressPathMode } from "../config.js";
import { buildLabIdentity, buildSessionToken } from "../utils/labIdentity.js";
import { listUserMockPods } from "./mockPodService.js";
import {
  recordLabLaunch,
  recordLabStop,
  syncSessionActivity,
} from "./authService.js";
import { getUserLabLaunchProfile } from "./governanceService.js";
import { ensureStoredLabIdentity, getStoredLabIdentity, persistLabIdentity } from "./labIdentityService.js";
import {
  createOrEnsureSessionPod,
  deleteSessionPod,
} from "./k8sService.js";

function toPublicSessionSummary(summary) {
  if (!summary) return summary;
  return {
    session_id: summary.session_id,
    username: summary.username,
    namespace: summary.namespace,
    pod_name: summary.pod_name,
    service_name: summary.service_name,
    headless_service: summary.headless_service,
    workspace_subpath: summary.workspace_subpath,
    image: summary.image,
    status: summary.status,
    phase: summary.phase,
    ready: summary.ready,
    detail: summary.detail,
    node_port: summary.node_port,
    created_at: summary.created_at,
    snapshot_status: summary.snapshot_status || "",
    snapshot_job_name: summary.snapshot_job_name || "",
    snapshot_detail: summary.snapshot_detail || "",
  };
}

function toPublicPodItem(summary) {
  if (!summary) return null;
  return {
    username: summary.username,
    pod_name: summary.pod_name,
    namespace: summary.namespace,
    status: summary.status,
    phase: summary.phase,
    ready: summary.ready,
    image: summary.image,
    headless_service: summary.headless_service,
    service_name: summary.service_name,
    workspace_subpath: summary.workspace_subpath,
    node_port: summary.node_port,
    detail: summary.detail,
    created_at: summary.created_at,
    updated_at: summary.created_at,
    source: "k8s-session",
  };
}

async function readLabSessionSummary(username) {
  const identity = await ensureStoredLabIdentity(username);
  if (!identity) {
    return {
      session_id: "",
      username,
      namespace: config.k8sUserNamespace,
      pod_name: "",
      service_name: "",
      headless_service: "",
      workspace_subpath: "",
      image: config.jupyterImage,
      status: "missing",
      phase: "Missing",
      ready: false,
      detail: "No adw.userpods entry exists for this user.",
      node_port: null,
      created_at: null,
    };
  }

  const items = await listUserMockPods(identity.username);
  const matched = items.find((item) => item.pod_name === identity.pod_name) || items[0] || null;
  const summary = {
    session_id: identity.session_id,
    username: identity.username,
    namespace: matched?.namespace || config.k8sUserNamespace,
    pod_name: identity.pod_name,
    service_name: identity.service_name,
    headless_service: identity.headless_service || config.jupyterDynamicSubdomain,
    workspace_subpath: identity.workspace_subpath,
    image: matched?.image || config.jupyterImage,
    status: matched?.status || "missing",
    phase: matched?.status || "Missing",
    ready: Boolean(matched?.ready),
    detail: matched ? "Loaded from adw.userpods." : "No adw.userpods entry exists for this user.",
    node_port: null,
    created_at: matched?.created_at || null,
  };
  await syncSessionActivity(identity.username, summary);
  return summary;
}

function resolveLaunchProfile(launchImage, profile) {
  const raw = profile || {};
  const extra = raw.extra_env && typeof raw.extra_env === "object" ? raw.extra_env : {};
  return {
    image: String(raw.image || launchImage),
    pvc_name: String(raw.pvc_name || ""),
    use_workspace_subpath: Boolean(raw.use_workspace_subpath),
    cpu_request: String(raw.cpu_request || "100m"),
    cpu_limit: String(raw.cpu_limit || "1000m"),
    memory_request: String(raw.memory_request || "256Mi"),
    memory_limit: String(raw.memory_limit || "1Gi"),
    extra_env: Object.fromEntries(
      Object.entries(extra).map(([k, v]) => [String(k), String(v)]),
    ),
  };
}

export async function getLabSession(username) {
  const summary = await readLabSessionSummary(username);
  return toPublicSessionSummary(summary);
}

export async function listUserPods(username) {
  const session = await getLabSession(username);
  const item = toPublicPodItem(session);
  return item?.pod_name ? [item] : [];
}

export async function ensureLabSession(username) {
  const identity = await ensureStoredLabIdentity(username);
  if (!identity) {
    throw new Error("No adw.userpods entry exists for this user.");
  }
  const launchImage = config.jupyterImage;

  let launchProfilePayload = null;
  if (config.labGovernanceEnabled) {
    launchProfilePayload = await getUserLabLaunchProfile(identity.username);
  } else {
    launchProfilePayload = {
      image: launchImage,
      pvc_name: "jupyter-workspace",
      use_workspace_subpath: true,
      cpu_request: "100m",
      cpu_limit: "1000m",
      memory_request: "256Mi",
      memory_limit: "1Gi",
      extra_env: {},
    };
  }

  const launchProfile = resolveLaunchProfile(launchImage, launchProfilePayload);
  if (!launchProfile.pvc_name) {
    throw new Error("User PVC is not assigned. Approve resource request first.");
  }

  await persistLabIdentity(identity, { image: launchProfile.image });
  await createOrEnsureSessionPod({ identity, launchProfile });
  const summary = await readLabSessionSummary(identity.username);

  if (summary.created_at) {
    await recordLabLaunch(identity.username, summary.created_at);
  } else {
    await syncSessionActivity(identity.username, summary);
  }

  return toPublicSessionSummary(summary);
}

export async function deleteLabSession(username) {
  const identity = await getStoredLabIdentity(username);
  if (!identity) {
    throw new Error("No adw.userpods entry exists for this user.");
  }
  const summary = await readLabSessionSummary(identity.username);
  await deleteSessionPod(identity);
  await recordLabStop(identity.username);

  return toPublicSessionSummary({
    ...summary,
    status: "deleted",
    phase: "Deleted",
    ready: false,
    detail: "Personal JupyterLab session delete was requested. Physical state should be checked via K8s APIs.",
    node_port: null,
    snapshot_status: "skipped",
    snapshot_job_name: null,
    snapshot_detail: "Snapshot publish is not configured in Node migration backend yet.",
  });
}

function resolveFrontendOrigin(req) {
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "")
    .split(",")[0]
    .trim();

  if (forwardedHost) {
    return `${forwardedProto || "http"}://${forwardedHost}`;
  }

  return config.frontendUrl;
}

export async function buildConnectResponse(summary, username, req = null) {
  if (!summary?.ready) {
    throw new Error("JupyterLab is not ready yet.");
  }
  const frontend = new URL(resolveFrontendOrigin(req));
  const publicBase = String(config.jupyterPublicBaseUrl || "").trim();
  const jupyterBase = publicBase ? new URL(publicBase) : frontend;
  if (isIngressPathMode()) {
    return {
      redirect_url: `${jupyterBase.origin}/jupyter/lab?userid=${encodeURIComponent(username)}`,
      detail: "Connected through protected ingress path /jupyter with pod-router user mapping.",
    };
  }
  if (isDynamicRouteMode()) {
    const identity = await getStoredLabIdentity(username);
    if (!identity) {
      throw new Error("No adw.userpods entry exists for this user.");
    }
    const token = buildSessionToken(config.jupyterToken, identity.session_id);
    const suffix = String(config.jupyterDynamicHostSuffix || "").trim().replace(/^\.+|\.+$/g, "");
    if (!suffix) {
      throw new Error("PLATFORM_JUPYTER_DYNAMIC_HOST_SUFFIX is not configured.");
    }
    const scheme = String(config.jupyterDynamicScheme || "https").trim().toLowerCase() || "https";
    return {
      redirect_url: `${scheme}://${identity.pod_name}.${suffix}/lab?token=${encodeURIComponent(token)}`,
      detail: `Connected through dynamic pod route ${identity.pod_name}.${suffix}.`,
    };
  }
  if (!summary.node_port) {
    throw new Error("NodePort is not available.");
  }
  const identity = await getStoredLabIdentity(username);
  if (!identity) {
    throw new Error("No adw.userpods entry exists for this user.");
  }
  const token = buildSessionToken(config.jupyterToken, identity.session_id);
  return {
    redirect_url: `${frontend.protocol}//${frontend.hostname}:${summary.node_port}/lab?token=${encodeURIComponent(token)}`,
    detail: `Connected through NodePort ${summary.node_port}.`,
  };
}

export async function resolveJupyterRouteSession(username) {
  const requestedUsername = String(username || "").trim();
  if (!requestedUsername) {
    throw new Error("Jupyter route userid is required.");
  }

  const identity = await getStoredLabIdentity(requestedUsername);
  if (!identity) {
    throw new Error("No adw.userpods entry exists for this user.");
  }
  const summary = await readLabSessionSummary(identity.username);
  if (!summary?.ready) {
    throw new Error("JupyterLab is not ready yet.");
  }

  return {
    username: identity.username,
    pod_name: identity.pod_name,
    headless_service: identity.headless_service,
    upstream_host: `${identity.pod_name}.${identity.headless_service}.${config.k8sUserNamespace}.svc.cluster.local`,
    token: buildSessionToken(config.jupyterToken, identity.session_id),
  };
}

export function getSnapshotStatus(username) {
  const identity = buildLabIdentity(username);
  return {
    username: identity.username,
    session_id: identity.session_id,
    workspace_subpath: identity.workspace_subpath,
    image: config.jupyterImage,
    status: "missing",
    job_name: null,
    published_at: null,
    restorable: false,
    detail: "Snapshot publish is not configured in Node migration backend yet.",
  };
}

export function publishSnapshot(username) {
  const status = getSnapshotStatus(username);
  return {
    ...status,
    status: "skipped",
    detail: "Snapshot publish endpoint is acknowledged but not implemented in this migration step.",
  };
}
