(function () {
  var selectedIndex = -1;
  var activeConfig = window.__KABIRU_INITIAL_CONFIG__ || {};
  var maxScore = 100;
  var startedAtMs = Date.now();
  var bgmEl = null;

  var questionEl = document.getElementById('question-text');
  var optionsEl = document.getElementById('options-list');
  var feedbackEl = document.getElementById('feedback-text');
  var submitBtn = document.getElementById('submit-btn');
  var scoreEl = document.getElementById('score-display');

  function applyThemeAndAssets(cfg) {
    var theme = (cfg && cfg.theme) || {};
    var assets = (cfg && cfg.assets) || {};
    var root = document.documentElement.style;
    if (theme.primaryColor) root.setProperty('--kabiru-primary', theme.primaryColor);
    if (theme.backgroundColor) root.setProperty('--kabiru-bg', theme.backgroundColor);
    if (theme.surfaceColor) root.setProperty('--kabiru-surface', theme.surfaceColor);
    if (theme.textColor) root.setProperty('--kabiru-text', theme.textColor);
    if (theme.accentColor) root.setProperty('--kabiru-accent', theme.accentColor);

    var bgUrl = assets.backgroundImage && assets.backgroundImage.url ? assets.backgroundImage.url : null;
    root.setProperty('--kabiru-bg-image', bgUrl ? 'url("' + encodeURI(bgUrl) + '")' : 'none');

    var bgmUrl = assets.bgmAudio && assets.bgmAudio.url ? assets.bgmAudio.url : null;
    if (bgmUrl) {
      if (!bgmEl || bgmEl.src !== bgmUrl) {
        if (bgmEl) bgmEl.pause();
        bgmEl = new Audio(bgmUrl);
        bgmEl.loop = true;
        bgmEl.volume = Number((cfg.gameplay && cfg.gameplay.bgmVolume) ?? 0.5);
        bgmEl.play().catch(function () {});
      }
    } else if (bgmEl) {
      bgmEl.pause();
      bgmEl = null;
    }
  }

  function playSfx(slot) {
    var assets = (activeConfig && activeConfig.assets) || {};
    var url = assets[slot] && assets[slot].url ? assets[slot].url : null;
    if (url) new Audio(url).play().catch(function () {});
  }

  function renderGame(config, limitScore) {
    activeConfig = config || activeConfig;
    maxScore = typeof limitScore === 'number' ? limitScore : 100;
    applyThemeAndAssets(activeConfig);

    // Kompatibel mundur: baca dari config.content atau langsung root config
    var content = activeConfig.content || activeConfig;
    questionEl.textContent = String(content.question || 'Pilih jawaban yang paling tepat:');
    optionsEl.textContent = '';

    var options = Array.isArray(content.options) ? content.options : [];
    options.forEach(function (optText, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.textContent = String(optText);
      btn.addEventListener('click', function () {
        selectedIndex = idx;
        optionsEl.querySelectorAll('.option-btn').forEach(function (b, bIdx) {
          b.classList.toggle('selected', bIdx === idx);
        });
        submitBtn.disabled = false;
      });
      optionsEl.appendChild(btn);
    });
  }

  submitBtn.addEventListener('click', async function () {
    if (selectedIndex < 0) return;
    submitBtn.disabled = true;

    var content = activeConfig.content || activeConfig;
    var correctIndex = Number(content.answerIndex ?? 0);
    var isCorrect = selectedIndex === correctIndex;
    playSfx(isCorrect ? 'correctSfx' : 'wrongSfx');

    var durationSeconds = Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));
    var earnedRaw = isCorrect ? 1 : 0;

    if (window.Kabiru && typeof window.Kabiru.complete === 'function') {
      var res = await window.Kabiru.complete({
        rawScore: earnedRaw,
        rawMax: 1,
        unit: 'correct',
        answers: { selectedIndex: selectedIndex },
        durationSeconds: durationSeconds,
      });
      var finalScore = res && typeof res.finalScore === 'number' ? res.finalScore : earnedRaw * maxScore;
      scoreEl.textContent = 'Skor: ' + String(finalScore);
    } else {
      scoreEl.textContent = 'Skor: ' + String(earnedRaw * maxScore);
    }

    feedbackEl.hidden = false;
    feedbackEl.textContent = isCorrect
      ? String(content.explanation || 'Jawaban benar!')
      : 'Jawaban belum tepat. ' + String(content.explanation || '');
  });

  if (window.Kabiru && typeof window.Kabiru.onInit === 'function') {
    window.Kabiru.onInit(function (payload) {
      renderGame(payload.config, payload.maxScore);
    });
    if (typeof window.Kabiru.onConfigUpdate === 'function') {
      window.Kabiru.onConfigUpdate(function (payload) {
        renderGame(payload.config, payload.maxScore);
      });
    }
  } else {
    renderGame(activeConfig, maxScore);
  }
})();