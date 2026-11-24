/* 迎新之夜的客厅场景图层。使用客厅原画的 320 × 130 坐标。 */
const renderWelcomeDecor = (() => {
  const svgNS = "http://www.w3.org/2000/svg";
  const table = `
    <g class="welcome-table">
      <title>迎新晚饭</title>
      <ellipse cx="150" cy="120" rx="56" ry="5" fill="#1a110b" opacity=".5"/>
      <path d="M106 107h7l-4 12h-5zm79 0h7l2 12h-5z" fill="#644024"/>
      <path d="M101 101h97v5q0 4-7 5h-83q-7-1-7-5z" fill="#825133"/>
      <path d="M107 94q2-3 8-3h68q6 0 8 3l7 7q0 4-7 5h-83q-8-1-7-5z"
        fill="#c99761" stroke="#67402a" stroke-width="1.3"/>
      <path d="M135 91h24l8 15h-32z" fill="#679593"/>
      <path d="M106 103q3 2 9 2h68q7 0 11-2" fill="none" stroke="#ebbe7d" stroke-width="1"/>
      <g class="welcome-plate" data-dish="tomato">
        <title>番茄炒蛋</title>
        <ellipse cx="119" cy="98.8" rx="11.5" ry="4.5" fill="#67402a" opacity=".4"/>
        <ellipse cx="119" cy="97.8" rx="11" ry="4.4" fill="#ffedce" stroke="#9c704b" stroke-width=".8"/>
        <path d="M111 97q1-4 5-3l3 1 1 3q-6 2-9-1m10-2q2-3 5 0l1 2-5 2-2-2z" fill="#cf4d34"/>
        <path d="m115 97 2-2 4 1 2 2-5 2zm8-2 2-1 1 2-3 1z" fill="#f9c75d"/>
        <path d="m117 97 1.4-.5m4 .2 1.3.7" stroke="#5c8949" stroke-width=".8" stroke-linecap="round"/>
      </g>
      <g class="welcome-plate" data-dish="rice">
        <title>蛋炒饭</title>
        <ellipse cx="147" cy="99" rx="11" ry="4.5" fill="#67402a" opacity=".4"/>
        <ellipse cx="147" cy="98" rx="10.5" ry="4.3" fill="#f5f0d8" stroke="#779c9b" stroke-width=".8"/>
        <path d="M139 98q1-5 7-6 6 0 9 6-8 3-16 0" fill="#e6af57"/>
        <path d="m141 97 2-1m2 2 2-1m2-2 1.4.5m.1 2 2 .3m-8-3 1.6.5"
          fill="none" stroke="#fff0b2" stroke-width=".85" stroke-linecap="round"/>
        <circle cx="147.5" cy="94.5" r="1" fill="#669449"/>
      </g>
      <g class="welcome-plate" data-dish="soup">
        <title>紫菜蛋花汤</title>
        <ellipse cx="174" cy="100" rx="10.5" ry="4.3" fill="#67402a" opacity=".4"/>
        <path d="M164 96h20q-1 7-10 7-9 0-10-7" fill="#79a6ab" stroke="#486770" stroke-width=".8"/>
        <ellipse cx="174" cy="96" rx="10" ry="4.5" fill="#f7ead1" stroke="#557d85" stroke-width="1"/>
        <ellipse cx="174" cy="96.2" rx="7.7" ry="3" fill="#d69b48"/>
        <path d="M168 96q2-2 4-.5l2-.5 2 1.3 2-.5 2 1" fill="none" stroke="#fff0b7" stroke-width="1" stroke-linecap="round"/>
        <path d="m169 96.6 2-.3m3-.8 2 .2m1.5 1.3 1.8-.4" stroke="#3a6d5b" stroke-width="1.2" stroke-linecap="round"/>
      </g>
    </g>`;
  const lights = `
    <g class="welcome-lights">
      <title>迎新暖灯</title>
      <path d="M50 16q34 17 69 0m36 0q54 22 108 0" fill="none" stroke="#a7734f" stroke-width="1.2"/>
      <g fill="#e8a453" opacity=".27">
        <circle cx="58" cy="20" r="8"/><circle cx="78" cy="25" r="8"/><circle cx="97" cy="25" r="8"/><circle cx="113" cy="20" r="8"/>
        <circle cx="162" cy="20" r="8"/><circle cx="185" cy="25" r="8"/><circle cx="209" cy="29" r="8"/>
        <circle cx="234" cy="26" r="8"/><circle cx="256" cy="20" r="8"/>
      </g>
      <g fill="#ffe7a3" stroke="#d8a153" stroke-width=".7">
        <circle cx="58" cy="20" r="2.6"/><circle cx="78" cy="25" r="2.6"/><circle cx="97" cy="25" r="2.6"/><circle cx="113" cy="20" r="2.6"/>
        <circle cx="162" cy="20" r="2.6"/><circle cx="185" cy="25" r="2.6"/><circle cx="209" cy="29" r="2.6"/>
        <circle cx="234" cy="26" r="2.6"/><circle cx="256" cy="20" r="2.6"/>
      </g>
    </g>`;
  const hearth = `
    <g class="welcome-fire">
      <title>迎新壁炉</title>
      <ellipse cx="292" cy="118" rx="26" ry="8" fill="#ef8f46" opacity=".25"/>
      <rect x="272" y="94" width="41" height="29" rx="2" fill="#aa7857" stroke="#64412e" stroke-width="1.2"/>
      <path d="M273 101h39m-39 7h39m-39 7h39m-32-14v7m24-7v7m-27 0v7m23 0v7"
        stroke="#805640" stroke-width=".8" opacity=".8" fill="none"/>
      <path d="M280 119v-9q0-8 12-8t12 8v9z" fill="#36231c"/>
      <path d="M284 118q-3-4 4-9l1 4q7-4 6-8 7 8 4 13z" fill="#ed954b"/>
      <path d="M289 118q-2-3 4-6 1-1 1-3 5 5 2 9z" fill="#ffe4a0"/>
      <path d="m284 120 15-2m-14 0 13 3" stroke="#6d4231" stroke-width="1.6" stroke-linecap="round"/>
      <rect x="269" y="92" width="47" height="5" rx="2" fill="#cf996d"/>
    </g>`;
  /* 头、喙、翅膀、眼皮各自成组，表情才能分开动；眼皮盖在眼睛上半，腮红在颊上 */
  const bird = `
    <title>新住户 · 小南</title>
    <ellipse class="bird-shadow" cx="118" cy="90.5" rx="12" ry="2.8" fill="#574329" opacity=".55"/>
    <g class="bird-rig">
      <path class="bird-tail" d="M111 82q-10-2-11-7 7 1 14 5z" fill="#6597a0" stroke="#456772" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="m114 87 1 3m6-3 1 3" fill="none" stroke="#456772" stroke-width="1.2" stroke-linecap="round"/>
      <ellipse class="bird-body" cx="118" cy="82" rx="10.5" ry="7.2" fill="#82b3c0" stroke="#4a7482" stroke-width=".9"/>
      <path class="bird-wing" d="M114 82q2-5 8-4 1 5-6 7z" fill="#548794"/>
      <g class="bird-head">
        <circle cx="126" cy="75" r="6.8" fill="#bfdee1" stroke="#5e8997" stroke-width=".9"/>
        <ellipse class="bird-blush" cx="123.6" cy="78.3" rx="1.9" ry="1.05" fill="#f2a39c"/>
        <path class="bird-beak" d="m131 76 5 1.5-5 2z" fill="#e9b262"/>
        <path class="bird-joy" d="M126.4 74.8q1.3-2 2.6 0" fill="none" stroke="#233c4a" stroke-width=".9" stroke-linecap="round"/>
        <circle class="bird-eye" cx="127.7" cy="74.2" r="1.2" fill="#233c4a"/>
        <circle class="bird-glare" cx="128" cy="73.9" r=".35" fill="#fff7ed"/>
        <path class="bird-lid" d="M126.3 74.2a1.4 1.4 0 0 1 2.8 0z" fill="#bfdee1"/>
      </g>
    </g>`;
  /* 猫坐在桌子左边的地板上，脸朝着桌上的碗；配色跟院里那只一致 */
  const cat = `
    <g class="story-cat">
      <title>猫 · 室友</title>
      <ellipse class="cat-shadow" cx="92" cy="108.2" rx="9" ry="1.9" fill="#1a110b" opacity=".45"/>
      <g class="cat-rig">
        <path class="cat-tail" d="M86 104q-7.5-1-7.5-8" fill="none" stroke="#4a3a28" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse class="cat-body" cx="92" cy="102.8" rx="7.2" ry="4.7" fill="#4a3a28"/>
        <g class="cat-head">
          <path d="M92.4 90.2 91 84.6l4.4 2.6z" fill="#4a3a28"/>
          <path d="M98.8 90 100.8 84.4l-4.5 2.4z" fill="#4a3a28"/>
          <circle cx="96" cy="93.8" r="4.7" fill="#4a3a28"/>
          <circle class="cat-eye" cx="94.7" cy="93.2" r=".85" fill="#f7ead2"/>
          <circle class="cat-eye" cx="97.9" cy="93.2" r=".85" fill="#f7ead2"/>
          <path d="M95.5 95.8q.7.7 1.4 0" stroke="#f7ead2" stroke-width=".7" fill="none" stroke-linecap="round"/>
        </g>
      </g>
    </g>`;
  /* 首演用的谱架：谱台斜面朝观众，小南站上去唱 */
  const stand = `
    <g class="story-stand">
      <title>谱架</title>
      <ellipse cx="152" cy="110" rx="10" ry="2" fill="#1a110b" opacity=".4"/>
      <path d="M152 109V71m-7 1 7-7 7 3m-14 45 7-3 7 3" fill="none" stroke="#8a7458" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M141 66.5l22-3v11.5l-22 3z" fill="#5a4634" stroke="#3a2c1c" stroke-width="1"/>
      <path d="M144.5 66.8l15-2v8l-15 2z" fill="#f7efdc"/>
      <path d="M146.5 68.6l11-1.5m-11 3.3 11-1.5m-11 3.3 7-1" stroke="#b9a98c" stroke-width=".6"/>
    </g>`;
  const entranceStyle = `
    <style>
      @keyframes welcome-perch {
        0% { transform: translate(-82px, -32px); opacity: 0; }
        70% { transform: translate(0, -6px); opacity: 1; }
        100% { transform: translate(0, 0); opacity: 1; }
      }
      .story-bird.welcome-arriving { animation: welcome-perch .62s ease-out both; }
      body.reduce-motion .story-bird.welcome-arriving { animation: none; }
      @media (prefers-reduced-motion: reduce) {
        .story-bird.welcome-arriving { animation: none; }
      }
    </style>`;

  /* stage 传 "premiere" 是首演：饭桌撤下，小南站上谱架 */
  return (art, story, seated = false, stage = "") => {
    const previous = art.querySelector(".story-decor");
    const wasSeated = !!previous?.querySelector(".story-bird");
    previous?.remove();

    const layer = art.ownerDocument.createElementNS(svgNS, "g");
    layer.setAttribute("class", "story-decor");
    layer.setAttribute("pointer-events", "none");
    layer.setAttribute("aria-hidden", "true");
    layer.dataset.deco = story.deco;
    if (story.beat >= 3) {
      const premiere = stage === "premiere";
      let content = "";
      if (story.beat >= 4 && story.deco === "lamp") content += lights;
      if (story.beat >= 4 && story.deco === "fire") content += hearth;
      if (story.beat >= 4 && (seated || story.beat >= 5)) {
        const arriving = seated && story.beat === 4 && !wasSeated && !premiere;
        if (arriving) content += entranceStyle;
        content += premiere
          ? stand + '<g class="story-bird" transform="translate(33 -24.5)">' + bird + "</g>"
          : `<g class="story-bird${arriving ? " welcome-arriving" : ""}">${bird}</g>`;
        content += cat;
      }
      if (!premiere) content += table;
      layer.innerHTML = content;
    }
    art.appendChild(layer);
  };
})();
