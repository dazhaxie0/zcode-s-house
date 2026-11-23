// 改完原文后在根目录运行 node 储藏室/装订档案.js，重印离线阅读页。
const fs = require('fs');
const DRAWERS = [
  { name: '厨房 · 菜谱', dir: '厨房/菜谱', order: ['番茄炒蛋', '蛋炒饭', '葱油拌面', '可乐鸡翅', '红烧肉', '酸辣土豆丝', '紫菜蛋花汤'] },
  { name: '健身房 · 课表', dir: '健身房/课表', order: ['肩腰日', '手腰日', '腿臀日', '胸上腹日', '背下腹日'] },
  { name: '卧室 · 纸条', dir: '卧室', order: ['二手地铺床垫'] },
];
// 防注入：md 里出现 </script> 会截断内联块
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const docs = [];
let blocks = '', drawers = '';
DRAWERS.forEach((dw, k) => {
  const have = fs.readdirSync(dw.dir).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3));
  const names = dw.order.filter(n => have.includes(n)).concat(have.filter(n => !dw.order.includes(n)).sort());
  drawers += '<div class="dw"><h4>' + dw.name + '</h4>';
  for (const n of names) {
    const i = docs.length, path = dw.dir + '/' + n + '.md';
    docs.push({ id: n, path, dw: k });
    blocks += '<script type="text/plain" id="doc-' + i + '">' + safe(fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).trim() + '</script>\n';
    drawers += '<button class="doc" data-i="' + i + '">' + n + '</button>';
  }
  drawers += '</div>';
});
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>书房 · 档案柜</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--wood:#6b4f2e;--paper:#f7efdd;--paper-2:#efe4cc;--ink:#4a3a28;--ink-2:#6f5f46;--line:#e2d4b4;--gold:#9a6a12;--code-bg:#f3ecd9}
body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:linear-gradient(180deg,#efe2c4,#e6d5ae);min-height:100vh;color:var(--ink)}
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:12px;padding:10px 18px;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(8px);border-bottom:2px solid var(--line)}
.inframe .topbar{padding-left:76px}
.tt{font-weight:900;font-size:16px;letter-spacing:3px;color:var(--wood)}
.ts{font-size:12px;color:var(--ink-2);letter-spacing:1px}
.sp{flex:1}
.tbtn{border:2px solid var(--line);background:var(--paper);color:var(--ink-2);border-radius:9px;padding:6px 13px;font-size:12.5px;cursor:pointer;font-family:inherit;letter-spacing:1px;text-decoration:none;transition:.15s;white-space:nowrap}
.tbtn:hover,.tbtn:focus-visible{border-color:var(--gold);color:var(--gold);outline:none}
.tbtn:active{transform:scale(.94)}
.wrap{display:flex;gap:18px;max-width:1040px;margin:0 auto;padding:18px 14px 44px;align-items:flex-start}
.drawers{width:200px;flex:none;position:sticky;top:66px;display:flex;flex-direction:column;gap:12px}
.dw{background:var(--paper);border:2px solid var(--line);border-radius:12px;padding:10px 8px 8px;box-shadow:0 6px 16px rgba(60,32,8,.08)}
.dw h4{font-size:11px;letter-spacing:3px;color:var(--ink-2);margin:0 4px 6px;font-weight:700}
.doc{display:block;width:100%;text-align:left;border:none;background:none;font-family:inherit;font-size:13px;color:var(--ink);padding:6px 10px;border-radius:7px;cursor:pointer;letter-spacing:1px}
.doc:hover,.doc:focus-visible{background:var(--paper-2);outline:none}
.doc.on{background:var(--gold);color:#fff8e6;font-weight:700}
.sheet{flex:1;min-width:0;background:var(--paper);border:2px solid var(--line);border-radius:16px;padding:28px 36px 20px;box-shadow:0 16px 40px rgba(60,32,8,.16);font-family:Georgia,"Songti SC","SimSun",serif;font-size:15.5px;line-height:2}
.sheet h1{font-family:"Microsoft YaHei",sans-serif;font-size:24px;letter-spacing:3px;color:var(--wood);margin-bottom:8px}
.sheet h2{font-family:"Microsoft YaHei",sans-serif;font-size:17px;letter-spacing:2px;color:var(--wood);margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--line)}
.sheet h3{font-family:"Microsoft YaHei",sans-serif;font-size:15px;margin:18px 0 8px}
.sheet p{margin:8px 0;text-align:justify}
.sheet blockquote{margin:12px 0;padding:9px 16px;border-left:4px solid var(--gold);background:var(--paper-2);border-radius:0 10px 10px 0;color:var(--ink-2);font-size:14px}
.sheet table{border-collapse:collapse;margin:12px 0;width:100%;font-size:13.5px;font-family:"Microsoft YaHei",sans-serif}
.sheet th,.sheet td{border:1px solid var(--line);padding:6px 11px;text-align:left;line-height:1.7;vertical-align:top}
.sheet th{background:var(--paper-2);letter-spacing:1px}
.sheet ul,.sheet ol{margin:8px 0 8px 24px}
.sheet li{margin:4px 0}
.sheet code{font-family:Consolas,"Courier New",monospace;font-size:.86em;background:var(--code-bg);border:1px solid var(--line);border-radius:5px;padding:1px 6px}
.sheet pre{margin:12px 0;background:var(--code-bg);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow-x:auto;line-height:1.7}
.sheet pre code{background:none;border:none;padding:0}
.sheet hr{border:none;border-top:2px dashed var(--line);margin:18px 0}
.sheet strong{color:var(--wood)}
.src{margin-top:22px;padding-top:10px;border-top:1px dashed var(--line);font-family:"Microsoft YaHei",sans-serif;font-size:12px;color:var(--ink-2);display:flex;gap:10px;align-items:center;flex-wrap:wrap;letter-spacing:1px}
@media (max-width:760px){
.topbar{padding:8px 12px;gap:8px}
.inframe .topbar{padding-left:68px;flex-wrap:wrap}
.inframe .tt{flex-basis:100%;font-size:14px}
.inframe .sp{display:none}
.inframe .tbtn{padding:6px 8px}
.ts{display:none}
.wrap{flex-direction:column;padding:12px 10px 32px;gap:12px}
.drawers{position:static;width:100%;flex-direction:row;overflow-x:auto;gap:8px;padding-bottom:4px}
.dw{flex:none;display:flex;align-items:center;gap:2px;padding:5px 6px}
.dw h4{margin:0 6px 0 4px;white-space:nowrap}
.doc{width:auto;white-space:nowrap;padding:5px 9px}
.sheet{width:100%;padding:20px 18px 14px;font-size:15px}
}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#a8895c;border-radius:6px;border:2px solid transparent;background-clip:padding-box}
*{scrollbar-width:thin;scrollbar-color:#a8895c transparent}
</style>
</head>
<body>
<div class="topbar">
<span class="tt">档案柜</span><span class="ts">菜谱 · 课表 · 纸条，原文照录</span>
<span class="sp"></span>
<button class="tbtn" id="prev">‹ 上一份</button><button class="tbtn" id="next">下一份 ›</button>
<a class="tbtn" href="../我的家.html" id="home">← 小家</a>
</div>
<div class="wrap">
<nav class="drawers" aria-label="抽屉">${drawers}</nav>
<article class="sheet" id="sheet"></article>
</div>
${blocks}<script>
'use strict';
var DOCS = ${JSON.stringify(docs)};
var cur = 0, sheet = document.getElementById('sheet');
var want = new URLSearchParams(location.search).get('f');
try { want = want || localStorage.getItem('archive_last'); } catch (e) {}
DOCS.forEach(function (d, i) { if (d.id === want) cur = i; });
var inFrame = false;
try { inFrame = window.parent !== window; } catch (e) {}
if (inFrame) document.body.classList.add('inframe');
function goHome(e) {
  if (!inFrame) return;
  if (e) e.preventDefault();
  try { parent.postMessage('zhouse-back', '*'); } catch (er) {}
}
function esc(t){ return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(t){
  t = esc(t);
  t = t.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');
  t = t.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  t = t.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function(_, label, href){
    return /^https?:\\/\\//i.test(href) ? '<a href="' + href.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + label + '</a>' : label;
  });
  return t;
}
/* 极简 markdown → HTML（标题/代码块/表格/引用/列表/分隔线/段落），与藏书阁同一套手艺 */
function md2html(src){
  var lines = src.split('\\n'), out = [], i = 0, m;
  while (i < lines.length){
    var L = lines[i];
    if (/^\\s*\x60\x60\x60/.test(L)){
      var buf = []; i++;
      while (i < lines.length && !/^\\s*\x60\x60\x60/.test(lines[i])) buf.push(lines[i++]);
      i++; out.push('<pre><code>' + esc(buf.join('\\n')) + '</code></pre>'); continue;
    }
    if (/^\\s*\\|/.test(L)){
      var rows = [];
      while (i < lines.length && /^\\s*\\|/.test(lines[i])) rows.push(lines[i++]);
      var trs = rows.map(function(r){ return r.replace(/^\\s*\\|/,'').replace(/\\|\\s*$/,'').split('|').map(function(c){ return c.trim(); }); });
      out.push('<table><tr>' + trs[0].map(function(c){ return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>' +
        trs.slice(2).map(function(r){ return '<tr>' + r.map(function(c){ return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>');
      continue;
    }
    if ((m = L.match(/^(#{1,3})\\s+(.*)$/))){ out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); i++; continue; }
    if (/^\\s*---+\\s*$/.test(L)){ out.push('<hr>'); i++; continue; }
    if (/^\\s*>/.test(L)){
      var q = [];
      while (i < lines.length && /^\\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\\s*>\\s?/,''));
      out.push('<blockquote>' + q.map(function(x){ return /^#{1,3}\\s/.test(x) ? '<strong>' + inline(x.replace(/^#+\\s+/,'')) + '</strong>' : inline(x); }).join('<br>') + '</blockquote>');
      continue;
    }
    if (/^\\s*[-*]\\s+/.test(L)){
      var li = [];
      while (i < lines.length && /^\\s*[-*]\\s+/.test(lines[i])) li.push(lines[i++].replace(/^\\s*[-*]\\s+/,''));
      out.push('<ul>' + li.map(function(x){ return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>'); continue;
    }
    if (/^\\s*\\d+\\.\\s+/.test(L)){
      var ol = [];
      while (i < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])) ol.push(lines[i++].replace(/^\\s*\\d+\\.\\s+/,''));
      out.push('<ol>' + ol.map(function(x){ return '<li>' + inline(x) + '</li>'; }).join('') + '</ol>'); continue;
    }
    if (!L.trim()){ i++; continue; }
    var para = [L]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\\s|\\s*[|>-]|\\s*\x60\x60\x60|\\s*\\d+\\.\\s)/.test(lines[i])) para.push(lines[i++]);
    out.push('<p>' + para.map(inline).join('<br>') + '</p>');
  }
  return out.join('\\n');
}
function show(i, scroll){
  cur = (i + DOCS.length) % DOCS.length;
  var d = DOCS[cur];
  sheet.innerHTML = md2html(document.getElementById('doc-' + cur).textContent.trim()) +
    '<div class="src"><span>原件 · ' + esc(d.path) + '</span><span class="sp"></span><span>' + (cur + 1) + ' / ' + DOCS.length + '</span></div>';
  document.querySelectorAll('.doc').forEach(function (b) {
    var on = +b.dataset.i === cur;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    if (on && b.scrollIntoView && window.innerWidth <= 760) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  document.title = d.id + ' · 档案柜';
  try { localStorage.setItem('archive_last', d.id); } catch (e) {}
  if (scroll) window.scrollTo(0, 0);
}
document.querySelector('.drawers').addEventListener('click', function (e) {
  var b = e.target.closest('.doc');
  if (b) show(+b.dataset.i, true);
});
document.getElementById('prev').onclick = function () { show(cur - 1, true); };
document.getElementById('next').onclick = function () { show(cur + 1, true); };
document.getElementById('home').addEventListener('click', goHome);
document.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowLeft') show(cur - 1, true);
  else if (e.key === 'ArrowRight') show(cur + 1, true);
  else if (e.key === 'Escape') goHome();
});
show(cur);
</script>
</body>
</html>
`;
fs.writeFileSync('书房/档案柜.html', page);
console.log('档案柜装订完毕：' + docs.length + ' 份 · ' + DRAWERS.map(d => d.name).join(' / '));
