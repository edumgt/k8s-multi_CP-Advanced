import mongoose from "mongoose";
import Redis from "ioredis";

import { config } from "../config.js";

let redisClient;

export async function connectMongo() {
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
}

export function getMongoReadyState() {
  return mongoose.connection.readyState;
}

export function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 3000,
    });
  }
  return redisClient;
}

export async function connectRedis() {
  const client = getRedis();
  if (client.status === "ready") return client;
  await client.connect();
  await client.ping();
  return client;
}

export async function closeAllConnections() {
  try {
    if (redisClient) {
      await redisClient.quit();
    }
  } catch {
    // ignore
  }
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  } catch {
    // ignore
  }
}
