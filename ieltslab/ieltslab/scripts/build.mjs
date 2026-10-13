// Build the web app with esbuild.
//   node scripts/build.mjs            → dist/ (served by the Node server)
//   node scripts/build.mjs --watch    → rebuild on change
//   node scripts/build.mjs --demo     → dist-demo/ieltslab-demo.html, one self-contained page (React bundled)
//                                       that runs in browser-only mode with no server
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const watch = args.has('--watch');
const demo = args.has('--demo');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Public+Sans:wght@400;500;600;700;800&display=swap';
const TITLE = 'IELTSLab';
const DESCRIPTION = 'IELTS-style practice tests for Listening, Reading, Writing and Speaking. Not affiliated with IELTS.';

const common = {
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  format: 'iife',
  target: ['es2020', 'chrome100', 'safari15', 'firefox100'],
  jsx: 'automatic',
  loader: { '.svg': 'text' },
  logLevel: 'info',
  legalComments: 'none',
};

if (demo) {
  const out = path.join(root, 'dist-demo');
  fs.mkdirSync(out, { recursive: true });
  const result = await esbuild.build({
    ...common,
    minify: true,
    write: false,
    outdir: out,
    define: { __DEMO_BUILD__: 'true', 'process.env.NODE_ENV': '"production"' },
  });
  const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
  const css = result.outputFiles.find((f) => f.path.endsWith('.css')).text;
  // Artifact page: no html/head/body wrapper (the host adds it).
  const html = `<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
  const file = 'ieltslab-demo.html';
  fs.writeFileSync(path.join(out, file), html);
  console.log(`Demo page written to dist-demo/${file} (${(html.length / 1024).toFixed(0)} KB)`);
} else {
  const out = path.join(root, 'dist');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/assets/app.css">
<script src="/assets/theme.js"></script>
</head>
<body>
<div id="root"></div>
<noscript>IELTSLab needs JavaScript to run practice tests.</noscript>
<script src="/assets/app.js"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(out, 'index.html'), html);
  // Apply the saved theme before first paint to avoid a flash (external file keeps the CSP strict).
  fs.writeFileSync(
    path.join(out, 'assets/theme.js'),
    `try{var t=localStorage.getItem('bw-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
  );
  fs.writeFileSync(
    path.join(out, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect x="1" y="1" width="26" height="26" rx="7" fill="#1d4f8c"/>${[0, 1, 2, 3, 4]
      .map((i) => `<rect x="${6 + i * 3.6}" y="${19 - i * 2.6}" width="2.2" height="${3 + i * 2.6}" rx="1" fill="#fff" opacity="${0.55 + i * 0.11}"/>`)
      .join('')}</svg>`,
  );
  const opts = {
    ...common,
    outfile: path.join(out, 'assets/app.js'),
    minify: !watch,
    sourcemap: watch ? 'inline' : true,
    define: { __DEMO_BUILD__: 'false', 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  };
  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
    console.log('Watching for changes…');
  } else {
    await esbuild.build(opts);
  }
}
