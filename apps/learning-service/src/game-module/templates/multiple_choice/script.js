(function () {
  var selectedIndex = -1;
  var activeConfig = window.__KABIRU_INITIAL_CONFIG__ || {};
  var maxScore = 100;

  var questionEl = document.getElementById('question-text');
  var optionsEl = document.getElementById('options-list');
  var feedbackEl = document.getElementById('feedback-text');
  var submitBtn = document.getElementById('submit-btn');
  var scoreEl = document.getElementById('score-display');

  function renderGame(config, limitScore) {
    activeConfig = config || activeConfig;
    maxScore = typeof limitScore === 'number' ? limitScore : 100;

    // Mitigasi XSS (TC-S04): Wajib gunakan textContent, dilarang innerHTML
    questionEl.textContent = String(activeConfig.question || 'Pilih jawaban yang paling tepat:');
    optionsEl.textContent = '';

    var options = Array.isArray(activeConfig.options) ? activeConfig.options : [];
    options.forEach(function (optText, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.textContent = String(optText);
      btn.addEventListener('click', function () {
        selectedIndex = idx;
        var allBtns = optionsEl.querySelectorAll('.option-btn');
        allBtns.forEach(function (b, bIdx) {
          b.classList.toggle('selected', bIdx === idx);
        });
        submitBtn.disabled = false;
      });
      optionsEl.appendChild(btn);
    });
  }

  submitBtn.addEventListener('click', function () {
    if (selectedIndex < 0) return;
    submitBtn.disabled = true;

    var correctIndex = Number(activeConfig.answerIndex ?? 0);
    var earnedScore = selectedIndex === correctIndex ? maxScore : 0;

    scoreEl.textContent = 'Skor: ' + String(earnedScore);
    feedbackEl.hidden = false;
    feedbackEl.textContent =
      selectedIndex === correctIndex
        ? String(activeConfig.explanation || 'Jawaban benar!')
        : 'Jawaban belum tepat. ' + String(activeConfig.explanation || '');

    if (window.Kabiru) {
      window.Kabiru.submitScore(earnedScore);
      window.Kabiru.complete();
    }
  });

  if (window.Kabiru && typeof window.Kabiru.onInit === 'function') {
    window.Kabiru.onInit(function (payload) {
      renderGame(payload.config, payload.maxScore);
    });
  } else {
    renderGame(activeConfig, maxScore);
  }
})();
