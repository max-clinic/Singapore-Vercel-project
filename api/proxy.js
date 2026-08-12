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
    // Hostinger / WordPress host
    // -----------------------------------
    headers.set(
      "Host",
      "magenta-caterpillar-505539.hostingersite.com"
    );

    headers.set(
      "X-Forwarded-Host",
      "www.mymaxclinic.sg"
    );

    headers.set(
      "X-Forwarded-Proto",
      "https"
    );

    // Prevent compressed upstream responses
    headers.delete("accept-encoding");

    // -----------------------------------
    // Prepare request body
    // -----------------------------------
    let body;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      const contentType =
        req.headers["content-type"] || "";

      // -----------------------------------
      // Form URL encoded
      // -----------------------------------
      if (
        contentType.includes(
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

      // -----------------------------------
      // JSON
      // -----------------------------------
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

      // -----------------------------------
      // Other requests
      // -----------------------------------
      else if (
        typeof req.body === "string"
      ) {
        body = req.body;
      }

      else if (req.body) {
        body = JSON.stringify(
          req.body
        );
      }
    }

    // -----------------------------------
    // Request WordPress
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

    // ===================================
    // REDIRECT HANDLING
    // ===================================
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

            // www + https
            .replaceAll(
              "https://www.magenta-caterpillar-505539.hostingersite.com",
              PUBLIC_ORIGIN
            )

            // www + http
            .replaceAll(
              "http://www.magenta-caterpillar-505539.hostingersite.com",
              PUBLIC_ORIGIN
            )

            // normal https
            .replaceAll(
              "https://magenta-caterpillar-505539.hostingersite.com",
              PUBLIC_ORIGIN
            )

            // normal http
            .replaceAll(
              "http://magenta-caterpillar-505539.hostingersite.com",
              PUBLIC_ORIGIN
            )

            // protocol-relative www
            .replaceAll(
              "//www.magenta-caterpillar-505539.hostingersite.com",
              "//www.mymaxclinic.sg"
            )

            // protocol-relative normal
            .replaceAll(
              "//magenta-caterpillar-505539.hostingersite.com",
              "//www.mymaxclinic.sg"
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
    // Content type
    // -----------------------------------
    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    // ===================================
    // HTML RESPONSE
    // ===================================
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

      // -----------------------------------
      // Replace Hostinger URLs with Vercel
      // -----------------------------------

      // HTTPS + www
      html = html.replaceAll(
        "https://www.magenta-caterpillar-505539.hostingersite.com",
        PUBLIC_ORIGIN
      );

      // HTTP + www
      html = html.replaceAll(
        "http://www.magenta-caterpillar-505539.hostingersite.com",
        PUBLIC_ORIGIN
      );

      // HTTPS without www
      html = html.replaceAll(
        "https://magenta-caterpillar-505539.hostingersite.com",
        PUBLIC_ORIGIN
      );

      // HTTP without www
      html = html.replaceAll(
        "http://magenta-caterpillar-505539.hostingersite.com",
        PUBLIC_ORIGIN
      );

      // Protocol-relative + www
      html = html.replaceAll(
        "//www.magenta-caterpillar-505539.hostingersite.com",
        "//www.mymaxclinic.sg"
      );

      // Protocol-relative without www
      html = html.replaceAll(
        "//magenta-caterpillar-505539.hostingersite.com",
        "//www.mymaxclinic.sg"
      );

      res.status(
        response.status
      );

      return res.send(html);
    }

    // ===================================
    // JSON / CSS / JS / Images / Fonts
    // ===================================
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
}
