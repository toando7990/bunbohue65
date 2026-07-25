#!/bin/bash
# BKAV Decrypt Proxy Setup Script for Ubuntu 22.04
# Run as root: bash setup-bkav-proxy.sh
#
# Architecture:
#   IC Canister
#     → HTTPS → proxy.bunbohue65.vn (Nginx, port 443, Let's Encrypt SSL)
#     → HTTP  → Node.js decrypt service (127.0.0.1:3000)
#     → HTTPS → ws.ehoadon.vn (BKAV production)
#
# The Node.js service:
#   1. Receives SOAP XML from IC (with X-BKAV-KEY header)
#   2. Forwards to BKAV as-is
#   3. Receives encrypted response: Base64(AES-256-CBC(gzip(XML)))
#   4. Decrypts → gunzips → returns plain XML to IC
#
# This script is IDEMPOTENT — safe to re-run.

set -e

echo "======================================="
echo " BKAV Decrypt Proxy Setup - Ubuntu 22.04"
echo "======================================="
echo ""

# -----------------------------------------------
# [1/7] Update apt + install Nginx, openssl, curl
# -----------------------------------------------
echo "[1/7] Cập nhật apt và cài đặt Nginx, openssl, curl..."
apt update -y
apt install -y nginx openssl curl ufw
echo "      ✓ Nginx, openssl, curl đã cài đặt xong."
echo ""

# -----------------------------------------------
# [2/7] Install Node.js 20 LTS via NodeSource
# -----------------------------------------------
echo "[2/7] Cài đặt Node.js 20 LTS..."
if node --version 2>/dev/null | grep -q '^v20'; then
    echo "      ✓ Node.js 20 đã cài đặt — giữ nguyên: $(node --version)"
else
    apt remove -y nodejs 2>/dev/null || true
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    echo "      ✓ Node.js đã cài đặt: $(node --version)"
fi
echo ""

# -----------------------------------------------
# [3/7] Create Node.js decrypt service
# -----------------------------------------------
echo "[3/7] Tạo Node.js decrypt service tại /opt/bkav-proxy..."
mkdir -p /opt/bkav-proxy

cat > /opt/bkav-proxy/package.json << 'PKGJSON'
{
  "name": "bkav-proxy",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {}
}
PKGJSON

cat > /opt/bkav-proxy/server.js << 'NODEJS'
'use strict';

const http   = require('http');
const https  = require('https');
const zlib   = require('zlib');
const crypto = require('crypto');

const PORT = 3000;
const HOST = '127.0.0.1';

const BKAV_ENDPOINTS = {
  '/bkav-prod': 'https://ws.ehoadon.vn/WSPublicEhoadon.asmx',
  '/bkav-demo': 'https://wsdemo.ehoadon.vn/WSPublicEhoadon.asmx',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function decryptBkavResponse(base64Body, keyBase64, ivBase64) {
  const encrypted = Buffer.from(base64Body.trim(), 'base64');
  const key       = Buffer.from(keyBase64, 'base64');
  const iv        = Buffer.from(ivBase64,  'base64');
  const decipher  = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return zlib.gunzipSync(decrypted).toString('utf8');
}

/**
 * Extracts inner text of the first occurrence of <tag>...</tag> or <ns:tag>...</ns:tag>.
 * Returns empty string when not found.
 */
function extractTag(xml, localName) {
  const re = new RegExp('<(?:[^:>]+:)?' + localName + '[^>]*>([\\s\\S]*?)<\/(?:[^:>]+:)?' + localName + '>', 'i');
  const m  = xml.match(re);
  return m ? m[1].trim() : '';
}

/**
 * Case 1: SOAP Fault detected.
 * Returns deterministic canonical XML: <R><E>FAULT:faultcode</E></R>
 * Strips faultstring (dynamic stack traces) and detail to ensure all
 * IC replicas produce identical bytes.
 */
function normalizeSoapFault(xml) {
  const faultcode = extractTag(xml, 'faultcode') || 'UNKNOWN';
  // Sanitize: remove namespace prefix from faultcode value (e.g. "soap:VersionMismatch" -> keep as-is,
  // but ensure no angle brackets or XML special chars leak into our output)
  const safe = faultcode.replace(/[<>&"']/g, '');
  const canonical = '<R><E>FAULT:' + safe + '</E></R>';
  console.log('[bkav-proxy] SOAP Fault detected → canonical:', canonical);
  return canonical;
}

/**
 * Case 2: Encrypted success response.
 * Extracts Base64 payload from ExecCommandResult, decrypts, returns plain XML.
 */
function processEncryptedResponse(xml, keyBase64, ivBase64) {
  // Match ExecCommandResult with any namespace prefix
  const re = /<(?:[^:>]+:)?ExecCommandResult[^>]*>([\s\S]*?)<\/(?:[^:>]+:)?ExecCommandResult>/i;
  const m  = xml.match(re);
  if (!m) return null;
  const payload = m[1].trim();
  if (!payload) return null;
  return decryptBkavResponse(payload, keyBase64, ivBase64);
}

function isSoapFault(xml) {
  return /<(?:[^:>]+:)?Fault[\s>]/i.test(xml) ||
         /<faultcode[\s>]/i.test(xml) ||
         xml.includes('faultcode>');
}

function hasExecCommandResult(xml) {
  return /ExecCommandResult/i.test(xml);
}

// ── Forward to BKAV ──────────────────────────────────────────────────────────

function forwardToBkav(targetUrl, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url  = new URL(targetUrl);
    const opts = {
      hostname: url.hostname,
      port:     url.port || 443,
      path:     url.pathname + (url.search || ''),
      method:   method,
      headers:  headers,
      rejectUnauthorized: false,
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (body && body.length > 0) req.write(body);
    req.end();
  });
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('BKAV decrypt proxy OK');
    return;
  }

  // Strip query string for route matching
  const routeKey = req.url.split('?')[0];
  const targetUrl = BKAV_ENDPOINTS[routeKey];
  if (!targetUrl) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const bodyChunks = [];
  req.on('data', (c) => bodyChunks.push(c));
  req.on('error', (err) => {
    console.error('[bkav-proxy] Request read error:', err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Request read error');
  });

  req.on('end', async () => {
    const requestBody   = Buffer.concat(bodyChunks);

    // Parse X-BKAV-KEY — do NOT forward to BKAV
    const bkavKeyHeader = (req.headers['x-bkav-key'] || '').trim();
    const colonIdx      = bkavKeyHeader.indexOf(':');
    const keyBase64     = colonIdx > 0 ? bkavKeyHeader.slice(0, colonIdx) : '';
    const ivBase64      = colonIdx > 0 ? bkavKeyHeader.slice(colonIdx + 1) : '';

    // Build forwarding headers — strip X-BKAV-KEY, host, connection
    const forwardHeaders = {};
    for (const [name, value] of Object.entries(req.headers)) {
      const lower = name.toLowerCase();
      if (lower === 'x-bkav-key' || lower === 'host' || lower === 'connection') continue;
      forwardHeaders[name] = value;
    }
    forwardHeaders['content-length'] = requestBody.length.toString();

    try {
      const bkavResp = await forwardToBkav(targetUrl, req.method, forwardHeaders, requestBody);
      // Strip UTF-8 BOM (\uFEFF = \xEF\xBB\xBF) and trim whitespace
      const rawBody  = bkavResp.body.toString('utf8').replace(/^\uFEFF/, '').trim();

      let outputXml;

      // Case 1: SOAP Fault → normalize to deterministic canonical form
      if (isSoapFault(rawBody)) {
        outputXml = normalizeSoapFault(rawBody);

      // Case 2: Encrypted success response → decrypt
      } else if (hasExecCommandResult(rawBody) && keyBase64 && ivBase64) {
        try {
          outputXml = processEncryptedResponse(rawBody, keyBase64, ivBase64);
          if (outputXml) {
            console.log('[bkav-proxy] Decrypted OK, XML length:', outputXml.length);
          } else {
            // ExecCommandResult tag found but empty payload
            console.warn('[bkav-proxy] ExecCommandResult empty — returning raw body');
            outputXml = rawBody;
          }
        } catch (decErr) {
          console.warn('[bkav-proxy] Decrypt failed:', decErr.message, '— returning raw body');
          outputXml = rawBody;
        }

      // Case 3: Raw XML — return as-is
      } else {
        outputXml = rawBody;
      }

      const outBuf = Buffer.from(outputXml, 'utf8');
      res.writeHead(200, {
        'Content-Type':   'text/xml; charset=utf-8',
        'Content-Length': outBuf.length.toString(),
      });
      res.end(outBuf);

    } catch (err) {
      console.error('[bkav-proxy] Upstream error:', err.message);
      // Return deterministic error so IC replicas agree
      const errXml = Buffer.from('<R><E>PROXY_ERROR</E></R>', 'utf8');
      res.writeHead(200, {
        'Content-Type':   'text/xml; charset=utf-8',
        'Content-Length': errXml.length.toString(),
      });
      res.end(errXml);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log('[bkav-proxy] Listening on ' + HOST + ':' + PORT);
  console.log('[bkav-proxy] Routes: /bkav-prod /bkav-demo /health');
});

process.on('uncaughtException', (err) => {
  console.error('[bkav-proxy] Uncaught exception:', err.message);
});
NODEJS

chown -R www-data:www-data /opt/bkav-proxy
chmod -R 755 /opt/bkav-proxy
echo "      ✓ Node.js service đã tạo tại /opt/bkav-proxy/server.js"
echo ""

# -----------------------------------------------
# [4/7] Create and start systemd service
# -----------------------------------------------
echo "[4/7] Tạo systemd service bkav-proxy..."
cat > /etc/systemd/system/bkav-proxy.service << 'SYSTEMD'
[Unit]
Description=BKAV Decrypt Proxy
After=network.target

[Service]
Type=simple
User=www-data
ExecStart=/usr/bin/node /opt/bkav-proxy/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bkav-proxy
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable bkav-proxy
systemctl restart bkav-proxy
sleep 3

if systemctl is-active --quiet bkav-proxy; then
    echo "      ✓ bkav-proxy service đang chạy."
else
    echo "      ✗ bkav-proxy service FAILED — xem log:"
    journalctl -u bkav-proxy -n 20 --no-pager || true
    exit 1
fi
echo ""

# -----------------------------------------------
# [5/7] Update Nginx config to route through Node.js
# -----------------------------------------------
echo "[5/7] Cập nhật cấu hình Nginx (route qua Node.js decrypt service)..."

LE_CERT="/etc/letsencrypt/live/proxy.bunbohue65.vn/fullchain.pem"
LE_KEY="/etc/letsencrypt/live/proxy.bunbohue65.vn/privkey.pem"

if [ -f "$LE_CERT" ] && [ -f "$LE_KEY" ]; then
    SSL_CERT="$LE_CERT"
    SSL_KEY="$LE_KEY"
    SSL_SOURCE="Let's Encrypt"
else
    mkdir -p /etc/nginx/ssl
    if [ ! -f /etc/nginx/ssl/bkav.crt ]; then
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/bkav.key \
            -out /etc/nginx/ssl/bkav.crt \
            -subj "/CN=proxy.bunbohue65.vn"
    fi
    SSL_CERT="/etc/nginx/ssl/bkav.crt"
    SSL_KEY="/etc/nginx/ssl/bkav.key"
    SSL_SOURCE="self-signed"
fi

echo "      SSL source: $SSL_SOURCE"

cat > /etc/nginx/sites-available/bkav-proxy << NGINXEOF
# BKAV Decrypt Proxy -- Nginx config
# Routes: IC -> Nginx (443 SSL) -> Node.js (127.0.0.1:3000) -> BKAV

server {
    listen 80;
    server_name proxy.bunbohue65.vn;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name proxy.bunbohue65.vn;

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 10m;

    location /bkav-prod {
        proxy_pass          http://127.0.0.1:3000;
        proxy_http_version  1.1;
        proxy_set_header    Host              \$host;
        proxy_set_header    X-Real-IP         \$remote_addr;
        proxy_set_header    X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto \$scheme;
        proxy_pass_request_headers  on;
        proxy_pass_header           X-BKAV-KEY;
        proxy_connect_timeout  30s;
        proxy_read_timeout     90s;
        proxy_send_timeout     30s;
        if (\$request_method = 'OPTIONS') {
            add_header  Access-Control-Allow-Origin  * always;
            add_header  Access-Control-Allow-Headers "Content-Type, SOAPAction, Authorization, X-BKAV-KEY" always;
            add_header  Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header  Access-Control-Max-Age 1728000 always;
            add_header  Content-Type "text/plain; charset=utf-8" always;
            add_header  Content-Length 0 always;
            return 204;
        }
        add_header  Access-Control-Allow-Origin  * always;
        add_header  Access-Control-Allow-Headers "Content-Type, SOAPAction, Authorization, X-BKAV-KEY" always;
        add_header  Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    }

    location /bkav-demo {
        proxy_pass          http://127.0.0.1:3000;
        proxy_http_version  1.1;
        proxy_set_header    Host              \$host;
        proxy_set_header    X-Real-IP         \$remote_addr;
        proxy_set_header    X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto \$scheme;
        proxy_pass_request_headers  on;
        proxy_pass_header           X-BKAV-KEY;
        proxy_connect_timeout  30s;
        proxy_read_timeout     90s;
        proxy_send_timeout     30s;
        if (\$request_method = 'OPTIONS') {
            add_header  Access-Control-Allow-Origin  * always;
            add_header  Access-Control-Allow-Headers "Content-Type, SOAPAction, Authorization, X-BKAV-KEY" always;
            add_header  Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header  Access-Control-Max-Age 1728000 always;
            add_header  Content-Type "text/plain; charset=utf-8" always;
            add_header  Content-Length 0 always;
            return 204;
        }
        add_header  Access-Control-Allow-Origin  * always;
        add_header  Access-Control-Allow-Headers "Content-Type, SOAPAction, Authorization, X-BKAV-KEY" always;
        add_header  Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    }

    location /health {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_read_timeout 5s;
    }
}
NGINXEOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/bkav-proxy /etc/nginx/sites-enabled/bkav-proxy
nginx -t
systemctl enable nginx
systemctl reload nginx
echo "      ✓ Nginx đã cấu hình và reload xong."
echo ""

# -----------------------------------------------
# [6/7] UFW firewall rules
# -----------------------------------------------
echo "[6/7] Cấu hình UFW firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "      ✓ UFW rules: SSH 22, HTTP 80, HTTPS 443."
echo "      ✓ Port 3000 (Node.js) chỉ lắng nghe 127.0.0.1 — không mở ra ngoài."
echo ""

# -----------------------------------------------
# [7/7] Verify
# -----------------------------------------------
echo "[7/7] Kiểm tra kết nối..."

NODE_HEALTH=$(curl -s http://127.0.0.1:3000/health 2>/dev/null || echo 'FAILED')
if [ "$NODE_HEALTH" = "BKAV decrypt proxy OK" ]; then
    echo "      ✓ Node.js service: $NODE_HEALTH"
else
    echo "      ✗ Node.js service: $NODE_HEALTH"
fi

HTTPS_HEALTH=$(curl -s https://proxy.bunbohue65.vn/health 2>/dev/null || echo 'FAILED')
if [ "$HTTPS_HEALTH" = "BKAV decrypt proxy OK" ]; then
    echo "      ✓ HTTPS proxy: $HTTPS_HEALTH"
else
    echo "      ✗ HTTPS proxy: $HTTPS_HEALTH"
fi

echo ""
echo "======================================="
echo " BKAV Decrypt Proxy đã cài đặt thành công!"
echo "======================================="
echo ""
echo "Endpoint IC sử dụng:"
echo "  BKAV prod: https://proxy.bunbohue65.vn/bkav-prod"
echo "  BKAV demo: https://proxy.bunbohue65.vn/bkav-demo"
echo ""
echo "Header bắt buộc trong mỗi IC HTTP outcall:"
echo "  X-BKAV-KEY: <keyBase64>:<ivBase64>"
echo ""
echo "Xem log Node.js:"
echo "  journalctl -u bkav-proxy -f"
echo ""
echo "Nhớ đổi mật khẩu root VPS sau khi hoàn tất!"
echo ""
