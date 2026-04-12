/**
 * 诊断测试：x_bigshots_latest 数据源抓取链路全面排查
 * 逐层检查：DNS → 连通性 → HTTP 响应 → HTML 内容 → 正则解析
 */

const https = require('https');
const dns = require('dns');

const TIMEOUT_MS = 8000;
const TEST_USER = 'elonmusk'; // 用一个确定存在的账号测试

// ========== 工具函数 ==========

function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    signal: controller.signal,
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  }).finally(() => clearTimeout(timer));
}

// ========== 测试用例 ==========

async function test1_dns() {
  console.log('\n=== TEST 1: DNS 解析 xcancel.com ===');
  try {
    const addrs = await dns.promises.resolve4('xcancel.com');
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
    const res = await fetchWithTimeout('https://xcancel.com/', 5000);
    console.log('  状态码:', res.status);
    console.log('  Headers:', Object.fromEntries([...res.headers.entries()].slice(0, 5)));
    if (res.status >= 200 && res.status < 400) {
      console.log('  ✅ xcancel.com 主页可达');
      return true;
    } else {
      console.log('  ⚠️ xcancel.com 返回非正常状态码');
      return false;
    }
  } catch (e) {
    console.log('  ❌ 连接失败:', e.code || e.name, '-', e.message);
    return false;
  }
}

async function test3_profile_page() {
  console.log(`\n=== TEST 3: 抓取用户主页 https://xcancel.com/${TEST_USER} ===`);
  try {
    const res = await fetchWithTimeout(`https://xcancel.com/${TEST_USER}`);
    const status = res.status;
    const body = await res.text();
    console.log('  状态码:', status);
    console.log('  Body 长度:', body.length, '字符');
    
    if (body.length < 500) {
      console.log('  ⚠️ 页面内容异常短，可能被封锁或重定向');
      console.log('  Body 前 500 字符:', body.substring(0, 500));
      return { ok: false, html: body };
    }
    
    // 检查是否有反爬拦截标记
    if (body.includes('Rate limit') || body.includes('rate limit')) {
      console.log('  ⚠️ 检测到 Rate Limit 拦截');
      return { ok: false, html: body };
    }
    if (body.includes('Cloudflare') || body.includes('cf-browser-verification')) {
      console.log('  ⚠️ 检测到 Cloudflare 验证页');
      return { ok: false, html: body };
    }
    
    console.log('  ✅ 成功获取页面内容');
    console.log('  Body 前 300 字符:', body.substring(0, 300));
    return { ok: true, html: body };
  } catch (e) {
    console.log('  ❌ 请求失败:', e.code || e.name, '-', e.message);
    return { ok: false, html: null };
  }
}

async function test4_regex_parse(html) {
  console.log('\n=== TEST 4: 正则匹配 tweet 内容 ===');
  if (!html) {
    console.log('  ⏭ 跳过（无 HTML 内容）');
    return;
  }

  // 检查关键 CSS class 是否存在
  const markers = ['.tweet-content', '.tweet-link', '.tweet-date', 'tweet-body', 'timeline-item'];
  for (const m of markers) {
    const found = html.includes(m);
    console.log(`  ${found ? '✅' : '❌'} 包含 "${m}": ${found}`);
  }

  // 用 Fetcher.js 里 parser.js 完全一样的正则试 match
  const re =
    /<a\s+class="tweet-link"[^>]*href="([^"]+\/status\/\d+[^"]*)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<span\s+class="tweet-date"[\s\S]*?<a[^>]*title="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/span>[\s\S]*?<div\s+class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  const matches = [];
  let m;
  while ((m = re.exec(html)) && matches.length < 5) {
    matches.push({
      href: m[1],
      time_title: m[2],
      text: m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 120),
    });
  }

  if (matches.length > 0) {
    console.log(`  ✅ 正则成功匹配到 ${matches.length} 条推文:`);
    matches.forEach((t, i) => console.log(`    [${i}] ${t.time_title} | ${t.text}`));
  } else {
    console.log('  ❌ 正则未匹配到任何推文');
    // 尝试更宽松的匹配来诊断
    const tweetContent = html.match(/class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
    if (tweetContent) {
      console.log(`  💡 但是宽松匹配到 ${tweetContent.length} 个 tweet-content div`);
      console.log('  💡 可能是正则对结构的假设与实际 HTML 不符');
      console.log('  第一个 tweet-content 区块:', tweetContent[0].substring(0, 300));
    } else {
      console.log('  💡 连 tweet-content 也没找到，页面结构完全不同于预期');
    }
  }
}

async function test5_alternative_instances() {
  console.log('\n=== TEST 5: 尝试替代 Nitter 实例 ===');
  const instances = [
    'https://nitter.poast.org',
    'https://nitter.privacydev.net',
    'https://nitter.woodland.cafe',
    'https://nitter.1d4.us',
  ];

  for (const base of instances) {
    const url = `${base}/${TEST_USER}`;
    try {
      const res = await fetchWithTimeout(url, 5000);
      const status = res.status;
      const body = await res.text();
      const hasTweets = body.includes('tweet-content');
      console.log(`  ${base}: status=${status}, body=${body.length}chars, hasTweets=${hasTweets}`);
      if (hasTweets) {
        console.log(`  ✅ ${base} 可用！建议替换 data_source.json 中的 url`);
      }
    } catch (e) {
      console.log(`  ${base}: ❌ ${e.code || e.name} - ${e.message}`);
    }
  }
}

// ========== 主流程 ==========

async function main() {
  console.log('====================================================');
  console.log(' x_bigshots_latest 数据源抓取诊断报告');
  console.log(' 目标: https://xcancel.com  |  测试账号:', TEST_USER);
  console.log('====================================================');

  const dnsOk = await test1_dns();
  if (!dnsOk) {
    console.log('\n⛔ DNS 都解析不了，可能是网络/防火墙/GFW 问题');
  }

  const connOk = await test2_connectivity();

  const { ok, html } = await test3_profile_page();

  if (html) {
    await test4_regex_parse(html);
  }

  await test5_alternative_instances();

  console.log('\n====================================================');
  console.log(' 诊断总结');
  console.log('====================================================');
  if (!dnsOk) {
    console.log('  → DNS 解析失败。xcancel.com 域名可能被墙或已下线。');
  } else if (!connOk) {
    console.log('  → DNS 正常但连接超时/被拒。可能需要代理或该站部署在被封锁的 IP 段上。');
  } else if (!ok) {
    console.log('  → 连接正常但页面内容异常（Rate Limit/Cloudflare 验证/空响应）。');
  } else {
    console.log('  → 网络层正常，请查看 TEST 4 的正则匹配结果定位解析问题。');
  }
}

main().catch(console.error);
