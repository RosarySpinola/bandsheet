// Usage: node scripts/stills.cjs <outDir> <prefix> <frame> [frame…]
// Bundles once, opens one browser, renders each Film frame at scale 0.5, sequentially (one heavy job).
const path = require("path")
const cli = require.resolve("@remotion/cli")
const { bundle } = require(require.resolve("@remotion/bundler", { paths: [cli] }))
const { renderStill, selectComposition, openBrowser } = require(require.resolve("@remotion/renderer", { paths: [cli] }))

;(async () => {
  const [outDir, prefix, ...frames] = process.argv.slice(2)
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") })
  const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" } })
  const composition = await selectComposition({ serveUrl, id: "Film", puppeteerInstance: browser })
  for (const f of frames.map(Number)) {
    const output = path.join(outDir, `${prefix}-f${String(f).padStart(4, "0")}.png`)
    await renderStill({ serveUrl, composition, frame: f, output, scale: 0.5, puppeteerInstance: browser, overwrite: true, chromiumOptions: { gl: "angle" } })
    process.stdout.write(output + "\n")
  }
  await browser.close({ silent: true })
})().catch((e) => {
  process.stderr.write(String(e && e.stack ? e.stack : e) + "\n")
  process.exit(1)
})
