import crypto from "node:crypto";

const USERNAME_PATTERN = /^[a-z0-9._@-]+$/;

export function canonicalUsername(username) {
  const normalized = String(username || "").trim().toLowerCase();
  if (normalized.length < 2 || normalized.length > 48) {
    throw new Error("username must be between 2 and 48 characters");
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error("username may contain only letters, numbers, dot, underscore, dash, and @");
  }
  return normalized;
}

export function buildSessionId(username) {
  const slug = canonicalUsername(username).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "user";
  const digest = crypto.createHash("sha1").update(canonicalUsername(username)).digest("hex").slice(0, 8);
  return `${slug}-${digest}`;
}

export function buildLabIdentity(username) {
  const normalized = canonicalUsername(username);
  const sessionId = buildSessionId(normalized);
  return {
    username: normalized,
    session_id: sessionId,
    pod_name: `lab-${sessionId}`,
    service_name: `lab-${sessionId}`,
    workspace_subpath: `users/${sessionId}`,
  };
}

export function buildSessionToken(seed, sessionId) {
  return crypto.createHash("sha256").update(`${seed}:${sessionId}`).digest("hex").slice(0, 24);
}
