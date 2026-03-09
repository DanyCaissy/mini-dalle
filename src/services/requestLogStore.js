import mysql from "mysql2/promise";
import crypto from "node:crypto";
import {
  DB_HOST,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USER
} from "../config/constants.js";

let pool;
let initPromise;

async function hasColumn(db, tableName, columnName) {
  const [rows] = await db.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  return Array.isArray(rows) && rows.length > 0;
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

export async function initializeRequestLogStore() {
  if (!initPromise) {
    initPromise = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          api_key TEXT NOT NULL,
          fingerprint VARCHAR(64) NOT NULL,
          first_seen_ip VARCHAR(45) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_used_at TIMESTAMP NULL DEFAULT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_fingerprint (fingerprint)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS request_logs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          ip_address VARCHAR(45) NOT NULL,
          request_type VARCHAR(16) NOT NULL,
          key_source VARCHAR(32) NOT NULL DEFAULT 'server_default',
          api_key_fingerprint VARCHAR(64) NULL,
          api_key_id BIGINT UNSIGNED NULL,
          prompt_text TEXT NULL,
          size VARCHAR(20) NULL,
          quality VARCHAR(20) NULL,
          output_format VARCHAR(20) NULL,
          output_compression INT NULL,
          blocked TINYINT(1) NOT NULL DEFAULT 0,
          error_message TEXT NULL,
          user_agent VARCHAR(255) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_ip_created (ip_address, created_at),
          KEY idx_ip_blocked (ip_address, blocked),
          KEY idx_ip_key_source_blocked (ip_address, key_source, blocked),
          KEY idx_api_key_id (api_key_id),
          CONSTRAINT fk_request_logs_api_key
            FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
            ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS subscription_interest_events (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          event_type VARCHAR(64) NOT NULL,
          ip_address VARCHAR(45) NULL,
          user_agent VARCHAR(255) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_event_created (event_type, created_at),
          KEY idx_ip_created (ip_address, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS subscription_interest_submissions (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          email VARCHAR(255) NOT NULL,
          willingness_amount DECIMAL(10,2) NULL,
          comments TEXT NULL,
          ip_address VARCHAR(45) NULL,
          user_agent VARCHAR(255) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_email_created (email, created_at),
          KEY idx_ip_created (ip_address, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS contact_messages (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          email VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          ip_address VARCHAR(45) NULL,
          user_agent VARCHAR(255) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_ip_created (ip_address, created_at),
          KEY idx_email_created (email, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS shared_images (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          share_id VARCHAR(32) NOT NULL,
          content_hash VARCHAR(64) NOT NULL,
          creator_ip VARCHAR(45) NULL,
          mime_type VARCHAR(32) NOT NULL,
          image_b64 LONGTEXT NOT NULL,
          prompt_text TEXT NULL,
          source_tab VARCHAR(16) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_share_id (share_id),
          UNIQUE KEY uq_content_hash (content_hash),
          KEY idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Backfill for existing installations created before these columns.
      if (!(await hasColumn(db, "request_logs", "key_source"))) {
        await db.query(
          "ALTER TABLE request_logs ADD COLUMN key_source VARCHAR(32) NOT NULL DEFAULT 'server_default'"
        );
      }
      if (!(await hasColumn(db, "request_logs", "api_key_fingerprint"))) {
        await db.query(
          "ALTER TABLE request_logs ADD COLUMN api_key_fingerprint VARCHAR(64) NULL"
        );
      }
      if (!(await hasColumn(db, "request_logs", "api_key_id"))) {
        await db.query(
          "ALTER TABLE request_logs ADD COLUMN api_key_id BIGINT UNSIGNED NULL"
        );
      }
      if (!(await hasColumn(db, "shared_images", "creator_ip"))) {
        await db.query(
          "ALTER TABLE shared_images ADD COLUMN creator_ip VARCHAR(45) NULL AFTER content_hash"
        );
      }
    })();
  }
  return initPromise;
}

export function getApiKeyFingerprint(apiKey) {
  return crypto.createHash("sha256").update(String(apiKey || "")).digest("hex");
}

export async function upsertApiKey(rawApiKey, firstSeenIp) {
  const db = getPool();
  const fingerprint = getApiKeyFingerprint(rawApiKey);
  const [result] = await db.query(
    `INSERT INTO api_keys (api_key, fingerprint, first_seen_ip, last_used_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       id = LAST_INSERT_ID(id),
       api_key = VALUES(api_key),
       last_used_at = CURRENT_TIMESTAMP`,
    [rawApiKey, fingerprint, firstSeenIp || null]
  );
  return {
    id: Number(result.insertId),
    fingerprint
  };
}

export async function countServerDefaultRequestsByIp(ipAddress) {
  const db = getPool();
  const [rows] = await db.query(
    "SELECT COUNT(*) AS count FROM request_logs WHERE ip_address = ? AND blocked = 0 AND key_source = 'server_default'",
    [ipAddress]
  );
  return Number(rows?.[0]?.count || 0);
}

export async function insertRequestLog({
  ipAddress,
  requestType,
  promptText,
  size,
  quality,
  outputFormat,
  outputCompression,
  keySource,
  apiKeyFingerprint,
  apiKeyId,
  blocked,
  errorMessage,
  userAgent
}) {
  const db = getPool();
  await db.query(
    `INSERT INTO request_logs
      (ip_address, request_type, key_source, api_key_fingerprint, api_key_id, prompt_text, size, quality, output_format, output_compression, blocked, error_message, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ipAddress,
      requestType,
      keySource || "server_default",
      apiKeyFingerprint || null,
      Number.isInteger(apiKeyId) ? apiKeyId : null,
      promptText || null,
      size || null,
      quality || null,
      outputFormat || null,
      Number.isInteger(outputCompression) ? outputCompression : null,
      blocked ? 1 : 0,
      errorMessage || null,
      userAgent || null
    ]
  );
}

export async function insertSubscriptionInterestEvent({
  eventType,
  ipAddress,
  userAgent
}) {
  const db = getPool();
  await db.query(
    `INSERT INTO subscription_interest_events
      (event_type, ip_address, user_agent)
     VALUES (?, ?, ?)`,
    [
      eventType,
      ipAddress || null,
      userAgent || null
    ]
  );
}

export async function insertSubscriptionInterestSubmission({
  email,
  willingnessAmount,
  comments,
  ipAddress,
  userAgent
}) {
  const db = getPool();
  await db.query(
    `INSERT INTO subscription_interest_submissions
      (email, willingness_amount, comments, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [
      email,
      typeof willingnessAmount === "number" && Number.isFinite(willingnessAmount)
        ? willingnessAmount
        : null,
      comments || null,
      ipAddress || null,
      userAgent || null
    ]
  );
}

export async function countContactMessagesByIpLastDay(ipAddress) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM contact_messages
     WHERE ip_address = ? AND created_at >= (NOW() - INTERVAL 1 DAY)`,
    [ipAddress]
  );
  return Number(rows?.[0]?.count || 0);
}

export async function insertContactMessage({
  email,
  message,
  ipAddress,
  userAgent
}) {
  const db = getPool();
  await db.query(
    `INSERT INTO contact_messages
      (email, message, ip_address, user_agent)
     VALUES (?, ?, ?, ?)`,
    [
      email,
      message,
      ipAddress || null,
      userAgent || null
    ]
  );
}

function createShareId() {
  return crypto.randomBytes(8).toString("hex");
}

function getContentHash(imageB64) {
  return crypto.createHash("sha256").update(String(imageB64 || "")).digest("hex");
}

export async function createOrGetSharedImage({
  imageB64,
  mimeType,
  promptText,
  sourceTab,
  creatorIp
}) {
  const db = getPool();
  const contentHash = getContentHash(imageB64);
  const [existingRows] = await db.query(
    `SELECT share_id, creator_ip, mime_type, image_b64, prompt_text, source_tab, created_at
     FROM shared_images
     WHERE content_hash = ?
     LIMIT 1`,
    [contentHash]
  );

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return {
      shareId: existingRows[0].share_id,
      alreadyExisted: true
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareId = createShareId();
    try {
      await db.query(
        `INSERT INTO shared_images
          (share_id, content_hash, creator_ip, mime_type, image_b64, prompt_text, source_tab)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          shareId,
          contentHash,
          creatorIp || null,
          mimeType,
          imageB64,
          promptText || null,
          sourceTab || null
        ]
      );
      return {
        shareId,
        alreadyExisted: false
      };
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        const [rows] = await db.query(
          `SELECT share_id
           FROM shared_images
           WHERE content_hash = ?
           LIMIT 1`,
          [contentHash]
        );
        if (Array.isArray(rows) && rows.length > 0) {
          return {
            shareId: rows[0].share_id,
            alreadyExisted: true
          };
        }
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to create shared image");
}

export async function getSharedImageByShareId(shareId) {
  const db = getPool();
  const [rows] = await db.query(
    `SELECT share_id, creator_ip, mime_type, image_b64, prompt_text, source_tab, created_at
     FROM shared_images
     WHERE share_id = ?
     LIMIT 1`,
    [shareId]
  );
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}
