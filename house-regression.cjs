// Isolated browser regression. See 最终测试与3A演进建议.md for setup.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const { cookWelcomeDinner } = require('./kitchen-journey.cjs');
const root = __dirname;
const out = process.env.QA_OUTPUT || path.join(os.tmpdir(), 'zhouse-qa-results');
fs.mkdirSync(out, { recursive: true });
const results = [], runtime = [], responses = [];
const mime = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    res.writeHead(err ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(err ? 'not found' : data);
  });
});
let browser, base;
async function test(name, run) {
  const start = Date.now();
  try { const detail = await run(); results.push({ name, status: 'pass', ms: Date.now() - start, detail }); }
  catch (e) { results.push({ name, status: 'fail', ms: Date.now() - start, error: e.stack }); }
  console.log(results.at(-1).status.toUpperCase(), name, results.at(-1).error || '');
}
function observe(page, label) {
  page.on('pageerror', e => runtime.push({ label, error: e.message }));
  page.on('console', m => { if (m.type() === 'error') runtime.push({ label, console: m.text() }); });
  page.on('response', r => { if (r.status() >= 400) responses.push({ label, status: r.status(), url: r.url() }); });
}
async function boot(page) {
  await page.goto(base + encodeURI('/我的家.html'));
  await enterHouse(page);
}
async function enterHouse(page) {
  await page.locator('.droom').first().waitFor({ state: 'attached' });
  await page.locator('#screen-boot').click();
  await page.locator('#screen-boot.clickable').click();
  await page.locator('#t-start').click();
  await page.waitForFunction(() => document.body.dataset.screen === 'house');
  await page.waitForTimeout(900);
}
async function importSave(page, value) {
  await page.evaluate(() => showSettings());
  await page.locator('#imp-save').click();
  await page.locator('#m-body textarea').fill(Buffer.from(JSON.stringify(value)).toString('base64'));
  await page.locator('#do-imp').click();
}
async function readDialogue(page, method = 'click') {
  const dialogue = page.locator('#dlg');
  await page.locator('#dlg.on').waitFor();
  for (let i = 0; i < 30 && await dialogue.isVisible(); i++) await dialogue[method](); // 章节对白七句，逐字时一句两下
  await dialogue.waitFor({ state: 'hidden' });
}
async function main() {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); observe(page, 'desktop'); page.setDefaultTimeout(7000);
  await test('fresh boot, title and house entry', async () => { await boot(page); assert.equal(await page.locator('.droom').count(), 11); });
  await test('quest goals match accessible rooms and CG content', async () => {
    assert.deepEqual(await page.evaluate(() => [QUESTS.find(q => q.stat === 'rooms' && q.goal > 1).goal, NROOM, QUESTS.find(q => q.id === 'q-cg7').goal, CGS.length]), [10, 10, 11, 11]); // 十间房 + 十二张 CG（cg12 首演之夜）
  });
  await test('keyboard visits all seven rooms and opens inventory', async () => {
    const names = await page.locator('.droom').evaluateAll(els => els.map(e => e.dataset.room).filter(n => !ROOMS[n].hidden));
    for (const name of names) {
      await page.locator(`.droom[data-room="${name}"]`).focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(n => document.querySelector('#r-name').textContent === n && document.querySelector('#room-overlay').classList.contains('on'), name);
      assert.ok(await page.locator('#r-inv .inv-slot').count() > 0);
      await page.locator('#r-back').click(); await page.waitForFunction(() => !document.querySelector('#room-overlay').classList.contains('on'));
    }
    assert.equal(await page.evaluate(() => S.stats.rooms), 10);
  });
  await test('inventory keyboard activation opens the intended book and recipe deep links', async () => {
    for (const [room, item, query] of [['书房', 'Git 家常菜', '?b=git'], ['厨房', '番茄炒蛋', '?f=番茄炒蛋']]) {
      await page.locator(`.droom[data-room="${room}"]`).focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(n => document.querySelector('#r-name').textContent === n && document.querySelector('#room-overlay').classList.contains('on'), room);
      await page.locator('.inv-slot').filter({ hasText: item }).focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(q => { const f = document.querySelector('#room-frame'); return document.querySelector('#frame-wrap').classList.contains('on') && f.contentDocument?.readyState === 'complete' && decodeURI(f.contentWindow.location.search) === q; }, query);
      assert.ok(await page.locator('#room-frame').contentFrame().locator('body').innerText());
      await page.locator('#frame-back').click(); await page.waitForFunction(() => !document.querySelector('#frame-wrap').classList.contains('on'));
      await page.locator('#r-back').click(); await page.waitForFunction(() => !document.querySelector('#room-overlay').classList.contains('on'));
    }
  });
  await test('shop insufficient funds feedback leaves balance intact', async () => {
    await page.evaluate(() => { setStardust(0); showShop(); });
    await page.locator('[data-buy]').first().click();
    assert.match(await page.locator('#toasts').innerText(), /还差/);
    assert.equal(await page.evaluate(() => S.stardust), 0);
    await page.locator('#m-close').click();
  });
  await test('save export/import and reload preserve progress', async () => {
    await page.evaluate(() => { setStardust(123); showSettings(); });
    await page.locator('#exp-save').click();
    const code = await page.locator('#m-body textarea').inputValue();
    const exported = JSON.parse(Buffer.from(code, 'base64').toString('utf8'));
    await page.locator('#m-close').click();
    await page.evaluate(() => setStardust(7));
    await importSave(page, exported);
    assert.equal(await page.evaluate(() => S.stardust), 123);
    await page.reload();
    await page.locator('.droom').first().waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => S.stardust), 123);
    assert.equal(await page.evaluate(() => S.stats.rooms), 10);
    await boot(page);
  });
  await test('export refuses a partial subsystem snapshot when storage reads fail', async () => {
    await page.evaluate(() => {
      showSettings(); window.__realGet = Storage.prototype.getItem;
      Storage.prototype.getItem = function(k) { if (k === 'gramo_song') throw new DOMException('denied', 'SecurityError'); return window.__realGet.call(this, k); };
    });
    try {
      await page.locator('#exp-save').click();
      assert.match(await page.locator('#modal-box h3').innerText(), /设置/);
      assert.match(await page.locator('#toasts').innerText(), /导出失败/);
    } finally {
      await page.evaluate(() => { Storage.prototype.getItem = window.__realGet; closeModal(); });
    }
  });
  await test('invalid import is atomic and leaves both live and stored progress unchanged', async () => {
    const bad = [ { opened: {} }, { visited: {} }, { owned: false }, { equipped: null }, { settings: { sfxVol: -1 } }, { stats: { phases: {} } }, { stardust: -2 }, { cgs: null } ];
    const baseline = await page.evaluate(() => JSON.stringify(S));
    const disk = await page.evaluate(() => localStorage.getItem(SAVE_KEY));
    for (const patch of bad) {
      await importSave(page, { stardust: 1, stats: {}, ...patch });
      assert.equal(await page.evaluate(() => JSON.stringify(S)), baseline, JSON.stringify(patch));
      assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), disk);
      assert.match(await page.locator('#toasts').innerText(), /导入失败/);
      await page.locator('#m-close').click();
    }
    await importSave(page, { format: 'zhouse', version: 4, house: { stardust: 1, stats: {} }, ext: {} });
    assert.equal(await page.evaluate(() => JSON.stringify(S)), baseline);
    assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), disk);
    await page.locator('#m-close').click();
  });
  await test('reward queue validates entries, caps daily payout and drains exactly once', async () => {
    const result = await page.evaluate(() => {
      const snapshot = JSON.stringify(S);
      for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.indexOf('zh_play_v2:') === 0) localStorage.removeItem(k); }
      S.stats.playDay = ''; S.stardust = 100;
      localStorage.setItem('zh_plays', JSON.stringify([['rg', 14000], ['unknown', 2], ['sg', -1], ['hz', '3600'], null]));
      cashPlays(); const first = S.stardust; cashPlays(); const duplicate = S.stardust;
      localStorage.setItem('zh_plays', JSON.stringify(Array.from({ length: 30 }, () => ['mm', 99999])));
      cashPlays(); const cap = S.stardust; cashPlays(); const final = S.stardust;
      S = JSON.parse(snapshot); save(); setStardust(S.stardust);
      return { first, duplicate, cap, final };
    });
    assert.deepEqual(result, { first: 106, duplicate: 106, cap: 160, final: 160 });
  });
  await test('settlement: completion flag drives quests, run ids dedupe, timeout score does not', async () => {
    const result = await page.evaluate(() => {
      const snapshot = JSON.stringify(S);
      const staleKeys = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('zh_play_v2:') === 0) staleKeys.push(k); }
      for (const k of staleKeys) localStorage.removeItem(k); // 清掉别局残留，队列里只认本用例注入的局
      S.stats.playDay = ''; S.stardust = 100; S.quests = {}; S.runs = []; S.wish = { idx: WISHES.length, rel: 4 }; delete S.stats.mmPlay; delete S.stats.hzPlay; delete S.stats.pnPlay; delete S.stats.dcPlay; delete S.stats.voPlay;
      for (const q of QUESTS) if (q.id !== 'q-mm' && q.id !== 'q-hz') S.quests[q.id] = true; // 只留目标两条，奖励增量可预期
      for (const a of ACHV) S.achv[a.id] = 1;
      localStorage.setItem('zh_plays', JSON.stringify([['mm', 3000, 'mm-t1', 0], ['mm', 99999, 'mm-t1', 0], ['hz', 900, 'hz-w1', 1], ['rg', 0, 'rg-z1', 1]]));
      cashPlays();
      const timeoutOnly = S.stardust, mmAfterTimeout = S.stats.mmPlay || 0, hzAfterWin = S.stats.hzPlay || 0, rgAfterZero = S.stats.rgPlay || 0;
      localStorage.setItem('zh_plays', JSON.stringify([['mm', 3000, 'mm-t1', 1], ['mm', 3000, 'mm-w9', 1]]));
      cashPlays(); checkQuests();
      const won = { stardust: S.stardust, mmPlay: S.stats.mmPlay || 0, mmQuest: !!S.quests['q-mm'], hzQuest: !!S.quests['q-hz'], runs: S.runs.length };
      S = JSON.parse(snapshot); save(); setStardust(S.stardust);
      localStorage.removeItem('zh_plays');
      return { timeoutOnly, mmAfterTimeout, hzAfterWin, rgAfterZero, won };
    });
    assert.equal(result.timeoutOnly, 108); // 超时正分只折星尘：6 + 2，重复局号 mm-t1 只算一次
    assert.equal(result.mmAfterTimeout, 0); // 超时没配齐一轮 → 不记「开箱」
    assert.equal(result.hzAfterWin, 1); // 印成一版 → 记「开印」
    assert.equal(result.rgAfterZero, 1); // 零分通关（整曲全 Miss）也认完成事实，只是不折星
    assert.deepEqual(result.won, { stardust: 149, mmPlay: 1, mmQuest: true, hzQuest: true, runs: 4 }); // 114 + 开箱20 + 开印15，局号环 4 条
  });
  await test('full save: export bundles subsystem keys, import restores them, reset clears all', async () => {
    await page.evaluate(() => {
      localStorage.setItem('oc_best', '9'); localStorage.setItem('greenhouse_v1', '{"pots":[]}'); localStorage.setItem('zh_plays', '[["sg",100,"sg-e1",1]]'); localStorage.setItem('gramo_chain', '1'); localStorage.setItem('gramo_song', 'song-3');
      for (let i = 0; i < 1000; i++) HouseRuns.enqueue('pn', 200, 'backup-' + i + '-'.padEnd(75, 'b'), 1, Date.now());
      showSettings();
    });
    await page.locator('#exp-save').click();
    const exported = JSON.parse(Buffer.from(await page.locator('#m-body textarea').inputValue(), 'base64').toString('utf8'));
    assert.deepEqual([exported.format, exported.version, exported.house.v, Object.hasOwn(exported.house, 'ext')], ['zhouse', 3, 2, false]);
    assert.deepEqual([exported.ext.oc_best, exported.ext.greenhouse_v1, exported.ext.zh_plays], ['9', '{"pots":[]}', '[["sg",100,"sg-e1",1]]']);
    assert.deepEqual([exported.ext.gramo_chain, exported.ext.gramo_song], ['1', 'song-3']);
    assert.equal(Object.keys(exported.ext).filter(k => k.startsWith('zh_play_v2:')).length, 1000);
    await page.locator('#m-close').click();
    await page.evaluate(() => localStorage.clear());
    await importSave(page, exported);
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('oc_best'), localStorage.getItem('greenhouse_v1'), localStorage.getItem('zh_plays')]), ['9', '{"pots":[]}', '[["sg",100,"sg-e1",1]]']);
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('gramo_chain'), localStorage.getItem('gramo_song')]), ['1', 'song-3']);
    assert.deepEqual(await page.evaluate(() => [HouseRuns.keys(localStorage).length, Object.keys(JSON.parse(localStorage.getItem(SAVE_KEY)).ext).length]), [1000, 0]);
    await page.evaluate(() => showSettings());
    const rs = page.locator('#reset-save');
    await rs.click();
    assert.match(await rs.innerText(), /全屋清空/);
    await rs.click();
    assert.deepEqual(await page.evaluate(() => {
      const fresh = JSON.parse(localStorage.getItem(SAVE_KEY));
      return [localStorage.getItem('oc_best'), localStorage.getItem('greenhouse_v1'), localStorage.getItem('zh_plays'), fresh.v, fresh.stardust, Object.keys(fresh.ext).length, fresh.runs.length];
    }), [null, null, null, 2, 20, 0, 0]); // 子系统键全清，主档按设计写回全新默认
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('gramo_chain'), localStorage.getItem('gramo_song')]), [null, null]);
    assert.equal(await page.evaluate(() => HouseRuns.keys(localStorage).length), 0);
    await page.reload();
    await boot(page);
  });
  await test('import replaces all subsystem keys and rolls back a failed partial write', async () => {
    await page.evaluate(() => { localStorage.setItem('oc_best', '90'); localStorage.setItem('pn_best', '99'); localStorage.setItem('greenhouse_v1', 'old'); });
    const original = await page.evaluate(() => JSON.parse(JSON.stringify(S)));
    await importSave(page, { ...original, ext: { oc_best: '5' } });
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('oc_best'), localStorage.getItem('pn_best'), localStorage.getItem('greenhouse_v1')]), ['5', null, null]);
    const beforeState = await page.evaluate(() => JSON.stringify(S));
    const beforeDisk = await page.evaluate(() => localStorage.getItem(SAVE_KEY));
    await page.evaluate(() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function(k,v) { if (k === 'pn_best') throw new DOMException('full', 'QuotaExceededError'); return window.__realSet.call(this,k,v); }; });
    try {
      await importSave(page, { ...original, ext: { oc_best: '6', pn_best: '8' } });
      assert.equal(await page.evaluate(() => JSON.stringify(S)), beforeState);
      assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), beforeDisk);
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('oc_best'), localStorage.getItem('pn_best')]), ['5', null]);
      assert.match(await page.locator('#toasts').innerText(), /原有进度已保留/);
      await page.locator('#m-close').click();
    } finally { await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; }); }
  });
  await test('interrupted import replays on reload and a stale committed journal cannot undo later progress', async () => {
    const c = await browser.newContext({ reducedMotion: 'reduce' }); const p = await c.newPage(); observe(p, 'journal-recovery');
    try {
      await boot(p);
      await p.evaluate(() => {
        S.stardust = 43; save();
        localStorage.setItem('oc_best', '77'); localStorage.setItem('pn_best', '88');
        const id = 'tx-testreplay-1';
        const next = { ...S, stardust: 91, ext: { oc_best: '5' }, saveTxn: id };
        localStorage.setItem(HouseSaveTxn.journalKey, JSON.stringify({ v: 1, id, next }));
        localStorage.setItem('oc_best', '5'); // 模拟子档已写一半，主档尚未提交便关闭页面
      });
      assert.equal(await p.evaluate(() => { try { HouseSaveTxn.commit(localStorage, SAVE_KEY, EXT_KEYS, defaultState()); return false; } catch (e) { return e.message === 'pending'; } }), true);
      await p.reload();
      await p.locator('.droom').first().waitFor({ state: 'attached' });
      assert.deepEqual(await p.evaluate(() => [S.stardust, localStorage.getItem('oc_best'), localStorage.getItem('pn_best'), localStorage.getItem(HouseSaveTxn.journalKey)]), [91, '5', null, null]);
      await p.evaluate(() => {
        S.stardust = 93; save(); localStorage.setItem('oc_best', '6');
        const id = S.saveTxn;
        const stale = { ...S, stardust: 91, ext: { oc_best: '5' } };
        localStorage.setItem(HouseSaveTxn.journalKey, JSON.stringify({ v: 1, id, next: stale }));
      });
      await p.reload();
      await p.locator('.droom').first().waitFor({ state: 'attached' });
      assert.deepEqual(await p.evaluate(() => [S.stardust, localStorage.getItem('oc_best')]), [93, '6']);
    } finally { await c.close(); }
  });
  await test('reset write failure restores old progress and a pending reset completes on reload', async () => {
    const c = await browser.newContext({ reducedMotion: 'reduce' }); const p = await c.newPage(); observe(p, 'reset-recovery');
    try {
      await boot(p);
      await p.evaluate(() => {
        S.stardust = 84; save(); localStorage.setItem('oc_best', '12');
        window.__realSet = Storage.prototype.setItem; let once = true;
        Storage.prototype.setItem = function(k, v) {
          if (k === SAVE_KEY && once) { once = false; throw new DOMException('full', 'QuotaExceededError'); }
          return window.__realSet.call(this, k, v);
        };
        showSettings();
      });
      await p.locator('#reset-save').click(); await p.locator('#reset-save').click();
      assert.deepEqual(await p.evaluate(() => [S.stardust, JSON.parse(localStorage.getItem(SAVE_KEY)).stardust, localStorage.getItem('oc_best'), localStorage.getItem(HouseSaveTxn.journalKey)]), [84, 84, '12', null]);
      await p.evaluate(() => {
        Storage.prototype.setItem = window.__realSet;
        const id = 'tx-testreset-1';
        const next = { ...defaultState(), saveTxn: id };
        localStorage.setItem(HouseSaveTxn.journalKey, JSON.stringify({ v: 1, id, next }));
        localStorage.removeItem('oc_best'); // 模拟清档中途退出
      });
      await p.reload();
      await p.locator('.droom').first().waitFor({ state: 'attached' });
      assert.deepEqual(await p.evaluate(() => [S.stardust, localStorage.getItem('oc_best'), localStorage.getItem(HouseSaveTxn.journalKey)]), [20, null, null]);
    } finally { await c.close(); }
  });
  await test('failed reward commit keeps queued runs for reload and pays once', async () => {
    const c = await browser.newContext({ reducedMotion: 'reduce' }); const p = await c.newPage(); observe(p, 'reward-recovery');
    try {
      await boot(p);
      const initial = await p.evaluate(() => {
        S.quests = Object.fromEntries(QUESTS.map(q => [q.id, true])); S.achv = Object.fromEntries(ACHV.map(a => [a.id, true]));
        S.stats.lastDay = new Date().getFullYear() + '-' + (new Date().getMonth() + 1) + '-' + new Date().getDate();
        S.stats.playDay = ''; S.stats.playSd = 0; save();
        HouseRuns.enqueue('mm', 3000, 'recovery-run', 0, Date.now());
        window.__realSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k,v) { if (k === SAVE_KEY) throw new DOMException('full','QuotaExceededError'); return window.__realSet.call(this,k,v); };
        const old = JSON.parse(localStorage.getItem(SAVE_KEY)).stardust;
        cashPlays();
        return { old, pending: !!localStorage.getItem(HouseRuns.prefix + 'recovery-run'), unsaved: saveFail };
      });
      assert.equal(initial.pending, true); assert.equal(initial.unsaved, true);
      await p.evaluate(() => { Storage.prototype.setItem = window.__realSet; });
      await p.reload(); await boot(p);
      assert.deepEqual(await p.evaluate(() => ({ balance:S.stardust, queued:localStorage.getItem(HouseRuns.prefix + 'recovery-run'), runs:S.runs.filter(x => x === 'recovery-run').length })), { balance: initial.old + 6, queued:null, runs:1 });
      await p.reload(); await boot(p);
      assert.equal(await p.evaluate(() => S.stardust), initial.old + 6);
    } finally { await c.close(); }
  });
  await test('separate game tabs keep both rewards and the next house tab reads the committed balance', async () => {
    const c = await browser.newContext({ reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'first-house');
    const second = await c.newPage(); observe(second, 'second-house');
    const stars = await c.newPage(); observe(stars, 'parallel-stars');
    const flies = await c.newPage(); observe(flies, 'parallel-fireflies');
    try {
      await boot(p);
      await second.goto(base + encodeURI('/我的家.html'));
      await second.waitForFunction(() => document.getElementById('boot-enter').textContent.includes('另一标签页'));
      await Promise.all([
        stars.goto(base + encodeURI('/阳台/星图.html')),
        flies.goto(base + encodeURI('/阳台/捕萤.html'))
      ]);
      const baseline = await p.evaluate(() => {
        for (const a of ACHV) S.achv[a.id] = 1;
        for (const q of QUESTS) S.quests[q.id] = true;
        S.wish.idx = WISHES.length;
        return S.stardust;
      });
      // Use the games' real settlement handlers with deterministic score fixtures.
      const keys = await Promise.all([
        stars.evaluate(() => { nightStart(); score = 2200; nightEnd(); return HouseRuns.prefix + runId; }),
        flies.evaluate(() => { start(); score = 20; end(); return HouseRuns.prefix + runId; })
      ]);
      await p.waitForFunction(keys => keys.every(key => localStorage.getItem(key) !== null), keys);
      assert.equal(await p.evaluate(() => HouseRuns.keys(localStorage).length), 2);
      assert.equal(await p.evaluate(() => { cashPlays(); return S.stardust; }), baseline + 12);
      await p.close();
      await enterHouse(second);
      assert.deepEqual(await second.evaluate(() => [S.stardust, HouseRuns.keys(localStorage).length]), [baseline + 12, 0]);
    } finally { await c.close(); }
  });
  await test('interrupted cleanup of a 45-run queue resumes without losing or paying any run twice', async () => {
    const c = await browser.newContext({ reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'large-queue-recovery');
    try {
      await boot(p);
      const baseline = await p.evaluate(() => {
        const balance = S.stardust;
        for (let i = 0; i < 45; i++) HouseRuns.enqueue('fy', 1, 'batch-' + String(i).padStart(2, '0'), 0, 0);
        const remove = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function(key) {
          if (key === HouseRuns.prefix + 'batch-03') throw new DOMException('interrupted', 'SecurityError');
          return remove.call(this, key);
        };
        try { cashPlays(); } finally { Storage.prototype.removeItem = remove; }
        return balance;
      });
      assert.deepEqual(await p.evaluate(() => [S.stardust, HouseRuns.keys(localStorage).length]), [baseline + 30, 42]);
      await boot(p);
      assert.deepEqual(await p.evaluate(() => [S.stardust, HouseRuns.keys(localStorage).length, S.runs.length]), [baseline + 45, 0, 40]);
    } finally { await c.close(); }
  });
  await test('quota-exceeded write surfaces unsaved label, export shortcut, then recovers', async () => {
    await page.evaluate(() => {
      window.__realSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'zhouse_deluxe_v1') throw new DOMException('full', 'QuotaExceededError'); return window.__realSet.call(this, k, v); };
      document.getElementById('toasts').replaceChildren();
      setStardust(55);
    });
    assert.match(await page.evaluate(() => document.getElementById('title-save').innerText), /暂未保存/);
    assert.match(await page.evaluate(() => document.getElementById('toasts').innerText), /暂未保存/);
    await page.evaluate(() => document.getElementById('title-save').click());
    assert.ok(await page.evaluate(() => document.getElementById('modal-mask').classList.contains('open') && document.querySelector('#m-body textarea')));
    await page.locator('#m-close').click();
    await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; setStardust(56); });
    assert.match(await page.evaluate(() => document.getElementById('title-save').innerText), /自动存档/);
    assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY) && JSON.parse(localStorage.getItem(SAVE_KEY)).stardust), 56);
  });
  await test('modal keyboard: focus enters and is trapped, Tab wraps, Esc restores opener', async () => {
    await page.evaluate(() => showShop());
    const inModal = () => page.evaluate(() => document.getElementById('modal-box').contains(document.activeElement));
    assert.ok(await inModal(), 'opening moves focus into the dialog');
    assert.equal(await page.evaluate(() => document.getElementById('modal-box').getAttribute('role')), 'dialog');
    assert.equal(await page.evaluate(() => document.getElementById('modal-box').getAttribute('aria-modal')), 'true');
    assert.ok(await page.evaluate(() => (document.getElementById('modal-box').getAttribute('aria-label') || '').length > 0));
    for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
    assert.ok(await inModal(), '30 Tab presses never escape the dialog');
    await page.evaluate(() => document.getElementById('m-close').focus());
    await page.keyboard.press('Tab');
    assert.match(await page.evaluate(() => document.activeElement.className), /stab/, 'Tab wraps from last back to first');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'm-close', 'Shift+Tab wraps from first back to last');
    await page.locator('#m-close').click();
    await page.evaluate(() => document.getElementById('pill-stardust').focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('modal-mask').classList.contains('open'));
    assert.ok(await inModal());
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('modal-mask').classList.contains('open'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'pill-stardust', 'close returns focus to the opener');
  });
  await test('wish chain advances through real conditions, caps at family, wall is a dialog', async () => {
    const result = await page.evaluate(() => {
      const snapshot = JSON.stringify(S);
      S.wish = { idx: 0, rel: 0 }; S.stardust = 100; S.opened = [];
      for (const q of QUESTS) S.quests[q.id] = true;
      for (const a of ACHV) S.achv[a.id] = 1; // 只留心愿奖励，增量可预期
      S.stats.rooms = NROOM; localStorage.setItem('oc_best', '8'); S.stats.rgPlay = 1; S.stats.mmPlay = 1; // 旧八盘存档仍承认第二愿
      checkQuests();
      const advanced = { idx: S.wish.idx, rel: S.wish.rel, stardust: S.stardust };
      showWish();
      const wall = { open: document.getElementById('modal-mask').classList.contains('open'),
        title: document.querySelector('#modal-box h3').textContent,
        role: document.getElementById('modal-box').getAttribute('role'),
        focusIn: document.getElementById('modal-box').contains(document.activeElement) };
      document.getElementById('m-close').click();
      S = JSON.parse(snapshot); S.wish = { idx: 0, rel: 0 }; save(); setStardust(S.stardust);
      localStorage.removeItem('oc_best');
      return { advanced, wall };
    });
    assert.deepEqual(result.advanced, { idx: 4, rel: 4, stardust: 180 }); // 100 + 15+20+20+25，关系封顶「一家人」
    assert.match(result.wall.title, /住户心愿 · 一家人/);
    assert.equal(result.wall.role, 'dialog');
    assert.ok(result.wall.open && result.wall.focusIn, 'wish wall opens as a focus-trapped dialog');
  });
  await test('current wish button routes by keyboard to a recipe, each game, or its locked shop item', async () => {
    const c = await browser.newContext({ reducedMotion: 'reduce' }); const p = await c.newPage(); observe(p, 'wish-routing');
    try {
      await boot(p);
      await p.evaluate(() => { S.wish.idx = 0; S.visited = ['客厅']; showWish(); });
      await p.locator('#wish-continue').focus(); await p.keyboard.press('Enter');
      await p.waitForFunction(() => curRoom === '卧室' && roomOverlay.classList.contains('on'));
      assert.ok(await p.evaluate(() => S.visited.includes('卧室')), 'first wish enters an unvisited room');
      await p.locator('#r-back').click();
      await p.waitForFunction(() => !roomOverlay.classList.contains('on'));
      await p.evaluate(() => { S.wish.idx = 1; S.opened = []; localStorage.removeItem('oc_best'); showWish(); });
      await p.locator('#wish-continue').focus(); await p.keyboard.press('Enter');
      await p.waitForFunction(() => curRoom === '厨房' && roomOverlay.classList.contains('on'));
      assert.equal(await p.evaluate(() => S.wish.idx), 1, 'entering the kitchen alone does not complete the recipe wish');
      await p.locator('#r-inv .inv-slot').filter({ hasText: '番茄炒蛋' }).focus(); await p.keyboard.press('Enter');
      assert.equal(await p.evaluate(() => S.wish.idx), 2, 'opening a real recipe completes the second wish');
      assert.ok(await p.evaluate(() => S.opened.includes('厨房/番茄炒蛋')));
      await p.locator('#frame-back').click();
      await p.waitForFunction(() => !frameWrap.classList.contains('on'));
      await p.locator('#r-back').click();
      await p.waitForFunction(() => !roomOverlay.classList.contains('on'));
      for (const [idx, gate, link] of [
        [2, 'rg', '客厅/节奏地毯.html'], [3, 'mm', '储藏室/翻箱倒柜.html'],
        [4, 'pn', '钢琴房/琴键回响.html'], [5, 'dc', '舞蹈房/追光舞步.html'], [6, 'vo', '歌唱房/气泡和声.html']
      ]) {
        await p.evaluate(({ idx, gate }) => { S.wish.idx = idx; if (!S.owned.includes(gate)) S.owned.push(gate); showWish(); }, { idx, gate });
        await p.locator('#wish-continue').focus(); await p.keyboard.press('Enter');
        await p.waitForFunction(() => frameWrap.classList.contains('on'));
        assert.equal(await p.evaluate(() => roomFrame.getAttribute('src')), link, `wish ${idx} opens its game`);
        assert.ok(await p.evaluate(gate => { const room = Object.keys(ROOMS).find(n => ROOMS[n].items.some(it => it.gate === gate)); const item = ROOMS[room].items.find(it => it.gate === gate); return S.opened.includes(room + '/' + item.name); }, gate), `wish ${idx} records the opened item`);
        await p.locator('#frame-back').click();
        await p.waitForFunction(() => !frameWrap.classList.contains('on'));
      }
      await p.evaluate(() => { S.wish.idx = 4; S.owned = S.owned.filter(x => x !== 'pn'); showWish(); });
      await p.locator('#wish-continue').focus(); await p.keyboard.press('Enter');
      assert.match(await p.locator('#modal-box h3').innerText(), /星尘商城/);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.buy), 'pn', 'locked music wish focuses its shop item');
    } finally { await c.close(); }
  });
  await test('fresh save follows the visible goal from the first room through the welcome finale', async () => {
    const c = await browser.newContext({ reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'fresh-welcome');
    const goal = p.locator('#next-goal');
    const room = p.locator('#room-overlay');
    const game = p.frameLocator('#room-frame');
    const playWish = async () => {
      await goal.press('Enter');
      await p.locator('#wish-continue').press('Enter');
    };
    const leaveRoom = async () => {
      await p.locator('#r-back').click();
      await room.waitFor({ state: 'hidden' });
    };
    const leaveGame = async () => {
      await p.locator('#frame-back').click();
      await p.locator('#frame-wrap').waitFor({ state: 'hidden' });
    };
    const welcome = p.locator('#welcome-action');
    const buy = async (id, first) => {
      await playWish();
      const offer = p.locator('[data-buy="' + id + '"]');
      assert.ok(await offer.evaluate(el => document.activeElement === el));
      const balance = await p.locator('#stardust-num').textContent();
      await p.keyboard.press('Enter');
      await p.locator('#pack-card').waitFor();
      const persisted = await p.evaluate(id => {
        const save = JSON.parse(localStorage.getItem(SAVE_KEY));
        return { owned: save.owned.includes(id), balance: save.stardust };
      }, id);
      assert.deepEqual(persisted, { owned: true, balance: Number(balance) - 45 }, 'ownership and debit survive leaving during the reveal');
      await p.keyboard.press('Tab');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'pack-card');
      await p.keyboard.press('Enter');
      await p.locator('#pack-item').waitFor();
      assert.equal(await p.evaluate(() => document.activeElement.id), 'pack-item');
      await p.keyboard.press('Space');
      await p.locator('#pack-wrap').waitFor({ state: 'hidden' });
      assert.equal(Number(await p.locator('#stardust-num').textContent()), Number(balance) - 45 + (first ? 15 : 0));
      await playWish();
    };
    try {
      await boot(p);
      const visits = await p.evaluate(() => NROOM);
      const seen = new Set();
      for (let i = 0; i < visits; i++) {
        assert.match(await goal.innerText(), new RegExp('认认门 ' + i + '/' + visits));
        await playWish();
        await room.waitFor();
        const name = await p.locator('#r-name').innerText();
        assert.ok(!seen.has(name), 'goal leads to a room not yet visited');
        if (name === '客厅') {
          assert.equal(await p.locator('.welcome-table').count(), 0, 'there is no welcome meal before cooking');
        }
        seen.add(name);
        await leaveRoom();
      }
      assert.match(await goal.innerText(), /学一道家常菜/);
      await playWish();
      await p.locator('#r-inv .inv-slot').filter({ hasText: '番茄炒蛋' }).press('Enter');
      await leaveGame();
      await leaveRoom();
      assert.match(await goal.innerText(), /夜里一首歌/);
      await buy('rg', true);
      await game.locator('#go').click();
      await game.locator('#count3').waitFor({ state: 'hidden' });
      // Advance elapsed song time; the game still runs its ordinary settlement.
      await game.locator('body').evaluate(() => { startT = Date.now() - LEAD - TOTAL_BEATS * BEAT - 1000; });
      await game.locator('#veil:not(.hide)').waitFor();
      await leaveGame();

      assert.match(await goal.innerText(), /旧物各归位/);
      await buy('mm', false);
      await game.locator('#btn-go').click();
      const cards = await game.locator('.card').evaluateAll(nodes => nodes.map(n => [n.dataset.i, n.querySelector('.fa span').textContent]));
      for (const pair of Object.values(Object.groupBy(cards, x => x[1]))) {
        for (const [id] of pair) await game.locator('.card[data-i="' + id + '"]').click();
      }
      await p.waitForFunction(() => HouseRuns.keys(localStorage).some(key => HouseRuns.parse(key, localStorage.getItem(key))?.[0] === 'mm'));
      await leaveGame();
      await readDialogue(p);

      assert.match(await goal.innerText(), /迎新之夜 · 看看客厅/);
      await goal.press('Enter');
      await p.locator('#story-continue').press('Enter');
      await room.waitFor();
      await readDialogue(p);
      await leaveRoom();
      assert.match(await goal.innerText(), /备一顿晚饭/);
      assert.ok(await p.evaluate(() => !S.owned.includes('oc')));
      await goal.press('Enter');
      await p.locator('#story-continue').press('Enter');
      await game.locator('#ovl-btn').waitFor();
      assert.match(await p.locator('#room-frame').getAttribute('src'), /\?shift=welcome$/);
      await leaveGame();
      assert.match(await goal.innerText(), /备一顿晚饭/, 'leaving before cooking preserves the current objective');
      await p.locator('.droom[data-room="厨房"]').press('Enter');
      await room.waitFor();
      assert.ok(await p.locator('#r-scene .ocade').evaluate(el => el.classList.contains('on')));
      await p.locator('#r-inv .inv-slot').filter({ hasText: '胡闹厨房' }).press('Enter');
      await game.locator('#ovl-btn').press('Space');
      await p.waitForFunction(() => roomFrame.contentWindow.running);
      await cookWelcomeDinner(p, game);
      await game.locator('#ovl:not(.hidden)').waitFor();
      assert.equal(await game.locator('#served').innerText(), '3/3');
      assert.equal(await p.evaluate(() => localStorage.getItem('oc_best')), null, 'welcome service preserves timed records');
      const receipt = await p.evaluate(() => HouseRuns.keys(localStorage)
        .map(key => HouseRuns.parse(key, localStorage.getItem(key))).find(run => run?.[0] === 'oc-welcome'));
      assert.equal(receipt?.[1], 3);
      assert.equal(receipt?.[3], 1);
      await p.waitForFunction(() => document.activeElement?.id === 'frame-back');
      await p.keyboard.press('Enter');
      await p.locator('#frame-wrap').waitFor({ state: 'hidden' });
      await leaveRoom();
      assert.match(await goal.innerText(), /布置客厅/);
      await goal.press('Enter');
      await p.locator('#story-continue').press('Enter');
      await welcome.waitFor();
      assert.match(await welcome.innerText(), /布置客厅/);
      assert.deepEqual(await p.locator('.welcome-table .welcome-plate').evaluateAll(plates => plates.map(plate => plate.dataset.dish).sort()), ['rice', 'soup', 'tomato']);
      assert.equal(await p.locator('.story-bird').count(), 0);
      await welcome.press('Enter');
      await p.locator('[data-deco="lamp"]').press('Enter');
      await p.locator('#modal-mask').waitFor({ state: 'hidden' });
      assert.match(await welcome.innerText(), /请小南入座/);
      assert.ok(await welcome.evaluate(button => document.activeElement === button), 'decoration choice focuses the invitation');
      await p.locator('.welcome-lights').waitFor();
      assert.equal(await p.locator('.story-bird').count(), 0, 'seat stays empty until invited');
      await p.keyboard.press('Enter');
      await p.locator('.story-bird').waitFor();
      await p.locator('#dlg .dlg-text').filter({ hasText: '暖灯' }).waitFor();
      await readDialogue(p);
      assert.deepEqual(await p.evaluate(() => [S.story.beat, S.story.deco, S.story.rewarded, !!S.cgs.cg11]), [5, 'lamp', true, true]);
      await p.screenshot({ path: path.join(out, 'welcome-lamp.png') });
      await boot(p);
      assert.deepEqual(await p.evaluate(() => [S.story.beat, S.story.deco, S.story.rewarded, !!S.cgs.cg11]), [5, 'lamp', true, true]);
    } finally { await c.close(); }
  });
  await test('story: dinner requires a fresh complete welcome service or a qualifying timed shift', async () => {
    const result = await page.evaluate(() => {
      const snapshot = JSON.stringify(S);
      for (const q of QUESTS) S.quests[q.id] = true;
      for (const a of ACHV) S.achv[a.id] = 1;
      S.story = { beat: 0, deco: "", kitchenAt: 0, rewarded: false }; S.wish = { idx: WISHES.length, rel: 4 }; S.stardust = 100; S.cgs = {};
      const log = [];
      checkQuests(); // storyAuto → beat1 + 开场对白
      log.push(S.story.beat, dlgOpen()); closeTalk();
      storyRoom("客厅"); // beat1→2 探房对白（记下接愿时刻）
      log.push(S.story.beat, dlgOpen()); closeTalk();
      checkStory(["oc", 99, "oc-old", 1, 1]); // 接愿前的旧班：不认
      log.push(S.story.beat);
      checkStory(["oc-welcome", 3, "oc-welcome-old", 1, 1]);
      checkStory(["oc-welcome", 2, "oc-welcome-short", 1, Date.now()]);
      checkStory(["oc-welcome", 3, "oc-welcome-incomplete", 0, Date.now()]);
      checkStory(["oc", 7, "oc-short", 1, Date.now()]);
      log.push(S.story.beat);
      checkStory(["oc", 8, "oc-x1", 1, Date.now()]); // 接愿后新开的一班：8 盘通关
      log.push(S.story.beat);
      const reward = S.story.rewarded || !!S.cgs.cg11;
      S = JSON.parse(snapshot); save(); setStardust(S.stardust);
      return { log, reward };
    });
    assert.deepEqual(result, { log: [1, true, 2, true, 2, 2, 3], reward: false });
  });
  await test('legacy welcome saves resume the table on mobile, allow cancellation and pay once', async () => {
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce'
    });
    const p = await c.newPage(); observe(p, 'welcome-resume');
    const welcome = p.locator('#welcome-action');
    const table = p.locator('#r-scene .welcome-table');
    const bird = p.locator('#r-scene .story-bird');
    const enterLiving = async () => {
      await p.locator('#next-goal').tap();
      await p.locator('#story-continue').tap();
      await p.waitForFunction(() => document.querySelector('#room-overlay').classList.contains('on') &&
        document.querySelector('#r-name').textContent === '客厅');
      await table.waitFor();
    };
    const seed = (beat, deco) => p.evaluate(({ beat, deco }) => {
      S.story = { beat, deco, kitchenAt: 1, rewarded: false };
      S.story2 = { beat: 0, showAt: 0, set: '', rewarded: false };
      S.wish = { idx: WISH_VOL1, rel: 4 };
      S.quests = Object.fromEntries(QUESTS.map(q => [q.id, true]));
      S.achv = Object.fromEntries(ACHV.map(a => [a.id, 1]));
      delete S.cgs.cg11;
      save();
    }, { beat, deco });
    try {
      await boot(p);
      await seed(3, '');
      await boot(p);
      await enterLiving();
      assert.equal(await p.locator('.welcome-table .welcome-plate').count(), 3);
      await welcome.tap();
      await p.locator('[data-deco="fire"]').tap();
      await p.locator('.welcome-fire').waitFor();
      assert.equal(await p.locator('.welcome-lights').count(), 0);
      assert.ok(await p.evaluate(() => document.querySelector('#room-overlay').scrollWidth <= innerWidth));
      await boot(p);
      await enterLiving();
      await p.locator('.welcome-fire').waitFor();
      assert.match(await welcome.innerText(), /请小南入座/);
      assert.equal(await bird.count(), 0, 'decoration persists without auto-accepting the invitation');

      const before = await p.evaluate(() => S.stardust);
      await welcome.tap();
      await bird.waitFor();
      await p.locator('#dlg .dlg-text').filter({ hasText: '壁炉' }).waitFor();
      await p.keyboard.press('Escape');
      await welcome.waitFor();
      assert.equal(await bird.count(), 0);
      assert.deepEqual(await p.evaluate(() => [S.story.beat, S.story.rewarded, !!S.cgs.cg11, S.stardust]), [4, false, false, before]);
      await welcome.tap();
      await readDialogue(p, 'tap');
      assert.deepEqual(await p.evaluate(() => [S.story.beat, S.story.rewarded, !!S.cgs.cg11, S.stardust]), [5, true, true, before + 30]);
      await bird.waitFor();
      await p.screenshot({ path: path.join(out, 'welcome-mobile-fire.png') });
      await boot(p);
      await enterLiving();
      await bird.waitFor();
      await welcome.waitFor({ state: 'hidden' });
      assert.equal(await p.evaluate(() => S.stardust), before + 30, 're-entering after reload does not pay the reward again');

      await seed(4, 'none');
      await boot(p);
      await enterLiving();
      assert.equal(await p.locator('.welcome-lights, .welcome-fire, .story-bird').count(), 0, 'plain room retains just the meal before invitation');
      await welcome.tap();
      await bird.waitFor();
      await p.locator('#dlg .dlg-text').filter({ hasText: '旧靠垫' }).waitFor();
      await readDialogue(p, 'tap');
      assert.equal(await p.evaluate(() => S.story.deco), 'none');
    } finally { await c.close(); }
  });
  await test('music wing: three rooms on the facade, gated games locked until bought', async () => {
    const rooms = await page.evaluate(() => ['钢琴房', '舞蹈房', '歌唱房'].map(n => !!ROOMS[n] && !!document.querySelector('.droom[data-room="' + n + '"]')));
    assert.deepEqual(rooms, [true, true, true], 'right tower rooms registered and rendered');
    await page.evaluate(() => document.querySelector('.droom[data-room="钢琴房"]').focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction(n => document.querySelector('#r-name').textContent === n && document.querySelector('#room-overlay').classList.contains('on'), '钢琴房');
    const slot = page.locator('.inv-slot').filter({ hasText: '黑白琴房' });
    assert.equal(await slot.count(), 1);
    await slot.click();
    assert.match(await page.locator('#toasts').innerText(), /还锁着/, 'gated game stays locked before purchase');
    await page.waitForFunction(() => !/还锁着/.test(document.getElementById('toasts')?.innerText || ''), null, { timeout: 6000 }).catch(() => {});
    await page.evaluate(() => { S.owned.push('pn'); save(); });
    await page.evaluate(() => AU.init()); // 楼内 BGM 动态压低：开子页让音、关门恢复
    const fullVol = await page.evaluate(() => AU.bgmG.gain.value);
    await slot.click();
    await page.waitForFunction(() => document.querySelector('#frame-wrap').classList.contains('on'));
    const src = await page.evaluate(() => decodeURI(document.getElementById('room-frame').contentWindow.location.pathname));
    const duckVol = await page.evaluate(() => AU.bgmG.gain.value);
    assert.ok(duckVol > 0 && duckVol < fullVol / 3, 'bgm ducks while a child page is open');
    await page.locator('#frame-back').click();
    await page.waitForFunction(() => !document.querySelector('#frame-wrap').classList.contains('on'));
    assert.ok(await page.evaluate(g => Math.abs(AU.bgmG.gain.value - g) < 1e-6, fullVol), 'bgm restored after closing the child page');
    await page.locator('#r-back').click();
    await page.waitForFunction(() => !document.querySelector('#room-overlay').classList.contains('on'));
  });
  await test('wish volume two opens after volume one, completes from music-wing facts', async () => {
    const result = await page.evaluate(() => {
      const snapshot = JSON.stringify(S);
      for (const q of QUESTS) S.quests[q.id] = true;
      for (const a of ACHV) S.achv[a.id] = 1;
      S.wish = { idx: WISH_VOL1, rel: 4 }; S.stardust = 100;
      S.stats.pnPlay = 1; S.stats.dcPlay = 1; S.stats.voPlay = 0;
      checkQuests(); // 开琴达成，开舞待办（顺序链）
      const part = { idx: S.wish.idx, stardust: S.stardust };
      showWish();
      const wall = document.getElementById('m-body').innerText;
      const seen = { divider: wall.includes('卷二 · 乐厢开张'), pn: wall.includes('一支琴曲') };
      document.getElementById('m-close').click();
      S.stats.voPlay = 1; checkQuests();
      const fin = { idx: S.wish.idx, stardust: S.stardust };
      S = JSON.parse(snapshot); save(); setStardust(S.stardust);
      return { part, seen, fin };
    });
    assert.deepEqual(result.part, { idx: 6, stardust: 140 }, 'satisfied wishes settle in order; the unsung one blocks');
    assert.ok(result.seen.divider && result.seen.pn, 'wall shows the volume-two divider and wish');
    assert.deepEqual(result.fin, { idx: 7, stardust: 160 }, 'remaining wishes settle for +20 each');
  });
  await test('chapter two: premiere gates on chapter one plus volume two, counts fresh distinct rehearsals', async () => {
    const result = await page.evaluate(() => {
      const snapshot = JSON.stringify(S);
      for (const q of QUESTS) S.quests[q.id] = true;
      for (const a of ACHV) S.achv[a.id] = 1;
      S.story2 = { beat: 0, showAt: 0, set: '', rewarded: false }; S.stardust = 100; S.cgs = {};
      S.story = { beat: 4, deco: 'lamp', kitchenAt: 0, rewarded: false }; S.wish = { idx: WISH_VOL1, rel: 4 };
      checkQuests();
      const gated = S.story2.beat; // 第一幕未圆满：不启
      S.story.beat = 5; S.wish.idx = WISHES.length;
      checkQuests();
      const started = { beat: S.story2.beat, dlg: dlgOpen(), showAt: S.story2.showAt > 0 };
      closeTalk();
      checkStory2(['pn', 900, 'pn-a', 1, 1]); // 接愿前的旧班：不认
      checkStory2(['pn', 950, 'pn-b', 1, Date.now()]); // 同一支节目只记一次
      const afterPn = { set: S.story2.set, beat: S.story2.beat };
      checkStory2(['pn', 999, 'pn-c', 1, Date.now()]); // 重复同款
      checkStory2(['dc', 2500, 'dc-a', 0, Date.now()]); // 没跳完不算排练
      const stillOne = S.story2.set;
      checkStory2(['dc', 2600, 'dc-b', 1, Date.now()]); // 第二支不同节目
      const ready = { beat: S.story2.beat, set: S.story2.set };
      storyRoom2('厨房'); // 非客厅不开演
      const notYet = dlgOpen();
      storyRoom2('客厅'); // 首演对白（读完放烟花）
      const armed = dlgFull.includes('谱架'); // 首演对白首句记号
      closeTalk(true);
      const fin = { beat: S.story2.beat, cg12: S.cgs.cg12 === true, rewarded: S.story2.rewarded, stardust: S.stardust };
      closeTalk(true); // 重放不再领
      const idem = S.stardust;
      S = JSON.parse(snapshot); save(); setStardust(S.stardust);
      return { gated, started, afterPn, stillOne, ready, notYet, armed, fin, idem };
    });
    assert.equal(result.gated, 0, 'chapter two stays closed before chapter one and volume two complete');
    assert.deepEqual(result.started, { beat: 2, dlg: true, showAt: true }, 'premiere opens with dialogue and a timestamp');
    assert.deepEqual(result.afterPn, { set: 'pn', beat: 2 }, 'stale run ignored; first rehearsal counted');
    assert.equal(result.stillOne, 'pn', 'duplicate program and unfinished runs do not count');
    assert.deepEqual(result.ready, { beat: 3, set: 'pn,dc' }, 'second distinct program arms the premiere');
    assert.equal(result.notYet, false, 'non-living-room entry does not start the show');
    assert.equal(result.armed, true, 'premiere dialogue is on stage');
    assert.deepEqual(result.fin, { beat: 4, cg12: true, rewarded: true, stardust: 130 }, 'finale: beat 4, cg12, +30 once');
    assert.equal(result.idem, 130, 'replayed finale dialogue pays nothing more');
  });
  const seedChapterOne = page => page.evaluate(() => {
    S.story = { beat: 1, deco: '', kitchenAt: 0, rewarded: false };
    S.wish = { idx: WISH_VOL1, rel: 4 };
    save();
  });
  const enterLivingForStory = async page => {
    await page.locator('.droom[data-room="客厅"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('#dlg.on').waitFor();
    await page.waitForFunction(() => document.body.classList.contains('cine'));
  };
  await test('cinematic chapter dialogue: letterbox, caption, pushed camera and ducked score, then restore', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await c.newPage(); observe(p, 'cinematic');
    try {
      await boot(p);
      await seedChapterOne(p);
      await enterLivingForStory(p);
      assert.equal(await p.evaluate(() => document.body.dataset.cine), 'story');
      assert.ok(await p.evaluate(() => document.querySelector('#r-scene').classList.contains('cine')));
      assert.match(await p.locator('.cine-cap').innerText(), /迎新之夜 · 备一顿晚饭/);
      const bars = await p.evaluate(() => [...document.querySelectorAll('.cine-bar')].map(el => Math.round(el.getBoundingClientRect().height)));
      assert.ok(bars.every(h => h >= 20), 'both letterbox bars are on screen');
      await p.waitForTimeout(700);
      const staged = await p.evaluate(() => ({
        ducked: AU.ducked, gain: AU.bgmG.gain.value,
        scale: getComputedStyle(document.getElementById('r-scene')).getPropertyValue('--cam-s').trim()
      }));
      assert.equal(staged.ducked, true, 'chapter dialogue ducks the music bus');
      assert.ok(staged.gain > 0 && staged.gain < 0.2, 'ducked gain is below the normal bed');
      assert.equal(staged.scale, '1.07', 'living-room camera pushes in');
      await p.screenshot({ path: path.join(out, 'cinematic-welcome.png') });
      await readDialogue(p);
      await p.waitForTimeout(900);
      const after = await p.evaluate(() => ({
        cine: document.body.classList.contains('cine'),
        mark: document.body.dataset.cine || '',
        scene: document.getElementById('r-scene').classList.contains('cine'),
        ducked: AU.ducked, gain: AU.bgmG.gain.value,
        barBottom: document.querySelector('.cine-top').getBoundingClientRect().bottom
      }));
      assert.deepEqual([after.cine, after.mark, after.scene, after.ducked], [false, '', false, false]);
      assert.ok(after.gain > 0.25, 'music bed returns after the dialogue');
      assert.ok(after.barBottom <= 1, 'letterbox slides back off screen');
      const chatter = await p.evaluate(() => {
        openTalk();
        const state = [document.body.classList.contains('cine'), AU.ducked];
        closeTalk();
        return state;
      });
      assert.deepEqual(chatter, [false, false], 'ordinary cat chatter stays out of cinematic mode');
    } finally { await c.close(); }
  });
  await test('cinematic layer respects reduced motion: static bars, no camera push or dust', async () => {
    const c = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'cinematic-reduce');
    try {
      await boot(p);
      assert.ok(await p.evaluate(() => document.body.classList.contains('reduce-motion')));
      await seedChapterOne(p);
      await enterLivingForStory(p);
      const state = await p.evaluate(() => {
        const sc = document.getElementById('r-scene');
        return {
          scale: getComputedStyle(sc).getPropertyValue('--cam-s').trim(),
          dust: getComputedStyle(sc.querySelector('.cine-dust')).display,
          artAnim: sc.querySelector('.art').getAnimations().length,
          transition: getComputedStyle(sc.querySelector('.art')).transitionDuration
        };
      });
      assert.deepEqual(state, { scale: '1', dust: 'none', artAnim: 0, transition: '0.01s' });
      assert.match(await p.locator('.cine-cap').innerText(), /迎新之夜/);
      await readDialogue(p);
      assert.ok(await p.evaluate(() => !document.body.classList.contains('cine')));
    } finally { await c.close(); }
  });
  await test('cinematic fits a 390px screen without covering the dialogue', async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const p = await c.newPage(); observe(p, 'cinematic-mobile');
    try {
      await boot(p);
      await seedChapterOne(p);
      await p.evaluate(() => enterRoom('客厅', innerWidth / 2, innerHeight / 2));
      await p.locator('#dlg.on').waitFor();
      await p.waitForFunction(() => document.body.classList.contains('cine'));
      await p.waitForTimeout(1100); // 让开场黑场散尽，再量真实布局
      const fit = await p.evaluate(() => {
        const dlg = document.querySelector('#dlg').getBoundingClientRect();
        const bar = document.querySelector('.cine-bottom').getBoundingClientRect();
        const toasts = [...document.querySelectorAll('#toasts .toast')].map(el => el.getBoundingClientRect());
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          dlgTop: Math.round(dlg.top), dlgBottom: Math.round(dlg.bottom),
          barTop: Math.round(bar.top), vh: innerHeight,
          overlap: toasts.some(a => !(a.right < dlg.left || a.left > dlg.right || a.bottom < dlg.top || a.top > dlg.bottom))
        };
      });
      assert.equal(fit.overflow, false, 'no horizontal overflow while the letterbox is open');
      assert.ok(fit.dlgTop > 0 && fit.dlgBottom <= fit.barTop + 1, 'dialogue stays above the lower bar');
      assert.ok(fit.barTop > fit.vh * .8, 'lower bar stays near the bottom edge');
      assert.equal(fit.overlap, false, 'toasts move clear of the cinematic dialogue');
      await p.screenshot({ path: path.join(out, 'cinematic-mobile.png') });
      await readDialogue(p, 'tap');
    } finally { await c.close(); }
  });
  await test('roof: lifted by default, ghost attic routes to renovation, choice persists', async () => {
    assert.ok(await page.evaluate(() => document.getElementById('dhouse').classList.contains('lfd')), 'roof open by default');
    assert.ok(await page.evaluate(() => !!document.querySelector('.droom.ghost[data-room="阁楼"]')), 'ghost attic rendered above floor two');
    const spot = await page.evaluate(() => { const b = document.querySelector('.droom.ghost .dbk'); const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), at: (dollRoomAt(r.x + r.width / 2, r.y + r.height / 2) || {}).name }; });
    assert.equal(spot.at, '阁楼', 'spot projects onto the attic box');
    await page.mouse.click(spot.x, spot.y);
    await page.waitForFunction(() => document.getElementById('modal-mask').classList.contains('open'));
    assert.match(await page.locator('#modal-box h3').innerText(), /装修队 · 阁楼/, 'ghost click opens the renovation offer');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('modal-mask').classList.contains('on'));
    await page.locator('#d-roof').click();
    assert.equal(await page.evaluate(() => document.getElementById('dhouse').classList.contains('lfd')), false, 'button closes the roof');
    await page.reload();
    await boot(page);
    assert.equal(await page.evaluate(() => document.getElementById('dhouse').classList.contains('lfd')), false, 'closed choice survives reload');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.droom').length), 11, 'ghost hidden but still counted');
    await page.locator('#d-roof').click();
    assert.ok(await page.evaluate(() => document.getElementById('dhouse').classList.contains('lfd')), 'reopen works');
    await page.evaluate(() => { S.settings.roofOpen = true; save(); });
  });
  await test('title screen: Tab focus + Enter opens the gallery modal, Esc restores the button', async () => {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'title-keyboard');
    try {
      await p.goto(base + encodeURI('/我的家.html'));
      await p.locator('#screen-boot').click();
      await p.locator('#screen-boot.clickable').click();
      await p.waitForFunction(() => document.body.dataset.screen === 'title');
      await p.evaluate(() => document.getElementById('t-gallery').focus());
      await p.keyboard.press('Enter');
      await p.waitForFunction(() => document.getElementById('modal-mask').classList.contains('open'));
      assert.equal(await p.evaluate(() => document.querySelector('#modal-box h3').textContent), '陈列馆');
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => !document.getElementById('modal-mask').classList.contains('open'));
      assert.equal(await p.evaluate(() => document.activeElement.id), 't-gallery', 'focus returns to the title button');
    } finally { await c.close(); }
  });
  await test('all sixteen embedded HTML pages load, parent return closes frame', async () => {
    const files = fs.readdirSync(root, { withFileTypes: true }).filter(x => x.isDirectory() && !x.name.startsWith('.')).flatMap(d => fs.readdirSync(path.join(root, d.name)).filter(n => n.endsWith('.html')).map(n => d.name + '/' + n));
    for (const file of files) {
      await page.evaluate(link => openRoomPage(link, 500, 400), file);
      await page.waitForFunction(() => document.querySelector('#frame-wrap').classList.contains('on'));
      const frame = await page.locator('#room-frame').contentFrame();
      await frame.locator('body').waitFor();
      await page.waitForFunction(file => { const f = document.querySelector('#room-frame'); return f.contentDocument?.readyState === 'complete' && decodeURI(f.contentWindow.location.pathname).endsWith(file); }, file);
      const extraHomes = await page.evaluate(() => { const d = document.querySelector('#room-frame').contentDocument; return [...d.querySelectorAll('#game-home')].filter(el => getComputedStyle(el).visibility !== 'hidden').length; });
      assert.equal(extraHomes, 0, file + ' keeps only the parent return button when embedded');
      await page.locator('#frame-back').click();
      await page.waitForFunction(() => !document.querySelector('#frame-wrap').classList.contains('on'));
    }
    return { pages: files.length };
  });
  await test('desktop screenshot and layout bounds', async () => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'house-desktop.png') });
  });
  await test('desktop frame timing smoke sample', async () => {
    const samples = await page.evaluate(() => new Promise(resolve => { const a = []; let last; function tick(t) { if (last) a.push(t - last); last = t; if (a.length === 120) resolve(a); else requestAnimationFrame(tick); } requestAnimationFrame(tick); }));
    samples.sort((a, b) => a - b);
    return { frames: samples.length, medianMs: samples[60], p95Ms: samples[114], maxMs: samples[119], note: 'Headless local smoke sample, not a hardware performance certification.' };
  });
  for (const seed of ['{broken', JSON.stringify({ stardust: 1, stats: {}, opened: {} })]) {
    await test('corrupt persisted save recovers safely: ' + seed.slice(0, 25), async () => {
      const c = await browser.newContext(); await c.addInitScript(value => localStorage.setItem('zhouse_deluxe_v1', value), seed);
      const p = await c.newPage(); observe(p, 'corrupt-save');
      try { await p.goto(base + encodeURI('/我的家.html')); await p.locator('.droom').first().waitFor({ state: 'attached' }); assert.equal(await p.evaluate(() => S.stardust), 20); assert.equal(await p.locator('.droom').count(), 11); }
      finally { await c.close(); }
    });
  }
  await test('storage denied still permits house entry and an explicitly house-only backup', async () => {
    const c = await browser.newContext(); await c.addInitScript(() => { Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = () => { throw new DOMException('denied', 'SecurityError'); }; });
    const p = await c.newPage(); observe(p, 'storage-denied');
    try {
      await boot(p); assert.equal(await p.locator('.droom').count(), 11);
      await p.evaluate(() => showSettings()); await p.locator('#exp-save').click();
      const backup = JSON.parse(Buffer.from(await p.locator('#m-body textarea').inputValue(), 'base64').toString('utf8'));
      assert.deepEqual([backup.format, backup.version, backup.scope, Object.keys(backup.ext).length], ['zhouse', 3, 'house', 0]);
      assert.match(await p.locator('#modal-box').innerText(), /仅主屋进度可备份/);
      const c2 = await browser.newContext(); const p2 = await c2.newPage(); observe(p2, 'house-only-import');
      try {
        await boot(p2); await p2.evaluate(() => localStorage.setItem('oc_best', '17'));
        await importSave(p2, backup);
        assert.equal(await p2.evaluate(() => localStorage.getItem('oc_best')), null);
        assert.equal(await p2.evaluate(() => S.stardust), backup.house.stardust);
        assert.match(await p2.locator('#toasts').innerText(), /仅主屋备份/);
      } finally { await c2.close(); }
    } finally { await c.close(); }
  });
  await test('390px mobile touch entry, shop and layout', async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'mobile');
    try {
      await boot(p);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.locator('#pill-stardust').tap(); await p.locator('#m-close').tap();
      const hit = await p.evaluate(() => { const b = dstage.getBoundingClientRect(); for (let y = Math.max(0,b.top); y < Math.min(innerHeight,b.bottom); y += 7) for (let x = Math.max(0,b.left); x < Math.min(innerWidth,b.right); x += 7) { const el = document.elementFromPoint(x,y), room = dollRoomAt(x,y); if (room && el?.closest('#dstage') && !el.closest('.drf,.dchm,.dwin')) return { x, y, name: room.name }; } });
      assert.ok(hit); await p.touchscreen.tap(hit.x, hit.y);
      await p.waitForFunction(n => document.querySelector('#r-name').textContent === n && document.querySelector('#room-overlay').classList.contains('on'), hit.name);
      await p.locator('#r-back').tap(); await p.waitForFunction(() => !document.querySelector('#room-overlay').classList.contains('on'));
      await p.screenshot({ path: path.join(out, 'house-mobile.png') });
    } finally { await c.close(); }
  });
  await test('file URL entry works without a web server', async () => {
    const p = await ctx.newPage(); observe(p, 'file-url');
    try { await p.goto(pathToFileURL(path.join(root, '我的家.html')).href); await p.locator('.droom').first().waitFor({ state: 'attached' }); assert.equal(await p.locator('.droom').count(), 11); } finally { await p.close(); }
  });
  /* ---- 舞台剧本（3A 三阶段 · 叙事与演出纵深）：名牌、表演、字幕与跳过规则、首演舞台 ---- */
  const stageSeed = (p, story, story2) => p.evaluate(({ story, story2 }) => {
    S.story = { kitchenAt: 1, rewarded: false, deco: '', ...story };
    S.story2 = { beat: 0, showAt: 0, set: '', rewarded: false, ...story2 };
    S.wish = { idx: WISH_VOL1, rel: 4 };
    S.quests = Object.fromEntries(QUESTS.map(q => [q.id, true]));
    S.achv = Object.fromEntries(ACHV.map(a => [a.id, 1]));
    delete S.cgs.cg11; delete S.cgs.cg12;
    if (S.story.rewarded) S.cgs.cg11 = true;
    save();
  }, { story, story2 });
  const enterLivingStage = async p => {
    await p.evaluate(() => enterRoom('客厅', innerWidth / 2, innerHeight / 2));
    await p.locator('#room-overlay.on').waitFor();
  };
  const stageLine = p => p.evaluate(() => {
    const d = document.getElementById('dlg'), b = document.querySelector('#r-scene .story-bird'), c = document.querySelector('#r-scene .story-cat');
    const cls = el => el ? [...el.classList].filter(x => /^(speaking|listening|talking)$/.test(x)).sort().join('+') : null;
    return {
      who: d.querySelector('.dlg-ava').dataset.who, name: d.querySelector('.stage-name').textContent,
      narr: d.classList.contains('narr'), ava: getComputedStyle(d.querySelector('.dlg-ava')).display !== 'none',
      kind: d.querySelector('.dlg-ava svg')?.getAttribute('class') || '', text: d.querySelector('.dlg-text').textContent,
      sr: d.querySelector('.stage-sr').textContent, ctl: getComputedStyle(d.querySelector('.stage-ctl')).display,
      emo: b?.dataset.emo || '', bird: cls(b), cat: cls(c), typing: dlgTyping,
    };
  });
  const readStage = async p => { // 减少动画下整句即出：一下回车一句
    const seen = [];
    for (let i = 0; i < 12 && await p.locator('#dlg').isVisible(); i++) {
      await p.waitForTimeout(120); // 等下一帧的表演对位落定
      seen.push(await stageLine(p));
      await p.keyboard.press('Enter');
    }
    await p.locator('#dlg').waitFor({ state: 'hidden' });
    return seen;
  };
  const seatFor = async (p, deco) => { // 布置 → 请小南入座，真实点击与回车
    await p.locator('#welcome-action').click();
    await p.locator('[data-deco="' + deco + '"]').press('Enter');
    await p.locator('#modal-mask').waitFor({ state: 'hidden' });
    await p.keyboard.press('Enter');
    await p.locator('#dlg.on').waitFor();
  };
  await test('stage script: plates, portraits and performance follow each scripted line (lamp)', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'stage-script');
    try {
      await boot(p);
      await stageSeed(p, { beat: 3, deco: '' });
      await enterLivingStage(p);
      await seatFor(p, 'lamp');
      const seen = await readStage(p);
      const script = await p.evaluate(() => Stage.SCENES.seat.lamp);
      assert.deepEqual(seen.map(l => l.who), ['narr', 'bird', 'z', 'cat', 'narr', 'bird', 'cat'], 'seven lines with the scripted speakers');
      assert.deepEqual(seen.map(l => l.name), ['', '小南 · 新住户', 'Z · 住户', '猫 · 室友', '', '小南 · 新住户', '猫 · 室友'], 'name plate names the real speaker');
      assert.deepEqual(seen.map(l => l.ava), [false, true, true, true, false, true, true], 'narration carries no portrait');
      assert.deepEqual(seen.map(l => l.kind), ['', 'ava-bird', '', 'ava-cat', '', 'ava-bird', 'ava-cat'], 'bird and cat get their own portraits');
      assert.deepEqual(seen.map(l => l.text), script.map(l => l.t), 'shown text is the script');
      assert.deepEqual(seen.map(l => l.sr), seen.map((l, i) => l.name ? l.name + '：' + script[i].t : script[i].t), 'screen readers get each whole line once, attributed');
      assert.deepEqual(seen.map(l => l.emo), ['nervous', 'calm', 'calm', 'calm', 'happy', 'shy', 'happy'], 'emotion arc: nervous, at ease, happy, shy, reassured');
      assert.deepEqual(seen.map(l => l.bird), ['', 'speaking', 'listening', 'listening', '', 'speaking', 'listening'], 'bird speaks or listens as scripted');
      assert.deepEqual(seen.map(l => l.cat), ['', 'listening', 'listening', 'speaking', '', 'listening', 'speaking'], 'cat speaks or listens as scripted');
      assert.ok(seen.every(l => l.typing === false), 'reduced motion prints each whole line at once');
      assert.deepEqual(seen.map(l => l.ctl), Array(7).fill('flex'), 'chapter dialogue offers 自动 and 跳过');
      assert.deepEqual(await p.evaluate(() => [S.story.beat, S.story.rewarded, !!S.cgs.cg11, document.activeElement.id, document.body.classList.contains('cine'), Stage.replaying]), [5, true, true, 'r-back', false, '']);
      const chatter = await p.evaluate(() => {
        openTalk();
        return { who: document.querySelector('#dlg .dlg-ava').dataset.who, name: document.querySelector('#dlg .stage-name').textContent, ctl: getComputedStyle(document.querySelector('#dlg .stage-ctl')).display, cine: document.body.classList.contains('cine') };
      });
      assert.deepEqual(chatter, { who: 'z', name: 'Z · 住户', ctl: 'none', cine: false }, 'yard chatter is Z again and hides the stage controls');
    } finally { await c.close(); }
  });
  await test('stage script: fire and plain rooms play their own opening, question and answer', async () => {
    const c = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'stage-branches');
    const texts = {};
    try {
      await boot(p);
      for (const deco of ['fire', 'none']) {
        await p.evaluate(() => { S.story = { beat: 3, deco: '', kitchenAt: 1, rewarded: false }; S.story2 = { beat: 0, showAt: 0, set: '', rewarded: false }; save(); });
        await enterLivingStage(p);
        await seatFor(p, deco);
        const seen = await readStage(p);
        texts[deco] = seen.map(l => l.text);
        assert.deepEqual(texts[deco], (await p.evaluate(d => Stage.SCENES.seat[d], deco)).map(l => l.t), deco + ': plays its own script');
        assert.deepEqual(await p.evaluate(() => [S.story.deco, S.story.beat, S.story.rewarded]), [deco, 5, true]);
      }
      assert.deepEqual([0, 1, 5, 6].map(i => texts.fire[i] === texts.none[i]), [false, false, false, false], 'opening, greeting, question and answer differ per decoration');
      assert.deepEqual([2, 3, 4].map(i => texts.fire[i] === texts.none[i]), [true, true, true], 'the shared middle is identical');
      assert.match(texts.fire[0], /壁炉/); assert.match(texts.none[0], /旧靠垫/);
    } finally { await c.close(); }
  });
  await test('skip rule: first viewing asks twice, counts as read and pays once; a replay skips in one press', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'stage-skip');
    const skip = p.locator('#dlg [data-stage="skip"]');
    const story = () => p.evaluate(() => [S.story.beat, S.story.rewarded, !!S.cgs.cg11, S.stardust]);
    try {
      await boot(p);
      await stageSeed(p, { beat: 3, deco: '' });
      const before = await p.evaluate(() => S.stardust);
      await enterLivingStage(p);
      await seatFor(p, 'lamp');
      await skip.click();
      assert.deepEqual([await skip.innerText(), await p.locator('#dlg').isVisible(), ...(await story())], ['确定跳过', true, 4, false, false, before], 'one press only arms the skip');
      await p.waitForTimeout(2700);
      assert.equal(await skip.innerText(), '跳过', 'arming wears off after 2.5 seconds');
      await skip.click(); await skip.click();
      await p.locator('#dlg').waitFor({ state: 'hidden' });
      assert.deepEqual(await story(), [5, true, true, before + 30], 'skipping counts as reading: the reward is paid exactly once');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'r-back', 'focus lands on the room return button');
      await p.locator('#r-back').click();
      await p.locator('#room-overlay').waitFor({ state: 'hidden' });
      await p.evaluate(() => showHall());
      await p.locator('.cg-card[data-cg="cg11"]').click();
      await p.locator('.cg-view-art[data-cgid="cg11"]').waitFor();
      const replay = p.locator('.stage-replay button');
      assert.equal(await replay.innerText(), '重温对白');
      await replay.click();
      await p.locator('#modal-mask').waitFor({ state: 'hidden' });
      await p.locator('#dlg.on').waitFor();
      const lampOpen = (await p.evaluate(() => Stage.SCENES.seat.lamp))[0].t;
      assert.deepEqual(await p.evaluate(() => [Stage.replaying, document.querySelector('.cine-cap').textContent, document.querySelector('#dlg .dlg-text').textContent, document.querySelector('#r-scene .story-bird')?.dataset.emo, document.activeElement.id, dlgFull]),
        ['story', '迎新之夜 · 重温', lampOpen, 'nervous', 'dlg', lampOpen], 'replay opens in the living room with its own caption and takes keyboard focus');
      assert.equal(await skip.innerText(), '跳过', 'a replay is not guarded');
      await skip.click();
      await p.locator('#dlg').waitFor({ state: 'hidden' });
      assert.deepEqual(await story(), [5, true, true, before + 30], 'replay changes nothing and pays nothing');
      assert.deepEqual(await p.evaluate(() => [Stage.replaying, document.activeElement.id]), ['', 'r-back']);
    } finally { await c.close(); }
  });
  await test('stage controls by keyboard: Tab reaches them and Enter works the focused one', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'stage-keys');
    const auto = p.locator('#dlg [data-stage="auto"]');
    try {
      await boot(p);
      await stageSeed(p, { beat: 3, deco: '' });
      await enterLivingStage(p);
      await seatFor(p, 'lamp');
      const first = (await p.evaluate(() => Stage.SCENES.seat.lamp))[0].t;
      await p.keyboard.press('Tab');
      assert.deepEqual(await p.evaluate(() => [document.activeElement.dataset.stage, document.activeElement.textContent, dlgFull]), ['auto', '自动', first], 'Tab moves from the dialogue to 自动');
      await p.keyboard.press('Enter');
      assert.deepEqual([await auto.getAttribute('aria-pressed'), await auto.innerText(), await p.evaluate(() => dlgFull)], ['true', '自动 · 开', first], 'Enter works the focused control instead of advancing');
      await p.keyboard.press('Tab');
      assert.equal(await p.evaluate(() => document.activeElement.dataset.stage), 'skip');
      await p.keyboard.press('Enter');
      assert.equal(await p.locator('#dlg [data-stage="skip"]').innerText(), '确定跳过');
      await p.keyboard.press('Enter');
      await p.locator('#dlg').waitFor({ state: 'hidden' });
      assert.deepEqual(await p.evaluate(() => [S.story.beat, S.story.rewarded, document.activeElement.id]), [5, true, 'r-back']);
    } finally { await c.close(); }
  });
  await test('auto-advance plays the welcome scene to its finale without input, then switches itself off', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'stage-auto');
    const auto = p.locator('#dlg [data-stage="auto"]');
    try {
      await boot(p);
      await stageSeed(p, { beat: 3, deco: '' });
      const before = await p.evaluate(() => S.stardust);
      await enterLivingStage(p);
      await seatFor(p, 'none');
      await auto.click();
      assert.deepEqual([await auto.innerText(), await auto.getAttribute('aria-pressed'), await p.evaluate(() => document.activeElement.id)], ['自动 · 开', 'true', ''], 'auto is on, and a mouse click hands focus back to the dialogue');
      const total = await p.evaluate(() => Stage.SCENES.seat.none.reduce((ms, l) => ms + 1500 + 65 * l.t.length, 0));
      await p.locator('#dlg').waitFor({ state: 'hidden', timeout: total + 8000 });
      assert.deepEqual(await p.evaluate(() => [S.story.beat, S.story.rewarded, S.stardust, Stage.SCENES.seat.none.length]), [5, true, before + 30, 7], 'all seven lines advanced by the clock and the finale paid once');
      assert.deepEqual([await auto.innerText(), await auto.getAttribute('aria-pressed')], ['自动', 'false'], 'auto does not carry into the next dialogue');
    } finally { await c.close(); }
  });
  await test('normal motion types the line; one press completes it and stops the talking cue', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await c.newPage(); observe(p, 'stage-typing');
    try {
      await boot(p);
      await stageSeed(p, { beat: 3, deco: '' });
      await enterLivingStage(p);
      await seatFor(p, 'fire');
      await p.evaluate(() => typeLine({ who: 'bird', emo: 'shy', t: '测'.repeat(80) }));
      await p.waitForTimeout(220);
      const typing = await stageLine(p);
      assert.deepEqual([typing.typing, typing.name, typing.emo], [true, '小南 · 新住户', 'shy']);
      assert.ok(typing.text.length >= 1 && typing.text.length < 80, 'characters appear one by one');
      assert.match(typing.bird, /talking/);
      await p.keyboard.press('Enter');
      const whole = await stageLine(p);
      assert.deepEqual([whole.typing, whole.text.length, whole.bird, await p.evaluate(() => document.querySelector('.dlg-next').style.visibility)], [false, 80, 'speaking', ''], 'one press completes the line and stops the talking cue');
      await p.keyboard.press('Enter');
      assert.deepEqual(await p.evaluate(() => [dlgFull, dlgTyping]), [(await p.evaluate(() => Stage.SCENES.seat.fire))[1].t, true], 'the next press moves to the next line');
    } finally { await c.close(); }
  });
  await test('premiere stage: stand, spotlight and rehearsed programs; cancel and leave rules match act one', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'stage-premiere');
    const stage = () => p.evaluate(() => {
      const sc = document.getElementById('r-scene'), light = sc.querySelector('.stage-light'), bird = sc.querySelector('.story-bird');
      return { premiere: sc.classList.contains('premiere'), light: light ? getComputedStyle(light).opacity : null,
        spot: [parseFloat(sc.style.getPropertyValue('--spot-x')), parseFloat(sc.style.getPropertyValue('--spot-y'))],
        stand: sc.querySelectorAll('.story-stand').length, table: sc.querySelectorAll('.welcome-table').length,
        bird: bird ? bird.getAttribute('transform') : null };
    });
    const state2 = () => p.evaluate(() => [S.story2.beat, S.story2.rewarded, !!S.cgs.cg12]);
    try {
      await boot(p);
      await stageSeed(p, { beat: 5, deco: 'lamp', rewarded: true }, { beat: 3, set: 'vo,pn', showAt: 1 });
      const before = await p.evaluate(() => S.stardust);
      await enterLivingStage(p);
      await p.locator('#dlg.on').waitFor();
      const lit = await stage();
      assert.deepEqual([lit.premiere, lit.stand, lit.table, lit.bird, lit.light], [true, 1, 0, 'translate(33 -24.5)', '1'], 'dinner table yields to the music stand, the bird mounts it, lights dim to one spotlight');
      assert.ok(lit.spot[0] > 20 && lit.spot[0] < 60 && lit.spot[1] > 30 && lit.spot[1] < 90, 'spotlight is aimed inside the scene: ' + lit.spot);
      assert.match(await p.locator('.cine-cap').innerText(), /首演之夜 · 开演/);
      assert.match(await p.locator('#dlg .dlg-text').innerText(), /谱架/, 'first line keeps the music-stand cue');
      await p.screenshot({ path: path.join(out, 'stage-premiere.png') });
      await p.locator('#r-back').click(); // 对白没读完就走：对白跟着收，不留半截在门厅上空
      await p.locator('#dlg').waitFor({ state: 'hidden' });
      await p.locator('#room-overlay').waitFor({ state: 'hidden' });
      assert.deepEqual([...(await state2()), await p.evaluate(() => document.body.classList.contains('cine'))], [3, false, false, false], 'leaving cancels cleanly and keeps the show pending');
      await enterLivingStage(p);
      await p.locator('#dlg.on').waitFor();
      await p.keyboard.press('Escape');
      await p.locator('#dlg').waitFor({ state: 'hidden' });
      assert.deepEqual([...(await state2()), await p.evaluate(() => document.activeElement.id), (await stage()).premiere], [3, false, false, 'r-back', false], 'Escape cancels without paying, focus follows and the lights come back');
      await enterLivingStage(p);
      await p.locator('#dlg.on').waitFor();
      const seen = await readStage(p);
      assert.deepEqual(seen.map(l => l.who), ['narr', 'cat', 'narr']);
      assert.deepEqual(seen.map(l => l.emo), ['nervous', 'sing', 'sing']);
      assert.match(seen[2].text, /和声、琴键——哪一样都是这个家练出来的/, 'names the programs actually rehearsed');
      assert.deepEqual([...(await state2()), ...(await p.evaluate(() => [S.stardust, document.activeElement.id]))], [4, true, true, before + 30, 'r-back']);
      await p.waitForFunction(() => !document.getElementById('r-scene').classList.contains('premiere'), null, { timeout: 8000 });
      assert.equal((await stage()).table, 1, 'lights return after the fireworks and dinner is back');
    } finally { await c.close(); }
  });
  await test('subtitle size: three sizes persist, resize dialogue and caption, and fit a 390px screen', async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'stage-subsize');
    const font = () => p.evaluate(() => [getComputedStyle(document.querySelector('#dlg .dlg-text')).fontSize, getComputedStyle(document.querySelector('.cine-cap')).fontSize, document.body.dataset.sub]);
    try {
      await boot(p);
      assert.deepEqual(await font(), ['14.5px', '11px', '0'], 'default is the standard size');
      assert.deepEqual(await p.evaluate(() => {
        const copy = () => JSON.parse(JSON.stringify(S));
        const bad = v => { try { readState({ ...copy(), settings: { ...S.settings, subSize: v } }); return false; } catch (e) { return true; } };
        const ok = v => { try { return readState({ ...copy(), settings: { ...S.settings, subSize: v } }).settings.subSize; } catch (e) { return 'rejected'; } };
        const { subSize, ...older } = S.settings;
        return { bad: [-1, 3, 1.5, '1', null].map(bad), ok: [0, 1, 2].map(ok), legacy: readState({ ...copy(), settings: older }).settings.subSize };
      }), { bad: [true, true, true, true, true], ok: [0, 1, 2], legacy: 0 }, 'save validation rejects out-of-range sizes and defaults older saves');
      for (const [i, px, cap] of [[2, '21px', '15px'], [1, '17.5px', '13px'], [0, '14.5px', '11px']]) {
        await p.evaluate(() => showSettings());
        await p.locator('[data-ss="' + i + '"]').tap();
        assert.deepEqual(await p.locator('[data-ss]').evaluateAll(bs => bs.map(b => [b.textContent, b.getAttribute('aria-pressed'), b.classList.contains('quiet')])), [['标准', String(i === 0), i !== 0], ['大', String(i === 1), i !== 1], ['特大', String(i === 2), i !== 2]], 'size ' + i + ' is the pressed one');
        await p.locator('#m-close').tap();
        assert.deepEqual(await font(), [px, cap, String(i)], 'size ' + i + ' applies to dialogue and caption');
      }
      await p.evaluate(() => showSettings());
      await p.locator('[data-ss="2"]').tap();
      await p.locator('#m-close').tap();
      await p.reload();
      await boot(p);
      assert.deepEqual(await font(), ['21px', '15px', '2'], 'largest size survives a reload');
      await stageSeed(p, { beat: 1 });
      await enterLivingStage(p);
      await p.locator('#dlg.on').waitFor();
      const fit = await p.evaluate(() => {
        const dlg = document.getElementById('dlg').getBoundingClientRect(), bar = document.querySelector('.cine-bottom').getBoundingClientRect();
        const btn = document.querySelector('#dlg [data-stage="skip"]').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, top: Math.round(dlg.top), bottom: Math.round(dlg.bottom), barTop: Math.round(bar.top), vh: innerHeight, btnH: Math.round(btn.height) };
      });
      assert.equal(fit.overflow, false, 'no horizontal overflow with the largest subtitles');
      assert.ok(fit.top > 0 && fit.bottom <= fit.barTop + 1 && fit.barTop > fit.vh * .8, 'dialogue stays on screen above the letterbox: ' + JSON.stringify(fit));
      assert.ok(fit.btnH >= 30, 'touch-sized stage controls');
      await p.screenshot({ path: path.join(out, 'stage-mobile-large.png') });
    } finally { await c.close(); }
  });
  /* ---- 声景与总线（3A 三阶段 · 音频纵深）：四总线、通道分离、逐房间实测响度、音乐状态 ---- */
  const rmsOf = (p, node) => p.evaluate(node => new Promise(resolve => { // 量某个节点送出去的声音
    const an = AU.ctx.createAnalyser(); an.fftSize = 2048; node.connect(an);
    const wave = new Float32Array(an.fftSize), seen = [];
    const iv = setInterval(() => { an.getFloatTimeDomainData(wave); let s = 0; for (const x of wave) s += x * x; seen.push(Math.sqrt(s / wave.length)); }, 40);
    setTimeout(() => { clearInterval(iv); node.disconnect(an); resolve(Math.max(...seen)); }, 520);
  }), node);
  const busGains = p => p.evaluate(() => [AU.sfxG, AU.bgmG, AU.ambG, AU.voG].map(g => +g.gain.value.toFixed(3)));
  await test('audio buses: four gains follow their own toggles and sliders, persist, and are validated', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'audio-buses');
    try {
      await boot(p);
      assert.deepEqual(await busGains(p), [0.5, 0.32, 0.5, 0.5], 'defaults: interaction .5, music .32, ambient .5, dialogue .5');
      assert.deepEqual(await p.evaluate(() => [AU.ctx.state, !!AU.wxG, typeof Ambi.state().key]), ['running', true, 'string'], 'audio runs and the soundscape is on the ambient bus');
      assert.ok(await rmsOf(p, await p.evaluate(() => AU.voG)) === 0, 'dialogue bus is quiet until someone speaks');
      await p.evaluate(() => AU.sfx('click'));
      assert.ok(await rmsOf(p, await p.evaluate(() => AU.voG)) === 0, 'an interaction sound leaves the dialogue bus alone');
      await p.evaluate(() => AU.sfx('type'));
      assert.ok(await rmsOf(p, await p.evaluate(() => AU.voG)) > 0, 'typing blips travel on the dialogue bus');
      await p.evaluate(() => showSettings());
      assert.deepEqual(await p.locator('#m-body [data-vol]').evaluateAll(es => es.map(e => e.dataset.vol)), ['sfxVol', 'bgmVol', 'ambVol', 'voVol'], 'settings expose four volumes');
      await p.locator('[data-set="amb"]').click();
      assert.deepEqual(await busGains(p), [0.5, 0.32, 0, 0.5], 'the ambient toggle touches only the ambient bus');
      await p.locator('[data-set="amb"]').click();
      await p.locator('[data-vol="ambVol"]').fill('0.8');
      await p.locator('[data-vol="voVol"]').fill('0.25');
      assert.deepEqual(await busGains(p), [0.5, 0.32, 0.8, 0.25], 'each slider drives its own bus');
      await p.locator('[data-set="sfx"]').click();
      assert.deepEqual(await busGains(p), [0, 0.32, 0.8, 0], 'sound effects off silences interaction and dialogue blips; music and ambience stay');
      await p.locator('[data-set="sfx"]').click();
      await p.locator('#m-close').click();
      await p.reload(); await boot(p);
      assert.deepEqual(await busGains(p), [0.5, 0.32, 0.8, 0.25], 'all four volumes survive a reload');
      assert.deepEqual(await p.evaluate(() => {
        const withS = o => { try { return readState({ ...JSON.parse(JSON.stringify(S)), settings: { ...S.settings, ...o } }).settings; } catch (e) { return 'rejected'; } };
        const older = readState({ ...JSON.parse(JSON.stringify(S)), settings: { sfx: true, bgm: true, sfxVol: .5, bgmVol: .32, roofOpen: true, shake: false, subSize: 0 } }).settings;
        return { bad: [{ amb: 'yes' }, { ambVol: 1.2 }, { ambVol: -0.1 }, { voVol: 'x' }, { voVol: null }].map(withS), older: [older.amb, older.ambVol, older.voVol] };
      }), { bad: ['rejected', 'rejected', 'rejected', 'rejected', 'rejected'], older: [true, 0.5, 0.5] }, 'out-of-range audio settings are rejected; older saves get the defaults');
    } finally { await c.close(); }
  });
  await test('weather rides the ambient bus: music off keeps the rain, dialogue ducking spares the ambience', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'audio-weather');
    try {
      await boot(p);
      const amb = () => p.evaluate(() => AU.ambG);
      await p.evaluate(() => { S.settings.bgm = false; AU.applyVol(); AU.setWx('none'); });
      await p.waitForTimeout(300);
      const dry = await rmsOf(p, await amb());
      await p.evaluate(() => AU.setWx('rain'));
      await p.waitForTimeout(400);
      const rain = await rmsOf(p, await amb());
      assert.equal((await busGains(p))[1], 0, 'music is off');
      assert.ok(rain > dry * 1.5 && rain > 0.01, 'rain still sounds with music off: ' + dry.toFixed(4) + ' → ' + rain.toFixed(4));
      await p.evaluate(() => { S.settings.amb = false; AU.applyVol(); });
      assert.equal((await busGains(p))[2], 0, 'the ambient switch is what mutes the weather');
      await p.evaluate(() => { S.settings.amb = true; S.settings.bgm = true; AU.applyVol(); AU.setWx('none'); AU.duck(true); });
      await p.waitForTimeout(450);
      const ducked = await busGains(p);
      assert.deepEqual(ducked, [0.5, 0.128, 0.35, 0.5], 'dialogue ducking: music to 40%, ambience only to 70%');
      await p.evaluate(() => AU.duck(false));
      await p.waitForTimeout(450);
      assert.deepEqual(await busGains(p), [0.5, 0.32, 0.5, 0.5], 'both buses return after the dialogue');
    } finally { await c.close(); }
  });
  await test('soundscape follows each room, reacts to hearth, TV and daylight, yields to child pages, and stays a quiet bed', async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p = await c.newPage(); observe(p, 'soundscape');
    const peak = () => p.evaluate(() => new Promise(resolve => { const v = []; const iv = setInterval(() => v.push(Ambi.level()), 50); setTimeout(() => { clearInterval(iv); resolve(+Math.max(...v).toFixed(4)); }, 900); }));
    const where = async () => (await p.evaluate(() => Ambi.state().key)).split('|')[0];
    try {
      await boot(p);
      await p.evaluate(() => { S.renov['rv-loft'] = 1; save(); });
      assert.equal(await where(), '', 'the yard has its own soundscape');
      const levels = {};
      for (const name of ['客厅', '厨房', '卧室', '书房', '阳台', '健身房', '储藏室', '阁楼', '钢琴房', '舞蹈房', '歌唱房']) {
        await p.locator('.droom[data-room="' + name + '"]').focus();
        await p.keyboard.press('Enter');
        await p.locator('#room-overlay.on').waitFor();
        await p.waitForTimeout(1000); // 交叉淡入走完
        const st = await p.evaluate(() => Ambi.state());
        assert.equal(await where(), name, name + ': soundscape switched');
        assert.ok(st.voices > 0, name + ': has voices');
        levels[name] = await peak();
        assert.ok(levels[name] > 0.001 && levels[name] < 0.08, name + ': audible but a bed, not a solo (peak ' + levels[name] + ')');
        if (name === '客厅') {
          await p.evaluate(() => { S.story.beat = 4; S.story.deco = 'fire'; Ambi.update(); });
          await p.waitForTimeout(1100);
          assert.match(await p.evaluate(() => Ambi.state().key), /客厅\|[ndy]\|fire$/, 'a lit hearth joins the living room');
          const hearth = await peak();
          assert.ok(hearth > levels[name] * 1.5, 'the hearth crackles above the room tone: ' + levels[name] + ' → ' + hearth);
          await p.evaluate(() => { S.story.deco = 'lamp'; SCST['客厅'] = { tv: 1 }; Ambi.update(); });
          await p.waitForTimeout(1100);
          assert.match(await p.evaluate(() => Ambi.state().key), /\/tv1$/, 'a switched-on TV joins too');
          await p.evaluate(() => { SCST['客厅'] = {}; S.story = { beat: 0, deco: '', kitchenAt: 0, rewarded: false }; applyPhase('day'); });
          await p.waitForTimeout(1100);
          assert.match(await p.evaluate(() => Ambi.state().key), /^客厅\|y\|$/, 'daylight swaps the night creatures for birds');
          assert.ok((await p.evaluate(() => Ambi.state())).events >= 1, 'birds are scheduled by day');
          await p.evaluate(() => updPhase());
        }
        if (name === '厨房') {
          await p.evaluate(() => openRoomPage('厨房/胡闹厨房.html', 500, 400));
          await p.waitForFunction(() => document.querySelector('#frame-wrap').classList.contains('on'));
          assert.deepEqual(await p.evaluate(() => [Ambi.state().yielding, +Ambi.level().toFixed(5)]), [true, 0], hmm
```
Wait: `Ambi.level()` measures `mix` output (pre yield gain; the yield gain is ON the mix node itself: `mix.gain` → the meter is connected from `mix` output → after the gain ✓ so level drops to ~22%). So assert `Ambi.state().yielding === true` and after close false; and the mix gain: expose in state: add `gain: mix.gain.value` to state for a precise assertion. Let me add `trim: mix ? +mix.gain.value.toFixed(3) : 0` to `Ambi.state()`.

Continue:
```js
          await p.evaluate(() => openRoomPage('厨房/胡闹厨房.html', 500, 400));
          await p.waitForFunction(() => document.querySelector('#frame-wrap').classList.contains('on'));
          await p.waitForTimeout(700);
          assert.ok(await p.evaluate(g => Ambi.state().yielding && Ambi.state().gain < g * .3, TRIM), 'a child page open: the soundscape steps back');
          await p.locator('#frame-back').click();
          await p.waitForFunction(() => !document.querySelector('#frame-wrap').classList.contains('on'));
          await p.waitForTimeout(700);
          assert.ok(await p.evaluate(g => !Ambi.state().yielding && Math.abs(Ambi.state().gain - g) < .05, TRIM), 'closing the child page brings it back');
        }
        await p.locator('#r-back').click();
        await p.locator('#room-overlay').waitFor({ state: 'hidden' });
        await p.waitForTimeout(1000);
        assert.equal(await where(), '', name + ': back in the yard');
      }
      assert.ok(new Set(Object.values(levels)).size >= 8, 'rooms are not one blanket noise: ' + JSON.stringify(levels));
      return { levels };
    } finally { await c.close(); }
  });
  await test('zero browser runtime errors and failed HTTP resources', () => { assert.deepEqual(runtime, []); assert.deepEqual(responses, []); });
}
main().catch(e => { results.push({ name: 'harness', status: 'fail', error: e.stack }); }).finally(async () => {
  const report = { browser: browser ? browser.version() : null, results, runtime, responses, passed: results.filter(x => x.status === 'pass').length, failed: results.filter(x => x.status === 'fail').length };
  fs.writeFileSync(path.join(out, 'house-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, output: out }));
  if (browser) await browser.close(); server.close(); process.exitCode = report.failed ? 1 : 0;
});
