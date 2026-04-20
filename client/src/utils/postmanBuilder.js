export function buildPostmanCollection({ endpoints, scripts, testcase, baseUrl, collectionName }) {
  const items = endpoints.map((ep, i) => {
    const headerList = ep.headers
      ? ep.headers.split('\n').filter(Boolean).map((h) => {
          const [key, ...rest] = h.split(':');
          return { key: key.trim(), value: rest.join(':').trim(), type: 'text' };
        })
      : [];

    let rawBody = null;
    if (ep.body && ['POST', 'PUT', 'PATCH'].includes(ep.method)) {
      try { JSON.parse(ep.body); rawBody = ep.body; }
      catch { rawBody = JSON.stringify({ example: ep.body }); }
    }

    return {
      name: ep.name || `${ep.method} ${ep.path}`,
      request: {
        method: ep.method,
        header: headerList,
        body: rawBody ? { mode: 'raw', raw: rawBody, options: { raw: { language: 'json' } } } : undefined,
        url: {
          raw: `{{baseUrl}}${ep.path}`,
          host: ['{{baseUrl}}'],
          path: ep.path.replace(/^\//, '').split('/'),
        },
      },
      event: [{
        listen: 'test',
        script: { type: 'text/javascript', exec: (scripts[i] || '').split('\n') },
      }],
    };
  });

  return {
    info: {
      name: collectionName || 'Collection de tests',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: testcase || '',
    },
    variable: [{ key: 'baseUrl', value: baseUrl || 'https://api.example.com', type: 'string' }],
    item: items,
  };
}

export function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
