import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PORT || "8080");
const PATH_PREFIX = normalizePathPrefix(process.env.ROUTER_PATH_PREFIX || "/jupyter");
const HOST_SUFFIX = String(process.env.ROUTER_HOST_SUFFIX || "")
  .trim()
  .toLowerCase()
  .replace(/^\.+|\.+$/g, "");
const HEADLESS = String(process.env.ROUTER_HEADLESS_SERVICE || "jupyter-named-pod").trim().toLowerCase();
const NAMESPACE = String(process.env.ROUTER_TARGET_NAMESPACE || "dis").trim().toLowerCase();
const TARGET_PORT = Number(process.env.ROUTER_TARGET_PORT || "8888");
const BACKEND_URL = String(process.env.ROUTER_BACKEND_URL || "http://fss-dis-server.app.svc.cluster.local:3000").trim();
const SHARED_SECRET = String(process.env.ROUTER_SHARED_SECRET || "").trim();
const ACCESS_COOKIE_NAME = String(process.env.ROUTER_ACCESS_COOKIE_NAME || "jupyter_route_access").trim();

const routeCache = new Map();

function normalizePathPrefix(value) {
  const raw = String(value || "/jupyter").trim();
  if (!raw || raw === "/") return "/";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

function upstreamCandidates(pod) {
  return [
    `${pod}.${HEADLESS}.${NAMESPACE}.svc.cluster.local`,
    `${HEADLESS}.${NAMESPACE}.svc.cluster.local`,
  ];
}

function parseCookies(headerValue) {
  return String(headerValue || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const idx = item.indexOf("=");
      if (idx <= 0) return acc;
      const name = item.slice(0, idx).trim();
      const value = item.slice(idx + 1).trim();
      acc[name] = decodeURIComponent(value);
      return acc;
    }, {});
}

function stripAccessQuery(urlValue) {
  const parsed = new URL(urlValue || "/", "http://router.local");
  parsed.searchParams.delete("access");
  const search = parsed.searchParams.toString();
  return `${parsed.pathname}${search ? `?${search}` : ""}`;
}

function accessCookie(accessToken) {
  return `${ACCESS_COOKIE_NAME}=${encodeURIComponent(accessToken)}; Path=${PATH_PREFIX}; HttpOnly; SameSite=Lax`;
}

function clearAccessCookie() {
  return `${ACCESS_COOKIE_NAME}=; Path=${PATH_PREFIX}; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function appendSetCookie(headers, cookieValue) {
  const current = headers["set-cookie"];
  if (!current) {
    headers["set-cookie"] = cookieValue;
    return;
  }
  if (Array.isArray(current)) {
    headers["set-cookie"] = [...current, cookieValue];
    return;
  }
  headers["set-cookie"] = [current, cookieValue];
}

function sanitizeHeaders(headers, upstreamHost, authToken) {
  const next = { ...headers };
  delete next["content-length"];
  delete next["transfer-encoding"];
  delete next.cookie;
  next.host = upstreamHost;
  if (authToken) {
    next.authorization = `token ${authToken}`;
  }
  return next;
}

async function resolveRouteAccess(accessToken) {
  if (!accessToken) {
    throw new Error("Jupyter route access token is required.");
  }

  const cached = routeCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const endpoint = new URL("/internal/jupyter/route-session", BACKEND_URL);
  endpoint.searchParams.set("access", accessToken);

  const payload = await new Promise((resolve, reject) => {
    const req = http.request(
      endpoint,
      {
        method: "GET",
        headers: {
          "x-router-secret": SHARED_SECRET,
        },
        timeout: 5000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch {
            parsed = {};
          }
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(parsed.detail || `Router lookup failed with ${res.statusCode}`));
            return;
          }
          resolve(parsed);
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Router lookup timeout"));
    });
    req.end();
  });

  const expiresAt = payload?.expires_at ? new Date(payload.expires_at).valueOf() : Date.now() + 30000;
  routeCache.set(accessToken, {
    expiresAt,
    payload,
  });
  return payload;
}

async function resolveTarget(req) {
  const parsedUrl = new URL(req.url || "/", "http://router.local");
  const accessFromQuery = String(parsedUrl.searchParams.get("access") || "").trim();
  const cookies = parseCookies(req.headers.cookie);
  const accessToken = accessFromQuery || String(cookies[ACCESS_COOKIE_NAME] || "").trim();
  const target = await resolveRouteAccess(accessToken);

  return {
    accessToken,
    setCookie: Boolean(accessFromQuery),
    clearCookie: false,
    pod: String(target.pod_name || "").trim(),
    jupyterToken: String(target.token || "").trim(),
    upstreamPath: stripAccessQuery(req.url || "/"),
    username: String(target.username || "").trim(),
  };
}

function proxyHttp(req, res, target, upstreamHosts, idx = 0) {
  if (idx >= upstreamHosts.length) {
    const headers = { "Content-Type": "text/plain; charset=utf-8" };
    if (target.clearCookie) headers["Set-Cookie"] = clearAccessCookie();
    res.writeHead(502, headers);
    res.end("Upstream proxy failed.\n");
    return;
  }

  const upstream = upstreamHosts[idx];
  const proxyReq = http.request(
    {
      hostname: upstream,
      port: TARGET_PORT,
      path: target.upstreamPath,
      method: req.method || "GET",
      headers: sanitizeHeaders(req.headers, `${upstream}:${TARGET_PORT}`, target.jupyterToken),
      timeout: 20000,
    },
    (upstreamRes) => {
      const headers = { ...upstreamRes.headers };
      delete headers["transfer-encoding"];
      if (target.setCookie) {
        appendSetCookie(headers, accessCookie(target.accessToken));
      }
      res.writeHead(upstreamRes.statusCode || 502, headers);
      upstreamRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    proxyHttp(req, res, target, upstreamHosts, idx + 1);
  });

  proxyReq.on("timeout", () => {
    proxyReq.destroy(new Error("upstream timeout"));
  });

  req.pipe(proxyReq);
}

function serializeUpgradeHeaders(req, target, upstreamHost) {
  const lines = [`${req.method || "GET"} ${target.upstreamPath} HTTP/${req.httpVersion || "1.1"}`];
  const headers = sanitizeHeaders(req.headers, `${upstreamHost}:${TARGET_PORT}`, target.jupyterToken);
  for (const [name, value] of Object.entries(headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        lines.push(`${name}: ${item}`);
      }
      continue;
    }
    lines.push(`${name}: ${value}`);
  }
  lines.push("", "");
  return lines.join("\r\n");
}

function proxyUpgrade(req, socket, head, target, upstreamHosts, idx = 0) {
  if (idx >= upstreamHosts.length) {
    socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    socket.end("Upstream proxy failed.\n");
    return;
  }

  const upstream = upstreamHosts[idx];
  const upstreamSocket = net.connect(TARGET_PORT, upstream);

  upstreamSocket.on("connect", () => {
    upstreamSocket.write(serializeUpgradeHeaders(req, target, upstream));
    if (head?.length) {
      upstreamSocket.write(head);
    }
    socket.pipe(upstreamSocket).pipe(socket);
  });

  upstreamSocket.on("error", () => {
    socket.unpipe(upstreamSocket);
    upstreamSocket.destroy();
    proxyUpgrade(req, socket, head, target, upstreamHosts, idx + 1);
  });

  socket.on("error", () => {
    upstreamSocket.destroy();
  });
}

const server = http.createServer(async (req, res) => {
  if ((req.url || "") === "/healthz" || (req.url || "") === "/readyz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        path_prefix: PATH_PREFIX,
        host_suffix: HOST_SUFFIX,
        target_namespace: NAMESPACE,
        target_port: TARGET_PORT,
      }),
    );
    return;
  }

  try {
    const target = await resolveTarget(req);
    if (!target.pod || !target.jupyterToken) {
      throw new Error("Resolved Jupyter route is incomplete.");
    }
    proxyHttp(req, res, target, upstreamCandidates(target.pod));
  } catch (error) {
    const headers = {
      "Content-Type": "text/plain; charset=utf-8",
      "Set-Cookie": clearAccessCookie(),
    };
    res.writeHead(401, headers);
    res.end(`${error.message}\n`);
  }
});

server.on("upgrade", async (req, socket, head) => {
  try {
    const target = await resolveTarget(req);
    if (!target.pod || !target.jupyterToken) {
      throw new Error("Resolved Jupyter route is incomplete.");
    }
    proxyUpgrade(req, socket, head, target, upstreamCandidates(target.pod));
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
  }
});

server.listen(PORT, "0.0.0.0");
