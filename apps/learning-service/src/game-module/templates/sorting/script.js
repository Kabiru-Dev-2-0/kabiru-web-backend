(function () {
  var currentItems = [];
  var correctItems = [];
  var maxScore = 100;

  var instructionEl = document.getElementById('instruction-text');
  var listEl = document.getElementById('sortable-list');
  var feedbackEl = document.getElementById('feedback-text');
  var checkBtn = document.getElementById('check-btn');
  var scoreEl = document.getElementById('score-display');

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
    var cfg = config || window.__KABIRU_INITIAL_CONFIG__ || {};
    maxScore = typeof limitScore === 'number' ? limitScore : 100;
    instructionEl.textContent = String(cfg.instruction || 'Urutkan langkah-langkah berikut dengan benar:');
    correctItems = Array.isArray(cfg.items) ? cfg.items.map(String) : [];
    currentItems = correctItems.slice().reverse();
    renderList();
  }

  checkBtn.addEventListener('click', function () {
    checkBtn.disabled = true;
    var matched = 0;
    for (var i = 0; i < correctItems.length; i++) {
      if (currentItems[i] === correctItems[i]) matched++;
    }
    var ratio = correctItems.length > 0 ? matched / correctItems.length : 1;
    var earnedScore = Math.round(ratio * maxScore);

    scoreEl.textContent = 'Skor: ' + String(earnedScore);
    feedbackEl.hidden = false;
    feedbackEl.textContent =
      'Posisi benar: ' + String(matched) + ' dari ' + String(correctItems.length) + '.';

    if (window.Kabiru) {
      window.Kabiru.submitScore(earnedScore);
      window.Kabiru.complete();
    }
  });

  if (window.Kabiru && typeof window.Kabiru.onInit === 'function') {
    window.Kabiru.onInit(function (payload) {
      initGame(payload.config, payload.maxScore);
    });
  } else {
    initGame(window.__KABIRU_INITIAL_CONFIG__, maxScore);
  }
})();
