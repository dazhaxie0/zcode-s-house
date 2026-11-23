'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pack, unpack } = require('./储藏室/存档格式.js');

test('v3 export separates house and subsystem data without changing the source', () => {
  const house = { v: 2, stardust: 42, stats: {}, ext: { oc_best: 'old' } };
  const ext = { oc_best: '9', library_last: '{"b":"book1"}' };
  const portable = pack(house, ext);
  assert.deepEqual(portable, {
    format: 'zhouse', version: 3, scope: 'full',
    house: { v: 2, stardust: 42, stats: {} }, ext
  });
  assert.deepEqual(house.ext, { oc_best: 'old' });
  assert.notEqual(portable.house, house);
  assert.notEqual(portable.ext, ext);
  assert.deepEqual(unpack(JSON.parse(JSON.stringify(portable))), { v: 2, stardust: 42, stats: {}, ext });
});

test('legacy bare v2 and pre-version saves remain importable', () => {
  const v2 = { v: 2, stardust: 3, stats: {}, ext: { oc_best: '5' } };
  const old = { stardust: 3, stats: {} };
  assert.equal(unpack(v2), v2);
  assert.equal(unpack(old), old);
});

test('house-only emergency export declares its limited scope', () => {
  const partial = pack({ v: 2, stardust: 55, stats: {}, ext: { oc_best: 'stale' } }, {}, 'house');
  assert.deepEqual([partial.scope, partial.ext], ['house', {}]);
  assert.deepEqual(unpack(partial), { v: 2, stardust: 55, stats: {}, ext: {} });
  assert.throws(() => pack({}, { oc_best: '1' }, 'house'), /Invalid save format/);
});

test('malformed or future envelopes are rejected before readState', () => {
  const valid = pack({ v: 2, stardust: 3, stats: {} }, {});
  const invalid = [null, [], 'x', { ...valid, version: 4 },
    { ...valid, format: 'other' }, { ...valid, house: [] }, { ...valid, ext: null },
    { ...valid, house: { ...valid.house, ext: {} } }, { ...valid, extra: true },
    { ...valid, version: '3' }, { ...valid, ext: [] }, { ...valid, scope: 'games' },
    { ...valid, scope: 'house', ext: { oc_best: '1' } },
    { version: 3, house: {}, ext: {} }, { v: 3, stardust: 3, stats: {} },
    { v: 1, stardust: 3, stats: {} }];
  for (const value of invalid) assert.throws(() => unpack(value), /Invalid save format/);
  for (const value of [null, [], 'x']) assert.throws(() => pack(value, {}), /Invalid save format/);
  for (const value of [null, [], 'x']) assert.throws(() => pack({}, value), /Invalid save format/);
});
