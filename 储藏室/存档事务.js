/* 主屋跨键存档事务：先记意图，再写子档和主档；启动时重放未提交的意图。 */
window.HouseSaveTxn = (() => {
  const KEY = "zhouse_save_journal_v1";
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function snapshot(storage, keys) {
    const out = {};
    for (const key of keys) {
      const value = storage.getItem(key);
      if (value !== null) out[key] = value;
    }
    return out;
  }
  function writeExt(storage, keys, values) {
    for (const key of keys) {
      if (has(values, key)) storage.setItem(key, values[key]);
      else storage.removeItem(key);
    }
  }
  function commit(storage, mainKey, keys, next) {
    let open;
    try { open = storage.getItem(KEY); } catch (e) { throw Error("storage"); }
    if (open) {
      let committed = false;
      try {
        const journal = JSON.parse(open);
        const main = JSON.parse(storage.getItem(mainKey));
        committed = !!main && main.saveTxn === journal.id;
      } catch (e) {}
      if (!committed) throw Error("pending"); // 避免新操作覆盖尚待重放的事务
    }
    let beforeMain, beforeExt, runKeys;
    try {
      runKeys = [...new Set([...HouseRuns.keys(storage), ...Object.keys(next.ext).filter(HouseRuns.isKey)])];
      keys = keys.concat(runKeys);
      beforeMain = storage.getItem(mainKey);
      beforeExt = snapshot(storage, keys);
    } catch (e) { throw Error("storage"); }
    const id = "tx-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    const saved = { ...next, saveTxn: id };
    try { storage.setItem(KEY, JSON.stringify({ v: 1, id, next: saved, runKeys })); }
    catch (e) { throw Error("storage"); }
    try {
      writeExt(storage, keys, saved.ext);
      storage.setItem(mainKey, JSON.stringify({ ...saved, ext: {} }));
    } catch (e) {
      try {
        writeExt(storage, keys, beforeExt);
        if (beforeMain === null) storage.removeItem(mainKey);
        else storage.setItem(mainKey, beforeMain);
        storage.removeItem(KEY);
      } catch (rollbackError) { throw Error("pending"); }
      throw Error("storage");
    }
    // 清理失败也安全：主档带着事务号，重启时识别为已提交，不会重放旧子档。
    try { storage.removeItem(KEY); } catch (e) {}
    return { ...saved, ext: {} };
  }
  function recover(storage, mainKey, keys, validate) {
    const raw = storage.getItem(KEY);
    if (!raw) return false;
    const journal = JSON.parse(raw);
    if (!journal || journal.v !== 1 || typeof journal.id !== "string") throw Error("journal");
    const next = validate(journal.next);
    if (next.saveTxn !== journal.id) throw Error("journal");
    const runKeys = journal.runKeys === undefined ? [] : journal.runKeys;
    if (!Array.isArray(runKeys) || !runKeys.every(HouseRuns.isKey)) throw Error("journal");
    keys = keys.concat(runKeys, Object.keys(next.ext).filter(HouseRuns.isKey));
    let committed = false;
    try {
      const mainRaw = storage.getItem(mainKey);
      committed = !!mainRaw && JSON.parse(mainRaw).saveTxn === journal.id;
    } catch (e) {} // 损坏的主档仍可由事务记录重建
    if (!committed) {
      writeExt(storage, keys, next.ext);
      storage.setItem(mainKey, JSON.stringify({ ...next, ext: {} }));
    }
    try { storage.removeItem(KEY); } catch (e) {}
    return true;
  }
  // Each house holds the writer lock for the lifetime of its in-memory save.
  // Standalone minigames use independent run keys and never request this lock.
  async function openTab(start, waiting) {
    const request = new AbortController();
    let release, started = false;
    const begin = () => { started = true; start(); };
    const hold = () => {
      begin();
      return new Promise(resolve => { release = resolve; });
    };
    addEventListener("pagehide", () => { request.abort(); release?.(); }, { once: true });
    addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
    try {
      const locks = navigator.locks;
      if (!locks) return begin();
      const name = "zhouse-main-save";
      await locks.request(name, { ifAvailable: true }, lock => { if (lock && !request.signal.aborted) return hold(); });
      if (started || request.signal.aborted) return;
      waiting();
      await locks.request(name, { signal: request.signal }, hold);
    } catch (error) {
      if (request.signal.aborted) return;
      if (started) throw error;
      begin(); // Local storage can still work in browsers that deny Web Locks.
    }
  }
  return { commit, recover, openTab, journalKey: KEY };
})();
