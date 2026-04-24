import { config } from "../config.js";
import { getMongoDb } from "./db.js";
import { buildLabIdentity, canonicalUsername, sanitizeDnsLabel } from "../utils/labIdentity.js";

const USER_PODS_COLLECTION = "userpods";

function firstString(...values) {
  for (const value of values) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function collection() {
  const db = getMongoDb();
  return db ? db.collection(USER_PODS_COLLECTION) : null;
}

function documentToIdentity(username, doc = {}) {
  return buildLabIdentity(username, {
    session_id: firstString(doc.session_id, doc.sessionId),
    headless_service: firstString(
      doc.headless_service,
      doc.headlessService,
      doc.subdomain,
      doc.headless_name,
      config.jupyterDynamicSubdomain,
    ),
    workspace_subpath: firstString(doc.workspace_subpath, doc.workspaceSubpath),
  });
}

function identityToDocument(identity, extra = {}) {
  const image = firstString(extra.image, extra.containerImage);
  return {
    username: identity.username,
    userId: identity.username,
    session_id: identity.session_id,
    sessionId: identity.session_id,
    pod_name: identity.pod_name,
    podName: identity.pod_name,
    service_name: identity.service_name,
    serviceName: identity.service_name,
    headless_service: identity.headless_service,
    headlessService: identity.headless_service,
    subdomain: identity.headless_service,
    workspace_subpath: identity.workspace_subpath,
    workspaceSubpath: identity.workspace_subpath,
    namespace: config.k8sUserNamespace,
    containerImage: image || undefined,
    image: image || undefined,
    source: "userpods",
    created_at: extra.created_at || undefined,
    updated_at: new Date(),
    updatedAt: new Date(),
  };
}

export async function getStoredLabIdentity(username) {
  const normalized = canonicalUsername(username);
  const pods = collection();
  if (!pods) {
    return null;
  }

  const doc = await pods.findOne({ username: normalized });
  if (!doc) {
    return null;
  }

  return documentToIdentity(normalized, doc);
}

export async function persistLabIdentity(identity, extra = {}) {
  const pods = collection();
  if (!pods) return identity;

  const normalizedIdentity = buildLabIdentity(identity.username, {
    session_id: identity.session_id,
    pod_name: identity.pod_name,
    service_name: identity.service_name,
    headless_service: identity.headless_service || config.jupyterDynamicSubdomain,
    workspace_subpath: identity.workspace_subpath,
  });

  const doc = identityToDocument(normalizedIdentity, extra);

  await pods.updateOne(
    { username: normalizedIdentity.username },
    { $set: doc },
    { upsert: true },
  );

  return normalizedIdentity;
}

export async function ensureStoredLabIdentity(username, extra = {}) {
  const normalized = canonicalUsername(username);
  const identity = await getStoredLabIdentity(normalized);
  if (!identity) {
    return null;
  }
  const merged = buildLabIdentity(normalized, {
    session_id: identity.session_id,
    pod_name: identity.pod_name,
    service_name: identity.service_name,
    headless_service: sanitizeDnsLabel(identity.headless_service || config.jupyterDynamicSubdomain, config.jupyterDynamicSubdomain),
    workspace_subpath: identity.workspace_subpath,
  });
  return persistLabIdentity(merged, extra);
}
