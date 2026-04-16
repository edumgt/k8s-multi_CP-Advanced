import { getAuthSession } from "../services/authService.js";
import { canonicalUsername } from "../utils/labIdentity.js";

function resolveAuthToken(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.trim()) {
    const raw = authorization.trim();
    const parts = raw.split(" ", 2);
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer" && parts[1]) {
      return parts[1].trim();
    }
    return raw;
  }
  const xAuthToken = req.headers["x-auth-token"];
  if (typeof xAuthToken === "string" && xAuthToken.trim()) {
    return xAuthToken.trim();
  }
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = resolveAuthToken(req);
    const session = await getAuthSession(token);
    if (!session) {
      return res.status(401).json({ detail: "Application login required." });
    }
    req.authToken = token;
    req.currentUser = {
      token,
      username: session.username,
      role: session.role,
      display_name: session.display_name,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== "admin") {
    return res.status(403).json({ detail: "Admin role required." });
  }
  return next();
}

export function authorizeUsernameAccess(req, res, next) {
  try {
    const normalized = canonicalUsername(req.params.username || "");
    if (req.currentUser?.role === "admin") {
      req.targetUsername = normalized;
      return next();
    }
    if (req.currentUser?.username !== normalized) {
      return res.status(403).json({ detail: "You can only access your own Jupyter sandbox." });
    }
    req.targetUsername = normalized;
    return next();
  } catch (error) {
    return res.status(400).json({ detail: error.message });
  }
}

export { resolveAuthToken };
