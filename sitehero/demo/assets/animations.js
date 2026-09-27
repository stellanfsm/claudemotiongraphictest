/**
 * Seventh Seal — Animation system
 *
 * Strategy:
 * - Pure CSS transforms + opacity (no layout shifts, GPU-friendly)
 * - IntersectionObserver for scroll-reveal (no scroll event listeners)
 * - Respects prefers-reduced-motion at every level
 * - All durations and easings defined in one place for easy tuning
 */
(function () {
  'use strict';

  /* ─── Config ─────────────────────────────────────────────── */
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DUR = {
    fast:   '0.25s',
    normal: '0.45s',
    slow:   '0.65s',
  };
  var EASE = {
    out:      'cubic-bezier(0.22, 1, 0.36, 1)',
    outSoft:  'cubic-bezier(0.4, 0, 0.2, 1)',
  };
  var TRANSLATE_Y = '18px';   // entrance lift distance
  var STAGGER_MS  = 80;       // ms between staggered siblings

  /* ─── Inject base styles ──────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [

    /* Hidden-before-reveal state */
    '.ss-reveal {',
    '  opacity: 0;',
    '  transform: translateY(' + TRANSLATE_Y + ');',
    '  transition:',
    '    opacity ' + DUR.slow + ' ' + EASE.out + ',',
    '    transform ' + DUR.slow + ' ' + EASE.out + ';',
    '  will-change: opacity, transform;',
    '}',

    /* Revealed state */
    '.ss-reveal.ss-visible {',
    '  opacity: 1;',
    '  transform: translateY(0);',
    '}',

    /* Faster variant for small elements */
    '.ss-reveal-fast {',
    '  opacity: 0;',
    '  transform: translateY(10px);',
    '  transition:',
    '    opacity ' + DUR.normal + ' ' + EASE.out + ',',
    '    transform ' + DUR.normal + ' ' + EASE.out + ';',
    '}',
    '.ss-reveal-fast.ss-visible {',
    '  opacity: 1;',
    '  transform: translateY(0);',
    '}',

    /* Hero entrance (immediate, no observer needed) */
    '.ss-hero-enter {',
    '  animation: ssHeroIn ' + DUR.slow + ' ' + EASE.out + ' both;',
    '}',
    '.ss-hero-enter-body {',
    '  animation: ssHeroIn ' + DUR.slow + ' ' + EASE.out + ' 0.12s both;',
    '}',
    '.ss-hero-enter-cta {',
    '  animation: ssHeroIn ' + DUR.normal + ' ' + EASE.out + ' 0.24s both;',
    '}',

    '@keyframes ssHeroIn {',
    '  from { opacity: 0; transform: translateY(14px); }',
    '  to   { opacity: 1; transform: translateY(0); }',
    '}',

    /* Work card image zoom on hover */
    '.ss-card-img-wrap { overflow: hidden; }',
    '.ss-card-img-wrap img {',
    '  transition: transform ' + DUR.slow + ' ' + EASE.out + ';',
    '  will-change: transform;',
    '}',
    '.ss-card-img-wrap:hover img,',
    '.ss-card-img-wrap:focus-within img {',
    '  transform: scale(1.035);',
    '}',

    /* Button lift */
    '.ss-btn {',
    '  transition:',
    '    background-color ' + DUR.fast + ' ' + EASE.outSoft + ',',
    '    border-color ' + DUR.fast + ' ' + EASE.outSoft + ',',
    '    color ' + DUR.fast + ' ' + EASE.outSoft + ',',
    '    transform ' + DUR.fast + ' ' + EASE.outSoft + ';',
    '  will-change: transform;',
    '}',
    '.ss-btn:hover {',
    '  transform: translateY(-2px);',
    '}',
    '.ss-btn:active {',
    '  transform: translateY(0);',
    '}',

    /* Nav link underline slide */
    '.ss-nav-link {',
    '  position: relative;',
    '  transition: color ' + DUR.fast + ' ' + EASE.outSoft + ';',
    '}',
    '.ss-nav-link::after {',
    '  content: "";',
    '  position: absolute;',
    '  bottom: -2px;',
    '  left: 0;',
    '  width: 100%;',
    '  height: 1px;',
    '  background: currentColor;',
    '  transform: scaleX(0);',
    '  transform-origin: left center;',
    '  transition: transform ' + DUR.fast + ' ' + EASE.out + ';',
    '}',
    '.ss-nav-link:hover::after { transform: scaleX(1); }',

    /* Service / about article hover */
    '.ss-article {',
    '  transition: box-shadow ' + DUR.fast + ' ' + EASE.outSoft + ';',
    '}',
    '.ss-article:hover {',
    '  box-shadow: 0 4px 24px rgba(0,0,0,0.07);',
    '}',

    /* Form input focus transition */
    'input.ss-input, textarea.ss-input {',
    '  transition:',
    '    border-color ' + DUR.fast + ' ' + EASE.outSoft + ',',
    '    box-shadow ' + DUR.fast + ' ' + EASE.outSoft + ';',
    '}',

    /* Paint-reveal — venstre→høyre (kun med JS).
       Generisk: .ss-paint er roten som observeres, .ss-paint__fill maler
       en flate, .ss-paint__line en strek, .ss-paint__content toner inn
       etterpå. Erstatter de to nesten identiske blokkene for
       .ss-cta-band og .ss-nettsidesjekk-band.

       Fyllet er en ::before framfor elementets egen bakgrunn, fordi en
       bakgrunn ikke kan transformeres. Fargen ligger i --paint-fill så
       lyse varianter kan overstyre den uten ny CSS.

       Dobbelt selektor overalt: roten kan SELV være målet
       (.ss-cta-band er både .ss-paint og .ss-paint__fill), og da treffer
       ikke etterkommer-selektoren. */
    'html.js-paint .ss-paint__fill {',
    '  background-color: transparent;',
    '}',
    'html.js-paint .ss-paint__fill::before {',
    '  content: "";',
    '  position: absolute;',
    '  inset: 0;',
    '  background-color: var(--paint-fill, #0a0a0a);',
    '  transform: scaleX(0);',
    '  transform-origin: left center;',
    '  z-index: 0;',
    '  will-change: transform;',
    '}',
    'html.js-paint .ss-paint.is-revealed .ss-paint__fill::before,',
    'html.js-paint .ss-paint.is-revealed.ss-paint__fill::before {',
    '  transform: scaleX(1);',
    '  transition: transform 850ms cubic-bezier(0.45, 0, 0.22, 1);',
    '}',
    'html.js-paint .ss-paint__line {',
    '  transform: scaleX(0);',
    '  transform-origin: left center;',
    '  will-change: transform;',
    '}',
    'html.js-paint .ss-paint.is-revealed .ss-paint__line,',
    'html.js-paint .ss-paint.is-revealed.ss-paint__line {',
    '  transform: scaleX(1);',
    '  transition: transform 850ms cubic-bezier(0.45, 0, 0.22, 1);',
    '}',
    'html.js-paint .ss-paint__content {',
    '  opacity: 0;',
    '  transform: translate3d(0, 10px, 0);',
    '  transition:',
    '    opacity 650ms cubic-bezier(0.45, 0, 0.22, 1),',
    '    transform 650ms cubic-bezier(0.45, 0, 0.22, 1);',
    '  transition-delay: 160ms;',
    '}',
    'html.js-paint .ss-paint.is-revealed .ss-paint__content,',
    'html.js-paint .ss-paint.is-revealed.ss-paint__content {',
    '  opacity: 1;',
    '  transform: translate3d(0, 0, 0);',
    '}',

    /* Reduced-motion overrides — collapse all to instant */
    '@media (prefers-reduced-motion: reduce) {',
    '  .ss-reveal, .ss-reveal-fast {',
    '    opacity: 1 !important;',
    '    transform: none !important;',
    '    transition: none !important;',
    '  }',
    '  .ss-hero-enter, .ss-hero-enter-body, .ss-hero-enter-cta {',
    '    animation: none !important;',
    '    opacity: 1 !important;',
    '    transform: none !important;',
    '  }',
    '  .ss-card-img-wrap img { transition: none !important; }',
    '  .ss-btn { transition: background-color ' + DUR.fast + ' linear, border-color ' + DUR.fast + ' linear, color ' + DUR.fast + ' linear !important; transform: none !important; }',
    '  .ss-btn:hover { transform: none !important; }',
    '  .ss-nav-link::after { transition: none !important; }',
    '  .ss-article { transition: none !important; }',
    '  html.js-paint .ss-paint__fill { background-color: var(--paint-fill, #0a0a0a) !important; }',
    '  html.js-paint .ss-paint__fill::before { transform: none !important; transition: none !important; }',
    '  html.js-paint .ss-paint__line { transform: none !important; transition: none !important; }',
    '  html.js-paint .ss-paint__content { opacity: 1 !important; transform: none !important; transition: none !important; }',
    '}',

  ].join('\n');
  document.head.appendChild(style);

  /* ─── Utilities ───────────────────────────────────────────── */
  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function setDelay(el, ms) {
    el.style.transitionDelay = ms + 'ms';
    el.style.animationDelay  = ms + 'ms';
  }

  /* ─── 1. Hero entrance animations ────────────────────────── */
  function applyHeroEntrances() {
    /* Each page has one hero section at the top */
    var page = document.documentElement.getAttribute('data-page') || '';

    var heroSection = qs('[aria-labelledby*="hero"]') || qs('main > header, main > section');
    if (!heroSection) return;

    /* Heading */
    var h1 = qs('h1', heroSection);
    if (h1) h1.classList.add('ss-hero-enter');

    /* Kicker above h1 */
    var kicker = qs('p.text-label', heroSection);
    if (kicker) {
      kicker.classList.add('ss-hero-enter');
      setDelay(kicker, 0);
      if (h1) setDelay(h1, 80);
    }

    /* Body paragraph */
    var body = qs('p.text-body, p[data-copy-html*="hero.body"], p[data-copy*="hero.body"]', heroSection);
    if (body) body.classList.add('ss-hero-enter-body');

    /* CTA buttons */
    qsa('a[href="contact.html"][class*="bg-accent"], a[href="contact.html"][class*="border-accent"], button[type="submit"]', heroSection)
      .forEach(function(btn) { btn.classList.add('ss-hero-enter-cta'); });

    /* CTA button group */
    var ctaWrap = qs('.flex.flex-wrap.gap-g3', heroSection);
    if (ctaWrap) {
      ctaWrap.classList.add('ss-hero-enter-cta');
      qsa('a', ctaWrap).forEach(function(a) {
        a.classList.remove('ss-hero-enter-cta');
      });
    }
  }

  /* ─── 2. Scroll-reveal (IntersectionObserver) ─────────────── */
  function applyScrollReveal() {
    if (typeof IntersectionObserver === 'undefined') return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('ss-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.08,
    });

    /* Section headings (h2) */
    qsa('main h2:not(.sr-only), main h2:not([class*="sr-only"])').forEach(function(el) {
      if (el.closest('[aria-labelledby*="hero"]')) return;
      el.classList.add('ss-reveal');
      observer.observe(el);
    });

    /* Section intro paragraphs (direct children of sections, not in hero) */
    qsa('main section > div > p.text-body, main section > div > div > p.text-body').forEach(function(el) {
      if (el.closest('[aria-labelledby*="hero"]')) return;
      if (el.classList.contains('sr-only')) return;
      el.classList.add('ss-reveal-fast');
      observer.observe(el);
    });

    /* Cards — stagger siblings in a grid */
    var cardSelectors = [
      'ul[class*="grid"] > li',      /* work cards, pricing cards, pillar cols */
      'div[class*="space-y"] > article',  /* service step articles */
    ];
    cardSelectors.forEach(function(sel) {
      var groups = {};
      qsa(sel).forEach(function(el) {
        var parent = el.parentElement;
        var key = parent ? (parent._ssKey || (parent._ssKey = 'g' + Math.random())) : 'solo';
        if (!groups[key]) groups[key] = [];
        groups[key].push(el);
      });

      Object.keys(groups).forEach(function(key) {
        groups[key].forEach(function(el, i) {
          el.classList.add('ss-reveal');
          setDelay(el, i * STAGGER_MS);
          observer.observe(el);
        });
      });
    });

    /* About process articles */
    qsa('[aria-labelledby="process-heading"] article').forEach(function(el, i) {
      el.classList.add('ss-reveal');
      setDelay(el, i * STAGGER_MS);
      observer.observe(el);
    });

    /* Contact direct/form columns */
    qsa('[aria-labelledby="contact-main-heading"] > div > div > div').forEach(function(el, i) {
      el.classList.add('ss-reveal');
      setDelay(el, i * STAGGER_MS);
      observer.observe(el);
    });

    /* Work bottom CTA strip */
    var workCta = qs('.border-t.border-ink.bg-mist > div[class*="flex"]');
    if (workCta) {
      workCta.classList.add('ss-reveal-fast');
      observer.observe(workCta);
    }
  }

  /* ─── 8. Paint reveal — flater og streker ─────────────────
     Slaatt sammen fra applyCtaBandReveal og
     applyNettsidesjekkBandLineReveal, som var samme funksjon med
     byttet klassenavn. Alle verdier er uendret.

     To nivaaer for reduced-motion, begge beholdt:
       1. porten her, som aldri setter js-paint og dermed lar hele den
          injiserte CSS-en vaere doed;
       2. @media-blokken med !important, som fanger brukere som skrur
          paa reduced-motion ETTER sidelast - REDUCED leses bare en
          gang. */
  function applyPaintReveal() {
    var roots = qsa('.ss-paint');
    if (!roots.length) return;

    if (REDUCED || typeof IntersectionObserver === 'undefined') return;

    document.documentElement.classList.add('js-paint');

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    roots.forEach(function (root) {
      observer.observe(root);
    });
  }

  /* ─── 3. Image hover zoom on work cards ──────────────────── */
  function applyCardImageZoom() {
    qsa('ul[class*="grid"] > li article div[class*="aspect-"]').forEach(function(wrap) {
      wrap.classList.add('ss-card-img-wrap');
    });
  }

  /* ─── 4. Button lift ─────────────────────────────────────── */
  function applyButtonLift() {
    var btnSelectors = [
      'a[class*="bg-accent"]',
      'a[class*="border-accent"][class*="inline-flex"]',
      'button[type="submit"]',
      'a[class*="border-paper"][class*="inline-flex"]',
    ];
    qsa(btnSelectors.join(', ')).forEach(function(el) {
      el.classList.add('ss-btn');
    });
  }

  /* ─── 5. Nav link polish ─────────────────────────────────── */
  function applyNavPolish() {
    /* Only non-active desktop nav links */
    qsa('nav.hidden a[class*="hover:text-accent"]').forEach(function(el) {
      el.classList.add('ss-nav-link');
    });
  }

  /* ─── 6. Service / about article hover shadow ────────────── */
  function applyArticleHover() {
    qsa('div[class*="space-y"] > article[class*="border"]').forEach(function(el) {
      el.classList.add('ss-article');
    });
  }

  /* ─── 7. Form input transitions ─────────────────────────── */
  function applyFormPolish() {
    qsa('input[class*="border-ink"], textarea[class*="border-ink"]').forEach(function(el) {
      el.classList.add('ss-input');
    });
  }

  /* ─── 9. Pricing scroll-shrink (full-bleed → subtil inn) ──── */
  function applyPricingScrollShrink() {
    var wrappers = qsa('.pricing-cards-scroll');
    if (!wrappers.length) return;

    /* Tuning — start/end som andel av viewport-høyde, og minste scale */
    var START     = 1.05;  /* progress = 0 når toppen er 105% ned i viewporten */
    var END       = 0.74;  /* progress = 1 når toppen er 74% ned i viewporten   */
    var SCALE_MIN = 0.92;  /* scale går fra 1 → 0.92                            */
    var DISABLE_BELOW = 480; /* shrink deaktiveres under denne bredden          */

    var ticking = false;

    function clamp01(v) {
      return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    function resetWrapper(wrapper) {
      wrapper.classList.remove('is-pricing-scroll');
      wrapper.style.removeProperty('--pricing-scroll-scale');
      wrapper.style.removeProperty('--pricing-scroll-y');
      wrapper.style.removeProperty('--pricing-scroll-opacity');
    }

    /* Sluttskala per element.
       Standard er SCALE_MIN (0.92), som pakkeboksene bruker.
       Med data-shrink-til="innhold" ender elementet i stedet paa
       containerens innholdsbredde: det ligger i full sidebredde, og krymper
       inn til den bredden det ville hatt uten full bredde. Forholdet kan
       ikke regnes ut i CSS - to lengder kan ikke deles paa hverandre der -
       og det avhenger av vindusbredden, saa det maa skje her.
       offsetWidth, ikke getBoundingClientRect().width: den foerste er
       layoutbredden og paavirkes ikke av transformen vi selv setter. */
    function sluttSkala(wrapper) {
      if (wrapper.getAttribute('data-shrink-til') !== 'innhold') return SCALE_MIN;
      var forelder = wrapper.parentElement;
      if (!forelder) return SCALE_MIN;
      var cs = window.getComputedStyle(forelder);
      var mal = forelder.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
      var full = wrapper.offsetWidth;
      if (!(full > 0) || !(mal > 0)) return SCALE_MIN;
      return Math.min(1, mal / full);
    }

    function updateWrapper(wrapper, vh) {
      var top = wrapper.getBoundingClientRect().top;
      var range = (START - END) * vh;
      var progress = clamp01((START * vh - top) / range);

      /* Ease-out (samme som referanseprosjektet) */
      progress = 1 - (1 - progress) * (1 - progress);

      var scale = 1 - (1 - sluttSkala(wrapper)) * progress;

      wrapper.style.setProperty('--pricing-scroll-scale', scale.toFixed(4));
      wrapper.style.setProperty('--pricing-scroll-y', '0px');
      wrapper.style.setProperty('--pricing-scroll-opacity', '1');
      wrapper.classList.add('is-pricing-scroll');
    }

    function update() {
      ticking = false;

      if (window.innerWidth < DISABLE_BELOW) {
        wrappers.forEach(resetWrapper);
        return;
      }

      var vh = window.innerHeight || document.documentElement.clientHeight;
      wrappers.forEach(function (wrapper) {
        updateWrapper(wrapper, vh);
      });
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ─── Init ────────────────────────────────────────────────── */
  function init() {
    applyHeroEntrances();
    applyPaintReveal();
    if (!REDUCED) {
      applyScrollReveal();
      applyCardImageZoom();
      applyPricingScrollShrink();
    }
    applyButtonLift();
    applyNavPolish();
    applyArticleHover();
    applyFormPolish();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
