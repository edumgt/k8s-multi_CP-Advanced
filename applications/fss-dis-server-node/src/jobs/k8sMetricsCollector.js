import * as k8s from "@kubernetes/client-node";
import mongoose from "mongoose";

import { config } from "../config.js";

const intervalSeconds = Math.max(
  15,
  Number.parseInt(process.env.METRICS_COLLECT_INTERVAL_SECONDS || "60", 10) || 60,
);
const retentionDays = Math.max(
  1,
  Number.parseInt(process.env.METRICS_RETENTION_DAYS || "14", 10) || 14,
);
const collectionName = String(process.env.METRICS_COLLECTION_NAME || "k8s_metrics_samples");

let stopping = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function kubeApis() {
  const kc = new k8s.KubeConfig();
  try {
    kc.loadFromCluster();
  } catch {
    kc.loadFromDefault();
  }
  return {
    core: kc.makeApiClient(k8s.CoreV1Api),
    custom: kc.makeApiClient(k8s.CustomObjectsApi),
  };
}

function parseCpuToMilli(value = "") {
  const raw = String(value).trim();
  if (!raw) return 0;
  if (raw.endsWith("n")) return Math.round(Number(raw.slice(0, -1)) / 1_000_000);
  if (raw.endsWith("u")) return Math.round(Number(raw.slice(0, -1)) / 1_000);
  if (raw.endsWith("m")) return Number(raw.slice(0, -1));
  return Math.round(Number(raw) * 1000);
}

function parseMemoryToBytes(value = "") {
  const raw = String(value).trim();
  if (!raw) return 0;
  const binary = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
  };
  const decimal = {
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6,
  };
  const unit = raw.match(/[a-zA-Z]+$/)?.[0] || "";
  const n = Number(raw.slice(0, raw.length - unit.length) || raw);
  if (!Number.isFinite(n)) return 0;
  if (binary[unit]) return Math.round(n * binary[unit]);
  if (decimal[unit]) return Math.round(n * decimal[unit]);
  return Math.round(n);
}

async function ensureIndexes(db) {
  const col = db.collection(collectionName);
  await col.createIndex({ sampled_at: 1 }, { expireAfterSeconds: retentionDays * 24 * 60 * 60 });
  await col.createIndex({ "summary.namespace_count": 1, sampled_at: -1 });
  return col;
}

function normalizeNodeMetric(item) {
  const usage = item?.usage || {};
  return {
    name: item?.metadata?.name || "",
    cpu_milli: parseCpuToMilli(usage.cpu),
    memory_bytes: parseMemoryToBytes(usage.memory),
  };
}

function normalizePodMetric(item) {
  const containers = Array.isArray(item?.containers) ? item.containers : [];
  const cpuMilli = containers.reduce((sum, c) => sum + parseCpuToMilli(c?.usage?.cpu), 0);
  const memBytes = containers.reduce((sum, c) => sum + parseMemoryToBytes(c?.usage?.memory), 0);
  return {
    namespace: item?.metadata?.namespace || "",
    name: item?.metadata?.name || "",
    cpu_milli: cpuMilli,
    memory_bytes: memBytes,
  };
}

async function collectOnce(apis, col) {
  const sampledAt = new Date();
  const nsRes = await apis.core.listNamespace();
  const namespaces = (nsRes.body.items || []).map((item) => item.metadata?.name).filter(Boolean);

  const nodeRes = await apis.custom.listClusterCustomObject({
    group: "metrics.k8s.io",
    version: "v1beta1",
    plural: "nodes",
  });
  const podRes = await apis.custom.listClusterCustomObject({
    group: "metrics.k8s.io",
    version: "v1beta1",
    plural: "pods",
  });

  const nodes = ((nodeRes.body && nodeRes.body.items) || []).map(normalizeNodeMetric);
  const pods = ((podRes.body && podRes.body.items) || []).map(normalizePodMetric);

  const summary = {
    namespace_count: namespaces.length,
    node_count: nodes.length,
    pod_count: pods.length,
    total_cpu_milli: nodes.reduce((sum, n) => sum + n.cpu_milli, 0),
    total_memory_bytes: nodes.reduce((sum, n) => sum + n.memory_bytes, 0),
  };

  await col.insertOne({
    sampled_at: sampledAt,
    namespaces,
    nodes,
    pods,
    summary,
  });

  // eslint-disable-next-line no-console
  console.log(
    `[collector] sampled_at=${sampledAt.toISOString()} nodes=${summary.node_count} pods=${summary.pod_count}`,
  );
}

async function main() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const col = await ensureIndexes(db);
  const apis = kubeApis();

  // eslint-disable-next-line no-console
  console.log(
    `[collector] started interval=${intervalSeconds}s retention_days=${retentionDays} collection=${collectionName}`,
  );

  while (!stopping) {
    try {
      await collectOnce(apis, col);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[collector] sample failed:", error?.message || error);
    }
    await sleep(intervalSeconds * 1000);
  }
}

function requestStop(signal) {
  // eslint-disable-next-line no-console
  console.log(`[collector] received ${signal}, stopping...`);
  stopping = true;
}

process.on("SIGTERM", () => requestStop("SIGTERM"));
process.on("SIGINT", () => requestStop("SIGINT"));

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[collector] fatal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
