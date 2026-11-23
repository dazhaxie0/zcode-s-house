'use strict';

const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const HOST = '127.0.0.1';
const ENTRY = encodeURI('/我的家.html?trial=welcome');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// 只装入游戏会用到的页面、脚本和房间资料。
const ASSETS = {
  '': ['我的家.html', '图标库.svg'],
  客厅: ['电视游戏机.html', '留声机.html', '节奏地毯.html', '迎新餐桌.js'],
  卧室: ['小夜灯.html', '起床闹钟.html', '二手地铺床垫.md'],
  书房: ['藏书阁.html', '活字排版.html', '档案柜.html'],
  '书房/书架': [
    'Git 家常菜.md', 'Python 家常菜.md', 'Bash 家常菜.md', 'Markdown 家常菜.md',
    '正则表达式口袋书.md', '住家 AI 的 2026 生态观察.md', 'REA 家常菜.md',
  ],
  厨房: ['胡闹厨房.html'],
  '厨房/菜谱': [
    '番茄炒蛋.md', '蛋炒饭.md', '葱油拌面.md', '可乐鸡翅.md', '红烧肉.md',
    '酸辣土豆丝.md', '紫菜蛋花汤.md',
  ],
  阳台: ['温室.html', '捕萤.html', '星图.html'],
  '阳台/绿植档案': ['绿萝.md', '薄荷.md', '多肉.md'],
  '健身房/课表': ['肩腰日.md', '手腰日.md', '腿臀日.md', '胸上腹日.md', '背下腹日.md'],
  储藏室: ['翻箱倒柜.html', '存档格式.js', '存档事务.js', '结算队列.js', '迎新试玩记录.js'],
  钢琴房: ['琴键回响.html', '乐理课.html'],
  舞蹈房: ['追光舞步.html'],
  歌唱房: ['气泡和声.html'],
};

async function loadAssets() {
  const root = await fs.realpath(__dirname);
  const assets = new Map();
  // 启动时读取快照。试玩期间重新加载仍会得到同一组代码与资源。
  for (const [room, names] of Object.entries(ASSETS)) {
    for (const name of names) {
      const route = room ? room + '/' + name : name;
      const file = path.join(root, route);
      const resolved = await fs.realpath(file);
      if (path.relative(file, resolved) !== '' || !(await fs.stat(resolved)).isFile()) {
        throw new Error('试玩资源必须是项目内的原文件：' + route);
      }
      assets.set('/' + route, { content: await fs.readFile(resolved), mime: MIME[path.extname(name)] });
    }
  }
  return assets;
}

async function main() {
  const assets = await loadAssets();
  const server = http.createServer((req, res) => {
    const authority = HOST + ':' + server.address().port;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const origin = req.headers.origin;
    if (req.headers.host !== authority || (origin && origin !== 'http://' + authority)) {
      res.writeHead(403).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let route;
    try {
      // 保留路径原样匹配，查询参数用于游戏章节和道具页面。
      route = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (route === '/') {
      res.writeHead(302, { Location: ENTRY }).end();
      return;
    }
    if (route === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    const asset = assets.get(route);
    if (!asset) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': asset.mime, 'Content-Length': asset.content.length });
    res.end(req.method === 'HEAD' ? undefined : asset.content);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, resolve);
  });
  console.log('http://' + HOST + ':' + server.address().port + ENTRY);
  console.log('在本机浏览器打开上方地址开始试玩。复用同一地址可继续本次进度。按 Ctrl+C 结束。');
}

main().catch(error => {
  console.error('试玩启动失败。' + error.message);
  process.exitCode = 1;
});
