'use strict';

// Isolated music-session regression. No personal browser profile or saved games.
// Use PLAYWRIGHT_MODULE and CHROME_PATH as in game-regression.cjs.
// Timer/visibility/finish fixtures are explicitly recorded below; these tests do
// not certify audio quality, real physical device switching or endurance.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = __dirname;
const output = process.env.QA_OUTPUT || path.join(os.tmpdir(), 'zhouse-music-session.json');
const games = [
  { id: 'pn', file: '钢琴房/琴键回响.html', label: 'Piano' },
  { id: 'dc', file: '舞蹈房/追光舞步.html', label: 'Dance' },
  { id: 'vo', file: '歌唱房/气泡和声.html', label: 'Vocal' }
];
const report = { startedAt: new Date().toISOString(), browser: '', assertions: 0, tests: [],
  fixtures: ['Document visibility event is simulated.', 'Practice and formal finish invoked after real scoring input to isolate persistence/idempotence.', '60/120Hz movement is measured with explicit requestAnimationFrame timestamps.'],
  limits: ['No physical gamepad or audio listening.', 'Pause is observed over six seconds, not a long-duration soak.'] };
function check(value, message) { assert.ok(value, message); report.assertions++; }
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
async function test(name, game, run, mobile = false) {
  if (process.env.QA_TEST_FILTER && !new RegExp(process.env.QA_TEST_FILTER, 'i').test(name)) return;
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const result = { name, file: game.file, viewport: mobile ? '390x844 touch' : '1366x900', status: 'passed', errors: [], evidence: {} };
  report.tests.push(result);
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
  const start = report.assertions;
  try {
    const response = await page.goto(base + '/' + encodeURI(game.file));
    check(response.ok(), 'Page responds successfully');
    await run(page, result.evidence);
    check(result.errors.length === 0, 'No browser errors: ' + JSON.stringify(result.errors));
  } catch (e) { result.status = 'failed'; result.error = e.stack || String(e); }
  finally { result.assertions = report.assertions - start; await context.close(); }
  console.log(result.status.toUpperCase(), name, result.error || '');
}
async function ready(page, game) {
  if (game.id === 'pn') await page.waitForFunction(() => state === 'repeat');
  else if (game.id === 'dc') await page.waitForFunction(() => playing && spot >= 0);
  else await page.waitForFunction(() => playing && bubs.some(b => !b.judged));
}
async function scoreInput(page, game) {
  await ready(page, game);
  if (game.id === 'pn') {
    const key = await page.evaluate(() => String(seq[idx] + 1));
    await page.keyboard.press(key);
  } else if (game.id === 'dc') await page.locator('.cell.spot').click();
  else {
    await page.waitForFunction(() => bubs.some(b => !b.judged && Math.abs(b.y - 0.44) <= 0.04));
    const box = await page.locator('#field').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
  }
  check(await page.evaluate(() => score > 0), 'Real input earns a positive score');
}
async function snapshot(page, game) {
  return page.evaluate(id => {
    const runs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('zh_play_v2:') === 0) runs.push(localStorage.getItem(k));
    }
    const common = { score, best: localStorage.getItem(KEY), queue: localStorage.getItem('zh_plays'), runs: runs.sort() };
    if (id === 'pn') return { ...common, round, idx, state, seq: seq.slice() };
    if (id === 'dc') return { ...common, step, combo, miss, spot, playing };
    return { ...common, done, missed, combo, playing, bubbles: bubs.filter(b => !b.judged).map(b => ({ i: b.i, y: b.y })) };
  }, game.id);
}
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  report.browser = browser.version();
  for (const game of games) {
    await test(game.label + ': pausing during the opening delay cannot start a ghost round', game, async (page, evidence) => {
      await page.locator('#btn-go').click();
      await page.locator('#pause-toggle').click();
      check(await page.evaluate(() => paused), 'Pause is available before the first prompt');
      const before = await snapshot(page, game);
      await page.waitForTimeout(1100);
      check(JSON.stringify(await snapshot(page, game)) === JSON.stringify(before), 'Opening callbacks cannot change the paused run');
      await page.locator('#resume-game').click();
      await ready(page, game);
      check((await readQueue(page)).length === 0, 'Opening pause does not produce a settlement');
      evidence.pausedOpening = before;
    });
    await test(game.label + ': keyboard start, frozen pause, hidden pause and resume', game, async (page, evidence) => {
      await page.locator('#btn-go').focus(); await page.keyboard.press('Enter');
      await ready(page, game);
      await page.locator('#pause-toggle').focus(); await page.keyboard.press('Enter');
      check(await page.evaluate(() => paused && document.querySelector('#pause-dialog').open), 'Keyboard opens the pause dialog');
      check(await page.evaluate(() => document.activeElement.id === 'resume-game'), 'Pause focuses Continue');
      const before = await snapshot(page, game);
      await page.waitForTimeout(6100);
      check(JSON.stringify(await snapshot(page, game)) === JSON.stringify(before), 'Six paused seconds consume no input deadline, notes, steps, bubbles or reward');
      await page.keyboard.press('Space');
      check(await page.evaluate(() => !paused && !document.querySelector('#pause-dialog').open), 'Space activates Continue without being swallowed by gameplay');
      await scoreInput(page, game);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      check(await page.evaluate(() => paused), 'Hidden document pauses the current run');
      const hidden = await snapshot(page, game);
      await page.waitForTimeout(450);
      check(JSON.stringify(await snapshot(page, game)) === JSON.stringify(hidden), 'Hidden state neither progresses nor settles');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      check(await page.evaluate(() => paused), 'Returning to visibility still waits for explicit Continue');
      await page.locator('#resume-game').focus(); await page.keyboard.press('Enter');
      check(await page.evaluate(() => !paused), 'Enter resumes the hidden run');
      evidence.pausedSnapshot = before; evidence.hiddenSnapshot = hidden;
    });
    await test(game.label + ': practice isolation and duplicate formal settlement', game, async (page, evidence) => {
      await page.locator('#btn-pr').focus(); await page.keyboard.press('Enter');
      check(await page.evaluate(() => practice), 'Keyboard activates practice mode');
      await scoreInput(page, game);
      const practiceScore = await page.evaluate(() => score);
      await page.evaluate(() => { finish(); finish(); });
      check(await page.evaluate(() => localStorage.getItem(KEY) === null) && (await readQueue(page)).length === 0, 'Positive practice result changes neither high score nor reward queue');
      check((await page.locator('#pcard').innerText()).includes('练习'), 'Practice result is explicitly labelled');
      await page.locator('#btn-re').focus(); await page.keyboard.press('Enter');
      check(await page.evaluate(() => !practice), 'Replay enters a formal run');
      await scoreInput(page, game);
      const run = await page.evaluate(() => ({ runId, runStarted, score }));
      await page.evaluate(() => finish());
      const queue = await readQueue(page);
      check(queue.length === 1 && queue[0][0] === game.id && queue[0][1] > 0 && typeof queue[0][2] === 'string', 'One positive formal result is recorded with a run ID');
      check(queue[0][1] === run.score && queue[0][2] === run.runId && queue[0][4] === run.runStarted && run.runStarted > 0,
        'Receipt preserves the score, identifier and start time from the formal run');
      const original = JSON.stringify(queue);
      await page.evaluate(() => { finish(); finish(); });
      check(JSON.stringify(await readQueue(page)) === original, 'Repeated finish cannot duplicate rewards');
      evidence.practiceScore = practiceScore; evidence.formalResult = queue[0];
    });
    await test(game.label + ': mobile pause controls remain reachable', game, async (page, evidence) => {
      await page.locator('#btn-go').tap(); await ready(page, game);
      await page.locator('#pause-toggle').tap();
      check(await page.evaluate(() => paused && document.querySelector('#pause-dialog').open), 'Touch opens Pause');
      const boxes = {};
      for (const selector of ['#pause-dialog', '#resume-game', '#leave-game']) {
        const box = await page.locator(selector).boundingBox(); boxes[selector] = box;
        check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 391 && box.y + box.height <= 845, selector + ' fits in 390px viewport');
      }
      await page.locator('#resume-game').tap();
      check(await page.evaluate(() => !paused), 'Touch resumes the same run');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
      evidence.boxes = boxes;
    }, true);
  }
  await test('Vocal: equal elapsed-time motion at 60/120Hz and valid judgement position', games[2], async (page, evidence) => {
    const data = await page.evaluate(() => {
      start(false); clearTimeout(spawnIv); cancelAnimationFrame(raf);
      const outcomes = [];
      for (const hz of [60, 120]) {
        bubs.forEach(b => b.el.remove()); bubs = []; done = missed = 0;
        spawn(0); bubs[0].v = 0.000256;
        lastFrame = 1000;
        for (let frame = 1; frame <= hz; frame++) { tick(1000 + frame * 1000 / hz); cancelAnimationFrame(raf); }
        outcomes.push({ hz, y: bubs[0].y });
      }
      const flightMs = (1.08 - 0.44) / bubs[0].v;
      bubs[0].y = 0.44; lastTap = 0; tap();
      const left = document.querySelector('.judge').style.left;
      pauseGame();
      return { outcomes, flightMs, left };
    });
    check(Math.abs(data.outcomes[0].y - data.outcomes[1].y) < 1e-8, '60Hz and 120Hz move the bubble equally over one second');
    check(Math.abs(data.outcomes[0].y - 0.824) < 1e-8, 'Bubble displacement uses elapsed milliseconds');
    check(data.flightMs >= 2400 && data.flightMs <= 2600, 'Spawn-to-ring budget is about 2.5 seconds');
    check(data.left === '18%', 'Judgement uses a single, valid percentage suffix');
    evidence.motion = data;
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
