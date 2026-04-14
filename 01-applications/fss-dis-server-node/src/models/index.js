import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    displayName: { type: String, required: true },
    builtIn: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

const userMetricSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true },
    role: { type: String, required: true },
    loginCount: { type: Number, default: 0 },
    launchCount: { type: Number, default: 0 },
    totalSessionSeconds: { type: Number, default: 0 },
    activeSince: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLaunchAt: { type: Date, default: null },
    lastStopAt: { type: Date, default: null },
    lastSeenStatus: { type: String, default: "idle" },
  },
  { timestamps: true, versionKey: false },
);

const analysisEnvironmentSchema = new Schema(
  {
    envId: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    description: { type: String, default: "" },
    gpuEnabled: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

const resourceRequestSchema = new Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, lowercase: true, trim: true },
    vcpu: { type: Number, required: true },
    memoryGib: { type: Number, required: true },
    diskGib: { type: Number, required: true },
    requestNote: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewNote: { type: String, default: "" },
    reviewedBy: { type: String, default: null },
    pvcName: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

const resourceAllocationSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    vcpu: { type: Number, required: true },
    memoryGib: { type: Number, required: true },
    diskGib: { type: Number, required: true },
    pvcName: { type: String, required: true },
    approvedBy: { type: String, required: true },
    approvedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

const environmentRequestSchema = new Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, lowercase: true, trim: true },
    envId: { type: String, required: true, lowercase: true, trim: true },
    requestNote: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewNote: { type: String, default: "" },
    reviewedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

const environmentAssignmentSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    envId: { type: String, required: true, lowercase: true, trim: true },
    image: { type: String, required: true },
    approvedBy: { type: String, required: true },
    approvedAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

export const User = model("User", userSchema);
export const UserMetric = model("UserMetric", userMetricSchema);
export const AnalysisEnvironment = model("AnalysisEnvironment", analysisEnvironmentSchema);
export const ResourceRequest = model("ResourceRequest", resourceRequestSchema);
export const ResourceAllocation = model("ResourceAllocation", resourceAllocationSchema);
export const EnvironmentRequest = model("EnvironmentRequest", environmentRequestSchema);
export const EnvironmentAssignment = model("EnvironmentAssignment", environmentAssignmentSchema);
