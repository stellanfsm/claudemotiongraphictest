/**
 * Seventh Seal — count-up for prinsippseksjon stats (94 %, 38 %, 53 %, 15 %)
 * Each stat runs once when it enters the viewport.
 */
(function () {
  'use strict';

  var DURATION_MS = 1100;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SELECTOR = '.ss-principle-row__stat--count[data-count-to]';

  function easeOutQuad(t) {
    return t * (2 - t);
  }

  function finish(el, numEl, target) {
    numEl.textContent = String(target);
    el.classList.remove('is-counting');
    el.classList.add('is-done');
  }

  function runCount(el, target) {
    var numEl = el.querySelector('.ss-principle-row__stat-count__num');
    if (!numEl) return;

    el.classList.add('is-counting');
    var start = performance.now();

    function frame(now) {
      var progress = Math.min((now - start) / DURATION_MS, 1);
      var value = Math.round(easeOutQuad(progress) * target);
      numEl.textContent = String(value);
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        finish(el, numEl, target);
      }
    }

    requestAnimationFrame(frame);
  }

  function initStat(el, observer) {
    var target = parseInt(el.getAttribute('data-count-to'), 10);
    if (!target || target < 1) return;

    var numEl = el.querySelector('.ss-principle-row__stat-count__num');
    if (!numEl) return;

    if (REDUCED || !observer) {
      finish(el, numEl, target);
      return;
    }

    observer.observe(el);
  }

  function init() {
    var els = document.querySelectorAll(SELECTOR);
    if (!els.length) return;

    var observer = null;
    if (!REDUCED && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;

            var el = entry.target;
            if (el.dataset.countStarted === 'true') return;

            var target = parseInt(el.getAttribute('data-count-to'), 10);
            var numEl = el.querySelector('.ss-principle-row__stat-count__num');
            if (!target || !numEl) return;

            el.dataset.countStarted = 'true';
            observer.unobserve(el);
            runCount(el, target);
          });
        },
        {
          threshold: 0.35,
          rootMargin: '0px 0px -40px 0px',
        }
      );
    }

    els.forEach(function (el) {
      initStat(el, observer);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
