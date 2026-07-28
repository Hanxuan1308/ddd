/* ============================================================
   脑力训练场 · NeuroArena
   纯原生 JS · 无依赖 · 直接打开 index.html 即可游玩
   四个训练模块：推理 / 思维 / 反应 / 维度
   ============================================================ */
(function () {
  "use strict";

  /* -------------------- 通用工具 -------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const app = document.getElementById("app");

  // 迷你 DOM 构建器：h("div", {class:"x", onclick:fn}, child1, child2...)
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function")
          el.addEventListener(k.slice(2).toLowerCase(), v);
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
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* -------------------- 本地存储（最佳成绩） -------------------- */
  const Store = {
    get(key, def) { try { const v = localStorage.getItem("na_" + key); return v == null ? def : JSON.parse(v); } catch (_) { return def; } },
    set(key, val) { try { localStorage.setItem("na_" + key, JSON.stringify(val)); } catch (_) {} },
  };

  /* -------------------- 音效（WebAudio，无需素材） -------------------- */
  const Sound = {
    ctx: null,
    on: Store.get("sound", true),
    ensure() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } return this.ctx; },
    beep(freq, dur, type, gain) {
      if (!this.on) return;
      const ctx = this.ensure(); if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.value = gain || 0.06;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
      o.start(t); o.stop(t + (dur || 0.12));
    },
    click() { this.beep(520, 0.06, "triangle"); },
    good() { this.beep(660, 0.09, "sine"); setTimeout(() => this.beep(880, 0.12, "sine"), 70); },
    bad() { this.beep(180, 0.2, "sawtooth", 0.05); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.14, "triangle"), i * 90)); },
    pop() { this.beep(760, 0.05, "square", 0.05); },
  };

  const soundBtn = document.getElementById("sound-toggle");
  function refreshSoundBtn() {
    soundBtn.textContent = Sound.on ? "🔊" : "🔈";
    soundBtn.classList.toggle("muted", !Sound.on);
  }
  soundBtn.addEventListener("click", () => {
    Sound.on = !Sound.on; Store.set("sound", Sound.on); refreshSoundBtn();
    if (Sound.on) Sound.click();
  });
  refreshSoundBtn();

  /* -------------------- 轻量提示 toast -------------------- */
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) { toastEl = h("div", { class: "toast" }); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
  }

  /* -------------------- 简易路由 -------------------- */
  let currentGame = null; // 当前游戏对象（含 teardown）
  function leaveGame() { if (currentGame && currentGame.teardown) { try { currentGame.teardown(); } catch (_) {} } currentGame = null; }
  function mount(node) { leaveGame(); app.innerHTML = ""; app.appendChild(node); window.scrollTo(0, 0); }

  function goHome() { mount(renderHome()); }
  document.getElementById("brand-home").addEventListener("click", goHome);
  document.getElementById("brand-home").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") goHome(); });

  /* -------------------- 游戏元信息 -------------------- */
  const GAMES = [
    { id: "reason",   icon: "🧩", name: "密码破译", tag: "REASONING", skill: "推理",
      desc: "根据每次反馈，一步步演绎出隐藏的四色密码。锻炼逻辑演绎与假设检验。",
      accent: "reason", best: () => { const s = Store.get("best.reason", null); return s ? s + " 步" : null; }, start: startReason },
    { id: "logic",    icon: "🧠", name: "数列推理", tag: "LOGIC", skill: "思维",
      desc: "在限定时间内找出数字规律，选出下一项。锻炼归纳、抽象与逻辑思维。",
      accent: "logic",  best: () => { const s = Store.get("best.logic", 0); return s ? s + " 分" : null; }, start: startLogic },
    { id: "reaction", icon: "⚡", name: "极速反应", tag: "REACTION", skill: "反应",
      desc: "目标出现的瞬间立即点击，测量你的平均反应速度（毫秒）。抢跑无效！",
      accent: "reaction", best: () => { const s = Store.get("best.reaction", 0); return s ? s + " ms" : null; }, start: startReaction },
    { id: "spatial",  icon: "🔷", name: "空间旋转", tag: "SPATIAL", skill: "维度",
      desc: "判断哪个图形是参考图形旋转后的样子（小心镜像陷阱）。锻炼空间想象与心理旋转。",
      accent: "spatial", best: () => { const s = Store.get("best.spatial", 0); return s ? s + " 分" : null; }, start: startSpatial },
  ];

  function accentVars(name) {
    return { "--accent": `var(--${name})`, "--accent-2": `var(--${name}-2)` };
  }

  /* ==========================================================
     首页
     ========================================================== */
  function renderHome() {
    const cards = GAMES.map((g) => {
      const best = g.best();
      return h("button", { class: "game-card", style: accentVars(g.accent), onclick: () => { Sound.click(); g.start(); } },
        h("div", { class: "gc-top" },
          h("div", { class: "gc-icon" }, g.icon),
          h("div", { class: "gc-title" }, h("b", null, g.name), h("span", null, g.skill + " · " + g.tag))
        ),
        h("p", { class: "gc-desc" }, g.desc),
        h("div", { class: "gc-foot" },
          h("span", { class: "gc-best" }, best ? ["最佳 ", h("b", null, best)] : "尚无记录"),
          h("span", { class: "gc-play" }, "开始 ▶")
        )
      );
    });

    return h("section", { class: "screen" },
      h("div", { class: "home-intro" },
        h("h1", null, "选择你的训练"),
        h("p", null, "四个维度 · 逐一挑战，或每天全部过一遍。祝你脑力更上一层楼 🚀")
      ),
      h("div", { class: "card-grid" }, cards)
    );
  }

  /* -------------------- 游戏外壳（头部 + 面板） -------------------- */
  function gameShell(game, titleExtra, pills) {
    const head = h("div", { class: "game-head" },
      h("button", { class: "back-btn", onclick: () => { Sound.click(); goHome(); } }, "‹ 返回"),
      h("h2", null, game.icon + " " + game.name),
      h("div", { class: "spacer" }),
      h("div", { class: "stat-pills" }, pills || [])
    );
    const panel = h("div", { class: "panel" });
    const section = h("section", { class: "screen", style: accentVars(game.accent) }, head, panel);
    return { section, panel, head };
  }

  function meta(id) { return GAMES.find((g) => g.id === id); }

  /* ==========================================================
     1) 推理 · 密码破译（Mastermind）
     ========================================================== */
  function startReason() {
    const game = meta("reason");
    const COLORS = 6, SLOTS = 4, MAX_TRIES = 10;
    const secret = Array.from({ length: SLOTS }, () => rand(COLORS));

    let attempt = 0;
    let current = Array(SLOTS).fill(-1);
    let selColor = 0;
    let done = false;

    const bestPill = h("div", { class: "pill accent" }, "最佳 ", h("b", null, (() => { const s = Store.get("best.reason", null); return s ? s + "步" : "—"; })()));
    const triesPill = h("div", { class: "pill" }, "剩余 ", h("b", null, String(MAX_TRIES)));
    const shell = gameShell(game, null, [triesPill, bestPill]);

    const boardEl = h("div", { class: "mm-board" });
    const paletteEl = h("div", { class: "palette" });
    const submitBtn = h("button", { class: "btn", disabled: true, onclick: submit }, "确认这一行");
    const statusEl = h("div", { class: "center mt", style: { minHeight: "24px", color: "var(--muted)" } });

    shell.panel.appendChild(h("p", { class: "hint" },
      "我随机生成了一个由 ", h("b", null, "4 个颜色"), " 组成的密码（颜色可重复，共 6 种）。",
      "选颜色填满一行后点确认，我会给出提示：",
      h("b", { style: { color: "#fff" } }, " ●实心 "), "= 颜色和位置都对；",
      h("b", null, " ○空心 "), "= 颜色对但位置错。共 ", h("b", null, "10"), " 次机会。"
    ));
    shell.panel.appendChild(boardEl);
    shell.panel.appendChild(paletteEl);
    shell.panel.appendChild(h("div", { class: "row center mt" }, submitBtn,
      h("button", { class: "btn ghost", onclick: clearRow }, "清空")));
    shell.panel.appendChild(statusEl);

    function buildPalette() {
      paletteEl.innerHTML = "";
      for (let c = 0; c < COLORS; c++) {
        const sw = h("div", { class: "swatch color-" + c + (c === selColor ? " active" : ""), title: "颜色 " + (c + 1),
          onclick: () => { selColor = c; buildPalette(); Sound.click(); } });
        paletteEl.appendChild(sw);
      }
    }

    function renderBoard() {
      boardEl.innerHTML = "";
      // 已猜的行（从新到旧显示在下方更直观：这里按顺序，最新在最后）
      for (let r = 0; r < MAX_TRIES; r++) {
        const isCurrent = r === attempt && !done;
        const row = h("div", { class: "mm-row" + (isCurrent ? " current" : "") });
        row.appendChild(h("div", { class: "mm-idx" }, String(r + 1)));
        const pegs = h("div", { class: "mm-pegs" });
        const guessData = history[r];
        for (let s = 0; s < SLOTS; s++) {
          let colorIdx = -1;
          if (guessData) colorIdx = guessData.guess[s];
          else if (isCurrent) colorIdx = current[s];
          const peg = h("div", {
            class: "peg " + (colorIdx >= 0 ? "color-" + colorIdx : "color-empty"),
            onclick: isCurrent ? () => setSlot(s) : null,
          });
          pegs.appendChild(peg);
        }
        row.appendChild(pegs);
        // 反馈点
        const fb = h("div", { class: "mm-feedback" });
        if (guessData) {
          for (let i = 0; i < guessData.exact; i++) fb.appendChild(h("div", { class: "fb-dot exact" }));
          for (let i = 0; i < guessData.color; i++) fb.appendChild(h("div", { class: "fb-dot color" }));
          const blanks = SLOTS - guessData.exact - guessData.color;
          for (let i = 0; i < blanks; i++) fb.appendChild(h("div", { class: "fb-dot" }));
        } else {
          for (let i = 0; i < SLOTS; i++) fb.appendChild(h("div", { class: "fb-dot" }));
        }
        row.appendChild(fb);
        boardEl.appendChild(row);
      }
    }

    const history = []; // {guess, exact, color}

    function setSlot(s) {
      if (done) return;
      current[s] = selColor;
      Sound.click();
      updateSubmit();
      renderBoard();
    }
    function clearRow() { if (done) return; current = Array(SLOTS).fill(-1); updateSubmit(); renderBoard(); }
    function updateSubmit() { submitBtn.disabled = current.some((c) => c < 0); }

    function evaluate(guess) {
      let exact = 0, color = 0;
      const sc = {}, gc = {};
      for (let i = 0; i < SLOTS; i++) {
        if (guess[i] === secret[i]) exact++;
        else { sc[secret[i]] = (sc[secret[i]] || 0) + 1; gc[guess[i]] = (gc[guess[i]] || 0) + 1; }
      }
      for (const c in gc) if (sc[c]) color += Math.min(sc[c], gc[c]);
      return { exact, color };
    }

    function submit() {
      if (done || current.some((c) => c < 0)) return;
      const res = evaluate(current);
      history[attempt] = { guess: current.slice(), exact: res.exact, color: res.color };
      attempt++;
      triesPill.querySelector("b").textContent = String(MAX_TRIES - attempt);

      if (res.exact === SLOTS) { win(); }
      else if (attempt >= MAX_TRIES) { lose(); }
      else { Sound.click(); current = Array(SLOTS).fill(-1); updateSubmit(); renderBoard(); }
    }

    function endUI(node) {
      paletteEl.style.display = "none";
      submitBtn.style.display = "none";
      statusEl.innerHTML = "";
      statusEl.appendChild(node);
    }

    function win() {
      done = true; Sound.win();
      const steps = attempt;
      const prev = Store.get("best.reason", null);
      const isBest = prev == null || steps < prev;
      if (isBest) { Store.set("best.reason", steps); bestPill.querySelector("b").textContent = steps + "步"; }
      renderBoard();
      endUI(h("div", { class: "result-card" },
        h("div", { class: "result-emoji" }, "🎉"),
        isBest ? h("div", { class: "new-best" }, "新纪录！") : null,
        h("h3", null, "破译成功！"),
        h("div", { class: "sub" }, "你用了 " + steps + " 步" + (prev != null ? "（历史最佳 " + Store.get("best.reason") + " 步）" : "")),
        h("div", { class: "row center" },
          h("button", { class: "btn", onclick: startReason }, "再来一局"),
          h("button", { class: "btn ghost", onclick: goHome }, "返回首页"))
      ));
    }

    function lose() {
      done = true; Sound.bad();
      renderBoard();
      endUI(h("div", { class: "result-card" },
        h("div", { class: "result-emoji" }, "🔒"),
        h("h3", null, "机会用完啦"),
        h("div", { class: "sub" }, "正确密码是："),
        h("div", { class: "mm-pegs", style: { justifyContent: "center", marginBottom: "16px" } },
          secret.map((c) => h("div", { class: "peg color-" + c }))),
        h("div", { class: "row center" },
          h("button", { class: "btn", onclick: startReason }, "再挑战一次"),
          h("button", { class: "btn ghost", onclick: goHome }, "返回首页"))
      ));
    }

    buildPalette();
    renderBoard();
    mount(shell.section);
    currentGame = { teardown() {} };
  }

  /* ==========================================================
     2) 思维 · 数列推理
     ========================================================== */
  function startLogic() {
    const game = meta("logic");
    const DURATION = 60; // 秒
    let score = 0, streak = 0, best = Store.get("best.logic", 0);
    let timeLeft = DURATION, tickTimer = null, answered = false;

    const scorePill = h("div", { class: "pill accent" }, "得分 ", h("b", null, "0"));
    const streakPill = h("div", { class: "pill" }, "连击 ", h("b", null, "0"));
    const timePill = h("div", { class: "pill" }, "⏱ ", h("b", null, DURATION + "s"));
    const shell = gameShell(game, null, [scorePill, streakPill, timePill]);

    const bar = h("i");
    const timebar = h("div", { class: "timebar" }, bar);
    const displayEl = h("div", { class: "seq-display" });
    const subEl = h("div", { class: "seq-sub" });
    const optionsEl = h("div", { class: "seq-options" });

    shell.panel.appendChild(h("p", { class: "hint" }, "找出数字之间的 ", h("b", null, "规律"), "，选出问号处应该填的数。答对得分并累积连击，", h("b", null, "60 秒"), " 内挑战最高分！"));
    shell.panel.appendChild(timebar);
    shell.panel.appendChild(displayEl);
    shell.panel.appendChild(subEl);
    shell.panel.appendChild(optionsEl);

    // ---- 数列生成器：返回 {seq:[5项], answer, note} ----
    function genPuzzle() {
      const type = rand(7);
      let seq = [], answer = 0, note = "";
      if (type === 0) { // 等差
        const s = rand(9) + 1, d = pick([2, 3, 4, 5, 6, 7, -2, -3, -4]);
        for (let i = 0; i < 5; i++) seq.push(s + d * i);
        answer = s + d * 5; note = "等差数列";
      } else if (type === 1) { // 等比
        const s = rand(3) + 1, r = pick([2, 3]);
        for (let i = 0; i < 5; i++) seq.push(s * Math.pow(r, i));
        answer = s * Math.pow(r, 5); note = "等比数列";
      } else if (type === 2) { // 斐波那契式
        let a = rand(4) + 1, b = rand(5) + 1; seq = [a, b];
        for (let i = 2; i < 5; i++) seq.push(seq[i - 1] + seq[i - 2]);
        answer = seq[4] + seq[3]; note = "相邻两项之和";
      } else if (type === 3) { // 平方
        const k = rand(3) + 1;
        for (let i = 0; i < 5; i++) seq.push((i + k) * (i + k));
        answer = (5 + k) * (5 + k); note = "完全平方数";
      } else if (type === 4) { // 交替加
        const s = rand(6) + 1, a = rand(4) + 2, b = rand(5) + 3; seq = [s];
        for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + (i % 2 ? a : b));
        answer = seq[4] + (5 % 2 ? a : b); note = "交替递增";
      } else if (type === 5) { // n^2 + n
        for (let i = 1; i <= 5; i++) seq.push(i * i + i);
        answer = 6 * 6 + 6; note = "n²+n";
      } else { // 三角形数
        const off = rand(3);
        for (let i = 1; i <= 5; i++) { const n = i + off; seq.push(n * (n + 1) / 2); }
        const n = 6 + off; answer = n * (n + 1) / 2; note = "三角形数";
      }
      // 干扰项
      const opts = new Set([answer]);
      const spread = Math.max(1, Math.round(Math.abs(answer) * 0.12)) + rand(3) + 1;
      let guard = 0;
      while (opts.size < 4 && guard++ < 50) {
        const delta = (rand(2) ? 1 : -1) * (rand(spread) + 1);
        const cand = answer + delta;
        if (cand !== answer && cand >= 0) opts.add(cand);
      }
      while (opts.size < 4) opts.add(answer + opts.size);
      return { seq, answer, note, options: shuffle([...opts]) };
    }

    function nextRound() {
      answered = false;
      const p = genPuzzle();
      displayEl.innerHTML = "";
      p.seq.forEach((n) => { displayEl.appendChild(h("span", null, String(n))); displayEl.appendChild(h("span", { style: { color: "var(--muted-2)" } }, ",")); });
      displayEl.appendChild(h("span", { class: "seq-q" }, "?"));
      subEl.textContent = "";
      optionsEl.innerHTML = "";
      p.options.forEach((val) => {
        const btn = h("button", { class: "seq-opt", onclick: () => choose(btn, val, p) }, String(val));
        optionsEl.appendChild(btn);
      });
    }

    function choose(btn, val, p) {
      if (answered) return;
      answered = true;
      const buttons = [...optionsEl.children];
      buttons.forEach((b) => { b.disabled = true; if (Number(b.textContent) === p.answer) b.classList.add("correct"); });
      if (val === p.answer) {
        const bonus = Math.min(streak, 8);
        const gained = 10 + bonus * 2;
        score += gained; streak++;
        scorePill.querySelector("b").textContent = String(score);
        streakPill.querySelector("b").textContent = String(streak);
        subEl.textContent = "✔ 规律：" + p.note + "  +" + gained + (bonus ? "（连击 +" + bonus * 2 + "）" : "");
        Sound.good();
      } else {
        btn.classList.add("wrong");
        streak = 0; streakPill.querySelector("b").textContent = "0";
        subEl.textContent = "✘ 规律：" + p.note + "，正确答案 " + p.answer;
        Sound.bad();
      }
      setTimeout(() => { if (timeLeft > 0) nextRound(); }, 850);
    }

    function tick() {
      timeLeft -= 0.1;
      if (timeLeft <= 0) { timeLeft = 0; finish(); }
      timePill.querySelector("b").textContent = Math.ceil(timeLeft) + "s";
      bar.style.width = (timeLeft / DURATION * 100) + "%";
    }

    function finish() {
      clearInterval(tickTimer); tickTimer = null;
      const isBest = score > best;
      if (isBest) { best = score; Store.set("best.logic", score); }
      shell.panel.innerHTML = "";
      shell.panel.appendChild(h("div", { class: "result-card" },
        h("div", { class: "result-emoji" }, score >= 120 ? "🏆" : score >= 60 ? "🎉" : "💡"),
        isBest && score > 0 ? h("div", { class: "new-best" }, "新纪录！") : null,
        h("h3", null, "时间到！"),
        h("div", { class: "big-num" }, String(score)),
        h("div", { class: "sub" }, "历史最佳 " + best + " 分"),
        h("div", { class: "row center" },
          h("button", { class: "btn", onclick: startLogic }, "再来一局"),
          h("button", { class: "btn ghost", onclick: goHome }, "返回首页"))
      ));
    }

    nextRound();
    tickTimer = setInterval(tick, 100);
    mount(shell.section);
    currentGame = { teardown() { clearInterval(tickTimer); } };
  }

  /* ==========================================================
     3) 反应 · 极速反应
     ========================================================== */
  function startReaction() {
    const game = meta("reaction");
    const ROUNDS = 10;
    let round = 0;
    const times = [];
    let state = "idle"; // idle | ready(等待出现) | go(已出现可点) | done
    let appearAt = 0, spawnTimer = null, target = null;

    const bestPill = h("div", { class: "pill accent" }, "最佳 ", h("b", null, (() => { const b = Store.get("best.reaction", 0); return b ? b + "ms" : "—"; })()));
    const roundPill = h("div", { class: "pill" }, "目标 ", h("b", null, "0/" + ROUNDS));
    const lastPill = h("div", { class: "pill" }, "上次 ", h("b", null, "—"));
    const shell = gameShell(game, null, [roundPill, lastPill, bestPill]);

    shell.panel.appendChild(h("p", { class: "hint" }, "点击 “开始” 后，", h("b", null, "⚡目标"), " 会在随机延迟后出现在场内任意位置——", h("b", null, "看到就立刻点它！"), " 共 ", h("b", null, ROUNDS + " 个"), "，统计平均反应毫秒数（越小越强）。抢跑会重来哦。"));

    const arena = h("div", { class: "react-arena", onpointerdown: onArenaDown });
    const center = h("div", { class: "react-center" });
    arena.appendChild(center);
    shell.panel.appendChild(arena);

    function setCenter(node, show) { center.innerHTML = ""; if (node) center.appendChild(node); center.style.display = show === false ? "none" : "grid"; }
    function setArenaState(s) { arena.className = "react-arena" + (s ? " state-" + s : ""); }

    function showIntro() {
      state = "idle"; setArenaState("");
      setCenter(h("div", null,
        h("h3", null, "准备好了吗？"),
        h("p", null, "点击下方按钮开始，专注屏幕"),
        h("button", { class: "btn mt", onclick: (e) => { e.stopPropagation(); Sound.click(); scheduleNext(); } }, "开始 ▶")
      ));
    }

    function scheduleNext() {
      state = "ready"; setArenaState("ready");
      setCenter(h("div", null, h("h3", null, "等待 ⚡ 出现…"), h("p", null, "先别点！")));
      const delay = 800 + rand(2200);
      clearTimeout(spawnTimer);
      spawnTimer = setTimeout(spawnTarget, delay);
    }

    function spawnTarget() {
      state = "go"; setArenaState("go"); setCenter(null, false);
      const rect = arena.getBoundingClientRect();
      const pad = 46;
      const x = pad + Math.random() * (rect.width - pad * 2);
      const y = pad + Math.random() * (rect.height - pad * 2);
      target = h("div", { class: "target", style: { left: x + "px", top: y + "px" }, onpointerdown: onHit });
      arena.appendChild(target);
      appearAt = performance.now();
      Sound.pop();
    }

    function onHit(e) {
      e.stopPropagation();
      if (state !== "go") return;
      const rt = Math.round(performance.now() - appearAt);
      times.push(rt); round++;
      lastPill.querySelector("b").textContent = rt + "ms";
      roundPill.querySelector("b").textContent = round + "/" + ROUNDS;
      if (target) { target.remove(); target = null; }
      Sound.good();
      if (round >= ROUNDS) finish();
      else { flash(rt); setTimeout(scheduleNext, 350); }
    }

    function flash(rt) {
      setArenaState("");
      setCenter(h("div", null, h("div", { class: "react-big", style: { color: "var(--reaction)" } }, rt + "ms"),
        h("p", null, round + " / " + ROUNDS + " 完成")));
    }

    function onArenaDown() {
      // 在 ready 阶段点击 = 抢跑
      if (state === "ready") {
        clearTimeout(spawnTimer);
        state = "early"; setArenaState("early");
        Sound.bad();
        setCenter(h("div", null, h("h3", null, "抢跑啦！🐇"), h("p", null, "等目标出现再点"),
          h("button", { class: "btn mt", onclick: (e) => { e.stopPropagation(); Sound.click(); scheduleNext(); } }, "重新等待")));
      }
    }

    function finish() {
      state = "done";
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const fastest = Math.min(...times);
      const prev = Store.get("best.reaction", 0);
      const isBest = prev === 0 || avg < prev;
      if (isBest) { Store.set("best.reaction", avg); bestPill.querySelector("b").textContent = avg + "ms"; }
      Sound.win();
      const grade = avg < 260 ? { e: "⚡", t: "闪电般的反应！" } : avg < 340 ? { e: "🎯", t: "反应很敏捷" } : avg < 430 ? { e: "👍", t: "不错的水平" } : { e: "🐢", t: "还有提升空间" };
      shell.panel.innerHTML = "";
      shell.panel.appendChild(h("div", { class: "result-card" },
        h("div", { class: "result-emoji" }, grade.e),
        isBest ? h("div", { class: "new-best" }, "新纪录！") : null,
        h("h3", null, grade.t),
        h("div", { class: "big-num" }, avg + " ms"),
        h("div", { class: "sub" }, "最快 " + fastest + " ms · 历史最佳 " + Store.get("best.reaction") + " ms"),
        h("div", { class: "row center" },
          h("button", { class: "btn", onclick: startReaction }, "再测一次"),
          h("button", { class: "btn ghost", onclick: goHome }, "返回首页"))
      ));
    }

    showIntro();
    mount(shell.section);
    currentGame = { teardown() { clearTimeout(spawnTimer); } };
  }

  /* ==========================================================
     4) 维度 · 空间旋转（心理旋转）
     ========================================================== */
  function startSpatial() {
    const game = meta("spatial");
    const DURATION = 60;
    let score = 0, streak = 0, best = Store.get("best.spatial", 0);
    let timeLeft = DURATION, tickTimer = null, answered = false;

    const scorePill = h("div", { class: "pill accent" }, "得分 ", h("b", null, "0"));
    const streakPill = h("div", { class: "pill" }, "连击 ", h("b", null, "0"));
    const timePill = h("div", { class: "pill" }, "⏱ ", h("b", null, DURATION + "s"));
    const shell = gameShell(game, null, [scorePill, streakPill, timePill]);

    const bar = h("i");
    const timebar = h("div", { class: "timebar" }, bar);
    const wrap = h("div", { class: "sp-wrap" });

    shell.panel.appendChild(h("p", { class: "hint" }, "上方是 ", h("b", null, "参考图形"), "。下面 4 个中只有 1 个是它 ", h("b", null, "旋转"), " 后的样子——其余是 ", h("b", null, "镜像"), " 或别的形状。选出正确的那个，", h("b", null, "60 秒"), " 冲刺高分！"));
    shell.panel.appendChild(timebar);
    shell.panel.appendChild(wrap);

    /* ---- 多连块（polyomino）几何工具 ---- */
    const key = (x, y) => x + "," + y;
    function normalize(cells) {
      const minx = Math.min(...cells.map((c) => c[0]));
      const miny = Math.min(...cells.map((c) => c[1]));
      return cells.map((c) => [c[0] - minx, c[1] - miny]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }
    const rot = (cells) => normalize(cells.map(([x, y]) => [y, -x]));
    const mir = (cells) => normalize(cells.map(([x, y]) => [-x, y]));
    function canon(cells) {
      let c = normalize(cells), best = JSON.stringify(c);
      for (let i = 0; i < 3; i++) { c = rot(c); const s = JSON.stringify(c); if (s < best) best = s; }
      return best;
    }
    const chiral = (cells) => canon(cells) !== canon(mir(cells));
    function randomPoly(size) {
      const cells = [[0, 0]]; const set = new Set([key(0, 0)]);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      while (cells.length < size) {
        const base = pick(cells); const d = pick(dirs);
        const nx = base[0] + d[0], ny = base[1] + d[1];
        if (!set.has(key(nx, ny))) { set.add(key(nx, ny)); cells.push([nx, ny]); }
      }
      return normalize(cells);
    }
    function rotN(cells, n) { let c = normalize(cells); for (let i = 0; i < ((n % 4) + 4) % 4; i++) c = rot(c); return c; }

    function drawShape(cells, size, colorVar) {
      const cv = h("canvas", { class: "sp-canvas", width: size, height: size });
      const ctx = cv.getContext("2d");
      const gw = Math.max(...cells.map((c) => c[0])) + 1;
      const gh = Math.max(...cells.map((c) => c[1])) + 1;
      const pad = 14;
      const cell = Math.floor(Math.min((size - pad * 2) / gw, (size - pad * 2) / gh));
      const offx = (size - cell * gw) / 2, offy = (size - cell * gh) / 2;
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, colorVar[0]); grad.addColorStop(1, colorVar[1]);
      cells.forEach(([x, y]) => {
        const px = offx + x * cell, py = offy + y * cell;
        ctx.fillStyle = grad;
        ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);
      });
      return cv;
    }

    function nextRound() {
      answered = false;
      wrap.innerHTML = "";
      // 生成手性图形作为参考
      let ref;
      do { ref = randomPoly(5); } while (!chiral(ref));
      const refCanon = canon(ref);
      const mirCanon = canon(mir(ref));

      // 正确项：参考图的一个"真旋转"——外观必须与参考不同，强制玩家心理旋转
      const refStr = JSON.stringify(normalize(ref));
      const rotCand = [1, 2, 3].filter((k) => JSON.stringify(rotN(ref, k)) !== refStr);
      const correct = rotN(ref, rotCand.length ? pick(rotCand) : 1 + rand(3));
      const trap = rotN(mir(ref), rand(4));          // 陷阱：镜像后旋转
      // 两个无关形状（形状不同于参考，也不同于镜像，避免歧义）
      const extras = [];
      let guard = 0;
      while (extras.length < 2 && guard++ < 200) {
        const p = randomPoly(5);
        const pc = canon(p);
        if (pc === refCanon || pc === mirCanon) continue;
        if (extras.some((e) => canon(e) === pc)) continue;
        extras.push(rotN(p, rand(4)));
      }
      while (extras.length < 2) extras.push(rotN(randomPoly(4), rand(4))); // 兜底

      const options = shuffle([
        { cells: correct, correct: true },
        { cells: trap, correct: false },
        { cells: extras[0], correct: false },
        { cells: extras[1], correct: false },
      ]);

      const ac = getComputedStyle(document.documentElement);
      const accent = [ac.getPropertyValue("--spatial").trim() || "#40c4ff", ac.getPropertyValue("--spatial-2").trim() || "#2b8bff"];

      // 参考区
      wrap.appendChild(h("div", { class: "sp-ref" },
        h("div", { class: "label" }, "参考图形"),
        drawShape(ref, 150, accent)));

      // 选项区
      const optsEl = h("div", { class: "sp-options" });
      options.forEach((opt) => {
        const btn = h("button", { class: "sp-option", onclick: () => choose(btn, opt, options) },
          drawShape(opt.cells, 130, ["#3a4675", "#2a3358"]));
        optsEl.appendChild(btn);
      });
      wrap.appendChild(optsEl);
    }

    function choose(btn, opt, options) {
      if (answered) return;
      answered = true;
      const btns = [...btn.parentElement.children];
      btns.forEach((b, i) => { b.disabled = true; if (options[i].correct) b.classList.add("correct"); });
      if (opt.correct) {
        const bonus = Math.min(streak, 8);
        score += 10 + bonus * 2; streak++;
        scorePill.querySelector("b").textContent = String(score);
        streakPill.querySelector("b").textContent = String(streak);
        Sound.good();
      } else {
        btn.classList.add("wrong");
        streak = 0; streakPill.querySelector("b").textContent = "0";
        Sound.bad();
      }
      setTimeout(() => { if (timeLeft > 0) nextRound(); }, 720);
    }

    function tick() {
      timeLeft -= 0.1;
      if (timeLeft <= 0) { timeLeft = 0; finish(); }
      timePill.querySelector("b").textContent = Math.ceil(timeLeft) + "s";
      bar.style.width = (timeLeft / DURATION * 100) + "%";
    }

    function finish() {
      clearInterval(tickTimer); tickTimer = null;
      const isBest = score > best;
      if (isBest) { best = score; Store.set("best.spatial", score); }
      shell.panel.innerHTML = "";
      shell.panel.appendChild(h("div", { class: "result-card" },
        h("div", { class: "result-emoji" }, score >= 120 ? "🏆" : score >= 60 ? "🎉" : "🔷"),
        isBest && score > 0 ? h("div", { class: "new-best" }, "新纪录！") : null,
        h("h3", null, "时间到！"),
        h("div", { class: "big-num" }, String(score)),
        h("div", { class: "sub" }, "历史最佳 " + best + " 分"),
        h("div", { class: "row center" },
          h("button", { class: "btn", onclick: startSpatial }, "再来一局"),
          h("button", { class: "btn ghost", onclick: goHome }, "返回首页"))
      ));
    }

    nextRound();
    tickTimer = setInterval(tick, 100);
    mount(shell.section);
    currentGame = { teardown() { clearInterval(tickTimer); } };
  }

  /* -------------------- 启动 -------------------- */
  goHome();
})();
