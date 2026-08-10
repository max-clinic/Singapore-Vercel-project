export default async function handler(req, res) {
  const WP_ORIGIN =
    "https://magenta-caterpillar-505539.hostingersite.com";

  const PUBLIC_ORIGIN =
    "https://mymaxclinic.sg";

  const incoming = new URL(
    req.url,
    `https://${req.headers.host}`
  );

  const target =
    WP_ORIGIN +
    incoming.pathname +
    incoming.search;

  try {
    const headers = new Headers();

    // Forward browser headers
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
          Array.isArray(value) ? value.join(",") : value
        );
      }
    }

    // Tell WordPress which public domain the visitor is using
    headers.set("Host", new URL(WP_ORIGIN).host);
    headers.set("X-Forwarded-Host", "mymaxclinic.sg");
    headers.set("X-Forwarded-Proto", "https");

    const response = await fetch(target, {
      method: req.method,
      headers,
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

    /*
     * Redirect handling
     */
    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location = response.headers.get("location");

      if (location) {
        const fixedLocation = location
          .replaceAll(WP_ORIGIN, PUBLIC_ORIGIN)
          .replaceAll(
            "http://magenta-caterpillar-505539.hostingersite.com",
            PUBLIC_ORIGIN
          );

        res.status(response.status);
        res.setHeader("Location", fixedLocation);

        return res.end();
      }
    }

    const contentType =
      response.headers.get("content-type") || "";

    /*
     * HTML
     */
    if (
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml+xml")
    ) {
      let html = await response.text();

      html = html
        .replaceAll(WP_ORIGIN, PUBLIC_ORIGIN)
        .replaceAll(
          "http://magenta-caterpillar-505539.hostingersite.com",
          PUBLIC_ORIGIN
        )
        .replaceAll(
          "//magenta-caterpillar-505539.hostingersite.com",
          "//mymaxclinic.sg"
        );

      // Fix WordPress-generated URLs
      html = html.replaceAll(
        'href="/wp-',
        `href="${PUBLIC_ORIGIN}/wp-`
      );

      res.status(response.status);

      return res.send(html);
    }

    /*
     * Everything else:
     *
     * JS
     * CSS
     * images
     * fonts
     * videos
     * JSON
     * Elementor assets
     */
    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.status(response.status);

    return res.send(buffer);

  } catch (error) {
    console.error(error);

    return res.status(502).json({
      error: "WordPress proxy failed"
    });
  }
}
