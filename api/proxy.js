export default async function handler(req, res) {
  const hostingerUrl = 'https://magenta-caterpillar-505539.hostingersite.com';

  const requestUrl = new URL(req.url, `https://${req.headers.host}`);
  const path = requestUrl.pathname + requestUrl.search;

  const targetUrl = hostingerUrl + path;

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
        const newLocation = location.replace(
          hostingerUrl,
          'https://mymaxclinic.sg'
        );

        res.status(response.status);
        res.setHeader('Location', newLocation);
        return res.end();
      }
    }

    const body = await response.text();

    // Replace old WordPress domain inside HTML/content
    const modifiedBody = body
      .replaceAll(hostingerUrl, 'https://mymaxclinic.sg')
      .replaceAll(
        'http://magenta-caterpillar-505539.hostingersite.com',
        'https://mymaxclinic.sg'
      );

    res.status(response.status);
    res.setHeader('Content-Type', contentType);
    res.send(modifiedBody);

  } catch (error) {
    console.error(error);
    res.status(500).send('Proxy error');
  }
}
