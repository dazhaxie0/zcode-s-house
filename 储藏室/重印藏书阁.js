// 重新生成 书房/藏书阁.html（把 书房/书架/*.md 原文注入阅读器模板）
// 用法：node 重印藏书阁.js   （在房子根目录跑；改完书或档案后重跑即可重印）
// 生成 书房/藏书阁.html —— 把书架全部书注入阅读器模板（书单只在 BOOKS 维护）
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
.tbtn:hover{border-color:var(--gold);color:var(--gold)}
.home-link{text-decoration:none}
.wrap{display:flex;max-width:1060px;margin:0 auto;gap:18px;padding:18px 14px 60px}
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
.toc a{display:block;font-size:12px;color:var(--ink-2);text-decoration:none;padding:4px 8px;border-radius:6px;line-height:1.5}
.toc a:hover{background:var(--paper-2);color:var(--ink)}
.toc a.on{color:var(--gold);background:var(--paper-2)}
/* 阅读区 */
.read{flex:1;min-width:0;background:var(--paper);border:2px solid var(--line);border-radius:16px;padding:34px 40px 46px;box-shadow:0 16px 40px rgba(60,32,8,.18);position:relative}
.progress{position:absolute;top:0;left:0;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--gold),#e0b054);width:0%;transition:width .1s}
.book-body{font-family:Georgia,"Times New Roman","Songti SC","SimSun",serif;font-size:15.5px;line-height:2.05;color:var(--ink)}
.book-body h1{font-family:"Microsoft YaHei",sans-serif;font-size:24px;letter-spacing:3px;margin:6px 0 4px;color:var(--wood)}
body.night .book-body h1{color:#e0b054}
.book-body h2{font-family:"Microsoft YaHei",sans-serif;font-size:18px;letter-spacing:2px;margin:30px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--line);color:var(--wood)}
body.night .book-body h2{color:#e0b054}
.book-body h3{font-family:"Microsoft YaHei",sans-serif;font-size:15.5px;margin:20px 0 8px;color:var(--ink)}
.book-body p{margin:10px 0}
.book-body blockquote{margin:14px 0;padding:10px 18px;border-left:4px solid var(--gold);background:var(--paper-2);border-radius:0 10px 10px 0;color:var(--ink-2);font-size:14px}
.book-body code{font-family:Consolas,"Courier New",monospace;font-size:.86em;background:var(--code-bg);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.book-body pre{margin:14px 0;background:var(--code-bg);border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow-x:auto;line-height:1.75}
.book-body pre code{background:none;border:none;padding:0;font-size:13px}
.book-body table{border-collapse:collapse;margin:14px 0;width:100%;font-size:13.5px;font-family:"Microsoft YaHei",sans-serif}
.book-body th,.book-body td{border:1px solid var(--line);padding:7px 12px;text-align:left;line-height:1.7}
.book-body th{background:var(--paper-2);letter-spacing:1px}
.book-body ul,.book-body ol{margin:10px 0 10px 26px}
.book-body li{margin:6px 0}
.book-body hr{border:none;border-top:2px dashed var(--line);margin:26px 0}
.book-body strong{color:var(--gold)}
body.night .book-body strong{color:#e0b054}
.foot-nav{display:flex;justify-content:space-between;gap:10px;margin-top:34px;padding-top:16px;border-top:2px solid var(--line)}
.foot-nav button{flex:1;border:2px solid var(--line);background:var(--paper);color:var(--ink-2);border-radius:10px;padding:10px;font-family:inherit;font-size:13px;cursor:pointer;letter-spacing:1px}
.foot-nav button:hover{border-color:var(--gold);color:var(--gold)}
@media(max-width:760px){.wrap{flex-direction:column}.shelf{width:100%;position:static;flex-direction:row;flex-wrap:wrap}.spine{flex:1 1 40%}.toc{display:none}.read{padding:22px 18px 34px}}

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
<a class="tbtn home-link" href="../我的家.html">← 小家</a>
<span class="bk-name" id="bkName"></span>
<span class="ch-name" id="chName"></span>
<span class="sp"></span>
<button class="tbtn" id="fontMinus">A-</button>
<button class="tbtn" id="fontPlus">A+</button>
<button class="tbtn" id="modeBtn">夜间</button>
</div>
<div class="wrap">
<aside class="shelf">
<div class="shelf-title">书 架 · ${BOOKS.length} 本</div>
${spines}
<div class="toc" id="toc"><h4>本 书 目 录</h4><div id="tocList"></div></div>
</aside>
<article class="read">
<div class="progress" id="prog"></div>
<div class="book-body" id="body"></div>
<div class="foot-nav">
<button id="prevBtn">← 上一章</button>
<button id="nextBtn">下一章 →</button>
</div>
</article>
</div>
${blocks}
<script>
'use strict';
/* 藏书阁：家常菜书的内嵌阅读器。内容来自 书房/书架/*.md 原文。 */
var BOOK_IDS = ${idsJs};
var BOOK_NAMES = ${namesJs};
var K_LAST = 'library_last';
var cur = { b:'git', fs:15.5 };
try { var s = JSON.parse(localStorage.getItem(K_LAST) || 'null'); if (s && BOOK_IDS.indexOf(s.b) >= 0) cur = s; } catch(e){}
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
      var head = trs[0], body = trs.slice(2);
      var h = '<tr>' + head.map(function(c){ return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>';
      var bs = body.map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('');
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
/* 全书渲染 + 按章（## 切片）导航 */
var chapters = [];
function loadBook(id){
  cur.b = id;
  document.getElementById('bkName').textContent = BOOK_NAMES[id];
  document.querySelectorAll('.spine').forEach(function(s){ s.classList.toggle('on', s.dataset.b === id); });
  var src = getBook(id);
  /* 按 ## 切章：首页(第一个##之前)也算一章 */
  var parts = [], re = /^##\\s+/m, idx = src.search(re);
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
  document.getElementById('body').innerHTML = html;
  var tl = '';
  chapters.forEach(function(c, n){ tl += '<a href="#ch' + n + '" data-n="' + n + '">' + c + '</a>'; });
  document.getElementById('tocList').innerHTML = tl;
  saveState();
}
function saveState(){ try { localStorage.setItem(K_LAST, JSON.stringify(cur)); } catch(e){} }
document.querySelectorAll('.spine').forEach(function(s){
  s.addEventListener('click', function(){ loadBook(s.dataset.b); window.scrollTo(0, 0); markChapter(); });
});
/* 滚动进度 + 当前章高亮 */
var body = document.getElementById('body');
function markChapter(){
  var cur5 = 0, secs = document.querySelectorAll('.chap');
  secs.forEach(function(s, n){ if (s.getBoundingClientRect().top < 160) cur5 = n; });
  document.querySelectorAll('#tocList a').forEach(function(a){ a.classList.toggle('on', +a.dataset.n === cur5); });
  var t = secs[cur5] ? secs[cur5].dataset.t : '';
  document.getElementById('chName').textContent = t ? '· ' + t : '';
}
window.addEventListener('scroll', function(){
  var h = document.documentElement;
  var p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
  document.getElementById('prog').style.width = (p * 100) + '%';
  markChapter();
});
/* 章节跳转 */
function jump(d){
  var secs = document.querySelectorAll('.chap'), cur6 = 0;
  secs.forEach(function(s, n){ if (s.getBoundingClientRect().top < 160) cur6 = n; });
  var to = secs[Math.max(0, Math.min(secs.length - 1, cur6 + d))];
  if (to) to.scrollIntoView({ behavior: 'smooth' });
}
document.getElementById('prevBtn').onclick = function(){ jump(-1); };
document.getElementById('nextBtn').onclick = function(){ jump(1); };
window.addEventListener('keydown', function(e){
  if (e.key === 'ArrowLeft') jump(-1);
  if (e.key === 'ArrowRight') jump(1);
});
/* 字号 / 夜间 */
document.getElementById('fontMinus').onclick = function(){ cur.fs = Math.max(13, cur.fs - 1); body.style.fontSize = cur.fs + 'px'; saveState(); };
document.getElementById('fontPlus').onclick = function(){ cur.fs = Math.min(21, cur.fs + 1); body.style.fontSize = cur.fs + 'px'; saveState(); };
document.getElementById('modeBtn').onclick = function(){
  document.body.classList.toggle('night');
  this.textContent = document.body.classList.contains('night') ? '日间' : '夜间';
};
body.style.fontSize = cur.fs + 'px';
loadBook(cur.b);
</script>
</body>
</html>`;
fs.writeFileSync('书房/藏书阁.html', page);
console.log('藏书阁.html written:', fs.statSync('书房/藏书阁.html').size, 'bytes');
// 语法校验（书里可能出现 <script> 字样，须锚定 </body> 前的阅读器脚本块）
const m = page.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
try { new Function(m[1]); console.log('reader JS OK'); } catch (e) { console.log('reader JS BROKEN:', e.message); process.exit(1); }
