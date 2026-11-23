'use strict';

// 乐理课（钢琴房）回归：四课目真实输入、暂停契约、本地进度、手机布局。
// 与 music-session.test.cjs 同一套跑法：PLAYWRIGHT_MODULE / CHROME_PATH / QA_OUTPUT。
// 不鉴定音频听感与真人模唱音准；模唱一项只验自评记录链路。
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = __dirname;
const output = process.env.QA_OUTPUT || path.join(os.tmpdir(), 'zhouse-music-theory.json');
const FILE = '钢琴房/乐理课.html';
const report = {
  startedAt: new Date().toISOString(), browser: '', assertions: 0, tests: [],
  fixtures: ['节奏跟打用页面内定时器按谱面拍点调用 beatTap()，走真实判定链路。', '暂停以 cond.t0 / cond.ei / 已记拍点是否位移为断言。'],
  limits: ['不鉴定扬声器音质、不采集人声模唱音准。', '精度断言只验判定数学，不代表真人手感。']
};
function check(value, message) { assert.ok(value, message); report.assertions++; }
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
  let file;
  try {
    file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) throw Error('Path outside root');
  } catch { res.writeHead(400).end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(error ? 'not found' : data);
  });
});
let browser, base;
async function test(name, run, mobile = false) {
  if (process.env.QA_TEST_FILTER && !new RegExp(process.env.QA_TEST_FILTER, 'i').test(name)) return;
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce'
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  const result = { name, file: FILE, viewport: mobile ? '390x844 touch' : '1366x900', status: 'passed', errors: [], evidence: {} };
  report.tests.push(result);
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
  const start = report.assertions;
  try {
    const response = await page.goto(base + '/' + encodeURI(FILE));
    check(response.ok(), 'Page responds successfully');
    await run(page, result.evidence);
    check(result.errors.length === 0, 'No browser errors: ' + JSON.stringify(result.errors));
  } catch (e) { result.status = 'failed'; result.error = e.stack || String(e); }
  finally { result.assertions = report.assertions - start; await context.close(); }
  console.log(result.status.toUpperCase(), name, result.error ? result.error.split('\n')[0] : '');
}
const pane = '.pane.on';
async function openDrill(page, label) {
  await page.locator(pane + ' .chips button', { hasText: label }).first().click();
}
// 通用选择题：按题库找出正确项并点它，答完一轮
async function runQuiz(page, bankVar, rounds) {
  for (let i = 0; i < rounds; i++) {
    const info = await page.evaluate(bv => {
      const q = document.querySelector('.pane.on .q');
      const txt = (q ? q.textContent : '').replace(/^第 \d+\/\d+ 题 · /, '');
      const item = window[bv].find(b => txt === b.q.replace(/<[^>]+>/g, ''));
      return { answer: item ? item.o[item.a] : null, found: !!item };
    }, bankVar);
    check(info.found, 'Question comes from the declared bank');
    const idx = await page.evaluate(a => [...document.querySelectorAll('.pane.on .opts button')].findIndex(b => b.textContent === a), info.answer);
    check(idx >= 0, '正确项确实在选项里');
    await page.locator(pane + ' .opts button').nth(idx).click();
    const why = await page.locator(pane + ' .why').first().innerText();
    check(why.length > 4, 'Answer always explains itself');
    await page.locator(pane + ' .row button.act').first().click();
  }
  return page.evaluate(() => document.querySelector('.pane.on .q').textContent);
}
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  report.browser = browser.version();

  await test('四课目开合无错，课目与题库规模符合笔记章节', async (page, evidence) => {
    const counts = await page.evaluate(() => ({
      patterns: PATTERNS.length, fingers: FINGERS.length,
      lessons: Object.keys(LESSON).map(k => LESSON[k].length),
      banks: [BANK_SIGN.length, BANK_SOLF.length, BANK_CONCEPT.length, BANK_METER.length, BANK_DOT.length, BANK_TIE.length, BANK_ANA.length, BANK_TEMPO.length]
    }));
    check(counts.patterns >= 20, '打拍子节奏型覆盖笔记八种基本型＋休止＋大附点大切分及变体＋两条练习条');
    check(counts.fingers === 5, '指法五条：左右手五指原位、七音上下行、和声级数');
    check(counts.lessons.every(n => n >= 5), '每门课目至少五个可练项');
    check(counts.banks.every(n => n >= 5), '每个题库至少五题');
    const tables = await page.evaluate(() => ({
      sharpC: scaleNames(0, 1), flatC: scaleNames(0, -1), sharpF: scaleNames(3, 1), flatG: scaleNames(4, -1),
      chrom: [...document.querySelectorAll('details.ref table')][0].rows[1].cells.length
    }));
    check(JSON.stringify(tables.sharpC) === JSON.stringify(['C♯', 'D♯', 'E♯', 'F♯', 'G♯', 'A♯', 'B♯', 'C♯']), '1=♯C 行含 E♯/B♯，不出现重降堆叠');
    check(JSON.stringify(tables.flatC) === JSON.stringify(['C♭', 'D♭', 'E♭', 'F♭', 'G♭', 'A♭', 'B♭', 'C♭']), '1=♭C 行全降');
    check(JSON.stringify(tables.sharpF) === JSON.stringify(['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯', 'F♯']), '1=♯F 行与截图一致');
    check(JSON.stringify(tables.flatG) === JSON.stringify(['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F', 'G♭']), '1=♭G 行含 C♭');
    check(tables.chrom === 8, '变化唱名表按音级列 b/本位/♯ 三行');
    for (const k of ['key', 'meter', 'beat', 'finger']) {
      await page.locator('#tabs button[data-k="' + k + '"]').click();
      check(await page.evaluate(kk => document.getElementById('p-' + kk).classList.contains('on'), k), 'Tab ' + k + ' shows its pane');
      check(await page.evaluate(() => document.querySelectorAll('.pane.on .note').length === 1), '每个课目都带讲义');
    }
    evidence.counts = counts;
  });

  await test('调号：选择题答对记进度，答错也讲缘由', async (page, evidence) => {
    await openDrill(page, '调号问答');
    const summary = await runQuiz(page, 'BANK_SIGN', 7);
    check(/7\/7/.test(summary) && /100%/.test(summary), '全对一轮记 100%');
    const rec = await page.evaluate(() => prog['key-sign']);
    check(rec.n === 1 && rec.best === 100, '进度写入本地');
    check(await page.evaluate(() => localStorage.getItem('ml_prog') !== null), '进度落在 ml_prog 键');
    check(await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('zh_play_v2:') === 0).length === 0), '日课不写结算队列');
    evidence.summary = summary; evidence.rec = rec;
  });

  await test('调号：大调构音阶按全全半全全全半校验，错音给指路', async (page, evidence) => {
    await openDrill(page, '大调构音阶');
    const want = await page.evaluate(() => MAJOR.map(d => curTonic + d));
    check(want[0] === 60, '起手 C 大调');
    await page.locator(pane + ' .kb [data-m="61"]').click();
    check(/半音|全音/.test(await page.locator(pane + ' .say').innerText()), '错音立刻报出该走全音还是半音');
    for (const m of want) await page.locator(pane + ' .kb [data-m="' + m + '"]').click();
    check(/成调/.test(await page.locator(pane + ' .say').innerText()), '七个音点对算成调');
    check(await page.evaluate(() => prog['key-scale'].best === 100 - 0 || prog['key-scale'].best > 0), '构音阶记精度');
    // 换 G 大调：必须点到黑键 F#
    await page.locator(pane + ' .chips button', { hasText: 'G 大调' }).first().click();
    const gw = await page.evaluate(() => MAJOR.map(d => curTonic + d));
    check(gw.includes(78) && await page.evaluate(() => isBlack(78)), 'G 大调音阶含 F#5（黑键）');
    for (const m of gw) await page.locator(pane + ' .kb [data-m="' + m + '"]').click();
    check(/成调/.test(await page.locator(pane + ' .say').innerText()), 'G 大调也成调');
    check(await page.locator(pane + ' .row button.act').count() === 2, '成调后只留一组按钮，不重复堆叠');
    evidence.cMajor = want; evidence.gMajor = gw;
  });

  await test('调号：音名认键两套记法（A2～c1～c5 ↔ A0～C4～C8）', async (page, evidence) => {
    await openDrill(page, '音名认键');
    const range = await page.evaluate(() => {
      const ks = Object.keys(KBS[KBS.length - 1].nodes).map(Number);
      return { lo: Math.min(...ks), hi: Math.max(...ks), n: ks.length,
        a0: helmPlain(21), c4: helmPlain(60), c8: helmPlain(108), sci60: sci(60) };
    });
    check(range.n === 88 && range.lo === 21 && range.hi === 108, '88 键全在：A0～C8');
    check(range.a0 === 'A2' && range.c4 === 'c1' && range.c8 === 'c5', '亥姆霍兹记法与笔记两行文字一致');
    check(range.sci60 === 'C4', '中央 C 科学音名 C4');
    for (let i = 0; i < 6; i++) {
      const mode = await page.evaluate(() => document.querySelector('.pane.on .q').textContent);
      if (/点出/.test(mode)) {
        const m = await page.evaluate(() => {
          const t = document.querySelector('.pane.on .q').textContent.match(/科学音名 ([A-G]#?-?\d)/);
          const name = t[1];
          for (const k in KBS[KBS.length - 1].nodes) if (sci(+k) === name) return +k;
          return null;
        });
        check(m != null, '认键题面给出可解析的目标音名');
        await page.locator(pane + ' .kb [data-m="' + m + '"]').click();
      } else {
        const ans = await page.evaluate(() => {
          const lit = document.querySelector('.pane.on .kb .lit');
          const m = +lit.dataset.m;
          return /哪一组/.test(document.querySelector('.pane.on .q').textContent) ? groupOf(m) : sci(m);
        });
        await page.locator(pane + ' .opts button', { hasText: ans }).first().click();
      }
      await page.waitForTimeout(1250);
    }
    check(await page.evaluate(() => prog['key-name'] && prog['key-name'].n === 1), '认键一轮记一次进度');
    evidence.range = range;
  });

  await test('调号：听音级与模唱往返（课程第三步四规则）', async (page, evidence) => {
    await openDrill(page, '听音级');
    for (let i = 0; i < 8; i++) {
      await page.locator(pane + ' .opts button').first().click();
      await page.waitForTimeout(1300);
    }
    check(await page.evaluate(() => prog['key-ear'].n === 1), '听音级记进度');
    await openDrill(page, '模唱往返');
    const seq = await page.evaluate(() => document.querySelector('.pane.on .q + .q').textContent);
    await page.locator(pane + ' button', { hasText: '弹 一 遍' }).click();
    await page.waitForTimeout(400);
    check(await page.evaluate(() => cond.on), '模唱示范真的在响');
    await page.locator(pane + ' button', { hasText: '只 弹 do' }).click();
    await page.locator(pane + ' button', { hasText: '检 验' }).click();
    await page.locator(pane + ' button', { hasText: '唱准了' }).click();
    const sing = await page.evaluate(() => prog['key-sing']);
    check(sing.n === 1 && sing.best === 100, '模唱自评入本地进度');
    check(await page.evaluate(() => LESSON.key.indexOf('key-sing') < 0), '自评项不参与掌握度判定');
    evidence.seq = seq; evidence.sing = sing;
  });

  await test('拍号：听辨拍号走真实音频，暂停冻结拍点', async (page, evidence) => {
    await page.locator('#tabs button[data-k="meter"]').click();
    await openDrill(page, '听辨拍号');
    await page.locator(pane + ' button', { hasText: '听 一 遍' }).click();
    await page.waitForTimeout(300);
    check(await page.evaluate(() => cond.on && running), '节拍器在跑且暂停钮可用');
    const before = await page.evaluate(() => ({ t0: cond.t0, ei: cond.ei }));
    await page.keyboard.press('p');
    check(await page.evaluate(() => paused && document.getElementById('pause-dialog').open), 'P 键开暂停框');
    await page.waitForTimeout(1200);
    const during = await page.evaluate(() => ({ t0: cond.t0, ei: cond.ei }));
    check(during.t0 === before.t0 && during.ei === before.ei, '暂停期间拍点与已排音频都不前进');
    await page.locator('#resume-game').click();
    const after = await page.evaluate(() => cond.t0);
    check(after > before.t0, '恢复后时间线整体平移，歇多久补多久');
    await page.waitForFunction(() => !cond.on, null, { timeout: 15000 });
    for (let r = 0; r < 4; r++) {
      if (r > 0) {
        await page.locator(pane + ' button', { hasText: '听 一 遍' }).click();
        await page.waitForFunction(() => !cond.on, null, { timeout: 15000 });
      }
      await page.locator(pane + ' .opts button').first().click();
      await page.waitForTimeout(1600);
    }
    check(await page.evaluate(() => prog['meter-accent'].n === 1), '听辨四段走完记一次进度');
    evidence.before = before; evidence.during = during; evidence.shift = after - before.t0;
  });

  await test('拍号：延音线／连线／休止看图辨，附点与弱起题库', async (page, evidence) => {
    await page.locator('#tabs button[data-k="meter"]').click();
    await openDrill(page, '延音线·连线·休止');
    for (let i = 0; i < 6; i++) {
      check(await page.locator(pane + ' .rhythm svg').count() === 1, '每题都画出谱例');
      await page.locator(pane + ' .opts button').first().click();
      await page.locator(pane + ' .row button.act').first().click();
    }
    check(await page.evaluate(() => prog['meter-tie'].n === 1), '辨线记进度');
    await openDrill(page, '附点时值');
    const dot = await runQuiz(page, 'BANK_DOT', 6);
    check(/100%/.test(dot), '附点时值全对');
    await openDrill(page, '弱起小节');
    const ana = await runQuiz(page, 'BANK_ANA', 5);
    check(/100%/.test(ana), '弱起小节全对');
    evidence.dot = dot; evidence.ana = ana;
  });

  await test('打拍子：口诀严格按四十六网格（哒 哒 啊 哒）生成', async (page, evidence) => {
    await page.locator('#tabs button[data-k="beat"]').click();
    const syl = await page.evaluate(() => {
      const out = {};
      PATTERNS.forEach(p => { out[p.id] = p.notes.map(n => n[3] ? '空' : sylAt(n[0])).join(' '); });
      return out;
    });
    check(syl['b-416'] === '哒 哒 啊 哒', '四十六＝哒 哒 啊 哒');
    check(syl['b-28'] === '哒 啊', '二八＝哒 啊');
    check(syl['b-168'] === '哒 哒 啊', '前十六后八＝哒 哒 啊（截图原文）');
    check(syl['b-syncs'] === '哒 哒 哒', '小切分顶点啊被合并＝哒 哒 哒');
    check(syl['b-dotb'] === '哒 哒', '后附点＝哒 哒');
    check(syl['b-r8'] === '空 啊', '八休＋八＝空 啊（休止念空，顶点念啊）');
    const grid = await page.evaluate(() => {
      const p = PATTERNS.find(x => x.id === 'b-syncs');
      return p.notes.map(n => n[0]);
    });
    check(JSON.stringify(grid) === JSON.stringify([0, 0.25, 0.75]), '小切分拍位 0／0.25／0.75');
    const big = await page.evaluate(() => PATTERNS.find(x => x.id === 'b-syncbig').notes.map(n => [n[0], n[1]]));
    check(JSON.stringify(big) === JSON.stringify([[0, 0.5], [0.5, 1], [1.5, 0.5]]), '大切分＝八分＋四分＋八分，跨两拍');
    evidence.syl = syl; evidence.big = big;
  });

  await test('打拍子：示范可暂停可续，跟打判定按毫秒落账', async (page, evidence) => {
    await page.locator('#tabs button[data-k="beat"]').click();
    await page.locator(pane + ' .chips button', { hasText: '四十六' }).first().click();
    await page.locator(pane + ' button', { hasText: '听 示 范' }).click();
    await page.waitForTimeout(250);
    check(await page.evaluate(() => cond.on && bMode === 'demo'), '示范在跑');
    check(await page.evaluate(() => document.querySelectorAll('.pane.on .syl').length === 4), '四十六画出四个口诀位');
    await page.keyboard.press('p');
    const frozen = await page.evaluate(() => ({ t0: cond.t0, ei: cond.ei, taps: bTaps.length }));
    await page.waitForTimeout(1000);
    check(JSON.stringify(await page.evaluate(() => ({ t0: cond.t0, ei: cond.ei, taps: bTaps.length }))) === JSON.stringify(frozen), '暂停冻结示范时间线');
    await page.locator('#resume-game').click();
    check(await page.evaluate(t0 => cond.t0 > t0, frozen.t0), '恢复平移时间线');
    await page.waitForFunction(() => !cond.on, null, { timeout: 15000 });
    // 跟打：按谱面拍点在页面内定时调用 beatTap()，走真实判定
    await page.locator(pane + ' button', { hasText: '跟 打' }).click();
    await page.evaluate(() => {
      const p = PATTERNS[bIdx], bm = 60000 / bBpm, cin = p.cin || 4;
      p.notes.forEach(n => { if (!n[3]) setTimeout(beatTap, Math.max(0, cond.t0 + (cin + n[0]) * bm - Date.now())); });
    });
    await page.waitForFunction(() => !cond.on && bMode === 'idle', null, { timeout: 20000 });
    const judged = await page.evaluate(() => ({
      chips: document.querySelectorAll('.pane.on .judge span').length,
      perfect: document.querySelectorAll('.pane.on .judge span.p').length,
      rec: prog['b-416'], say: document.querySelector('.pane.on .say').textContent
    }));
    check(judged.chips >= 5, '每个音都有判定标签（含图例）');
    check(judged.perfect === 4, '正点打的四音全判「准」');
    check(judged.rec && judged.rec.n === 1 && judged.rec.best === 100, '精度 100% 入本地进度');
    check(/多打/.test(judged.say) === false, '没有多打');
    evidence.judged = judged;
  });

  await test('打拍子：休止型不发声，多打要扣精度', async (page, evidence) => {
    await page.locator('#tabs button[data-k="beat"]').click();
    await page.locator(pane + ' .chips button', { hasText: '八休＋八' }).first().click();
    const ev = await page.evaluate(() => beatEvents(PATTERNS[bIdx], bBpm, true, false).filter(e => e.f).map(e => e.t));
    check(ev.length === 1, '八休＋八只发一个音，休止不出声');
    await page.locator(pane + ' button', { hasText: '跟 打' }).click();
    await page.evaluate(() => {
      const p = PATTERNS[bIdx], bm = 60000 / bBpm, cin = p.cin || 4;
      setTimeout(beatTap, Math.max(0, cond.t0 + (cin + 0.5) * bm - Date.now()));
      setTimeout(beatTap, Math.max(0, cond.t0 + (cin + 0.2) * bm - Date.now()));
      setTimeout(beatTap, Math.max(0, cond.t0 + (cin + 0.8) * bm - Date.now()));
    });
    await page.waitForFunction(() => !cond.on && bMode === 'idle', null, { timeout: 20000 });
    const out = await page.evaluate(() => ({ say: document.querySelector('.pane.on .say').textContent, rec: prog['b-r8'] }));
    check(/多打/.test(out.say), '休止期与多余拍点算多打');
    check(out.rec.best < 100, '多打扣精度');
    evidence.out = out;
  });

  await test('指法：七音上行穿指、下行跨指用真实键盘按键', async (page, evidence) => {
    await page.locator('#tabs button[data-k="finger"]').click();
    await page.locator(pane + ' .chips button', { hasText: '七音上行' }).click();
    const up = await page.evaluate(() => FINGERS.find(f => f.id === 'fg-7up'));
    check(JSON.stringify(up.seq.map(s => s[1])) === JSON.stringify([1, 2, 3, 1, 2, 3, 4, 5]), '上行指法 1 2 3 1 2 3 4 5');
    check(/穿指/.test(up.marks[3]), '第四步标穿指提示');
    for (const k of ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k']) await page.keyboard.press(k);
    check(await page.evaluate(() => prog['fg-7up'] && prog['fg-7up'].best === 100), '上行一遍全对记 100%');
    await page.locator(pane + ' .chips button', { hasText: '七音下行' }).click();
    const dn = await page.evaluate(() => FINGERS.find(f => f.id === 'fg-7dn'));
    check(JSON.stringify(dn.seq.map(s => s[1])) === JSON.stringify([5, 4, 3, 2, 1, 3, 2, 1]), '下行指法 5 4 3 2 1 3 2 1');
    check(/跨指/.test(dn.marks[5]), '第六步标跨指提示');
    for (const k of ['k', 'j', 'h', 'g', 'f', 'd', 's', 'a']) await page.keyboard.press(k);
    check(await page.evaluate(() => prog['fg-7dn'].best === 100), '下行一遍全对');
    // 错音要计数
    await page.locator(pane + ' .chips button', { hasText: '右手五指原位' }).click();
    await page.keyboard.press('s');
    check(await page.evaluate(() => fErrs === 1), '错音记一次失误');
    check(/1 指/.test(await page.locator(pane + ' .say').innerText()), '错音报出该用几指');
    evidence.up = up.seq; evidence.dn = dn.seq;
  });

  await test('指法：和声 6m–4–5–6m 三键齐按，断奏连奏可切', async (page, evidence) => {
    await page.locator('#tabs button[data-k="finger"]').click();
    await page.locator(pane + ' .chips button', { hasText: '和声 6m' }).click();
    const chords = await page.evaluate(() => FINGERS.find(f => f.id === 'fg-chord').chords.map(c => c.slice(0, 3)));
    check(JSON.stringify(chords) === JSON.stringify([[69, 72, 76], [65, 69, 72], [67, 71, 74], [69, 72, 76]]), 'C 调下 Am–F–G–Am');
    const keys = { 60: 'a', 62: 's', 64: 'd', 65: 'f', 67: 'g', 69: 'h', 71: 'j', 72: 'k', 74: 'l', 76: ';' };
    for (const c of chords) {
      for (const m of c) await page.keyboard.press(keys[m]);
      await page.waitForTimeout(700);
    }
    check(await page.evaluate(() => prog['fg-chord'] && prog['fg-chord'].best === 100), '四个和弦按齐记 100%');
    await page.locator(pane + ' button', { hasText: '连奏' }).click();
    check(await page.evaluate(() => fStac === false), '连奏可切');
    await page.locator(pane + ' button', { hasText: '断奏' }).click();
    check(await page.evaluate(() => fStac === true), '断奏可切');
    evidence.chords = chords;
  });

  await test('进度跨重载保留，掌握度按课目聚合，全程不入星尘账', async (page, evidence) => {
    await page.evaluate(() => {
      ['key-name', 'key-scale', 'key-ear', 'key-sign', 'key-solf', 'key-concept'].forEach(id => { prog[id] = { n: 2, best: 90, last: 90 }; });
      saveProg(); hud();
    });
    check(await page.evaluate(() => mastery('key')), '调号门全部达标即算掌握');
    check(await page.locator('#tabs button[data-k="key"]').evaluate(b => b.classList.contains('master')), '页签亮起掌握点');
    const before = await page.evaluate(() => localStorage.getItem('ml_prog'));
    await page.reload();
    check(await page.evaluate(() => localStorage.getItem('ml_prog')) === before, '重载后进度还在');
    check(await page.evaluate(() => document.getElementById('t-master').textContent === '1'), 'HUD 掌握门数正确');
    check(await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('zh_play_v2:') === 0 || k === 'zh_plays').length === 0), '日课始终不写结算队列');
    const ext = await page.evaluate(() => localStorage.getItem('ml_prog').length);
    check(ext > 20, '进度是可打包的字符串');
    evidence.before = before.slice(0, 120);
  });

  await test('谱架与节拍器热点、藏品登记都在主屋挂上了', async (page, evidence) => {
    const html = fs.readFileSync(path.join(root, '我的家.html'), 'utf8');
    check(html.includes('link:"钢琴房/乐理课.html"'), '钢琴房藏品登记了新页');
    check(html.includes('contains("pstand")'), '谱架热点有分支');
    check(html.includes('contains("pmetro")'), '节拍器热点有分支');
    check(html.includes('乐理课.html?k=beat'), '节拍器直达打拍子课');
    check(html.includes('"ml_prog"'), '进度键进完整存档白名单');
    const size = fs.statSync(path.join(root, '我的家.html')).size;
    check(size <= 320 * 1024, '主屋仍在 320KB 红线内：' + size + 'B');
    await page.goto(base + '/' + encodeURI(FILE) + '?k=beat');
    check(await page.evaluate(() => curTab === 'beat'), '?k=beat 直达打拍子');
    evidence.hubBytes = size;
  });

  await test('手机 390px：四课目无横向溢出，拍垫与暂停可达', async (page, evidence) => {
    const boxes = {};
    for (const k of ['key', 'meter', 'beat', 'finger']) {
      await page.locator('#tabs button[data-k="' + k + '"]').tap();
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), k + ' 无横向溢出');
      const tab = await page.locator('#tabs button[data-k="' + k + '"]').boundingBox();
      check(tab && tab.x >= 0 && tab.x + tab.width <= 391, k + ' 页签在屏内');
      boxes[k] = tab;
    }
    await page.locator('#tabs button[data-k="beat"]').tap();
    await page.locator(pane + ' .chips button', { hasText: '四十六' }).first().tap();
    await page.locator(pane + ' button', { hasText: '跟 打' }).tap();
    const pad = await page.locator(pane + ' .pad').boundingBox();
    check(pad && pad.x >= 0 && pad.y >= 0 && pad.x + pad.width <= 391 && pad.y + pad.height <= 845, '拍垫整块在 390px 屏内');
    await page.locator(pane + ' .pad').tap();
    check(await page.evaluate(() => bTaps.length === 1), '触屏拍垫真的记到一拍');
    await page.locator('#pause-toggle').tap();
    check(await page.evaluate(() => paused && document.getElementById('pause-dialog').open), '触屏可暂停');
    const dlg = await page.locator('#pause-dialog').boundingBox();
    check(dlg && dlg.x >= 0 && dlg.x + dlg.width <= 391 && dlg.y + dlg.height <= 845, '暂停框在屏内');
    await page.locator('#resume-game').tap();
    check(await page.evaluate(() => !paused), '触屏可继续');
    await page.locator(pane + ' button', { hasText: '停' }).tap();
    evidence.boxes = boxes; evidence.pad = pad;
  }, true);

  await test('画中门里回小家发 postMessage，独立打开则直接跳回主屋', async (page, evidence) => {
    const msgs = [];
    await page.exposeFunction('__note', m => msgs.push(m));
    await page.setContent('<iframe id="f" src="' + base + '/' + encodeURI(FILE) + '" style="width:100%;height:640px;border:0"></iframe>');
    await page.evaluate(() => window.addEventListener('message', e => { if (e.data === 'zhouse-back') window.__note(e.data); }));
    await page.frameLocator('#f').locator('#game-home').click();
    check(msgs.length === 1 && msgs[0] === 'zhouse-back', '嵌在母页里时回小家发 zhouse-back');
    await page.goto(base + '/' + encodeURI(FILE));
    await page.locator('#game-home').click();
    await page.waitForURL(u => decodeURIComponent(u.toString()).endsWith('我的家.html'), { timeout: 15000 });
    check(decodeURIComponent(page.url()).endsWith('我的家.html'), '独立打开时回小家直接跳回主屋');
    evidence.msgs = msgs;
  });
}
run().catch(e => { report.fatal = e.stack || String(e); console.error(e); }).finally(async () => {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString();
  report.passed = report.tests.filter(t => t.status === 'passed').length;
  report.failed = report.tests.filter(t => t.status === 'failed').length;
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, assertions: report.assertions, output }));
  process.exitCode = report.failed || report.fatal ? 1 : 0;
});