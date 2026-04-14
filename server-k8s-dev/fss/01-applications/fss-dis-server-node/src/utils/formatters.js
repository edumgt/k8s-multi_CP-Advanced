export function iso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

export function toDemoUserInfo(user) {
  return {
    username: String(user.username),
    role: String(user.role),
    display_name: String(user.displayName || user.username),
  };
}

export function toAnalysisEnvironmentItem(doc) {
  return {
    env_id: String(doc.envId),
    name: String(doc.name),
    image: String(doc.image),
    description: String(doc.description || ""),
    gpu_enabled: Boolean(doc.gpuEnabled),
    is_active: Boolean(doc.isActive),
    updated_by: String(doc.updatedBy || "system"),
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
  };
}

export function toResourceRequestItem(doc) {
  return {
    request_id: String(doc.requestId),
    username: String(doc.username),
    vcpu: Number(doc.vcpu),
    memory_gib: Number(doc.memoryGib),
    disk_gib: Number(doc.diskGib),
    request_note: String(doc.requestNote || ""),
    status: String(doc.status),
    review_note: String(doc.reviewNote || ""),
    reviewed_by: doc.reviewedBy || null,
    pvc_name: doc.pvcName || null,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
  };
}

export function toEnvironmentRequestItem(doc) {
  return {
    request_id: String(doc.requestId),
    username: String(doc.username),
    env_id: String(doc.envId),
    request_note: String(doc.requestNote || ""),
    status: String(doc.status),
    review_note: String(doc.reviewNote || ""),
    reviewed_by: doc.reviewedBy || null,
    created_at: iso(doc.createdAt),
    updated_at: iso(doc.updatedAt),
  };
}
