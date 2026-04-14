"use strict";

const http = require("http");
const express = require("express");
const httpProxy = require("http-proxy");

const PORT = Number(process.env.PORT || 8080);
const ROUTER_HOST_SUFFIX = String(
  process.env.ROUTER_HOST_SUFFIX || "service.jupyter.fss.or.kr",
).toLowerCase();
const ROUTER_HEADLESS_SERVICE = String(
  process.env.ROUTER_HEADLESS_SERVICE || "jupyter-named-pod",
).toLowerCase();
const ROUTER_TARGET_NAMESPACE = String(process.env.ROUTER_TARGET_NAMESPACE || "dis").toLowerCase();
const ROUTER_TARGET_PORT = Number(process.env.ROUTER_TARGET_PORT || 8888);
const REQUEST_TIMEOUT_MS = Number(process.env.ROUTER_REQUEST_TIMEOUT_MS || 3600000);

const POD_NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

function normalizeHostHeader(value) {
  if (!value) {
    return "";
  }
  return String(value)
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
}

function extractPodNameFromHost(hostValue) {
  const host = normalizeHostHeader(hostValue);
  if (!host) {
    return null;
  }

  const expectedSuffix = `.${ROUTER_HOST_SUFFIX}`;
  if (!host.endsWith(expectedSuffix)) {
    return null;
  }

  const podName = host.slice(0, -expectedSuffix.length);
  if (!podName || podName.length > 63 || !POD_NAME_REGEX.test(podName)) {
    return null;
  }
  return podName;
}

function buildTargetUrl(podName) {
  return `http://${podName}.${ROUTER_HEADLESS_SERVICE}.${ROUTER_TARGET_NAMESPACE}.svc.cluster.local:${ROUTER_TARGET_PORT}`;
}

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
  xfwd: true,
  proxyTimeout: REQUEST_TIMEOUT_MS,
  timeout: REQUEST_TIMEOUT_MS,
});

proxy.on("error", (error, req, res) => {
  const message = error && error.message ? error.message : "upstream proxy error";
  if (res && typeof res.writeHead === "function" && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: `Jupyter pod routing failed: ${message}` }));
    return;
  }
  if (res && typeof res.end === "function" && !res.writableEnded) {
    res.end();
  }
});

const app = express();

app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    host_suffix: ROUTER_HOST_SUFFIX,
    headless_service: ROUTER_HEADLESS_SERVICE,
    target_namespace: ROUTER_TARGET_NAMESPACE,
    target_port: ROUTER_TARGET_PORT,
  });
});

app.get("/readyz", (_req, res) => {
  res.status(200).send("ok");
});

app.use((req, res) => {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = normalizeHostHeader(forwardedHost || req.headers.host);
  const podName = extractPodNameFromHost(host);
  if (!podName) {
    res.status(400).json({
      detail: `Host must match <pod>.${ROUTER_HOST_SUFFIX}`,
    });
    return;
  }
  const target = buildTargetUrl(podName);
  proxy.web(req, res, { target });
});

const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  const host = normalizeHostHeader(req.headers["x-forwarded-host"] || req.headers.host);
  const podName = extractPodNameFromHost(host);
  if (!podName) {
    socket.destroy();
    return;
  }
  const target = buildTargetUrl(podName);
  proxy.ws(req, socket, head, { target });
});

server.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`jupyter-pod-router listening on :${PORT}`);
});

