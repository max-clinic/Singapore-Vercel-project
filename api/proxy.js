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
    // WORDPRESS TARGET
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
            : String(value)
        );
      }
    }

    // -----------------------------------------------------
    // IMPORTANT
    //
    // WordPress must receive its own Host.
    // But DO NOT overwrite Origin/Referer.
    // -----------------------------------------------------

    headers.set(
      "Host",
      WP_HOST
    );

    headers.set(
      "X-Forwarded-Host",
      PUBLIC_HOST
    );

    headers.set(
      "X-Forwarded-Proto",
      "https"
    );

    headers.set(
      "X-Forwarded-For",
      req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      ""
    );

    // -----------------------------------------------------
    // DO NOT CHANGE BROWSER ORIGIN
    // -----------------------------------------------------
    //
    // The browser sends:
    //
    // Origin: https://www.mymaxclinic.sg
    //
    // Keep it that way.
    //

    if (req.headers.origin) {
      headers.set(
        "Origin",
        req.headers.origin
      );
    }

    if (req.headers.referer) {
      headers.set(
        "Referer",
        req.headers.referer
      );
    }

    // -----------------------------------------------------
    // Prevent compressed upstream response.
    // This allows URL replacement safely.
    // -----------------------------------------------------

    headers.delete(
      "accept-encoding"
    );

    // =====================================================
    // REQUEST BODY
    // =====================================================

    let body = undefined;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      const contentType =
        String(
          req.headers["content-type"] || ""
        ).toLowerCase();

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
                value.forEach(
                  item => {
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
        /*
         * If Vercel has already parsed multipart,
         * do not try to reconstruct it.
         *
         * Most Fluent Forms submissions are
         * application/x-www-form-urlencoded.
         */

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
          body = undefined;
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
          JSON.stringify(
            req.body
          );
      }
    }

    // =====================================================
    // FETCH WORDPRESS
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

        // Relative redirect
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

      res.status(
        response.status
      );

      return res.end();
    }

    // =====================================================
    // CONTENT TYPE
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
        "text/html; charset=utf-8"
      );

      return res.send(
        html
      );
    }

    // =====================================================
    // XML / SITEMAP / XSL
    // =====================================================

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
    // CSS
    // =====================================================

    if (
      responseContentType.includes(
        "text/css"
      ) ||
      pathname.endsWith(
        ".css"
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
        responseContentType ||
        "application/javascript; charset=utf-8"
      );

      return res.send(
        js
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

  }

  catch (error) {

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

  // =======================================================
  // REPLACE WORDPRESS URLS
  // =======================================================

  function replaceAllWordPressUrls(value) {

    if (!value) {
      return value;
    }

    let result =
      String(value);

    // =====================================================
    // NORMAL HTTPS
    // =====================================================

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

    // =====================================================
    // NORMAL HTTP
    // =====================================================

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

    // =====================================================
    // PROTOCOL RELATIVE
    // =====================================================

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

    // =====================================================
    // ESCAPED JSON HTTPS
    // =====================================================

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

    // =====================================================
    // ESCAPED JSON HTTP
    // =====================================================

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

    // =====================================================
    // ESCAPED PROTOCOL RELATIVE
    // =====================================================

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

    // =====================================================
    // HTML ENTITY / URL ENCODED VARIANTS
    // =====================================================

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
