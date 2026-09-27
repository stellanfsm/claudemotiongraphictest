/**
 * Seventh Seal — Prinsippsøyle scroll-reveal
 *
 * Each row's pillar (band + number + heading) reveals once on enter.
 * Body copy follows with a short delay. Count-up stats are unaffected.
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STAGGER_MS = 110;
  var ROW_SELECTOR = '.ss-principle-row';

  function revealRow(row) {
    row.classList.add('is-visible');
  }

  function init() {
    var rows = document.querySelectorAll(ROW_SELECTOR);
    if (!rows.length) return;

    document.documentElement.classList.add('ss-principles-reveal');

    if (REDUCED || typeof IntersectionObserver === 'undefined') {
      rows.forEach(revealRow);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        var pending = [];
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var row = entry.target;
          if (row.classList.contains('is-visible')) return;
          observer.unobserve(row);
          pending.push(row);
        });

        pending.forEach(function (row, i) {
          if (i === 0) {
            revealRow(row);
          } else {
            setTimeout(function () {
              revealRow(row);
            }, i * STAGGER_MS);
          }
        });
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -45px 0px',
      }
    );

    rows.forEach(function (row) {
      observer.observe(row);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
