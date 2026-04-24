import crypto from "node:crypto";

const USERNAME_PATTERN = /^[a-z0-9._@-]+$/;
const DNS_LABEL_PATTERN = /[^a-z0-9-]+/g;

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

export function sanitizeDnsLabel(value, fallback = "default") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(DNS_LABEL_PATTERN, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .slice(0, 63);
  return normalized || fallback;
}

export function buildLabIdentity(username, overrides = {}) {
  const normalized = canonicalUsername(username);
  const sessionId = sanitizeDnsLabel(overrides.session_id || buildSessionId(normalized), buildSessionId(normalized));
  const podName = sanitizeDnsLabel(overrides.pod_name || `lab-${sessionId}`, `lab-${sessionId}`);
  const serviceName = sanitizeDnsLabel(overrides.service_name || podName, podName);
  const headlessService = sanitizeDnsLabel(overrides.headless_service || "jupyter-named-pod", "jupyter-named-pod");
  return {
    username: normalized,
    session_id: sessionId,
    pod_name: podName,
    service_name: serviceName,
    headless_service: headlessService,
    workspace_subpath: String(overrides.workspace_subpath || `users/${sessionId}`),
  };
}

export function buildSessionToken(seed, sessionId) {
  return crypto.createHash("sha256").update(`${seed}:${sessionId}`).digest("hex").slice(0, 24);
}
