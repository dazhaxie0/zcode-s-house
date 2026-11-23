'use strict';

// Standalone regression runner. Does not use a persistent browser profile.
// PLAYWRIGHT_MODULE=/path/to/playwright-core CHROME_PATH=/path/to/chrome node game-regression.cjs
// Optional QA_OUTPUT sets the JSON evidence path (default: OS temporary directory).
// Starts/clicks/keyboard actions are real browser input. Timing fixtures are explicitly
// reported; settlement functions are invoked only AFTER a natural settlement to test idempotence.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = __dirname;
const output = process.env.QA_OUTPUT || path.join(os.tmpdir(), 'zhouse-game-regression.json');
const report = { startedAt: new Date().toISOString(), browser: '', tests: [], assertions: 0,
  timing: 'Stars and memory completed through real clicks. Typesetting, fireflies and rhythm use deadline/start-time fixtures after input. Kitchen shift shortened after movement. Mole round expires after real input using a shortened countdown.',
  limits: ['Chromium only; no physical gamepad or audio listening.', 'Timers shortened in four games; not a real-time endurance test.'] };
function check(value, message) { assert.ok(value, message); report.assertions++; }
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) throw Error('Path outside root');
    if (file === root) file = path.join(root, '我的家.html');
  } catch { res.writeHead(400); return res.end(); }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    res.end(data);
  });
});
let browser;
let base;
async function test(name, file, run, mobile = false) {
  if (process.env.QA_TEST_FILTER && !new RegExp(process.env.QA_TEST_FILTER, 'i').test(name)) return;
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1422, height: 804 },
    isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', message: message.text() }); });
  const result = { name, file, viewport: mobile ? '390x844 touch' : '1422x804', status: 'passed', errors, evidence: {} };
  report.tests.push(result);
  const before = report.assertions;
  try {
    const response = await page.goto(base + '/' + encodeURI(file));
    check(response.ok(), 'HTML responds successfully');
    await run(page, result.evidence);
    check(errors.length === 0, 'No browser runtime/console errors: ' + JSON.stringify(errors));
  } catch (error) { result.status = 'failed'; result.failure = String(error.stack || error); }
  finally { result.assertions = report.assertions - before; await context.close(); }
  console.log(result.status.toUpperCase() + ' ' + name + (result.failure ? ': ' + result.failure.split('\n')[0] : ''));
}
async function readQueue(page) {
  // Fresh game sessions may only publish independent receipts. Validate the raw storage wire format.
  const receipts = await page.evaluate(() => {
    if (localStorage.getItem('zh_plays') !== null) throw Error('New session wrote the legacy shared queue');
    return Object.keys(localStorage).filter(key => key.startsWith('zh_play_v2:'))
      .map(key => [key, JSON.parse(localStorage.getItem(key))]);
  });
  for (const [key, row] of receipts) {
    assert.ok(Array.isArray(row) && row.length === 5, 'Expected a five-field result at ' + key);
    assert.equal(key, 'zh_play_v2:' + row[2], 'Receipt key matches its run ID');
    assert.ok(typeof row[2] === 'string' && row[2].length > 0 && Number.isFinite(row[1]) && row[1] >= 0);
    assert.ok([0, 1].includes(row[3]) && Number.isSafeInteger(row[4]) && row[4] >= 0);
  }
  return receipts.map(([, row]) => row).sort((a, b) => a[4] - b[4] || a[2].localeCompare(b[2]));
}
async function settlement(page, game, fn, evidence) {
  const queue = await readQueue(page);
  check(queue.length === 1 && queue[0][0] === game && Number.isFinite(queue[0][1]), game + ' records one finite result');
  check(queue[0][4] > 0, game + ' carries the start time of this run');
  await page.evaluate(name => { window[name](); window[name](); }, fn);
  const after = await readQueue(page);
  check(JSON.stringify(queue) === JSON.stringify(after), game + ' duplicate settlement is ignored');
  evidence.result = queue[0];
}
async function home(page, selector) {
  await page.locator(selector).click();
  await page.waitForURL(url => decodeURI(url.pathname).endsWith('/我的家.html'));
  check(await page.locator('#t-start').count() === 1, 'Return reaches the house title screen');
}

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  report.browser = browser.version();
  await test('Star chart: all four constellations, result, replay, return', '阳台/星图.html', async (page, evidence) => {
    await page.locator('#go').click();
    const counts = [5, 8, 6, 8];
    for (let constellation = 0; constellation < counts.length; constellation++) {
      await page.waitForFunction(i => ci === i && playing && !locked, constellation);
      for (let i = 0; i < counts[constellation]; i++) {
        await page.locator('#field .star').nth(i).click();
        check(await page.evaluate(() => idx) === i + 1, 'Real pointer advances star ' + constellation + '/' + i);
      }
      check(await page.evaluate(() => got) === constellation + 1, 'Constellation completed');
    }
    await page.locator('#again').waitFor({ state: 'visible' });
    check((await page.locator('#panel').innerText()).includes('4 / 4'), 'All four shown in results');
    await settlement(page, 'sg', 'nightEnd', evidence);
    await page.locator('#again').click();
    check(await page.evaluate(() => playing && ci === 0 && score === 0), 'Replay resets star chart');
    await home(page, '#home');
  });
  await test('Memory: all eight pairs through DOM, result, replay, return', '储藏室/翻箱倒柜.html', async (page, evidence) => {
    await page.locator('#btn-go').click();
    const cards = await page.locator('#board .card').evaluateAll(nodes => nodes.map(n => ({ index: n.dataset.i, name: n.querySelector('.fa span').textContent })));
    const groups = Object.groupBy(cards, card => card.name);
    check(Object.keys(groups).length === 8, 'Eight unique pairs');
    for (const pair of Object.values(groups)) {
      check(pair.length === 2, 'Exactly two matching cards');
      for (const card of pair) await page.locator('.card[data-i="' + card.index + '"]').click();
    }
    check(await page.evaluate(() => matched === 8 && !playing && tries === 8), 'All pairs finish naturally in eight turns');
    await settlement(page, 'mm', 'finish', evidence);
    check(/^mm/.test(evidence.result[2]) && evidence.result[3] === 1, 'Cleared board settles completed=1 with its own run id');
    await page.locator('#btn-ag').click();
    check(await page.evaluate(() => playing && matched === 0 && score === 0), 'Replay resets memory');
    // 统一暂停：P 冻结、对话框开；切后台也走暂停而不是判死
    await page.keyboard.press('p');
    await page.waitForFunction(() => document.querySelector('#pause-dialog')?.open === true);
    check(await page.evaluate(() => paused === true && playing === true), 'P pauses without ending the run');
    await page.evaluate(() => { flip(+document.querySelector('.card').dataset.i); });
    check(await page.evaluate(() => st[+document.querySelector('.card').dataset.i] === 0), 'board is frozen while paused');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    check(await page.evaluate(() => paused === true && playing === true), 'hidden tab keeps the run paused, not dead');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      resumeGame();
    });
    await page.waitForFunction(() => !document.querySelector('#pause-dialog').open);
    // Expire the new replay only to expose its normal return control.
    await page.evaluate(() => { t0 -= 181000; });
    await page.locator('#panel:not(.hide)').waitFor();
    const timedOut = await readQueue(page);
    check(timedOut.length === 2 && timedOut[1][3] === 0 && timedOut[1][2] !== timedOut[0][2],
      'Timed-out replay keeps positive score but settles completed=0 under a fresh run id');
    await home(page, '#panel .back');
  });
  await test('Typesetting: complete verse, expiry, result, replay, return', '书房/活字排版.html', async (page, evidence) => {
    await page.locator('#btn-go').click();
    const verse = await page.locator('.slot .ghost').allTextContents();
    for (const char of verse) await page.locator('.tile[data-ch="' + char + '"]').first().click();
    check(await page.evaluate(() => printed === 1 && score > 0), 'Real pointer prints one verse');
    await page.keyboard.press('p');
    await page.waitForFunction(() => document.querySelector('#pause-dialog')?.open === true);
    const frozenLeft = await page.evaluate(() => Math.max(0, deadline - Date.now()));
    await page.waitForTimeout(700);
    const stillFrozen = await page.evaluate(() => Math.max(0, deadline - Date.now()));
    check(Math.abs(frozenLeft - stillFrozen) < 60000 && stillFrozen > 0, 'deadline stops draining while paused');
    await page.evaluate(() => document.querySelector('.tile:not(.gone)') && window.pick && window.pick(document.querySelector('.tile:not(.gone)')));
    check(await page.evaluate(() => printed === 1), 'picking is blocked while paused');
    await page.keyboard.press('p');
    await page.waitForFunction(() => !document.querySelector('#pause-dialog').open);
    await page.evaluate(() => { deadline = Date.now() - 1; });
    await page.waitForFunction(() => !playing); // overlay 以 opacity 隐藏，元素等待会抢跑，等游戏状态
    await settlement(page, 'hz', 'finish', evidence);
    check(/^hz/.test(evidence.result[2]) && evidence.result[3] === 1, 'Printed verse settles completed=1');
    await page.locator('#btn-re').click();
    check(await page.evaluate(() => playing && printed === 0 && score === 0), 'Replay resets typesetting');
    await page.evaluate(() => { deadline = Date.now() - 1; });
    await page.waitForFunction(() => !playing);
    const expired = await readQueue(page);
    check(expired.length === 2 && expired[1][3] === 0, 'Expiry without printing settles completed=0');
    await home(page, '#bk');
  });
  await test('Fireflies: catch moving target, expiry, result, replay, return', '阳台/捕萤.html', async (page, evidence) => {
    await page.locator('#go').click();
    const target = await page.locator('#field .ff:not(.away)').first().boundingBox();
    check(!!target, 'Firefly spawned');
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    await page.waitForFunction(() => caught >= 1);
    check(await page.evaluate(() => score > 0), 'Real pointer catch awards points');
    await page.keyboard.press('p');
    await page.waitForFunction(() => document.querySelector('#pause-dialog')?.open === true);
    const fyLeft = await page.evaluate(() => Math.max(0, DUR - (Date.now() - t0)));
    await page.waitForTimeout(600);
    const fyLeft2 = await page.evaluate(() => Math.max(0, DUR - (Date.now() - t0)));
    check(Math.abs(fyLeft - fyLeft2) < 2000 && fyLeft2 > 0, 'night clock stops while paused');
    await page.keyboard.press('p');
    await page.waitForFunction(() => !document.querySelector('#pause-dialog').open);
    await page.evaluate(() => { t0 -= 61000; });
    await page.locator('#again').waitFor();
    await settlement(page, 'fy', 'end', evidence);
    await page.locator('#again').click();
    check(await page.evaluate(() => playing && caught === 0 && score === 0), 'Replay resets fireflies');
    await home(page, '#home');
  });
  await test('Rhythm: keyboard judgement, expiry, result, replay, return', '客厅/节奏地毯.html', async (page, evidence) => {
    await page.locator('#go').click();
    await page.waitForFunction(() => playing);
    await page.waitForFunction(() => notes[0].el !== null);
    // Shift only the first note into its judgement window, then send actual keyboard input.
    const key = await page.evaluate(() => { notes[0].hitAt = Date.now() + 25; return ['d', 'f', 'j', 'k'][notes[0].t]; });
    await page.keyboard.press(key);
    check(await page.evaluate(() => sc > 0 && nP + nG === 1), 'Keyboard hits one note');
    await page.keyboard.press('p');
    await page.waitForFunction(() => document.querySelector('#pause-dialog')?.open === true);
    check(await page.evaluate(() => paused === true && playing === true), 'P pauses the song without ending it');
    const frozenA = await page.evaluate(() => ({ done: notes.filter(n => n.done).length, missed: nM }));
    await page.waitForTimeout(700);
    const frozenB = await page.evaluate(() => ({ done: notes.filter(n => n.done).length, missed: nM }));
    check(frozenA.done === frozenB.done && frozenA.missed === frozenB.missed, 'no note falls past while paused');
    await page.keyboard.press('p');
    await page.waitForFunction(() => !document.querySelector('#pause-dialog').open);
    check(await page.evaluate(() => paused === false && playing === true), 'resume continues the song');
    await page.evaluate(() => { startT -= 60000; });
    await page.locator('#veil:not(.hide)').waitFor();
    await settlement(page, 'rg', 'finish', evidence);
    check(/^rg/.test(evidence.result[2]) && evidence.result[3] === 1, 'Finished song settles completed=1');
    await page.locator('#go').click();
    await page.waitForFunction(() => playing);
    check(await page.evaluate(() => sc === 0 && nP === 0), 'Replay resets rhythm');
    await home(page, '#bk');
  });
  await test('Piano echo: six rounds echoed by real clicks, wrong note settles completion then failure', '钢琴房/琴键回响.html', async (page, evidence) => {
    await page.locator('#btn-go').click();
    await page.keyboard.press('p');
    await page.waitForFunction(() => document.querySelector('#pause-dialog')?.open === true);
    await page.locator('#resume-game').click();
    await page.waitForFunction(() => !document.querySelector('#pause-dialog').open);
    for (let r = 0; r < 6; r++) { // 每轮等「到你了」，照琴谱真点琴键
      await page.waitForFunction(() => window.state === 'repeat', null, { timeout: 8000 });
      const notes = await page.evaluate(() => seq.slice());
      for (const n of notes) {
        await page.locator('.key[data-i="' + n + '"]').click();
        await page.waitForTimeout(120);
      }
      await page.waitForTimeout(400);
    }
    await page.waitForFunction(() => window.state === 'repeat', null, { timeout: 8000 });
    const wrong = await page.evaluate(() => (seq[0] + 4) % 8); // 第七轮故意错音收场（已模成六轮）
    await page.locator('.key[data-i="' + wrong + '"]').click();
    await page.waitForFunction(() => window.state === 'over');
    await page.evaluate(() => { finish(); finish(); }); // 重复结算不重记
    const afterSix = await readQueue(page);
    check(afterSix.length === 1 && afterSix[0][3] === 1 && afterSix[0][1] >= 720 && /^pn/.test(afterSix[0][2]), 'six echoed rounds settle completed=1 with run id');
    check((await page.locator('#pcard').innerText()).includes('模奏成曲'), 'result card marks the tune completed');
    await page.locator('#btn-re').click();
    await page.waitForFunction(() => window.state === 'repeat', null, { timeout: 8000 });
    const wrong2 = await page.evaluate(() => (seq[0] + 4) % 8);
    await page.locator('.key[data-i="' + wrong2 + '"]').click();
    await page.waitForFunction(() => window.state === 'over');
    const q2 = await readQueue(page);
    check(q2.length === 2 && q2[1][3] === 0 && q2[1][2] !== q2[0][2], 'immediate failure settles completed=0 under a fresh run id');
    // 练习局：错音重听不收场，且不入账
    const before = await readQueue(page).then(q => q.length);
    await page.locator('#btn-pr2').click();
    await page.waitForFunction(() => window.state === 'repeat', null, { timeout: 8000 });
    const w3 = await page.evaluate(() => (seq[0] + 4) % 8);
    await page.locator('.key[data-i="' + w3 + '"]').click();
    check(await page.evaluate(() => window.state) !== 'over', 'practice: wrong note replays instead of ending');
    await page.waitForFunction(() => window.state === 'repeat', null, { timeout: 8000 });
    check(await readQueue(page).then(q => q.length) === before, 'practice settles nothing');
    evidence.result = q2[0];
    await home(page, '#game-home');
  });
  await test('Dance steps: all forty spots tapped in time, then three misses end the song', '舞蹈房/追光舞步.html', async (page, evidence) => {
    await page.locator('#btn-go').click();
    for (let s = 0; s < 40; s++) {
      await page.waitForFunction(() => document.querySelector('.cell.spot'), null, { timeout: 5000 });
      await page.locator('.cell.spot').click();
    }
    await page.waitForFunction(() => !playing, null, { timeout: 5000 });
    await page.evaluate(() => { finish(); finish(); });
    const first = await readQueue(page);
    check(first.length === 1 && first[0][0] === 'dc' && first[0][3] === 1 && first[0][1] >= 2400 && /^dc/.test(first[0][2]), 'all forty steps settle completed=1 with gold-range score');
    check((await page.locator('#pcard').innerText()).includes('一曲跳完'), 'result card marks the dance finished');
    await page.locator('#btn-re').click();
    for (let m = 0; m < 3; m++) { // 连错三格谢幕：未跳完不算通关
      await page.waitForFunction(() => document.querySelector('.cell.spot'), null, { timeout: 5000 });
      await page.locator('.cell:not(.spot)').first().click();
      await page.waitForTimeout(500);
    }
    await page.waitForFunction(() => !playing, null, { timeout: 5000 });
    const q2 = await readQueue(page);
    check(q2.length === 2 && q2[1][3] === 0 && q2[1][2] !== q2[0][2], 'three misses settle completed=0 under a fresh run id');
    // 练习局：连错五次不谢幕，不入账
    const before = await readQueue(page).then(q => q.length);
    await page.locator('#btn-pr2').click();
    for (let m = 0; m < 5; m++) {
      await page.waitForFunction(() => document.querySelector('.cell.spot'), null, { timeout: 5000 });
      await page.locator('.cell:not(.spot)').first().click();
      await page.waitForTimeout(400);
    }
    check(await page.evaluate(() => playing) === true, 'practice: five misses never end the song');
    check(await readQueue(page).then(q => q.length) === before, 'practice settles nothing');
    evidence.result = q2[0];
    await home(page, '#game-home');
  });
  await test('Vocal bubbles: the whole verse sung at the ring, song completion settles once', '歌唱房/气泡和声.html', async (page, evidence) => {
    await page.locator('#btn-go').click();
    for (let n = 0; n < 28; n++) { // 气泡贴近金圈时真实点击场地
      await page.waitForFunction(() => { const ry = 0.44; return bubs.some(b => !b.judged && Math.abs(b.y - ry) <= 0.05); }, null, { timeout: 9000 });
      const box = await page.locator('#field').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
      await page.waitForTimeout(180); // 尊重 150ms 输入冷却
    }
    await page.waitForFunction(() => !playing, null, { timeout: 20000 });
    await page.evaluate(() => { finish(); finish(); });
    const q = await readQueue(page);
    check(q.length === 1 && q[0][0] === 'vo' && q[0][3] === 1 && q[0][1] >= 2000 && /^vo/.test(q[0][2]), 'full verse settles completed=1 with gold-range score');
    check((await page.locator('#pcard').innerText()).includes('一首唱完'), 'result card marks the song finished');
    // 练习局：横幅亮起、接唱不入账，随时可走
    const before = await readQueue(page).then(q => q.length);
    await page.locator('#btn-pr2').click();
    await page.waitForFunction(() => playing);
    check((await page.locator('#say').innerText()).includes('练习'), 'vocal practice banner shows');
    for (let n = 0; n < 3; n++) {
      await page.waitForFunction(() => { const ry = 0.44; return bubs.some(b => !b.judged && Math.abs(b.y - ry) <= 0.05); }, null, { timeout: 12000 });
      const box = await page.locator('#field').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
      await page.waitForTimeout(200);
    }
    check(await readQueue(page).then(q => q.length) === before, 'practice taps settle nothing');
    evidence.result = q[0];
    await page.keyboard.press('Escape');
    await page.waitForURL(url => decodeURI(url.pathname).endsWith('/我的家.html'));
    check(await page.locator('#t-start').count() === 1, 'Practice escape returns to the house title screen');
  });
  await test('Kitchen: movement, expiry, result, replay, return', '厨房/胡闹厨房.html', async (page, evidence) => {
    check((await readQueue(page)).length === 0, 'Ending before an actual shift does not manufacture a result');
    const beforeStart = await page.evaluate(() => Date.now());
    await page.locator('#ovl-btn').click();
    const firstRun = await page.evaluate(() => ({ id: runId, started: runStarted, now: Date.now() }));
    check(/^oc-/.test(firstRun.id) && Number.isSafeInteger(firstRun.started) && firstRun.started >= beforeStart && firstRun.started <= firstRun.now, 'Real start creates a kitchen run id and start timestamp');
    const initial = await page.evaluate(() => ({ x: P.x, y: P.y }));
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(x => P.x < x, initial.x);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    check(await page.evaluate(() => keyDir() === null && Object.keys(keysDown).length === 0), 'Blur clears held movement');
    await page.keyboard.up('ArrowLeft');
    const beforeResume = await page.evaluate(() => P.x);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(x => P.x > x, beforeResume);
    await page.keyboard.up('ArrowRight');
    check(await page.evaluate(() => {
      const button = document.querySelector('.dpad button');
      button.dispatchEvent(new TouchEvent('touchstart', { cancelable: true, bubbles: true }));
      const held = !!keyDir();
      button.dispatchEvent(new TouchEvent('touchcancel', { cancelable: true, bubbles: true }));
      return held && keyDir() === null && touchDir === null;
    }), 'Cancelled touch clears held movement');
    await page.keyboard.down('ArrowLeft');
    check(await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
      return keyDir() === null && Object.keys(keysDown).length === 0;
    }), 'Hidden-document event clears held movement (visibility fixture)');
    await page.keyboard.up('ArrowLeft');
    check(await page.evaluate(() => running && orders.length > 0), 'Shift running with orders and keyboard movement');
    await page.evaluate(() => { shiftT = 0.05; });
    await page.locator('#ovl:not(.hidden)').waitFor();
    check((await page.locator('#ovl-h').innerText()) === '收班', 'Natural frame loop ends shortened shift');
    await settlement(page, 'oc', 'endShift', evidence);
    check(evidence.result.length === 5 && evidence.result[2] === firstRun.id && evidence.result[3] === 1 && evidence.result[4] === firstRun.started,
      'Full shift records its own five-field completion event, including original start time');
    await page.locator('#ovl-btn').click();
    check(await page.evaluate(() => running && !over && served === 0 && score === 0), 'Replay resets kitchen');
    const secondRun = await page.evaluate(() => ({ id: runId, started: runStarted }));
    check(secondRun.id !== firstRun.id && secondRun.started >= firstRun.started, 'Replay begins a distinct, freshly timestamped shift');
    await page.evaluate(() => { shiftT = 0.05; });
    await page.locator('#ovl:not(.hidden)').waitFor();
    await page.evaluate(() => { endShift(); endShift(); });
    const secondQueue = await readQueue(page);
    check(secondQueue.length === 2 && secondQueue[1][2] === secondRun.id && secondQueue[1][4] === secondRun.started && secondQueue[1][3] === 1,
      'Replay settles once under its fresh id; repeated settlement remains a no-op');
    evidence.runs = [firstRun, secondRun];
    await home(page, '#ovl-home');
  });
  await test('TV: five channels respond to input and reset; standalone return', '客厅/电视游戏机.html', async (page, evidence) => {
    await page.waitForFunction(() => state === 'snake', null, { timeout: 15000 });
    const initialSnake = await page.evaluate(() => S.snake[0].x);
    await page.keyboard.press('Space');
    await page.waitForFunction(x => S.snake[0].x !== x, initialSnake);
    await page.keyboard.press('Space');
    check(await page.evaluate(() => S.paused), 'Snake starts, moves and pauses');
    await page.locator('#resetBtn').click();
    check(await page.evaluate(() => !S.running && !S.dead && S.score === 0), 'Snake reset');
    const states = { 2: 'g2048', 3: 'brick', 4: 'mole', 5: 'rpg' };
    for (const channel of [2, 3, 4, 5]) {
      await page.locator('#ch' + channel).click();
      await page.waitForFunction(expected => state === expected, states[channel]);
      check(await page.locator('#ch' + channel).evaluate(el => el.classList.contains('active')), 'Channel ' + channel + ' highlighted');
      if (channel === 2) {
        const before = await page.evaluate(() => JSON.stringify(G.grid));
        for (const key of ['ArrowLeft', 'ArrowDown', 'ArrowRight']) await page.keyboard.press(key);
        check(await page.evaluate(() => JSON.stringify(G.grid)) !== before, '2048 moves with keyboard');
      } else if (channel === 3) {
        const x = await page.evaluate(() => B.px);
        await page.keyboard.press('ArrowRight');
        check(await page.evaluate(() => B.px) > x, 'Brick paddle moves');
        await page.keyboard.press('Space');
        check(await page.evaluate(() => B.running), 'Brick launches');
      } else if (channel === 4) {
        await page.keyboard.press('Space'); await page.keyboard.press('ArrowLeft');
        check(await page.evaluate(() => M.running && M.gx === 0), 'Mole game starts and cursor moves');
        await page.evaluate(() => { M.timeLeft = 0.01; });
        await page.waitForFunction(() => !M.running);
        const moleQueue = await readQueue(page);
        check(moleQueue.length === 1 && moleQueue[0][0] === 'mole', 'TV channel settles once into its own receipt');
        evidence.moleResult = moleQueue[0];
      } else {
        await page.keyboard.press('Space');
        const x = await page.evaluate(() => P.x);
        await page.keyboard.press('ArrowLeft');
        check(await page.evaluate(x => P.running && P.x < x, x), 'RPG starts and player moves');
      }
      await page.locator('#resetBtn').click();
      check(await page.evaluate(ch => ch === 2 ? G.score === 0 && !G.over : ch === 3 ? !B.running && B.score === 0 : ch === 4 ? !M.running && M.timeLeft === 30 : !P.running && P.hp === 5, channel), 'Channel ' + channel + ' reset');
    }
    evidence.channels = ['snake', '2048', 'brick', 'mole', 'rpg'];
    await home(page, '.house-back');
  });
  for (const [file, start] of [['阳台/星图.html', '#go'], ['储藏室/翻箱倒柜.html', '#btn-go'], ['书房/活字排版.html', '#btn-go'], ['阳台/捕萤.html', '#go'], ['客厅/节奏地毯.html', '#go'], ['厨房/胡闹厨房.html', '#ovl-btn'], ['钢琴房/琴键回响.html', '#btn-go'], ['舞蹈房/追光舞步.html', '#btn-go'], ['歌唱房/气泡和声.html', '#btn-go']]) {
    await test('Mobile start: ' + file, file, async (page, evidence) => {
      await page.locator(start).tap();
      await page.waitForTimeout(250);
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight }));
      check(dimensions.scrollWidth <= dimensions.width + 1, 'No horizontal overflow at 390px');
      evidence.dimensions = dimensions;
    }, true);
  }
  await test('Mobile TV: screen, touch pad, five-channel controls fit', '客厅/电视游戏机.html', async (page, evidence) => {
    await page.waitForFunction(() => state === 'snake', null, { timeout: 15000 });
    for (const selector of ['#crt', '#padMid', '#ch1', '#ch5']) {
      const box = await page.locator(selector).boundingBox();
      check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845, selector + ' visible inside mobile viewport');
    }
    await page.locator('#padMid').tap();
    check(await page.evaluate(() => S.running), 'Touch centre starts snake');
    await page.locator('#padMid').tap();
    check(await page.evaluate(() => S.paused), 'Touch centre pauses snake');
    evidence.dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    check(evidence.dimensions.scrollWidth <= 391, 'TV has no horizontal overflow');
    await home(page, '.house-back');
  }, true);
}
run().catch(error => { report.fatal = String(error.stack || error); console.error(error); }).finally(async () => {
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
