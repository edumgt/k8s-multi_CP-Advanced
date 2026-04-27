#!/usr/bin/env node
/**
 * Jupyter 환경변수 암호화/복호화 유틸
 *
 * 사용법:
 *   # 1. 새 암호화 키 생성 (최초 1회)
 *   node scripts/jupyter-env-encrypt.mjs --keygen
 *
 *   # 2. JSON 환경변수 암호화 → .env의 JUPYTER_EXTRA_ENV_ENCRYPTED 에 붙여넣기
 *   node scripts/jupyter-env-encrypt.mjs --encrypt '{"AIRFLOW_URL":"http://...","API_KEY":"secret"}'
 *
 *   # 3. 복호화 확인
 *   node scripts/jupyter-env-encrypt.mjs --decrypt '<base64>'
 *
 * 환경변수: JUPYTER_ENV_ENCRYPT_KEY (hex 64자) — .env 파일에서 자동 로드
 */

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadKey() {
  // .env에서 키 로드
  const envPath = resolve(import.meta.dirname, "../applications/fss-dis-server-node/.env");
  try {
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const m = line.match(/^JUPYTER_ENV_ENCRYPT_KEY=([0-9a-fA-F]{64})/);
      if (m) return m[1];
    }
  } catch { /* ignore */ }
  return process.env.JUPYTER_ENV_ENCRYPT_KEY || "";
}

function keygen() {
  const key = crypto.randomBytes(32).toString("hex");
  console.log("Generated key (paste into .env as JUPYTER_ENV_ENCRYPT_KEY):");
  console.log(key);
}

function encrypt(plainJson, keyHex) {
  if (!keyHex) { console.error("JUPYTER_ENV_ENCRYPT_KEY not set"); process.exit(1); }
  JSON.parse(plainJson); // validate JSON
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plainJson, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const result = Buffer.concat([iv, tag, enc]).toString("base64");
  console.log("Encrypted (paste into .env as JUPYTER_EXTRA_ENV_ENCRYPTED):");
  console.log(result);
}

function decrypt(base64, keyHex) {
  if (!keyHex) { console.error("JUPYTER_ENV_ENCRYPT_KEY not set"); process.exit(1); }
  const raw = Buffer.from(base64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const key = Buffer.from(keyHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  console.log("Decrypted JSON:");
  console.log(JSON.stringify(JSON.parse(plain), null, 2));
  console.log("\nenv.txt preview:");
  for (const [k, v] of Object.entries(JSON.parse(plain))) {
    console.log(`${k}=${v}`);
  }
}

const [, , flag, arg] = process.argv;
const keyHex = loadKey();

if (flag === "--keygen") {
  keygen();
} else if (flag === "--encrypt" && arg) {
  encrypt(arg, keyHex);
} else if (flag === "--decrypt" && arg) {
  decrypt(arg, keyHex);
} else {
  console.log("Usage:");
  console.log("  node scripts/jupyter-env-encrypt.mjs --keygen");
  console.log("  node scripts/jupyter-env-encrypt.mjs --encrypt '{\"KEY\":\"value\"}'");
  console.log("  node scripts/jupyter-env-encrypt.mjs --decrypt '<base64>'");
}
