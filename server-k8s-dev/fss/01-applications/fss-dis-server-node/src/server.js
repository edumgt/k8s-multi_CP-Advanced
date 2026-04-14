import http from "node:http";
import crypto from "node:crypto";

import cors from "cors";
import express from "express";
import { Server as SocketIOServer } from "socket.io";

import { config } from "./config.js";
import { requireAdmin, requireAuth, authorizeUsernameAccess, resolveAuthToken } from "./middleware/auth.js";
import { connectMongo, connectRedis, getMongoReadyState, getRedis, closeAllConnections } from "./services/db.js";
import {
  authenticate,
  createManagedUser,
  currentSessionSeconds,
  deleteAuthSession,
  ensureDefaultUsers,
  getAuthSession,
  getUserMetric,
  listUsers,
  recordDemoLogin,
  storeAuthSession,
} from "./services/authService.js";
import {
  ensureDefaultEnvironment,
  getUserLabPolicy,
  listAnalysisEnvironments,
  listEnvironmentRequests,
  listResourceRequests,
  reviewEnvironmentRequest,
  reviewResourceRequest,
  submitEnvironmentRequest,
  submitResourceRequest,
  upsertAnalysisEnvironment,
} from "./services/governanceService.js";
import { buildConnectResponse, deleteLabSession, ensureLabSession, getLabSession, getSnapshotStatus, publishSnapshot } from "./services/sessionService.js";
import { buildAdminOverview, buildUserUsage } from "./services/usageService.js";
import { readControlPlaneDashboard } from "./services/k8sService.js";
import { canonicalUsername } from "./utils/labIdentity.js";
import { toDemoUserInfo } from "./utils/formatters.js";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
  },
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS origin is not allowed"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function emitGovernanceEvent(event, payload) {
  io.emit(event, payload);
  if (payload?.username) {
    io.to(`user:${payload.username}`).emit(event, payload);
  }
}

const controlPlaneTokens = new Map();

function buildDashboardPayload() {
  return {
    runtime: {
      backend: "Node 22 + Express 5 + Socket.io + Mongoose + Redis session",
      frontend: "Node 22 + Vue3 + Quasar SPA + Axios + Chartjs",
      orchestration: "Kubernetes dynamic route + named pod + headless service",
      storage: "Per-user PVC with requested quota",
    },
    services: [
      {
        name: "backend",
        kind: "api",
        endpoint: "http://fss-dis-server.app.svc.cluster.local:3000",
        ok: true,
        detail: "Node.js ADW API service ready",
      },
      {
        name: "mongodb",
        kind: "database",
        endpoint: "mongodb://mongo.infra.svc.cluster.local:27017",
        ok: true,
        detail: "Stores users, approval requests, assignments, and usage summaries",
      },
      {
        name: "redis",
        kind: "cache",
        endpoint: "redis://redis.infra.svc.cluster.local:6379",
        ok: true,
        detail: "Stores login sessions and low-latency state lookups",
      },
      {
        name: "jupyter",
        kind: "workbench",
        endpoint: `${config.jupyterDynamicScheme}://*.${config.jupyterDynamicHostSuffix}`,
        ok: true,
        detail: "Per-user named pod routing through wildcard ingress",
      },
    ],
    quick_links: [
      {
        name: "User Governance",
        url: "#governance",
        description: "Request resources and analysis environment approvals.",
      },
      {
        name: "Admin Governance",
        url: "#admin-governance",
        description: "Review user requests and register images.",
      },
      {
        name: "Control Plane",
        url: "#control-plane",
        description: "View node and pod health in Kubernetes.",
      },
    ],
    sample_queries: [
      {
        name: "Node Runtime",
        description: "Verify Node backend migration health.",
        sql: "SELECT 'node-backend' AS runtime, 'ok' AS status",
      },
    ],
    notebooks: [],
    teradata: {
      enabled: false,
      note: "This backend focuses on Jupyter governance. ELT/Teradata APIs are handled by dataxflow backend.",
    },
  };
}

function parseRoleScopedUsername(req, usernameInBody) {
  const normalized = canonicalUsername(usernameInBody || "");
  if (req.currentUser.role === "admin") return normalized;
  if (req.currentUser.username !== normalized) {
    throw new Error("You can only access your own Jupyter sandbox.");
  }
  return normalized;
}

app.get(
  "/healthz",
  asyncHandler(async (_req, res) => {
    const mongoOk = getMongoReadyState() === 1;
    let redisOk = false;
    try {
      const redis = getRedis();
      if (redis.status !== "ready") {
        await redis.connect();
      }
      await redis.ping();
      redisOk = true;
    } catch {
      redisOk = false;
    }

    res.json({
      status: mongoOk && redisOk ? "ok" : "degraded",
      backend_version: "0.1.0-node-migration",
      checks: {
        mongodb: { ok: mongoOk, detail: mongoOk ? "ping ok" : "mongodb not connected" },
        redis: { ok: redisOk, detail: redisOk ? "ping ok" : "redis unavailable" },
      },
    });
  }),
);

app.get("/livez", (_req, res) => {
  res.json({ status: "ok", backend_version: "0.1.0-node-migration" });
});

app.get(
  "/api/demo-users",
  asyncHandler(async (_req, res) => {
    const users = await listUsers();
    res.json({ items: users.map(toDemoUserInfo) });
  }),
);

app.get(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await listUsers();
    res.json({ items: users.map(toDemoUserInfo) });
  }),
);

app.post(
  "/api/admin/users",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const created = await createManagedUser({
      username: req.body?.username,
      password: req.body?.password,
      role: req.body?.role || "user",
      displayName: req.body?.display_name || req.body?.username,
    });
    res.json(toDemoUserInfo(created));
  }),
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const user = await authenticate(req.body?.username, req.body?.password);
    const session = await storeAuthSession(user);
    await recordDemoLogin(user.username);
    res.json({
      access_token: session.token,
      token_type: "bearer",
      expires_in: session.expires_in,
      token: session.token,
      user: toDemoUserInfo(user),
    });
  }),
);

app.get(
  "/api/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: {
        username: req.currentUser.username,
        role: req.currentUser.role,
        display_name: req.currentUser.display_name,
      },
    });
  }),
);

app.post(
  "/api/auth/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteAuthSession(req.authToken);
    res.json({ status: "ok" });
  }),
);

app.get("/api/dashboard", (_req, res) => {
  res.json(buildDashboardPayload());
});

app.post("/api/teradata/query", (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.body?.limit || 20)));
  const sql = String(req.body?.sql || "").trim() || "SELECT 1";
  res.json({
    columns: ["runtime", "status", "echo_sql", "limit"],
    rows: [{ runtime: "node-backend", status: "ok", echo_sql: sql.slice(0, 300), limit }],
    source: "mock",
    note: "Node migration backend currently returns mocked ANSI query results.",
  });
});

app.get(
  "/api/admin/analysis-environments",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const includeInactive = String(req.query.include_inactive || "true").toLowerCase() !== "false";
    const items = await listAnalysisEnvironments(includeInactive);
    res.json({ items });
  }),
);

app.get(
  "/api/analysis-environments",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const items = await listAnalysisEnvironments(false);
    res.json({ items });
  }),
);

app.post(
  "/api/admin/analysis-environments",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const items = await upsertAnalysisEnvironment(req.body || {}, req.currentUser.username);
    emitGovernanceEvent("analysis_env.updated", { updated_by: req.currentUser.username });
    res.json({ items });
  }),
);

app.post(
  "/api/resource-requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = await submitResourceRequest(req.currentUser.username, req.body || {});
    emitGovernanceEvent("resource_request.submitted", item);
    res.json(item);
  }),
);

app.get(
  "/api/resource-requests/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await listResourceRequests({ username: req.currentUser.username });
    res.json({ items });
  }),
);

app.get(
  "/api/admin/resource-requests",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const items = await listResourceRequests();
    res.json({ items });
  }),
);

app.post(
  "/api/admin/resource-requests/:request_id/review",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const item = await reviewResourceRequest(
      req.params.request_id,
      Boolean(req.body?.approved),
      req.currentUser.username,
      req.body?.note || "",
    );
    emitGovernanceEvent("resource_request.reviewed", item);
    res.json(item);
  }),
);

app.post(
  "/api/environment-requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = await submitEnvironmentRequest(req.currentUser.username, req.body || {});
    emitGovernanceEvent("environment_request.submitted", item);
    res.json(item);
  }),
);

app.get(
  "/api/environment-requests/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await listEnvironmentRequests({ username: req.currentUser.username });
    res.json({ items });
  }),
);

app.get(
  "/api/admin/environment-requests",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const items = await listEnvironmentRequests();
    res.json({ items });
  }),
);

app.post(
  "/api/admin/environment-requests/:request_id/review",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const item = await reviewEnvironmentRequest(
      req.params.request_id,
      Boolean(req.body?.approved),
      req.currentUser.username,
      req.body?.note || "",
    );
    emitGovernanceEvent("environment_request.reviewed", item);
    res.json(item);
  }),
);

app.get(
  "/api/users/me/lab-policy",
  requireAuth,
  asyncHandler(async (req, res) => {
    const policy = await getUserLabPolicy(req.currentUser.username);
    res.json(policy);
  }),
);

app.post(
  "/api/jupyter/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const username = parseRoleScopedUsername(req, req.body?.username || req.currentUser.username);
    const session = await ensureLabSession(username);
    res.json(session);
  }),
);

app.get(
  "/api/jupyter/sessions/:username",
  requireAuth,
  authorizeUsernameAccess,
  asyncHandler(async (req, res) => {
    const session = await getLabSession(req.targetUsername);
    res.json(session);
  }),
);

app.delete(
  "/api/jupyter/sessions/:username",
  requireAuth,
  authorizeUsernameAccess,
  asyncHandler(async (req, res) => {
    const summary = await deleteLabSession(req.targetUsername);
    res.json(summary);
  }),
);

app.get(
  "/api/jupyter/connect/:username",
  requireAuth,
  authorizeUsernameAccess,
  asyncHandler(async (req, res) => {
    const summary = await getLabSession(req.targetUsername);
    const payload = buildConnectResponse(summary);
    res.json(payload);
  }),
);

app.get(
  "/api/jupyter/snapshots/:username",
  requireAuth,
  authorizeUsernameAccess,
  asyncHandler(async (req, res) => {
    res.json(getSnapshotStatus(req.targetUsername));
  }),
);

app.post(
  "/api/jupyter/snapshots",
  requireAuth,
  asyncHandler(async (req, res) => {
    const username = parseRoleScopedUsername(req, req.body?.username || req.currentUser.username);
    res.json(publishSnapshot(username));
  }),
);

app.get(
  "/api/users/me/usage",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = await buildUserUsage(req.currentUser.username);
    res.json(payload);
  }),
);

app.get(
  "/api/admin/sandboxes",
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const payload = await buildAdminOverview();
    res.json(payload);
  }),
);

app.post(
  "/api/control-plane/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || "");
    const password = String(req.body?.password || "");
    if (username !== config.controlPlaneUsername || password !== config.controlPlanePassword) {
      return res.status(401).json({ detail: "Control-plane login failed." });
    }
    const token = crypto.randomBytes(24).toString("hex");
    controlPlaneTokens.set(token, { username, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
    const dashboard = await readControlPlaneDashboard(config.k8sUserNamespace);
    return res.json({ token, username, dashboard });
  }),
);

app.get(
  "/api/control-plane/dashboard",
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const namespace = String(req.query.namespace || "").trim();
    const dashboard = await readControlPlaneDashboard(namespace);
    res.json(dashboard);
  }),
);

app.post(
  "/api/admin/teradata/bootstrap",
  requireAuth,
  requireAdmin,
  (_req, res) => {
    res.status(501).json({
      detail: "This Node backend is dedicated to Jupyter governance. Use dataxflow backend for Teradata bootstrap.",
    });
  },
);

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.auth?.authToken ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
      socket.handshake.headers?.["x-auth-token"] ||
      resolveAuthToken({ headers: socket.handshake.headers });
    const session = await getAuthSession(token);
    if (!session) return next(new Error("Unauthorized"));
    socket.data.user = session;
    return next();
  } catch (error) {
    return next(error);
  }
});

io.on("connection", (socket) => {
  const username = socket.data.user?.username;
  if (username) {
    socket.join(`user:${username}`);
  }
  socket.emit("connected", {
    username: username || null,
    role: socket.data.user?.role || null,
    message: "Socket.io connected to Node ADW backend.",
  });
});

app.use((error, _req, res, _next) => {
  const status = error?.statusCode || error?.status || 500;
  const detail = error?.message || "Internal server error";
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error("[adw-server-node] uncaught error:", error);
  }
  res.status(status).json({ detail });
});

async function bootstrap() {
  await connectMongo();
  await connectRedis().catch(() => null);
  await ensureDefaultUsers();
  await ensureDefaultEnvironment();

  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[adw-server-node] listening on :${config.port}`);
  });
}

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[adw-server-node] received ${signal}, shutting down...`);
  io.close();
  server.close(async () => {
    await closeAllConnections();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[adw-server-node] bootstrap failed:", error);
  process.exit(1);
});
