function parser(rawData, source) {
  // The current `data_resource.json` uses fields like:
  // - source.platform.name
  // - source.source_type / entity_type
  // - source.metadata.authority_score
  // So we should key off `platform.name` instead of the non-existent `source.type`.
  const platform = String(
    source?.platform?.name ?? source?.type ?? source?.id ?? ''
  ).toLowerCase();

  // Optional parse strategy hint from `data_resource.json`.
  // Example: { access: { parse: { type: "rss" | "next_data" | "css" | "nitter_search" } } }
  const parseType = String(source?.access?.parse?.type ?? '').toLowerCase();

  // Use metadata to produce a basic (placeholder) impact score for pre-filtering.
  const authorityScore = Number(source?.metadata?.authority_score ?? 0.5);
  const priority = Number(source?.priority ?? 1);
  const impact_score = Math.max(0, Math.min(100, authorityScore * 20 + priority * 5));

  // Build participants list from config targets when possible.
  const participants = Array.isArray(source?.targets)
    ? source.targets.slice(0, 5)
    : ['AI'];

  // Simple HTML/RSS evidence extraction for a few platforms.
  // This is intentionally lightweight (no extra deps).
  let evidence = null;

  function decodeHtmlEntities(s) {
    return String(s)
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
  }

  function extractRssItemTitles(rssXml, limit = 5) {
    if (typeof rssXml !== 'string') return [];
    const titles = [];
    // Capture <item> ... <title>...</title>
    const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/item>/gi;
    let m;
    while ((m = itemRegex.exec(rssXml)) && titles.length < limit) {
      titles.push(decodeHtmlEntities(m[1].trim()));
    }
    return titles;
  }

  if (platform === 'google' || parseType === 'rss') {
    const rss = rawData?.html ?? rawData?.text;
    const titles = extractRssItemTitles(rss, 3);
    evidence = titles.length ? { rss_titles: titles } : { rss_titles: [] };
  } else if (platform === 'x' || platform === 'twitter' || parseType === 'nitter_search' || parseType === 'nitter_profile') {
    function stripAnchor(href) {
      if (typeof href !== 'string') return href;
      return href.replace(/#.*$/, '');
    }

    function toIsoFromTitle(title) {
      // Example: "Apr 2, 2026 · 7:51 AM UTC"
      const s = String(title).replaceAll('·', ' ').replace(/\s+/g, ' ').trim();
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    function parseNitterProfileHtml(html, baseOrigin, maxTweets = 3) {
      if (typeof html !== 'string') return [];

      const tweets = [];
      // We rely on stable micro-structure you provided:
      // - <a class="tweet-link" href="/user/status/<id>#m"></a>
      // - <span class="tweet-date"><a ... title="Apr 2, 2026 · 7:51 AM UTC">4h</a></span>
      // - <div class="tweet-content media-body" dir="auto">TEXT</div>
      //
      // Capture tweet-link + tweet-date title + tweet-content in the same neighborhood.
      const re =
        /<a\s+class="tweet-link"[^>]*href="([^"]+\/status\/\d+[^"]*)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<span\s+class="tweet-date"[\s\S]*?<a[^>]*title="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/span>[\s\S]*?<div\s+class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

      let m;
      while ((m = re.exec(html)) && tweets.length < maxTweets) {
        const href = stripAnchor(m[1]);
        const title = m[2];
        const text = decodeHtmlEntities(m[3])
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const statusIdMatch = href.match(/\/status\/(\d+)/);
        const status_id = statusIdMatch ? statusIdMatch[1] : null;

        let url = href;
        if (typeof url === 'string' && url.startsWith('/')) {
          url = `${baseOrigin}${url}`;
        }

        tweets.push({
          text,
          created_at: toIsoFromTitle(title) ?? title,
          url,
          status_id,
        });
      }

      // De-dup by status_id/url
      const seen = new Set();
      return tweets.filter((t) => {
        const k = t.status_id || t.url || t.text;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    if (parseType === 'nitter_profile' && rawData?.profiles && Array.isArray(rawData.profiles)) {
      const all = [];
      for (const p of rawData.profiles) {
        const baseOrigin = (() => {
          try {
            return new URL(p.url).origin;
          } catch {
            return null;
          }
        })();

        const tweets = p.mock ? [] : parseNitterProfileHtml(p.html, baseOrigin || '', 3);
        for (const t of tweets) all.push({ username: p.username, ...t });
      }

      evidence = {
        fetched: true,
        mode: 'nitter_profile',
        tweets: all,
      };
    } else {
      // X scraping is often restricted; keep minimal evidence unless we implement per-page parsing.
      evidence = rawData?.mock
        ? { fetched: false, reason: rawData?.error ?? 'mock' }
        : { fetched: true, mode: parseType || 'unknown' };
    }
  } else if (platform === 'polymarket' || parseType === 'next_data') {
    const html = rawData?.html ?? rawData?.text;

    function parseUsdVolume(s) {
      // Examples: "$46M", "$130K", "$2M", "$275K"
      const m = String(s).match(/\$([\d.]+)\s*([KMB])\b/i);
      if (!m) return null;
      const n = Number(m[1]);
      if (!Number.isFinite(n)) return null;
      const mult = m[2].toUpperCase() === 'K' ? 1e3 : m[2].toUpperCase() === 'M' ? 1e6 : 1e9;
      return n * mult;
    }

    function parsePolymarketEconomyPage(text, limit = 8) {
      if (typeof text !== 'string') return [];

      const markets = [];

      // 1) Prefer parsing Next.js __NEXT_DATA__ JSON (most reliable for Polymarket).
      const nextId = 'id=\"__NEXT_DATA__\"';
      const nextPos = text.indexOf(nextId);
      if (nextPos >= 0) {
        const gt = text.indexOf('>', nextPos);
        const end = text.indexOf('</script>', gt);
        if (gt >= 0 && end > gt) {
          const jsonText = text.slice(gt + 1, end);
          try {
            const next = JSON.parse(jsonText);

            function toNumberMaybe(x) {
              const n = typeof x === 'string' ? Number(x) : typeof x === 'number' ? x : NaN;
              return Number.isFinite(n) ? n : null;
            }

            function walk(node) {
              if (!node || markets.length >= limit) return;
              if (Array.isArray(node)) {
                for (const item of node) walk(item);
                return;
              }
              if (typeof node !== 'object') return;

              const title = node.title ?? node.question ?? node.name;
              const isQuestion = typeof title === 'string' && /[?？]\s*$/.test(title) && title.length <= 200;

              // Polymarket markets often embed outcome prices like ["0.98","0.02"] for Yes/No.
              const outcomePrices = node.outcomePrices ?? node.outcome_prices ?? node.prices ?? null;
              const volumeToken =
                typeof node.volume === 'string'
                  ? node.volume
                  : typeof node.volume24h === 'string'
                    ? node.volume24h
                    : null;

              if (isQuestion && Array.isArray(outcomePrices) && outcomePrices.length >= 2) {
                const yes = toNumberMaybe(outcomePrices[0]);
                const volUsd = volumeToken ? parseUsdVolume(volumeToken) : null;

                markets.push({
                  question: title,
                  yes_probability: yes,
                  volume_usd: volUsd,
                });
              }

              for (const v of Object.values(node)) walk(v);
            }

            walk(next);
          } catch {
            // Fall back to regex scan below.
          }
        }
      }

      // 2) Fallback: regex scan over rendered text.
      if (markets.length === 0) {
        const re = /([^<>\n]{6,180}[?？])[\s\S]{0,800}?(?:\bYes\s*|是\.?\s*)([0-9]{1,3})%[\s\S]{0,800}?(\$[\d.]+\s*[KMB]\b)?/gi;
        let m;
        while ((m = re.exec(text)) && markets.length < limit) {
          const question = m[1].trim();
          const yesPct = Number(m[2]);
          const volToken = m[3] || null;

          markets.push({
            question,
            yes_probability: Number.isFinite(yesPct) ? yesPct / 100 : null,
            volume_usd: volToken ? parseUsdVolume(volToken) : null,
          });
        }
      }

      // Deduplicate by question text.
      const seen = new Set();
      return markets.filter((m) => {
        if (seen.has(m.question)) return false;
        seen.add(m.question);
        return true;
      });
    }

    if (rawData?.mock) {
      evidence = { fetched: false, reason: rawData?.error ?? 'mock' };
    } else {
      const markets = parsePolymarketEconomyPage(html, 10);
      evidence = { fetched: true, markets };
    }
  }

  // Map platform -> event type used by `Pre-Compression/market_mapping.js`.
  let event_type = 'Policy Event';
  let topic_acceleration = 'medium';
  let authority_signal = true;
  let cross_platform = false;

  if (platform === 'x' || platform === 'twitter') {
    event_type = 'Social Trend';
    topic_acceleration = 'high';
    cross_platform = true;
  } else if (platform === 'polymarket') {
    event_type = 'Capital Flow';
    topic_acceleration = 'high';
    cross_platform = true;
  } else if (platform === 'google') {
    event_type = 'Policy Event';
    topic_acceleration = 'medium';
    cross_platform = true;
  } else if (platform === 'bilibili') {
    event_type = 'Social Trend';
    topic_acceleration = 'medium';
    cross_platform = true;
  } else if (platform === 'taobao') {
    event_type = 'Demand Shock';
    topic_acceleration = 'medium';
    cross_platform = false;
  } else {
    // Unknown platform => do not produce an event yet.
    return null;
  }

  return {
    event: 'AI监管/市场信号触发',
    event_type,
    participants,
    topic_acceleration,
    authority_signal,
    cross_platform,
    impact_score,
    evidence,
    source: {
      id: source?.id,
      platform,
      entity_type: source?.entity_type,
      source_type: source?.source_type,
    },
  };
}

module.exports = parser;