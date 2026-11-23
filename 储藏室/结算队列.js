/* 每局独立落盘：并行标签页不会读改写同一个结算数组。 */
(function (root) {
  "use strict";
  const prefix = "zh_play_v2:";
  const games = new Set(["rg", "oc", "oc-welcome", "fy", "sg", "hz", "mm", "pn", "dc", "vo", "snake", "2048", "brick", "mole", "rpg"]);
  const validId = id => typeof id === "string" && /^[a-z0-9_-]{1,160}$/i.test(id);
  const isKey = key => typeof key === "string" && key.startsWith(prefix) && validId(key.slice(prefix.length));
  const keys = storage => Object.keys(storage).filter(isKey).sort();
  let sequence = 0;
  function newId(game) {
    const random = root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const tag = /^[a-z0-9]{1,20}$/i.test(game) ? game : "run";
    return tag + "-" + Date.now().toString(36) + "-" + (++sequence).toString(36) + "-" + random;
  }
  function enqueue(game, score, runId, completed, started) {
    if (!games.has(game) || !Number.isFinite(score) || score < 0 || (completed !== 0 && completed !== 1)) return false;
    const id = validId(runId) ? runId : newId(game);
    const at = Number.isSafeInteger(started) && started > 0 ? started : 0;
    const key = prefix + id;
    try {
      if (root.localStorage.getItem(key) !== null) return true; // 同一局重复结算保留第一笔
      root.localStorage.setItem(key, JSON.stringify([game, score, id, completed, at]));
      return true;
    } catch (e) { return false; }
  }
  function parse(key, raw) {
    try {
      const p = JSON.parse(raw);
      if (isKey(key) && Array.isArray(p) && p.length === 5 && games.has(p[0]) && Number.isFinite(p[1]) && p[1] >= 0 &&
          prefix + p[2] === key && typeof p[2] === "string" && (p[3] === 0 || p[3] === 1) && Number.isSafeInteger(p[4]) && p[4] >= 0) return p;
    } catch {}
    return null;
  }

  // Persist IDs before copying an old queue. A restart can repeat the copy without making new runs.
  function migrateLegacy(storage) {
    let raw = storage.getItem("zh_plays");
    if (!raw) return;
    let list;
    try { list = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(list)) return;
    const runs = [];
    for (const p of list) {
      if (!Array.isArray(p) || !games.has(p[0]) || !Number.isFinite(p[1]) || p[1] < 0) continue;
      if (p.length === 2) runs.push([p[0], p[1], newId(p[0]), 0, 0]);
      else if (validId(p[2]) && (p[3] === 0 || p[3] === 1)) runs.push([p[0], p[1], p[2], p[3], Number.isSafeInteger(p[4]) && p[4] >= 0 ? p[4] : 0]);
    }
    const canonical = JSON.stringify(runs);
    if (canonical !== raw) storage.setItem("zh_plays", canonical);
    for (const run of runs) {
      const key = prefix + run[2];
      if (storage.getItem(key) === null) storage.setItem(key, JSON.stringify(run));
    }
    if (storage.getItem("zh_plays") !== canonical) throw Error("queue changed");
    storage.removeItem("zh_plays");
  }

  // Receipts awaiting deletion must be acknowledged before newer batches can evict their IDs.
  function drain(storage, recent, commit) {
    migrateLegacy(storage);
    const acknowledged = [], pending = [];
    const ids = new Set(recent);
    for (const key of keys(storage)) {
      const run = parse(key, storage.getItem(key));
      if (run) (ids.has(run[2]) ? acknowledged : pending).push(run);
    }
    for (const batch of [acknowledged, pending]) {
      for (let start = 0; start < batch.length; start += 30) {
        const part = batch.slice(start, start + 30);
        if (!commit(part)) return;
        for (const run of part) storage.removeItem(prefix + run[2]);
      }
    }
  }
  const api = { enqueue, prefix, newId, keys, isKey, parse, drain };
  root.HouseRuns = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
