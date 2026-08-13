export default async function handler(req, res) {
  const WP_ORIGIN =
    "https://magenta-caterpillar-505539.hostingersite.com";

  const WP_HOST =
    "magenta-caterpillar-505539.hostingersite.com";

  const WP_WWW_HOST =
    "www.magenta-caterpillar-505539.hostingersite.com";

  const PUBLIC_ORIGIN =
    "https://www.mymaxclinic.sg";

  const PUBLIC_HOST =
    "www.mymaxclinic.sg";

  // =========================================================
  // ALLOWED CORS ORIGINS
  // =========================================================

  const ALLOWED_ORIGIN_PATTERN =
    /^https:\/\/[a-z0-9-]+-max-clinic-projects\.vercel\.app$/i;

  function getAllowedOrigin(origin) {
    if (!origin) {
      return PUBLIC_ORIGIN;
    }

    if (origin === PUBLIC_ORIGIN) {
      return PUBLIC_ORIGIN;
    }

    if (ALLOWED_ORIGIN_PATTERN.test(origin)) {
      return origin;
    }

    return PUBLIC_ORIGIN;
  }

  // =========================================================
  // REWRITE WORDPRESS URLS
  // =========================================================

  function rewriteUrls(value) {
    if (value === undefined || value === null) {
      return value;
    }

    let result = String(value);

    // HTTPS absolute URLs
    result = result.replaceAll(
      `https://${WP_WWW_HOST}`,
      PUBLIC_ORIGIN
    );

    result = result.replaceAll(
      `https://${WP_HOST}`,
      PUBLIC_ORIGIN
    );

    // HTTP absolute URLs
    result = result.replaceAll(
      `http://${WP_WWW_HOST}`,
      PUBLIC_ORIGIN
    );

    result = result.replaceAll(
      `http://${WP_HOST}`,
      PUBLIC_ORIGIN
    );

    // Protocol relative URLs
    result = result.replaceAll(
      `//${WP_WWW_HOST}`,
      `//${PUBLIC_HOST}`
    );

    result = result.replaceAll(
      `//${WP_HOST}`,
      `//${PUBLIC_HOST}`
    );

    // JSON escaped HTTPS
    result = result.replaceAll(
      `https:\\/\\/${WP_WWW_HOST}`,
      `https:\\/\\/${PUBLIC_HOST}`
    );

    result = result.replaceAll(
      `https:\\/\\/${WP_HOST}`,
      `https:\\/\\/${PUBLIC_HOST}`
    );

    // JSON escaped HTTP
    result = result.replaceAll(
      `http:\\/\\/${WP_WWW_HOST}`,
      `https:\\/\\/${PUBLIC_HOST}`
    );

    result = result.replaceAll(
      `http:\\/\\/${WP_HOST}`,
      `https:\\/\\/${PUBLIC_HOST}`
    );

    // Escaped protocol-relative URLs
    result = result.replaceAll(
      `\\/\\/${WP_WWW_HOST}`,
      `\\/\\/${PUBLIC_HOST}`
    );

    result = result.replaceAll(
      `\\/\\/${WP_HOST}`,
      `\\/\\/${PUBLIC_HOST}`
    );

    // Hostname-only occurrences
    result = result.replaceAll(
      WP_WWW_HOST,
      PUBLIC_HOST
    );

    result = result.replaceAll(
      WP_HOST,
      PUBLIC_HOST
    );

    return result;
  }

  // =========================================================
  // NORMALIZE REDIRECT
  // =========================================================

  function normalizeRedirect(location) {
    if (!location) {
      return location;
    }

    let result = rewriteUrls(location);

    // Relative URL
    if (
      result.startsWith("/") &&
      !result.startsWith("//")
    ) {
      result = PUBLIC_ORIGIN + result;
    }

    // Protocol-relative URL
    if (result.startsWith("//")) {
      result = "https:" + result;
    }

    return result;
  }

  try {
    // =======================================================
    // INCOMING REQUEST
    // =======================================================

    const incoming = new URL(
      req.url,
      `https://${req.headers.host}`
    );

    const pathname = incoming.pathname;

    // =======================================================
    // ROBOTS.TXT
    // =======================================================

    if (pathname === "/robots.txt") {
      res.status(200);

      res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600"
      );

      return res.send(
`User-agent: *
Allow: /

Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Disallow: /wp-login.php
Disallow: /?s=
Disallow: /search/

Sitemap: ${PUBLIC_ORIGIN}/sitemap_index.xml`
      );
    }

    // =======================================================
    // WORDPRESS TARGET
    // =======================================================

    const target =
      WP_ORIGIN +
      pathname +
      incoming.search;

    // =======================================================
    // REQUEST HEADERS
    // =======================================================

    const headers = new Headers();

    for (
      const [key, value]
      of Object.entries(req.headers)
    ) {
      const lower = key.toLowerCase();

      if (
        value &&
        ![
          "host",
          "connection",
          "content-length",
          "transfer-encoding"
        ].includes(lower)
      ) {
        headers.set(
          key,
          Array.isArray(value)
            ? value.join(",")
            : String(value)
        );
      }
    }

    // WordPress backend host
    headers.set(
      "Host",
      WP_HOST
    );

    // Tell WordPress the public domain
    headers.set(
      "X-Forwarded-Host",
      PUBLIC_HOST
    );

    headers.set(
      "X-Forwarded-Proto",
      "https"
    );

    headers.set(
      "X-Forwarded-Port",
      "443"
    );

    // =======================================================
    // AJAX
    // =======================================================

    const isAjax =
      pathname === "/wp-admin/admin-ajax.php";

    if (isAjax) {
      /*
       * Keep the public origin.
       * Do NOT replace the browser's Origin
       * with the Hostinger origin.
       */

      headers.set(
        "Origin",
        req.headers.origin ||
          PUBLIC_ORIGIN
      );

      headers.set(
        "Referer",
        req.headers.referer ||
          PUBLIC_ORIGIN + "/"
      );

      headers.set(
        "X-Requested-With",
        "XMLHttpRequest"
      );
    }

    // =======================================================
    // DISABLE UPSTREAM COMPRESSION
    // =======================================================

    headers.delete(
      "accept-encoding"
    );

    // =======================================================
    // REQUEST BODY
    // =======================================================

    let body;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      const contentType =
        String(
          req.headers["content-type"] || ""
        ).toLowerCase();

      // -----------------------------------------------------
      // FORM URL ENCODED
      // -----------------------------------------------------

      if (
        contentType.includes(
          "application/x-www-form-urlencoded"
        )
      ) {
        if (
          typeof req.body === "string"
        ) {
          body = req.body;
        }

        else if (
          Buffer.isBuffer(req.body)
        ) {
          body = req.body;
        }

        else {
          const params =
            new URLSearchParams();

          if (req.body) {
            for (
              const [key, value]
              of Object.entries(req.body)
            ) {
              if (
                Array.isArray(value)
              ) {
                for (
                  const item of value
                ) {
                  params.append(
                    key,
                    String(item)
                  );
                }
              }

              else if (
                value !== undefined &&
                value !== null
              ) {
                params.append(
                  key,
                  String(value)
                );
              }
            }
          }

          body =
            params.toString();
        }
      }

      // -----------------------------------------------------
      // JSON
      // -----------------------------------------------------

      else if (
        contentType.includes(
          "application/json"
        )
      ) {
        body =
          typeof req.body === "string"
            ? req.body
            : JSON.stringify(
                req.body || {}
              );
      }

      // -----------------------------------------------------
      // MULTIPART
      // -----------------------------------------------------

      else if (
        contentType.includes(
          "multipart/form-data"
        )
      ) {
        if (
          typeof req.body === "string" ||
          Buffer.isBuffer(req.body)
        ) {
          body = req.body;
        }
      }

      // -----------------------------------------------------
      // OTHER
      // -----------------------------------------------------

      else if (
        typeof req.body === "string"
      ) {
        body = req.body;
      }

      else if (
        Buffer.isBuffer(req.body)
      ) {
        body = req.body;
      }

      else if (
        req.body
      ) {
        body =
          JSON.stringify(
            req.body
          );
      }
    }

    // =======================================================
    // REQUEST WORDPRESS
    // =======================================================

    const response =
      await fetch(
        target,
        {
          method: req.method,
          headers,
          body,
          redirect: "manual"
        }
      );

    // =======================================================
    // RESPONSE HEADERS
    // =======================================================

    response.headers.forEach(
      (value, key) => {
        const lower =
          key.toLowerCase();

        if (
          ![
            "content-length",
            "content-encoding",
            "transfer-encoding",
            "connection",
            "location",
            "refresh",
            "set-cookie",
            "access-control-allow-origin",
            "access-control-allow-credentials"
          ].includes(lower)
        ) {
          res.setHeader(
            key,
            value
          );
        }
      }
    );

    // =======================================================
    // COOKIES
    // =======================================================

    if (
      typeof response.headers.getSetCookie ===
      "function"
    ) {
      const cookies =
        response.headers.getSetCookie();

      if (
        cookies &&
        cookies.length > 0
      ) {
        res.setHeader(
          "Set-Cookie",
          cookies
        );
      }
    }

    else {
      const cookie =
        response.headers.get(
          "set-cookie"
        );

      if (cookie) {
        res.setHeader(
          "Set-Cookie",
          cookie
        );
      }
    }

    // =======================================================
    // CORS
    // =======================================================

    const requestOrigin =
      req.headers.origin || "";

    res.setHeader(
      "Access-Control-Allow-Origin",
      getAllowedOrigin(
        requestOrigin
      )
    );

    res.setHeader(
      "Access-Control-Allow-Credentials",
      "true"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Requested-With, X-WP-Nonce, Authorization"
    );

    res.setHeader(
      "Vary",
      "Origin"
    );

    // =======================================================
    // NO CACHE FOR DYNAMIC REQUESTS
    // =======================================================

    if (
      isAjax ||
      pathname.startsWith("/wp-json/") ||
      pathname === "/wp-login.php"
    ) {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, max-age=0"
      );
    }

    // =======================================================
    // OPTIONS
    // =======================================================

    if (
      req.method === "OPTIONS"
    ) {
      return res
        .status(204)
        .end();
    }

    // =======================================================
    // HTTP REDIRECT
    // =======================================================

    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      let location =
        response.headers.get(
          "location"
        );

      if (location) {
        location =
          normalizeRedirect(
            location
          );

        res.status(
          response.status
        );

        res.setHeader(
          "Location",
          location
        );

        return res.end();
      }
    }

    // =======================================================
    // REFRESH REDIRECT
    // =======================================================

    const refresh =
      response.headers.get(
        "refresh"
      );

    if (refresh) {
      res.setHeader(
        "Refresh",
        rewriteUrls(refresh)
      );
    }

    // =======================================================
    // CONTENT TYPE
    // =======================================================

    const contentType =
      (
        response.headers.get(
          "content-type"
        ) || ""
      ).toLowerCase();

    // =======================================================
    // HTML
    // =======================================================

    if (
      contentType.includes(
        "text/html"
      ) ||
      contentType.includes(
        "application/xhtml+xml"
      )
    ) {
      let html =
        await response.text();

      html =
        rewriteUrls(html);

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) ||
        "text/html; charset=utf-8"
      );

      return res.send(
        html
      );
    }

    // =======================================================
    // CSS
    // =======================================================

    if (
      contentType.includes(
        "text/css"
      )
    ) {
      let css =
        await response.text();

      css =
        rewriteUrls(css);

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) ||
        "text/css; charset=utf-8"
      );

      return res.send(
        css
      );
    }

    // =======================================================
    // JAVASCRIPT
    // =======================================================

    if (
      contentType.includes(
        "javascript"
      ) ||
      contentType.includes(
        "ecmascript"
      ) ||
      pathname.endsWith(
        ".js"
      )
    ) {
      let js =
        await response.text();

      js =
        rewriteUrls(js);

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) ||
        "application/javascript; charset=utf-8"
      );

      return res.send(
        js
      );
    }

    // =======================================================
    // XML
    // =======================================================

    if (
      contentType.includes(
        "xml"
      ) ||
      pathname.endsWith(
        ".xml"
      ) ||
      pathname.endsWith(
        ".xsl"
      )
    ) {
      let xml =
        await response.text();

      xml =
        rewriteUrls(xml);

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) ||
        "application/xml; charset=utf-8"
      );

      return res.send(
        xml
      );
    }

    // =======================================================
    // JSON / FLUENT FORMS AJAX
    // =======================================================

    if (
      contentType.includes(
        "application/json"
      ) ||
      contentType.includes(
        "+json"
      )
    ) {
      let json =
        await response.text();

      /*
       * This is important for Fluent Forms.
       *
       * Fluent Forms can return:
       *
       * {
       *   success: true,
       *   redirectUrl:
       *   "https://magenta-caterpillar-505539.hostingersite.com/thank-you/"
       * }
       *
       * Rewrite the URL before the browser
       * receives the JSON.
       */

      json =
        rewriteUrls(json);

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) ||
        "application/json; charset=utf-8"
      );

      return res.send(
        json
      );
    }

    // =======================================================
    // BINARY
    // =======================================================

    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.status(
      response.status
    );

    return res.send(
      buffer
    );

  } catch (error) {
    console.error(
      "WordPress proxy error:",
      error
    );

    return res
      .status(502)
      .json({
        error:
          "WordPress proxy failed",
        message:
          error.message
      });
  }
}
