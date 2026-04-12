const { fetchDataFromWeb } = require('../src/Fetcher');


async function test_regex_parse(html) {
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

async function main() {
  console.log('Testing X platform fetch using cookies...');
  
  const source = {
    "targets": ["elonmusk"],
    "access": {
      "url": "https://x.com",
      "parse": {
        "type": "cookie_profile"
      }
    }
  };

  try {
    console.log(`Starting fetch for url: ${source.access.url} with targets: ${source.targets.join(', ')} ...`);
    const result = await fetchDataFromWeb(source);
    
    console.log('\n==== FETCH RESULT ====');
    if (result.error) {
      console.log('Error:', result.error);
    } else if (result.profiles) {
      console.log(`Fetched ${result.profiles.length} profiles.`);
      const profile = result.profiles[0];
      console.log(`\nUsername: ${profile.username}`);
      console.log(`URL: ${profile.url}`);
      console.log(`Mock/Failed: ${profile.mock}`);
      
      if (profile.error) {
         console.log(`Error Msg: ${profile.error}`);
      }
      
      if (profile.html) {
         console.log(`HTML Length: ${profile.html.length} chars`);
         console.log('--- HTML Preview ---');
         console.log(profile.html.substring(0, 1000));
         console.log('--------------------');
         
         const html = profile.html;
         const hasTweets = html.includes('tweetText') || html.includes('article');
         console.log(`Contains user defined markers (tweetText/article)? ${hasTweets ? 'Yes ✅' : 'No ❌'}`);
         
         const isReactSkeleton = !hasTweets && (html.includes('<div id="react-root">') || html.includes('window.__INITIAL_STATE__'));
         if (isReactSkeleton) {
            console.log('⚠️ WARNING: This appears to be an SPA React skeleton page. No tweet data is pre-rendered in the HTML.');
         }
      }
    } else {
      console.log('Raw Result:', result);
    }
  } catch (err) {
    console.error('Exception during fetch:', err);
  }
}

main();
