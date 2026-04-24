(function () {
  const TARGET_PATH = "/api/jupyter/pods/{username}";
  const OPEN_BUTTON_CLASS = "swagger-jupyter-launch";
  const RUN_BUTTON_CLASS = "swagger-jupyter-run";
  const BAR_CLASS = "swagger-jupyter-launch-bar";

  function getBackendBasePath() {
    const marker = "/docs";
    const path = window.location.pathname || "";
    const index = path.indexOf(marker);
    return index >= 0 ? path.slice(0, index) || "" : "";
  }

  function getAuthorizedBearer() {
    try {
      const authorized = window.ui?.authSelectors?.authorized?.();
      const raw = typeof authorized?.toJS === "function" ? authorized.toJS() : authorized;
      for (const entry of Object.values(raw || {})) {
        const value = entry?.value || entry;
        if (typeof value === "string" && value.trim()) {
          return value.startsWith("Bearer ") ? value : `Bearer ${value}`;
        }
      }
    } catch {
      // fall through
    }

    try {
      const stored = window.localStorage.getItem("authorized");
      if (!stored) return "";
      const parsed = JSON.parse(stored);
      for (const entry of Object.values(parsed || {})) {
        const value = entry?.value || entry;
        if (typeof value === "string" && value.trim()) {
          return value.startsWith("Bearer ") ? value : `Bearer ${value}`;
        }
      }
    } catch {
      // fall through
    }

    return "";
  }

  function extractJsonText(root) {
    const nodes = root.querySelectorAll(".responses-wrapper pre, .responses-wrapper code, .responses-wrapper .microlight");
    for (const node of nodes) {
      const text = (node.textContent || "").trim();
      if (text.startsWith("{") && text.includes("\"items\"")) {
        return text;
      }
    }
    return "";
  }

  function readUsernameFromResponse(root) {
    const raw = extractJsonText(root);
    if (!raw) return "";

    try {
      const payload = JSON.parse(raw);
      if (Array.isArray(payload?.items) && payload.items.length > 0) {
        return String(payload.items[0]?.username || "").trim();
      }
    } catch {
      return "";
    }

    return "";
  }

  function ensureStatus(bar) {
    let status = bar.querySelector(".swagger-jupyter-launch-status");
    if (!status) {
      status = document.createElement("span");
      status.className = "swagger-jupyter-launch-status";
      status.style.marginLeft = "12px";
      status.style.fontSize = "12px";
      status.style.color = "#3b4151";
      bar.appendChild(status);
    }
    return status;
  }

  function ensureBar(root) {
    let bar = root.querySelector(`.${BAR_CLASS}`);
    if (!bar) {
      bar = document.createElement("div");
      bar.className = BAR_CLASS;
      bar.style.display = "flex";
      bar.style.alignItems = "center";
      bar.style.gap = "8px";
      bar.style.margin = "12px 0 4px";

      const runButton = document.createElement("button");
      runButton.type = "button";
      runButton.className = `btn authorize ${RUN_BUTTON_CLASS}`;
      runButton.textContent = "Run Physical Pod";
      runButton.disabled = true;
      runButton.style.cursor = "pointer";
      runButton.style.padding = "6px 14px";
      bar.appendChild(runButton);

      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = `btn authorize ${OPEN_BUTTON_CLASS}`;
      openButton.textContent = "Jupyter Open";
      openButton.disabled = true;
      openButton.style.cursor = "pointer";
      openButton.style.padding = "6px 14px";
      bar.appendChild(openButton);

      const mount = root.querySelector(".responses-wrapper") || root.querySelector(".opblock-body") || root;
      mount.appendChild(bar);
    }

    return bar;
  }

  async function ensurePhysicalPod(username, statusEl, buttonEl, refresh) {
    const authHeader = getAuthorizedBearer();
    if (!authHeader) {
      statusEl.textContent = "Authorize 에 Bearer 토큰을 먼저 넣어주세요.";
      return;
    }

    const basePath = getBackendBasePath();
    buttonEl.disabled = true;
    statusEl.textContent = "물리 Pod 생성 요청 중...";

    try {
      const response = await window.fetch(`${basePath}/api/jupyter/sessions`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ username }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || `Request failed with ${response.status}`);
      }

      statusEl.textContent = `${username} 물리 Pod 실행 요청을 보냈습니다.`;
      if (typeof refresh === "function") {
        window.setTimeout(refresh, 500);
      }
    } catch (error) {
      statusEl.textContent = error instanceof Error ? error.message : "Physical pod run failed.";
    } finally {
      buttonEl.disabled = false;
    }
  }

  async function openJupyterForUsername(username, statusEl, buttonEl) {
    const authHeader = getAuthorizedBearer();
    if (!authHeader) {
      statusEl.textContent = "Authorize 에 Bearer 토큰을 먼저 넣어주세요.";
      return;
    }

    const basePath = getBackendBasePath();
    buttonEl.disabled = true;
    statusEl.textContent = "Jupyter URL 확인 중...";

    try {
      const response = await window.fetch(
        `${basePath}/api/jupyter/connect/${encodeURIComponent(username)}`,
        {
          headers: {
            accept: "application/json",
            Authorization: authHeader,
          },
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || `Request failed with ${response.status}`);
      }
      if (!payload?.redirect_url) {
        throw new Error("redirect_url is missing.");
      }

      window.open(payload.redirect_url, "_blank", "noopener,noreferrer");
      statusEl.textContent = `${username} Jupyter를 새 탭에서 열었습니다.`;
    } catch (error) {
      statusEl.textContent = error instanceof Error ? error.message : "Jupyter open failed.";
    } finally {
      buttonEl.disabled = false;
    }
  }

  function refreshBlock(root) {
    const bar = ensureBar(root);
    const runButton = bar.querySelector(`.${RUN_BUTTON_CLASS}`);
    const openButton = bar.querySelector(`.${OPEN_BUTTON_CLASS}`);
    const status = ensureStatus(bar);
    const username = readUsernameFromResponse(root);
    const executeButton = root.querySelector(".execute");

    if (!username) {
      runButton.disabled = true;
      openButton.disabled = true;
      status.textContent = "먼저 Execute로 userpods를 조회하세요.";
      runButton.onclick = null;
      openButton.onclick = null;
      return;
    }

    const refresh = () => executeButton?.click();
    runButton.disabled = false;
    openButton.disabled = false;
    status.textContent = `${username} 기준으로 물리 Pod 실행 또는 Jupyter 열기가 가능합니다.`;
    runButton.onclick = () => ensurePhysicalPod(username, status, runButton, refresh);
    openButton.onclick = () => openJupyterForUsername(username, status, openButton);
  }

  function scan() {
    const blocks = document.querySelectorAll(".opblock");
    for (const block of blocks) {
      const pathNode = block.querySelector(".opblock-summary-path");
      if (!pathNode) continue;
      if ((pathNode.textContent || "").trim() !== TARGET_PATH) continue;
      refreshBlock(block);
    }
  }

  window.addEventListener("load", () => {
    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
