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

  try {
    // =====================================================
    // INCOMING URL
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

    // =====================================================
    // TARGET WORDPRESS URL
    // =====================================================

    const target =
      WP_ORIGIN +
      pathname +
      incoming.search;

    // =====================================================
    // REQUEST HEADERS
    // =====================================================

    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
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
            : value
        );
      }
    }

    // -----------------------------------------------------
    // WORDPRESS HOST
    // -----------------------------------------------------

    headers.set("Host", WP_HOST);

    // -----------------------------------------------------
    // PUBLIC DOMAIN
    // -----------------------------------------------------

    headers.set(
      "X-Forwarded-Host",
      PUBLIC_HOST
    );

    headers.set(
      "X-Forwarded-Proto",
      "https"
    );

    // =====================================================
    // AJAX / CORS
    // =====================================================

    const isAjax =
      pathname === "/wp-admin/admin-ajax.php";

    if (isAjax) {
      // WordPress receives its own origin.
      headers.set(
        "Origin",
        WP_ORIGIN
      );

      headers.set(
        "Referer",
        WP_ORIGIN + "/"
      );

      headers.set(
        "X-Requested-With",
        "XMLHttpRequest"
      );
    }

    // =====================================================
    // DO NOT REQUEST COMPRESSED RESPONSE
    // =====================================================

    headers.delete("accept-encoding");

    // =====================================================
    // REQUEST BODY
    // =====================================================

    let body = undefined;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      const contentType =
        req.headers["content-type"] || "";

      // ---------------------------------------------------
      // FORM URL ENCODED
      // ---------------------------------------------------

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
                value.forEach((item) => {
                  params.append(
                    key,
                    String(item)
                  );
                });
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

      // ---------------------------------------------------
      // JSON
      // ---------------------------------------------------

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

      // ---------------------------------------------------
      // MULTIPART
      // ---------------------------------------------------

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

      // ---------------------------------------------------
      // OTHER
      // ---------------------------------------------------

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

    // =====================================================
    // OPTIONS / PREFLIGHT
    // =====================================================

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    // =====================================================
    // REDIRECT
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
          replaceAllWordPressUrls(
            location
          );

        // Relative URL
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
      response.headers.get(
        "content-type"
      ) || "";

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
        replaceAllWordPressUrls(
          html
        );

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        responseContentType
      );

      return res.send(
        html
      );
    }

    // =====================================================
    // XML / SITEMAP
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
        replaceAllWordPressUrls(
          xml
        );

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        "text/xml; charset=UTF-8"
      );

      return res.send(
        xml
      );
    }

    // =====================================================
    // JSON / AJAX
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

      json =
        replaceAllWordPressUrls(
          json
        );

      res.status(
        response.status
      );

      res.setHeader(
        "Content-Type",
        "application/json; charset=utf-8"
      );

      return res.send(
        json
      );
    }

    // =====================================================
    // EVERYTHING ELSE
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

    return res.status(
      502
    ).json({
      error:
        "WordPress proxy failed",
      message:
        error.message
    });
  }

  // =====================================================
  // REPLACE ALL WORDPRESS URLs
  // =====================================================

  function replaceAllWordPressUrls(value) {
    if (!value) {
      return value;
    }

    let result =
      String(value);

    // -----------------------------------------------------
    // HTTPS
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `https://${WP_WWW_HOST}`,
        PUBLIC_ORIGIN
      );

    result =
      result.replaceAll(
        `https://${WP_HOST}`,
        PUBLIC_ORIGIN
      );

    // -----------------------------------------------------
    // HTTP
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `http://${WP_WWW_HOST}`,
        PUBLIC_ORIGIN
      );

    result =
      result.replaceAll(
        `http://${WP_HOST}`,
        PUBLIC_ORIGIN
      );

    // -----------------------------------------------------
    // PROTOCOL RELATIVE
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `//${WP_WWW_HOST}`,
        `//${PUBLIC_HOST}`
      );

    result =
      result.replaceAll(
        `//${WP_HOST}`,
        `//${PUBLIC_HOST}`
      );

    // -----------------------------------------------------
    // ESCAPED JSON URLS
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `https:\\/\\/${WP_WWW_HOST}`,
        `https:\\/\\/${PUBLIC_HOST}`
      );

    result =
      result.replaceAll(
        `https:\\/\\/${WP_HOST}`,
        `https:\\/\\/${PUBLIC_HOST}`
      );

    result =
      result.replaceAll(
        `http:\\/\\/${WP_WWW_HOST}`,
        `https:\\/\\/${PUBLIC_HOST}`
      );

    result =
      result.replaceAll(
        `http:\\/\\/${WP_HOST}`,
        `https:\\/\\/${PUBLIC_HOST}`
      );

    // -----------------------------------------------------
    // ESCAPED PROTOCOL RELATIVE
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `\\/\\/${WP_WWW_HOST}`,
        `\\/\\/${PUBLIC_HOST}`
      );

    result =
      result.replaceAll(
        `\\/\\/${WP_HOST}`,
        `\\/\\/${PUBLIC_HOST}`
      );

    // -----------------------------------------------------
    // HOSTNAME ONLY
    // -----------------------------------------------------

    result =
      result.replaceAll(
        WP_WWW_HOST,
        PUBLIC_HOST
      );

    result =
      result.replaceAll(
        WP_HOST,
        PUBLIC_HOST
      );

    return result;
  }
}
