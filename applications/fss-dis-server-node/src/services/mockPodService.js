import { config } from "../config.js";
import { getMongoDb } from "./db.js";
import { canonicalUsername } from "../utils/labIdentity.js";

function toMockPodItem(doc = {}) {
  const status = String(doc.status || doc.phase || "Unknown");
  return {
    username: String(doc.username || doc.userId || ""),
    pod_name: String(doc.pod_name || doc.podName || ""),
    namespace: String(doc.namespace || config.k8sUserNamespace || "dis"),
    status,
    ready: Boolean(doc.ready ?? /^running$/i.test(status)),
    image: String(doc.image || doc.containerImageName || ""),
    source: String(doc.source || "userpods"),
    created_at: doc.created_at || doc.createdAt || null,
    updated_at: doc.updated_at || doc.updatedAt || null,
  };
}

export async function listUserMockPods(username) {
  const normalized = canonicalUsername(username);
  const db = getMongoDb();
  if (!db) {
    return [];
  }

  const docs = await db
    .collection("userpods")
    .find({ $or: [{ username: normalized }, { userId: normalized }] })
    .sort({ updatedAt: -1, createdAt: -1, podName: 1, pod_name: 1 })
    .toArray();

  return docs.map(toMockPodItem);
}
