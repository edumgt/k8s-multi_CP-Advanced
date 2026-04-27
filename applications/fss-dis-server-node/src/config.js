import dotenv from "dotenv";

dotenv.config();

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBasePath(value, fallback = "/") {
  const raw = String(value || fallback).trim();
  if (!raw || raw === "/") return "/";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

export const config = {
  port: parseNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  appName: process.env.APP_NAME || "fss-dis-server-node",
  backendBasePath: normalizeBasePath(process.env.BACKEND_BASE_PATH, "/fss-dis-server"),
  mongoUri:
    process.env.MONGO_URI ||
    "mongodb://root:root-password@mongo.infra.svc.cluster.local:27017/adw?authSource=admin",
  redisUrl:
    process.env.REDIS_URL ||
    "redis://root:root-password@redis.infra.svc.cluster.local:6379/0",
  authTokenTtlSeconds: parseNumber(process.env.AUTH_TOKEN_TTL_SECONDS, 8 * 60 * 60),
  authSessionPrefix: process.env.AUTH_SESSION_PREFIX || "fss:auth:session:",
  jupyterRouteAccessTtlSeconds: parseNumber(
    process.env.JUPYTER_ROUTE_ACCESS_TTL_SECONDS,
    8 * 60 * 60,
  ),
  jupyterRouteAccessPrefix:
    process.env.JUPYTER_ROUTE_ACCESS_PREFIX || "fss:jupyter:route:",
  jupyterRouterSharedSecret:
    process.env.JUPYTER_ROUTER_SHARED_SECRET || "change-this-jupyter-router-secret",
  corsOrigins: splitCsv(process.env.CORS_ORIGINS || "http://192.168.56.240,http://platform.local"),

  k8sUserNamespace: process.env.K8S_USER_NAMESPACE || "dis",
  k8sAppNamespace: process.env.K8S_APP_NAMESPACE || "app",
  labGovernanceEnabled: parseBool(process.env.LAB_GOVERNANCE_ENABLED, true),
  jupyterImage:
    process.env.JUPYTER_IMAGE ||
    `${(process.env.HARBOR_REGISTRY || "192.168.56.32").replace(/\/+$/, "")}/${(
      process.env.HARBOR_PROJECT || "app"
    ).replace(/^\/+|\/+$/g, "")}/jupyter:latest`,
  jupyterAccessMode: process.env.JUPYTER_ACCESS_MODE || "ingress-path",
  jupyterDynamicHostSuffix: process.env.JUPYTER_DYNAMIC_HOST_SUFFIX || "platform.local",
  jupyterDynamicScheme: process.env.JUPYTER_DYNAMIC_SCHEME || "http",
  jupyterDynamicSubdomain: process.env.JUPYTER_DYNAMIC_SUBDOMAIN || "jupyter-named-pod",
  jupyterPublicBaseUrl: process.env.JUPYTER_PUBLIC_BASE_URL || "",
  jupyterToken: process.env.JUPYTER_TOKEN || "platform123",
  jupyterWorkspaceRoot: process.env.JUPYTER_WORKSPACE_ROOT || "/workspace/user-home",
  jupyterBootstrapDir: process.env.JUPYTER_BOOTSTRAP_DIR || "/opt/platform/bootstrap-workspace",
  jupyterUserPvcStorageClass: process.env.JUPYTER_USER_PVC_STORAGE_CLASS || "",
  jupyterPersonalMountPath: process.env.JUPYTER_PERSONAL_MOUNT_PATH || "/personal",
  jupyterPersonalNfsServer: process.env.JUPYTER_PERSONAL_NFS_SERVER || "",
  jupyterPersonalNfsBasePath: process.env.JUPYTER_PERSONAL_NFS_BASE_PATH || "",
  jupyterPersonalDiskGi: parseNumber(process.env.JUPYTER_PERSONAL_DISK_GI, 5),
  jupyterPersonalInitImage: process.env.JUPYTER_PERSONAL_INIT_IMAGE || "",

  controlPlaneUsername: process.env.CONTROL_PLANE_USERNAME || "admin@test.com",
  controlPlanePassword: process.env.CONTROL_PLANE_PASSWORD || "123456",

  harborRegistry: process.env.HARBOR_REGISTRY || "192.168.56.32",
  harborProject: process.env.HARBOR_PROJECT || "app",

  frontendUrl: process.env.FRONTEND_URL || "http://platform.local",
  airflowUrl: process.env.AIRFLOW_URL || "",
};

export function isDynamicRouteMode() {
  const mode = String(config.jupyterAccessMode || "dynamic-route").toLowerCase().trim();
  return ["dynamic-route", "dynamic_route", "dynamic", "wildcard"].includes(mode);
}

export function isIngressPathMode() {
  const mode = String(config.jupyterAccessMode || "dynamic-route").toLowerCase().trim();
  return ["ingress-path", "ingress_path", "path-route", "path_route"].includes(mode);
}
