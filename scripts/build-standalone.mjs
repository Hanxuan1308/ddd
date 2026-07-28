/* 把 index.html + assets/style.css + assets/app.js 内联成单文件，便于下载/分发。
   用法：node scripts/build-standalone.mjs
   产物：standalone.html（可直接双击打开的完整单文件） */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "assets/style.css"), "utf8");
// 防御性处理：避免内联脚本里出现 </script> 提前闭合（当前源码没有，但保险起见）
const js = readFileSync(join(root, "assets/app.js"), "utf8").replace(/<\/script>/g, "<\\/script>");

const standalone = html
  .replace('<link rel="stylesheet" href="assets/style.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="assets/app.js"></script>', `<script>\n${js}\n</script>`);

writeFileSync(join(root, "standalone.html"), standalone);
console.log("✓ standalone.html 生成完成（" + standalone.length + " 字节）");
