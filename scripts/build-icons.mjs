/* 从 design/icon-lib.js 生成 App 图标 PNG。
   用法：node scripts/build-icons.mjs [方案id]
   方案id 可选：neural | hexcore | circuit | orbit | monogram | prism（默认 monogram）
   产物：icon-192.png / icon-512.png / icon-512-maskable.png / apple-touch-icon.png / favicon.png */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// 兼容：优先用本地安装的 playwright，找不到再退回全局路径
let chromium;
try { ({ chromium } = (await import("playwright")).default ?? (await import("playwright"))); }
catch { ({ chromium } = (await import("/opt/node22/lib/node_modules/playwright/index.js")).default); }

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const launchOpts = existsSync(CHROME) ? { executablePath: CHROME } : {};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHOICE = process.argv[2] || "monogram";
const lib = readFileSync(join(root, "design/icon-lib.js"), "utf8");

const OUT = [
  { file: "icon-192.png", size: 192, fgScale: 1 },
  { file: "icon-512.png", size: 512, fgScale: 1 },
  { file: "icon-512-maskable.png", size: 512, fgScale: 0.72, noEdge: true }, // 安全区留白
  { file: "apple-touch-icon.png", size: 180, fgScale: 1 },
  { file: "favicon.png", size: 64, fgScale: 1 },
];

const browser = await chromium.launch(launchOpts);
for (const o of OUT) {
  const page = await browser.newPage({ viewport: { width: o.size, height: o.size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
    <div id="m" style="width:${o.size}px;height:${o.size}px"></div>
    <script>${lib}<\/script>
    <script>
      document.getElementById("m").innerHTML =
        NA_ICONS.render(${JSON.stringify(CHOICE)}, "g", { fgScale: ${o.fgScale}, noEdge: ${!!o.noEdge} });
      const s = document.querySelector("svg");
      s.setAttribute("width", ${o.size}); s.setAttribute("height", ${o.size});
    <\/script></body></html>`);
  await page.waitForTimeout(180);
  await page.screenshot({ path: join(root, o.file), clip: { x: 0, y: 0, width: o.size, height: o.size } });
  await page.close();
  console.log("✓", o.file, o.size + "px");
}
await browser.close();
console.log("图标已生成（方案：" + CHOICE + "）");
