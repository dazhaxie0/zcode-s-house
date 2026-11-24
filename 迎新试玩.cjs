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

// 只装入游戏会用到的页面、脚本和房间资料；清单与自动部署共用。
const ASSETS = require('./储藏室/站点清单.cjs');

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
