// Minimal fetcher implementation to support the current data pipeline.
// This project currently focuses on the "fetch-data-layer" skeleton.
//
// Notes:
// - If `source.access.url` is a placeholder (not an actual http(s) URL),
//   we return a mock raw payload so the pipeline can continue.
// - For real scraping/browser automation, you can later replace these
//   functions with axios/cheerio/puppeteer as needed.

const https = require('https');

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

async function runWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur], cur);
    }
  }

  const workers = [];
  const n = Math.max(1, Math.min(limit, items.length));
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function fetchTextHttp(url) {
  // Prefer global `fetch` if available (Node 18+).
  if (typeof fetch === 'function') {
    const res = await fetch(url, {
      headers: {
        // Some sites return reduced content without a UA.
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    return await res.text();
  }

  // Fallback to https for older Node versions.
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

async function fetchDataFromAPI(source) {
  const url = source?.access?.url;
  if (!isHttpUrl(url)) {
    // Placeholder endpoint in current `data_source.json`.
    return { mock: true, kind: 'api', source };
  }

  try {
    const text = await fetchTextHttp(url);
    return { mock: false, kind: 'api', source, text };
  } catch (err) {
    return { mock: true, kind: 'api', source, error: err?.message ?? String(err) };
  }
}

async function fetchDataFromOAuthAPI(source) {
  // OAuth requires credentials; for now we keep a safe placeholder.
  // Replace with a real OAuth implementation when you have tokens/keys.
  const url = source?.access?.url;
  if (!isHttpUrl(url)) return { mock: true, kind: 'oauth', source };

  try {
    const text = await fetchTextHttp(url);
    return { mock: false, kind: 'oauth', source, text };
  } catch (err) {
    return { mock: true, kind: 'oauth', source, error: err?.message ?? String(err) };
  }
}

async function fetchDataFromWeb(source) {
  const url = source?.access?.url;
  if (!isHttpUrl(url)) return { mock: true, kind: 'web', source };

  try {
    const parseType = String(source?.access?.parse?.type ?? '').toLowerCase();

    // Special case: X/nitter-style profile fetching for multiple usernames.
    // `access.url` is treated as the base origin, e.g. "https://xcancel.com".
    if (parseType === 'nitter_profile' && Array.isArray(source?.targets) && source.targets.length) {
      const baseOrigin = originOf(url) || url.replace(/\/+$/, '');
      const usernames = source.targets.map((t) => String(t).trim()).filter(Boolean);

      const profiles = await runWithConcurrency(usernames, 2, async (username) => {
        const profileUrl = `${baseOrigin}/${encodeURIComponent(username)}`;
        try {
          const html = await fetchTextHttp(profileUrl);
          return { username, url: profileUrl, mock: false, html };
        } catch (err) {
          return { username, url: profileUrl, mock: true, error: err?.message ?? String(err) };
        }
      });

      return { mock: false, kind: 'web', source, profiles };
    }

    const html = await fetchTextHttp(url);
    return { mock: false, kind: 'web', source, html };
  } catch (err) {
    return { mock: true, kind: 'web', source, error: err?.message ?? String(err) };
  }
}

async function fetchDataFromBrowser(source) {
  // Full browser automation would require puppeteer/playwright.
  // For now, we degrade to a plain web fetch.
  return fetchDataFromWeb(source);
}

module.exports = {
  fetchDataFromAPI,
  fetchDataFromOAuthAPI,
  fetchDataFromWeb,
  fetchDataFromBrowser,
};

