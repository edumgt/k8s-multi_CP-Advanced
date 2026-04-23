import { config, isDynamicRouteMode, isIngressPathMode } from "../config.js";
import { buildLabIdentity, buildSessionToken } from "../utils/labIdentity.js";
import {
  getJupyterRouteAccess,
  recordLabLaunch,
  recordLabStop,
  storeJupyterRouteAccess,
  syncSessionActivity,
} from "./authService.js";
import { getUserLabLaunchProfile } from "./governanceService.js";
import {
  buildSessionSummary,
  createOrEnsureSessionPod,
  deleteSessionPod,
  readPod,
  readService,
} from "./k8sService.js";

function toPublicSessionSummary(summary) {
  if (!summary) return summary;
  return {
    session_id: summary.session_id,
    username: summary.username,
    namespace: summary.namespace,
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

async function readLabSessionSummary(username) {
  const identity = buildLabIdentity(username);
  const pod = await readPod(identity.pod_name);
  const service = isDynamicRouteMode() || isIngressPathMode() ? null : await readService(identity.service_name);
  const summary = buildSessionSummary({
    identity,
    pod,
    service,
    launchImage: config.jupyterImage,
  });
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

export async function ensureLabSession(username) {
  const identity = buildLabIdentity(username);
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

  const before = await readPod(identity.pod_name);
  const createdNew = !before;
  const { pod, service } = await createOrEnsureSessionPod({ identity, launchProfile });
  const summary = buildSessionSummary({
    identity,
    pod,
    service,
    launchImage: launchProfile.image,
  });

  if (createdNew) {
    await recordLabLaunch(identity.username, summary.created_at);
  } else {
    await syncSessionActivity(identity.username, summary);
  }

  return toPublicSessionSummary(summary);
}

export async function deleteLabSession(username) {
  const identity = buildLabIdentity(username);
  const summary = await readLabSessionSummary(identity.username);
  await deleteSessionPod(identity);
  await recordLabStop(identity.username);

  return toPublicSessionSummary({
    ...summary,
    status: "deleted",
    phase: "Deleted",
    ready: false,
    detail: "Personal JupyterLab session resources were deleted.",
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
    const access = await storeJupyterRouteAccess(username);
    return {
      redirect_url: `${jupyterBase.origin}/jupyter/lab?access=${encodeURIComponent(access.token)}`,
      detail: "Connected through protected ingress path /jupyter.",
    };
  }
  if (isDynamicRouteMode()) {
    const identity = buildLabIdentity(username);
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
  const identity = buildLabIdentity(username);
  const token = buildSessionToken(config.jupyterToken, identity.session_id);
  return {
    redirect_url: `${frontend.protocol}//${frontend.hostname}:${summary.node_port}/lab?token=${encodeURIComponent(token)}`,
    detail: `Connected through NodePort ${summary.node_port}.`,
  };
}

export async function resolveJupyterRouteSession(accessToken) {
  const routeAccess = await getJupyterRouteAccess(accessToken);
  if (!routeAccess?.username) {
    throw new Error("Jupyter route access is invalid or expired.");
  }

  const identity = buildLabIdentity(routeAccess.username);
  const summary = await readLabSessionSummary(routeAccess.username);
  if (!summary?.ready) {
    throw new Error("JupyterLab is not ready yet.");
  }

  return {
    username: routeAccess.username,
    pod_name: identity.pod_name,
    token: buildSessionToken(config.jupyterToken, identity.session_id),
    expires_at: routeAccess.expires_at,
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
