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
    const incoming = new URL(
      req.url,
      `https://${req.headers.host}`
    );

    const target =
      WP_ORIGIN +
      incoming.pathname +
      incoming.search;

    // =====================================================
    // ROBOTS.TXT
    // =====================================================

    if (incoming.pathname === "/robots.txt") {
      res.status(200);
      res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
      );

      return res.send(`User-agent: *
Allow: /

Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

Disallow: /wp-login.php
Disallow: /?s=
Disallow: /search/

Sitemap: https://www.mymaxclinic.sg/sitemap_index.xml`);
    }

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

    // WordPress server host
    headers.set("Host", WP_HOST);

    // Tell WordPress the public domain
    headers.set(
      "X-Forwarded-Host",
      PUBLIC_HOST
    );

    headers.set(
      "X-Forwarded-Proto",
      "https"
    );

    // =====================================================
    // IMPORTANT FOR WORDPRESS / ELEMENTOR AJAX
    // =====================================================

    if (headers.has("origin")) {
      headers.set(
        "Origin",
        WP_ORIGIN
      );
    }

    if (headers.has("referer")) {
      headers.set(
        "Referer",
        WP_ORIGIN + incoming.pathname
      );
    }

    // Do not ask WordPress for compressed response.
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

      // -----------------------------------------------------
      // application/x-www-form-urlencoded
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
        } else if (
          Buffer.isBuffer(req.body)
        ) {
          body = req.body;
        } else {
          const params =
            new URLSearchParams();

          if (req.body) {
            for (
              const [key, value]
              of Object.entries(req.body)
            ) {
              if (Array.isArray(value)) {
                value.forEach((item) => {
                  params.append(
                    key,
                    String(item)
                  );
                });
              } else if (
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

          body = params.toString();
        }
      }

      // -----------------------------------------------------
      // application/json
      // -----------------------------------------------------

      else if (
        contentType.includes(
          "application/json"
        )
      ) {
        if (
          typeof req.body === "string"
        ) {
          body = req.body;
        } else {
          body = JSON.stringify(
            req.body || {}
          );
        }
      }

      // -----------------------------------------------------
      // multipart/form-data
      // -----------------------------------------------------

      else if (
        contentType.includes(
          "multipart/form-data"
        )
      ) {
        if (
          typeof req.body === "string"
        ) {
          body = req.body;
        } else if (
          Buffer.isBuffer(req.body)
        ) {
          body = req.body;
        } else {
          body = undefined;
        }
      }

      // -----------------------------------------------------
      // Other POST requests
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
        body = JSON.stringify(
          req.body
        );
      }
    }

    // =====================================================
    // SEND REQUEST TO WORDPRESS
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
            "connection"
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
      responseContentType.includes("xml") ||
      incoming.pathname.endsWith(".xml") ||
      incoming.pathname.endsWith(".xsl")
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
    // JSON / ELEMENTOR AJAX
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
  // REPLACE WORDPRESS URLS
  // =====================================================

  function replaceAllWordPressUrls(value) {
    if (!value) {
      return value;
    }

    let result =
      String(value);

    // Normal HTTPS
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

    // Normal HTTP
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

    // Protocol-relative
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

    // Escaped JSON URLs
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

    // Escaped protocol-relative
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

    // Extra safety
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
