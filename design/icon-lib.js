/* ============================================================
   App 图标库（科技风）
   共用视觉语言：深空底 + 冷光晕 + 青→蓝→紫渐变 + 发光 + 1px 内描边
   用法：NA_ICONS.render(id, idPrefix, { fgScale, noEdge })
   —— fgScale 用于 maskable 图标（内容缩到安全区内）
   ============================================================ */
(function (global) {
  "use strict";

  const BASE_1 = "#0B1024", BASE_2 = "#141C3A";

  function plate(p) {
    return `
  <defs>
    <linearGradient id="${p}bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BASE_1}"/><stop offset="1" stop-color="${BASE_2}"/>
    </linearGradient>
    <radialGradient id="${p}glow" cx="0.3" cy="0.18" r="0.75">
      <stop offset="0" stop-color="#5B8CFF" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#5B8CFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${p}acc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5EEAD4"/><stop offset="0.45" stop-color="#38BDF8"/><stop offset="1" stop-color="#A78BFA"/>
    </linearGradient>
    <filter id="${p}bloom" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${p}soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>
  <rect width="100" height="100" fill="url(#${p}bg)"/>
  <rect width="100" height="100" fill="url(#${p}glow)"/>`;
  }

  const EDGE = `<rect x="0.6" y="0.6" width="98.8" height="98.8" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.2"/>`;

  const ICONS = [
    {
      id: "neural", name: "神经网络核心", tag: "NEURAL",
      desc: "节点与连线构成的脑状网络，最直接表达「脑力 / 智能」，科技感强。",
      fg(p) {
        const outer = [[30,33],[45,25],[61,27],[73,37],[76,52],[69,66],[55,74],[39,71],[27,59],[25,44]];
        const inner = [[45,44],[59,46],[50,58],[38,52]];
        const N = outer.concat(inner);
        const E = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,0],
                   [10,11],[11,12],[12,13],[13,10],
                   [0,10],[1,10],[2,11],[3,11],[4,11],[5,12],[6,12],[7,13],[8,13],[9,13],[10,12],[11,13]];
        const lines = E.map(([a,b]) =>
          `<line x1="${N[a][0]}" y1="${N[a][1]}" x2="${N[b][0]}" y2="${N[b][1]}" stroke="url(#${p}acc)" stroke-width="1.05" stroke-opacity=".55" stroke-linecap="round"/>`).join("");
        const dots = N.map(([x,y],i) => `<circle cx="${x}" cy="${y}" r="${i < 10 ? 2.6 : 3.4}" fill="url(#${p}acc)"/>`).join("");
        return `<g filter="url(#${p}soft)" opacity=".55">${dots}</g>
                <g filter="url(#${p}bloom)">${lines}${dots}</g>
                <circle cx="50" cy="50" r="1.8" fill="#fff" opacity=".9"/>`;
      }
    },
    {
      id: "hexcore", name: "六边芯核", tag: "HEX CORE",
      desc: "六边形框 + 电路走线汇聚到发光内核。极简、对称，缩小后依然锐利。",
      fg(p) {
        const r = 31, cx = 50, cy = 50;
        const pts = [-90,-30,30,90,150,210].map((a) => {
          const t = a * Math.PI / 180;
          return [(cx + r*Math.cos(t)).toFixed(2), (cy + r*Math.sin(t)).toFixed(2)];
        });
        const hex = pts.map((pt) => pt.join(",")).join(" ");
        const traces = pts.map((pt, i) => {
          const nx = pts[(i+1)%6];
          const mx = (parseFloat(pt[0]) + parseFloat(nx[0]))/2, my = (parseFloat(pt[1]) + parseFloat(nx[1]))/2;
          const ix = cx + (mx-cx)*0.42, iy = cy + (my-cy)*0.42;
          return `<line x1="${mx.toFixed(2)}" y1="${my.toFixed(2)}" x2="${ix.toFixed(2)}" y2="${iy.toFixed(2)}" stroke="url(#${p}acc)" stroke-width="1.6" stroke-opacity=".7" stroke-linecap="round"/>
                  <circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="2.5" fill="url(#${p}acc)"/>`;
        }).join("");
        return `<g filter="url(#${p}soft)" opacity=".6"><polygon points="${hex}" fill="none" stroke="url(#${p}acc)" stroke-width="3"/></g>
                <g filter="url(#${p}bloom)">
                  <polygon points="${hex}" fill="none" stroke="url(#${p}acc)" stroke-width="2.4" stroke-linejoin="round"/>
                  ${traces}
                  <rect x="41" y="41" width="18" height="18" rx="5.5" fill="url(#${p}acc)"/>
                </g>
                <rect x="44.5" y="44.5" width="11" height="11" rx="3.4" fill="${BASE_1}" opacity=".55"/>`;
      }
    },
    {
      id: "circuit", name: "电路脑", tag: "CIRCUIT",
      desc: "脑轮廓右半边化为电路走线与触点，「大脑 + 科技」的经典高级表达。",
      fg(p) {
        const brain = "M50 20 C38 20 30 27 29 35 C22 37 19 44 22 50 C19 56 23 63 30 65 C33 73 42 78 50 76";
        const traces = `
          <path d="M50 22 L50 78" stroke="url(#${p}acc)" stroke-width="1.6" stroke-opacity=".45"/>
          <path d="M52 30 H66 V38" fill="none" stroke="url(#${p}acc)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M52 42 H72" fill="none" stroke="url(#${p}acc)" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M52 54 H64 V64" fill="none" stroke="url(#${p}acc)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M52 68 H70" fill="none" stroke="url(#${p}acc)" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="66" cy="38" r="3.1" fill="url(#${p}acc)"/>
          <circle cx="72" cy="42" r="3.1" fill="url(#${p}acc)"/>
          <circle cx="64" cy="64" r="3.1" fill="url(#${p}acc)"/>
          <circle cx="70" cy="68" r="3.1" fill="url(#${p}acc)"/>
          <circle cx="58" cy="30" r="2.1" fill="url(#${p}acc)"/>`;
        return `<g filter="url(#${p}soft)" opacity=".55"><path d="${brain}" fill="none" stroke="url(#${p}acc)" stroke-width="4" stroke-linecap="round"/></g>
                <g filter="url(#${p}bloom)"><path d="${brain}" fill="none" stroke="url(#${p}acc)" stroke-width="2.6" stroke-linecap="round"/>${traces}</g>`;
      }
    },
    {
      id: "orbit", name: "轨道内核", tag: "ORBIT",
      desc: "发光内核 + 双轨道环 + 卫星节点。抽象、克制，很像一线科技产品图标。",
      fg(p) {
        return `<g filter="url(#${p}bloom)">
                  <ellipse cx="50" cy="50" rx="32" ry="13" fill="none" stroke="url(#${p}acc)" stroke-width="2" stroke-opacity=".75" transform="rotate(-28 50 50)"/>
                  <ellipse cx="50" cy="50" rx="32" ry="13" fill="none" stroke="url(#${p}acc)" stroke-width="2" stroke-opacity=".75" transform="rotate(28 50 50)"/>
                </g>
                <g filter="url(#${p}soft)" opacity=".85"><circle cx="50" cy="50" r="11" fill="url(#${p}acc)"/></g>
                <circle cx="50" cy="50" r="10" fill="url(#${p}acc)"/>
                <circle cx="50" cy="50" r="10" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
                <g filter="url(#${p}bloom)">
                  <circle cx="78" cy="36" r="3.6" fill="#5EEAD4"/>
                  <circle cx="22" cy="64" r="3.6" fill="#A78BFA"/>
                  <circle cx="26" cy="34" r="2.6" fill="#38BDF8"/>
                </g>`;
      }
    },
    {
      id: "monogram", name: "N 字芯片", tag: "MONOGRAM",
      desc: "几何化字母 N（NeuroArena）嵌在芯片针脚里，品牌感最强、最像正经 App。",
      fg(p) {
        const pins = [];
        for (let i = 0; i < 4; i++) {
          const y = 34 + i * 11;
          pins.push(`<rect x="14" y="${y}" width="7" height="3.4" rx="1.7" fill="url(#${p}acc)" opacity=".8"/>`);
          pins.push(`<rect x="79" y="${y}" width="7" height="3.4" rx="1.7" fill="url(#${p}acc)" opacity=".8"/>`);
        }
        return `${pins.join("")}
                <rect x="24" y="24" width="52" height="52" rx="14" fill="none" stroke="url(#${p}acc)" stroke-width="2.2" stroke-opacity=".85"/>
                <g filter="url(#${p}bloom)">
                  <path d="M38 66 V34 L62 66 V34" fill="none" stroke="url(#${p}acc)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                </g>
                <circle cx="38" cy="34" r="2.6" fill="#fff" opacity=".9"/>
                <circle cx="62" cy="66" r="2.6" fill="#fff" opacity=".9"/>`;
      }
    },
    {
      id: "prism", name: "棱晶方阵", tag: "PRISM",
      desc: "由方块阵列升起的发光棱柱，呼应 2048 / 连线这类方格玩法，游戏感更强。",
      fg(p) {
        const cells = [];
        [[0,0,.18],[1,0,.30],[2,0,.18],[0,1,.30],[2,1,.30],[0,2,.18],[1,2,.30],[2,2,.18]].forEach(([cx, cy, op]) => {
          cells.push(`<rect x="${28 + cx*16}" y="${28 + cy*16}" width="13" height="13" rx="3.6" fill="url(#${p}acc)" opacity="${op}"/>`);
        });
        return `${cells.join("")}
                <g filter="url(#${p}soft)" opacity=".8"><rect x="44" y="44" width="13" height="13" rx="3.6" fill="url(#${p}acc)"/></g>
                <g filter="url(#${p}bloom)">
                  <rect x="43.5" y="43.5" width="14" height="14" rx="4" fill="url(#${p}acc)"/>
                  <path d="M50 30 V22 M50 78 V70 M30 50 H22 M78 50 H70" stroke="url(#${p}acc)" stroke-width="2.2" stroke-linecap="round" stroke-opacity=".85"/>
                </g>`;
      }
    },
  ];

  function render(id, prefix, opt) {
    const o = opt || {};
    const icon = ICONS.find((x) => x.id === id) || ICONS[0];
    const p = prefix || "x";
    let fg = icon.fg(p);
    if (o.fgScale && o.fgScale !== 1) {
      const s = o.fgScale;
      fg = `<g transform="translate(50,50) scale(${s}) translate(-50,-50)">${fg}</g>`;
    }
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${plate(p)}${fg}${o.noEdge ? "" : EDGE}</svg>`;
  }

  global.NA_ICONS = { ICONS, render, BASE_1, BASE_2 };
})(typeof window !== "undefined" ? window : globalThis);
