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
      res.status(200);

      res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
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
            : value
        );
      }
    }

    // WordPress server host
    headers.set(
      "Host",
      WP_HOST
    );

    // Public domain
    headers.set(
      "X-Forwarded-Host",
      PUBLIC_HOST
    );

    headers.set(
      "X-Forwarded-Proto",
      "https"
    );

    // =====================================================
    // IMPORTANT
    // DO NOT CHANGE ORIGIN TO WORDPRESS
    // =====================================================

    // Keep the browser/public origin.
    //
    // DO NOT use:
    //
    // headers.set("Origin", WP_ORIGIN);
    // headers.set("Referer", WP_ORIGIN);

    // =====================================================
    // COMPRESSION
    // =====================================================

    // We need the uncompressed response because
    // we modify HTML/JSON/XML.
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
        req.headers["content-type"] || "";

      // ===================================================
      // URL ENCODED FORM
      // ===================================================

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

      // ===================================================
      // JSON
      // ===================================================

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

      // ===================================================
      // MULTIPART FORM DATA
      // ===================================================

      else if (
        contentType.includes(
          "multipart/form-data"
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
          body = undefined;
        }
      }

      // ===================================================
      // OTHER REQUEST
      // ===================================================

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
    // COPY RESPONSE HEADERS
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
            "location"
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
    // HANDLE REDIRECTS
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

        // Convert relative redirect
        // to public domain.
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

      // Replace all WordPress URLs.
      html =
        replaceAllWordPressUrls(
          html
        );

      // ===================================================
      // FORCE ELEMENTOR AJAX URL
      // ===================================================

      html =
        replaceElementorAjaxUrl(
          html
        );

      // ===================================================
      // FORCE WORDPRESS REST API URL
      // ===================================================

      html =
        replaceWordPressRestUrl(
          html
        );

      // ===================================================
      // FORCE ELEMENTOR CONFIG URLS
      // ===================================================

      html =
        replaceElementorConfigUrls(
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
    // XML / SITEMAP
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

      json =
        replaceElementorAjaxUrl(
          json
        );

      json =
        replaceWordPressRestUrl(
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


  // =======================================================
  // REPLACE ALL WORDPRESS URLS
  // =======================================================

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
        `https://${WP_HOST}`,
        PUBLIC_ORIGIN
      );

    // -----------------------------------------------------
    // HTTP
    // -----------------------------------------------------

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
        `//${WP_HOST}`,
        `//${PUBLIC_HOST}`
      );

    // -----------------------------------------------------
    // ESCAPED HTTPS
    // https:\/\/domain.com
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `https:\\/\\/${WP_HOST}`,
        `https:\\/\\/${PUBLIC_HOST}`
      );

    // -----------------------------------------------------
    // ESCAPED HTTP
    // -----------------------------------------------------

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
        `\\/\\/${WP_HOST}`,
        `\\/\\/${PUBLIC_HOST}`
      );

    // -----------------------------------------------------
    // FINAL HOST REPLACEMENT
    // -----------------------------------------------------

    result =
      result.replaceAll(
        WP_HOST,
        PUBLIC_HOST
      );

    return result;
  }


  // =======================================================
  // ELEMENTOR ADMIN-AJAX URL
  // =======================================================

  function replaceElementorAjaxUrl(value) {

    if (!value) {
      return value;
    }

    let result =
      String(value);

    // -----------------------------------------------------
    // Normal HTTPS
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `https://${WP_HOST}/wp-admin/admin-ajax.php`,
        `${PUBLIC_ORIGIN}/wp-admin/admin-ajax.php`
      );

    // -----------------------------------------------------
    // Normal HTTP
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `http://${WP_HOST}/wp-admin/admin-ajax.php`,
        `${PUBLIC_ORIGIN}/wp-admin/admin-ajax.php`
      );

    // -----------------------------------------------------
    // Protocol relative
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `//${WP_HOST}/wp-admin/admin-ajax.php`,
        `//${PUBLIC_HOST}/wp-admin/admin-ajax.php`
      );

    // -----------------------------------------------------
    // Escaped HTTPS
    //
    // https:\/\/domain.com\/wp-admin\/admin-ajax.php
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `https:\\/\\/${WP_HOST}\\/wp-admin\\/admin-ajax.php`,
        `https:\\/\\/${PUBLIC_HOST}\\/wp-admin\\/admin-ajax.php`
      );

    // -----------------------------------------------------
    // Escaped HTTP
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `http:\\/\\/${WP_HOST}\\/wp-admin\\/admin-ajax.php`,
        `https:\\/\\/${PUBLIC_HOST}\\/wp-admin\\/admin-ajax.php`
      );

    // -----------------------------------------------------
    // Escaped protocol relative
    // -----------------------------------------------------

    result =
      result.replaceAll(
        `\\/\\/${WP_HOST}\\/wp-admin\\/admin-ajax.php`,
        `\\/\\/${PUBLIC_HOST}\\/wp-admin\\/admin-ajax.php`
      );

    return result;
  }


  // =======================================================
  // WORDPRESS REST API
  // =======================================================

  function replaceWordPressRestUrl(value) {

    if (!value) {
      return value;
    }

    let result =
      String(value);

    result =
      result.replaceAll(
        `https://${WP_HOST}/wp-json`,
        `${PUBLIC_ORIGIN}/wp-json`
      );

    result =
      result.replaceAll(
        `http://${WP_HOST}/wp-json`,
        `${PUBLIC_ORIGIN}/wp-json`
      );

    result =
      result.replaceAll(
        `//${WP_HOST}/wp-json`,
        `//${PUBLIC_HOST}/wp-json`
      );

    result =
      result.replaceAll(
        `https:\\/\\/${WP_HOST}\\/wp-json`,
        `https:\\/\\/${PUBLIC_HOST}\\/wp-json`
      );

    result =
      result.replaceAll(
        `http:\\/\\/${WP_HOST}\\/wp-json`,
        `https:\\/\\/${PUBLIC_HOST}\\/wp-json`
      );

    result =
      result.replaceAll(
        `\\/\\/${WP_HOST}\\/wp-json`,
        `\\/\\/${PUBLIC_HOST}\\/wp-json`
      );

    return result;
  }


  // =======================================================
  // ELEMENTOR CONFIG
  // =======================================================

  function replaceElementorConfigUrls(value) {

    if (!value) {
      return value;
    }

    let result =
      String(value);

    // Elementor ajaxurl
    result =
      result.replace(
        /"ajaxurl"\s*:\s*"[^"]*\/wp-admin\/admin-ajax\.php[^"]*"/gi,
        `"ajaxurl":"${PUBLIC_ORIGIN}/wp-admin/admin-ajax.php"`
      );

    // Elementor Pro ajaxurl
    result =
      result.replace(
        /"ajaxurl"\s*:\s*"[^"]*wp-admin\/admin-ajax\.php[^"]*"/gi,
        `"ajaxurl":"${PUBLIC_ORIGIN}/wp-admin/admin-ajax.php"`
      );

    // Elementor REST URL
    result =
      result.replace(
        /"rest"\s*:\s*"[^"]*\/wp-json\/?"/gi,
        `"rest":"${PUBLIC_ORIGIN}/wp-json/"`
      );

    return result;
  }
}
