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

    // Forward request headers
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

    // IMPORTANT
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

    // Don't send compressed responses to the proxy.
    headers.delete("accept-encoding");

    let body;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      const contentType =
        req.headers["content-type"] || "";

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
            for (const [key, value] of Object.entries(req.body)) {
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
      } else if (
        contentType.includes("application/json")
      ) {
        body =
          typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body || {});
      } else if (
        typeof req.body === "string"
      ) {
        body = req.body;
      } else if (req.body) {
        body = JSON.stringify(req.body);
      }
    }

    const response = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual"
    });

    // Copy response headers
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();

      if (
        ![
          "content-length",
          "content-encoding",
          "transfer-encoding",
          "connection"
        ].includes(lower)
      ) {
        res.setHeader(key, value);
      }
    });

    // Redirects
    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location =
        response.headers.get("location");

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

        res.status(response.status);
        res.setHeader(
          "Location",
          fixedLocation
        );

        return res.end();
      }
    }

    const contentType =
      response.headers.get("content-type") || "";

    // HTML
    if (
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml+xml")
    ) {
      let html = await response.text();

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

      res.status(response.status);
      return res.send(html);
    }

    // Everything else
    const buffer =
      Buffer.from(
        await response.arrayBuffer()
      );

    res.status(response.status);
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
