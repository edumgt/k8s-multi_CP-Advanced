import { config, isDynamicRouteMode } from "../config.js";
import { buildLabIdentity } from "../utils/labIdentity.js";
import { recordLabLaunch, recordLabStop, syncSessionActivity } from "./authService.js";
import { getUserLabLaunchProfile } from "./governanceService.js";
import {
  buildSessionSummary,
  createOrEnsureSessionPod,
  deleteSessionPod,
  readPod,
  readService,
} from "./k8sService.js";

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
  const identity = buildLabIdentity(username);
  const pod = await readPod(identity.pod_name);
  const service = isDynamicRouteMode() ? null : await readService(identity.service_name);
  const summary = buildSessionSummary({
    identity,
    pod,
    service,
    launchImage: config.jupyterImage,
  });
  await syncSessionActivity(identity.username, summary);
  return summary;
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

  return summary;
}

export async function deleteLabSession(username) {
  const identity = buildLabIdentity(username);
  const summary = await getLabSession(identity.username);
  await deleteSessionPod(identity);
  await recordLabStop(identity.username);

  return {
    ...summary,
    status: "deleted",
    phase: "Deleted",
    ready: false,
    detail: "Personal JupyterLab session resources were deleted.",
    node_port: null,
    snapshot_status: "skipped",
    snapshot_job_name: null,
    snapshot_detail: "Snapshot publish is not configured in Node migration backend yet.",
  };
}

export function buildConnectResponse(summary) {
  if (!summary?.ready) {
    throw new Error("JupyterLab is not ready yet.");
  }
  if (isDynamicRouteMode()) {
    const suffix = String(config.jupyterDynamicHostSuffix || "").trim().replace(/^\.+|\.+$/g, "");
    if (!suffix) {
      throw new Error("PLATFORM_JUPYTER_DYNAMIC_HOST_SUFFIX is not configured.");
    }
    const scheme = String(config.jupyterDynamicScheme || "https").trim().toLowerCase() || "https";
    return {
      redirect_url: `${scheme}://${summary.pod_name}.${suffix}/lab?token=${encodeURIComponent(summary.token)}`,
      detail: `Connected through dynamic pod route ${summary.pod_name}.${suffix}.`,
    };
  }
  if (!summary.node_port) {
    throw new Error("NodePort is not available.");
  }
  const frontend = new URL(config.frontendUrl);
  return {
    redirect_url: `${frontend.protocol}//${frontend.hostname}:${summary.node_port}/lab?token=${encodeURIComponent(summary.token)}`,
    detail: `Connected through NodePort ${summary.node_port}.`,
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
