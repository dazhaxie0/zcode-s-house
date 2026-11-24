/* 舞台剧本：章节对白的剧本、说话人与表演。
   剧本在 SCENES，每句是一行：
     who   说话人：narr 旁白 / z 住户Z / cat 猫 / bird 小南（名牌与头像跟着换）
     t     台词；旁白只写画面里看得见的事
     emo   这一句里小南的表情（nervous / calm / happy / shy / warm / sing），留到下一句才换
     act   起头的一次性动作：peck 啄食 / hop 雀跃
     sfx   起头的一声；hold 自动播放时多留的秒数
     mood  这一场的音乐状态（tender 入座 / stage 首演），对白收场回家常
   字幕与跳过规则、对话状态图见《最终测试与3A演进建议》。
   主屋只在 typeLine / dlgAdvance / closeTalk 三处挂钩，其余都在这里。 */
const Stage = (() => {
  const seat = (open, greet, ask, answer) => [
    { who: "narr", emo: "nervous", sfx: "flap", mood: "tender", t: open },
    { who: "bird", emo: "calm", t: greet },
    { who: "z", t: "「慢点吃，汤还烫。」" },
    { who: "cat", t: "「先喝口汤，」猫把碗往它面前推了推，「这个位置以后给你留着。」" },
    { who: "narr", emo: "happy", act: "peck", sfx: "chomp", t: "小南啄了一口炒蛋，又喝了一口汤，翅膀慢慢贴回身侧。" },
    { who: "bird", emo: "shy", t: ask },
    { who: "cat", emo: "happy", act: "hop", t: answer },
  ];
  const SCENES = {
    /* 第一幕开场：卷一圆满，住户Z跟主人说今晚的事 */
    open: [
      { who: "narr", t: "猫在门口坐得笔直。" },
      { who: "z", t: "今晚有位新住户要来住——一只从南边飞来的小鸟，翅膀还没养好。" },
      { who: "z", t: "客厅得先收拾收拾，晚饭也得是热的。先去客厅看看？" },
    ],
    /* 头一回进客厅 */
    look: [
      { who: "narr", t: "挂毯刚卷好，沙发还空着半边，灰都擦过了。" },
      { who: "z", t: "先把晚饭备上——今晚做番茄炒蛋、蛋炒饭和紫菜蛋花汤。厨房备好了菜谱，你跟着订单慢慢来。" },
    ],
    /* 请小南入座：头两句和末两句随布置走，中间三句各家一样 */
    seat: {
      lamp: seat("暖灯亮起，小南顺着灯光落到靠垫上。", "「看得清你的脸了。我们一起吃吧。」",
        "「留着的……是每晚吗？」", "「每晚。灯给你亮着，门也留一条缝。」"),
      fire: seat("壁炉轻轻噼啪，小南在沙发上拢了拢翅膀。", "「屋里真暖。我们一起吃吧。」",
        "「南边的冬天没有这样的火。我能多烤一会儿吗？」", "「烤到开春也行，柴禾管够。」"),
      none: seat("小南在旧靠垫上踩了两步。", "「闻到饭香了。就坐这儿吧，我喜欢现在的样子。」",
        "「这靠垫有太阳晒过的味道。往后……我天天回来。」", "「那敢情好。饭是热的，位置是留的。」"),
    },
    /* 第二幕开场：小南攒够了节目 */
    announce: [
      { who: "narr", t: "小南在窗台上蹦了两下，羽毛都抖亮了。" },
      { who: "cat", t: "「今晚……我想开一场首演。」猫翻译道，「要两支排练过的节目——琴、舞、歌里挑两样，接了愿以后新练的才算数。」" },
    ],
  };
  /* 首演：第三句报出今晚真正排练过的节目 */
  const show = () => {
    const names = { pn: "琴键", dc: "舞步", vo: "和声" };
    const acts = S.story2.set.split(",").map(k => names[k]).filter(Boolean);
    return [
      { who: "narr", emo: "nervous", stage: "premiere", mood: "stage", t: "客厅的灯暗下来，只留一束光。小南站上谱架，深吸一口气。" },
      { who: "cat", emo: "sing", t: "「唱吧，」猫把尾巴收好，「这一屋子都是你的观众。」" },
      { who: "narr", emo: "sing", sfx: "chirp", hold: 1.2,
        t: "小南唱起来。" + (acts.length ? acts.join("、") + "——哪一样都是这个家练出来的。" : "声音不大，一屋子都听见了。") },
    ];
  };
  const lines = name => name === "seat" ? SCENES.seat[S.story.deco] || SCENES.seat.none
    : name === "show" ? show() : SCENES[name];

  const WHO = { z: "Z · 住户", bird: "小南 · 新住户", cat: "猫 · 室友", narr: "" };
  const AVA = {
    bird: '<svg class="ava-bird" viewBox="0 0 38 36" aria-hidden="true"><path d="M13.5 9.5q3-4.6 6.4-1.4" fill="none" stroke="#5e8997" stroke-width="1.5" stroke-linecap="round"/><circle cx="18.5" cy="19.5" r="12.5" fill="#bfdee1" stroke="#5e8997" stroke-width="1.6"/><path d="m30.5 20.4 6.2 1.9-6.2 2.7z" fill="#e9b262" stroke="#c98a3a" stroke-width=".5" stroke-linejoin="round"/><circle cx="22.6" cy="17.2" r="2.1" fill="#233c4a"/><circle cx="23.3" cy="16.5" r=".6" fill="#fff7ed"/></svg>',
    cat: '<svg class="ava-cat" viewBox="0 0 36 36" aria-hidden="true"><path d="M8.6 15 6.4 3.6l9.8 5.8z" fill="#4a3a28"/><path d="M27.4 15l2.2-11.4-9.8 5.8z" fill="#4a3a28"/><circle cx="18" cy="21" r="11.6" fill="#4a3a28"/><circle cx="13.4" cy="20" r="2.4" fill="#f7ead2"/><circle cx="22.6" cy="20" r="2.4" fill="#f7ead2"/><path d="M16 26q2 1.9 4 0" stroke="#f7ead2" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>',
  };
  const ACTS = ["act-peck", "act-hop", "act-ruffle", "act-bow"];

  const STYLE = `
#dlg { -webkit-tap-highlight-color: transparent; } /* 手机上点对白框不闪系统高亮 */
#dlg .dlg-name { display: flex; align-items: center; gap: 8px; min-height: 22px; }
#dlg .stage-ctl { margin-left: auto; display: none; gap: 6px; }
#dlg.stage .stage-ctl { display: flex; }
#dlg .stage-btn {
font-family: inherit; font-size: 11px; line-height: 1; letter-spacing: .08em;
color: #f0c46a; background: rgba(240,196,106,.08); border: 1px solid rgba(240,196,106,.38);
border-radius: 999px; padding: 5px 10px; min-height: 22px; cursor: pointer;
}
#dlg .stage-btn:hover { background: rgba(240,196,106,.18); }
#dlg .stage-btn[aria-pressed="true"] { background: #f0c46a; border-color: #f0c46a; color: #1d2536; }
#dlg .stage-btn.warn { color: #ffd9a0; border-color: #e08a5a; background: rgba(224,110,90,.24); }
#dlg .stage-btn:focus-visible { outline: 2px solid #fff3d1; outline-offset: 2px; }
#dlg.narr .dlg-ava { display: none; }
#dlg.narr .stage-name { visibility: hidden; }
#dlg.narr .dlg-text { color: #cbd3e4; }
#dlg .stage-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.stage-replay { text-align: center; margin-top: 10px; }
.set-row .sb.quiet { background: var(--paper-3); color: var(--ink-2); box-shadow: inset 0 0 0 2px var(--line); }
@media (max-width: 640px) {
#dlg .stage-btn { min-height: 30px; padding: 6px 12px; font-size: 12px; }
#dlg .dlg-name { min-height: 30px; }
}
/* 字幕字号：标准 / 大 / 特大 */
body[data-sub="1"] #dlg .dlg-text { font-size: 17.5px; }
body[data-sub="1"] #dlg .dlg-name, body[data-sub="1"] .cine-cap { font-size: 13px; }
body[data-sub="2"] #dlg .dlg-text { font-size: 21px; line-height: 1.75; }
body[data-sub="2"] #dlg .dlg-name, body[data-sub="2"] .cine-cap { font-size: 15px; }
/* 角色骨架：表情走单个变换属性，不抢呼吸、眨眼自己的 transform */
#r-scene .story-bird :is(.bird-rig, .bird-head, .bird-beak, .bird-wing, .bird-tail, .bird-eye, .bird-glare) { transform-box: fill-box; }
#r-scene .story-bird .bird-head { transform-origin: 12% 88%; transition: translate .5s ease, rotate .5s ease; }
#r-scene .story-bird .bird-wing { transform-origin: 10% 90%; transition: rotate .4s ease; }
#r-scene .story-bird :is(.bird-eye, .bird-glare) { transition: translate .35s ease, scale .3s ease, opacity .2s; }
#r-scene .story-bird :is(.bird-lid, .bird-joy, .bird-blush) { opacity: 0; transition: opacity .35s; }
#r-scene .story-bird[data-emo="nervous"] .bird-wing { rotate: -24deg; }
#r-scene .story-bird[data-emo="nervous"] .bird-head { translate: .3px -1.3px; }
#r-scene .story-bird[data-emo="nervous"] .bird-eye { scale: 1.3; }
#r-scene .story-bird[data-emo="happy"] .bird-head { translate: .5px -1.5px; rotate: -5deg; }
#r-scene .story-bird[data-emo="happy"] :is(.bird-eye, .bird-glare) { opacity: 0; }
#r-scene .story-bird[data-emo="happy"] .bird-joy { opacity: 1; }
#r-scene .story-bird[data-emo="happy"] .bird-blush { opacity: .85; }
#r-scene .story-bird[data-emo="shy"] .bird-head { translate: -.6px 1.7px; rotate: 9deg; }
#r-scene .story-bird[data-emo="shy"] .bird-lid { opacity: 1; }
#r-scene .story-bird[data-emo="shy"] :is(.bird-eye, .bird-glare) { translate: .15px .7px; }
#r-scene .story-bird[data-emo="shy"] .bird-blush { opacity: .95; }
#r-scene .story-bird[data-emo="warm"] .bird-head { translate: -.3px .6px; rotate: 5deg; }
#r-scene .story-bird[data-emo="warm"] .bird-lid { opacity: 1; }
#r-scene .story-bird[data-emo="warm"] .bird-blush { opacity: .7; }
#r-scene .story-bird[data-emo="sing"] .bird-head { translate: .6px -1.7px; rotate: -8deg; }
#r-scene .story-bird[data-emo="sing"] .bird-rig { transform-origin: 50% 100%; animation: stage-sway 1.7s ease-in-out infinite; }
#r-scene .story-bird[data-emo="sing"].talking .bird-beak { animation: stage-beak .16s steps(2, end) infinite; }
#r-scene .story-bird.speaking .bird-shadow, #r-scene .story-cat.speaking .cat-shadow { fill: #f0c46a; opacity: .55; }
#r-scene .story-bird.listening .bird-rig, #r-scene .story-cat.listening .cat-rig { filter: saturate(.82) brightness(.93); }
#r-scene .story-bird.act-peck .bird-head { animation: stage-peck .95s ease-in-out; }
#r-scene .story-bird.act-hop .bird-rig { animation: stage-hop .55s cubic-bezier(.3, .6, .3, 1); }
#r-scene .story-bird.act-ruffle .bird-rig { animation: stage-ruffle .5s ease-out; }
#r-scene .story-bird.act-bow .bird-head { animation: stage-bow .7s ease-in-out; }
@keyframes stage-sway { 50% { transform: rotate(3.4deg); } }
@keyframes stage-beak { 50% { transform: scaleY(1.7); } }
@keyframes stage-peck {
0%, 44%, 100% { transform: none; }
20% { transform: translate(1.6px, 3.5px) rotate(27deg); }
}
@keyframes stage-hop {
0%, 70%, 100% { transform: none; }
35% { transform: translateY(-4.6px); }
85% { transform: translateY(-1.1px); }
}
@keyframes stage-ruffle {
0%, 100% { transform: none; }
25% { transform: scale(1.1, .9); }
55% { transform: scale(.94, 1.07); }
80% { transform: scale(1.05, .96); }
}
@keyframes stage-bow { 40% { transform: translate(.4px, 2.2px) rotate(16deg); } }
#r-scene .story-bird .bird-beak { transform-box: fill-box; transform-origin: 0% 50%; }
#r-scene .story-cat :is(.cat-rig, .cat-head, .cat-tail) { transform-box: fill-box; }
#r-scene .story-cat .cat-tail { transform-origin: 100% 100%; }
#r-scene .story-cat.speaking .cat-tail { animation: stage-tail 1.3s ease-in-out infinite; }
#r-scene .story-cat.talking .cat-head { transform-origin: 50% 100%; animation: stage-nod .34s ease-in-out infinite; }
@keyframes stage-tail { 50% { transform: rotate(16deg); } }
@keyframes stage-nod { 50% { transform: translateY(-.5px) rotate(4deg); } }
/* 首演舞台：灯暗下来，只留一束追光 */
#r-scene .stage-light {
position: absolute; inset: 0; z-index: 3; pointer-events: none; opacity: 0; transition: opacity 1.4s ease;
background:
radial-gradient(ellipse 30% 42% at var(--spot-x, 37%) var(--spot-y, 62%), rgba(255, 232, 180, .22), rgba(255, 232, 180, 0) 70%),
radial-gradient(ellipse 34% 46% at var(--spot-x, 37%) var(--spot-y, 62%), rgba(6, 6, 16, 0) 30%, rgba(6, 6, 16, .84) 86%);
}
#r-scene.premiere .stage-light { opacity: 1; }
body.reduce-motion #r-scene :is(.story-bird, .story-cat) *, body.reduce-motion #r-scene .stage-light {
animation: none !important; transition: none !important;
}
`;

  let cur = null, auto = false, autoTimer = 0, skipArmed = false, skipTimer = 0, typed = false;
  let pending = "", replaying = "", premiere = false, restoreTimer = 0, frame = 0, zAva = "";
  const dlg = () => document.getElementById("dlg");
  const scene = () => document.getElementById("r-scene");
  const art = () => scene()?.querySelector("svg.art");

  /* ---- 表演：谁在说话谁亮着，小南按剧本换表情 ---- */
  function apply(ln) {
    if (ln.stage === "premiere" && !premiere) {
      premiere = true;
      if (art()) renderWelcomeDecor(art(), S.story, true, "premiere");
    }
    const sc = scene();
    if (!sc) return;
    sc.classList.toggle("premiere", premiere);
    if (premiere) spot(sc);
    const bird = sc.querySelector(".story-bird"), cat = sc.querySelector(".story-cat");
    const cast = ln.who === "bird" || ln.who === "cat";
    for (const [el, who] of [[bird, "bird"], [cat, "cat"]]) {
      if (!el) continue;
      el.classList.toggle("speaking", ln.who === who);
      el.classList.toggle("listening", cast ? ln.who !== who : ln.who === "z");
      el.classList.toggle("talking", ln.who === who && !typed);
    }
    if (bird && ln.emo) bird.dataset.emo = ln.emo;
    if (bird && ln.act) {
      bird.classList.remove(...ACTS); void bird.getBoundingClientRect();
      bird.classList.add("act-" + ln.act);
      setTimeout(() => bird.classList.remove("act-" + ln.act), 1300);
    }
  }
  function spot(sc) { // 追光对准小南：量它在场景里的位置，比例存进变量
    if (!sc.querySelector(".stage-light")) {
      const l = document.createElement("div");
      l.className = "stage-light";
      sc.appendChild(l);
    }
    const b = sc.querySelector(".story-bird")?.getBoundingClientRect(), r = sc.getBoundingClientRect();
    if (!b || !r.width) return;
    sc.style.setProperty("--spot-x", ((b.x + b.width / 2 - r.x) / r.width * 100).toFixed(1) + "%");
    sc.style.setProperty("--spot-y", ((b.y + b.height / 2 - r.y) / r.height * 100).toFixed(1) + "%");
  }
  function restore() {
    clearTimeout(restoreTimer);
    if (!premiere) return;
    premiere = false;
    scene()?.classList.remove("premiere");
    if (typeof curRoom === "string" && curRoom === "客厅") renderStoryScene();
  }

  /* ---- 字幕 ---- */
  function enter(line) {
    const story = document.body.dataset.cine === "story";
    const src = typeof line === "string" ? { who: "z", t: line } : line;
    cur = story ? src : { who: "z", t: src.t };
    clearTimeout(autoTimer);
    const d = dlg(), ava = d.querySelector(".dlg-ava");
    d.classList.toggle("stage", story);
    d.classList.toggle("narr", cur.who === "narr");
    if (ava.dataset.who !== cur.who) {
      ava.innerHTML = cur.who === "z" ? zAva : AVA[cur.who] || "";
      ava.dataset.who = cur.who;
    }
    d.querySelector(".stage-name").textContent = WHO[cur.who];
    d.querySelector(".stage-sr").textContent = WHO[cur.who] ? WHO[cur.who] + "：" + cur.t : cur.t;
    if (cur.who === "bird") AU.sfx("chirp", true); // 角色开口先叫一声，走对白总线
    else if (cur.who === "cat") AU.sfx("purr", true);
    if (cur.sfx) AU.sfx(cur.sfx);
    if (cur.mood) AU.setMood(cur.mood); // 这一场的音乐状态，小节边界上换
    if (!story) return cur.t;
    typed = false;
    apply(cur); // 小南刚落座那一下，场景要等主屋重画完才在，下一帧再对一遍
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => cur && apply(cur));
    return cur.t;
  }
  const ms = () => document.body.classList.contains("reduce-motion") ? 0 : 34; // 减少动画：整句直接出
  const hold = () => cur ? 1500 + 65 * cur.t.length + (cur.hold || 0) * 1000 : 1500;
  function done() { // 整句出完了
    typed = true;
    scene()?.querySelectorAll(".talking").forEach(el => el.classList.remove("talking"));
    if (auto) autoTimer = setTimeout(() => { if (dlgOpen() && !dlgTyping) dlgAdvance(); }, hold());
  }
  function leave(completed) {
    clearTimeout(autoTimer); clearTimeout(skipTimer); clearTimeout(restoreTimer); cancelAnimationFrame(frame);
    const was = replaying, lit = premiere;
    replaying = ""; auto = false; cur = null;
    AU.setMood(null); // 音乐回家常
    const d = dlg();
    d.classList.remove("stage");
    const a = d.querySelector('[data-stage="auto"]'), k = d.querySelector('[data-stage="skip"]');
    if (a) { a.setAttribute("aria-pressed", "false"); a.textContent = "自动"; }
    if (k) { k.textContent = "跳过"; k.classList.remove("warn"); }
    skipArmed = false;
    scene()?.querySelectorAll(".speaking, .listening, .talking").forEach(el => el.classList.remove("speaking", "listening", "talking"));
    if (lit) { if (completed) restoreTimer = setTimeout(restore, 4200); else restore(); } // 烟花放完再开灯
    if (completed && was) for (let i = 0; i < 6; i++) setTimeout(() => FXC.firework(), i * 480); // 重温只放烟花，不动进度
    return was !== "";
  }

  /* ---- 自动 / 跳过 ---- */
  function resetSkip() {
    clearTimeout(skipTimer); skipArmed = false;
    const k = dlg().querySelector('[data-stage="skip"]');
    if (k) { k.textContent = "跳过"; k.classList.remove("warn"); }
  }
  function skip() {
    if (storyFinaleArmed && !skipArmed) { // 头一回看带奖励的章节：按两次才跳
      skipArmed = true;
      const k = dlg().querySelector('[data-stage="skip"]');
      k.textContent = "确定跳过"; k.classList.add("warn");
      skipTimer = setTimeout(resetSkip, 2500);
      AU.sfx("cancel");
      return;
    }
    closeTalk(true); // 跳过＝视为读完
  }
  function toggleAuto() {
    auto = !auto;
    const a = dlg().querySelector('[data-stage="auto"]');
    a.setAttribute("aria-pressed", String(auto));
    a.textContent = auto ? "自动 · 开" : "自动";
    AU.sfx("click");
    if (auto && !dlgTyping) done();
  }

  /* ---- 重温：陈列馆的回忆卡上重演一遍，不改进度 ---- */
  function start(chapter) {
    if (chapter === "story" && art()) { // 让小南再落一回座
      art().querySelector(".story-decor")?.remove();
      renderWelcomeDecor(art(), { ...S.story, beat: 4 }, true);
    }
    storyTalk(lines(chapter === "story" ? "seat" : "show"), false);
    replaying = chapter; // storyTalk 开头会 closeTalk → leave()，这一笔得落在它后面
    const d = dlg();
    d.tabIndex = -1; d.focus(); // 键盘接着就能翻页
  }
  function replay(chapter) {
    pending = chapter;
    closeModal(); // 回忆卡的弹窗先收，客厅才点得着
    const overlay = document.getElementById("room-overlay");
    if (overlay.classList.contains("on") && curRoom === "客厅") { pending = ""; start(chapter); return; }
    enterRoom("客厅", innerWidth / 2, innerHeight / 2);
  }
  function room(name) { // 进客厅后的钩子；真章节对白正在上演就让路
    if (!pending || name !== "客厅") return;
    const chapter = pending; pending = "";
    if (dlgOpen()) return;
    start(chapter);
  }
  function decorate() {
    const view = document.getElementById("modal-box").querySelector(".cg-view-art");
    if (!view || view.parentElement.querySelector(".stage-replay")) return;
    const chapter = { cg11: "story", cg12: "story2" }[view.dataset.cgid];
    if (!chapter || !(chapter === "story" ? S.story.rewarded : S.story2.rewarded)) return;
    const row = document.createElement("div");
    row.className = "stage-replay";
    row.innerHTML = '<button class="btn ghost" type="button">重温对白</button>';
    row.firstChild.onclick = () => replay(chapter);
    view.after(row);
  }

  function build() {
    const d = dlg();
    if (!d || d.querySelector(".stage-ctl")) return;
    const style = document.createElement("style");
    style.id = "stage-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
    d.setAttribute("role", "dialog");
    d.setAttribute("aria-label", "对白");
    const ava = d.querySelector(".dlg-ava");
    zAva = ava.innerHTML;
    ava.dataset.who = "z";
    const name = d.querySelector(".dlg-name");
    name.innerHTML = '<span class="stage-name">' + name.textContent + '</span><span class="stage-ctl">' +
      '<button type="button" class="stage-btn" data-stage="auto" aria-pressed="false">自动</button>' +
      '<button type="button" class="stage-btn" data-stage="skip">跳过</button></span>';
    d.querySelector(".dlg-text").setAttribute("aria-hidden", "true"); // 读屏听整句，不听一个字一个字蹦
    const sr = document.createElement("div");
    sr.className = "stage-sr";
    sr.setAttribute("role", "status");
    d.appendChild(sr);
    name.querySelector(".stage-ctl").addEventListener("click", e => {
      const b = e.target.closest("[data-stage]");
      if (!b) return;
      e.stopPropagation(); // 不算翻页
      if (b.dataset.stage === "auto") toggleAuto(); else skip();
      if (e.detail > 0) b.blur(); // 鼠标、触屏点的：焦点还给对白，回车照旧翻页
    });
    new MutationObserver(decorate).observe(document.getElementById("modal-box"), { childList: true, subtree: true });
    decorate();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();

  return { SCENES, lines, enter, ms, done, leave, room, replay, get replaying() { return replaying; } };
})();
