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
    // =================================================
    // INCOMING REQUEST
    // =================================================

    const incoming = new URL(
      req.url,
      `https://${req.headers.host}`
    );

    const target =
      WP_ORIGIN +
      incoming.pathname +
      incoming.search;

    // =================================================
    // REQUEST HEADERS
    // =================================================

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

    // Tell Hostinger that the request is going
    // to the WordPress server.
    headers.set(
      "Host",
      WP_HOST
    );

    // Tell WordPress the public domain.
    headers.set(
      "X-Forwarded-Host",
      PUBLIC_HOST
    );

    headers.set(
      "X-Forwarded-Proto",
      "https"
    );

    // Prevent gzip/br because we need to modify
    // HTML, XML and JSON responses.
    headers.delete(
      "accept-encoding"
    );

    // =================================================
    // REQUEST BODY
    // =================================================

    let body;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      const requestContentType =
        req.headers["content-type"] || "";

      // -------------------------------------------------
      // FORM DATA
      // -------------------------------------------------

      if (
        requestContentType.includes(
          "application/x-www-form-urlencoded"
        )
      ) {
        if (
          typeof req.body === "string"
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

          body =
            params.toString();
        }
      }

      // -------------------------------------------------
      // JSON
      // -------------------------------------------------

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

      // -------------------------------------------------
      // OTHER REQUESTS
      // -------------------------------------------------

      else if (
        typeof req.body === "string"
      ) {
        body =
          req.body;
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

    // =================================================
    // REQUEST WORDPRESS
    // =================================================

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

    // =================================================
    // RESPONSE HEADERS
    // =================================================

    response.headers.forEach(
      (value, key) => {
        const lower =
          key.toLowerCase();

        // These headers can cause problems because
        // Vercel is generating the final response.
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

    // =================================================
    // HTTP REDIRECT
    // =================================================

    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      let location =
        response.headers.get(
          "location"
        );

      if (location) {

        // Convert WordPress redirects
        // to the public Vercel domain.
        location =
          replaceAllWordPressUrls(
            location
          );

        // Handle relative redirects.
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

    // =================================================
    // RESPONSE CONTENT TYPE
    // =================================================

    const responseContentType =
      response.headers.get(
        "content-type"
      ) || "";

    // =================================================
    // HTML
    // =================================================

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

    // =================================================
    // XML / SITEMAP
    // =================================================

    if (
      responseContentType.includes(
        "xml"
      ) ||
      incoming.pathname.endsWith(
        ".xml"
      ) ||
      incoming.pathname.endsWith(
        ".xsl"
      )
    ) {
      let xml =
        await response.text();

      // IMPORTANT:
      // This fixes Yoast sitemap URLs such as:
      //
      // magenta-caterpillar-505539.hostingersite.com
      //
      // and changes them to:
      //
      // www.mymaxclinic.sg

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

    // =================================================
    // JSON
    // =================================================

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

    // =================================================
    // EVERYTHING ELSE
    // =================================================

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


  // ===================================================
  // REPLACE WORDPRESS URLS
  // ===================================================

  function replaceAllWordPressUrls(value) {

    if (!value) {
      return value;
    }

    let result =
      String(value);

    // =================================================
    // NORMAL HTTPS URL
    // =================================================

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

    // =================================================
    // NORMAL HTTP URL
    // =================================================

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

    // =================================================
    // PROTOCOL RELATIVE
    // =================================================

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

    // =================================================
    // ESCAPED JSON URL
    //
    // https:\/\/magenta...
    // =================================================

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

    // =================================================
    // ESCAPED PROTOCOL RELATIVE
    //
    // \:\/\/magenta...
    // =================================================

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

    // =================================================
    // EXTRA SAFETY
    //
    // Handles the WordPress domain even when it appears
    // in places we didn't specifically anticipate.
    // =================================================

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
