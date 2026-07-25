'use strict';

/**
 * AhaMove Worker v1.5.0
 *
 * Changelog vs v1.4.3:
 * - Adopted Ed25519KeyIdentity persisted to worker-identity.json (chmod 0600),
 *   mirroring bkav-worker loadOrCreateIdentity pattern. Principal fixed across
 *   restarts. Anonymous HttpAgent removed — getAhamoveWorkerConfig and
 *   receiveAhamoveWebhook now require workerPrincipal auth.
 * - Poll interval reduced from 30s to 15s (POLL_INTERVAL_MS = 15000).
 * - Heartbeat posted to canister after each successful poll cycle via
 *   postWorkerHeartbeat(workerId='ahamove').
 * - Exponential backoff retry: maxRetries=3, baseDelayMs=5000, maxDelayMs=60000,
 *   multiplier=2.0. delay = min(baseDelayMs * (multiplier^attempt), maxDelayMs).
 *   Replaces the previous linear backoff (RETRY_DELAY_MS * attempt).
 *
 * Changelog vs v1.4.2:
 * - Added /ahamove-estimate-public endpoint (no auth required)
 * - CORS headers for https://www.bunbohue65.vn
 * - Handles OPTIONS preflight requests
 *
 * Changelog vs v1.4.1:
 * - /ahamove-estimate: book-then-cancel flow — POST /v3/orders, read total_price from
 *   data.order.total_price (or top-level), immediately fire-and-forget DELETE to cancel
 *   the estimate order so no real delivery is created
 *
 * Changelog vs v1.3.0:
 * - /ahamove-book: changed body from `services` array to `service_id` string
 * - /ahamove-book: removed `total_pay` from request body (not required)
 *
 * Changelog vs v1.2.0:
 * - IDL AhamoveWorkerConfig now includes `mobile: IDL.Text` field
 * - Added getAhamoveToken(mobile, apiKey, isTestMode):
 *     POST /v3/accounts/token → JWT cached for 23 hours
 * - Added getAuthToken(config) helper:
 *     If config.mobile is set → fetch JWT via getAhamoveToken()
 *     If config.mobile is empty → use apiKey directly (backwards compat)
 *     Auto-invalidates cached token when apiKey changes
 * - fetchAhamoveOrder now accepts full config object; uses getAuthToken(),
 *     retries once on 401 after resetting token cache
 * - /ahamove-estimate and /ahamove-book use getAuthToken() + 401-retry
 * - processOrder and pollAndProcess pass full config to fetchAhamoveOrder
 * - No hardcoded API keys — always fetched from canister (5 s TTL cache)
 *
 * Deploy:
 *   cp ahamove-worker.js /opt/ahamove-worker/ahamove-worker.js
 *   pm2 restart ahamove-worker
 */

const { HttpAgent, Actor } = require('@dfinity/agent');
const { Ed25519KeyIdentity } = require('@dfinity/identity');
const { Principal } = require('@dfinity/principal');
const { IDL } = require('@dfinity/candid');
const fetch = require('node-fetch');
const crypto = require('crypto');
const { readFileSync, writeFileSync, existsSync, chmodSync } = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKEND_CANISTER_ID = process.env.CANISTER_ID || '';

if (!BACKEND_CANISTER_ID) {
  console.error('[ahamove-worker] ERROR: CANISTER_ID is required. Set it via environment variable.');
  process.exit(1);
}

const IC_HOST = process.env.IC_HOST || 'https://icp-api.io';
// Poll interval reduced from 30s to 15s to match bkav/tingee workers.
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10);
// Exponential backoff retry policy (matches user preference):
//   delay = min(baseDelayMs * (multiplier^attempt), maxDelayMs)
//   maxRetries=3, baseDelayMs=5000, maxDelayMs=60000, multiplier=2.0
//   attempt 1 → 5000ms, attempt 2 → 10000ms, attempt 3 → 20000ms (capped at 60000).
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 5000;
const RETRY_MAX_DELAY_MS = 60000;
const RETRY_MULTIPLIER = 2.0;
const PORT = 3002;

// Worker identifier sent to postWorkerHeartbeat so the canister can track
// per-worker liveness. Ahamove worker always reports 'ahamove'.
const WORKER_ID = 'ahamove';

// Path to the persisted Ed25519KeyIdentity file. Override via env for non-default
// deploy locations. File is created with chmod 0600 and must NOT be committed.
const WORKER_IDENTITY_PATH =
  process.env.WORKER_IDENTITY_PATH || './worker-identity.json';

/** Short TTL for the in-memory config cache (ms).
 *  Keeps back-to-back HTTP requests fast without stale-key risk. */
const CONFIG_CACHE_TTL_MS = 5000;

/** JWT token lifetime. AhaMove tokens are valid ~24 h; refresh at 23 h. */
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

/**
 * CORS headers for browser-facing endpoints (/ahamove-estimate-public, /ahamove-book).
 * Origin is locked to the production storefront. Mirrored across both endpoints
 * so the frontend can call the VPS proxy directly from the browser.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://www.bunbohue65.vn',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const CORS_PREFLIGHT_MAX_AGE = 1728000;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function log(level, msg, data) {
  var ts = new Date().toISOString();
  var line = data
    ? '[ahamove-worker] ' + ts + ' [' + level.toUpperCase() + '] ' + msg + ' ' + JSON.stringify(data)
    : '[ahamove-worker] ' + ts + ' [' + level.toUpperCase() + '] ' + msg;
  console.log(line);
}

// ---------------------------------------------------------------------------
// Canister IDL
// ---------------------------------------------------------------------------

function idlFactory({ IDL }) {
  var DriverInfo = IDL.Record({
    name: IDL.Text,
    phone: IDL.Text,
    vehiclePlate: IDL.Text,
    eta: IDL.Opt(IDL.Int),
    lat: IDL.Opt(IDL.Float),
    lng: IDL.Opt(IDL.Float)
  });
  var OrderToSync = IDL.Record({
    orderId: IDL.Text,
    ahamoveOrderId: IDL.Text
  });
  // v1.3.0: added `mobile` field for JWT token auth
  var AhamoveWorkerConfig = IDL.Record({
    apiKey: IDL.Text,
    mobile: IDL.Text,
    isTestMode: IDL.Bool,
    ordersToSync: IDL.Vec(OrderToSync)
  });
  var WorkerConfigResult = IDL.Variant({ ok: AhamoveWorkerConfig, err: IDL.Text });
  var WebhookResult = IDL.Variant({ ok: IDL.Null, err: IDL.Text });
  return IDL.Service({
    getAhamoveWorkerConfig: IDL.Func([], [WorkerConfigResult], ['query']),
    receiveAhamoveWebhook: IDL.Func(
      [IDL.Text, IDL.Text, IDL.Opt(DriverInfo), IDL.Text, IDL.Text],
      [WebhookResult],
      []
    ),
    // postWorkerHeartbeat(workerId) — update, workerPrincipal auth.
    // Worker posts its heartbeat after each successful poll cycle so the
    // canister can track lastHeartbeatAt per worker.
    postWorkerHeartbeat: IDL.Func([IDL.Text], [WebhookResult], [])
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

// ---------------------------------------------------------------------------
// Identity persistence
// ---------------------------------------------------------------------------
// Worker phải có principal cố định qua các lần restart VPS. Ed25519KeyIdentity
// được sinh một lần (lần chạy đầu), lưu ra file JSON (chmod 0600), và nạp lại ở
// các lần sau. Mirrors bkav-worker loadOrCreateIdentity pattern so workerPrincipal
// auth trên getAhamoveWorkerConfig + receiveAhamoveWebhook hoạt động.

function loadOrCreateIdentity(identityPath) {
  var resolvedPath = path.resolve(identityPath);

  // Nếu file đã tồn tại → nạp lại identity cũ để giữ principal.
  if (existsSync(resolvedPath)) {
    try {
      var jsonStr = readFileSync(resolvedPath, 'utf8');
      var identity = Ed25519KeyIdentity.fromJSON(jsonStr);
      var principalText = identity.getPrincipal().toText();
      log('info', 'Loaded persisted worker identity from ' + resolvedPath);
      log('info', 'Worker principal: ' + principalText);
      log('info', 'Register this principal with the canister owner so the worker can be authorized.');
      return identity;
    } catch (err) {
      // File hỏng → log warning và sinh identity mới.
      log('warn', 'Failed to load identity from ' + resolvedPath + ': ' + err.message + '. Generating a new identity.');
    }
  } else {
    log('info', 'No identity file at ' + resolvedPath + '. Generating a new Ed25519KeyIdentity.');
  }

  // Sinh identity mới và ghi ra file.
  var newIdentity = Ed25519KeyIdentity.generate();
  var newPrincipalText = newIdentity.getPrincipal().toText();
  var newJsonStr = JSON.stringify(newIdentity.toJSON());
  try {
    writeFileSync(resolvedPath, newJsonStr, { mode: 0o600 });
    // Đảm bảo quyền 0600 (chỉ owner đọc/ghi) — writeFileSync mode có thể không
    // áp dụng đầy đủ trên mọi filesystem, nên chmodSync lại để chắc chắn.
    try {
      chmodSync(resolvedPath, 0o600);
    } catch (chmodErr) {
      log('warn', 'Could not chmod 0600 on ' + resolvedPath + ': ' + chmodErr.message);
    }
    log('info', 'Saved new worker identity to ' + resolvedPath + ' (chmod 0600)');
  } catch (writeErr) {
    log('error', 'Failed to write identity file ' + resolvedPath + ': ' + writeErr.message);
    log('warn', 'Worker will continue with an in-memory identity — principal will change on restart.');
  }

  log('info', 'Worker principal: ' + newPrincipalText);
  log('info', 'Register this principal with the canister owner so the worker can be authorized.');
  return newIdentity;
}

// ---------------------------------------------------------------------------
// Exponential backoff delay helper
// ---------------------------------------------------------------------------
// delay = min(RETRY_BASE_DELAY_MS * (RETRY_MULTIPLIER^attempt), RETRY_MAX_DELAY_MS)
// attempt is 1-indexed (first retry → attempt=1).
//   attempt 1 → 5000 * 2^1 = 10000? No — we use attempt as the exponent base
//   directly so the first retry waits baseDelay (5000ms), giving a gentle ramp:
//     attempt 1 → 5000 * 2^0 = 5000ms
//     attempt 2 → 5000 * 2^1 = 10000ms
//     attempt 3 → 5000 * 2^2 = 20000ms
//   All well below the 60000ms cap, but the cap protects against runaway growth
//   if maxRetries is raised later.

function computeRetryDelay(attempt) {
  var exp = Math.pow(RETRY_MULTIPLIER, attempt - 1);
  var delay = RETRY_BASE_DELAY_MS * exp;
  return Math.min(delay, RETRY_MAX_DELAY_MS);
}

function mapAhamoveStatus(s) {
  var u = (s || '').toUpperCase();
  if (u === 'IDLE' || u === 'PROCESSING' || u === 'ASSIGNING') return 'ASSIGNING';
  if (u === 'ACCEPTED') return 'ACCEPTED';
  if (u === 'IN_PROCESS' || u === 'PICKING' || u === 'PICKING_UP') return 'IN_PROCESS';
  if (u === 'DELIVERING') return 'DELIVERING';
  if (u === 'COMPLETED') return 'COMPLETED';
  if (u === 'CANCEL' || u === 'CANCELLED' || u === 'FAILED') return 'CANCEL';
  return s || '';
}

function ahamoveBaseUrl(isTestMode) {
  return isTestMode
    ? 'https://partner-apistg.ahamove.com'
    : 'https://partner-api.ahamove.com';
}

// ---------------------------------------------------------------------------
// Config cache — avoids repeated canister calls during a single HTTP request
// ---------------------------------------------------------------------------

var _configCache = null;
var _configCacheTs = 0;

async function getConfig(actor) {
  var now = Date.now();
  if (_configCache && (now - _configCacheTs) < CONFIG_CACHE_TTL_MS) {
    return _configCache;
  }
  var result = await actor.getAhamoveWorkerConfig();
  if (!result || result.ok === undefined) {
    throw new Error('getAhamoveWorkerConfig error: ' + (result && result.err ? result.err : 'no config'));
  }
  var config = result.ok;
  if (!config.apiKey || config.apiKey.length === 0) {
    throw new Error('AhaMove API key not configured in Business Profile');
  }
  _configCache = config;
  _configCacheTs = now;
  return config;
}

// ---------------------------------------------------------------------------
// AhaMove API helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a single order from AhaMove v3.
 * Uses getAuthToken() — supports both JWT (mobile configured) and API-Key-as-Bearer.
 * Retries once on 401 after refreshing the token.
 */
async function fetchAhamoveOrder(ahamoveOrderId, config) {
  var url = ahamoveBaseUrl(config.isTestMode) + '/v3/orders/' + encodeURIComponent(ahamoveOrderId);

  for (var attempt = 0; attempt < 2; attempt++) {
    var token = await getAuthToken(config);
    var resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    if (resp.status === 401 && attempt === 0) {
      // Token expired — reset cache and retry once
      log('warn', 'fetchAhamoveOrder 401, resetting token cache and retrying');
      cachedToken = '';
      tokenExpiresAt = 0;
      continue;
    }

    if (!resp.ok) {
      throw new Error('AhaMove API HTTP ' + resp.status + ' for order ' + ahamoveOrderId);
    }
    return await resp.json();
  }

  throw new Error('AhaMove API: exhausted retries for order ' + ahamoveOrderId);
}

// ---------------------------------------------------------------------------
// Driver info extraction
// ---------------------------------------------------------------------------

function extractDriverInfoFromPollResponse(orderData) {
  var sup = orderData.supplier_id || null;
  if (!sup || typeof sup !== 'object' || !sup.name) return [];
  // AhaMove /v3/orders response may include supplier_id.lat / supplier_id.lng
  // but they are not guaranteed — read null-safe and only wrap when numeric.
  var lat = (typeof sup.lat === 'number' && isFinite(sup.lat)) ? [sup.lat] : [];
  var lng = (typeof sup.lng === 'number' && isFinite(sup.lng)) ? [sup.lng] : [];
  return [{
    name: sup.name || '',
    phone: sup.mobile || '',
    vehiclePlate: sup.plate_number || '',
    eta: sup.eta ? [BigInt(sup.eta)] : [],
    lat: lat,
    lng: lng
  }];
}

function extractDriverInfoFromWebhook(payload) {
  var supplierName = payload.supplier_name || '';
  if (!supplierName) return [];
  var phone = '';
  if (Array.isArray(payload.path) && payload.path.length > 0 && payload.path[0].mobile) {
    phone = payload.path[0].mobile;
  }
  // Webhook payload does not carry driver coordinates — leave lat/lng null.
  // The canister preserves the last known lat/lng from polling refreshes.
  return [{
    name: supplierName,
    phone: phone,
    vehiclePlate: '',
    eta: [],
    lat: [],
    lng: []
  }];
}

// ---------------------------------------------------------------------------
// Status tracking maps
// ---------------------------------------------------------------------------

var lastStatusMap = new Map();
var ahamoveToOrderIdMap = new Map();

// ---------------------------------------------------------------------------
// JWT Token cache
// ---------------------------------------------------------------------------

var cachedToken = '';
var tokenExpiresAt = 0;  // Unix timestamp ms
var lastApiKey = '';

/**
 * Get a fresh JWT from AhaMove /v3/accounts/token.
 * Caches the token for TOKEN_TTL_MS (23 h) to avoid repeated login calls.
 */
async function getAhamoveToken(mobile, apiKey, isTestMode) {
  var now = Date.now();
  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  var base = ahamoveBaseUrl(isTestMode);
  var resp = await fetch(base + '/v3/accounts/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: mobile, api_key: apiKey }),
    timeout: 15000
  });
  var data = await resp.json();
  if (!resp.ok) {
    throw new Error('AhaMove token error ' + resp.status + ': ' + JSON.stringify(data));
  }
  cachedToken = data.token;
  tokenExpiresAt = now + TOKEN_TTL_MS;
  log('info', 'AhaMove token refreshed', { expiresAt: new Date(tokenExpiresAt).toISOString() });
  return cachedToken;
}

/**
 * Returns the bearer token to use for AhaMove API calls:
 *  - If config.mobile is set → fetch JWT via /v3/accounts/token
 *  - Otherwise → use apiKey directly (backwards compat for v1.2.0 canister)
 * Resets token cache when apiKey changes.
 */
async function getAuthToken(config) {
  // Invalidate cached token if the API key changed
  if (config.apiKey !== lastApiKey) {
    cachedToken = '';
    tokenExpiresAt = 0;
    lastApiKey = config.apiKey;
  }

  var mobile = (config.mobile || '').trim();
  if (mobile.length > 0) {
    return await getAhamoveToken(mobile, config.apiKey, config.isTestMode);
  }
  // Backwards compat: no mobile configured → use apiKey as Bearer directly
  return config.apiKey;
}

function refreshOrdersToSyncMap(ordersToSync) {
  ahamoveToOrderIdMap.clear();
  for (var i = 0; i < ordersToSync.length; i++) {
    var e = ordersToSync[i];
    if (e.ahamoveOrderId && e.orderId) {
      ahamoveToOrderIdMap.set(e.ahamoveOrderId, e.orderId);
    }
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

async function processOrder(actor, orderEntry, config) {
  var orderId = orderEntry.orderId;
  var ahamoveOrderId = orderEntry.ahamoveOrderId;
  var lastError = '';
  for (var attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      var orderData = await fetchAhamoveOrder(ahamoveOrderId, config);
      var mappedStatus = mapAhamoveStatus(orderData.status || '');
      if (lastStatusMap.get(orderId) === mappedStatus) {
        log('info', 'Status unchanged, skipping', { orderId: orderId, status: mappedStatus });
        return;
      }
      var driverInfoArg = extractDriverInfoFromPollResponse(orderData);
      var result = await actor.receiveAhamoveWebhook(
        orderId,
        mappedStatus,
        driverInfoArg,
        '',
        JSON.stringify({ orderId: orderId, status: mappedStatus })
      );
      if (result && result.ok !== undefined) {
        lastStatusMap.set(orderId, mappedStatus);
        log('info', 'Poll webhook delivered', { orderId: orderId, status: mappedStatus });
      } else {
        log('warn', 'Poll canister error', { orderId: orderId, error: result && result.err });
      }
      return;
    } catch (err) {
      lastError = err.message;
      if (attempt < MAX_RETRIES) {
        var delay = computeRetryDelay(attempt);
        log('warn', 'processOrder retrying', { orderId: orderId, attempt: attempt, nextDelayMs: delay, error: lastError });
        await sleep(delay);
      }
    }
  }
  log('error', 'processOrder exhausted retries', { orderId: orderId, error: lastError });
}

async function pollAndProcess(actor) {
  log('info', 'Polling for active AhaMove orders...');
  try {
    var config = await getConfig(actor);
    var ordersToSync = config.ordersToSync || [];
    refreshOrdersToSyncMap(ordersToSync);
    log('info', 'Orders to sync: ' + ordersToSync.length, { isTestMode: config.isTestMode });
    for (var i = 0; i < ordersToSync.length; i++) {
      var entry = ordersToSync[i];
      if (!entry.ahamoveOrderId) continue;
      processOrder(actor, entry, config)
        .catch(function (e) { log('error', e.message); });
    }
    // Post heartbeat after a successful poll cycle so the canister can track
    // worker liveness (lastHeartbeatAt). Fire-and-forget — a heartbeat failure
    // must not abort the poll loop. workerPrincipal auth is provided by the
    // Ed25519KeyIdentity-loaded agent.
    postHeartbeat(actor);
  } catch (err) {
    log('error', 'Poll error: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

function postHeartbeat(actor) {
  actor.postWorkerHeartbeat(WORKER_ID)
    .then(function (result) {
      if (result && result.ok !== undefined) {
        log('info', 'Heartbeat posted', { workerId: WORKER_ID });
      } else {
        log('warn', 'Heartbeat canister error', { workerId: WORKER_ID, error: result && result.err });
      }
    })
    .catch(function (err) {
      log('warn', 'Heartbeat failed (non-fatal)', { workerId: WORKER_ID, error: err.message });
    });
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

async function handleIncomingWebhook(actor, rawBody, signature) {
  var payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    log('warn', 'Invalid JSON webhook: ' + e.message);
    return;
  }

  var safeFields = [
    '_id', 'status', 'sub_status', 'supplier_id', 'supplier_name',
    'city_id', 'service_id', 'payment_method', 'distance', 'total_pay'
  ];
  var safeLog = {};
  for (var fi = 0; fi < safeFields.length; fi++) {
    var f = safeFields[fi];
    if (payload[f] !== undefined) safeLog[f] = payload[f];
  }

  var ahamoveOrderId = payload._id || '';
  if (!ahamoveOrderId) {
    log('warn', 'Webhook missing _id', { payload: safeLog });
    return;
  }

  var mappedStatus = mapAhamoveStatus(payload.status || '');
  var driverInfoArg = extractDriverInfoFromWebhook(payload);
  var tableOrderId = ahamoveToOrderIdMap.get(ahamoveOrderId) || ahamoveOrderId;

  log('info', 'Forwarding webhook to canister', {
    ahamoveOrderId: ahamoveOrderId,
    tableOrderId: tableOrderId,
    mappedStatus: mappedStatus,
    hasDriver: driverInfoArg.length > 0,
    sigLen: signature.length
  });

  try {
    var result = await actor.receiveAhamoveWebhook(
      tableOrderId,
      mappedStatus,
      driverInfoArg,
      signature,
      rawBody
    );
    if (result && result.ok !== undefined) {
      log('info', 'Canister processed webhook OK', { tableOrderId: tableOrderId, status: mappedStatus });
    } else {
      log('warn', 'Canister webhook error', { tableOrderId: tableOrderId, error: result && result.err });
    }
  } catch (err) {
    log('error', 'receiveAhamoveWebhook failed: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// HTTP server — health, estimate, book, webhook
// ---------------------------------------------------------------------------

function startHealthServer(actor) {
  var http = require('http');

  http.createServer(function (req, res) {

    // GET /health
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now(), version: '1.4.3' }));

    // POST /ahamove-webhook
    } else if (req.url === '/ahamove-webhook' && req.method === 'POST') {
      var body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', function () {
        var sig = req.headers['x-ahamove-signature'] || '';
        log('info', 'Received AhaMove webhook', { bodyLen: body.length, sigPresent: sig.length > 0 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
        handleIncomingWebhook(actor, body, sig).catch(function (e) { log('error', e.message); });
      });

    // POST /ahamove-estimate
    } else if (req.url === '/ahamove-estimate' && req.method === 'POST') {
      var body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', async function () {
        try {
          var payload = JSON.parse(body);

          // Fetch config from canister (cached 5 s)
          var config = await getConfig(actor);
          var isTestMode = typeof payload.isTestMode === 'boolean'
            ? payload.isTestMode
            : config.isTestMode;
          var effectiveConfig = Object.assign({}, config, { isTestMode: isTestMode });

          var baseUrl = ahamoveBaseUrl(isTestMode);

          for (var attempt = 0; attempt < 2; attempt++) {
            var token = await getAuthToken(effectiveConfig);
            var resp = await fetch(baseUrl + '/v3/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({
                path: payload.path,
                service_id: payload.serviceId || 'HAN-BIKE',
                payment_method: payload.payment_method || 'CASH_BY_RECIPIENT',
                order_time: 0
              }),
              timeout: 15000
            });

            if (resp.status === 401 && attempt === 0) {
              log('warn', 'ahamove-estimate 401, resetting token cache and retrying');
              cachedToken = '';
              tokenExpiresAt = 0;
              continue;
            }

            var data = await resp.json();
            if (!resp.ok) {
              log('warn', 'AhaMove estimate error', { status: resp.status, body: JSON.stringify(data) });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'AhaMove error ' + resp.status + ': ' + JSON.stringify(data) }));
              return;
            }

            // Extract price and distance from response (order object or top-level)
            var order_id = data.order_id || '';
            var total_price = data.order ? (data.order.total_price || 0) : (data.total_price || 0);
            var distance = data.order ? (data.order.distance || 0) : (data.distance || 0);

            // Fire-and-forget cancel to avoid leaving a real delivery order open
            if (order_id) {
              (function cancelEstimateOrder(oid, tok, url) {
                fetch(url + '/v3/orders/' + encodeURIComponent(oid), {
                  method: 'DELETE',
                  headers: { 'Authorization': 'Bearer ' + tok },
                  timeout: 10000
                })
                  .then(function () { log('info', 'Estimate order cancelled', { order_id: oid }); })
                  .catch(function (e) { log('warn', 'Estimate order cancel failed (ignored)', { order_id: oid, error: e.message }); });
              })(order_id, token, baseUrl);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ total_price: total_price, distance: distance }));
            return;
          }

          // Exhausted retries
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'AhaMove: exhausted retries after 401' }));
        } catch (err) {
          log('error', 'ahamove-estimate handler error: ' + err.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Network error: ' + err.message }));
        }
      });

    // POST /ahamove-book
    } else if (req.url === '/ahamove-book' && req.method === 'POST') {
      var body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', async function () {
        try {
          var payload = JSON.parse(body);

          // Fetch config from canister (cached 5 s)
          var config = await getConfig(actor);
          var isTestMode = typeof payload.isTestMode === 'boolean'
            ? payload.isTestMode
            : config.isTestMode;
          var effectiveConfig = Object.assign({}, config, { isTestMode: isTestMode });

          var baseUrl = ahamoveBaseUrl(isTestMode);

          for (var attempt = 0; attempt < 2; attempt++) {
            var token = await getAuthToken(effectiveConfig);
            var resp = await fetch(baseUrl + '/v3/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({
                path: payload.path,
                service_id: payload.serviceId || 'HAN-BIKE',
                payment_method: payload.payment_method || 'CASH_BY_RECIPIENT',
                order_time: 0,
                remarks: payload.remarks || ''
              }),
              timeout: 15000
            });

            if (resp.status === 401 && attempt === 0) {
              log('warn', 'ahamove-book 401, resetting token cache and retrying');
              cachedToken = '';
              tokenExpiresAt = 0;
              continue;
            }

            var data = await resp.json();
            if (!resp.ok) {
              log('warn', 'AhaMove book error', { status: resp.status, body: JSON.stringify(data) });
              res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS));
              res.end(JSON.stringify({ error: 'AhaMove error ' + resp.status + ': ' + JSON.stringify(data) }));
              return;
            }

            // Extract order id, status, price and distance from response.
            // AhaMove /v3/orders returns the order object at the top level
            // (data._id, data.status, data.total_price, data.distance) — same
            // shape /ahamove-estimate reads. total_price/distance are surfaced
            // so the frontend can persist the fare as shippingFee.
            var order_id = data._id || data.order_id || '';
            var status = data.status || 'IDLE';
            var total_price = data.order ? (data.order.total_price || 0) : (data.total_price || 0);
            var distance = data.order ? (data.order.distance || 0) : (data.distance || 0);

            res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS));
            res.end(JSON.stringify({
              order_id: order_id,
              status: status,
              total_price: total_price,
              distance: distance
            }));
            return;
          }

          // Exhausted retries
          res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS));
          res.end(JSON.stringify({ error: 'AhaMove: exhausted retries after 401' }));
        } catch (err) {
          log('error', 'ahamove-book handler error: ' + err.message);
          res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS));
          res.end(JSON.stringify({ error: 'Network error: ' + err.message }));
        }
      });

    // OPTIONS /ahamove-book (CORS preflight)
    } else if (req.url === '/ahamove-book' && req.method === 'OPTIONS') {
      res.writeHead(204, Object.assign({ 'Access-Control-Max-Age': String(CORS_PREFLIGHT_MAX_AGE) }, CORS_HEADERS));
      res.end();

    // POST /ahamove-estimate-public (no auth required)
    } else if (req.url === '/ahamove-estimate-public' && req.method === 'POST') {
      var body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', async function () {
        try {
          var payload = JSON.parse(body);

          // Fetch config from canister (cached 5 s)
          var config = await getConfig(actor);
          var isTestMode = typeof payload.isTestMode === 'boolean'
            ? payload.isTestMode
            : config.isTestMode;
          var effectiveConfig = Object.assign({}, config, { isTestMode: isTestMode });

          var baseUrl = ahamoveBaseUrl(isTestMode);

          for (var attempt = 0; attempt < 2; attempt++) {
            var token = await getAuthToken(effectiveConfig);
            var resp = await fetch(baseUrl + '/v3/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
              },
              body: JSON.stringify({
                path: payload.path,
                service_id: payload.serviceId || 'HAN-BIKE',
                payment_method: payload.payment_method || 'CASH_BY_RECIPIENT',
                order_time: 0
              }),
              timeout: 15000
            });

            if (resp.status === 401 && attempt === 0) {
              log('warn', 'ahamove-estimate-public 401, resetting token cache and retrying');
              cachedToken = '';
              tokenExpiresAt = 0;
              continue;
            }

            var data = await resp.json();
            if (!resp.ok) {
              log('warn', 'AhaMove estimate-public error', { status: resp.status, body: JSON.stringify(data) });
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://www.bunbohue65.vn',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              });
              res.end(JSON.stringify({ error: 'AhaMove error ' + resp.status + ': ' + JSON.stringify(data) }));
              return;
            }

            // Extract price and distance from response (order object or top-level)
            var order_id = data.order_id || '';
            var total_price = data.order ? (data.order.total_price || 0) : (data.total_price || 0);
            var distance = data.order ? (data.order.distance || 0) : (data.distance || 0);

            // Fire-and-forget cancel to avoid leaving a real delivery order open
            if (order_id) {
              (function cancelEstimateOrder(oid, tok, url) {
                fetch(url + '/v3/orders/' + encodeURIComponent(oid), {
                  method: 'DELETE',
                  headers: { 'Authorization': 'Bearer ' + tok },
                  timeout: 10000
                })
                  .then(function () { log('info', 'Estimate-public order cancelled', { order_id: oid }); })
                  .catch(function (e) { log('warn', 'Estimate-public order cancel failed (ignored)', { order_id: oid, error: e.message }); });
              })(order_id, token, baseUrl);
            }

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'https://www.bunbohue65.vn',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify({ total_price: total_price, distance: distance }));
            return;
          }

          // Exhausted retries
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://www.bunbohue65.vn',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify({ error: 'AhaMove: exhausted retries after 401' }));
        } catch (err) {
          log('error', 'ahamove-estimate-public handler error: ' + err.message);
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://www.bunbohue65.vn',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify({ error: 'Network error: ' + err.message }));
        }
      });

    // OPTIONS /ahamove-estimate-public (CORS preflight)
    } else if (req.url === '/ahamove-estimate-public' && req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': 'https://www.bunbohue65.vn',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      });
      res.end();

    // 404
    } else {
      res.writeHead(404);
      res.end();
    }

  }).listen(PORT, function () {
    log('info', 'Health-check server listening on port ' + PORT);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('info', 'Starting AhaMove shipper worker v1.5.0');
  log('info', 'Backend canister: ' + BACKEND_CANISTER_ID);
  log('info', 'IC host: ' + IC_HOST);
  log('info', 'Poll interval: ' + POLL_INTERVAL_MS + 'ms');

  // Load (or create) the persisted Ed25519KeyIdentity BEFORE creating the
  // HttpAgent so the agent signs all canister calls with a stable principal.
  // getAhamoveWorkerConfig and receiveAhamoveWebhook now require workerPrincipal
  // auth — an anonymous agent would be rejected.
  var identity = loadOrCreateIdentity(WORKER_IDENTITY_PATH);
  var agent = new HttpAgent({ host: IC_HOST, fetch: fetch, identity: identity });

  // Local replica (dev) requires the root key to be fetched explicitly.
  if (IC_HOST.indexOf('localhost') !== -1 || IC_HOST.indexOf('127.0.0.1') !== -1) {
    await agent.fetchRootKey();
  }

  var actor = Actor.createActor(idlFactory, {
    agent: agent,
    canisterId: Principal.fromText(BACKEND_CANISTER_ID)
  });

  startHealthServer(actor);

  // Initial poll
  await pollAndProcess(actor).catch(function (e) { log('error', e.message); });

  // Recurring poll every 15 s
  var id = setInterval(function () {
    pollAndProcess(actor).catch(function (e) { log('error', e.message); });
  }, POLL_INTERVAL_MS);

  process.on('SIGTERM', function () { clearInterval(id); process.exit(0); });
  process.on('SIGINT', function () { clearInterval(id); process.exit(0); });
}

main().catch(console.error);
