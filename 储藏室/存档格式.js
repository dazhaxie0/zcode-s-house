/* 可移植存档格式。只整理数据，字段内容仍由主屋 readState 校验。 */
(function (root) {
  "use strict";
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const invalid = () => { throw Error("Invalid save format"); };

  function pack(house, ext, scope = "full") {
    if (!record(house) || !record(ext) || !["full", "house"].includes(scope) || (scope === "house" && Object.keys(ext).length)) invalid();
    const main = { ...house };
    delete main.ext;
    return { format: "zhouse", version: 3, scope, house: main, ext: { ...ext } };
  }

  function unpack(payload) {
    if (!record(payload)) invalid();
    if (!own(payload, "format") && !own(payload, "version")) {
      if (payload.v !== undefined && payload.v !== 2) invalid();
      return payload; // 历史导出码是裸 v2 对象；更早的档没有 v。
    }
    if (payload.format !== "zhouse" || payload.version !== 3 ||
        !record(payload.house) || !record(payload.ext) || own(payload.house, "ext") ||
        (payload.scope !== undefined && !["full", "house"].includes(payload.scope)) ||
        (payload.scope === "house" && Object.keys(payload.ext).length)) invalid();
    if (Object.keys(payload).some(key => !["format", "version", "scope", "house", "ext"].includes(key))) invalid();
    return { ...payload.house, ext: { ...payload.ext } };
  }

  function encode(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
    }
    return btoa(chunks.join(""));
  }

  const api = { pack, unpack, encode };
  root.HouseSaveFormat = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(globalThis);
