import crypto from "node:crypto";

import bcrypt from "bcryptjs";

import { config } from "../config.js";
import { User, UserMetric } from "../models/index.js";
import { getRedis } from "./db.js";

const memorySessions = new Map();

function sessionKey(token) {
  return `${config.authSessionPrefix}${token}`;
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password), 12);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(String(password), String(passwordHash));
}

export async function ensureDefaultUsers() {
  const defaults = [
    { username: "admin@test.com", password: "123456", role: "admin", displayName: "Platform Admin" },
    { username: "test1@test.com", password: "123456", role: "user", displayName: "Test User 1" },
  ];

  for (const item of defaults) {
    const existing = await User.findOne({ username: item.username }).lean();
    if (!existing) {
      const passwordHash = await hashPassword(item.password);
      await User.create({
        username: item.username,
        passwordHash,
        role: item.role,
        displayName: item.displayName,
        builtIn: true,
      });
    }
  }
}

export async function listUsers() {
  return User.find({}).sort({ username: 1 });
}

export async function createManagedUser({ username, password, role, displayName }) {
  const normalized = String(username || "").trim().toLowerCase();
  const normalizedRole = String(role || "user").trim().toLowerCase();
  if (!["user", "admin"].includes(normalizedRole)) {
    throw new Error("role must be either 'user' or 'admin'.");
  }
  const exists = await User.findOne({ username: normalized }).lean();
  if (exists) {
    throw new Error("username already exists.");
  }

  const passwordHash = await hashPassword(password);
  return User.create({
    username: normalized,
    passwordHash,
    role: normalizedRole,
    displayName: String(displayName || normalized).trim() || normalized,
    builtIn: false,
  });
}

export async function findUser(username) {
  return User.findOne({ username: String(username || "").trim().toLowerCase() });
}

export async function authenticate(username, password) {
  const user = await findUser(username);
  if (!user) {
    throw new Error("Invalid username or password.");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new Error("Invalid username or password.");
  }
  return user;
}

export async function storeAuthSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.authTokenTtlSeconds * 1000);
  const payload = {
    token,
    username: user.username,
    role: user.role,
    display_name: user.displayName,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    expires_in: config.authTokenTtlSeconds,
  };

  const redis = getRedis();
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    await redis.setex(sessionKey(token), config.authTokenTtlSeconds, JSON.stringify(payload));
  } catch {
    memorySessions.set(token, payload);
  }
  return payload;
}

export async function getAuthSession(token) {
  if (!token) return null;
  const redis = getRedis();
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    const raw = await redis.get(sessionKey(token));
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through
  }

  const row = memorySessions.get(token);
  if (!row) return null;

  const expiresAt = new Date(row.expires_at);
  if (expiresAt.valueOf() <= Date.now()) {
    memorySessions.delete(token);
    return null;
  }
  return row;
}

export async function deleteAuthSession(token) {
  if (!token) return;
  const redis = getRedis();
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    await redis.del(sessionKey(token));
  } catch {
    memorySessions.delete(token);
  }
}

function secondsBetween(a, b = new Date()) {
  if (!a) return 0;
  const start = new Date(a);
  if (Number.isNaN(start.valueOf())) return 0;
  return Math.max(0, Math.floor((b.valueOf() - start.valueOf()) / 1000));
}

async function loadMetric(user) {
  let metric = await UserMetric.findOne({ username: user.username });
  if (!metric) {
    metric = await UserMetric.create({
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
  }
  return metric;
}

export async function recordDemoLogin(username) {
  const user = await findUser(username);
  if (!user) return null;
  const metric = await loadMetric(user);
  metric.loginCount += 1;
  metric.lastLoginAt = new Date();
  metric.displayName = user.displayName;
  metric.role = user.role;
  await metric.save();
  return metric;
}

export async function recordLabLaunch(username, createdAt = null) {
  const user = await findUser(username);
  if (!user) return null;
  const metric = await loadMetric(user);
  const started = createdAt ? new Date(createdAt) : new Date();
  metric.launchCount += 1;
  metric.activeSince = started;
  metric.lastLaunchAt = started;
  metric.lastSeenStatus = "provisioning";
  await metric.save();
  return metric;
}

export async function recordLabStop(username) {
  const user = await findUser(username);
  if (!user) return null;
  const metric = await loadMetric(user);
  if (metric.activeSince) {
    metric.totalSessionSeconds += secondsBetween(metric.activeSince);
  }
  metric.activeSince = null;
  metric.lastStopAt = new Date();
  metric.lastSeenStatus = "deleted";
  await metric.save();
  return metric;
}

export async function syncSessionActivity(username, sessionSummary) {
  const user = await findUser(username);
  if (!user) return null;
  const metric = await loadMetric(user);
  const status = String(sessionSummary?.status || "idle");
  const active = status === "ready" || status === "provisioning";
  const createdAt = sessionSummary?.created_at ? new Date(sessionSummary.created_at) : new Date();

  if (active) {
    if (!metric.activeSince) {
      metric.activeSince = createdAt;
    }
  } else if (metric.activeSince) {
    metric.totalSessionSeconds += secondsBetween(metric.activeSince);
    metric.activeSince = null;
    metric.lastStopAt = new Date();
  }

  metric.lastSeenStatus = status;
  metric.displayName = user.displayName;
  metric.role = user.role;
  await metric.save();
  return metric;
}

export async function getUserMetric(username) {
  const user = await findUser(username);
  if (!user) return null;
  const metric = await loadMetric(user);
  return metric;
}

export function currentSessionSeconds(metric) {
  if (!metric?.activeSince) return 0;
  return secondsBetween(metric.activeSince);
}
