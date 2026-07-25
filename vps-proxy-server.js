"use strict";

/**
 * VPS Proxy Server cho BKAV eHoadon + Tingee generate-dynamic-qr
 * Deploy path trên VPS: /home/bkav-proxy/server.js
 * Chạy bằng: pm2 start server.js --name bkav-proxy
 *
 * IC có ~11 replica, tất cả gọi cùng 1 lúc cho 1 giao dịch.
 * Proxy chỉ gọi upstream 1 lần, cache kết quả,
 * trả về cùng 1 kết quả cho tất cả replica.
 * IC đạt consensus vì nhận được byte-for-byte identical response.
 *
 * Cách dùng từ IC backend (Motoko):
 *   BKAV:  POST https://proxy.bunbohue65.vn/bkav-prod?key=ORDER_<id>
 *          (hoặc header: x-order-id: ORDER_<id>)
 *   Tingee: POST https://proxy.bunbohue65.vn/tingee-generate
 *          Body JSON + headers (x-client-id, x-signature, x-request-timestamp)
 *          Signature Option A: IC ký HMAC-SHA512, VPS chỉ forward — secretToken
 *          không bao giờ rời IC, VPS không lưu secret.
 */

const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint BKAV production và demo
const BKAV_PROD_URL = "https://ws.ehoadon.vn/WSPublicEhoadon.asmx/ExecCommand";
const BKAV_DEMO_URL = "https://wsdemo.ehoadon.vn/WSPublicEhoadon.asmx/ExecCommand";

// Endpoint Tingee generate-dynamic-qr
const TINGEE_GENERATE_URL = "https://api.tingee.vn/v1/generate-dynamic-qr";
const TINGEE_BANKS_URL = "https://api.tingee.vn/v1/get-banks";
const TINGEE_STATUS_URL = "https://api.tingee.vn/v1/get-status-dynamic-qr";
const TINGEE_DELETE_URL = "https://api.tingee.vn/v1/delete-dynamic-qr";

// Endpoint Ahamove booking
const AHAMOVE_BOOK_URL = "https://api.ahamove.com/v1/order/create";

// Canister ID để forward webhook (worker cũng dùng cùng canister).
const CANISTER_ID = process.env.CANISTER_ID || "52szj-eyaaa-aaaab-qhcpa-cai";
const IC_HOST = process.env.IC_HOST || "https://icp0.io";

/**
 * Dedup cache:
 * Map<dedupKey, {
 *   status: 'pending' | 'done',
 *   result: string,          // stripped XML trả về IC (byte-for-byte cố định)
 *   fullResult: object,      // dữ liệu đầy đủ từ BKAV (số HĐ, GUID...)
 *   waiters: Function[],     // các replica đang chờ
 *   ts: number               // timestamp để tính TTL
 * }>
 */
const cache = new Map();
const CACHE_TTL_MS = 30_000; // 30 giây

/**
 * Tingee generate-dynamic-qr cache (riêng biệt với BKAV cache).
 * TTL 10 phút — regenerate cùng orderCode trong 10 phút trả cùng 1 QR.
 * Key = idempotencyKey (HMAC-SHA256 của orderCode do IC tính).
 */
const tingeeCache = new Map();
const TINGEE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút

// Dọn cache hết hạn mỗi 60 giây
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of cache.entries()) {
    if (entry.status === "done" && now - entry.ts > CACHE_TTL_MS) {
      cache.delete(key);
      cleaned++;
    }
  }
  // Dọn Tingee cache
  let tingeeCleaned = 0;
  for (const [key, entry] of tingeeCache.entries()) {
    if (entry.status === "done" && now - entry.ts > TINGEE_CACHE_TTL_MS) {
      tingeeCache.delete(key);
      tingeeCleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(
      `[${new Date().toISOString()}] BKAV cache cleanup: xóa ${cleaned} entry hết hạn. Còn lại: ${cache.size}`
    );
  }
  if (tingeeCleaned > 0) {
    console.log(
      `[${new Date().toISOString()}] Tingee cache cleanup: xóa ${tingeeCleaned} entry hết hạn. Còn lại: ${tingeeCache.size}`
    );
  }
}, 60_000);

/**
 * Gọi BKAV SOAP qua HTTPS thuần
 * @param {string} targetUrl - URL endpoint BKAV
 * @param {string} soapBody - nội dung SOAP XML
 * @param {object} headers - HTTP headers từ IC chuyển tiếp
 * @returns {Promise<{statusCode: number, body: string}>}
 */
function callBkav(targetUrl, soapBody, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ""),
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Content-Length": Buffer.byteLength(soapBody, "utf8"),
        ...headers,
      },
      timeout: 30_000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      );
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("BKAV request timed out"));
    });
    req.on("error", reject);
    req.write(soapBody, "utf8");
    req.end();
  });
}

/**
 * Gọi Tingee REST API qua HTTPS thuần.
 * VPS chỉ forward — không thêm/không bớt gì, không có secretToken.
 * Signature Option A: IC ký HMAC-SHA512 và gửi x-signature header,
 * VPS forward nguyên vẹn header đó sang Tingee.
 *
 * @param {string} targetUrl - URL endpoint Tingee
 * @param {Buffer} body - raw body từ IC (JSON)
 * @param {object} headers - HTTP headers từ IC chuyển tiếp (đã lọc)
 * @returns {Promise<{statusCode: number, body: string, headers: object}>}
 */
function callTingee(targetUrl, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ""),
      method: "POST",
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 30_000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
          headers: res.headers,
        })
      );
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Tingee request timed out"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Gọi Tingee REST API với method GET (dùng cho /get-banks).
 * Tingee signature cho GET: bodyJson = '{}' (chuỗi rỗng JSON object).
 * VPS chỉ forward — IC ký HMAC-SHA512 và gửi x-signature header.
 *
 * @param {string} targetUrl - URL endpoint Tingee
 * @param {object} headers - HTTP headers từ IC chuyển tiếp (đã lọc)
 * @returns {Promise<{statusCode: number, body: string, headers: object}>}
 */
function callTingeeGet(targetUrl, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ""),
      method: "GET",
      headers: {
        ...headers,
        accept: "application/json",
      },
      timeout: 30_000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
          headers: res.headers,
        })
      );
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Tingee GET request timed out"));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Gọi Ahamove REST API qua HTTPS thuần.
 * VPS chỉ forward — IC gửi body JSON + headers, VPS forward nguyên vẹn.
 *
 * @param {string} targetUrl - URL endpoint Ahamove
 * @param {Buffer} body - raw body từ IC (JSON)
 * @param {object} headers - HTTP headers từ IC chuyển tiếp (đã lọc)
 * @returns {Promise<{statusCode: number, body: string, headers: object}>}
 */
function callAhamove(targetUrl, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + (url.search || ""),
      method: "POST",
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 30_000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
          headers: res.headers,
        })
      );
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Ahamove request timed out"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Forward webhook về canister IC qua @dfinity/agent (update call).
 * Dùng cho /webhook/tingee và /webhook/ahamove.
 *
 * Vì vps-proxy-server.js chạy trên Node CommonJS và không có @dfinity/agent
 * ở đây (worker có), route webhook này forward qua HTTP raw boundary
 * (https://<canister>.raw.icp0.io/<method>) — canister expose http_update.
 *
 * Tuy nhiên canister dùng update call (receiveTingeeWebhook /
 * receiveAhamoveWebhook) chứ không phải http_request. Do đó route này
 * chỉ log webhook và trả 200 cho upstream — worker sẽ poll canister
 * để lấy pending items và callback. Webhook từ Tingee/Ahamove chủ yếu
 * dùng để worker biết "có event mới" (nếu worker subscribe) hoặc
 * canister tự poll.
 *
 * Đơn giản nhất: route này forward body + headers về canister qua
 * HTTP raw boundary nếu canister expose http_update cho webhook path,
 * ngược lại trả 200 và log.
 *
 * @param {string} canisterMethod - tên method canister (receiveTingeeWebhook / receiveAhamoveWebhook)
 * @param {Buffer} rawBody - raw body webhook
 * @param {object} headers - headers webhook
 * @returns {Promise<{statusCode: number, body: string}>}
 */
function forwardWebhookToCanister(canisterMethod, rawBody, headers) {
  return new Promise((resolve, reject) => {
    // Forward qua raw boundary: https://<canister>.raw.icp0.io/<method>
    // Canister phải expose http_update cho path này, hoặc dùng canister
    // method trực tiếp qua @dfinity/agent (worker sẽ làm việc đó).
    // Ở đây ta forward body + headers nguyên vẹn.
    const callbackUrl = `https://${CANISTER_ID}.raw.icp0.io/${canisterMethod}`;
    const url = new URL(callbackUrl);

    // Chuyển headers array [(name, value), ...] cho canister
    const headerPairs = [];
    for (const [k, v] of Object.entries(headers)) {
      if (!["host", "content-length", "transfer-encoding", "connection"].includes(k.toLowerCase())) {
        headerPairs.push([k, String(v)]);
      }
    }

    // Canister receiveTingeeWebhook(body: Blob, headers: [(Text, Text)])
    // Forward body raw + headers array. Raw boundary không hỗ trợ trực tiếp
    // Candid args, nên ta wrap thành JSON { body: base64, headers: [[k,v],...] }.
    const wrapper = JSON.stringify({
      body: rawBody.toString("base64"),
      headers: headerPairs,
    });
    const bodyBuf = Buffer.from(wrapper, "utf8");

    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": bodyBuf.length,
      },
      timeout: 30_000,
    };

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
        })
      );
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Canister webhook forward timed out"));
    });
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });
}

/**
 * Strip các trường động khỏi BKAV response.
 * IC cần output byte-for-byte giống nhau giữa tất cả replica để đạt consensus.
 * Chỉ giữ lại mã lỗi E và thông điệp M (nếu lỗi).
 * Các trường động như G (GUID), N (số HĐ), C (mã CQT) bị bỏ hoàn toàn.
 *
 * @param {string} rawXml - XML thô từ BKAV
 * @returns {string} XML tối giản, cố định
 */
function stripDynamicFields(rawXml) {
  try {
    // Bỏ UTF-8 BOM nếu có
    const xml = rawXml.replace(/^\uFEFF/, "").trim();

    // Đọc mã lỗi <E>
    const eMatch = xml.match(/<E>([\s\S]*?)<\/E>/i);
    const errorCode = eMatch ? eMatch[1].trim() : "";

    if (errorCode === "0") {
      // Thành công — chỉ trả <R><E>0</E></R>, bỏ GUID/số HĐ động
      return "<R><E>0</E></R>";
    }

    // Lỗi — giữ thông điệp nhưng escape HTML
    const mMatch = xml.match(/<M>([\s\S]*?)<\/M>/i);
    const msg = mMatch ? mMatch[1].trim().replace(/[<>]/g, "") : "error";
    return `<R><E>1</E><M>${msg}</M></R>`;
  } catch (_) {
    return "<R><E>1</E><M>parse_error</M></R>";
  }
}

/**
 * Trích xuất dữ liệu đầy đủ từ BKAV response để lưu trong cache.
 * IC sẽ gọi /bkav-result/:key sau khi đồng thuận để lấy số hóa đơn thật.
 *
 * @param {string} rawXml
 * @returns {{ errorCode: string, invoiceGuid: string, invoiceNo: string, taxCode: string, message: string }}
 */
function extractFullResult(rawXml) {
  const result = {
    errorCode: "",
    invoiceGuid: "",
    invoiceNo: "",
    taxCode: "",
    message: "",
  };
  try {
    const xml = rawXml.replace(/^\uFEFF/, "");
    const eMatch = xml.match(/<E>([\s\S]*?)<\/E>/i);
    if (eMatch) result.errorCode = eMatch[1].trim();
    const gMatch = xml.match(/<G>([\s\S]*?)<\/G>/i);
    if (gMatch) result.invoiceGuid = gMatch[1].trim();
    const nMatch = xml.match(/<N>([\s\S]*?)<\/N>/i);
    if (nMatch) result.invoiceNo = nMatch[1].trim();
    const cMatch = xml.match(/<C>([\s\S]*?)<\/C>/i);
    if (cMatch) result.taxCode = cMatch[1].trim();
    const mMatch = xml.match(/<M>([\s\S]*?)<\/M>/i);
    if (mMatch) result.message = mMatch[1].trim();
  } catch (_) {
    // Giữ giá trị mặc định rỗng
  }
  return result;
}

// Middleware thu thập raw body dạng Buffer (cần để forward nguyên vẹn sang BKAV)
app.use((req, res, next) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
});

/**
 * Tạo handler cho từng endpoint BKAV (prod/demo).
 *
 * Logic deduplication:
 *   1. Không có dedupKey → forward thẳng (không cache)
 *   2. Key đã có trong cache (done) → trả cache ngay
 *   3. Key đang pending → queue vào waiters, chờ kết quả
 *   4. Key chưa có → gọi BKAV 1 lần, lưu cache, notify waiters
 *
 * dedupKey được truyền qua:
 *   - query param: ?key=ORDER_123
 *   - header: x-dedup-key  hoặc  x-order-id
 *
 * @param {string} bkavUrl - BKAV_PROD_URL hoặc BKAV_DEMO_URL
 */
function handleBkavRequest(bkavUrl) {
  return async (req, res) => {
    // Đọc dedup key từ query param hoặc header
    const dedupKey =
      req.query.key ||
      req.headers["x-dedup-key"] ||
      req.headers["x-order-id"] ||
      null;

    const soapBody = req.rawBody.toString("utf8");

    // Lọc headers: bỏ các header mà BKAV không cần / có thể gây lỗi
    const forwardHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const lk = k.toLowerCase();
      if (
        !["host", "content-length", "transfer-encoding", "connection"].includes(
          lk
        )
      ) {
        forwardHeaders[k] = v;
      }
    }

    // --- Không có dedupKey: forward thẳng, không cache ---
    if (!dedupKey) {
      console.log(
        `[${new Date().toISOString()}] No dedup key — forwarding directly to ${bkavUrl}`
      );
      try {
        const { statusCode, body } = await callBkav(
          bkavUrl,
          soapBody,
          forwardHeaders
        );
        res
          .status(statusCode)
          .set("Content-Type", "text/xml; charset=utf-8")
          .send(stripDynamicFields(body));
      } catch (err) {
        console.error(`[BKAV direct error] ${err.message}`);
        res
          .status(500)
          .set("Content-Type", "text/xml; charset=utf-8")
          .send("<R><E>1</E><M>proxy_error</M></R>");
      }
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Request key=${dedupKey} url=${bkavUrl}`
    );

    // --- Cache HIT ---
    const existing = cache.get(dedupKey);
    if (existing && existing.status === "done") {
      console.log(
        `[${new Date().toISOString()}] Cache HIT key=${dedupKey} errorCode=${existing.fullResult?.errorCode}`
      );
      return res
        .status(200)
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(existing.result);
    }

    // --- Đang pending: xếp vào hàng chờ ---
    if (existing && existing.status === "pending") {
      console.log(
        `[${new Date().toISOString()}] Pending key=${dedupKey} — queuing waiter`
      );
      await new Promise((resolve) => existing.waiters.push(resolve));
      const done = cache.get(dedupKey);
      return res
        .status(200)
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(done ? done.result : "<R><E>1</E><M>dedup_timeout</M></R>");
    }

    // --- First request: gọi BKAV 1 lần duy nhất ---
    const entry = {
      status: "pending",
      result: null,
      fullResult: null,
      waiters: [],
      ts: Date.now(),
    };
    cache.set(dedupKey, entry);

    try {
      console.log(
        `[${new Date().toISOString()}] Calling BKAV for key=${dedupKey}`
      );
      const { statusCode, body } = await callBkav(
        bkavUrl,
        soapBody,
        forwardHeaders
      );

      const stripped = stripDynamicFields(body);
      const fullResult = extractFullResult(body);

      // Lưu kết quả vào cache
      entry.status = "done";
      entry.result = stripped;
      entry.fullResult = fullResult;
      entry.ts = Date.now();

      console.log(
        `[${new Date().toISOString()}] BKAV done key=${dedupKey} errorCode=${fullResult.errorCode} invoiceNo=${fullResult.invoiceNo}`
      );

      // Thông báo cho tất cả replica đang chờ
      for (const resolve of entry.waiters) resolve();
      entry.waiters = [];

      res
        .status(statusCode)
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(stripped);
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] BKAV error key=${dedupKey}: ${err.message}`
      );
      const errResult = "<R><E>1</E><M>proxy_error</M></R>";
      entry.status = "done";
      entry.result = errResult;
      entry.fullResult = { errorCode: "1", message: err.message };
      entry.ts = Date.now();

      // Notify waiters kể cả khi lỗi
      for (const resolve of entry.waiters) resolve();
      entry.waiters = [];

      res
        .status(500)
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(errResult);
    }
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Endpoint chính: IC gọi /bkav-prod với SOAP body + header x-order-id
app.post("/bkav-prod", handleBkavRequest(BKAV_PROD_URL));

// Endpoint demo/test: dùng môi trường BKAV staging
app.post("/bkav-demo", handleBkavRequest(BKAV_DEMO_URL));

// ─── Tingee routes ───────────────────────────────────────────────────────────

/**
 * POST /tingee-generate
 *
 * IC gọi route này để generate dynamic QR qua Tingee.
 * VPS chỉ forward — không có secretToken, không log raw body chứa secret.
 * Signature Option A: IC ký HMAC-SHA512 bằng secretToken (chỉ IC giữ),
 * gửi kèm header x-signature + x-client-id + x-request-timestamp.
 * VPS forward toàn bộ headers + body nguyên vẹn sang Tingee.
 *
 * Single-flight + cache 10 phút theo idempotencyKey:
 *   - idempotencyKey = HMAC-SHA256(orderCode) do IC tính, gửi qua header
 *     x-idempotency-key (hoặc body field idempotencyKey).
 *   - Request đầu tiên cho 1 idempotencyKey gọi Tingee 1 lần,
 *     các request đồng thời cùng idempotencyKey await cùng 1 response
 *     → giải quyết consensus FAIL (N replica nhận cùng qrAccount/billId/qrCode).
 *   - Cache 10 phút → regenerate cùng orderCode trong 10 phút trả cùng QR.
 *
 * Body JSON từ IC chứa:
 *   { vaAccountNumber, qrCodeType, bankBin, amount, purpose,
 *     expireInMinute, extraInfo, merchantId, idempotencyKey }
 * Headers từ IC:
 *   Content-Type, x-client-id, x-signature, x-request-timestamp,
 *   x-idempotency-key (tuỳ chọn, ưu tiên hơn body.idempotencyKey)
 */
app.post("/tingee-generate", async (req, res) => {
  // Đọc idempotencyKey từ header (ưu tiên) hoặc body
  let idempotencyKey = req.headers["x-idempotency-key"] || null;
  if (!idempotencyKey) {
    try {
      const bodyJson = JSON.parse(req.rawBody.toString("utf8"));
      idempotencyKey = bodyJson.idempotencyKey || null;
    } catch (_) {
      idempotencyKey = null;
    }
  }

  // Lọc headers: bỏ hop-level headers, forward tất cả còn lại (kể cả
  // x-client-id, x-signature, x-request-timestamp) nguyên vẹn sang Tingee.
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (
      ![
        "host",
        "content-length",
        "transfer-encoding",
        "connection",
        "x-idempotency-key", // chỉ dùng cho dedup, không forward sang Tingee
      ].includes(lk)
    ) {
      forwardHeaders[k] = v;
    }
  }

  // --- Không có idempotencyKey: forward thẳng, không cache ---
  if (!idempotencyKey) {
    console.log(
      `[${new Date().toISOString()}] Tingee: no idempotencyKey — forwarding directly`
    );
    try {
      const { statusCode, body } = await callTingee(
        TINGEE_GENERATE_URL,
        req.rawBody,
        forwardHeaders
      );
      res.status(statusCode).set("Content-Type", "application/json").send(body);
    } catch (err) {
      console.error(`[Tingee direct error] ${err.message}`);
      res.status(502).json({ error: "proxy_error", message: err.message });
    }
    return;
  }

  console.log(
    `[${new Date().toISOString()}] Tingee request idempotencyKey=${idempotencyKey}`
  );

  // --- Cache HIT (done, chưa hết hạn) ---
  const existing = tingeeCache.get(idempotencyKey);
  if (existing && existing.status === "done") {
    const age = Date.now() - existing.ts;
    if (age < TINGEE_CACHE_TTL_MS) {
      console.log(
        `[${new Date().toISOString()}] Tingee cache HIT idempotencyKey=${idempotencyKey} age=${Math.round(age / 1000)}s`
      );
      return res
        .status(existing.statusCode)
        .set("Content-Type", "application/json")
        .send(existing.body);
    }
    // Hết hạn — xóa entry cũ, gọi lại
    tingeeCache.delete(idempotencyKey);
  }

  // --- Đang pending: xếp vào hàng chờ ---
  if (existing && existing.status === "pending") {
    console.log(
      `[${new Date().toISOString()}] Tingee pending idempotencyKey=${idempotencyKey} — queuing waiter`
    );
    await new Promise((resolve) => existing.waiters.push(resolve));
    const done = tingeeCache.get(idempotencyKey);
    return res
      .status(done ? done.statusCode : 502)
      .set("Content-Type", "application/json")
      .send(done ? done.body : JSON.stringify({ error: "dedup_timeout" }));
  }

  // --- First request: gọi Tingee 1 lần duy nhất ---
  const entry = {
    status: "pending",
    body: null,
    statusCode: null,
    waiters: [],
    ts: Date.now(),
  };
  tingeeCache.set(idempotencyKey, entry);

  try {
    console.log(
      `[${new Date().toISOString()}] Calling Tingee for idempotencyKey=${idempotencyKey}`
    );
    const { statusCode, body } = await callTingee(
      TINGEE_GENERATE_URL,
      req.rawBody,
      forwardHeaders
    );

    entry.status = "done";
    entry.body = body;
    entry.statusCode = statusCode;
    entry.ts = Date.now();

    console.log(
      `[${new Date().toISOString()}] Tingee done idempotencyKey=${idempotencyKey} status=${statusCode}`
    );

    // Thông báo cho tất cả replica đang chờ
    for (const resolve of entry.waiters) resolve();
    entry.waiters = [];

    res.status(statusCode).set("Content-Type", "application/json").send(body);
  } catch (err) {
    console.error(
      `[${new Date().toISOString()}] Tingee error idempotencyKey=${idempotencyKey}: ${err.message}`
    );
    const errBody = JSON.stringify({ error: "proxy_error", message: err.message });
    entry.status = "done";
    entry.body = errBody;
    entry.statusCode = 502;
    entry.ts = Date.now();

    // Notify waiters kể cả khi lỗi
    for (const resolve of entry.waiters) resolve();
    entry.waiters = [];

    res.status(502).set("Content-Type", "application/json").send(errBody);
  }
});

// ─── Tingee banks / status / delete routes ──────────────────────────────────

/**
 * GET /tingee-banks
 *
 * IC gọi route này để lấy danh sách ngân hàng từ Tingee.
 * VPS chỉ forward — IC ký HMAC-SHA512 (bodyJson = '{}' cho GET) và gửi
 * x-signature + x-client-id + x-request-timestamp. VPS forward nguyên vẹn.
 *
 * Response: JSON danh sách ngân hàng từ Tingee.
 */
app.get("/tingee-banks", async (req, res) => {
  // Lọc headers: bỏ hop-level headers, forward tất cả còn lại (kể cả
  // x-client-id, x-signature, x-request-timestamp) nguyên vẹn sang Tingee.
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (
      !["host", "content-length", "transfer-encoding", "connection"].includes(lk)
    ) {
      forwardHeaders[k] = v;
    }
  }

  console.log(`[${new Date().toISOString()}] Tingee /get-banks forward`);
  try {
    const { statusCode, body } = await callTingeeGet(TINGEE_BANKS_URL, forwardHeaders);
    res.status(statusCode).set("Content-Type", "application/json").send(body);
  } catch (err) {
    console.error(`[Tingee banks error] ${err.message}`);
    res.status(502).json({ error: "proxy_error", message: err.message });
  }
});

/**
 * POST /tingee-status
 *
 * IC gọi route này để lấy trạng thái dynamic QR từ Tingee.
 * VPS chỉ forward — IC ký HMAC-SHA512 và gửi x-signature + headers.
 *
 * Body JSON từ IC chứa: { orderId, qrId, billId } (tuỳ theo Tingee API).
 * Response: JSON trạng thái từ Tingee (status, totalAmountPaid, transactionInfos).
 */
app.post("/tingee-status", async (req, res) => {
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (
      !["host", "content-length", "transfer-encoding", "connection"].includes(lk)
    ) {
      forwardHeaders[k] = v;
    }
  }

  console.log(`[${new Date().toISOString()}] Tingee /get-status-dynamic-qr forward`);
  try {
    const { statusCode, body } = await callTingee(TINGEE_STATUS_URL, req.rawBody, forwardHeaders);
    res.status(statusCode).set("Content-Type", "application/json").send(body);
  } catch (err) {
    console.error(`[Tingee status error] ${err.message}`);
    res.status(502).json({ error: "proxy_error", message: err.message });
  }
});

/**
 * POST /tingee-delete
 *
 * IC gọi route này để xóa dynamic QR trên Tingee.
 * VPS chỉ forward — IC ký HMAC-SHA512 và gửi x-signature + headers.
 *
 * Body JSON từ IC chứa: { orderId, qrId } (tuỳ theo Tingee API).
 * Response: JSON kết quả xóa từ Tingee.
 */
app.post("/tingee-delete", async (req, res) => {
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (
      !["host", "content-length", "transfer-encoding", "connection"].includes(lk)
    ) {
      forwardHeaders[k] = v;
    }
  }

  console.log(`[${new Date().toISOString()}] Tingee /delete-dynamic-qr forward`);
  try {
    const { statusCode, body } = await callTingee(TINGEE_DELETE_URL, req.rawBody, forwardHeaders);
    res.status(statusCode).set("Content-Type", "application/json").send(body);
  } catch (err) {
    console.error(`[Tingee delete error] ${err.message}`);
    res.status(502).json({ error: "proxy_error", message: err.message });
  }
});

// ─── Ahamove booking route ──────────────────────────────────────────────────

/**
 * POST /ahamove-book
 *
 * IC gọi route này để tạo đơn Ahamove.
 * VPS chỉ forward — IC gửi body JSON + headers (chứa token / api key),
 * VPS forward nguyên vẹn sang Ahamove.
 *
 * Body JSON từ IC (theo Ahamove booking format):
 *   {
 *     path: [{ address, lat, lng, name, mobile }, { address, lat, lng }],
 *     serviceId,
 *     payment_method: 'CASH_BY_RECIPIENT',
 *     total_pay,
 *     remarks
 *   }
 * Response: JSON từ Ahamove chứa { ahamoveOrderId, fare, status }.
 */
app.post("/ahamove-book", async (req, res) => {
  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (
      !["host", "content-length", "transfer-encoding", "connection"].includes(lk)
    ) {
      forwardHeaders[k] = v;
    }
  }

  console.log(`[${new Date().toISOString()}] Ahamove /order/create forward`);
  try {
    const { statusCode, body } = await callAhamove(AHAMOVE_BOOK_URL, req.rawBody, forwardHeaders);
    res.status(statusCode).set("Content-Type", "application/json").send(body);
  } catch (err) {
    console.error(`[Ahamove book error] ${err.message}`);
    res.status(502).json({ error: "proxy_error", message: err.message });
  }
});

// ─── Webhook receiver routes (forward về canister) ──────────────────────────

/**
 * POST /webhook/tingee
 *
 * Tingee gọi webhook này khi có event (QR thanh toán, status change, ...).
 * VPS forward body + headers về canister receiveTingeeWebhook.
 *
 * Canister signature: receiveTingeeWebhook(body: Blob, headers: [(Text, Text)]) : async Text
 *
 * VPS wrap body thành base64 + headers thành [[name, value], ...] và forward
 * qua raw boundary. Canister parse và xử lý.
 *
 * Trả 200 cho Tingee ngay sau khi forward (Tingee yêu cầu 200 để không retry).
 */
app.post("/webhook/tingee", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] Tingee webhook received, forwarding to canister`
  );
  try {
    const { statusCode, body } = await forwardWebhookToCanister(
      "receiveTingeeWebhook",
      req.rawBody,
      req.headers
    );
    console.log(
      `[${new Date().toISOString()}] Tingee webhook forwarded, canister status=${statusCode}`
    );
    // Trả 200 cho Tingee bất kể canister response (Tingee không retry)
    res.status(200).json({ received: true, canisterStatus: statusCode });
  } catch (err) {
    console.error(`[Tingee webhook forward error] ${err.message}`);
    // Vẫn trả 200 cho Tingee để tránh retry spam; canister sẽ poll lại
    res.status(200).json({ received: true, forwardError: err.message });
  }
});

/**
 * POST /webhook/ahamove
 *
 * Ahamove gọi webhook này khi có event (đơn tạo xong, driver nhận, ...).
 * VPS forward body + headers về canister receiveAhamoveWebhook.
 *
 * Canister signature:
 *   receiveAhamoveWebhook(orderId, newStatus, driverInfo, signature, requestBody) : async { #ok; #err: Text }
 *
 * VPS wrap thành JSON { orderId, newStatus, driverInfo, signature, requestBody }
 * và forward qua raw boundary. Canister parse và xử lý.
 *
 * Trả 200 cho Ahamove ngay sau khi forward.
 */
app.post("/webhook/ahamove", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] Ahamove webhook received, forwarding to canister`
  );
  try {
    // Parse body để trích orderId, newStatus, driverInfo, signature
    let parsed = {};
    try {
      parsed = JSON.parse(req.rawBody.toString("utf8"));
    } catch (_) {
      // Body không phải JSON — forward raw
      parsed = { _raw: req.rawBody.toString("base64") };
    }

    const orderId = parsed.order_id || parsed.orderId || "";
    const newStatus = parsed.status || parsed.newStatus || "";
    const driverInfo = parsed.driver || parsed.driverInfo || {};
    const signature = req.headers["x-ahamove-signature"] || parsed.signature || "";
    const requestBody = req.rawBody.toString("utf8");

    // Wrap theo canister signature (positional args → JSON object)
    const wrapper = JSON.stringify({
      orderId,
      newStatus,
      driverInfo,
      signature,
      requestBody,
    });
    const wrapperBuf = Buffer.from(wrapper, "utf8");

    // Forward qua raw boundary (giống forwardWebhookToCanister nhưng custom body)
    const callbackUrl = `https://${CANISTER_ID}.raw.icp0.io/receiveAhamoveWebhook`;
    const url = new URL(callbackUrl);
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": wrapperBuf.length,
      },
      timeout: 30_000,
    };

    const forwardResult = await new Promise((resolve, reject) => {
      const fwdReq = https.request(opts, (fwdRes) => {
        const chunks = [];
        fwdRes.on("data", (c) => chunks.push(c));
        fwdRes.on("end", () =>
          resolve({
            statusCode: fwdRes.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      });
      fwdReq.on("timeout", () => {
        fwdReq.destroy();
        reject(new Error("Canister webhook forward timed out"));
      });
      fwdReq.on("error", reject);
      fwdReq.write(wrapperBuf);
      fwdReq.end();
    });

    console.log(
      `[${new Date().toISOString()}] Ahamove webhook forwarded, canister status=${forwardResult.statusCode}`
    );
    // Trả 200 cho Ahamove bất kể canister response
    res.status(200).json({ received: true, canisterStatus: forwardResult.statusCode });
  } catch (err) {
    console.error(`[Ahamove webhook forward error] ${err.message}`);
    res.status(200).json({ received: true, forwardError: err.message });
  }
});

/**
 * GET /tingee-health
 * Kiểm tra Tingee proxy còn sống không, bao nhiêu entry trong Tingee cache.
 */
app.get("/tingee-health", (req, res) => {
  res.json({
    status: "ok",
    tingeeCacheSize: tingeeCache.size,
    bkavCacheSize: cache.size,
    uptime: process.uptime(),
    ts: new Date().toISOString(),
  });
});

/**
 * GET /tingee-cache-stats
 * Xem chi tiết các entry đang có trong Tingee cache (debug/monitoring).
 */
app.get("/tingee-cache-stats", (req, res) => {
  const entries = [];
  for (const [key, entry] of tingeeCache.entries()) {
    entries.push({
      idempotencyKey: key,
      status: entry.status,
      statusCode: entry.statusCode,
      age: Math.round((Date.now() - entry.ts) / 1000) + "s",
      waiters: entry.waiters?.length || 0,
    });
  }
  res.json({ count: entries.length, ttlMs: TINGEE_CACHE_TTL_MS, entries });
});

/**
 * GET /bkav-result/:key
 *
 * IC gọi sau khi đã đạt consensus cho bước phát hành hóa đơn,
 * để lấy số hóa đơn và GUID thật từ BKAV.
 * Response là JSON cố định từ cache → IC cũng đạt consensus cho bước này.
 *
 * Ví dụ: GET /bkav-result/ORDER_123
 * Response: { errorCode, invoiceGuid, invoiceNo, taxCode, message }
 */
app.get("/bkav-result/:key", (req, res) => {
  const entry = cache.get(req.params.key);
  if (!entry || entry.status !== "done") {
    return res.status(404).json({
      error: "not_found",
      message: "Key không tồn tại hoặc đã hết hạn (TTL 30s)",
    });
  }
  // Trả về JSON với các trường cố định (không có timestamp hay trường động)
  res.json({
    errorCode: entry.fullResult.errorCode || "",
    invoiceGuid: entry.fullResult.invoiceGuid || "",
    invoiceNo: entry.fullResult.invoiceNo || "",
    taxCode: entry.fullResult.taxCode || "",
    message: entry.fullResult.message || "",
  });
});

/**
 * GET /health
 * Kiểm tra proxy còn sống không, bao nhiêu entry trong cache.
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    cacheSize: cache.size,
    uptime: process.uptime(),
    ts: new Date().toISOString(),
  });
});

/**
 * GET /cache-stats
 * Xem chi tiết các entry đang có trong cache (debug/monitoring).
 */
app.get("/cache-stats", (req, res) => {
  const entries = [];
  for (const [key, entry] of cache.entries()) {
    entries.push({
      key,
      status: entry.status,
      errorCode: entry.fullResult?.errorCode,
      invoiceNo: entry.fullResult?.invoiceNo,
      age: Math.round((Date.now() - entry.ts) / 1000) + "s",
      waiters: entry.waiters?.length || 0,
    });
  }
  res.json({ count: entries.length, entries });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(
    `[${new Date().toISOString()}] VPS Proxy đang chạy trên port ${PORT}`
  );
  console.log(`  POST /bkav-prod  → ${BKAV_PROD_URL}`);
  console.log(`  POST /bkav-demo  → ${BKAV_DEMO_URL}`);
  console.log(`  GET  /bkav-result/:key  (lấy số HĐ sau khi IC đồng thuận)`);
  console.log(`  GET  /health`);
  console.log(`  GET  /cache-stats`);
  console.log(`  BKAV dedup cache TTL: ${CACHE_TTL_MS / 1000}s`);
  console.log();
  console.log(`  POST /tingee-generate  → ${TINGEE_GENERATE_URL}`);
  console.log(`    (signature Option A: IC ký HMAC-SHA512, VPS chỉ forward)`);
  console.log(`  GET  /tingee-banks  → ${TINGEE_BANKS_URL}`);
  console.log(`  POST /tingee-status  → ${TINGEE_STATUS_URL}`);
  console.log(`  POST /tingee-delete  → ${TINGEE_DELETE_URL}`);
  console.log(`  POST /ahamove-book  → ${AHAMOVE_BOOK_URL}`);
  console.log(`  POST /webhook/tingee  → canister receiveTingeeWebhook (${CANISTER_ID})`);
  console.log(`  POST /webhook/ahamove  → canister receiveAhamoveWebhook (${CANISTER_ID})`);
  console.log(`  GET  /tingee-health`);
  console.log(`  GET  /tingee-cache-stats`);
  console.log(`  Tingee dedup cache TTL: ${TINGEE_CACHE_TTL_MS / 1000 / 60} phút`);
  console.log();
  console.log(`  Cách dùng từ IC backend (Motoko):`);
  console.log(`    BKAV:  POST https://proxy.bunbohue65.vn/bkav-prod?key=ORDER_<id>`);
  console.log(`    Tingee: POST https://proxy.bunbohue65.vn/tingee-generate`);
  console.log(`            header x-idempotency-key: <HMAC-SHA256(orderCode)>`);
});
