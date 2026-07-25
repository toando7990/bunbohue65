/**
 * Tingee Dynamic QR Worker
 *
 * Worker chạy trên VPS, poll canister IC mỗi 15 giây để lấy danh sách
 * PendingDynamicQRItem, sau đó gọi Tingee API (generate / status / delete)
 * và post kết quả về canister qua callback (confirmDynamicQR*).
 *
 * Sử dụng @dfinity/agent + Ed25519KeyIdentity (persisted) để gọi canister.
 * Tingee API signature: HMAC-SHA512(secretToken, timestamp + ':' + bodyJson).
 *   - POST: bodyJson = JSON.stringify(body)
 *   - GET:  bodyJson = '{}'
 *
 * Canister callback methods (SINGLE RECORD args, not positional):
 *   - confirmDynamicQRGenerated({ qrString, idempotencyKey, qrId, orderId, billId })
 *   - confirmDynamicQRStatus({ status, totalAmountPaid, transactionInfos, orderId })
 *   - confirmDynamicQRDeleted({ orderId })
 *
 * Query methods:
 *   - getPendingDynamicQRs() → [PendingDynamicQRItem]
 *     where item = { orderId, orderCode, operation: {#generate|#status|#delete},
 *                    qrId, billId, amount, idempotencyKey }
 *   - getDynamicQRWorkerConfig() → { clientId, secretToken, vaAccountNumber,
 *                                    bankBin, merchantId, workerPrincipal }
 */

import { HttpAgent, Actor } from '@dfinity/agent';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';
import https from 'https';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import path from 'node:path';

// ── Configuration ────────────────────────────────────────────────────────────

const CANISTER_ID = process.env.CANISTER_ID || '52szj-eyaaa-aaaab-qhcpa-cai';
const IC_HOST = process.env.IC_HOST || 'https://icp0.io';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const WORKER_IDENTITY_PATH =
  process.env.WORKER_IDENTITY_PATH || './worker-identity.json';

// Tingee API endpoints
const TINGEE_BASE_URL = 'https://api.tingee.vn/v1';
const TINGEE_GENERATE_URL = `${TINGEE_BASE_URL}/generate-dynamic-qr`;
const TINGEE_STATUS_URL = `${TINGEE_BASE_URL}/get-status-dynamic-qr`;
const TINGEE_DELETE_URL = `${TINGEE_BASE_URL}/delete-dynamic-qr`;

if (!CANISTER_ID) {
  console.error('[tingee-worker] ERROR: CANISTER_ID is required.');
  process.exit(1);
}

// ── Identity Persistence ────────────────────────────────────────────────────
// Ed25519KeyIdentity persisted to worker-identity.json (chmod 0600).
// Principal cố định qua các lần restart VPS — phải đăng ký với canister owner.

function loadOrCreateIdentity(identityPath) {
  const resolvedPath = path.resolve(identityPath);

  if (existsSync(resolvedPath)) {
    try {
      const jsonStr = readFileSync(resolvedPath, 'utf8');
      const identity = Ed25519KeyIdentity.fromJSON(jsonStr);
      const principalText = identity.getPrincipal().toText();
      log('info', `Loaded persisted worker identity from ${resolvedPath}`);
      log('info', `Worker principal: ${principalText}`);
      log('info', 'Register this principal with the canister owner so the worker can be authorized.');
      return identity;
    } catch (err) {
      log('warn', `Failed to load identity from ${resolvedPath}: ${err.message}. Generating a new identity.`);
    }
  } else {
    log('info', `No identity file at ${resolvedPath}. Generating a new Ed25519KeyIdentity.`);
  }

  const identity = Ed25519KeyIdentity.generate();
  const principalText = identity.getPrincipal().toText();
  const jsonStr = JSON.stringify(identity.toJSON());
  try {
    writeFileSync(resolvedPath, jsonStr, { mode: 0o600 });
    try {
      chmodSync(resolvedPath, 0o600);
    } catch (chmodErr) {
      log('warn', `Could not chmod 0600 on ${resolvedPath}: ${chmodErr.message}`);
    }
    log('info', `Saved new worker identity to ${resolvedPath} (chmod 0600)`);
  } catch (writeErr) {
    log('error', `Failed to write identity file ${resolvedPath}: ${writeErr.message}`);
    log('warn', 'Worker will continue with an in-memory identity — principal will change on restart.');
  }

  log('info', `Worker principal: ${principalText}`);
  log('info', 'Register this principal with the canister owner so the worker can be authorized.');
  return identity;
}

// ── IDL Factory (inline) ─────────────────────────────────────────────────────
// Must match backend canister IDL exactly.
// PendingDynamicQRItem = { orderId, orderCode, operation: variant, qrId, billId, amount, idempotencyKey }
// operation = variant { #generate, #status, #delete }
// WorkerConfig = { clientId, secretToken, vaAccountNumber, bankBin, merchantId, workerPrincipal }

const idlFactory = ({ IDL }) => {
  const QRItem = IDL.Record({
    orderId: IDL.Nat,
    orderCode: IDL.Text,
    operation: IDL.Variant({
      generate: IDL.Null,
      status: IDL.Null,
      delete: IDL.Null,
    }),
    qrId: IDL.Opt(IDL.Text),
    billId: IDL.Opt(IDL.Text),
    amount: IDL.Nat,
    idempotencyKey: IDL.Text,
  });

  const WorkerConfig = IDL.Record({
    clientId: IDL.Text,
    secretToken: IDL.Text,
    vaAccountNumber: IDL.Text,
    bankBin: IDL.Text,
    merchantId: IDL.Text,
    workerPrincipal: IDL.Opt(IDL.Principal),
  });

  // Callback args (SINGLE RECORD, not positional)
  const ConfirmGeneratedArgs = IDL.Record({
    qrString: IDL.Text,
    idempotencyKey: IDL.Text,
    qrId: IDL.Text,
    orderId: IDL.Nat,
    billId: IDL.Text,
  });

  const TransactionInfo = IDL.Record({
    transactionId: IDL.Text,
    amount: IDL.Nat,
    transactionDate: IDL.Text,
    description: IDL.Opt(IDL.Text),
  });

  const ConfirmStatusArgs = IDL.Record({
    status: IDL.Text,
    totalAmountPaid: IDL.Nat,
    transactionInfos: IDL.Vec(TransactionInfo),
    orderId: IDL.Nat,
  });

  const ConfirmDeletedArgs = IDL.Record({
    orderId: IDL.Nat,
  });

  return IDL.Service({
    getPendingDynamicQRs: IDL.Func([], [IDL.Vec(QRItem)], ['query']),
    getDynamicQRWorkerConfig: IDL.Func([], [WorkerConfig], ['query']),
    confirmDynamicQRGenerated: IDL.Func([ConfirmGeneratedArgs], [], []),
    confirmDynamicQRStatus: IDL.Func([ConfirmStatusArgs], [], []),
    confirmDynamicQRDeleted: IDL.Func([ConfirmDeletedArgs], [], []),
  });
};

// ── Agent Setup ──────────────────────────────────────────────────────────────

const identity = loadOrCreateIdentity(WORKER_IDENTITY_PATH);

const agent = new HttpAgent({ host: IC_HOST, identity });

if (IC_HOST.includes('localhost') || IC_HOST.includes('127.0.0.1')) {
  await agent.fetchRootKey();
}

const actor = Actor.createActor(idlFactory, {
  agent,
  canisterId: Principal.fromText(CANISTER_ID),
});

// ── Dedup Map ────────────────────────────────────────────────────────────────

const dedupMap = new Map(); // `${orderId}:${operation}` -> timestamp
const DEDUP_TTL_MS = 120000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function dedupKey(orderId, operation) {
  return `${orderId}:${operation}`;
}

function isDuplicate(orderId, operation) {
  const key = dedupKey(orderId, operation);
  const ts = dedupMap.get(key);
  if (!ts) return false;
  if (Date.now() - ts > DEDUP_TTL_MS) {
    dedupMap.delete(key);
    return false;
  }
  return true;
}

function markProcessing(orderId, operation) {
  dedupMap.set(dedupKey(orderId, operation), Date.now());
}

// ── Logging ──────────────────────────────────────────────────────────────────

function log(level, msg, data) {
  if (level === 'debug' && LOG_LEVEL !== 'debug') return;
  if (level === 'error' && LOG_LEVEL === 'none') return;
  const ts = new Date().toISOString();
  const line = data
    ? `[tingee-worker] ${ts} [${level.toUpperCase()}] ${msg} ${JSON.stringify(data)}`
    : `[tingee-worker] ${ts} [${level.toUpperCase()}] ${msg}`;
  console.log(line);
}

// ── Tingee Signature (HMAC-SHA512) ───────────────────────────────────────────
// payload = HMAC-SHA512(secretToken, timestamp + ':' + bodyJson)
// Headers: x-client-id, x-request-timestamp, x-signature, accept, Content-Type
// GET uses bodyJson = '{}'

function buildTingeeSignature(secretToken, timestamp, bodyJson) {
  const payload = `${timestamp}:${bodyJson}`;
  return crypto.createHmac('sha512', secretToken).update(payload).digest('hex');
}

function buildTingeeHeaders(clientId, secretToken, method, bodyJson) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = buildTingeeSignature(secretToken, timestamp, bodyJson);
  const headers = {
    'x-client-id': clientId,
    'x-request-timestamp': timestamp,
    'x-signature': signature,
    accept: 'application/json',
  };
  if (method === 'POST' || method === 'PUT') {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// ── Tingee API Call ──────────────────────────────────────────────────────────

function callTingee(targetUrl, method, bodyObj, clientId, secretToken) {
  return new Promise((resolve, reject) => {
    const bodyJson = method === 'GET' ? '{}' : JSON.stringify(bodyObj || {});
    const headers = buildTingeeHeaders(clientId, secretToken, method, bodyJson);
    const bodyBuf = method === 'GET' ? null : Buffer.from(bodyJson, 'utf8');

    const url = new URL(targetUrl);
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      method,
      headers: bodyBuf
        ? { ...headers, 'Content-Length': bodyBuf.length }
        : headers,
      timeout: 30_000,
    };

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode, body: responseBody });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tingee request timed out'));
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

// ── QR Item Processing ───────────────────────────────────────────────────────

/**
 * Process #generate: call Tingee generate-dynamic-qr, post confirmDynamicQRGenerated.
 * Body gửi cho Tingee: { vaAccountNumber, qrCodeType, bankBin, amount, purpose,
 *   expireInMinute, extraInfo, merchantId, idempotencyKey, orderCode }
 */
async function processGenerate(item, config) {
  const orderId = item.orderId;
  const body = {
    vaAccountNumber: config.vaAccountNumber,
    qrCodeType: 'DYNAMIC',
    bankBin: config.bankBin,
    amount: Number(item.amount),
    purpose: `Thanh toan don ${item.orderCode}`,
    expireInMinute: 30,
    extraInfo: item.orderCode,
    merchantId: config.merchantId,
    idempotencyKey: item.idempotencyKey,
    orderCode: item.orderCode,
  };

  log('info', `Generate QR for orderId=${orderId} orderCode=${item.orderCode}`);

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { statusCode, body: respBody } = await callTingee(
        TINGEE_GENERATE_URL,
        'POST',
        body,
        config.clientId,
        config.secretToken
      );

      let parsed;
      try {
        parsed = JSON.parse(respBody);
      } catch (_) {
        parsed = { raw: respBody };
      }

      if (statusCode >= 200 && statusCode < 300 && parsed.qrString) {
        log('info', `Generate QR success orderId=${orderId}`, {
          qrId: parsed.qrId || parsed.id,
          billId: parsed.billId || parsed.bill_id,
        });
        // confirmDynamicQRGenerated({ qrString, idempotencyKey, qrId, orderId, billId })
        await actor.confirmDynamicQRGenerated({
          qrString: String(parsed.qrString),
          idempotencyKey: item.idempotencyKey,
          qrId: String(parsed.qrId || parsed.id || ''),
          orderId: BigInt(orderId),
          billId: String(parsed.billId || parsed.bill_id || ''),
        });
        return;
      }

      lastError = parsed.errorMessage || parsed.message || `HTTP ${statusCode}: ${respBody.substring(0, 200)}`;
      log('warn', `Generate QR error (attempt ${attempt}/${MAX_RETRIES}) orderId=${orderId}`, {
        error: lastError,
        statusCode,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    } catch (err) {
      lastError = err.message;
      log('error', `Generate QR exception (attempt ${attempt}/${MAX_RETRIES}) orderId=${orderId}`, {
        error: lastError,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  log('error', `Generate QR failed after ${MAX_RETRIES} retries orderId=${orderId}`, { error: lastError });
}

/**
 * Process #status: call Tingee get-status-dynamic-qr, post confirmDynamicQRStatus.
 * Body gửi cho Tingee: { qrId, billId } (tuỳ theo Tingee API).
 */
async function processStatus(item, config) {
  const orderId = item.orderId;
  const qrId = item.qrId && item.qrId.length > 0 ? item.qrId[0] : '';
  const billId = item.billId && item.billId.length > 0 ? item.billId[0] : '';

  const body = { qrId, billId };

  log('info', `Status QR for orderId=${orderId} qrId=${qrId}`);

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { statusCode, body: respBody } = await callTingee(
        TINGEE_STATUS_URL,
        'POST',
        body,
        config.clientId,
        config.secretToken
      );

      let parsed;
      try {
        parsed = JSON.parse(respBody);
      } catch (_) {
        parsed = { raw: respBody };
      }

      if (statusCode >= 200 && statusCode < 300) {
        const status = String(parsed.status || parsed.qrStatus || 'UNKNOWN');
        const totalAmountPaid = BigInt(parsed.totalAmountPaid || parsed.total_amount_paid || 0);
        const transactionInfos = (parsed.transactions || parsed.transactionInfos || []).map((t) => ({
          transactionId: String(t.transactionId || t.transaction_id || t.id || ''),
          amount: BigInt(t.amount || 0),
          transactionDate: String(t.transactionDate || t.transaction_date || ''),
          description: t.description ? [String(t.description)] : [],
        }));

        log('info', `Status QR success orderId=${orderId}`, {
          status,
          totalAmountPaid: totalAmountPaid.toString(),
          txCount: transactionInfos.length,
        });
        // confirmDynamicQRStatus({ status, totalAmountPaid, transactionInfos, orderId })
        await actor.confirmDynamicQRStatus({
          status,
          totalAmountPaid,
          transactionInfos,
          orderId: BigInt(orderId),
        });
        return;
      }

      lastError = parsed.errorMessage || parsed.message || `HTTP ${statusCode}: ${respBody.substring(0, 200)}`;
      log('warn', `Status QR error (attempt ${attempt}/${MAX_RETRIES}) orderId=${orderId}`, {
        error: lastError,
        statusCode,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    } catch (err) {
      lastError = err.message;
      log('error', `Status QR exception (attempt ${attempt}/${MAX_RETRIES}) orderId=${orderId}`, {
        error: lastError,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  log('error', `Status QR failed after ${MAX_RETRIES} retries orderId=${orderId}`, { error: lastError });
}

/**
 * Process #delete: call Tingee delete-dynamic-qr, post confirmDynamicQRDeleted.
 * Body gửi cho Tingee: { qrId, billId } (tuỳ theo Tingee API).
 */
async function processDelete(item, config) {
  const orderId = item.orderId;
  const qrId = item.qrId && item.qrId.length > 0 ? item.qrId[0] : '';
  const billId = item.billId && item.billId.length > 0 ? item.billId[0] : '';

  const body = { qrId, billId };

  log('info', `Delete QR for orderId=${orderId} qrId=${qrId}`);

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { statusCode, body: respBody } = await callTingee(
        TINGEE_DELETE_URL,
        'POST',
        body,
        config.clientId,
        config.secretToken
      );

      if (statusCode >= 200 && statusCode < 300) {
        log('info', `Delete QR success orderId=${orderId}`);
        // confirmDynamicQRDeleted({ orderId })
        await actor.confirmDynamicQRDeleted({
          orderId: BigInt(orderId),
        });
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(respBody);
      } catch (_) {
        parsed = {};
      }
      lastError = parsed.errorMessage || parsed.message || `HTTP ${statusCode}: ${respBody.substring(0, 200)}`;
      log('warn', `Delete QR error (attempt ${attempt}/${MAX_RETRIES}) orderId=${orderId}`, {
        error: lastError,
        statusCode,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    } catch (err) {
      lastError = err.message;
      log('error', `Delete QR exception (attempt ${attempt}/${MAX_RETRIES}) orderId=${orderId}`, {
        error: lastError,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  log('error', `Delete QR failed after ${MAX_RETRIES} retries orderId=${orderId}`, { error: lastError });
}

/**
 * Dispatch QR item to the correct processor based on operation variant.
 * Candid variant in JS: { generate: null } | { status: null } | { delete: null }
 */
async function processQRItem(item, config) {
  const orderId = item.orderId;
  let operationName;
  if ('generate' in item.operation) operationName = 'generate';
  else if ('status' in item.operation) operationName = 'status';
  else if ('delete' in item.operation) operationName = 'delete';
  else {
    log('warn', `Unknown operation for orderId=${orderId}`, { operation: item.operation });
    return;
  }

  if (isDuplicate(orderId, operationName)) {
    log('debug', `Skipping dedup orderId=${orderId} op=${operationName}`);
    return;
  }
  markProcessing(orderId, operationName);

  try {
    if (operationName === 'generate') {
      await processGenerate(item, config);
    } else if (operationName === 'status') {
      await processStatus(item, config);
    } else if (operationName === 'delete') {
      await processDelete(item, config);
    }
  } catch (err) {
    log('error', `Unhandled processQRItem error`, {
      orderId,
      operation: operationName,
      err: err.message,
    });
  }
}

// ── Poll Loop ─────────────────────────────────────────────────────────────────

async function pollAndProcess() {
  log('info', 'pollAndProcess: start');
  try {
    const config = await actor.getDynamicQRWorkerConfig();

    if (!config.clientId || !config.secretToken) {
      log('warn', 'Tingee credentials not configured - skipping poll');
      return;
    }

    const pending = await actor.getPendingDynamicQRs();
    log('info', `Pending dynamic QRs: ${pending.length}`);

    for (const item of pending) {
      // Process without await so poll loop is not blocked
      processQRItem(item, config).catch((err) =>
        log('error', 'Unhandled processQRItem error', {
          orderId: item.orderId,
          err: err.message,
        })
      );
    }
  } catch (err) {
    log('error', 'Poll error: ' + err.message, { stack: err.stack });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

log('info', 'Starting Tingee dynamic QR worker');
log('info', `Canister ID: ${CANISTER_ID}`);
log('info', `IC Host: ${IC_HOST}`);
log('info', `Poll interval: ${POLL_INTERVAL_MS}ms`);

// Initial poll with 30s timeout so setInterval always starts even if first poll hangs
const initialPollTimeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Initial poll timed out after 30s')), 30000)
);
try {
  await Promise.race([pollAndProcess(), initialPollTimeout]);
} catch (err) {
  log('error', 'Initial poll failed, interval will retry: ' + err.message);
}
const intervalId = setInterval(pollAndProcess, POLL_INTERVAL_MS);

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down');
  clearInterval(intervalId);
  process.exit(0);
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down');
  clearInterval(intervalId);
  process.exit(0);
});
