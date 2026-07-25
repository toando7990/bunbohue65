import Text "mo:core/Text";
// HTTP gateway mixin — routes incoming POST webhooks from Tingee
// to the corresponding public shared functions in the orders mixin.
//
// ICP HTTP interface upgrade pattern:
//   1. http_request (query) receives the request and returns { upgrade = ?true }
//      for state-mutating POST endpoints.
//   2. http_request_update (update) re-receives the full request and dispatches
//      to the correct handler, which can mutate canister state.

mixin (
  handleTingee          : shared (Blob, [(Text, Text)]) -> async Text,
  handleInvoiceCallback : shared (Blob, [(Text, Text)]) -> async { status : Nat16; body : Blob },
) {

  type HttpRequest = {
    url     : Text;
    method  : Text;
    body    : Blob;
    headers : [(Text, Text)];
  };

  type HttpResponse = {
    status_code : Nat16;
    headers     : [(Text, Text)];
    body        : Blob;
    upgrade     : ?Bool;
  };

  // Strip query-string from a URL path (e.g. "/foo?bar=1" -> "/foo")
  func parsePath(url : Text) : Text {
    let parts = url.split(#char '?');
    switch (parts.next()) {
      case (?p) p;
      case null url;
    };
  };

  // http_request — query call.
  // For webhook POST paths return upgrade=?true so the runtime re-invokes
  // http_request_update (an update call) that can commit state changes.
  // Static GET paths (/sitemap.xml, /robots.txt) are served directly here.
  // All other requests get an immediate 200 OK (health-check / unknown).
  public shared query func http_request(req : HttpRequest) : async HttpResponse {
    let path = parsePath(req.url);

    // Serve sitemap.xml — critical for Google Search Console indexing
    if (path == "/sitemap.xml") {
      let xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" #
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" #
        "  <url>\n" #
        "    <loc>https://www.bunbohue65.vn/</loc>\n" #
        "    <lastmod>2026-06-01</lastmod>\n" #
        "    <changefreq>weekly</changefreq>\n" #
        "    <priority>1.0</priority>\n" #
        "  </url>\n" #
        "  <url>\n" #
        "    <loc>https://www.bunbohue65.vn/delivery</loc>\n" #
        "    <lastmod>2026-06-01</lastmod>\n" #
        "    <changefreq>weekly</changefreq>\n" #
        "    <priority>0.9</priority>\n" #
        "  </url>\n" #
        "  <url>\n" #
        "    <loc>https://www.bunbohue65.vn/order</loc>\n" #
        "    <lastmod>2026-06-01</lastmod>\n" #
        "    <changefreq>weekly</changefreq>\n" #
        "    <priority>0.8</priority>\n" #
        "  </url>\n" #
        "  <url>\n" #
        "    <loc>https://www.bunbohue65.vn/reservation</loc>\n" #
        "    <lastmod>2026-06-01</lastmod>\n" #
        "    <changefreq>weekly</changefreq>\n" #
        "    <priority>0.7</priority>\n" #
        "  </url>\n" #
        "  <url>\n" #
        "    <loc>https://www.bunbohue65.vn/kiosk-order</loc>\n" #
        "    <lastmod>2026-06-01</lastmod>\n" #
        "    <changefreq>monthly</changefreq>\n" #
        "    <priority>0.5</priority>\n" #
        "  </url>\n" #
        "</urlset>";
      return {
        status_code = 200;
        headers     = [("Content-Type", "application/xml")];
        body        = xml.encodeUtf8();
        upgrade     = null;
      };
    };

    // Serve robots.txt — tells crawlers what to index and where the sitemap is
    if (path == "/robots.txt") {
      let txt = "User-agent: *\nAllow: /\nAllow: /delivery\n\nSitemap: https://www.bunbohue65.vn/sitemap.xml";
      return {
        status_code = 200;
        headers     = [("Content-Type", "text/plain")];
        body        = txt.encodeUtf8();
        upgrade     = null;
      };
    };

    let isWebhookPath =
      path == "/receiveTingeeWebhook" or
      path == "/invoice-callback";
    // GET / HEAD to webhook paths: return 200 immediately (no upgrade).
    if ((req.method == "GET" or req.method == "HEAD") and isWebhookPath) {
      return {
        status_code = 200;
        headers     = [
          ("Content-Type", "text/plain"),
          ("Allow",        "GET, HEAD, POST"),
        ];
        body        = "OK".encodeUtf8();
        upgrade     = null;
      };
    };
    // POST to webhook paths: upgrade to update call so state can be mutated.
    if (req.method == "POST" and isWebhookPath) {
      return {
        status_code = 200;
        headers     = [];
        body        = "".encodeUtf8();
        upgrade     = ?true;
      };
    };
    // Default: health-check or unknown path.
    {
      status_code = 200;
      headers     = [("Content-Type", "application/json")];
      body        = "{}".encodeUtf8();
      upgrade     = null;
    };
  };

  // http_request_update — update call, triggered only when upgrade=?true.
  // Dispatches to the correct webhook handler; returns 200 for all paths
  // so external services (Tingee) do not retry on a non-2xx status.
  // The response body from the handler is forwarded directly (Tingee requires
  // JSON body with code/message fields).
  public shared func http_request_update(req : HttpRequest) : async HttpResponse {
    let path = parsePath(req.url);
    if (path == "/receiveTingeeWebhook") {
      let responseBody = await handleTingee(req.body, req.headers);
      return {
        status_code = 200;
        headers     = [("Content-Type", "application/json")];
        body        = responseBody.encodeUtf8();
        upgrade     = null;
      };
    };
    if (path == "/invoice-callback") {
      let cbResult = await handleInvoiceCallback(req.body, req.headers);
      return {
        status_code = cbResult.status;
        headers     = [("Content-Type", "text/plain")];
        body        = cbResult.body;
        upgrade     = null;
      };
    };
    {
      status_code = 200;
      headers     = [("Content-Type", "application/json")];
      body        = "{}".encodeUtf8();
      upgrade     = null;
    };
  };

};
