/* 可选的迎新试玩计时。数据只留在当前标签页。 */
(() => {
  "use strict";
  if (location.search !== "?trial=welcome") return;

  const storageKey = "zhouse_welcome_trial_v1";
  const stages = Object.freeze({
    rooms: "参观小家",
    recipe: "阅读菜谱",
    rhythm: "完成节奏地毯",
    pairs: "配对完成",
    tomato: "番茄炒蛋出餐",
    rice: "蛋炒饭出餐",
    soup: "紫菜蛋花汤出餐",
    dinner: "备餐结算",
    decor: "选择布置",
    invite: "邀请小南",
    complete: "迎新结束"
  });
  const outcomes = {
    "in-progress": "记录中",
    stopped: "记录已结束",
    completed: "迎新已完成"
  };
  let record = null;
  let visibleSince = null;
  let checkedStorage = false;
  let storageUnavailable = false;
  let declined = false;
  let report;

  function load() {
    let raw;
    try {
      raw = sessionStorage.getItem(storageKey);
    } catch (error) {
      storageUnavailable = true;
      return null;
    }
    if (!raw) return null;
    try {
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || saved.playtest !== "welcome" ||
          !Object.hasOwn(outcomes, saved.outcome) ||
          !Number.isSafeInteger(saved.activeMs) || saved.activeMs < 0 ||
          !saved.milestones || typeof saved.milestones !== "object" ||
          Array.isArray(saved.milestones)) return null;
      const milestones = {};
      for (const [stage, time] of Object.entries(saved.milestones)) {
        if (!Object.hasOwn(stages, stage) || !Number.isSafeInteger(time) || time < 0 || time > saved.activeMs) return null;
        milestones[stage] = time;
      }
      if (Object.hasOwn(milestones, "complete") !== (saved.outcome === "completed")) return null;
      return { version: 1, playtest: "welcome", outcome: saved.outcome, activeMs: saved.activeMs, milestones };
    } catch (error) {
      return null;
    }
  }

  function activeMs() {
    const delta = visibleSince === null ? 0 : Math.max(0, performance.now() - visibleSince);
    return Math.round(record.activeMs + delta);
  }

  function snapshot() {
    return { ...record, activeMs: activeMs() };
  }

  function persist() {
    if (!record) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(snapshot()));
    } catch (error) {
      storageUnavailable = true;
    }
  }

  function resumeClock() {
    if (record?.outcome === "in-progress" && visibleSince === null && !document.hidden) {
      visibleSince = performance.now();
    }
  }

  function pauseClock() {
    if (visibleSince === null) return;
    record.activeMs = activeMs();
    visibleSince = null;
  }

  function finish(outcome) {
    if (record?.outcome !== "in-progress") return;
    pauseClock();
    record.outcome = outcome;
    persist();
  }

  function mark(stage) {
    if (record?.outcome !== "in-progress" || !Object.hasOwn(stages, stage) ||
        Object.hasOwn(record.milestones, stage)) return;
    record.milestones[stage] = activeMs();
    if (stage === "complete") finish("completed");
    else persist();
  }

  function observe(wishIndex, storyBeat) {
    if (record?.outcome !== "in-progress") return;
    if (wishIndex >= 1) mark("rooms");
    if (wishIndex >= 2) mark("recipe");
    if (wishIndex >= 3) mark("rhythm");
    if (wishIndex >= 4) mark("pairs");
    if (storyBeat >= 3) mark("dinner");
    if (storyBeat >= 4) mark("decor");
    if (storyBeat >= 5) mark("complete");
  }

  function exportReport() {
    if (!record) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2) + "\n"], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "zhouse-welcome-playtest.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    return Math.floor(seconds / 60) + " 分 " + (seconds % 60) + " 秒";
  }

  function updateReport() {
    const status = report.querySelector("#welcome-trial-status");
    const list = report.querySelector("#welcome-trial-stages");
    const exportButton = report.querySelector("#welcome-trial-export");
    const stopButton = report.querySelector("#welcome-trial-stop");
    list.replaceChildren();
    exportButton.hidden = !record;
    stopButton.hidden = record?.outcome !== "in-progress";
    if (!record) {
      status.textContent = "迎新试玩需要空白存档。请从启动器提供的新地址开始。";
      return;
    }
    status.textContent = outcomes[record.outcome] + " · 前台时长 " + formatTime(activeMs());
    for (const [stage, time] of Object.entries(record.milestones)) {
      const milestone = document.createElement("li");
      milestone.textContent = stages[stage] + " · " + formatTime(time);
      list.append(milestone);
    }
    if (storageUnavailable) status.textContent += "。浏览器无法暂存记录，请在刷新前导出。";
  }

  function showReport() {
    if (!report || report.open) return;
    updateReport();
    report.showModal();
  }

  function mountReport() {
    if (report) return;
    const style = document.createElement("style");
    style.textContent = `
      #welcome-trial-launch {
        position: fixed; z-index: 55;
        right: max(12px, env(safe-area-inset-right));
        bottom: max(12px, env(safe-area-inset-bottom));
        min-height: 44px; letter-spacing: 0;
      }
      body:has(#room-overlay.on, #frame-wrap.on, #dlg.on, #modal-mask.open, #pack-wrap.on, #iris.go)
        #welcome-trial-launch { display: none; }
      #welcome-trial-dialog {
        margin: auto; padding: 20px; width: min(420px, calc(100vw - 28px));
        max-height: calc(100dvh - 28px); overflow: auto; color: var(--ink, #4a3a28);
        background: var(--paper, #faf3e6); border: 1px solid var(--line, #eadfce);
        border-radius: 14px; line-height: 1.5;
      }
      #welcome-trial-dialog::backdrop { background: rgba(16, 18, 28, .7); }
      #welcome-trial-dialog p { margin-top: 8px; }
      #welcome-trial-stages { padding-inline-start: 1.4em; margin: 8px 0; }
      #welcome-trial-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      #welcome-trial-actions button { min-height: 44px; letter-spacing: 0; }
      #welcome-trial-actions [hidden] { display: none; }
    `;
    const launch = document.createElement("button");
    launch.type = "button";
    launch.className = "btn ghost";
    launch.id = "welcome-trial-launch";
    launch.textContent = "试玩记录";
    launch.setAttribute("aria-haspopup", "dialog");
    launch.addEventListener("click", showReport);

    report = document.createElement("dialog");
    report.id = "welcome-trial-dialog";
    report.setAttribute("aria-labelledby", "welcome-trial-title");
    report.innerHTML = `
      <h2 id="welcome-trial-title">迎新试玩记录</h2>
      <p id="welcome-trial-status" role="status"></p>
      <ol id="welcome-trial-stages"></ol>
      <p>导出时会生成本地 JSON 文件，由你决定是否分享。</p>
      <div id="welcome-trial-actions">
        <button class="btn" id="welcome-trial-export" type="button">导出记录</button>
        <button class="btn ghost" id="welcome-trial-stop" type="button">结束记录</button>
        <button class="btn ghost" id="welcome-trial-close" type="button" autofocus>关闭</button>
      </div>
    `;
    report.querySelector("#welcome-trial-export").addEventListener("click", exportReport);
    report.querySelector("#welcome-trial-stop").addEventListener("click", () => {
      finish("stopped");
      updateReport();
      report.querySelector("#welcome-trial-export").focus();
    });
    report.querySelector("#welcome-trial-close").addEventListener("click", () => report.close());
    report.addEventListener("keydown", event => event.stopPropagation());
    document.head.append(style);
    document.body.append(launch, report);
  }

  function start(fresh) {
    if (!checkedStorage) {
      record = load();
      checkedStorage = true;
    }
    if (!record && fresh === true && !declined) {
      if (!window.confirm("开始迎新试玩记录？只记录各步骤首次到达的前台时间，数据仅留在此标签页。你可以在小家首页结束记录并导出。取消仍可游玩。")) {
        declined = true;
        return false;
      }
      record = { version: 1, playtest: "welcome", outcome: "in-progress", activeMs: 0, milestones: {} };
      persist();
    }
    if (!declined) mountReport();
    resumeClock();
    return !!record;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseClock();
      persist();
    }
    else resumeClock();
  });
  window.addEventListener("pagehide", () => {
    pauseClock();
    persist();
  });
  window.addEventListener("pageshow", resumeClock);
  window.WelcomeTrial = { start, observe, mark, showReport };
})();
