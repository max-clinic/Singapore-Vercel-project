export default async function handler(req, res) {
  const WP_ORIGIN =
    "https://magenta-caterpillar-505539.hostingersite.com";

  const PUBLIC_ORIGIN =
    "https://www.mymaxclinic.sg";

  try {
    const incoming = new URL(
      req.url,
      `https://${req.headers.host}`
    );

    const target =
      WP_ORIGIN +
      incoming.pathname +
      incoming.search;

    const headers = new Headers();

    // -----------------------------------
    // Forward request headers
    // -----------------------------------
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

    // -----------------------------------
    // Tell WordPress about the real host
    // -----------------------------------
    headers.set(
      "Host",
      new URL(WP_ORIGIN).host
    );

    headers.set(
      "X-Forwarded-Host",
      new URL(PUBLIC_ORIGIN).host
    );

    headers.set(
      "X-Forwarded-Proto",
      "https"
    );

    // -----------------------------------
    // Prepare request body
    // -----------------------------------
    let body = undefined;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      const contentType =
        req.headers["content-type"] || "";

      // --------------------------------
      // application/x-www-form-urlencoded
      // --------------------------------
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
        } else if (
          req.body &&
          typeof req.body === "object"
        ) {
          const params = new URLSearchParams();

          for (const [key, value] of Object.entries(
            req.body
          )) {
            if (Array.isArray(value)) {
              for (const item of value) {
                params.append(
                  key,
                  String(item)
                );
              }
            } else if (value !== undefined && value !== null) {
              params.append(
                key,
                String(value)
              );
            }
          }

          body = params.toString();
        }
      }

      // --------------------------------
      // application/json
      // --------------------------------
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

      // --------------------------------
      // Other request types
      // --------------------------------
      else {
        if (
          typeof req.body === "string"
        ) {
          body = req.body;
        } else if (
          Buffer.isBuffer(req.body)
        ) {
          body = req.body;
        } else if (req.body) {
          body = JSON.stringify(
            req.body
          );
        }
      }
    }

    // -----------------------------------
    // Send request to WordPress
    // -----------------------------------
    const response = await fetch(
      target,
      {
        method: req.method,
        headers,
        body,
        redirect: "manual"
      }
    );

    // -----------------------------------
    // Copy response headers
    // -----------------------------------
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

    // -----------------------------------
    // Handle redirects
    // -----------------------------------
    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location =
        response.headers.get(
          "location"
        );

      if (location) {
        const fixedLocation =
          location
            .replaceAll(
              WP_ORIGIN,
              PUBLIC_ORIGIN
            )
            .replaceAll(
              "http://magenta-caterpillar-505539.hostingersite.com",
              PUBLIC_ORIGIN
            )
            .replaceAll(
              "https://magenta-caterpillar-505539.hostingersite.com",
              PUBLIC_ORIGIN
            );

        res.status(
          response.status
        );

        res.setHeader(
          "Location",
          fixedLocation
        );

        return res.end();
      }
    }

    // -----------------------------------
    // Get response content type
    // -----------------------------------
    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    // -----------------------------------
    // HTML
    // -----------------------------------
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

      html = html
        .replaceAll(
          WP_ORIGIN,
          PUBLIC_ORIGIN
        )
        .replaceAll(
          "http://magenta-caterpillar-505539.hostingersite.com",
          PUBLIC_ORIGIN
        )
        .replaceAll(
          "//magenta-caterpillar-505539.hostingersite.com",
          "//www.mymaxclinic.sg"
        );

      res.status(
        response.status
      );

      return res.send(html);
    }

    // -----------------------------------
    // JSON / CSS / JS / images / etc.
    // -----------------------------------
    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.status(
      response.status
    );

    return res.send(buffer);

  } catch (error) {
    console.error(
      "WordPress proxy error:",
      error
    );

    return res.status(502).json({
      error: "WordPress proxy failed",
      message: error.message
    });
  }
}
