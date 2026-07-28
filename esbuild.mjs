import * as esbuild from "esbuild";
import { copyFile, cp, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const context = await esbuild.context({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info"
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await copyKatexAssets();
  await context.dispose();
}

async function copyKatexAssets() {
  await mkdir("media/katex/fonts", { recursive: true });
  await Promise.all([
    copyFile("node_modules/katex/dist/katex.min.css", "media/katex/katex.min.css"),
    copyFile("node_modules/katex/dist/katex.min.js", "media/katex/katex.min.js"),
    copyFile("node_modules/katex/dist/contrib/auto-render.min.js", "media/katex/auto-render.min.js"),
    cp("node_modules/katex/dist/fonts", "media/katex/fonts", { recursive: true, force: true })
  ]);
}
