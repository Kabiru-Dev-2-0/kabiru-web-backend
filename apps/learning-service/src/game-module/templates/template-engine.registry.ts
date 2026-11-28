import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface MaterializedTemplateFile {
  relativePath: string;
  content: string;
  mimeType: string;
  isEntrypoint: boolean;
}

function safeJsonSerialize(config: Record<string, unknown>): string {
  return JSON.stringify(config ?? {}).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

async function tryReadTemplateFile(templateId: string, fileName: string): Promise<string | null> {
  // Cari di folder src/game-module/templates/{templateId} atau dist/game-module/templates/{templateId}
  const candidates = [
    join(__dirname, templateId, fileName),
    join(process.cwd(), 'src', 'game-module', 'templates', templateId, fileName),
    join(process.cwd(), 'apps', 'learning-service', 'src', 'game-module', 'templates', templateId, fileName),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // Lanjut cek path berikutnya
    }
  }
  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFallbackTemplateEngine(templateId: string): {
  html: string;
  css: string;
  js: string;
} {
  return {
    html: [
      '<!DOCTYPE html>',
      '<html lang="id">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `    <title>Kabiru Game - ${escapeHtml(templateId)}</title>`,
      '    <link rel="stylesheet" href="style.css" />',
      '  </head>',
      '  <body>',
      '    <main class="game-container">',
      '      <section class="card">',
      '        <h1 id="game-title"></h1>',
      '        <p id="game-prompt"></p>',
      '        <button id="complete-btn" type="button" class="btn-primary">Selesaikan Tantangan</button>',
      '      </section>',
      '    </main>',
      '    <script src="script.js"></script>',
      '  </body>',
      '</html>',
    ].join('\n'),
    css: ':root{--kabiru-primary:#0284c7;--kabiru-bg:#f8fafc;--kabiru-surface:#ffffff;--kabiru-text:#0f172a;--kabiru-accent:#16a34a;--kabiru-bg-image:none}body{font-family:system-ui,sans-serif;background-color:var(--kabiru-bg);background-image:var(--kabiru-bg-image);background-size:cover;background-position:center;color:var(--kabiru-text);min-height:100vh;padding:24px}.card{max-width:600px;margin:0 auto;background:var(--kabiru-surface);border:1px solid #e2e8f0;border-radius:12px;padding:24px}.btn-primary{margin-top:16px;padding:10px 16px;border:none;border-radius:8px;background:var(--kabiru-primary);color:#fff;font-weight:600;cursor:pointer}',
    js: [
      '(function () {',
      '  var cfg = window.__KABIRU_INITIAL_CONFIG__ || {};',
      '  var maxScore = 100;',
      '  var startedAtMs = Date.now();',
      '  var bgmEl = null;',
      '  var titleEl = document.getElementById("game-title");',
      '  var promptEl = document.getElementById("game-prompt");',
      '  var btn = document.getElementById("complete-btn");',
      '  function applyThemeAndAssets(c) {',
      '    var t = (c && c.theme) || {};',
      '    var a = (c && c.assets) || {};',
      '    var r = document.documentElement.style;',
      '    if (t.primaryColor) r.setProperty("--kabiru-primary", t.primaryColor);',
      '    if (t.backgroundColor) r.setProperty("--kabiru-bg", t.backgroundColor);',
      '    if (t.surfaceColor) r.setProperty("--kabiru-surface", t.surfaceColor);',
      '    if (t.textColor) r.setProperty("--kabiru-text", t.textColor);',
      '    if (t.accentColor) r.setProperty("--kabiru-accent", t.accentColor);',
      '    var bgUrl = a.backgroundImage && a.backgroundImage.url ? a.backgroundImage.url : null;',
      '    r.setProperty("--kabiru-bg-image", bgUrl ? "url(\\"" + encodeURI(bgUrl) + "\\")" : "none");',
      '    var bgmUrl = a.bgmAudio && a.bgmAudio.url ? a.bgmAudio.url : null;',
      '    if (bgmUrl) {',
      '      if (!bgmEl || bgmEl.src !== bgmUrl) {',
      '        if (bgmEl) bgmEl.pause();',
      '        bgmEl = new Audio(bgmUrl); bgmEl.loop = true; bgmEl.play().catch(function () {});',
      '      }',
      '    } else if (bgmEl) { bgmEl.pause(); bgmEl = null; }',
      '  }',
      '  function render(c, m) {',
      '    cfg = c || cfg;',
      '    maxScore = typeof m === "number" ? m : 100;',
      '    applyThemeAndAssets(cfg);',
      '    var content = cfg.content || cfg;',
      '    titleEl.textContent = String(content.title || content.question || content.instruction || "Latihan Interaktif");',
      '    promptEl.textContent = String(content.prompt || content.description || "Ikuti instruksi permainan di layar.");',
      '  }',
      '  btn.addEventListener("click", async function () {',
      '    btn.disabled = true;',
      '    var a = (cfg && cfg.assets) || {};',
      '    if (a.correctSfx && a.correctSfx.url) new Audio(a.correctSfx.url).play().catch(function () {});',
      '    var durationSeconds = Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));',
      '    if (window.Kabiru && typeof window.Kabiru.complete === "function") {',
      '      await window.Kabiru.complete({ rawScore: 1, rawMax: 1, durationSeconds: durationSeconds });',
      '    }',
      '  });',
      '  if (window.Kabiru && typeof window.Kabiru.onInit === "function") {',
      '    window.Kabiru.onInit(function (p) { render(p.config, p.maxScore); });',
      '    if (typeof window.Kabiru.onConfigUpdate === "function") {',
      '      window.Kabiru.onConfigUpdate(function (p) { render(p.config, p.maxScore); });',
      '    }',
      '  } else {',
      '    render(cfg, maxScore);',
      '  }',
      '})();',
    ].join('\n'),
  };
}

export async function resolveTemplateStarterFiles(
  templateId: string,
  dbStarterFiles?: Record<string, unknown> | null,
): Promise<{ html: string; css: string; js: string }> {
  const fallback = buildFallbackTemplateEngine(templateId);
  const fromDbHtml = typeof dbStarterFiles?.html === 'string' && dbStarterFiles.html.trim() ? dbStarterFiles.html : null;
  const fromDbCss = typeof dbStarterFiles?.css === 'string' && dbStarterFiles.css.trim() ? dbStarterFiles.css : null;
  const fromDbJs = typeof dbStarterFiles?.js === 'string' && dbStarterFiles.js.trim() ? dbStarterFiles.js : null;

  const html = fromDbHtml ?? (await tryReadTemplateFile(templateId, 'index.html')) ?? fallback.html;
  const css = fromDbCss ?? (await tryReadTemplateFile(templateId, 'style.css')) ?? fallback.css;
  const js = fromDbJs ?? (await tryReadTemplateFile(templateId, 'script.js')) ?? fallback.js;

  return { html, css, js };
}

export function toStudioFilesArray(starter: { html: string; css: string; js: string }): MaterializedTemplateFile[] {
  return [
    { relativePath: 'index.html', content: starter.html, mimeType: 'text/html; charset=utf-8', isEntrypoint: true },
    { relativePath: 'style.css', content: starter.css, mimeType: 'text/css; charset=utf-8', isEntrypoint: false },
    { relativePath: 'script.js', content: starter.js, mimeType: 'application/javascript; charset=utf-8', isEntrypoint: false },
  ];
}

export function buildBlankCustomStarterFiles(moduleName: string): MaterializedTemplateFile[] {
  return toStudioFilesArray({
    html: [
      '<!DOCTYPE html>',
      '<html lang="id">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      `    <title>${escapeHtml(moduleName)}</title>`,
      '    <link rel="stylesheet" href="style.css" />',
      '  </head>',
      '  <body>',
      '    <div id="app"></div>',
      '    <script src="script.js"></script>',
      '  </body>',
      '</html>',
    ].join('\n'),
    css: '/* Tulis style custom game Anda di sini */\n',
    js: [
      '// Kerangka minimal SDK Kabiru (Mode Custom)',
      'if (window.Kabiru) {',
      '  window.Kabiru.onInit(function ({ config, maxScore }) {',
      '    // Mulai logika game Anda di sini',
      '  });',
      '}',
    ].join('\n'),
  });
}

export async function materializeTemplateFiles(
  templateId: string,
  config: Record<string, unknown>,
): Promise<MaterializedTemplateFile[]> {
  const fallback = buildFallbackTemplateEngine(templateId);
  const rawHtml = (await tryReadTemplateFile(templateId, 'index.html')) ?? fallback.html;
  const rawCss = (await tryReadTemplateFile(templateId, 'style.css')) ?? fallback.css;
  const rawJs = (await tryReadTemplateFile(templateId, 'script.js')) ?? fallback.js;

  // Snapshot config guru langsung di-embed secara aman (XSS-escaped) di awal script.js (FR-08)
  const serializedConfig = safeJsonSerialize(config);
  const materializedJs = `window.__KABIRU_INITIAL_CONFIG__ = ${serializedConfig};\n${rawJs}`;

  return [
    {
      relativePath: 'index.html',
      content: rawHtml,
      mimeType: 'text/html; charset=utf-8',
      isEntrypoint: true,
    },
    {
      relativePath: 'style.css',
      content: rawCss,
      mimeType: 'text/css; charset=utf-8',
      isEntrypoint: false,
    },
    {
      relativePath: 'script.js',
      content: materializedJs,
      mimeType: 'application/javascript; charset=utf-8',
      isEntrypoint: false,
    },
  ];
}
