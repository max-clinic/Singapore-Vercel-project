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

  function resolveAllowedOrigin(requestOrigin) {
    if (!requestOrigin) {
      return PUBLIC_ORIGIN;
    }

    if (requestOrigin === PUBLIC_ORIGIN) {
      return PUBLIC_ORIGIN;
    }

    if (ALLOWED_ORIGIN_PATTERN.test(requestOrigin)) {
      return requestOrigin;
    }

    return PUBLIC_ORIGIN;
  }

  // =========================================================
  // REPLACE WORDPRESS URLS
  // =========================================================

  function replaceAllWordPressUrls(value) {
    if (value === undefined || value === null) {
      return value;
    }

    let result = String(value);

    // -------------------------------------------------------
    // HTTPS
    // -------------------------------------------------------

    result = result.replaceAll(
      `https://${WP_WWW_HOST}`,
      PUBLIC_ORIGIN
    );

    result = result.replaceAll(
      `https://${WP_HOST}`,
      PUBLIC_ORIGIN
    );

    // -------------------------------------------------------
    // HTTP
    // -------------------------------------------------------

    result = result.replaceAll(
      `http://${WP_WWW_HOST}`,
      PUBLIC_ORIGIN
    );

    result = result.replaceAll(
      `http://${WP_HOST}`,
      PUBLIC_ORIGIN
    );

    // -------------------------------------------------------
    // PROTOCOL RELATIVE
    // -------------------------------------------------------

    result = result.replaceAll(
      `//${WP_WWW_HOST}`,
      `//${PUBLIC_HOST}`
    );

    result = result.replaceAll(
      `//${WP_HOST}`,
      `//${PUBLIC_HOST}`
    );

    // -------------------------------------------------------
    // ESCAPED JSON HTTPS
    //
    // Example:
    // https:\/\/magenta-caterpillar-505539.hostingersite.com
    // -------------------------------------------------------

    result = result.replaceAll(
      `https:\\/\\/${WP_WWW_HOST}`,
      `https:\\/\\/${PUBLIC_HOST}`
    );

    result = result.replaceAll(
      `https:\\/\\/${WP_HOST}`,
      `https:\\/\\/${PUBLIC_HOST}`
    );

    // -------------------------------------------------------
    // ESCAPED JSON HTTP
    // -------------------------------------------------------

    result = result.replaceAll(
      `http:\\/\\/${WP_WWW_HOST}`,
      `https:\\/\\/${PUBLIC_HOST}`
    );

    result = result.replaceAll(
      `http:\\/\\/${WP_HOST}`,
      `https:\\/\\/${PUBLIC_HOST}`
    );

    // -------------------------------------------------------
    // ESCAPED PROTOCOL RELATIVE
    // -------------------------------------------------------

    result = result.replaceAll(
      `\\/\\/${WP_WWW_HOST}`,
      `\\/\\/${PUBLIC_HOST}`
    );

    result = result.replaceAll(
      `\\/\\/${WP_HOST}`,
      `\\/\\/${PUBLIC_HOST}`
    );

    // -------------------------------------------------------
    // HOSTNAME ONLY
    // -------------------------------------------------------

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
  // NORMALIZE REDIRECT URL
  // =========================================================

  function normalizeRedirectUrl(location) {
    if (!location) {
      return location;
    }

    let result = replaceAllWordPressUrls(location);

    // Relative redirect
    if (
      result.startsWith("/") &&
      !result.startsWith("//")
    ) {
      result =
        PUBLIC_ORIGIN +
        result;
    }

    // Protocol-relative redirect
    if (result.startsWith("//")) {
      result =
        "https:" +
        result;
    }

    return result;
  }

  try {
    // =======================================================
    // INCOMING URL
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

    // =======================================================
    // WORDPRESS HOST
    // =======================================================

    headers.set(
      "Host",
      WP_HOST
    );

    // =======================================================
    // PUBLIC DOMAIN INFORMATION
    // =======================================================

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
       * Keep the browser's original Origin when possible.
       * This is safer for CORS/security validation.
       */

      const browserOrigin =
        req.headers.origin;

      if (browserOrigin) {
        headers.set(
          "Origin",
          browserOrigin
        );
      } else {
        headers.set(
          "Origin",
          PUBLIC_ORIGIN
        );
      }

      /*
       * Referer should represent the public site.
       */

      headers.set(
        "Referer",
        PUBLIC_ORIGIN + "/"
      );

      headers.set(
        "X-Requested-With",
        "XMLHttpRequest"
      );
    }

    // =======================================================
    // DO NOT REQUEST COMPRESSED RESPONSE
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
          JSON.stringify(req.body);
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
            "access-control-allow-origin",
            "access-control-allow-credentials",
            "set-cookie"
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
    // PRESERVE SET-COOKIE
    // =======================================================

    if (
      typeof response.headers.getSetCookie ===
      "function"
    ) {
      const setCookies =
        response.headers.getSetCookie();

      if (
        setCookies &&
        setCookies.length
      ) {
        res.setHeader(
          "Set-Cookie",
          setCookies
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

    const allowedOrigin =
      resolveAllowedOrigin(
        requestOrigin
      );

    res.setHeader(
      "Access-Control-Allow-Origin",
      allowedOrigin
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
    // NEVER CACHE DYNAMIC REQUESTS
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
    // OPTIONS / PREFLIGHT
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
          normalizeRedirectUrl(
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
    // REFRESH HEADER REDIRECT
    // =======================================================

    const refreshHeader =
      response.headers.get(
        "refresh"
      );

    if (refreshHeader) {
      const rewrittenRefresh =
        replaceAllWordPressUrls(
          refreshHeader
        );

      res.setHeader(
        "Refresh",
        rewrittenRefresh
      );
    }

    // =======================================================
    // RESPONSE CONTENT TYPE
    // =======================================================

    const responseContentType =
      (
        response.headers.get(
          "content-type"
        ) || ""
      ).toLowerCase();

    // =======================================================
    // TEXT / HTML
    // =======================================================

    if (
      responseContentType.includes(
        "text/html"
      ) ||
      responseContentType.includes(
        "application/xhtml+xml"
      ) ||
      responseContentType.includes(
        "text/plain"
      )
    ) {
      let text =
        await response.text();

      text =
        replaceAllWordPressUrls(
          text
        );

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) ||
        "text/plain; charset=utf-8"
      );

      return res.send(
        text
      );
    }

    // =======================================================
    // CSS
    // =======================================================

    if (
      responseContentType.includes(
        "text/css"
      )
    ) {
      let css =
        await response.text();

      css =
        replaceAllWordPressUrls(
          css
        );

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
      responseContentType.includes(
        "javascript"
      ) ||
      responseContentType.includes(
        "ecmascript"
      ) ||
      pathname.endsWith(
        ".js"
      )
    ) {
      let js =
        await response.text();

      js =
        replaceAllWordPressUrls(
          js
        );

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
    // XML / SITEMAP
    // =======================================================

    if (
      responseContentType.includes(
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
        replaceAllWordPressUrls(
          xml
        );

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
    // JSON / AJAX
    // =======================================================

    if (
      responseContentType.includes(
        "application/json"
      ) ||
      responseContentType.includes(
        "+json"
      )
    ) {
      let json =
        await response.text();

      /*
       * IMPORTANT:
       *
       * Fluent Forms can return the Thank You
       * redirect URL inside JSON.
       *
       * Example:
       *
       * {
       *   "success": true,
       *   "redirectUrl":
       *   "https://magenta-caterpillar-505539.hostingersite.com/thank-you/"
       * }
       *
       * We rewrite that URL before sending
       * the response back to the browser.
       */

      json =
        replaceAllWordPressUrls(
          json
        );

      /*
       * Also handle escaped URLs that may contain
       * Unicode slash escaping or other encoding.
       */

      json =
        json.replaceAll(
          `https%3A%2F%2F${WP_HOST}`,
          `https%3A%2F%2F${PUBLIC_HOST}`
        );

      json =
        json.replaceAll(
          `https%3A%2F%2F${WP_WWW_HOST}`,
          `https%3A%2F%2F${PUBLIC_HOST}`
        );

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
