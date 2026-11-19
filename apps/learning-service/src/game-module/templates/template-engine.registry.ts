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
      `    <title>Kabiru Game - ${templateId}</title>`,
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
    css: 'body{font-family:system-ui,sans-serif;background:#f8fafc;padding:24px}.card{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px}.btn-primary{margin-top:16px;padding:10px 16px;border:none;border-radius:8px;background:#0284c7;color:#fff;font-weight:600;cursor:pointer}',
    js: [
      '(function () {',
      '  var cfg = window.__KABIRU_INITIAL_CONFIG__ || {};',
      '  var maxScore = 100;',
      '  var titleEl = document.getElementById("game-title");',
      '  var promptEl = document.getElementById("game-prompt");',
      '  var btn = document.getElementById("complete-btn");',
      '  function render(c, m) {',
      '    cfg = c || cfg;',
      '    maxScore = typeof m === "number" ? m : 100;',
      '    titleEl.textContent = String(cfg.title || cfg.question || cfg.instruction || "Latihan Interaktif");',
      '    promptEl.textContent = String(cfg.prompt || cfg.description || "Ikuti instruksi permainan di layar.");',
      '  }',
      '  btn.addEventListener("click", function () {',
      '    btn.disabled = true;',
      '    if (window.Kabiru) {',
      '      window.Kabiru.submitScore(maxScore);',
      '      window.Kabiru.complete();',
      '    }',
      '  });',
      '  if (window.Kabiru && typeof window.Kabiru.onInit === "function") {',
      '    window.Kabiru.onInit(function (p) { render(p.config, p.maxScore); });',
      '  } else {',
      '    render(cfg, maxScore);',
      '  }',
      '})();',
    ].join('\n'),
  };
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
