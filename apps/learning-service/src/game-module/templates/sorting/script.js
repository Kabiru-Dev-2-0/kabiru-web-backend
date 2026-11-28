(function () {
  var currentItems = [];
  var correctItems = [];
  var activeConfig = window.__KABIRU_INITIAL_CONFIG__ || {};
  var maxScore = 100;
  var startedAtMs = Date.now();
  var bgmEl = null;

  var instructionEl = document.getElementById('instruction-text');
  var listEl = document.getElementById('sortable-list');
  var feedbackEl = document.getElementById('feedback-text');
  var checkBtn = document.getElementById('check-btn');
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

  function renderList() {
    listEl.textContent = '';
    currentItems.forEach(function (itemText, idx) {
      var li = document.createElement('li');
      li.className = 'sortable-item';

      var label = document.createElement('span');
      label.textContent = String(idx + 1) + '. ' + String(itemText);

      var controls = document.createElement('div');
      controls.className = 'move-controls';

      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'move-btn';
      upBtn.textContent = '↑';
      upBtn.disabled = idx === 0;
      upBtn.addEventListener('click', function () {
        if (idx <= 0) return;
        var tmp = currentItems[idx - 1];
        currentItems[idx - 1] = currentItems[idx];
        currentItems[idx] = tmp;
        renderList();
      });

      var downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'move-btn';
      downBtn.textContent = '↓';
      downBtn.disabled = idx === currentItems.length - 1;
      downBtn.addEventListener('click', function () {
        if (idx >= currentItems.length - 1) return;
        var tmp = currentItems[idx + 1];
        currentItems[idx + 1] = currentItems[idx];
        currentItems[idx] = tmp;
        renderList();
      });

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      li.appendChild(label);
      li.appendChild(controls);
      listEl.appendChild(li);
    });
  }

  function initGame(config, limitScore) {
    activeConfig = config || activeConfig;
    maxScore = typeof limitScore === 'number' ? limitScore : 100;
    applyThemeAndAssets(activeConfig);

    var content = activeConfig.content || activeConfig;
    instructionEl.textContent = String(content.instruction || 'Urutkan langkah-langkah berikut dengan benar:');
    correctItems = Array.isArray(content.items) ? content.items.map(String) : [];
    currentItems = correctItems.slice().reverse();
    renderList();
  }

  checkBtn.addEventListener('click', async function () {
    checkBtn.disabled = true;
    var matched = 0;
    for (var i = 0; i < correctItems.length; i++) {
      if (currentItems[i] === correctItems[i]) matched++;
    }
    var rawMax = Math.max(1, correctItems.length);
    var isAllCorrect = matched === correctItems.length;
    playSfx(isAllCorrect ? 'correctSfx' : 'wrongSfx');

    var durationSeconds = Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));

    if (window.Kabiru && typeof window.Kabiru.complete === 'function') {
      var res = await window.Kabiru.complete({
        rawScore: matched,
        rawMax: rawMax,
        unit: 'items',
        answers: { submittedOrder: currentItems },
        durationSeconds: durationSeconds,
      });
      var finalScore = res && typeof res.finalScore === 'number' ? res.finalScore : Math.round((matched / rawMax) * maxScore);
      scoreEl.textContent = 'Skor: ' + String(finalScore);
    } else {
      scoreEl.textContent = 'Skor: ' + String(Math.round((matched / rawMax) * maxScore));
    }

    feedbackEl.hidden = false;
    feedbackEl.textContent =
      'Posisi benar: ' + String(matched) + ' dari ' + String(correctItems.length) + '.';
  });

  if (window.Kabiru && typeof window.Kabiru.onInit === 'function') {
    window.Kabiru.onInit(function (payload) {
      initGame(payload.config, payload.maxScore);
    });
    if (typeof window.Kabiru.onConfigUpdate === 'function') {
      window.Kabiru.onConfigUpdate(function (payload) {
        initGame(payload.config, payload.maxScore);
      });
    }
  } else {
    initGame(activeConfig, maxScore);
  }
})();
