// data_ingestion.js

const fetchData = require('./fetch_router');
const parser = require('./parser');

module.exports = async function dataIngestion(source) {
  
  // 1️⃣ fetch raw
  const rawData = await fetchData(source);

  if (!rawData) return null;

  // 2️⃣ parse → 标准结构
  const formatted = parser(rawData, source);

  return formatted;
};