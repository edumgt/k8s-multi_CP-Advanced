import crypto from "node:crypto";

import { config } from "../config.js";
import {
  AnalysisEnvironment,
  EnvironmentAssignment,
  EnvironmentRequest,
  ResourceAllocation,
  ResourceRequest,
} from "../models/index.js";
import { toAnalysisEnvironmentItem, toEnvironmentRequestItem, toResourceRequestItem } from "../utils/formatters.js";
import { canonicalUsername, buildLabIdentity } from "../utils/labIdentity.js";
import { findUser } from "./authService.js";
import { ensureUserHomePvc } from "./k8sService.js";

const DEFAULT_ENV_ID = "jupyter-teradata-extention";

function now() {
  return new Date();
}

function requestId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeEnvId(envId) {
  const normalized = String(envId || "")
    .trim()
    .toLowerCase();
  if (normalized.length < 3 || normalized.length > 64) {
    throw new Error("env_id must be between 3 and 64 characters.");
  }
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    throw new Error("env_id may contain only lowercase letters, numbers, dash, underscore.");
  }
  return normalized;
}

async function ensureKnownUser(username) {
  const normalized = canonicalUsername(username);
  const user = await findUser(normalized);
  if (!user) throw new Error("Unknown demo user.");
  return user;
}

export async function ensureDefaultEnvironment() {
  const count = await AnalysisEnvironment.countDocuments({});
  if (count > 0) return;
  await AnalysisEnvironment.create({
    envId: DEFAULT_ENV_ID,
    name: "Jupyter Teradata Extension",
    image: config.jupyterImage,
    description: "Default per-user JupyterLab image with Teradata extension.",
    gpuEnabled: false,
    isActive: true,
    updatedBy: "system",
  });
}

export async function listAnalysisEnvironments(includeInactive = false) {
  await ensureDefaultEnvironment();
  const filter = includeInactive ? {} : { isActive: true };
  const rows = await AnalysisEnvironment.find(filter).sort({ envId: 1 });
  return rows.map(toAnalysisEnvironmentItem);
}

export async function upsertAnalysisEnvironment(payload, updatedBy) {
  const envId = normalizeEnvId(payload.env_id);
  const image = String(payload.image || "").trim();
  if (!image) throw new Error("image is required.");

  const nowAt = now();
  const update = {
    envId,
    name: String(payload.name || envId).trim() || envId,
    image,
    description: String(payload.description || "").trim(),
    gpuEnabled: Boolean(payload.gpu_enabled),
    isActive: Boolean(payload.is_active),
    updatedBy: String(updatedBy || "system"),
    updatedAt: nowAt,
  };

  await AnalysisEnvironment.findOneAndUpdate(
    { envId },
    {
      $set: update,
      $setOnInsert: { createdAt: nowAt },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return listAnalysisEnvironments(true);
}

export async function submitResourceRequest(username, requestPayload) {
  const user = await ensureKnownUser(username);
  const payload = await ResourceRequest.create({
    requestId: requestId("rr"),
    username: user.username,
    vcpu: Number(requestPayload.vcpu),
    memoryGib: Number(requestPayload.memory_gib),
    diskGib: Number(requestPayload.disk_gib),
    requestNote: String(requestPayload.note || "").trim(),
    status: "pending",
    reviewNote: "",
    reviewedBy: null,
    pvcName: null,
  });
  return toResourceRequestItem(payload);
}

export async function listResourceRequests({ username = "", status = "" } = {}) {
  const filter = {};
  if (username) filter.username = canonicalUsername(username);
  if (status) filter.status = String(status);
  const rows = await ResourceRequest.find(filter).sort({ createdAt: -1 });
  return rows.map(toResourceRequestItem);
}

export async function getUserResourceAllocation(username) {
  const normalized = canonicalUsername(username);
  return ResourceAllocation.findOne({ username: normalized });
}

export async function reviewResourceRequest(requestIdValue, approved, reviewedBy, note = "") {
  const requestDoc = await ResourceRequest.findOne({ requestId: requestIdValue });
  if (!requestDoc) throw new Error("Resource request not found.");
  if (requestDoc.status !== "pending") {
    throw new Error("Only pending resource requests can be reviewed.");
  }

  let pvcName = null;
  if (approved) {
    const identity = buildLabIdentity(requestDoc.username);
    pvcName = await ensureUserHomePvc(identity, requestDoc.diskGib);
    await ResourceAllocation.findOneAndUpdate(
      { username: requestDoc.username },
      {
        $set: {
          username: requestDoc.username,
          vcpu: requestDoc.vcpu,
          memoryGib: requestDoc.memoryGib,
          diskGib: requestDoc.diskGib,
          pvcName,
          approvedBy: reviewedBy,
          approvedAt: now(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  requestDoc.status = approved ? "approved" : "rejected";
  requestDoc.reviewNote = String(note || "").trim();
  requestDoc.reviewedBy = reviewedBy;
  requestDoc.pvcName = pvcName;
  requestDoc.updatedAt = now();
  await requestDoc.save();

  return toResourceRequestItem(requestDoc);
}

export async function submitEnvironmentRequest(username, requestPayload) {
  const user = await ensureKnownUser(username);
  await ensureDefaultEnvironment();

  const envId = normalizeEnvId(requestPayload.env_id);
  const env = await AnalysisEnvironment.findOne({ envId });
  if (!env) throw new Error("Requested analysis environment does not exist.");
  if (!env.isActive) throw new Error("Requested analysis environment is inactive.");

  const allocation = await getUserResourceAllocation(user.username);
  if (!allocation) {
    throw new Error("Resource allocation must be approved before requesting analysis environment.");
  }

  const payload = await EnvironmentRequest.create({
    requestId: requestId("er"),
    username: user.username,
    envId,
    requestNote: String(requestPayload.note || "").trim(),
    status: "pending",
    reviewNote: "",
    reviewedBy: null,
  });
  return toEnvironmentRequestItem(payload);
}

export async function listEnvironmentRequests({ username = "", status = "" } = {}) {
  const filter = {};
  if (username) filter.username = canonicalUsername(username);
  if (status) filter.status = String(status);
  const rows = await EnvironmentRequest.find(filter).sort({ createdAt: -1 });
  return rows.map(toEnvironmentRequestItem);
}

export async function reviewEnvironmentRequest(requestIdValue, approved, reviewedBy, note = "") {
  const requestDoc = await EnvironmentRequest.findOne({ requestId: requestIdValue });
  if (!requestDoc) throw new Error("Environment request not found.");
  if (requestDoc.status !== "pending") {
    throw new Error("Only pending environment requests can be reviewed.");
  }

  requestDoc.status = approved ? "approved" : "rejected";
  requestDoc.reviewNote = String(note || "").trim();
  requestDoc.reviewedBy = reviewedBy;
  requestDoc.updatedAt = now();
  await requestDoc.save();

  if (approved) {
    const env = await AnalysisEnvironment.findOne({ envId: requestDoc.envId });
    if (!env) {
      throw new Error("Approved environment request references a missing environment.");
    }
    await EnvironmentAssignment.findOneAndUpdate(
      { username: requestDoc.username },
      {
        $set: {
          username: requestDoc.username,
          envId: requestDoc.envId,
          image: env.image,
          approvedBy: reviewedBy,
          approvedAt: now(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  return toEnvironmentRequestItem(requestDoc);
}

export async function getUserEnvironmentAssignment(username) {
  const normalized = canonicalUsername(username);
  return EnvironmentAssignment.findOne({ username: normalized });
}

export async function getUserLabPolicy(username) {
  const user = await ensureKnownUser(username);

  if (!config.labGovernanceEnabled) {
    return {
      username: user.username,
      governance_enabled: false,
      ready: true,
      vcpu: null,
      memory_gib: null,
      disk_gib: null,
      pvc_name: null,
      analysis_env_id: null,
      analysis_image: null,
      detail: "Governance policy is disabled. Direct personal Jupyter launch is allowed.",
    };
  }

  await ensureDefaultEnvironment();
  const allocation = await getUserResourceAllocation(user.username);
  const assignment = await getUserEnvironmentAssignment(user.username);

  let detail = "Resource allocation and analysis environment approval are required.";
  if (allocation && !assignment) {
    detail = "Resource allocation is approved. Analysis environment approval is pending.";
  }
  if (allocation && assignment) {
    detail = "Ready to launch personal JupyterLab with approved resources and image.";
  }

  return {
    username: user.username,
    governance_enabled: true,
    ready: Boolean(allocation && assignment),
    vcpu: allocation ? Number(allocation.vcpu) : null,
    memory_gib: allocation ? Number(allocation.memoryGib) : null,
    disk_gib: allocation ? Number(allocation.diskGib) : null,
    pvc_name: allocation ? String(allocation.pvcName) : null,
    analysis_env_id: assignment ? String(assignment.envId) : null,
    analysis_image: assignment ? String(assignment.image) : null,
    detail,
  };
}

export async function getUserLabLaunchProfile(username) {
  const policy = await getUserLabPolicy(username);
  if (!policy.ready) {
    throw new Error(String(policy.detail));
  }

  const vcpu = Number(policy.vcpu);
  const memoryGib = Number(policy.memory_gib);
  const diskGib = Number(policy.disk_gib);
  return {
    image: String(policy.analysis_image),
    pvc_name: String(policy.pvc_name),
    use_workspace_subpath: false,
    cpu_request: String(vcpu),
    cpu_limit: String(vcpu),
    memory_request: `${memoryGib}Gi`,
    memory_limit: `${memoryGib}Gi`,
    extra_env: {
      PLATFORM_ANALYSIS_ENV_ID: String(policy.analysis_env_id),
      PLATFORM_ALLOCATED_VCPU: String(vcpu),
      PLATFORM_ALLOCATED_MEMORY_GIB: String(memoryGib),
      PLATFORM_ALLOCATED_DISK_GIB: String(diskGib),
    },
  };
}
