// Diagnostic test: x_bigshots_latest (x.com Cookie mode) full chain check

const dns = require('dns');
const { originOf } = require('../src/Fetcher.js');
const path = require('path');
const os = require('os');
// sweet-cookie will be dynamically imported inside getCookiesDirectly

const TIMEOUT_MS = 15000;
const TEST_USER = 'RaoulGMI'; // target account
const TARGET_URL = `https://x.com/${TEST_USER}`;

// ========== Utility function ==========
async function getCookiesDirectly(targetUrl) {
  // Load pre‑exported X.com cookies from a JSON file (provided by the user)
  const cookiesPath = path.join(__dirname, 'x_cookies.json');
  let cookieArray;
  try {
    const raw = fs.readFileSync(cookiesPath, 'utf8');
    cookieArray = JSON.parse(raw);
    console.log('Loaded', cookieArray.length, 'cookies from JSON file');
  } catch (e) {
    console.error('Failed to read cookies JSON file:', e);
    return null;
  }
  // Build a standard Cookie header: name=value; name2=value2; ...
  const header = cookieArray.map(c => `${c.name}=${c.value}`).join('; ');
  console.log('Generated Cookie header (first 100 chars):', header.substring(0, 100) + '...');
  return header;
}

// ========== Test cases ==========
async function test1_dns() {
  console.log('\n=== TEST 1: DNS 解析 x.com ===');
  try {
    const addrs = await dns.promises.resolve4('x.com');
    console.log('  ✅ DNS 解析成功:', addrs);
    return true;
  } catch (e) {
    console.log('  ❌ DNS 解析失败:', e.message);
    return false;
  }
}

async function test2_connectivity() {
  console.log('\n=== TEST 2: TCP 连通性 (HTTPS HEAD) ===');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://x.com/', {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'
      }
    }).finally(() => clearTimeout(timer));

    console.log('  状态码:', res.status);
    if (res.status >= 200 && res.status < 400) {
      console.log('  ✅ x.com 基础连接正常');
      return true;
    } else {
      console.log('  ⚠️ x.com 返回非正常状态码:', res.status);
      return false;
    }
  } catch (e) {
    console.log('  ❌ 连接失败:', e.code || e.name, '-', e.message);
    return false;
  }
}

async function test3_cookie_retrieval() {
  console.log('\n=== TEST 3: 本地浏览器 Cookie 提取 ===');
  try {
    const cookie = await getCookiesDirectly(TARGET_URL);
    if (cookie && cookie.length > 20) {
      console.log(`  ✅ 成功获取 Cookie (长度: ${cookie.length})`);
      console.log('  Cookie 预览 (前50位):', cookie.substring(0, 50) + '...');
      return cookie;
    } else {
      console.log('  ❌ 未能提取到有效的 x.com Cookie，请确保你在浏览器中已登录 Twitter');
      return null;
    }
  } catch (e) {
    console.log('  ❌ Cookie 提取插件报错:', e.message);
    return null;
  }
}

async function test4_profile_fetch(cookie) {
  console.log(`\n=== TEST 4: 携带 Cookie 抓取用户主页 ${TARGET_URL} ===`);
  if (!cookie) {
    console.log('  ⏭ 跳过（无可用 Cookie）');
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(TARGET_URL, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'cookie': cookie,
        'accept-language': 'en-US,en;q=0.9',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    }).finally(() => clearTimeout(timer));

    const status = res.status;
    const body = await res.text();
    console.log('  状态码:', status);
    console.log('  Body 长度:', body.length, '字符');

    if (status === 403) {
      console.log('  ❌ 遭到 403 Forbidden 拦截。可能是 Cookie 失效、IP 被封或账号被限。');
    } else if (status === 429) {
      console.log('  ❌ 遭到 429 Rate Limit。请求太频繁，请稍后再试。');
    }
    return { status, body };
  } catch (e) {
    console.log('  ❌ 请求过程中发生异常:', e.name, '-', e.message);
    return null;
  }
}

async function test5_content_analysis(html) {
  console.log('\n=== TEST 5: 页面内容分析 (SSR vs SPA) ===');
  if (!html) {
    console.log('  ⏭ 跳过（无 HTML 内容）');
    return;
  }
  const isReact = html.includes('id="react-root"') || html.includes('window.__INITIAL_STATE__');
  const hasTweetText = html.includes('tweetText') || html.includes('data-testid="tweetText"');
  const hasArticle = html.includes('<article');
  if (isReact) {
    console.log('  ⚠️ 检测到 React 骨架屏 (SPA 模式)');
    console.log('  💡 结论: 该页面由客户端渲染，HTML 源码中不包含推文文本。');
    console.log('  💡 原因: x.com 对爬虫非常敏感，如果不模拟完整浏览器环境，通常只返回壳页面。');
    if (!hasTweetText && !hasArticle) {
      console.log('  ❌ 确认: 无法在源码中找到推文内容，正则解析注定失败。');
    }
  } else if (html.length < 2000 && html.includes('Redirecting')) {
    console.log('  ⚠️ 页面发生了重定向，可能需要处理登录或人机验证。');
  } else {
    console.log('  ✅ 似乎是服务端渲染 (SSR) 或包含大量数据。');
    console.log(`  是否包含 tweetText: ${hasTweetText ? '✅' : '❌'}`);
    console.log(`  是否包含 article 标签: ${hasArticle ? '✅' : '❌'}`);
  }
  const nitterRe = /class="tweet-content[^\"]*\"[^>]*>([\s\S]*?)<\/div>/gi;
  const matches = html.match(nitterRe);
  if (matches) {
    console.log(`  ✨ 意外惊喜！正则匹配到了 ${matches.length} 个疑似推文区块。`);
  } else {
    console.log('  ℹ️ 正则匹配不到任何内容（预期之中）。');
  }
}

// ========== Main flow ==========
async function main() {
  console.log('====================================================');
  console.log(' x.com Cookie 模式抓取诊断报告');
  console.log(' 目标账号:', TEST_USER);
  console.log('====================================================');

  await test1_dns();
  await test2_connectivity();
  const cookie = await test3_cookie_retrieval();

  const fetchResult = await test4_profile_fetch(cookie);
  if (fetchResult) {
    await test5_content_analysis(fetchResult.body);
  }

  console.log('\n====================================================');
  console.log(' 诊断结束');
  console.log('====================================================');
}

main().catch(console.error);
