import { listUsers, getUserMetric, currentSessionSeconds, syncSessionActivity } from "./authService.js";
import { getLabSession } from "./sessionService.js";

function safeIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d.toISOString();
}

export async function buildUserUsage(username) {
  const session = await getLabSession(username).catch(() => ({
    status: "error",
    pod_name: "",
    node_port: null,
  }));
  const metric = await syncSessionActivity(username, session).catch(async () => getUserMetric(username));

  const currentSeconds = currentSessionSeconds(metric);
  const totalSeconds = Number(metric?.totalSessionSeconds || 0) + currentSeconds;

  return {
    summary: {
      username: username,
      display_name: metric?.displayName || username,
      role: metric?.role || "user",
      current_status: String(session.status || "idle"),
      pod_name: String(session.pod_name || ""),
      node_port: session.node_port || null,
      login_count: Number(metric?.loginCount || 0),
      launch_count: Number(metric?.launchCount || 0),
      current_session_seconds: currentSeconds,
      total_session_seconds: totalSeconds,
      last_login_at: safeIso(metric?.lastLoginAt),
      last_launch_at: safeIso(metric?.lastLaunchAt),
      last_stop_at: safeIso(metric?.lastStopAt),
    },
  };
}

export async function buildAdminOverview() {
  const users = (await listUsers()).filter((item) => item.role === "user");
  const rows = [];

  for (const user of users) {
    let session;
    try {
      session = await getLabSession(user.username);
      await syncSessionActivity(user.username, session);
    } catch (error) {
      session = {
        username: user.username,
        session_id: "",
        namespace: "",
        pod_name: "",
        service_name: "",
        workspace_subpath: "",
        image: "",
        status: "error",
        phase: "Error",
        ready: false,
        detail: `Unable to read session state: ${error.message}`,
        token: "",
        node_port: null,
        created_at: null,
      };
    }

    const metric = await getUserMetric(user.username);
    const currentSeconds = currentSessionSeconds(metric);
    const totalSeconds = Number(metric?.totalSessionSeconds || 0) + currentSeconds;

    rows.push({
      username: user.username,
      display_name: user.displayName,
      status: session.status,
      ready: Boolean(session.ready),
      detail: session.detail,
      pod_name: session.pod_name,
      service_name: session.service_name,
      workspace_subpath: session.workspace_subpath,
      image: session.image,
      node_port: session.node_port || null,
      session_id: session.session_id,
      phase: session.phase,
      login_count: Number(metric?.loginCount || 0),
      launch_count: Number(metric?.launchCount || 0),
      current_session_seconds: currentSeconds,
      total_session_seconds: totalSeconds,
      last_login_at: safeIso(metric?.lastLoginAt),
      last_launch_at: safeIso(metric?.lastLaunchAt),
      last_stop_at: safeIso(metric?.lastStopAt),
    });
  }

  rows.sort((a, b) => {
    const rank = (item) => (["ready", "provisioning"].includes(item.status) ? 0 : 1);
    return rank(a) - rank(b) || String(a.username).localeCompare(String(b.username));
  });

  return {
    summary: {
      sandbox_user_count: rows.length,
      running_user_count: rows.filter((item) => ["ready", "provisioning"].includes(item.status)).length,
      ready_user_count: rows.filter((item) => item.ready).length,
      total_login_count: rows.reduce((sum, item) => sum + Number(item.login_count || 0), 0),
      total_launch_count: rows.reduce((sum, item) => sum + Number(item.launch_count || 0), 0),
      total_session_seconds: rows.reduce((sum, item) => sum + Number(item.total_session_seconds || 0), 0),
    },
    users: rows,
  };
}
