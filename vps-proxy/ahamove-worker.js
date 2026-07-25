/**
 * Ahamove Booking Worker
 *
 * Worker chạy trên VPS, poll canister IC mỗi 15 giây để lấy danh sách
 * PendingAhamoveBookingItem, sau đó gọi Ahamove booking API và post kết quả
 * về canister qua callback confirmAhamoveBooking.
 *
 * Sử dụng @dfinity/agent + Ed25519KeyIdentity (persisted) để gọi canister.
 *
 * Canister callback method (POSITIONAL args, NOT single record):
 *   confirmAhamoveBooking(orderId, ahamoveOrderId, fare, status)
 *
 * Query methods:
 *   - getPendingAhamoveBookings() → [PendingAhamoveBookingItem]
 *     where item = { orderId, restaurantId, orderCode, pickupAddress, pickupLat,
 *       pickupLng, dropoffAddress, dropoffLat, dropoffLng, customerName,
 *       customerPhone, totalAmount, serviceId }
 *   - getAhamoveWorkerConfig() → variant { #ok: Config; #err: Text }
 *     where Config = { apiKey, mobile, ... }
 *
 * Ahamove booking request body (from old shipper-api.mo):
 *   {
 *     path: [{ address, lat, lng, name, mobile }, { address, lat, lng }],
 *     serviceId,
 *     payment_method: 'CASH_BY_RECIPIENT',
 *     total_pay,
 *     remarks
 *   }
 *
 * ⚠️ AUTH NOTE: confirmAhamoveBooking uses codIsEnterpriseStaff auth (NOT
 * workerPrincipal). The ahamove-worker's Ed25519 principal must be granted
 * #EnterpriseDelivery enterprise staff permission by the canister owner.
 * See README.md for setup instructions.
 */

import { HttpAgent, Actor } from '@dfinity/agent';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';
import https from 'https';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import path from 'node:path';

// ── Configuration ────────────────────────────────────────────────────────────

const CANISTER_ID = process.env.CANISTER_ID || '52szj-eyaaa-aaaab-qhcpa-cai';
const IC_HOST = process.env.IC_HOST || 'https://icp0.io';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const WORKER_IDENTITY_PATH =
  process.env.WORKER_IDENTITY_PATH || './worker-identity.json';

// Ahamove API endpoint
const AHAMOVE_BOOK_URL = 'https://api.ahamove.com/v1/order/create';

if (!CANISTER_ID) {
  console.error('[ahamove-worker] ERROR: CANISTER_ID is required.');
  process.exit(1);
}

// ── Identity Persistence ────────────────────────────────────────────────────
// Ed25519KeyIdentity persisted to worker-identity.json (chmod 0600).
// Principal cố định qua các lần restart VPS — phải đăng ký với canister owner.
//
// ⚠️ QUAN TRỌNG: confirmAhamoveBooking dùng codIsEnterpriseStaff auth, KHÔNG
// phải workerPrincipal. Principal của worker này phải được canister owner
// cấp quyền #EnterpriseDelivery (enterprise staff) thì callback mới được chấp
// nhận. Xem README.md phần "Auth Setup".

function loadOrCreateIdentity(identityPath) {
  const resolvedPath = path.resolve(identityPath);

  if (existsSync(resolvedPath)) {
    try {
      const jsonStr = readFileSync(resolvedPath, 'utf8');
      const identity = Ed25519KeyIdentity.fromJSON(jsonStr);
      const principalText = identity.getPrincipal().toText();
      log('info', `Loaded persisted worker identity from ${resolvedPath}`);
      log('info', `Worker principal: ${principalText}`);
      log('info', '⚠️ Register this principal with #EnterpriseDelivery enterprise staff permission (NOT workerPrincipal).');
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
  log('info', '⚠️ Register this principal with #EnterpriseDelivery enterprise staff permission (NOT workerPrincipal).');
  return identity;
}

// ── IDL Factory (inline) ─────────────────────────────────────────────────────
// Must match backend canister IDL exactly.
// PendingAhamoveBookingItem = { orderId, restaurantId, orderCode, pickupAddress,
//   pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng, customerName,
//   customerPhone, totalAmount, serviceId }
// getAhamoveWorkerConfig() → variant { #ok: Config; #err: Text }
// confirmAhamoveBooking(orderId, ahamoveOrderId, fare, status) — POSITIONAL

const idlFactory = ({ IDL }) => {
  const BookingItem = IDL.Record({
    orderId: IDL.Nat,
    restaurantId: IDL.Nat,
    orderCode: IDL.Text,
    pickupAddress: IDL.Text,
    pickupLat: IDL.Float64,
    pickupLng: IDL.Float64,
    dropoffAddress: IDL.Text,
    dropoffLat: IDL.Float64,
    dropoffLng: IDL.Float64,
    customerName: IDL.Text,
    customerPhone: IDL.Text,
    totalAmount: IDL.Nat,
    serviceId: IDL.Text,
  });

  const WorkerConfig = IDL.Record({
    apiKey: IDL.Text,
    mobile: IDL.Text,
  });

  const WorkerConfigResult = IDL.Variant({
    ok: WorkerConfig,
    err: IDL.Text,
  });

  return IDL.Service({
    getPendingAhamoveBookings: IDL.Func([], [IDL.Vec(BookingItem)], ['query']),
    getAhamoveWorkerConfig: IDL.Func([], [WorkerConfigResult], ['query']),
    // POSITIONAL args: (orderId, ahamoveOrderId, fare, status)
    confirmAhamoveBooking: IDL.Func(
      [IDL.Nat, IDL.Text, IDL.Nat, IDL.Text],
      [],
      []
    ),
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

const dedupMap = new Map(); // orderId -> timestamp
const DEDUP_TTL_MS = 120000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function isDuplicate(orderId) {
  const ts = dedupMap.get(orderId);
  if (!ts) return false;
  if (Date.now() - ts > DEDUP_TTL_MS) {
    dedupMap.delete(orderId);
    return false;
  }
  return true;
}

function markProcessing(orderId) {
  dedupMap.set(orderId, Date.now());
}

// ── Logging ──────────────────────────────────────────────────────────────────

function log(level, msg, data) {
  if (level === 'debug' && LOG_LEVEL !== 'debug') return;
  if (level === 'error' && LOG_LEVEL === 'none') return;
  const ts = new Date().toISOString();
  const line = data
    ? `[ahamove-worker] ${ts} [${level.toUpperCase()}] ${msg} ${JSON.stringify(data)}`
    : `[ahamove-worker] ${ts} [${level.toUpperCase()}] ${msg}`;
  console.log(line);
}

// ── Ahamove API Call ──────────────────────────────────────────────────────────

function callAhamove(targetUrl, bodyObj, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyJson = JSON.stringify(bodyObj);
    const bodyBuf = Buffer.from(bodyJson, 'utf8');

    const url = new URL(targetUrl);
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        Authorization: `Bearer ${apiKey}`,
      },
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
      reject(new Error('Ahamove request timed out'));
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ── Booking Body Builder ─────────────────────────────────────────────────────
// Ahamove booking request body (from old shipper-api.mo):
//   {
//     path: [{ address, lat, lng, name, mobile }, { address, lat, lng }],
//     serviceId,
//     payment_method: 'CASH_BY_RECIPIENT',
//     total_pay,
//     remarks
//   }

function buildBookingBody(item, config) {
  return {
    path: [
      {
        address: item.pickupAddress,
        lat: item.pickupLat,
        lng: item.pickupLng,
        name: item.customerName,
        mobile: config.mobile,
      },
      {
        address: item.dropoffAddress,
        lat: item.dropoffLat,
        lng: item.dropoffLng,
      },
    ],
    serviceId: item.serviceId,
    payment_method: 'CASH_BY_RECIPIENT',
    total_pay: Number(item.totalAmount),
    remarks: `Don hang ${item.orderCode}`,
  };
}

// ── Booking Processing ───────────────────────────────────────────────────────

async function processBooking(item, config) {
  const orderId = item.orderId;
  const body = buildBookingBody(item, config);

  log('info', `Booking Ahamove for orderId=${orderId} orderCode=${item.orderCode}`, {
    serviceId: item.serviceId,
    totalAmount: Number(item.totalAmount),
  });

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { statusCode, body: respBody } = await callAhamove(
        AHAMOVE_BOOK_URL,
        body,
        config.apiKey
      );

      let parsed;
      try {
        parsed = JSON.parse(respBody);
      } catch (_) {
        parsed = { raw: respBody };
      }

      // Ahamove success: statusCode 200, body contains order_id + fare
      if (statusCode >= 200 && statusCode < 300 && (parsed.order_id || parsed._id)) {
        const ahamoveOrderId = String(parsed.order_id || parsed._id || '');
        const fare = BigInt(parsed.fare || parsed.total_fee || parsed.price || 0);
        const status = String(parsed.status || 'ASSIGNING');

        log('info', `Booking success orderId=${orderId}`, {
          ahamoveOrderId,
          fare: fare.toString(),
          status,
        });

        // confirmAhamoveBooking(orderId, ahamoveOrderId, fare, status) — POSITIONAL
        await actor.confirmAhamoveBooking(
          BigInt(orderId),
          ahamoveOrderId,
          fare,
          status
        );
        return;
      }

      lastError = parsed.message || parsed.error || `HTTP ${statusCode}: ${respBody.substring(0, 200)}`;
      log('warn', `Booking error (attempt ${attempt}/${MAX_RETRIES}) orderId=${orderId}`, {
        error: lastError,
        statusCode,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    } catch (err) {
      lastError = err.message;
      log('error', `Booking exception (attempt ${attempt}/${MAX_RETRIES}) orderId=${orderId}`, {
        error: lastError,
      });
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  log('error', `Booking failed after ${MAX_RETRIES} retries orderId=${orderId}`, { error: lastError });
  // Gọi callback với status=FAILED để canister biết đơn thất bại
  try {
    await actor.confirmAhamoveBooking(BigInt(orderId), '', BigInt(0), 'FAILED');
  } catch (cbErr) {
    log('error', `Failed to post FAILED callback orderId=${orderId}`, { error: cbErr.message });
  }
}

// ── Poll Loop ─────────────────────────────────────────────────────────────────

async function pollAndProcess() {
  log('info', 'pollAndProcess: start');
  try {
    // getAhamoveWorkerConfig() → variant { #ok: Config; #err: Text }
    const configResult = await actor.getAhamoveWorkerConfig();

    let config;
    if ('ok' in configResult) {
      config = configResult.ok;
    } else {
      log('warn', `Ahamove worker config error: ${configResult.err}`);
      return;
    }

    if (!config.apiKey) {
      log('warn', 'Ahamove apiKey not configured - skipping poll');
      return;
    }

    const pending = await actor.getPendingAhamoveBookings();
    log('info', `Pending Ahamove bookings: ${pending.length}`);

    for (const item of pending) {
      if (isDuplicate(item.orderId)) {
        log('debug', 'Skipping dedup orderId: ' + item.orderId);
        continue;
      }
      markProcessing(item.orderId);
      // Process without await so poll loop is not blocked
      processBooking(item, config).catch((err) =>
        log('error', 'Unhandled processBooking error', {
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

log('info', 'Starting Ahamove booking worker');
log('info', `Canister ID: ${CANISTER_ID}`);
log('info', `IC Host: ${IC_HOST}`);
log('info', `Poll interval: ${POLL_INTERVAL_MS}ms`);
log('info', '⚠️ confirmAhamoveBooking uses codIsEnterpriseStaff auth (NOT workerPrincipal).');
log('info', '   Grant this worker principal #EnterpriseDelivery enterprise staff permission.');

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
