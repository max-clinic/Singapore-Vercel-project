export default async function handler(req, res) {
  const source = 'https://magenta-caterpillar-505539.hostingersite.com';
  const target = 'https://mymaxclinic.sg';

  const url = new URL(req.url, `https://${req.headers.host}`);
  const targetUrl = source + url.pathname + url.search;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        'Accept': req.headers.accept || '*/*',
      },
      redirect: 'manual',
    });

    const contentType = response.headers.get('content-type') || '';

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');

      if (location) {
        const newLocation = location
          .replace(source, target)
          .replace(
            'http://magenta-caterpillar-505539.hostingersite.com',
            target
          );

        res.status(response.status);
        res.setHeader('Location', newLocation);
        return res.end();
      }
    }

    // IMPORTANT:
    // Only modify HTML.
    // Images, CSS, JS, fonts, etc. must be returned as binary data.
    if (
      contentType.includes('text/html') ||
      contentType.includes('application/xhtml+xml')
    ) {
      let html = await response.text();

      html = html
        .replaceAll(source, target)
        .replaceAll(
          'http://magenta-caterpillar-505539.hostingersite.com',
          target
        );

      res.status(response.status);
      res.setHeader('Content-Type', contentType);

      return res.send(html);
    }

    // For images, CSS, JS, fonts, JSON, etc.
    // Return the original bytes without modifying them.
    const buffer = Buffer.from(await response.arrayBuffer());

    res.status(response.status);
    res.setHeader('Content-Type', contentType);

    return res.send(buffer);

  } catch (error) {
    console.error(error);
    return res.status(500).send('Proxy error');
  }
}
