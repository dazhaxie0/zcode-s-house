'use strict';
// Runs the actual inline save decoder without a browser or third-party packages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const HouseRuns = require('./储藏室/结算队列.js');
const html = fs.readFileSync(path.join(__dirname, '我的家.html'), 'utf8');
const source = html.slice(html.indexOf('const SAVE_KEY'), html.indexOf('let S = defaultState();'));
assert.ok(source.includes('function readState(p)'), 'Find the real save decoder');
const context = vm.createContext({ window: { matchMedia: () => ({ matches: false }) }, NROOM: 7, HouseRuns });
vm.runInContext(source + '\nglobalThis.decode = readState; globalThis.defaults = defaultState;', context);
const decode = input => context.decode(input);
const plain = value => JSON.parse(JSON.stringify(value));
const valid = () => plain(context.defaults());

test('legacy saves merge missing settings/equipment and migrate item names', () => {
  const old = { stardust: 42, stats: { talks: 2 }, opened: ['书房/查账本.py'], settings: { bgm: false }, equipped: { theme: 'theme-night' } };
  const result = decode(old);
  assert.equal(result.stardust, 42);
  assert.equal(result.stats.talks, 2);
  assert.equal(result.settings.bgm, false);
  assert.equal(result.settings.sfx, true);
  assert.equal(result.settings.roofOpen, true);
  assert.equal(result.equipped.weather, 'none');
  assert.deepEqual(plain(result.opened), ['书房/查账本']);
  assert.deepEqual(old.opened, ['书房/查账本.py']);
  assert.equal(result.v, 2);
  assert.deepEqual(plain(result.ext), {});
  assert.deepEqual(plain(result.runs), []);
  assert.deepEqual(plain(result.wish), { idx: 0, rel: 0 });
  assert.deepEqual(plain(result.story), { beat: 0, deco: '', kitchenAt: 0, rewarded: false });
  assert.deepEqual(plain(result.story2), { beat: 0, showAt: 0, set: '', rewarded: false });
});

test('full-save fields: version, whitelisted subsystem keys, run-id ring', () => {
  const data = valid();
  assert.equal(data.v, 2);
  data.ext = { oc_best: '9', zh_plays: '[["sg",1,"sg-a",1]]', 'zh_play_v2:pn-a': '["pn",20,"pn-a",1,0]' };
  data.runs = ['a', 'b', 'a'];
  const out = decode(data);
  assert.equal(out.ext.oc_best, '9');
  assert.equal(out.ext['zh_play_v2:pn-a'], data.ext['zh_play_v2:pn-a']);
  assert.throws(() => decode({ ...data, ext: { 'zh_play_v2:pn-b': data.ext['zh_play_v2:pn-a'] } }), /Invalid save/);
  assert.deepEqual(plain(out.runs), ['a', 'b']);
  for (const bad of [{ v: 1 }, { v: '2' }, { ext: [] }, { ext: { hack_key: 'x' } }, { ext: { oc_best: 9 } }, { ext: { oc_best: 'x'.repeat(4001) } }, { saveTxn: 1 }, { saveTxn: 'bad-marker' }, { runs: 'x' }, { runs: [1] },
    { wish: [] }, { wish: { idx: -1 } }, { wish: { idx: 99 } }, { wish: { idx: '1' } }, { wish: { rel: 9 } }, { wish: { rel: null } },
    { story: [] }, { story: { beat: -1 } }, { story: { beat: 6 } }, { story: { beat: '2' } }, { story: { deco: 'lamp!' } }, { story: { deco: 7 } },
    { story2: [] }, { story2: { beat: 5 } }, { story2: { beat: '2' } }, { story2: { showAt: -1 } }, { story2: { set: 'pn,hack' } }, { story2: { rewarded: 1 } }]) {
    assert.throws(() => decode({ ...valid(), ...bad }), /Invalid save/, JSON.stringify(bad));
  }
  const many = valid();
  many.runs = Array.from({ length: 60 }, (_, i) => 'r' + i);
  assert.equal(decode(many).runs.length, 40);
});

test('current save roundtrip preserves progress and settings', () => {
  const data = valid();
  Object.assign(data, { stardust: 92, visited: ['客厅'], opened: ['客厅/电视游戏机'], owned: ['theme-warm', 'cat'], quests: { 'q-boot': true }, cgs: { cg1: true }, renov: { 'rv-loft': 1 } });
  Object.assign(data.stats, { rgPlay: 1, playDay: 'Wed Nov 11 2026', playSd: 14, phases: ['night'] });
  assert.deepEqual(plain(decode(JSON.parse(JSON.stringify(data)))), data);
});

test('reject invalid structure, counters, maps and audio values', () => {
  const cases = [null, [], {}, { stardust: 1, stats: null }];
  for (const value of [NaN, Infinity, -1, '5']) cases.push({ ...valid(), stardust: value });
  for (const key of ['visited', 'opened', 'owned']) {
    for (const value of [{}, null, 'bad', [1]]) cases.push({ ...valid(), [key]: value });
  }
  for (const key of ['quests', 'cgs', 'achv', 'renov', 'settings', 'stats', 'equipped']) {
    for (const value of [[], null, 'bad']) cases.push({ ...valid(), [key]: value });
  }
  for (const key of ['quests', 'cgs', 'achv', 'renov']) cases.push({ ...valid(), [key]: { broken: {} } });
  for (const stats of [{ talks: '2' }, { rooms: -1 }, { phases: {} }, { phases: [2] }, { playSd: Infinity }, { lastDay: 42 }]) cases.push({ ...valid(), stats });
  for (const settings of [{ bgm: 'yes' }, { sfx: 1 }, { reduceMotion: null }, { roofOpen: 'x' }, { roofOpen: 1 }, { sfxVol: -0.1 }, { bgmVol: 1.1 }]) cases.push({ ...valid(), settings });
  for (const equipped of [{ theme: null }, { weather: {} }, { toy: 12 }]) cases.push({ ...valid(), equipped });
  for (const data of cases) assert.throws(() => decode(data), /Invalid save/);
});

test('failed import is atomic and leaves the prior state intact', () => {
  let active = valid(); active.stardust = 123;
  const before = active;
  assert.throws(() => { active = decode({ stardust: 1, stats: {}, opened: {} }); });
  assert.equal(active, before);
  assert.equal(active.stardust, 123);
  assert.ok(Array.isArray(active.opened));
  assert.match(html, /const next = readState\(HouseSaveFormat\.unpack\(p\)\)/);
});

test('corrupt startup returns a complete default state without overwriting the bad backup', () => {
  const loadSource = html.slice(html.indexOf('let S = defaultState();'), html.indexOf('function save()'));
  const sandbox = vm.createContext({
    window: { matchMedia: () => ({ matches: false }) }, NROOM: 7,
    localStorage: { getItem: () => JSON.stringify({ stardust: 999, stats: {}, owned: null }), setItem: () => assert.fail('Do not overwrite corrupt save') },
    SAVE_KEY: 'test', fixStats: () => {}, HouseRuns, HouseSaveTxn: { recover() {} }
  });
  vm.runInContext(source + '\n' + loadSource + '\nloadSave(); globalThis.result = {S, memOnly};', sandbox);
  assert.deepEqual(plain(sandbox.result.S), valid());
  assert.equal(sandbox.result.memOnly, true);
});

test('decoder avoids aliases and normalizes duplicated visits and daily reward cap', () => {
  const data = valid(); data.visited = ['客厅', '客厅']; data.stats.playSd = 100;
  const result = decode(data);
  assert.deepEqual(plain(result.visited), ['客厅']);
  assert.equal(result.stats.playSd, 60);
  result.stats.phases.push('night'); result.owned.push('cat'); result.quests.new = true;
  assert.deepEqual(data.stats.phases, []);
  assert.deepEqual(data.owned, ['theme-warm']);
  assert.deepEqual(data.quests, {});
});
