'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const recorderKey = 'zhouse_welcome_trial_v1';
const stages = ['rooms', 'recipe', 'rhythm', 'pairs', 'tomato', 'rice', 'soup', 'dinner', 'decor', 'invite', 'complete'];
const children = [];
let browser;
let regularUrl;
let trialUrl;

function startLauncher() {
  const launcher = path.join(__dirname, '迎新试玩.cjs');
  const child = spawn(process.execPath, [launcher], {
    cwd: __dirname, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  return new Promise((resolve, reject) => {
    let output = '';
    let diagnostics = '';
    const timeout = setTimeout(() => reject(Error('试玩入口未启动：' + diagnostics)), 7000);
    child.stderr.on('data', data => { diagnostics += data; });
    child.stdout.on('data', data => {
      output += data;
      const match = output.match(/^http:\/\/127\.0\.0\.1:\d+\/\S+\?trial=welcome\s*$/m);
      if (match) {
        clearTimeout(timeout);
        resolve(new URL(match[0].trim()));
      }
    });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(Error('试玩入口提前退出：' + code + ' ' + diagnostics)); });
  });
}

before(async () => {
  [regularUrl, trialUrl] = await Promise.all([startLauncher(), startLauncher()]);
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
});

after(async () => {
  try {
    await browser?.close();
  } finally {
    await Promise.all(children.map(async child => {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }));
  }
});

async function showTitle(page, url) {
  await page.goto(url.toString());
  await page.locator('.droom').first().waitFor({ state: 'attached' });
  await page.locator('#screen-boot').click();
  await page.locator('#screen-boot.clickable').click();
  await page.locator('#t-start').waitFor();
}

async function enterHouse(page, consent) {
  const click = () => page.locator('#t-start').click();
  if (consent === undefined) {
    await click();
  } else {
    const respond = page.waitForEvent('dialog', { timeout: 5000 }).then(async dialog => {
      const { type, message } = { type: dialog.type(), message: dialog.message() };
      if (consent) await dialog.accept();
      else await dialog.dismiss();
      assert.equal(type, 'confirm');
      assert.match(message, /试玩/);
    });
    await Promise.all([respond, click()]);
  }
  await page.waitForFunction(() => document.body.dataset.screen === 'house');
}

function stored(page) {
  return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), recorderKey);
}

async function waitForStage(page, stage) {
  await page.waitForFunction(({ key, stage }) => {
    return Object.hasOwn(JSON.parse(sessionStorage.getItem(key))?.milestones || {}, stage);
  }, { key: recorderKey, stage });
}

async function downloadReport(page) {
  const dialog = page.locator('#welcome-trial-dialog');
  if (!await dialog.isVisible()) await page.locator('#welcome-trial-launch').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#welcome-trial-export').click(),
  ]);
  const filename = await download.path();
  return JSON.parse(await readFile(filename, 'utf8'));
}

function assertReport(report, outcome) {
  assert.deepEqual(Object.keys(report).sort(), ['activeMs', 'milestones', 'outcome', 'playtest', 'version']);
  assert.equal(report.version, 1);
  assert.equal(report.playtest, 'welcome');
  assert.equal(report.outcome, outcome);
  assert.ok(Number.isInteger(report.activeMs) && report.activeMs >= 0);
  for (const [stage, ms] of Object.entries(report.milestones)) {
    assert.ok(stages.includes(stage), 'Only fixed milestone names may be exported');
    assert.ok(Number.isInteger(ms) && ms >= 0 && ms <= report.activeMs);
  }
}

test('普通入口不收集数据，新试玩端口从空白进度开始，拒绝同意后仍能入屋', { timeout: 30_000 }, async () => {
  assert.notEqual(regularUrl.origin, trialUrl.origin);
  assert.equal(regularUrl.hostname, '127.0.0.1');
  assert.equal(trialUrl.hostname, '127.0.0.1');
  assert.equal(decodeURIComponent(trialUrl.pathname), '/我的家.html');

  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const nearly = new URL(regularUrl);
    nearly.search += '&preview=1';
    let unexpectedDialogs = 0;
    const dismiss = dialog => { unexpectedDialogs++; return dialog.dismiss(); };
    page.on('dialog', dismiss);
    await showTitle(page, nearly);
    await enterHouse(page);
    assert.equal(await page.locator('#welcome-trial-launch').count(), 0);
    assert.equal(await stored(page), null);
    assert.equal(unexpectedDialogs, 0);
    await page.evaluate(() => { S.stardust = 987; save(); });

    page.off('dialog', dismiss);
    await showTitle(page, trialUrl);
    assert.deepEqual(await page.evaluate(() => ({
      entered: S.stats.entered, visited: S.visited.length, story: S.story.beat, stars: S.stardust,
    })), { entered: 0, visited: 0, story: 0, stars: 20 });
    assert.equal(await page.locator('#welcome-trial-launch').count(), 0);
    assert.equal(await stored(page), null);
    await enterHouse(page, false);
    assert.equal(await stored(page), null);
    assert.equal(await page.locator('#welcome-trial-launch').count(), 0);
  } finally {
    await context.close();
  }
});

test('接受同意后可跨刷新续记，真实出餐与入座收尾可导出一份本地记录', { timeout: 60_000 }, async () => {
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
  const observed = [];
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === trialUrl.origin && ['GET', 'HEAD'].includes(request.method())) return route.continue();
    observed.push({ method: request.method(), url: request.url() });
    return route.abort();
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));

  try {
    await showTitle(page, trialUrl);
    await enterHouse(page, true);
    await page.locator('#welcome-trial-launch').waitFor();
    assertReport(await stored(page), 'in-progress');

    // Skip earlier minigames here. Their actual gameplay and completion are tested by house-regression.
    await page.evaluate(() => { S.wish.idx = 2; save(); });
    await waitForStage(page, 'recipe');
    const beforeReload = await stored(page);
    await showTitle(page, trialUrl);
    await enterHouse(page);
    await page.locator('#welcome-trial-launch').waitFor();
    assert.deepEqual((await stored(page)).milestones, beforeReload.milestones);
    assert.ok((await stored(page)).activeMs >= beforeReload.activeMs);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), recorderKey), null);

    // Record the next wish while hidden. The hidden interval must not increase elapsed active time.
    const hidden = await page.evaluate(async key => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      const pausedAt = JSON.parse(sessionStorage.getItem(key)).activeMs;
      await new Promise(resolve => setTimeout(resolve, 100));
      S.wish.idx = 3;
      save();
      const rhythm = JSON.parse(sessionStorage.getItem(key)).milestones.rhythm;
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
      return { pausedAt, rhythm };
    }, recorderKey);
    assert.equal(hidden.rhythm, hidden.pausedAt);

    await page.evaluate(() => {
      S.wish.idx = 4;
      S.story.beat = 2;
      S.story.kitchenAt = Date.now() - 1000;
      save();
    });
    await page.locator('#next-goal').click();
    await page.locator('#story-continue').click();
    const kitchen = page.frameLocator('#room-frame');
    await kitchen.locator('#ovl-btn').click();

    // The parent window may not manufacture a plated dish, even while the kitchen is open.
    await page.evaluate(() => new Promise(resolve => {
      const data = { type: 'zhouse-trial-dish', dish: 'rice' };
      function received(event) {
        if (event.source !== window || event.data?.type !== data.type) return;
        window.removeEventListener('message', received);
        resolve();
      }
      window.addEventListener('message', received);
      window.postMessage(data, '*');
    }));
    assert.equal(Object.hasOwn((await stored(page)).milestones, 'rice'), false);

    // Prepare each dish in the test fixture, then use the real Space action at the serving station.
    for (const dish of ['tomato', 'rice', 'soup']) {
      const board = kitchen.locator('#game');
      await board.evaluate(() => {
        const station = Object.values(stations).find(station => station.type === 'serve');
        P.x = station.x;
        P.y = station.y + 1;
        P.dir = { x: 0, y: -1 };
        hand = { dish: welcomeMenu[served].n };
      });
      await board.press('Space');
      await waitForStage(page, dish);
    }
    await page.locator('#frame-back').click();
    await waitForStage(page, 'dinner');
    await page.locator('#next-goal').click();
    await page.locator('#story-continue').click();
    await page.locator('#welcome-action').click();
    await page.locator('[data-deco="lamp"]').click();
    await waitForStage(page, 'decor');
    await page.locator('#welcome-action').click();
    await waitForStage(page, 'invite');
    const dialogue = page.locator('#dlg');
    for (let i = 0; i < 12 && await dialogue.isVisible(); i++) await dialogue.click();
    await waitForStage(page, 'complete');
    await page.locator('#r-back').click();
    const report = await downloadReport(page);
    assertReport(report, 'completed');
    assert.deepEqual(Object.keys(report.milestones).sort(), stages.slice().sort());
    assert.deepEqual(observed, [], 'Only read-only game requests to the local origin are permitted');
    assert.deepEqual(runtimeErrors, []);
  } finally {
    await context.close();
  }
});

test('浏览器禁用会话存储时仍可入屋、停止并下载当前内存中的记录', { timeout: 30_000 }, async () => {
  const context = await browser.newContext({ acceptDownloads: true });
  try {
    const page = await context.newPage();
    await page.addInitScript(key => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (this === sessionStorage && name === key) throw new DOMException('Blocked for test', 'SecurityError');
        return setItem.call(this, name, value);
      };
    }, recorderKey);
    await showTitle(page, trialUrl);
    await enterHouse(page, true);
    await page.locator('#welcome-trial-launch').click();
    const current = await downloadReport(page);
    assertReport(current, 'in-progress');
    await page.locator('#welcome-trial-stop').click();
    const stopped = await downloadReport(page);
    assertReport(stopped, 'stopped');
    await page.evaluate(() => { S.wish.idx = 4; save(); });
    assert.deepEqual(await downloadReport(page), stopped, 'The stopped record is frozen');
    assert.equal(await stored(page), null);
  } finally {
    await context.close();
  }
});
