const dataResources = require('./data_resource.json');
const ingest = require('./data_ingestion');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  for (const source of dataResources.data_sources) {
    if (!source.active) continue;

    try {
      console.log(`Fetching: ${source.id}`);

      const result = await ingest(source);

      console.log(`Done: ${source.id}`, result.length || '');

      await sleep(source.delay || 2000); // 控制频率

    } catch (err) {
      console.error(`Error: ${source.id}`, err.message);
    }
  }
}

run();