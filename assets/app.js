/* ============================================================
   脑力训练场 · NeuroArena
   纯原生 JS · 无依赖 · 直接打开 index.html 即可游玩
   四款经典小游戏：2048 / 连线 / 扫雷 / 记忆翻牌
   每款支持 简单 / 普通 / 困难 三档难度，成绩分档保存
   ============================================================ */
(function () {
  "use strict";

  /* -------------------- 通用工具 -------------------- */
  const app = document.getElementById("app");

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "style" && typeof v === "object") { for (const p in v) { if (p.startsWith("--")) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; } }
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k in el && k !== "list") { try { el[k] = v; } catch (_) { el.setAttribute(k, v); } }
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(c) : c);
    }
    return el;
  }

  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function hexA(hex, a) { hex = hex.replace("#", ""); if (hex.length === 3) hex = hex.split("").map((c) => c + c).join(""); const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})`; }

  /* -------------------- 本地存储 -------------------- */
  const Store = {
    get(key, def) { try { const v = localStorage.getItem("na_" + key); return v == null ? def : JSON.parse(v); } catch (_) { return def; } },
    set(key, val) { try { localStorage.setItem("na_" + key, JSON.stringify(val)); } catch (_) {} },
  };

  /* -------------------- 难度系统 -------------------- */
  const DIFFS = [{ id: "easy", name: "简单" }, { id: "normal", name: "普通" }, { id: "hard", name: "困难" }];
  const diffName = (id) => (DIFFS.find((d) => d.id === id) || DIFFS[1]).name;
  const getDiff = (gameId) => Store.get("diff." + gameId, "normal");
  const setDiff = (gameId, d) => Store.set("diff." + gameId, d);
  const bestKey = (gameId, d) => "best." + gameId + "." + d;
  const getBest = (gameId, d) => Store.get(bestKey(gameId, d), null);
  function recordBest(gameId, d, value, lowerBetter) {
    const cur = getBest(gameId, d);
    const isBest = cur == null || (lowerBetter ? value < cur : value > cur);
    if (isBest) Store.set(bestKey(gameId, d), value);
    return { isBest, best: getBest(gameId, d) };
  }

  /* -------------------- 音效（WebAudio） -------------------- */
  const Sound = {
    ctx: null, on: Store.get("sound", true),
    ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } return this.ctx; },
    beep(freq, dur, type, gain) {
      if (!this.on) return; const ctx = this.ensure(); if (!ctx) return; if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.value = freq; g.gain.value = gain || 0.06; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime; g.gain.setValueAtTime(g.gain.value, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12)); o.start(t); o.stop(t + (dur || 0.12));
    },
    click() { this.beep(520, 0.06, "triangle"); },
    good() { this.beep(660, 0.09, "sine"); setTimeout(() => this.beep(880, 0.12, "sine"), 70); },
    bad() { this.beep(180, 0.2, "sawtooth", 0.05); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.14, "triangle"), i * 90)); },
    pop() { this.beep(760, 0.05, "square", 0.05); },
  };
  const soundBtn = document.getElementById("sound-toggle");
  function refreshSoundBtn() { soundBtn.textContent = Sound.on ? "🔊" : "🔈"; soundBtn.classList.toggle("muted", !Sound.on); }
  soundBtn.addEventListener("click", () => { Sound.on = !Sound.on; Store.set("sound", Sound.on); refreshSoundBtn(); if (Sound.on) Sound.click(); });
  refreshSoundBtn();

  /* -------------------- 主题（深色 / 浅色） -------------------- */
  const root = document.documentElement;
  const Theme = {
    get() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; },
    set(t) { root.setAttribute("data-theme", t); Store.set("theme", t); refreshThemeBtn(); themeRedraws.forEach((fn) => { try { fn(); } catch (_) {} }); },
    toggle() { this.set(this.get() === "dark" ? "light" : "dark"); },
  };
  const themeBtn = document.getElementById("theme-toggle");
  function refreshThemeBtn() { themeBtn.textContent = Theme.get() === "light" ? "☀️" : "🌙"; themeBtn.title = Theme.get() === "light" ? "切换到深色" : "切换到浅色"; }
  if (!root.getAttribute("data-theme")) { const stored = Store.get("theme", null); root.setAttribute("data-theme", stored || (window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")); }
  themeBtn.addEventListener("click", () => { Theme.toggle(); Sound.click(); });
  refreshThemeBtn();

  /* -------------------- toast -------------------- */
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = h("div", { class: "toast" }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1500);
  }

  /* -------------------- 路由 -------------------- */
  let currentGame = null;
  let themeRedraws = [];
  function leaveGame() { if (currentGame && currentGame.teardown) { try { currentGame.teardown(); } catch (_) {} } currentGame = null; }
  function mount(node) { leaveGame(); themeRedraws = []; app.innerHTML = ""; app.appendChild(node); window.scrollTo(0, 0); }
  function goHome() { mount(renderHome()); }
  document.getElementById("brand-home").addEventListener("click", goHome);
  document.getElementById("brand-home").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") goHome(); });
  document.getElementById("stats-btn").addEventListener("click", () => { Sound.click(); showStats(); });

  const accentVars = (name) => ({ "--accent": `var(--${name})`, "--accent-2": `var(--${name}-2)` });

  /* -------------------- 游戏元信息 -------------------- */
  const GAMES = [
    { id: "g2048", icon: "🔢", name: "2048", tag: "MERGE", skill: "合并", accent: "logic",
      desc: "滑动合并相同数字，一路合成 2048 乃至更高。规划与数感，经典耐玩。",
      lowerBetter: false, bestLabel: (v) => v + " 分", start: start2048 },
    { id: "flow", icon: "🔗", name: "连线", tag: "FLOW", skill: "连接", accent: "spatial",
      desc: "用不交叉的线把同色圆点两两连起来，并铺满整个棋盘。空间规划、解压。",
      lowerBetter: true, bestLabel: (v) => (v / 1000).toFixed(1) + " 秒", start: startFlow },
    { id: "mine", icon: "💣", name: "扫雷", tag: "MINESWEEPER", skill: "推理", accent: "reason",
      desc: "根据数字推断地雷位置，插旗并翻开所有安全格。纯逻辑推理的经典。",
      lowerBetter: true, bestLabel: (v) => (v / 1000).toFixed(1) + " 秒", start: startMine },
    { id: "memory", icon: "🃏", name: "记忆翻牌", tag: "MEMORY", skill: "记忆", accent: "reaction",
      desc: "翻牌记住图案位置，找出所有相同的一对。步数越少越好，简单上手。",
      lowerBetter: true, bestLabel: (v) => v + " 步", start: startMemory },
  ];
  const meta = (id) => GAMES.find((g) => g.id === id);

  /* ==========================================================
     首页
     ========================================================== */
  function renderHome() {
    const cards = GAMES.map((g) => {
      const d = getDiff(g.id), b = getBest(g.id, d);
      return h("button", { class: "game-card" + (g.featured ? " featured" : ""), style: accentVars(g.accent), onclick: () => { Sound.click(); g.start(getDiff(g.id)); } },
        h("div", { class: "gc-top" }, h("div", { class: "gc-icon" }, g.icon), h("div", { class: "gc-title" }, h("b", null, g.name), h("span", null, g.skill + " · " + g.tag))),
        h("p", { class: "gc-desc" }, g.desc),
        h("div", { class: "gc-foot" }, h("span", { class: "gc-best" }, b == null ? "尚无记录" : ["最佳 ", h("b", null, g.bestLabel(b)), " · " + diffName(d)]), h("span", { class: "gc-play" }, "开始 ▶")));
    });
    return h("section", { class: "screen" },
      h("div", { class: "home-intro" }, h("h1", null, "选择你的游戏"), h("p", null, "四款经典小游戏 · 三档难度 · 成绩自动保存在本地。想放松就来一局 🎮")),
      h("div", { class: "card-grid" }, cards));
  }

  /* -------------------- 游戏外壳 -------------------- */
  function diffBar(game, curDiff) {
    const bar = h("div", { class: "diffbar" }, h("span", { class: "diffbar-label" }, "难度"));
    DIFFS.forEach((d) => bar.appendChild(h("button", { class: "diff-seg" + (d.id === curDiff ? " active" : ""), onclick: () => { if (d.id === curDiff) return; Sound.click(); setDiff(game.id, d.id); game.start(d.id); } }, d.name)));
    return bar;
  }
  function gameShell(game, curDiff, pills) {
    const head = h("div", { class: "game-head" },
      h("button", { class: "back-btn", onclick: () => { Sound.click(); goHome(); } }, "‹ 返回"),
      h("h2", null, game.icon + " " + game.name), h("div", { class: "spacer" }), h("div", { class: "stat-pills" }, pills || []));
    const panel = h("div", { class: "panel" });
    const section = h("section", { class: "screen", style: accentVars(game.accent) }, head, diffBar(game, curDiff), panel);
    return { section, panel, head };
  }
  function bestPillEl(game, diff) { const b = getBest(game.id, diff); return h("div", { class: "pill accent" }, "最佳 ", h("b", null, b == null ? "—" : game.bestLabel(b))); }
  function howto(goal, ...detail) {
    return h("details", { class: "howto" }, h("summary", null, h("span", { class: "howto-goal" }, goal), h("span", { class: "howto-more" }, "玩法说明")), h("div", { class: "howto-body" }, ...detail));
  }
  function resultCard(opts) {
    return h("div", { class: "result-card" },
      h("div", { class: "result-emoji" }, opts.emoji),
      opts.isBest ? h("div", { class: "new-best" }, "新纪录！") : null,
      h("h3", null, opts.title),
      opts.big != null ? h("div", { class: "big-num" }, opts.big) : null,
      h("div", { class: "sub" }, opts.sub),
      opts.extra || null,
      h("div", { class: "row center" }, h("button", { class: "btn", onclick: opts.onRetry }, "再来一局"), h("button", { class: "btn ghost", onclick: goHome }, "返回首页")));
  }

  /* ==========================================================
     1) 2048 · 数字合并
     ========================================================== */
  const G2048_CFG = { easy: { n: 6 }, normal: { n: 5 }, hard: { n: 4 } };
  const TILE = { 2: ["#eee4da", "#6d6459"], 4: ["#ede0c8", "#6d6459"], 8: ["#f2b179", "#fff"], 16: ["#f59563", "#fff"], 32: ["#f67c5f", "#fff"], 64: ["#f65e3b", "#fff"], 128: ["#edcf72", "#fff"], 256: ["#edcc61", "#fff"], 512: ["#edc850", "#fff"], 1024: ["#edc53f", "#fff"], 2048: ["#edc22e", "#fff"] };
  function start2048(diff) {
    diff = diff || getDiff("g2048");
    const game = meta("g2048"), N = G2048_CFG[diff].n;
    let grid, score = 0, over = false, won = false;
    const scorePill = h("div", { class: "pill accent" }, "得分 ", h("b", null, "0"));
    const bestPill = bestPillEl(game, diff);
    const shell = gameShell(game, diff, [scorePill, bestPill]);
    shell.panel.appendChild(howto("滑动屏幕（或用方向键）合并相同数字，冲更高分",
      "相同数字相撞合并成两倍，每次移动会新出现一个 2 或 4。棋盘越小越难。无法移动即结束；合成 ", h("b", null, "2048"), " 达成目标，还可继续冲分。"));
    const boardWrap = h("div", { class: "g2048-wrap", style: { touchAction: "none" } });
    const boardEl = h("div", { class: "g2048-grid", style: { gridTemplateColumns: "repeat(" + N + ",1fr)" } });
    boardWrap.appendChild(boardEl); shell.panel.appendChild(boardWrap);
    const statusEl = h("div", { class: "center", style: { minHeight: "22px", color: "var(--accent)", fontWeight: "700", margin: "10px 0 2px" } });
    shell.panel.appendChild(statusEl);
    shell.panel.appendChild(h("div", { class: "row center mt" }, h("button", { class: "btn ghost", onclick: () => { Sound.click(); reset(); } }, "重新开始")));

    function reset() { grid = Array.from({ length: N }, () => Array(N).fill(0)); score = 0; over = false; won = false; statusEl.textContent = ""; addTile(); addTile(); render(); }
    function empties() { const e = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) e.push([r, c]); return e; }
    function addTile() { const e = empties(); if (!e.length) return; const [r, c] = pick(e); grid[r][c] = Math.random() < 0.9 ? 2 : 4; }
    function render() {
      boardEl.innerHTML = "";
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const v = grid[r][c];
        const st = v ? TILE[v] || ["#3c3a32", "#fff"] : null;
        const cell = h("div", { class: "g2048-cell" + (v ? " filled" : "") + (v >= 128 ? " big" : "") + (v >= 1024 ? " huge" : ""), style: st ? { background: st[0], color: st[1] } : null }, v ? String(v) : "");
        boardEl.appendChild(cell);
      }
      scorePill.querySelector("b").textContent = String(score);
    }
    function slide(line) {
      let arr = line.filter((x) => x), gained = 0;
      for (let i = 0; i < arr.length - 1; i++) if (arr[i] === arr[i + 1]) { arr[i] *= 2; gained += arr[i]; if (arr[i] === 2048) won = true; arr.splice(i + 1, 1); }
      while (arr.length < line.length) arr.push(0);
      return { line: arr, gained, moved: arr.some((x, i) => x !== line[i]) };
    }
    function coord(dir, i, j) { if (dir === 3) return [i, j]; if (dir === 1) return [i, N - 1 - j]; if (dir === 0) return [j, i]; return [N - 1 - j, i]; }
    function move(dir) {
      if (over) return;
      let moved = false;
      for (let i = 0; i < N; i++) {
        const line = []; for (let j = 0; j < N; j++) { const [r, c] = coord(dir, i, j); line.push(grid[r][c]); }
        const res = slide(line); if (res.moved) moved = true; score += res.gained;
        for (let j = 0; j < N; j++) { const [r, c] = coord(dir, i, j); grid[r][c] = res.line[j]; }
      }
      if (moved) { addTile(); render(); Sound.click(); if (won && !statusEl.textContent) statusEl.textContent = "🎉 达成 2048！继续冲更高分"; if (!canMove()) { over = true; setTimeout(finish, 260); } }
    }
    function canMove() { if (empties().length) return true; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (c + 1 < N && grid[r][c] === grid[r][c + 1]) return true; if (r + 1 < N && grid[r][c] === grid[r + 1][c]) return true; } return false; }
    function finish() {
      const rec = recordBest("g2048", diff, score, false);
      Sound.win();
      shell.panel.innerHTML = "";
      shell.panel.appendChild(resultCard({ emoji: won ? "🏆" : "🧩", isBest: rec.isBest && score > 0, title: won ? "厉害！" : "无路可走啦", big: score + " 分", sub: (won ? "已达成 2048 · " : "") + diffName(diff) + "最佳 " + (rec.best || 0) + " 分", onRetry: () => start2048(diff) }));
    }
    const onKey = (e) => { let d = -1; const k = e.key; if (k === "ArrowUp") d = 0; else if (k === "ArrowRight") d = 1; else if (k === "ArrowDown") d = 2; else if (k === "ArrowLeft") d = 3; if (d >= 0) { e.preventDefault(); move(d); } };
    window.addEventListener("keydown", onKey);
    let sx = 0, sy = 0, swiping = false;
    boardWrap.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; swiping = true; boardWrap.setPointerCapture && boardWrap.setPointerCapture(e.pointerId); });
    boardWrap.addEventListener("pointerup", (e) => { if (!swiping) return; swiping = false; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return; if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : 3); else move(dy > 0 ? 2 : 0); });
    reset(); mount(shell.section);
    currentGame = { teardown() { window.removeEventListener("keydown", onKey); } };
  }

  /* ==========================================================
     2) 连线 · Flow（不交叉连通 + 铺满）
     ========================================================== */
  const FLOW_CFG = { easy: { n: 5 }, normal: { n: 6 }, hard: { n: 7 } };
  const FLOW_COLORS = ["#ff5d6c", "#40c4ff", "#ffb020", "#2fd39a", "#b388ff", "#ff7ac0", "#ffe45e", "#5ad1c9", "#8b7dff", "#fa8c16", "#13c2c2", "#a0d911", "#eb2f96", "#597ef7"];
  // 快速生成随机哈密顿路径（backbite 算法）：从蛇形路径出发，反复对端点做“回咬”
  // 变换，始终保持覆盖全部格子。相比随机 DFS 不会指数级回溯、不会卡死。
  function randomHamil(N) {
    const path = []; for (let r = 0; r < N; r++) { if (r % 2 === 0) for (let c = 0; c < N; c++) path.push([r, c]); else for (let c = N - 1; c >= 0; c--) path.push([r, c]); }
    const n = path.length, pos = new Int32Array(N * N), id = (r, c) => r * N + c;
    for (let k = 0; k < n; k++) pos[id(path[k][0], path[k][1])] = k;
    const revSeg = (lo, hi) => { while (lo < hi) { const a = path[lo], b = path[hi]; path[lo] = b; path[hi] = a; pos[id(b[0], b[1])] = lo; pos[id(a[0], a[1])] = hi; lo++; hi--; } };
    const nb = (r, c) => { const o = []; if (c + 1 < N) o.push([r, c + 1]); if (c - 1 >= 0) o.push([r, c - 1]); if (r + 1 < N) o.push([r + 1, c]); if (r - 1 >= 0) o.push([r - 1, c]); return o; };
    const K = n * 12;
    for (let s = 0; s < K; s++) {
      if (rand(2)) { const t = path[n - 1], cand = []; for (const [nr, nc] of nb(t[0], t[1])) { const i = pos[id(nr, nc)]; if (i <= n - 3) cand.push(i); } if (cand.length) revSeg(cand[rand(cand.length)] + 1, n - 1); }
      else { const t = path[0], cand = []; for (const [nr, nc] of nb(t[0], t[1])) { const i = pos[id(nr, nc)]; if (i >= 2) cand.push(i); } if (cand.length) revSeg(0, cand[rand(cand.length)] - 1); }
    }
    return path;
  }
  // 生成保证可解的连线谜题：随机哈密顿路径 → 切成若干段 → 每段两端为一对同色端点
  function genFlow(N) {
    const path = randomHamil(N);
    const maxColors = FLOW_COLORS.length;
    let segs = [], i = 0;
    while (i < path.length) { const remaining = path.length - i; let len = 2 + rand(4); if (len > remaining) len = remaining; if (remaining - len === 1) len = remaining; segs.push(path.slice(i, i + len)); i += len; }
    // 颜色过多时，把最短的段并入相邻段（相邻段在路径上连续，合并后仍是合法通路，且不会产生长度 1 的段）
    while (segs.length > maxColors) {
      let mi = 0; for (let k = 1; k < segs.length; k++) if (segs[k].length < segs[mi].length) mi = k;
      const j = mi === 0 ? 1 : (mi === segs.length - 1 ? mi - 1 : (segs[mi - 1].length <= segs[mi + 1].length ? mi - 1 : mi + 1));
      const lo = Math.min(mi, j); segs[lo] = segs[lo].concat(segs[lo + 1]); segs.splice(lo + 1, 1);
    }
    return { N, endpoints: segs.map((s) => [s[0], s[s.length - 1]]) };
  }
  function startFlow(diff) {
    diff = diff || getDiff("flow");
    const game = meta("flow"), N = FLOW_CFG[diff].n;
    const puz = genFlow(N), COLORS = puz.endpoints.length;
    const owner = Array.from({ length: N }, () => Array(N).fill(-1)); // 每格归属颜色
    const isEnd = Array.from({ length: N }, () => Array(N).fill(-1)); // 端点归属颜色
    const paths = {}; // color -> [[r,c]...]
    const done = {}; // color -> bool
    puz.endpoints.forEach(([a, b], col) => { isEnd[a[0]][a[1]] = col; isEnd[b[0]][b[1]] = col; owner[a[0]][a[1]] = col; owner[b[0]][b[1]] = col; });

    let startAt = 0, started = false, tickTimer = null, finished = false;
    const pipePill = h("div", { class: "pill accent" }, "连通 ", h("b", null, "0/" + COLORS));
    const fillPill = h("div", { class: "pill" }, "覆盖 ", h("b", null, "0%"));
    const timePill = h("div", { class: "pill" }, "⏱ ", h("b", null, "0.0s"));
    const shell = gameShell(game, diff, [pipePill, fillPill, timePill]);
    shell.panel.appendChild(howto("从一个圆点按住拖到同色的另一个圆点，连线不能交叉",
      "把每一对同色圆点用线连起来，并且 ", h("b", null, "铺满整个棋盘"), " 才算通关。再次从某个圆点拖动可重画该颜色；用时越短越好。"));
    const boardWrap = h("div", { class: "flow-wrap", style: { touchAction: "none" } });
    const boardEl = h("div", { class: "flow-grid", style: { gridTemplateColumns: "repeat(" + N + ",1fr)" } });
    boardWrap.appendChild(boardEl); shell.panel.appendChild(boardWrap);
    shell.panel.appendChild(h("div", { class: "row center mt" }, h("button", { class: "btn ghost", onclick: () => { Sound.click(); startFlow(diff); } }, "换一题"), h("button", { class: "btn ghost", onclick: () => { Sound.click(); clearAll(); } }, "清空")));

    const cells = [];
    for (let r = 0; r < N; r++) { cells[r] = []; for (let c = 0; c < N; c++) { const el = h("div", { class: "flow-cell" }); cells[r][c] = el; boardEl.appendChild(el); } }

    function paint() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const el = cells[r][c], col = owner[r][c];
        el.className = "flow-cell" + (isEnd[r][c] >= 0 ? " endpoint" : "") + (col >= 0 && isEnd[r][c] < 0 ? " path" : "");
        el.innerHTML = "";
        if (col >= 0) { el.style.setProperty("--pc", FLOW_COLORS[col]); if (isEnd[r][c] >= 0) el.appendChild(h("span", { class: "flow-dot" })); }
        else el.style.removeProperty("--pc");
      }
      const connected = Object.keys(done).filter((k) => done[k]).length;
      let filled = 0; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (owner[r][c] >= 0) filled++;
      pipePill.querySelector("b").textContent = connected + "/" + COLORS;
      fillPill.querySelector("b").textContent = Math.round(filled / (N * N) * 100) + "%";
    }
    function clearColor(col) { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (owner[r][c] === col && isEnd[r][c] < 0) owner[r][c] = -1; paths[col] = null; done[col] = false; }
    function clearAll() { for (let col = 0; col < COLORS; col++) clearColor(col); paint(); }

    let drawing = false, drawCol = -1;
    function cellFromXY(x, y) { const rect = boardEl.getBoundingClientRect(); const cw = rect.width / N, ch = rect.height / N; const c = Math.floor((x - rect.left) / cw), r = Math.floor((y - rect.top) / ch); if (r < 0 || r >= N || c < 0 || c >= N) return null; return [r, c]; }
    const adj = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

    function begin(e) {
      if (finished) return;
      const p = cellFromXY(e.clientX, e.clientY); if (!p) return;
      const [r, c] = p; const col = isEnd[r][c];
      if (col < 0) return; // 只能从端点起笔
      if (!started) { started = true; startAt = performance.now(); tickTimer = setInterval(() => timePill.querySelector("b").textContent = ((performance.now() - startAt) / 1000).toFixed(1) + "s", 100); }
      clearColor(col);
      drawing = true; drawCol = col; paths[col] = [[r, c]]; owner[r][c] = col;
      boardEl.setPointerCapture && boardEl.setPointerCapture(e.pointerId);
      Sound.pop(); paint();
    }
    function extend(e) {
      if (!drawing) return;
      const p = cellFromXY(e.clientX, e.clientY); if (!p) return;
      const path = paths[drawCol]; const last = path[path.length - 1];
      if (p[0] === last[0] && p[1] === last[1]) return;
      // 回退
      if (path.length >= 2) { const prev = path[path.length - 2]; if (p[0] === prev[0] && p[1] === prev[1]) { if (isEnd[last[0]][last[1]] < 0) owner[last[0]][last[1]] = -1; path.pop(); paint(); return; } }
      if (!adj(p, last)) return;
      const [r, c] = p; const cellOwner = owner[r][c], endCol = isEnd[r][c];
      if (endCol === drawCol && !(path.length && path.some((q) => q[0] === r && q[1] === c))) {
        // 到达同色另一端点 → 完成
        path.push([r, c]); owner[r][c] = drawCol; done[drawCol] = true; drawing = false; Sound.good(); paint(); checkWin(); return;
      }
      if (cellOwner === -1) { owner[r][c] = drawCol; path.push([r, c]); paint(); }
      // 其余情况（被别的颜色占用 / 别人的端点）忽略
    }
    function end() { if (drawing) { drawing = false; paint(); } }
    boardEl.addEventListener("pointerdown", begin);
    boardEl.addEventListener("pointermove", extend);
    boardEl.addEventListener("pointerup", end);
    boardEl.addEventListener("pointercancel", end);

    function checkWin() {
      const allDone = Object.keys(done).filter((k) => done[k]).length === COLORS;
      let filled = 0; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (owner[r][c] >= 0) filled++;
      if (allDone && filled === N * N) finish();
    }
    function finish() {
      finished = true; clearInterval(tickTimer); tickTimer = null;
      const ms = Math.round(performance.now() - startAt);
      const rec = recordBest("flow", diff, ms, true); Sound.win();
      shell.panel.innerHTML = "";
      shell.panel.appendChild(resultCard({ emoji: "🎉", isBest: rec.isBest, title: "全部连通并铺满！", big: (ms / 1000).toFixed(1) + " 秒", sub: diffName(diff) + "最佳 " + (rec.best / 1000).toFixed(1) + " 秒", onRetry: () => startFlow(diff) }));
    }
    paint(); mount(shell.section);
    currentGame = { teardown() { clearInterval(tickTimer); } };
  }

  /* ==========================================================
     3) 扫雷 · Minesweeper
     ========================================================== */
  const MINE_CFG = { easy: { r: 9, c: 9, m: 10 }, normal: { r: 12, c: 12, m: 26 }, hard: { r: 14, c: 14, m: 45 } };
  const MINE_NUM = ["", "#2b8bff", "#17a877", "#ff5d6c", "#8b5cf6", "#ff7a1a", "#13c2c2", "#eb2f96", "#8a8a8a"];
  function startMine(diff) {
    diff = diff || getDiff("mine");
    const game = meta("mine"), cfg = MINE_CFG[diff], R = cfg.r, C = cfg.c, M = cfg.m;
    let grid = Array.from({ length: R }, () => Array.from({ length: C }, () => ({ mine: false, rev: false, flag: false, adj: 0 })));
    let started = false, over = false, win = false, revealedCount = 0, flags = 0, startAt = 0, tickTimer = null, flagMode = false;
    const minePill = h("div", { class: "pill accent" }, "💣 ", h("b", null, String(M)));
    const timePill = h("div", { class: "pill" }, "⏱ ", h("b", null, "0"));
    const bestPill = bestPillEl(game, diff);
    const shell = gameShell(game, diff, [minePill, timePill, bestPill]);
    shell.panel.appendChild(howto("翻开安全格，数字代表周围 8 格里的地雷数",
      "推断出雷的位置，翻开所有非雷格即获胜（用时越短越好）。切到 ", h("b", null, "🚩标记"), " 模式可插旗（手机长按格子也能插旗），", h("b", null, "首次点击必定安全"), "。"));
    const modeBtn = h("button", { class: "btn ghost", onclick: () => { flagMode = !flagMode; modeBtn.textContent = flagMode ? "🚩 标记模式（点我切回）" : "⛏️ 挖开模式（点我切换标记）"; } }, "⛏️ 挖开模式（点我切换标记）");
    shell.panel.appendChild(h("div", { class: "row center", style: { marginBottom: "12px" } }, modeBtn));
    const boardWrap = h("div", { class: "mine-wrap" });
    const boardEl = h("div", { class: "mine-grid", style: { gridTemplateColumns: "repeat(" + C + ",1fr)" } });
    boardWrap.appendChild(boardEl); shell.panel.appendChild(boardWrap);

    function place(sr, sc) {
      const forbid = new Set(); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = sr + dr, c = sc + dc; if (r >= 0 && r < R && c >= 0 && c < C) forbid.add(r * C + c); }
      const cells = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (!forbid.has(r * C + c)) cells.push([r, c]);
      shuffle(cells).slice(0, M).forEach(([r, c]) => grid[r][c].mine = true);
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < R && cc >= 0 && cc < C && grid[rr][cc].mine) n++; } grid[r][c].adj = n; }
    }
    function reveal(r, c) {
      const cell = grid[r][c]; if (cell.rev || cell.flag) return;
      cell.rev = true; revealedCount++;
      if (cell.mine) { over = true; return; }
      if (cell.adj === 0) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < R && cc >= 0 && cc < C) reveal(rr, cc); }
    }
    function toggleFlag(r, c) { const cell = grid[r][c]; if (cell.rev) return; cell.flag = !cell.flag; flags += cell.flag ? 1 : -1; minePill.querySelector("b").textContent = String(M - flags); Sound.click(); render(); }
    function dig(r, c) {
      if (grid[r][c].flag || grid[r][c].rev) return;
      reveal(r, c); Sound.pop();
      if (over) { render(); return lose(); }
      if (revealedCount === R * C - M) { over = true; win = true; render(); return won(); }
      render();
    }
    function onCell(r, c) {
      if (over) return;
      if (!started) { place(r, c); started = true; startAt = performance.now(); tickTimer = setInterval(() => timePill.querySelector("b").textContent = String(Math.floor((performance.now() - startAt) / 1000)), 250); }
      if (flagMode) toggleFlag(r, c); else dig(r, c);
    }
    // 长按插旗
    let lpTimer = null, lpCell = null;
    function render() {
      boardEl.innerHTML = "";
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const cell = grid[r][c];
        let cls = "mine-cell", txt = "", col = null;
        if (cell.rev) { cls += " rev"; if (cell.mine) { cls += " boom"; txt = "💣"; } else if (cell.adj > 0) { txt = String(cell.adj); col = MINE_NUM[cell.adj]; } }
        else if (cell.flag) { txt = "🚩"; }
        const el = h("div", { class: cls, style: col ? { color: col } : null }, txt);
        (function (rr, cc) {
          el.addEventListener("pointerdown", (e) => { lpCell = [rr, cc]; lpTimer = setTimeout(() => { lpTimer = null; if (!over && !grid[rr][cc].rev) toggleFlag(rr, cc); }, 380); });
          const cancel = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
          el.addEventListener("pointerup", () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; onCell(rr, cc); } });
          el.addEventListener("pointerleave", cancel); el.addEventListener("pointercancel", cancel);
          el.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!over) toggleFlag(rr, cc); });
        })(r, c);
        boardEl.appendChild(el);
      }
    }
    function revealAllMines() { for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c].mine) grid[r][c].rev = true; render(); }
    function lose() { clearInterval(tickTimer); tickTimer = null; Sound.bad(); revealAllMines(); shell.panel.appendChild(resultBar("💥 踩雷了", "再来一局", () => startMine(diff))); }
    function won() {
      clearInterval(tickTimer); tickTimer = null; const ms = Math.round(performance.now() - startAt);
      const rec = recordBest("mine", diff, ms, true); Sound.win();
      shell.panel.innerHTML = ""; shell.panel.appendChild(resultCard({ emoji: "🎉", isBest: rec.isBest, title: "全部扫清！", big: (ms / 1000).toFixed(1) + " 秒", sub: diffName(diff) + "最佳 " + (rec.best / 1000).toFixed(1) + " 秒", onRetry: () => startMine(diff) }));
    }
    function resultBar(text, btn, fn) {
      return h("div", { class: "center mt" }, h("div", { style: { fontSize: "18px", fontWeight: "700", margin: "8px 0 12px" } }, text),
        h("div", { class: "row center" }, h("button", { class: "btn", onclick: fn }, btn), h("button", { class: "btn ghost", onclick: goHome }, "返回首页")));
    }
    render(); mount(shell.section);
    currentGame = { teardown() { clearInterval(tickTimer); } };
  }

  /* ==========================================================
     4) 记忆翻牌 · Memory Match
     ========================================================== */
  const MEM_CFG = { easy: { r: 4, c: 4 }, normal: { r: 4, c: 5 }, hard: { r: 6, c: 6 } };
  const MEM_EMOJI = ["🍎", "🍊", "🍋", "🍇", "🍉", "🍓", "🍒", "🥝", "🍑", "🥥", "🍍", "🥭", "🍌", "🫐", "🥑", "🍅", "🌽", "🥕", "🍆", "🫑"];
  function startMemory(diff) {
    diff = diff || getDiff("memory");
    const game = meta("memory"), cfg = MEM_CFG[diff], R = cfg.r, C = cfg.c, PAIRS = R * C / 2;
    let moves = 0, matched = 0, flipped = [], lock = false, started = false, startAt = 0;
    const movesPill = h("div", { class: "pill accent" }, "步数 ", h("b", null, "0"));
    const pairsPill = h("div", { class: "pill" }, "配对 ", h("b", null, "0/" + PAIRS));
    const bestPill = bestPillEl(game, diff);
    const shell = gameShell(game, diff, [movesPill, pairsPill, bestPill]);
    shell.panel.appendChild(howto("翻开两张卡片，找出所有相同的一对",
      "记住翻开过的图案位置，把每次翻牌都用在刀刃上。全部配对成功即通关，", h("b", null, "步数越少越好"), "。"));
    const faces = shuffle([...MEM_EMOJI.slice(0, PAIRS), ...MEM_EMOJI.slice(0, PAIRS)]);
    const grid = h("div", { class: "mem-grid", style: { gridTemplateColumns: "repeat(" + C + ",1fr)" } });
    const cards = faces.map((face, i) => { const el = h("button", { class: "mem-card", onclick: () => flip(i) }, h("span", { class: "mem-face" }, face)); return { face, el, done: false, up: false }; });
    cards.forEach((c) => grid.appendChild(c.el));
    shell.panel.appendChild(grid);

    function flip(i) {
      const c = cards[i]; if (lock || c.up || c.done) return;
      if (!started) { started = true; startAt = performance.now(); }
      c.up = true; c.el.classList.add("up"); Sound.pop(); flipped.push(i);
      if (flipped.length === 2) {
        moves++; movesPill.querySelector("b").textContent = String(moves); lock = true;
        const [a, b] = flipped;
        if (cards[a].face === cards[b].face) setTimeout(() => { cards[a].done = cards[b].done = true; cards[a].el.classList.add("done"); cards[b].el.classList.add("done"); matched++; pairsPill.querySelector("b").textContent = matched + "/" + PAIRS; flipped = []; lock = false; Sound.good(); if (matched === PAIRS) finish(); }, 320);
        else setTimeout(() => { cards[a].up = cards[b].up = false; cards[a].el.classList.remove("up"); cards[b].el.classList.remove("up"); flipped = []; lock = false; Sound.bad(); }, 820);
      }
    }
    function finish() {
      const ms = Math.round(performance.now() - startAt);
      const rec = recordBest("memory", diff, moves, true); Sound.win();
      shell.panel.innerHTML = "";
      shell.panel.appendChild(resultCard({ emoji: "🎉", isBest: rec.isBest, title: "全部配对成功！", big: moves + " 步", sub: "用时 " + (ms / 1000).toFixed(1) + " 秒 · " + diffName(diff) + "最佳 " + rec.best + " 步", onRetry: () => startMemory(diff) }));
    }
    mount(shell.section); currentGame = { teardown() {} };
  }

  /* ==========================================================
     成绩总览
     ========================================================== */
  function showStats() {
    const any = GAMES.some((g) => DIFFS.some((d) => getBest(g.id, d.id) != null));
    const head = h("div", { class: "game-head" }, h("button", { class: "back-btn", onclick: () => { Sound.click(); goHome(); } }, "‹ 返回"), h("h2", null, "📊 成绩总览"), h("div", { class: "spacer" }));
    const panel = h("div", { class: "panel" });
    const section = h("section", { class: "screen", style: { "--accent": "var(--profile)", "--accent-2": "var(--profile)" } }, head, panel);
    if (!any) {
      panel.appendChild(h("div", { class: "stats-empty" }, h("div", { class: "result-emoji" }, "📊"), h("h3", { style: { margin: "8px 0 6px" } }, "还没有任何成绩"), h("p", { class: "hint", style: { textAlign: "center" } }, "先去玩几局，这里会汇总你在各游戏、各难度下的最佳成绩。"), h("div", { class: "row center" }, h("button", { class: "btn", onclick: goHome }, "去玩一局 ▶"))));
      mount(section); currentGame = { teardown() {} }; return;
    }
    const rows = GAMES.map((g) => h("tr", null,
      h("td", null, h("span", { class: "mod" }, h("span", { class: "i" }, g.icon), g.name)),
      ...DIFFS.map((d) => { const b = getBest(g.id, d.id); return h("td", null, b == null ? "—" : g.bestLabel(b)); })));
    panel.appendChild(h("div", { class: "stats-table-wrap" }, h("table", { class: "stats-table" },
      h("thead", null, h("tr", null, h("th", null, "游戏"), ...DIFFS.map((d) => h("th", null, d.name)))),
      h("tbody", null, rows))));
    panel.appendChild(h("p", { class: "stats-note" }, "2048 记最高分（越高越好）；连线、扫雷记最短用时；记忆翻牌记最少步数（越小越好）。"));
    mount(section); currentGame = { teardown() {} };
  }

  /* -------------------- 启动 -------------------- */
  goHome();
})();
