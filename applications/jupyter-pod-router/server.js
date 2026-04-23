'use strict'

const http = require('node:http')
const net = require('node:net')
const { URL } = require('node:url')

const PORT = Number(process.env.PORT || 8080)
const ROUTER_PATH_PREFIX = normalizePathPrefix(process.env.ROUTER_PATH_PREFIX || '/jupyter')
const ROUTER_HEADLESS_SERVICE = String(process.env.ROUTER_HEADLESS_SERVICE || 'jupyter-named-pod').toLowerCase()
const ROUTER_TARGET_NAMESPACE = String(process.env.ROUTER_TARGET_NAMESPACE || 'dis').toLowerCase()
const ROUTER_TARGET_PORT = Number(process.env.ROUTER_TARGET_PORT || 8888)
const REQUEST_TIMEOUT_MS = Number(process.env.ROUTER_REQUEST_TIMEOUT_MS || 3600000)
const ROUTER_BACKEND_URL = String(process.env.ROUTER_BACKEND_URL || '').trim().replace(/\/+$/g, '')
const ROUTER_SHARED_SECRET = String(process.env.ROUTER_SHARED_SECRET || '').trim()
const ROUTER_USER_COOKIE_NAME = String(process.env.ROUTER_USER_COOKIE_NAME || 'jupyter_route_userid').trim()
const ROUTER_AUTH_COOKIE_NAME = String(process.env.ROUTER_AUTH_COOKIE_NAME || 'fss_app_session').trim()
const ROUTER_RESOLVE_MODE = String(process.env.ROUTER_RESOLVE_MODE || '').trim().toLowerCase()
const ROUTER_JUPYTER_TOKEN = String(process.env.ROUTER_JUPYTER_TOKEN || 'platform123').trim()

const USERNAME_PATTERN = /^[a-z0-9._@-]+$/

function normalizePathPrefix(value) {
  let pathPrefix = String(value || '').trim()
  if (!pathPrefix) {
    return '/jupyter'
  }
  if (!pathPrefix.startsWith('/')) {
    pathPrefix = `/${pathPrefix}`
  }
  pathPrefix = pathPrefix.replace(/\/+$/g, '')
  return pathPrefix || '/'
}

function parseCookies(rawCookie) {
  const cookies = {}
  for (const part of String(rawCookie || '').split(';')) {
    const index = part.indexOf('=')
    if (index === -1) {
      continue
    }
    const key = part.slice(0, index).trim()
    if (!key) {
      continue
    }
    const value = part.slice(index + 1).trim()
    cookies[key] = decodeURIComponent(value)
  }
  return cookies
}

function buildCookie(name, value) {
  return `${name}=${encodeURIComponent(value)}; Path=${ROUTER_PATH_PREFIX}; HttpOnly; SameSite=Lax`
}

function clearCookie(name) {
  return `${name}=; Path=${ROUTER_PATH_PREFIX}; HttpOnly; SameSite=Lax; Max-Age=0`
}

function normalizeUserid(value) {
  return String(value || '').trim().toLowerCase()
}

function canonicalUsername(username) {
  const normalized = normalizeUserid(username)
  if (normalized.length < 2 || normalized.length > 48) {
    throw new Error('username must be between 2 and 48 characters')
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error('username may contain only letters, numbers, dot, underscore, dash, and @')
  }
  return normalized
}

function buildSessionId(username) {
  const normalized = canonicalUsername(username)
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'user'
  const digest = require('node:crypto').createHash('sha1').update(normalized).digest('hex').slice(0, 8)
  return `${slug}-${digest}`
}

function buildSessionToken(seed, sessionId) {
  return require('node:crypto').createHash('sha256').update(`${seed}:${sessionId}`).digest('hex').slice(0, 24)
}

function extractRouteContext(req) {
  let parsed
  try {
    parsed = new URL(req.url || '/', 'http://router.local')
  } catch (_) {
    return null
  }

  const pathname = parsed.pathname || '/'
  if (!(pathname === ROUTER_PATH_PREFIX || pathname.startsWith(`${ROUTER_PATH_PREFIX}/`))) {
    return null
  }

  const cookies = parseCookies(req.headers.cookie)
  const userid = normalizeUserid(
    parsed.searchParams.get('userid') ||
    parsed.searchParams.get('username') ||
    cookies[ROUTER_USER_COOKIE_NAME]
  )
  const authSessionToken = String(cookies[ROUTER_AUTH_COOKIE_NAME] || '').trim()

  return {
    pathname,
    parsed,
    userid,
    authSessionToken,
  }
}

function buildRouteHint() {
  return `path=${ROUTER_PATH_PREFIX}/lab?userid=<user>`
}

async function resolveRouteSession(userid, authSessionToken) {
  if (ROUTER_RESOLVE_MODE === 'deterministic' || (!ROUTER_BACKEND_URL && ROUTER_JUPYTER_TOKEN)) {
    const normalized = canonicalUsername(userid)
    const sessionId = buildSessionId(normalized)
    const podName = `lab-${sessionId}`
    return {
      username: normalized,
      pod_name: podName,
      upstream_host: `${podName}.${ROUTER_HEADLESS_SERVICE}.${ROUTER_TARGET_NAMESPACE}.svc.cluster.local`,
      token: buildSessionToken(ROUTER_JUPYTER_TOKEN, sessionId),
    }
  }

  if (!ROUTER_BACKEND_URL || !ROUTER_SHARED_SECRET) {
    throw new Error('Router backend integration is not configured.')
  }
  if (!userid) {
    throw new Error('userid query is required.')
  }
  if (!authSessionToken) {
    throw new Error('Application login session is required.')
  }

  const url = new URL('/internal/jupyter/route-session', ROUTER_BACKEND_URL)
  url.searchParams.set('userid', userid)

  const response = await fetch(url, {
    headers: {
      'x-router-secret': ROUTER_SHARED_SECRET,
      'x-user-session': authSessionToken,
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || `backend returned ${response.status}`)
  }
  if (!payload.upstream_host || !payload.token) {
    throw new Error('backend route session payload is incomplete')
  }
  return payload
}

function buildUpstreamPath(context, routeSession) {
  const parsed = new URL(context.parsed.toString())
  parsed.searchParams.delete('userid')
  parsed.searchParams.delete('username')
  if (parsed.pathname === ROUTER_PATH_PREFIX || parsed.pathname === `${ROUTER_PATH_PREFIX}/`) {
    parsed.pathname = `${ROUTER_PATH_PREFIX}/lab`
  }
  if (parsed.pathname === `${ROUTER_PATH_PREFIX}/lab` && !parsed.searchParams.has('token')) {
    parsed.searchParams.set('token', routeSession.token)
  }
  const query = parsed.searchParams.toString()
  return `${parsed.pathname}${query ? `?${query}` : ''}`
}

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function handleProxyHttp(req, res) {
  const context = extractRouteContext(req)
  if (!context) {
    writeJson(res, 400, { detail: `Route not matched. ${buildRouteHint()}` })
    return
  }

  let routeSession
  try {
    routeSession = await resolveRouteSession(context.userid, context.authSessionToken)
  } catch (e) {
    writeJson(res, 502, { detail: `Jupyter pod routing failed: ${e.message}` })
    return
  }

  const targetHost = routeSession.upstream_host
  const upstreamPath = buildUpstreamPath(context, routeSession)
  const proxyReq = http.request(
    {
      host: targetHost,
      port: ROUTER_TARGET_PORT,
      method: req.method,
      path: upstreamPath,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        ...req.headers,
        host: `${targetHost}:${ROUTER_TARGET_PORT}`,
      },
    },
    (proxyRes) => {
      const headers = { ...proxyRes.headers }
      const upstreamCookies = proxyRes.headers['set-cookie']
      const routeCookie = context.userid
        ? buildCookie(ROUTER_USER_COOKIE_NAME, context.userid)
        : clearCookie(ROUTER_USER_COOKIE_NAME)
      headers['set-cookie'] = Array.isArray(upstreamCookies)
        ? [...upstreamCookies, routeCookie]
        : upstreamCookies
          ? [upstreamCookies, routeCookie]
          : [routeCookie]
      res.writeHead(proxyRes.statusCode || 502, headers)
      proxyRes.pipe(res)
    }
  )

  proxyReq.on('timeout', () => proxyReq.destroy(new Error('upstream timeout')))
  proxyReq.on('error', (error) => {
    if (!res.headersSent) {
      writeJson(res, 502, { detail: `Jupyter pod routing failed: ${error.message}` })
      return
    }
    res.end()
  })

  req.pipe(proxyReq)
}

async function handleProxyWebSocket(req, socket, head) {
  const context = extractRouteContext(req)
  if (!context) {
    socket.destroy()
    return
  }

  let routeSession
  try {
    routeSession = await resolveRouteSession(context.userid, context.authSessionToken)
  } catch (_) {
    socket.destroy()
    return
  }

  const targetHost = routeSession.upstream_host
  const upstreamPath = buildUpstreamPath(context, routeSession)
  const upstream = net.connect(ROUTER_TARGET_PORT, targetHost)
  upstream.setTimeout(REQUEST_TIMEOUT_MS)
  upstream.on('timeout', () => upstream.destroy())
  upstream.on('error', () => socket.destroy())

  upstream.on('connect', () => {
    const rawHeaders = []
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i]
      const value = req.rawHeaders[i + 1]
      if (!key) {
        continue
      }
      if (String(key).toLowerCase() === 'host') {
        rawHeaders.push(`Host: ${targetHost}:${ROUTER_TARGET_PORT}`)
      } else {
        rawHeaders.push(`${key}: ${value}`)
      }
    }

    const firstLine = `GET ${upstreamPath} HTTP/${req.httpVersion}`
    const requestText = `${firstLine}\r\n${rawHeaders.join('\r\n')}\r\n\r\n`
    upstream.write(requestText)
    if (head && head.length > 0) {
      upstream.write(head)
    }

    socket.pipe(upstream)
    upstream.pipe(socket)
  })
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    writeJson(res, 200, {
      status: 'ok',
      route_mode: 'path',
      path_prefix: ROUTER_PATH_PREFIX,
      headless_service: ROUTER_HEADLESS_SERVICE,
      target_namespace: ROUTER_TARGET_NAMESPACE,
      target_port: ROUTER_TARGET_PORT,
      resolve_strategy: 'backend-userid-to-upstream-host',
    })
    return
  }

  if (req.url === '/readyz') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('ok')
    return
  }

  handleProxyHttp(req, res).catch((e) => {
    writeJson(res, 500, { detail: `router error: ${e.message}` })
  })
})

server.on('upgrade', (req, socket, head) => {
  handleProxyWebSocket(req, socket, head).catch(() => {
    socket.destroy()
  })
})

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`jupyter-pod-router listening on :${PORT}`)
})
