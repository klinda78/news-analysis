const dataResources = require('./data_resource.json');
const ingest = require('./data_ingestion');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Hardcoded pacing rules (safe defaults for low-end hardware + anti-ban).
const CYCLE_INTERVAL_MS = 20 * 60 * 1000; // run once every 20 minutes
const DEFAULT_SOURCE_DELAY_MS = 1500; // delay between sources inside a cycle

function frequencyToDelayMs(frequency) {
  switch (String(frequency || '').toLowerCase()) {
    case 'high':
      return 1500;
    case 'medium':
      return 2500;
    case 'low':
      return 4000;
    case 'very_low':
      return 8000;
    default:
      return DEFAULT_SOURCE_DELAY_MS;
  }
}

async function run() {
  const sources = Array.isArray(dataResources)
    ? dataResources
    : dataResources?.data_sources;

  if (!Array.isArray(sources)) {
    throw new Error('data_resource.json must be an array or contain { data_sources: [] }');
  }

  for (const source of sources) {
    if (!source.active) continue;

    try {
      console.log(`Fetching: ${source.id}`);

      const result = await ingest(source);

      let summary = result;
      if (result && typeof result === 'object') {
        if ('event' in result) summary = result.event;
        else if ('event_brief' in result) {
          const brief = result.event_brief ?? {};
          const conf = result.confidence_score;
          summary = `${brief.event} | ${brief.event_type} | conf=${conf}`;
        }
      }
      console.log(`Done: ${source.id}`, summary || '');

      // Hardcoded per-source pacing. If a source explicitly has `delay`, it wins.
      const delayMs = Number.isFinite(Number(source.delay))
        ? Number(source.delay)
        : frequencyToDelayMs(source.frequency);
      await sleep(delayMs);

    } catch (err) {
      console.error(`Error: ${source.id}`, err.message);
    }
  }
}

async function loopForever() {
  for (;;) {
    const startedAt = Date.now();
    console.log(`\n=== Cycle start: ${new Date(startedAt).toISOString()} ===`);

    await run();

    const elapsed = Date.now() - startedAt;
    const sleepMs = Math.max(0, CYCLE_INTERVAL_MS - elapsed);
    console.log(`=== Cycle end: elapsed=${elapsed}ms, sleeping=${sleepMs}ms ===\n`);
    await sleep(sleepMs);
  }
}

loopForever();