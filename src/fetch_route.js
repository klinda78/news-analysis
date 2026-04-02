// fetch_router.js

const Fetcher = require('./Fetcher');

module.exports = async function fetchData(source) {

  switch (source.access.mode) {

    case 'api':
      return Fetcher.fetchDataFromAPI(source);

    case 'oauth':
      return Fetcher.fetchDataFromOAuthAPI(source);

    case 'scraper':
      return Fetcher.fetchDataFromWeb(source);

    case 'browser':
      return Fetcher.fetchDataFromBrowser(source);

    default:
      throw new Error(`Unknown mode: ${source.access.mode}`);
  }
};