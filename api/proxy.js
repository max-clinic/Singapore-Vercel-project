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
      if (
        value &&
        ![
          "host",
          "connection",
          "content-length"
        ].includes(key.toLowerCase())
      ) {
        headers.set(
          key,
          Array.isArray(value)
            ? value.join(",")
            : value
        );
      }
    }

    // Tell WordPress the real origin
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

    // Forward request body for POST/PUT/PATCH
    let body = undefined;

    if (
      req.method !== "GET" &&
      req.method !== "HEAD"
    ) {
      if (req.body) {
        body = req.body;
      }
    }

    // Request WordPress
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

    // Handle redirects
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

    // CSS, JS, images, fonts, videos, JSON, etc.
    const buffer = Buffer.from(
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
      error: "WordPress proxy failed"
    });
  }
}
