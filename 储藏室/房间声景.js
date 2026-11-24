/* 声景：按房间铺底的环境声。全部现场合成，不带音频文件，离线单文件夹照用。
   挂在主屋的环境总线 AU.ambG 上——开关、音量、对白压低都归总线管，这里只管「哪个房间响什么」。
     Ambi.room(name)  进房；回门厅传 null
     Ambi.update()    昼夜、壁炉、电视变了之后重算
     Ambi.yield(on)   子页开玩时让路
   换房间、换状态都是交叉淡入淡出，不硬切。
   自动化只验得出通道与响度；好不好听，得人耳朵说了算。 */
const Ambi = (() => {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const FADE = .9, TICK = 200, TRIM = 1.5; // TRIM：整套声景在总线音量之前的总增益
  let mix = null, meter = null, wave = null, cur = null, timer = 0, room = null, yielding = false;

  const phase = () => document.body.dataset.phase;
  const hearth = () => room === "客厅" && S.story.beat >= 4 && S.story.deco === "fire";

  /* ---- 造声的小工具，都接到当前这一场 a.g 上 ---- */
  function buffer(c, kind) {
    const n = Math.floor(c.sampleRate * 2), d = c.createBuffer(1, n + Math.floor(c.sampleRate * .1), c.sampleRate).getChannelData(0);
    let l = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "brown") { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w;
    }
    const f = Math.floor(c.sampleRate * .1); // 首尾交叠：循环点不「咔」一声
    for (let i = 0; i < f; i++) d[i] = d[i] * (i / f) + d[n + i] * (1 - i / f);
    const buf = c.createBuffer(1, n, c.sampleRate);
    buf.copyToChannel(d.subarray(0, n), 0);
    return buf;
  }
  function bed(a, o) { // 噪声床：噪声 → 滤波 → 音量。lfo 让音量起伏，lfoF 让滤波频率摆动
    const c = a.ctx, src = c.createBufferSource();
    src.buffer = a.buf[o.brown ? "brown" : "white"]; src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.type || "lowpass"; f.frequency.value = o.f; f.Q.value = o.q || .7;
    const g = c.createGain(); g.gain.value = o.v;
    src.connect(f); f.connect(g); g.connect(a.g); src.start();
    a.src.push(src);
    const sway = (rate, depth, param, base) => {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = rate; lg.gain.value = depth * base;
      l.connect(lg); lg.connect(param); l.start(); a.src.push(l);
    };
    if (o.lfo) sway(o.lfo, o.depth || .4, g.gain, o.v);
    if (o.lfoF) sway(o.lfoF, o.fdepth || .5, f.frequency, o.f);
    return g;
  }
  function drone(a, o) { // 持续低音：油烟机的嗡嗡、琴房的余响
    const c = a.ctx, os = c.createOscillator();
    os.type = o.type || "sine"; os.frequency.value = o.f;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(o.v, c.currentTime + 1.2);
    os.connect(g); g.connect(a.g); os.start();
    a.src.push(os);
    return g;
  }
  function pip(a, o, at = 0) { // 一声短音：鸟叫、虫鸣、水泡
    const c = a.ctx, t = c.currentTime + at, os = c.createOscillator();
    os.type = o.type || "sine"; os.frequency.setValueAtTime(o.f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + o.d);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.v, t + (o.a || .008));
    g.gain.exponentialRampToValueAtTime(.0001, t + o.d);
    os.connect(g); g.connect(a.g); os.start(t); os.stop(t + o.d + .05);
  }
  function hiss(a, o, at = 0) { // 一阵短噪：火星、翻纸、风过树叶
    const c = a.ctx, t = c.currentTime + at, src = c.createBufferSource();
    src.buffer = a.buf.white;
    const f = c.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.f, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.d);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.v, t + (o.a || .004));
    g.gain.exponentialRampToValueAtTime(.0001, t + o.d);
    src.connect(f); f.connect(g); g.connect(a.g); src.start(t); src.stop(t + o.d + .05);
  }

  /* ---- 小事件 ---- */
  const chirp = k => a => { // 鸟叫：两三个上行短音
    const f = rnd(2300, 3400), n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) pip(a, { f, to: f * rnd(1.15, 1.5), v: .012 * k, d: .07 }, i * rnd(.09, .14));
  };
  const cricket = k => a => { // 虫鸣：三连短音
    for (let i = 0; i < 3; i++) pip(a, { f: 4300, v: .006 * k, d: .028 }, i * .06);
  };
  const crackle = a => hiss(a, { f: rnd(1400, 3600), to: rnd(500, 900), q: 2.5, v: rnd(.012, .05), d: rnd(.03, .07) });
  const bubble = a => pip(a, { f: rnd(380, 820), to: rnd(700, 1300), v: .02, d: .06 });
  const rustle = v => a => hiss(a, { f: 2200, to: 900, q: 1.1, v, d: .26, a: .05 });
  const creak = a => pip(a, { f: rnd(130, 170), to: rnd(80, 110), v: .016, d: .5, type: "triangle", a: .08 });
  /* 屋外的活物：白天鸟、夜里虫、黄昏交接。g 是疏密，k 是远近 */
  const wild = (g, k) => phase() === "night" ? [ev([.8 / g, 1.3 / g], cricket(k))]
    : phase() === "dusk" ? [ev([6 / g, 12 / g], chirp(k)), ev([2.5 / g, 5 / g], cricket(k))]
    : [ev([2.5 / g, 6.5 / g], chirp(k))];
  const ev = (gap, fn) => ({ gap, fn });
  const tone = v => ({ f: 180, v, brown: true });

  /* ---- 各房间的节目：beds 铺底，drones 低音，events 隔一阵来一下 ---- */
  const PROGRAMS = {
    "": () => ({ beds: [{ type: "bandpass", f: 520, q: .5, v: .016, lfoF: .07, fdepth: .6 }], events: wild(1, 1) }),
    "客厅": () => ({
      beds: [tone(.016), hearth() ? { f: 130, v: .05, brown: true, lfo: .6, depth: .35 } : null,
        SCST["客厅"]?.tv === 1 ? { type: "bandpass", f: 2800, q: .4, v: .006 } : null].filter(Boolean),
      events: [...(hearth() ? [ev([.12, .45], crackle)] : wild(.35, .35))],
    }),
    "厨房": () => ({ beds: [{ f: 260, v: .045, brown: true, lfo: .4, depth: .3 }], drones: [{ f: 98, v: .006, type: "triangle" }], events: [ev([.35, 1.3], bubble)] }),
    "卧室": () => ({ beds: [{ f: 160, v: .022, brown: true, lfo: .18, depth: .5 }], events: wild(.4, .4) }),
    "书房": () => ({ beds: [tone(.014)], events: [ev([5, 11], rustle(.012))] }),
    "阳台": () => ({ beds: [{ type: "bandpass", f: 640, q: .6, v: .028, lfoF: .1, fdepth: .7 }], events: [...wild(1.4, 1.1), ev([3, 7], rustle(.01))] }),
    "健身房": () => ({ beds: [tone(.012)], events: [] }),
    "储藏室": () => ({ beds: [tone(.012), { type: "bandpass", f: 720, q: 7, v: .02, lfoF: .05, fdepth: .25 }], events: [ev([7, 16], creak)] }),
    "阁楼": () => ({ beds: [{ type: "bandpass", f: 460, q: .9, v: .024, lfoF: .12, fdepth: .6 }], events: [ev([6, 13], creak)] }),
    "钢琴房": () => ({ beds: [tone(.012)], drones: [{ f: 130.81, v: .004 }, { f: 196, v: .003 }], events: [] }),
    "舞蹈房": () => ({ beds: [tone(.012)], events: [] }),
    "歌唱房": () => ({ beds: [tone(.012)], events: wild(.35, .3) }),
  };

  /* ---- 场次的生灭 ---- */
  function key() { // 同一个键就不重铺
    const p = phase(), tv = SCST["客厅"]?.tv;
    return [room || "", p === "night" ? "n" : p === "dusk" ? "d" : "y",
      room === "客厅" ? (hearth() ? "fire" : S.story.deco) + (tv ? "/tv" + tv : "") : ""].join("|");
  }
  function spawn(k) {
    const c = AU.ctx, a = { ctx: c, key: k, src: [], events: [] };
    a.buf = { white: buffer(c, "white"), brown: buffer(c, "brown") };
    a.g = c.createGain(); a.g.gain.value = 0; a.g.connect(mix);
    const p = (PROGRAMS[room || ""] || PROGRAMS[""])();
    for (const o of p.beds) bed(a, o);
    for (const o of p.drones || []) drone(a, o);
    for (const e of p.events) a.events.push({ ...e, at: c.currentTime + rnd(e.gap[0], e.gap[1]) * rnd(.2, 1) });
    a.g.gain.linearRampToValueAtTime(1, c.currentTime + FADE);
    return a;
  }
  function retire(a) {
    const t = a.ctx.currentTime;
    a.g.gain.cancelScheduledValues(t); a.g.gain.setValueAtTime(a.g.gain.value, t);
    a.g.gain.linearRampToValueAtTime(0, t + FADE);
    setTimeout(() => { for (const s of a.src) { try { s.stop(); } catch (e) {} } a.g.disconnect(); }, (FADE + .3) * 1000);
  }
  function tick() {
    if (!cur) return;
    const t = cur.ctx.currentTime;
    for (const e of cur.events) if (t >= e.at) { e.fn(cur); e.at = t + rnd(e.gap[0], e.gap[1]); }
  }
  function weather() { // 雨雪声在屋外：进了房就隔一层窗，子页开玩也让路
    if (!AU.wxG) return;
    AU.wxG.gain.setTargetAtTime((room ? .45 : 1) * (yielding ? .22 : 1), AU.ctx.currentTime, .4);
  }
  function refresh() {
    if (!mix) return;
    const k = key();
    if (!cur || cur.key !== k) { const old = cur; cur = spawn(k); if (old) retire(old); }
    weather();
  }

  function start() {
    if (mix || !AU.ctx || !AU.ambG) return;
    const c = AU.ctx;
    mix = c.createGain(); mix.gain.value = TRIM; mix.connect(AU.ambG);
    meter = c.createAnalyser(); meter.fftSize = 2048; wave = new Float32Array(meter.fftSize);
    mix.connect(meter);
    timer = setInterval(tick, TICK);
    refresh();
  }
  function level() { // 当前这一场的响度（总线音量之前），给体检用
    if (!meter) return 0;
    meter.getFloatTimeDomainData(wave);
    let s = 0;
    for (const x of wave) s += x * x;
    return Math.sqrt(s / wave.length);
  }
  return {
    start, room(name) { room = name || null; refresh(); }, update: refresh,
    yield(on) { yielding = !!on; if (!mix) return; mix.gain.setTargetAtTime(yielding ? TRIM * .22 : TRIM, AU.ctx.currentTime, .15); weather(); },
    level,
    state: () => ({ key: cur ? cur.key : "", voices: cur ? cur.src.length : 0, events: cur ? cur.events.length : 0, yielding, gain: mix ? +mix.gain.value.toFixed(3) : 0, level: level() }),
  };
})();
