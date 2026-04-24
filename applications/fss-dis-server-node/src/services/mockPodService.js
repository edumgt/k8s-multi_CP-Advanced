import { getMongoDb } from "./db.js";
import { canonicalUsername } from "../utils/labIdentity.js";

function toMockPodItem(doc = {}) {
  return {
    username: String(doc.username || ""),
    pod_name: String(doc.pod_name || ""),
    namespace: String(doc.namespace || ""),
    status: String(doc.status || "Unknown"),
    ready: Boolean(doc.ready),
    image: String(doc.image || ""),
    source: String(doc.source || "mock"),
    created_at: doc.created_at || null,
    updated_at: doc.updated_at || null,
  };
}

export async function listUserMockPods(username) {
  const normalized = canonicalUsername(username);
  const db = getMongoDb();
  if (!db) {
    return [];
  }

  const docs = await db
    .collection("mock_user_pods")
    .find({ username: normalized })
    .sort({ created_at: -1, pod_name: 1 })
    .toArray();

  return docs.map(toMockPodItem);
}
