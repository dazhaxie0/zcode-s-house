/* 演出镜头：章节对白时的电影化呈现。
   主屋只在 storyTalk / closeTalk 上写 body[data-cine="story"]，本文件把它变成：
   上下黑边 + 章节字幕、镜头缓慢推近、浮尘光、对白字幕化、配乐自动压低。
   降低动态时保留黑边与压低，但不推镜、不飘尘。 */
const Cine = (() => {
  const FOCUS = {
    "客厅": [-6, 8, 1.07],
    "厨房": [4, 6, 1.06],
    "卧室": [-4, 6, 1.06],
    "书房": [5, 4, 1.05],
    "阳台": [0, 6, 1.05],
    "钢琴房": [-4, 5, 1.06],
    "舞蹈房": [0, 6, 1.05],
    "歌唱房": [4, 4, 1.05],
  };
  const STYLE = `
#cine-bars { position: fixed; inset: 0; z-index: 92; pointer-events: none; }
.cine-bar {
position: absolute; left: 0; right: 0; height: clamp(24px, 5.5vh, 56px);
background: linear-gradient(180deg, #05070c, #0a0f1a);
transition: transform .72s cubic-bezier(.2,.7,.2,1);
}
.cine-bar.cine-top {
top: 0; transform: translateY(-101%); display: flex; align-items: center;
padding: 0 clamp(14px, 4vw, 46px);
border-bottom: 1px solid rgba(240,196,106,.22);
}
.cine-bar.cine-bottom {
bottom: 0; transform: translateY(101%);
border-top: 1px solid rgba(240,196,106,.16);
box-shadow: 0 -12px 40px rgba(0,0,0,.35);
}
body.cine .cine-bar.cine-top, body.cine .cine-bar.cine-bottom { transform: none; }
.cine-cap {
font-size: 11px; letter-spacing: .4em; color: #d9bf86; opacity: 0;
transform: translateY(-7px); transition: opacity .6s .18s, transform .6s .18s;
white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
body.cine .cine-cap { opacity: 1; transform: none; }
#r-scene .art {
transform: translate3d(calc(var(--cam-x, 0px) + var(--cine-x, 0px)), calc(var(--cam-y, 0px) + var(--cine-y, 0px)), 0)
scale(var(--cam-s, 1));
transition: transform .9s cubic-bezier(.2,.7,.2,1);
will-change: transform;
}
#r-scene.cine .art { transition: transform 6s cubic-bezier(.2,.45,.25,1); }
@keyframes cine-dolly {
from { transform: translate3d(0, 0, 0) scale(1.045); opacity: .68; }
to { transform: translate3d(0, 0, 0) scale(var(--cam-s, 1)); opacity: 1; }
}
#r-scene.dolly .art { animation: cine-dolly .85s cubic-bezier(.2,.7,.2,1); }
body.cine #dlg {
bottom: calc(clamp(24px, 5.5vh, 56px) + 12px);
width: min(94vw, 680px);
background: linear-gradient(160deg, rgba(17,22,34,.95), rgba(7,10,17,.97));
border-color: rgba(240,196,106,.32);
box-shadow: 0 24px 70px rgba(0,0,0,.62);
}
body.cine #dlg .dlg-name { letter-spacing: .44em; }
body.cine #toasts { top: calc(clamp(24px, 5.5vh, 56px) + 12px); bottom: auto; }
.cine-dust { position: absolute; inset: 0; z-index: 3; overflow: hidden; opacity: 0; transition: opacity 1.4s; pointer-events: none; }
#r-scene.cine .cine-dust { opacity: 1; }
.cine-dust i {
position: absolute; width: 2px; height: 2px; border-radius: 50%;
background: rgba(255,238,200,.7); box-shadow: 0 0 7px rgba(255,220,160,.55);
animation: cine-drift linear infinite;
}
@keyframes cine-drift {
0% { transform: translate3d(0, 14px, 0); opacity: 0; }
18% { opacity: .85; }
100% { transform: translate3d(16px, -48px, 0); opacity: 0; }
}
/* 角色微表演：迎新晚餐这张图里的呼吸、眨眼、灯火 */
.story-bird .bird-body { animation: cine-breathe 4.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 95%; }
.story-bird .bird-eye { animation: cine-blink 5.8s infinite; transform-box: fill-box; transform-origin: center; }
.welcome-lights > g:last-child circle { animation: cine-twinkle 3.8s ease-in-out infinite; }
.welcome-lights > g:last-child circle:nth-child(2n) { animation-delay: -1.3s; }
.welcome-lights > g:last-child circle:nth-child(3n) { animation-delay: -2.4s; }
.welcome-fire > ellipse:first-of-type { animation: cine-fire 2.9s ease-in-out infinite; }
@keyframes cine-breathe { 50% { transform: scale(1.018, .984); } }
@keyframes cine-blink { 0%, 95.5%, 100% { transform: scaleY(1); } 96.5% { transform: scaleY(.08); } }
@keyframes cine-twinkle { 50% { opacity: .52; } }
@keyframes cine-fire { 50% { opacity: .4; } }
body.reduce-motion .cine-bar, body.reduce-motion .cine-cap, body.reduce-motion #r-scene .art { transition: none; }
body.reduce-motion #r-scene.dolly .art { animation: none; }
body.reduce-motion .cine-dust { display: none; }
body.reduce-motion .story-bird .bird-body, body.reduce-motion .story-bird .bird-eye,
body.reduce-motion .welcome-lights > g:last-child circle, body.reduce-motion .welcome-fire > ellipse:first-of-type { animation: none; }
`;
  let bars = null, cap = null, on = false, dollyTimer = 0;

  const rm = () => document.body.classList.contains("reduce-motion");
  const scene = () => document.getElementById("r-scene");

  function build() {
    if (bars) return;
    const st = document.createElement("style");
    st.id = "cine-style";
    st.textContent = STYLE;
    document.head.appendChild(st);
    bars = document.createElement("div");
    bars.id = "cine-bars";
    bars.setAttribute("aria-hidden", "true");
    bars.innerHTML = '<div class="cine-bar cine-top"><span class="cine-cap"></span></div><div class="cine-bar cine-bottom"></div>';
    document.body.appendChild(bars);
    cap = bars.querySelector(".cine-cap");

    const sc = scene();
    if (sc) {
      dust(sc);
      new MutationObserver(() => dust(sc)).observe(sc, { childList: true });
      /* 镜头视差：只在房间里跟手轻移，演出时锁镜 */
      sc.addEventListener("pointermove", e => {
        if (rm() || on) return;
        const r = sc.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - .5) * 8;
        const y = ((e.clientY - r.top) / r.height - .5) * 5;
        sc.style.setProperty("--cam-x", (-x).toFixed(1) + "px");
        sc.style.setProperty("--cam-y", (-y).toFixed(1) + "px");
      });
      sc.addEventListener("pointerleave", () => {
        sc.style.setProperty("--cam-x", "0px");
        sc.style.setProperty("--cam-y", "0px");
      });
    }
    /* 进房时镜头落定 */
    const ro = document.getElementById("room-overlay");
    new MutationObserver(() => {
      if (!ro.classList.contains("on") || on || rm() || !sc) return;
      sc.classList.remove("dolly"); void sc.offsetWidth; sc.classList.add("dolly");
      clearTimeout(dollyTimer);
      dollyTimer = setTimeout(() => sc.classList.remove("dolly"), 950);
    }).observe(ro, { attributes: true, attributeFilter: ["class"] });

    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["data-cine", "class"] });
    new MutationObserver(sync).observe(document.getElementById("dlg"), { attributes: true, attributeFilter: ["class"] });
    sync();
  }

  function dust(host) {
    if (!host || host.querySelector(".cine-dust")) return;
    const d = document.createElement("div");
    d.className = "cine-dust";
    for (let i = 0; i < 7; i++) {
      const m = document.createElement("i");
      m.style.left = (8 + i * 13.5) + "%";
      m.style.top = (20 + (i * 37) % 58) + "%";
      m.style.animationDuration = (7 + (i % 4) * 2.4) + "s";
      m.style.animationDelay = (-i * 1.7) + "s";
      d.appendChild(m);
    }
    host.appendChild(d);
  }

  function caption() {
    if (typeof S === "undefined" || !S.story) return "Z 的小家 · 章节演出";
    if (S.story.beat >= 5 && S.story2 && !S.story2.rewarded) {
      return "首演之夜 · " + (S.story2.beat === 3 ? "开演" : "排练");
    }
    const beat = typeof STORY_BEATS !== "undefined" ? STORY_BEATS[S.story.beat] : "";
    return "迎新之夜" + (beat ? " · " + beat : "");
  }

  function focus(sc) {
    if (!sc) return;
    sc.style.setProperty("--cam-x", "0px");
    sc.style.setProperty("--cam-y", "0px");
    const f = rm() ? [0, 0, 1] : (typeof curRoom === "string" ? FOCUS[curRoom] : null) || [0, 0, 1.05];
    sc.style.setProperty("--cine-x", f[0] + "px");
    sc.style.setProperty("--cine-y", f[1] + "px");
    sc.style.setProperty("--cam-s", f[2]);
  }

  function sync() {
    const want = document.body.dataset.cine === "story" &&
      document.getElementById("dlg").classList.contains("on");
    const sc = scene();
    if (want === on) { if (want) focus(sc); return; }
    on = want;
    document.body.classList.toggle("cine", on);
    if (sc) sc.classList.toggle("cine", on);
    if (on) {
      if (cap) cap.textContent = caption();
      focus(sc);
      if (typeof AU !== "undefined" && AU.duck) AU.duck(true);
    } else {
      if (sc) {
        sc.classList.remove("cine");
        sc.style.removeProperty("--cine-x");
        sc.style.removeProperty("--cine-y");
        sc.style.removeProperty("--cam-x");
        sc.style.removeProperty("--cam-y");
        sc.style.removeProperty("--cam-s");
      }
      if (typeof AU !== "undefined" && AU.duck) AU.duck(false);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  return { build, sync, active: () => on, caption };
})();
