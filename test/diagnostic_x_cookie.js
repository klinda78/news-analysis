/**
 * 诊断测试：x_bigshots_latest (x.com Cookie 模式) 抓取链路全面排查
 * 仿照 test_x_fetch.js 风格编写
 * 逐层检查：DNS → 连通性 → Cookie 提取 → HTTP 响应 → 内容分析 (React Shell 识别)
 */

import dns from 'dns';
import { originOf } from '../src/Fetcher.js';

const TIMEOUT_MS = 15000;
const TEST_USER = 'RaoulGMI'; // 目标账号之一
const TARGET_URL = `https://x.com/${TEST_USER}`;

// ========== 工具函数 ==========
import { getCookies, toCookieHeader } from '@steipete/sweet-cookie';
async function getCookiesDirectly(targetUrl) {
  const origin = 'https://x.com';
  
  try {
    // 动态导入 sweet-cookie (Fetcher.js 里的同款写法)
    // Manually copy Chrome cookie DB to a temporary location to avoid file lock issues
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const sourceCookiePath = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Network', 'Cookies');
    const tempDir = path.join(os.tmpdir(), 'sweet-cookie-temp');
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      const tempCookiePath = path.join(tempDir, 'Cookies');
      fs.copyFileSync(sourceCookiePath, tempCookiePath);
      console.log('Copied Chrome cookie DB to temporary path:', tempCookiePath);
      const { cookies, warnings } = await getCookies({
        url: origin,
        browsers: ["chrome"],
        chromeProfile: tempCookiePath,
      });
      for (const w of warnings) console.warn('sweet-cookie warning:', w);
      console.log('Retrieved cookies count (custom profile):', cookies.length);
      cookies.slice(0, 5).forEach(c => console.log(`cookie: ${c.name}=${c.value}`));
      return toCookieHeader(cookies, { dedupeByName: true });
    } catch (copyErr) {
      console.error('Failed to copy Chrome cookie DB:', copyErr);
      // Fallback to original getCookies call without custom profile
      const { cookies, warnings } = await getCookies({
        url: origin,
        browsers: ["chrome", "edge", "firefox", "safari", "brave"]
      });
      for (const w of warnings) console.warn('sweet-cookie warning:', w);
      console.log('Retrieved cookies count (fallback):', cookies.length);
      return toCookieHeader(cookies, { dedupeByName: true });
    }
  } catch (err) {
    throw err;
  }
}

// ========== 测试用例 ==========

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

  // 1. 检查是否为 React 骨架屏
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

  // 尝试一下现有的 Nitter 正则看看能不能捡漏（虽然大概率不行）
  const nitterRe = /class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const matches = html.match(nitterRe);
  if (matches) {
    console.log(`  ✨ 意外惊喜！正则匹配到了 ${matches.length} 个疑似推文区块。`);
  } else {
    console.log('  ℹ️ 正则匹配不到任何内容（预期之中）。');
  }
}

// ========== 主流程 ==========

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
