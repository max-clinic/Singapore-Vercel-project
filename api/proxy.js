export default async function handler(req, res) {
  const ORIGIN = "https://magenta-caterpillar-505539.hostingersite.com";

  const incomingUrl = new URL(
    req.url,
    `https://${req.headers.host}`
  );

  const targetUrl =
    ORIGIN +
    incomingUrl.pathname +
    incomingUrl.search;

  try {
    const headers = new Headers();

    // Forward important browser headers
    if (req.headers["user-agent"]) {
      headers.set("user-agent", req.headers["user-agent"]);
    }

    if (req.headers.accept) {
      headers.set("accept", req.headers.accept);
    }

    if (req.headers["accept-language"]) {
      headers.set(
        "accept-language",
        req.headers["accept-language"]
      );
    }

    if (req.headers.cookie) {
      headers.set("cookie", req.headers.cookie);
    }

    if (req.headers.referer) {
      headers.set("referer", req.headers.referer);
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      redirect: "manual"
    });

    // Copy response headers
    response.headers.forEach((value, key) => {
      const blocked = [
        "content-encoding",
        "content-length",
        "transfer-encoding",
        "connection"
      ];

      if (!blocked.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Handle redirects
    if (
      response.status >= 300 &&
      response.status < 400
    ) {
      const location = response.headers.get("location");

      if (location) {
        const newLocation = location.replace(
          ORIGIN,
          "https://mymaxclinic.sg"
        );

        res.status(response.status);
        res.setHeader("Location", newLocation);
        return res.end();
      }
    }

    const contentType =
      response.headers.get("content-type") || "";

    /*
     * HTML:
     * Replace old WordPress domain with
     * the public Vercel/domain URL.
     */
    if (
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml+xml")
    ) {
      let html = await response.text();

      html = html
        .replaceAll(
          "https://magenta-caterpillar-505539.hostingersite.com",
          "https://mymaxclinic.sg"
        )
        .replaceAll(
          "http://magenta-caterpillar-505539.hostingersite.com",
          "https://mymaxclinic.sg"
        )
        .replaceAll(
          "//magenta-caterpillar-505539.hostingersite.com",
          "//mymaxclinic.sg"
        );

      res.status(response.status);
      return res.send(html);
    }

    /*
     * CSS, JS, images, fonts, videos,
     * JSON, etc.
     *
     * DO NOT convert these to text.
     */
    const data = Buffer.from(
      await response.arrayBuffer()
    );

    res.status(response.status);
    return res.send(data);

  } catch (error) {
    console.error("Proxy error:", error);

    return res.status(502).json({
      error: "Proxy request failed"
    });
  }
}
