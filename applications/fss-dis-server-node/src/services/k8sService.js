import * as k8s from "@kubernetes/client-node";

import { config, isDynamicRouteMode, isIngressPathMode } from "../config.js";
import { buildSessionToken } from "../utils/labIdentity.js";

let coreApi;

function kubeClient() {
  if (coreApi) return coreApi;
  const kc = new k8s.KubeConfig();
  if (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
    kc.loadFromCluster();
  } else {
    kc.loadFromDefault();
  }
  coreApi = kc.makeApiClient(k8s.CoreV1Api);
  return coreApi;
}

function isNotFound(error) {
  const code = Number(
    error?.response?.statusCode ||
      error?.statusCode ||
      error?.status ||
      error?.body?.code ||
      error?.response?.body?.code,
  );
  if (code === 404) return true;
  const reason = String(error?.body?.reason || error?.response?.body?.reason || "");
  if (reason === "NotFound") return true;
  const message = String(error?.message || "");
  return message.includes('"reason":"NotFound"') || / not found\b/i.test(message);
}

function isTransportError(error) {
  const code = String(error?.code || error?.errno || "").toUpperCase();
  if (["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH", "ETIMEDOUT", "EPERM"].includes(code)) {
    return true;
  }
  const message = String(error?.message || "");
  return /request to https?:\/\/.* failed/i.test(message) || /Invalid URL/i.test(message);
}

function wrapK8sError(error, action) {
  if (!error || error?.statusCode || error?.status) return error;
  if (!isTransportError(error)) return error;
  const wrapped = new Error(
    `Kubernetes API is unavailable while ${action}. Check kubeconfig and cluster network access.`,
  );
  wrapped.statusCode = 503;
  wrapped.cause = error;
  return wrapped;
}

function toLabelValue(input, fallback = "unknown") {
  const normalized = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  return (normalized || fallback).slice(0, 63);
}

export async function readPod(name) {
  const api = kubeClient();
  try {
    const res = await api.readNamespacedPod({
      name,
      namespace: config.k8sUserNamespace,
    });
    return res?.body || res || null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw wrapK8sError(error, `reading pod ${name}`);
  }
}

export async function readService(name) {
  const api = kubeClient();
  try {
    const res = await api.readNamespacedService({
      name,
      namespace: config.k8sUserNamespace,
    });
    return res?.body || res || null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw wrapK8sError(error, `reading service ${name}`);
  }
}

export async function ensureUserHomePvc(identity, diskGi) {
  const api = kubeClient();
  const pvcName = `lab-home-${identity.session_id}`.slice(0, 63);

  try {
    await api.readNamespacedPersistentVolumeClaim({
      namespace: config.k8sUserNamespace,
      name: pvcName,
    });
    return pvcName;
  } catch (error) {
    if (!isNotFound(error)) throw wrapK8sError(error, `reading PVC ${pvcName}`);
  }

  const body = {
    metadata: {
      name: pvcName,
      labels: {
        "app.kubernetes.io/component": "jupyter-user-home",
        "platform.dev/username": toLabelValue(identity.username, identity.session_id),
      },
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: {
        requests: {
          storage: `${Math.max(1, Number(diskGi || 1))}Gi`,
        },
      },
    },
  };

  if (config.jupyterUserPvcStorageClass) {
    body.spec.storageClassName = config.jupyterUserPvcStorageClass;
  }

  try {
    await api.createNamespacedPersistentVolumeClaim({
      namespace: config.k8sUserNamespace,
      body,
    });
  } catch (error) {
    throw wrapK8sError(error, `creating PVC ${pvcName}`);
  }

  return pvcName;
}

function podReady(pod) {
  const conditions = pod?.status?.conditions || [];
  return conditions.some((item) => item.type === "Ready" && item.status === "True");
}

function podPhase(pod) {
  return pod?.status?.phase || "Missing";
}

function podContainerDetail(pod) {
  const statuses = pod?.status?.containerStatuses || [];
  for (const status of statuses) {
    if (status.ready) continue;
    const waiting = status?.state?.waiting;
    if (waiting) {
      return `${waiting.reason || "Waiting"}: ${waiting.message || "container is starting"}`;
    }
    const terminated = status?.state?.terminated;
    if (terminated) {
      return `${terminated.reason || "Terminated"}: ${terminated.message || "container terminated"}`;
    }
  }
  return null;
}

export function buildSessionSummary({ identity, pod, service, launchImage }) {
  const routed = isDynamicRouteMode() || isIngressPathMode();
  const phase = podPhase(pod);
  const ready = podReady(pod);

  const nodePort = routed
    ? null
    : service?.spec?.ports?.find((p) => p.port === 8888)?.nodePort || null;

  let status = "provisioning";
  let detail = "JupyterLab pod is being prepared.";

  if (!pod) {
    status = "missing";
    detail = "No personal JupyterLab session exists yet.";
  } else if (phase === "Failed") {
    status = "failed";
    detail = podContainerDetail(pod) || "Pod failed to start.";
  } else if (ready && routed) {
    status = "ready";
    detail = isIngressPathMode()
      ? "JupyterLab is ready on protected ingress path /jupyter."
      : `JupyterLab is ready on dynamic route ${identity.pod_name}.${config.jupyterDynamicHostSuffix}.`;
  } else if (ready && nodePort) {
    status = "ready";
    detail = `JupyterLab is ready on NodePort ${nodePort}.`;
  } else {
    status = "provisioning";
    detail = podContainerDetail(pod) || "JupyterLab pod is being prepared.";
  }

  return {
    session_id: identity.session_id,
    username: identity.username,
    namespace: config.k8sUserNamespace,
    pod_name: identity.pod_name,
    service_name: identity.service_name,
    workspace_subpath: identity.workspace_subpath,
    image: pod?.spec?.containers?.[0]?.image || launchImage,
    status,
    phase,
    ready: routed ? ready : ready && Boolean(nodePort),
    detail,
    node_port: ready && !routed ? nodePort : null,
    created_at: pod?.metadata?.creationTimestamp || null,
  };
}

function buildRestoreScript(workspaceSubpath, launchImage, useWorkspaceSubpath = true) {
  const workspaceTarget = useWorkspaceSubpath
    ? `/workspace-volume/${workspaceSubpath}`
    : "/workspace-volume";
  return [
    "set -eu",
    'chmod -R 0777 "/workspace-volume" 2>/dev/null || true',
    `workspace_dir="${workspaceTarget}"`,
    'mkdir -p "${workspace_dir}"',
    `if [ -z "$(find "${workspaceTarget}" -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1)" ] && [ -d "${config.jupyterBootstrapDir}" ]; then cp -a ${config.jupyterBootstrapDir}/. "${workspaceTarget}"/ 2>/dev/null || true; fi`,
    'mkdir -p "${workspace_dir}/.platform"',
    `printf '%s\\n' '${launchImage}' > "${workspaceTarget}/.platform/launch-image"`,
  ].join("\n");
}

function podLaunchImage(pod) {
  return String(pod?.spec?.containers?.[0]?.image || "").trim();
}

export async function createOrEnsureSessionPod({ identity, launchProfile }) {
  const api = kubeClient();
  const routed = isDynamicRouteMode() || isIngressPathMode();
  const ingressPathMode = isIngressPathMode();
  const jupyterBaseUrl = ingressPathMode ? "/jupyter" : "/";
  const probePath = ingressPathMode ? `${jupyterBaseUrl}/lab` : "/lab";
  const podName = identity.pod_name;

  let pod = await readPod(podName);
  const desiredImage = String(launchProfile.image || "").trim();
  const currentImage = podLaunchImage(pod);
  if (pod && desiredImage && currentImage && currentImage !== desiredImage) {
    try {
      await api.deleteNamespacedPod({ name: podName, namespace: config.k8sUserNamespace });
    } catch (error) {
      throw wrapK8sError(error, `deleting pod ${podName}`);
    }
    pod = null;
  }
  if (pod && ["Failed", "Succeeded"].includes(String(pod?.status?.phase || ""))) {
    try {
      await api.deleteNamespacedPod({ name: podName, namespace: config.k8sUserNamespace });
    } catch (error) {
      throw wrapK8sError(error, `deleting pod ${podName}`);
    }
    pod = null;
  }

  if (!pod) {
    const podBody = {
      metadata: {
        name: podName,
        labels: {
          app: "jupyter-session",
          "app.kubernetes.io/name": "jupyter-session",
          "app.kubernetes.io/managed-by": "fss-dis-server-node",
          "app.kubernetes.io/component": routed ? "user-jupyter" : "jupyter-session",
          "platform.dev/session-id": identity.session_id,
        },
        annotations: {
          "platform.dev/username": identity.username,
          "platform.dev/workspace-subpath": identity.workspace_subpath,
          "platform.dev/launch-image": launchProfile.image,
          "platform.dev/workspace-pvc": launchProfile.pvc_name,
        },
      },
      spec: {
        restartPolicy: "Always",
        terminationGracePeriodSeconds: 15,
        hostname: routed ? podName : undefined,
        subdomain: routed ? config.jupyterDynamicSubdomain : undefined,
        initContainers: [
          {
            name: "restore-workspace",
            image: launchProfile.image,
            imagePullPolicy: "IfNotPresent",
            securityContext: {
              runAsUser: 0,
              runAsGroup: 0,
            },
            command: [
              "/bin/sh",
              "-c",
              buildRestoreScript(
                identity.workspace_subpath,
                launchProfile.image,
                launchProfile.use_workspace_subpath,
              ),
            ],
            env: [
              { name: "JUPYTER_ROOT_DIR", value: config.jupyterWorkspaceRoot },
              { name: "JUPYTER_BOOTSTRAP_DIR", value: config.jupyterBootstrapDir },
            ],
            volumeMounts: [{ name: "jupyter-workspace", mountPath: "/workspace-volume" }],
          },
        ],
        containers: [
          {
            name: "jupyter",
            image: launchProfile.image,
            imagePullPolicy: "IfNotPresent",
            ports: [{ containerPort: 8888 }],
            env: [
              {
                name: "JUPYTER_TOKEN",
                value: buildSessionToken(config.jupyterToken, identity.session_id),
              },
              { name: "JUPYTER_ROOT_DIR", value: config.jupyterWorkspaceRoot },
              { name: "JUPYTER_BOOTSTRAP_DIR", value: config.jupyterBootstrapDir },
              { name: "JUPYTER_BASE_URL", value: jupyterBaseUrl },
              { name: "PLATFORM_LAB_USERNAME", value: identity.username },
              { name: "PLATFORM_LAB_SESSION_ID", value: identity.session_id },
              ...Object.entries(launchProfile.extra_env || {}).map(([name, value]) => ({
                name,
                value: String(value),
              })),
            ],
            resources: {
              requests: {
                cpu: launchProfile.cpu_request,
                memory: launchProfile.memory_request,
              },
              limits: {
                cpu: launchProfile.cpu_limit,
                memory: launchProfile.memory_limit,
              },
            },
            volumeMounts: [
              {
                name: "jupyter-workspace",
                mountPath: config.jupyterWorkspaceRoot,
                subPath: launchProfile.use_workspace_subpath
                  ? identity.workspace_subpath
                  : undefined,
              },
            ],
            readinessProbe: {
              httpGet: { path: probePath, port: 8888 },
              initialDelaySeconds: 5,
              periodSeconds: 5,
              timeoutSeconds: 2,
              failureThreshold: 18,
            },
            livenessProbe: {
              httpGet: { path: probePath, port: 8888 },
              initialDelaySeconds: 20,
              periodSeconds: 10,
              timeoutSeconds: 2,
              failureThreshold: 6,
            },
          },
        ],
        volumes: [
          {
            name: "jupyter-workspace",
            persistentVolumeClaim: {
              claimName: launchProfile.pvc_name,
            },
          },
        ],
      },
    };

    try {
      await api.createNamespacedPod({
        namespace: config.k8sUserNamespace,
        body: podBody,
      });
    } catch (error) {
      throw wrapK8sError(error, `creating pod ${podName}`);
    }
  }

  if (!routed) {
    const service = await readService(identity.service_name);
    if (!service) {
      try {
        await api.createNamespacedService({
          namespace: config.k8sUserNamespace,
          body: {
            metadata: {
              name: identity.service_name,
              labels: {
                app: "jupyter-session",
                "platform.dev/session-id": identity.session_id,
              },
            },
            spec: {
              type: "NodePort",
              selector: {
                "platform.dev/session-id": identity.session_id,
              },
              ports: [{ name: "http", port: 8888, targetPort: 8888, protocol: "TCP" }],
            },
          },
        });
      } catch (error) {
        throw wrapK8sError(error, `creating service ${identity.service_name}`);
      }
    }
  }

  return {
    pod: await readPod(podName),
    service: routed ? null : await readService(identity.service_name),
  };
}

export async function deleteSessionPod(identity) {
  const api = kubeClient();
  try {
    await api.deleteNamespacedPod({
      name: identity.pod_name,
      namespace: config.k8sUserNamespace,
    });
  } catch (error) {
    if (!isNotFound(error)) throw wrapK8sError(error, `deleting pod ${identity.pod_name}`);
  }

  if (!isDynamicRouteMode() && !isIngressPathMode()) {
    try {
      await api.deleteNamespacedService({
        name: identity.service_name,
        namespace: config.k8sUserNamespace,
      });
    } catch (error) {
      if (!isNotFound(error)) throw wrapK8sError(error, `deleting service ${identity.service_name}`);
    }
  }
}

export async function readControlPlaneDashboard(namespace = "") {
  const api = kubeClient();

  let nsRes;
  let nodeRes;
  let podsRes;
  try {
    nsRes = await api.listNamespace();
    nodeRes = await api.listNode();
    podsRes = namespace
      ? await api.listNamespacedPod({ namespace })
      : await api.listPodForAllNamespaces();
  } catch (error) {
    throw wrapK8sError(error, "reading control-plane dashboard");
  }

  const namespaces = (nsRes.body.items || [])
    .map((ns) => ns.metadata?.name)
    .filter(Boolean)
    .sort();

  const nodes = (nodeRes.body.items || []).map((node) => {
    const labels = node.metadata?.labels || {};
    const conditions = node.status?.conditions || [];
    const readyCondition = conditions.find((item) => item.type === "Ready");

    const roleKeys = Object.keys(labels).filter((key) =>
      key.startsWith("node-role.kubernetes.io/"),
    );
    const roles = roleKeys.length
      ? roleKeys.map((key) => key.split("/")[1] || "worker")
      : [labels["kubernetes.io/role"] || "worker"];

    const internalIp =
      (node.status?.addresses || []).find((a) => a.type === "InternalIP")?.address || "";

    return {
      name: node.metadata?.name || "",
      ready: readyCondition?.status === "True",
      roles: roles.join(","),
      version: node.status?.nodeInfo?.kubeletVersion || "",
      internal_ip: internalIp,
      os_image: node.status?.nodeInfo?.osImage || "",
      kernel_version: node.status?.nodeInfo?.kernelVersion || "",
      container_runtime: node.status?.nodeInfo?.containerRuntimeVersion || "",
      created_at: node.metadata?.creationTimestamp || null,
    };
  });

  const pods = (podsRes.body.items || []).map((pod) => {
    const statuses = pod.status?.containerStatuses || [];
    const readyCount = statuses.filter((s) => s.ready).length;
    return {
      namespace: pod.metadata?.namespace || "",
      name: pod.metadata?.name || "",
      ready: `${readyCount}/${statuses.length}`,
      status: pod.status?.phase || "Unknown",
      restarts: statuses.reduce((sum, s) => sum + Number(s.restartCount || 0), 0),
      node_name: pod.spec?.nodeName || "-",
      pod_ip: pod.status?.podIP || null,
      created_at: pod.metadata?.creationTimestamp || null,
    };
  });

  const resolvedNamespace = namespace || config.k8sUserNamespace;

  return {
    summary: {
      cluster_name: "Kubernetes control plane",
      cluster_version: nodes[0]?.version || "unknown",
      current_namespace: resolvedNamespace,
      namespace_count: namespaces.length,
      node_count: nodes.length,
      ready_node_count: nodes.filter((n) => n.ready).length,
      pod_count: pods.length,
      running_pod_count: pods.filter((p) => p.status === "Running").length,
    },
    namespaces,
    nodes,
    pods,
  };
}
