// 重新生成 书房/藏书阁.html（把 书房/书架/*.md 原文注入阅读器模板）
// 用法：node 重印藏书阁.js   （在房子根目录跑；改完书或档案后重跑即可重印）
// 阅读器是「翻书式」的：全书排进 CSS 多列，一列一页，宽屏左右跨页，
// 点书页两侧 / 方向键 / 下方按钮都能翻，翻完为止；字号和夜灯随喜好调。
const fs = require('fs');
const BOOKS = [
  { id: 'git',   icon: 'git',   name: 'Git 家常菜',            file: '书房/书架/Git 家常菜.md' },
  { id: 'py',    icon: 'py',    name: 'Python 家常菜',         file: '书房/书架/Python 家常菜.md' },
  { id: 'bash',  icon: 'bash',  name: 'Bash 家常菜',           file: '书房/书架/Bash 家常菜.md' },
  { id: 'md',    icon: 'md',    name: 'Markdown 家常菜',       file: '书房/书架/Markdown 家常菜.md' },
  { id: 're',    icon: 're',    name: '正则表达式口袋书',       file: '书房/书架/正则表达式口袋书.md' },
  { id: 'eco',   icon: 'eco',   name: '住家 AI 的 2026 生态观察', file: '书房/书架/住家 AI 的 2026 生态观察.md' },
  { id: 'rea',   icon: 'rea',   name: 'REA 家常菜',            file: '书房/书架/REA 家常菜.md' },
];
// 防注入：md 里出现 </script> 会截断内联块
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let blocks = '', spines = '';
for (const b of BOOKS) {
  const txt = safe(fs.readFileSync(b.file, 'utf8')).trim();
  blocks += '<script type="text/plain" id="bk-' + b.id + '">' + txt + '</script>\n';
  spines += '<button class="spine s-' + b.icon + '" data-b="' + b.id + '"><i></i><span>' + b.name + '</span></button>';
}
// 阅读器里的书单也由 BOOKS 派生，加书不用再改第二处
const idsJs  = JSON.stringify(BOOKS.map(b => b.id));
const namesJs = JSON.stringify(Object.fromEntries(BOOKS.map(b => [b.id, b.name])));
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>书房 · 藏书阁</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--wood:#6b4f2e;--wood-2:#8a6a3e;--paper:#f7efdd;--paper-2:#efe4cc;--ink:#4a3a28;--ink-2:#7a6a50;--line:#e2d4b4;--gold:#b4831f;--code-bg:#f3ecd9}
body.night{--paper:#241d12;--paper-2:#2c2415;--ink:#e6dcc4;--ink-2:#a89878;--line:#43381f;--code-bg:#2f2717}
body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:linear-gradient(180deg,#efe2c4,#e6d5ae);min-height:100vh;color:var(--ink)}
body.night{background:linear-gradient(180deg,#171208,#221a0c)}
a{color:inherit}
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:10px 18px;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(8px);border-bottom:2px solid var(--line)}
.topbar .bk-name{font-weight:900;font-size:16px;letter-spacing:2px}
.topbar .ch-name{font-size:12.5px;color:var(--ink-2);letter-spacing:1px}
.topbar .sp{flex:1}
.tbtn{border:2px solid var(--line);background:var(--paper);color:var(--ink-2);border-radius:9px;padding:6px 13px;font-size:12.5px;cursor:pointer;font-family:inherit;letter-spacing:1px;transition:.15s}
button:active,.tbtn:active{transform:scale(.94)}
.tbtn:hover{border-color:var(--gold);color:var(--gold)}
.tbtn:disabled{opacity:.35;cursor:default}
.home-link{text-decoration:none}
.wrap{display:flex;max-width:1120px;margin:0 auto;gap:18px;padding:18px 14px 44px}
/* 书架侧栏 */
.shelf{width:210px;flex:none;position:sticky;top:64px;align-self:flex-start;display:flex;flex-direction:column;gap:8px}
.shelf-title{font-size:11px;letter-spacing:4px;color:var(--ink-2);margin:4px 2px 2px}
.spine{position:relative;display:flex;align-items:center;gap:10px;border:none;cursor:pointer;text-align:left;border-radius:6px 12px 12px 6px;padding:13px 12px;font-family:inherit;font-size:13px;letter-spacing:1px;color:#f4e8cd;background:linear-gradient(180deg,#8a5a2e,#5f3a1c);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 3px 8px rgba(60,32,8,.35);transition:transform .15s,box-shadow .15s}
.spine:hover{transform:translateX(4px)}
.spine.on{background:linear-gradient(180deg,var(--gold),#8f6512);box-shadow:0 0 0 2px var(--gold),0 4px 10px rgba(60,32,8,.4);transform:translateX(6px)}
.spine i{width:5px;align-self:stretch;border-radius:3px;background:rgba(255,255,255,.28);flex:none}
.spine span{writing-mode:horizontal-tb}
/* 章节目录 */
.toc{margin-top:10px;background:var(--paper);border:2px solid var(--line);border-radius:12px;padding:10px;max-height:40vh;overflow:auto}
.toc h4{font-size:11px;letter-spacing:3px;color:var(--ink-2);margin-bottom:6px}
.toc a{display:block;font-size:12px;color:var(--ink-2);text-decoration:none;padding:4px 8px;border-radius:6px;line-height:1.5;cursor:pointer}
.toc a:hover{background:var(--paper-2);color:var(--ink)}
.toc a.on{color:var(--gold);background:var(--paper-2)}
/* 翻书式阅读区 */
.read{flex:1;min-width:0;background:var(--paper);border:2px solid var(--line);border-radius:16px;padding:16px 14px 12px;box-shadow:0 16px 40px rgba(60,32,8,.18);display:flex;flex-direction:column}
.book{position:relative;height:min(74vh,700px);min-height:440px;overflow:hidden;border-radius:8px;background:linear-gradient(180deg,rgba(60,40,10,.045),rgba(60,40,10,0) 26px)}
.book-body{position:absolute;top:26px;bottom:26px;left:34px;width:400px;font-family:Georgia,"Times New Roman","Songti SC","SimSun",serif;font-size:16px;line-height:2.12;color:var(--ink);column-fill:auto;column-gap:68px;will-change:transform;transition:transform .55s cubic-bezier(.36,.04,.24,1)}
.book-body h1{font-family:"Microsoft YaHei",sans-serif;font-size:23px;letter-spacing:3px;margin:4px 0 6px;color:var(--wood)}
body.night .book-body h1{color:#e0b054}
.book-body h2{font-family:"Microsoft YaHei",sans-serif;font-size:17.5px;letter-spacing:2px;margin:26px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line);color:var(--wood)}
body.night .book-body h2{color:#e0b054}
.book-body h3{font-family:"Microsoft YaHei",sans-serif;font-size:15.5px;margin:20px 0 8px;color:var(--ink)}
.book-body p{margin:9px 0;text-align:justify}
.book-body blockquote{margin:13px 0;padding:9px 16px;border-left:4px solid var(--gold);background:var(--paper-2);border-radius:0 10px 10px 0;color:var(--ink-2);font-size:14px}
.book-body code{font-family:Consolas,"Courier New",monospace;font-size:.85em;background:var(--code-bg);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.book-body pre{margin:13px 0;background:var(--code-bg);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow-x:auto;line-height:1.72}
.book-body pre code{background:none;border:none;padding:0;font-size:12.5px}
.book-body table{border-collapse:collapse;margin:13px 0;width:100%;font-size:13px;font-family:"Microsoft YaHei",sans-serif}
.book-body th,.book-body td{border:1px solid var(--line);padding:6px 11px;text-align:left;line-height:1.68}
.book-body th{background:var(--paper-2);letter-spacing:1px}
.book-body ul,.book-body ol{margin:9px 0 9px 24px}
.book-body li{margin:5px 0}
.book-body hr{border:none;border-top:2px dashed var(--line);margin:24px 0}
.book-body strong{color:var(--gold)}
body.night .book-body strong{color:#e0b054}
/* 书脊折影 + 纸边 */
.fold{position:absolute;top:0;bottom:0;left:50%;width:76px;transform:translateX(-50%);pointer-events:none;display:none;background:linear-gradient(90deg,rgba(60,40,10,0),rgba(60,40,10,.09) 38%,rgba(60,40,10,.17) 50%,rgba(60,40,10,.09) 62%,rgba(60,40,10,0))}
.book.spread .fold{display:block}
.book::before,.book::after{content:'';position:absolute;top:0;bottom:0;width:14px;pointer-events:none;z-index:3}
.book::before{left:0;background:linear-gradient(90deg,rgba(60,40,10,.10),rgba(60,40,10,0))}
.book::after{right:0;background:linear-gradient(-90deg,rgba(60,40,10,.10),rgba(60,40,10,0))}
/* 点书页翻页：左右两片热区 */
.edge{position:absolute;top:0;bottom:0;width:27%;border:none;background:transparent;color:var(--ink-2);font-size:36px;cursor:pointer;opacity:0;transition:opacity .2s;font-family:Georgia,serif;z-index:4}
.edge:hover:not(:disabled){opacity:.55}
.eL{left:0}.eR{right:0}
.edge:disabled{opacity:0;cursor:default}
.pager{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:12px}
.pgnum{font-size:12px;color:var(--ink-2);letter-spacing:2px;min-width:92px;text-align:center}
@media(max-width:760px){.wrap{flex-direction:column}.shelf{width:100%;position:static;flex-direction:row;flex-wrap:wrap}.spine{flex:1 1 40%}.toc{display:none}.read{padding:12px 8px 10px}.book{min-height:400px;height:66vh}}

/* ---- 全屋统一滚动条 ---- */
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#a8895c;border-radius:6px;border:2px solid transparent;background-clip:padding-box}
::-webkit-scrollbar-thumb:hover{background:#8a6a3e}
*{scrollbar-width:thin;scrollbar-color:#a8895c transparent}
</style>
</head>
<body>
<div class="topbar">
<a class="tbtn home-link" href="../我的家.html" onclick="try{if(window.parent!==window){parent.postMessage('zhouse-back','*');return false;}}catch(e){}">← 小家</a>
<span class="bk-name" id="bkName"></span>
<span class="ch-name" id="chName"></span>
<span class="sp"></span>
<button class="tbtn" id="fontMinus">A-</button>
<button class="tbtn" id="fontPlus">A+</button>
<button class="tbtn" id="modeBtn">夜间</button>
</div>
<div class="wrap">
<aside class="shelf">
<div class="shelf-title">书 架</div>
${spines}
<div class="toc" id="toc"><h4>本 书 目 录</h4><div id="tocList"></div></div>
</aside>
<article class="read">
<div class="book" id="book">
<div class="book-body" id="body"></div>
<div class="fold"></div>
<button class="edge eL" id="edgeL" aria-label="上一页">&#8249;</button>
<button class="edge eR" id="edgeR" aria-label="下一页">&#8250;</button>
</div>
<div class="pager">
<button class="tbtn" id="prevBtn">上一页</button>
<span class="pgnum" id="pgNum"></span>
<button class="tbtn" id="nextBtn">下一页</button>
</div>
</article>
</div>
${blocks}
<script>
'use strict';
/* 藏书阁：翻书式阅读器。内容来自 书房/书架/*.md 原文，全书排进多列，一列一页。 */
var BOOK_IDS = ${idsJs};
var BOOK_NAMES = ${namesJs};
var K_LAST = 'library_last';
var cur = { b:'git', fs:16, pg:{} };
try { var s = JSON.parse(localStorage.getItem(K_LAST) || 'null'); if (s && BOOK_IDS.indexOf(s.b) >= 0) cur = s; } catch(e){}
cur.pg = cur.pg || {};
var qs = new URLSearchParams(location.search);
if (qs.get('b') && BOOK_IDS.indexOf(qs.get('b')) >= 0) cur.b = qs.get('b');

function esc(t){ return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(t){
  t = esc(t);
  t = t.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
  t = t.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  t = t.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t;
}
/* 极简 markdown → HTML（标题/代码块/表格/引用/列表/分隔线/段落） */
function md2html(src){
  var lines = src.split('\\n'), out = [], i = 0;
  while (i < lines.length){
    var L = lines[i];
    if (/^\\s*\\x60\\x60\\x60/.test(L)){           // 代码围栏
      var buf = []; i++;
      while (i < lines.length && !/^\\s*\\x60\\x60\\x60/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push('<pre><code>' + esc(buf.join('\\n')) + '</code></pre>'); continue;
    }
    if (/^\\s*\\|/.test(L)){                       // 表格
      var rows = [];
      while (i < lines.length && /^\\s*\\|/.test(lines[i])) rows.push(lines[i++]);
      var trs = rows.map(function(r){ return r.replace(/^\\s*\\|/,'').replace(/\\|\\s*$/,'').split('|').map(function(c){return c.trim();}); });
      var head = trs[0], body2 = trs.slice(2);
      var h = '<tr>' + head.map(function(c){ return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>';
      var bs = body2.map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('');
      out.push('<table>' + h + bs + '</table>'); continue;
    }
    var m;
    if ((m = L.match(/^(#{1,3})\\s+(.*)$/))){ out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); i++; continue; }
    if (/^\\s*---+\\s*$/.test(L)){ out.push('<hr>'); i++; continue; }
    if (/^\\s*&gt;/.test(L) || /^\\s*>/.test(L)){   // 引用块
      var q = [];
      while (i < lines.length && (/^\\s*>/.test(lines[i]))) q.push(lines[i++].replace(/^\\s*>\\s?/,''));
      out.push('<blockquote>' + q.map(inline).join('<br>') + '</blockquote>'); continue;
    }
    if (/^\\s*[-*]\\s+/.test(L)){                  // 无序列表
      var li = [];
      while (i < lines.length && /^\\s*[-*]\\s+/.test(lines[i])) li.push(lines[i++].replace(/^\\s*[-*]\\s+/,''));
      out.push('<ul>' + li.map(function(x){ return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>'); continue;
    }
    if (/^\\s*\\d+\\.\\s+/.test(L)){                // 有序列表
      var ol = [];
      while (i < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])) ol.push(lines[i++].replace(/^\\s*\\d+\\.\\s+/,''));
      out.push('<ol>' + ol.map(function(x){ return '<li>' + inline(x) + '</li>'; }).join('') + '</ol>'); continue;
    }
    if (!L.trim()){ i++; continue; }
    var para = [L]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\\s|\\s*[|>-]|\\s*\\x60\\x60\\x60|\\s*\\d+\\.\\s)/.test(lines[i])) para.push(lines[i++]);
    out.push('<p>' + para.map(inline).join('<br>') + '</p>');
  }
  return out.join('\\n');
}
function getBook(id){ return document.getElementById('bk-' + id).textContent.trim(); }
/* ---------- 分页：全书一列一页，宽屏左右跨页 ---------- */
var body = document.getElementById('body'), bookEl = document.getElementById('book');
var PAD = 34, GAP = 68, PAGE_W = 400, single = false, cols = 1, base = 0;
function per(){ return single ? 1 : 2; }
function layout(){
  single = window.innerWidth < 760;
  var avail = bookEl.clientWidth;
  PAGE_W = single ? Math.floor(avail - 2 * PAD) : Math.min(430, Math.floor((avail - 4 * PAD) / 2));
  if (PAGE_W < 210) { single = true; PAGE_W = Math.max(170, Math.floor(avail - 2 * PAD)); }
  GAP = single ? 48 : 2 * PAD;
  body.style.width = PAGE_W + 'px';
  body.style.columnWidth = PAGE_W + 'px';
  body.style.columnGap = GAP + 'px';
  cols = Math.max(1, Math.round(body.scrollWidth / (PAGE_W + GAP)));
  bookEl.classList.toggle('spread', !single);
  clampBase();
  paint(true);
}
function clampBase(){
  var maxB = cols - 1 - ((cols - 1) % per());
  base = Math.max(0, Math.min(maxB, base - (base % per())));
}
function paint(inst){
  if (inst) { body.style.transition = 'none'; }
  body.style.transform = 'translateX(' + (-base * (PAGE_W + GAP)) + 'px)';
  if (inst) { void body.offsetWidth; body.style.transition = ''; }
  var last = Math.min(cols - 1, base + per() - 1);
  document.getElementById('pgNum').textContent = (base + 1) + (single || last === base ? '' : '–' + (last + 1)) + ' / ' + cols;
  document.getElementById('prevBtn').disabled = base === 0;
  document.getElementById('edgeL').disabled = base === 0;
  document.getElementById('nextBtn').disabled = base + per() > cols - 1;
  document.getElementById('edgeR').disabled = base + per() > cols - 1;
  cur.pg[cur.b] = base;
  saveState();
}
function flip(d, silent){
  var nb = base + d * per();
  var maxB = cols - 1 - ((cols - 1) % per());
  if (nb < 0 || nb > maxB) return;
  base = nb;
  paint(false);
  if (!silent) paper();
}
/* 翻页的纸声：白噪蹭一下，轻得像翻一页纸 */
var AC = null;
function paper(){
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    var n = Math.floor(AC.sampleRate * 0.18), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var src = AC.createBufferSource(); src.buffer = b;
    var f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
    var g = AC.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(AC.destination); src.start();
  } catch (e) {}
}
function saveState(){ try { localStorage.setItem(K_LAST, JSON.stringify(cur)); } catch(e){} }
/* ---------- 换书 / 目录 ---------- */
var chapters = [];
function loadBook(id, keepPage){
  cur.b = id;
  document.getElementById('bkName').textContent = BOOK_NAMES[id];
  document.querySelectorAll('.spine').forEach(function(s){ s.classList.toggle('on', s.dataset.b === id); });
  var src = getBook(id);
  /* 按 ## 切章：首页(第一个##之前)也算一章 */
  var parts = [], re = /^##\\s+/m, idx = src.search(re);
  chapters = [];
  if (idx < 0) parts = [src];
  else {
    if (idx > 0) parts.push(src.slice(0, idx));
    var rest = src.slice(idx), m2;
    var reG = /^##\\s+(.+)$/gm, marks = [];
    while ((m2 = reG.exec(rest))) marks.push({ i: m2.index, t: m2[1].replace(/[#*]/g,'') });
    for (var k = 0; k < marks.length; k++) parts.push(rest.slice(marks[k].i, k + 1 < marks.length ? marks[k+1].i : undefined));
    chapters = marks.map(function(mk){ return mk.t; });
  }
  if (!chapters.length) chapters = ['全书'];
  var html = parts.map(function(p, n){
    return '<section class="chap" id="ch' + n + '" data-t="' + (chapters[n] || '卷首') + '">' + md2html(p) + '</section>';
  }).join('');
  body.innerHTML = html;
  var tl = '';
  chapters.forEach(function(c, n){ tl += '<a data-n="' + n + '">' + c + '</a>'; });
  document.getElementById('tocList').innerHTML = tl;
  document.querySelectorAll('#tocList a').forEach(function(a){
    a.addEventListener('click', function(){
      var sec = document.getElementById('ch' + a.dataset.n);
      if (!sec) return;
      var col = Math.max(0, Math.round((sec.offsetLeft) / (PAGE_W + GAP)));
      if (!single && col % 2) col--;
      base = col;
      clampBase();
      paint(false);
      paper();
      markChapter(a.dataset.n);
    });
  });
  base = (keepPage && cur.pg[id]) || 0;
  layout();
  markChapter();
  saveState();
}
/* 当前章高亮：翻到哪页，就看那页最上面的章 */
function markChapter(hit){
  var curN = -1;
  /* 用每章第一列位置和当前 base 比一比，省得逐字测量 */
  document.querySelectorAll('.chap').forEach(function(s, n){
    var col = Math.round(s.offsetLeft / (PAGE_W + GAP));
    if (col <= base + 1) curN = n;
  });
  if (hit !== undefined) curN = +hit;
  document.querySelectorAll('#tocList a').forEach(function(a){ a.classList.toggle('on', +a.dataset.n === curN); });
  document.getElementById('chName').textContent = curN >= 0 && chapters[curN] ? '· ' + chapters[curN] : '';
}
document.querySelectorAll('.spine').forEach(function(s){
  s.addEventListener('click', function(){ loadBook(s.dataset.b, false); });
});
/* 翻页入口：书页热区 / 按钮 / 方向键，怎么顺手怎么来 */
document.getElementById('edgeL').onclick = function(){ flip(-1); };
document.getElementById('edgeR').onclick = function(){ flip(1); };
document.getElementById('prevBtn').onclick = function(){ flip(-1); };
document.getElementById('nextBtn').onclick = function(){ flip(1); };
window.addEventListener('keydown', function(e){
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); flip(1); }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); flip(-1); }
  if (e.key === 'Home') { base = 0; paint(false); }
  if (e.key === 'End') { base = cols - 1 - ((cols - 1) % per()); paint(false); }
});
/* 字号 / 夜间：字号变了页数会变，重排再翻回原页附近 */
function refont(d){
  cur.fs = Math.max(13, Math.min(22, cur.fs + d));
  body.style.fontSize = cur.fs + 'px';
  setTimeout(function(){ layout(); paper(); }, 60);
}
document.getElementById('fontMinus').onclick = function(){ refont(-1); };
document.getElementById('fontPlus').onclick = function(){ refont(1); };
document.getElementById('modeBtn').onclick = function(){
  document.body.classList.toggle('night');
  this.textContent = document.body.classList.contains('night') ? '日间' : '夜间';
};
var rsT = null;
window.addEventListener('resize', function(){ clearTimeout(rsT); rsT = setTimeout(layout, 160); });
body.style.fontSize = cur.fs + 'px';
loadBook(cur.b, true);
</script>
</body>
</html>`;
fs.writeFileSync('书房/藏书阁.html', page);
console.log('藏书阁.html written:', fs.statSync('书房/藏书阁.html').size, 'bytes');
// 语法校验（书里可能出现 <script> 字样，取最后一个 <script> 块=阅读器本体）
const s0 = page.lastIndexOf('<script>');
const s1 = page.indexOf('</script>', s0);
const readerJs = page.slice(s0 + 8, s1);
try { new Function(readerJs); console.log('reader JS OK'); } catch (e) { console.log('reader JS BROKEN:', e.message); process.exit(1); }
