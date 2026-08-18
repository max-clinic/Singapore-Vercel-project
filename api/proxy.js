export default async function handler(req, res) {
  const WP_ORIGIN =
    "https://magenta-caterpillar-505539.hostingersite.com";

  const WP_HOST =
    "magenta-caterpillar-505539.hostingersite.com";

  const PUBLIC_ORIGIN =
    "https://www.mymaxclinic.sg";

  const PUBLIC_HOST =
    "www.mymaxclinic.sg";

  try {
    // =====================================================
    // INCOMING REQUEST
    // =====================================================

    const incoming = new URL(
      req.url,
      `https://${req.headers.host}`
    );

    const pathname = incoming.pathname;
    // =====================================================
// ROBOTS.TXT
// =====================================================

if (pathname === "/robots.txt") {
  const robots = `User-agent: *
Allow: /

Sitemap: https://www.mymaxclinic.sg/sitemap_index.xml
`;

  res.status(200);
  res.setHeader(
    "Content-Type",
    "text/plain; charset=utf-8"
  );

  return res.send(robots);
}
    const target =
      WP_ORIGIN +
      pathname +
      incoming.search;

    // =====================================================
    // REQUEST HEADERS
    // =====================================================

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

    // Public website
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

    // =====================================================
    // AJAX
    // =====================================================

    const isAjax =
      pathname ===
      "/wp-admin/admin-ajax.php";

    if (isAjax) {
      headers.set(
        "X-Requested-With",
        "XMLHttpRequest"
      );
    }

    // =====================================================
    // REQUEST BODY
    // =====================================================

    let body;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      const requestContentType =
        String(
          req.headers["content-type"] || ""
        ).toLowerCase();

      // -----------------------------------------------
      // FORM DATA
      // -----------------------------------------------

      if (
        requestContentType.includes(
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
                value.forEach(
                  (item) => {
                    params.append(
                      key,
                      String(item)
                    );
                  }
                );
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

      // -----------------------------------------------
      // JSON
      // -----------------------------------------------

      else if (
        requestContentType.includes(
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

      // -----------------------------------------------
      // OTHER
      // -----------------------------------------------

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

    // =====================================================
    // REQUEST WORDPRESS
    // =====================================================

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

    // =====================================================
    // RESPONSE HEADERS
    // =====================================================

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

    // =====================================================
    // COOKIES
    // =====================================================

    if (
      typeof response.headers.getSetCookie ===
      "function"
    ) {
      const cookies =
        response.headers.getSetCookie();

      if (
        cookies &&
        cookies.length
      ) {
        res.setHeader(
          "Set-Cookie",
          cookies
        );
      }
    }

    // =====================================================
    // CORS
    // =====================================================

    res.setHeader(
      "Access-Control-Allow-Origin",
      PUBLIC_ORIGIN
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

    // =====================================================
    // PREFLIGHT
    // =====================================================

    if (
      req.method === "OPTIONS"
    ) {
      return res
        .status(204)
        .end();
    }

    // =====================================================
    // REDIRECTS
    // =====================================================

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
          rewriteUrl(location);

        if (
          location.startsWith("/")
        ) {
          location =
            PUBLIC_ORIGIN +
            location;
        }

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

    // =====================================================
    // RESPONSE CONTENT TYPE
    // =====================================================

    const responseContentType =
      (
        response.headers.get(
          "content-type"
        ) || ""
      ).toLowerCase();

    // =====================================================
    // HTML
    // =====================================================

    if (
      responseContentType.includes(
        "text/html"
      ) ||
      responseContentType.includes(
        "application/xhtml+xml"
      )
    ) {
      let html =
        await response.text();

      html =
        rewriteUrl(html);

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

    // =====================================================
    // CSS
    // =====================================================

    if (
      responseContentType.includes(
        "text/css"
      )
    ) {
      let css =
        await response.text();

      css =
        rewriteUrl(css);

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

    // =====================================================
    // JAVASCRIPT
    // =====================================================

    if (
      responseContentType.includes(
        "javascript"
      ) ||
      responseContentType.includes(
        "ecmascript"
      ) ||
      pathname.endsWith(".js")
    ) {
      let js =
        await response.text();

      js =
        rewriteUrl(js);

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

    // =====================================================
    // JSON
    // =====================================================

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

      // IMPORTANT:
      // Fluent Forms returns the redirect
      // information inside JSON.

      json =
        rewriteUrl(json);

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

    // =====================================================
    // XML
    // =====================================================

    if (
      responseContentType.includes(
        "xml"
      ) ||
      pathname.endsWith(".xml") ||
      pathname.endsWith(".xsl")
    ) {
      let xml =
        await response.text();

      xml =
        rewriteUrl(xml);

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

    // =====================================================
    // BINARY
    // =====================================================

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

  // =====================================================
  // URL REWRITE
  // =====================================================

  function rewriteUrl(value) {
    if (!value) {
      return value;
    }

    let result =
      String(value);

    // HTTPS
    result =
      result.replaceAll(
        `https://${WP_HOST}`,
        PUBLIC_ORIGIN
      );

    // HTTP
    result =
      result.replaceAll(
        `http://${WP_HOST}`,
        PUBLIC_ORIGIN
      );

    // Protocol relative
    result =
      result.replaceAll(
        `//${WP_HOST}`,
        `//${PUBLIC_HOST}`
      );

    // Escaped JSON HTTPS
    result =
      result.replaceAll(
        `https:\\/\\/${WP_HOST}`,
        `https:\\/\\/${PUBLIC_HOST}`
      );

    // Escaped JSON HTTP
    result =
      result.replaceAll(
        `http:\\/\\/${WP_HOST}`,
        `https:\\/\\/${PUBLIC_HOST}`
      );

    // Escaped protocol-relative
    result =
      result.replaceAll(
        `\\/\\/${WP_HOST}`,
        `\\/\\/${PUBLIC_HOST}`
      );

    // Host only
    result =
      result.replaceAll(
        WP_HOST,
        PUBLIC_HOST
      );

    return result;
  }
}
