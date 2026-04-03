// data_ingestion.js

const fetchData = require('./fetch_route');
const parser = require('./parser');
const { preFilter } = require('./Pre-Compression/pre_filter');
const { marketMapping } = require('./Pre-Compression/market_mapping');

module.exports = async function dataIngestion(source) {
  
  // 1️⃣ fetch raw
  const rawData = await fetchData(source);

  if (!rawData) return null;

  // 2️⃣ parse → 标准结构
  const event = parser(rawData, source);
  if (!event) return null;

  // 3️⃣ pre-compression filtering
  const threshold = Number(process.env.EVENT_IMPACT_THRESHOLD ?? 20);
  const passed = preFilter(event, threshold);
  if (!passed) return null;

  // 4️⃣ market mapping
  const mapped = marketMapping(passed);

  return mapped;
};