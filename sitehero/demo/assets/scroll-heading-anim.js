/**
 * Scroll-progress text reveal for section headings (.ss-scroll-heading).
 * Words reveal gradually left-to-right as the user scrolls.
 */
(function () {
  var headings = [];
  var ticking = false;
  var DEFAULT_START = 0.92;
  var DEFAULT_END = 0.6;
  var MIN_RANGE_RATIO = 0.22;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function getAccentPhrases(heading) {
    var raw = heading.getAttribute("data-scroll-accent");
    if (!raw) return [];
    return raw.split("|").map(function (phrase) {
      return phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
    }).filter(function (parts) {
      return parts.length > 0;
    });
  }

  function isAccentWord(lineWords, wordIndex, phrases) {
    for (var p = 0; p < phrases.length; p++) {
      var phrase = phrases[p];
      for (var start = 0; start < lineWords.length; start++) {
        if (wordIndex < start || wordIndex >= start + phrase.length) continue;
        var match = true;
        for (var j = 0; j < phrase.length; j++) {
          if (lineWords[start + j].toLowerCase() !== phrase[j]) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
    }
    return false;
  }

  /* Splitter i ord, og holder sammen par som er bundet med &nbsp;.

     Foer sto det text.split(/\s+/) med en fast " " ved sammenliming. I
     JavaScript matcher \s ogsaa  , saa et &nbsp; i markupen ble
     lest som ordskille og limt tilbake som vanlig mellomrom - bindingen
     forsvant uten spor, og siste ord falt alene ned paa neste linje.

     AA BEVARE   SOM SKILLETEGN ER IKKE NOK. Ordspennene er
     display: inline-block, som de maa vaere for at translate3d-
     avsloeringen skal virke, og et   mellom to inline-block-bokser
     hindrer ikke linjebrekk i Chromium. Maalt: med display:inline holder
     paret, med inline-block brytes det. Derfor pakkes bundne par inn i
     et eget spenn med white-space: nowrap, som binder ogsaa atomaere
     inline-bokser.

     Innpakningen faar stilen satt her framfor i css/scroll-heading.css,
     saa endringen holder seg til én fil og én cache-noekkel.

     Ett spenn per ord beholdes, saa --word-progress og isAccentWord
     virker som foer - indeksene i words er uendret. */
  function splitLineIntoWords(line, phrases) {
    var text = line.textContent.trim();
    if (!text) return;
    /* Fanget skilletegn: delene veksler ord, skille, ord, skille, ...
       Teksten er trimmet, saa foerste og siste del er alltid ord. */
    var parts = text.split(/(\s+)/);
    var words = [];
    var seps = [];
    for (var p = 0; p < parts.length; p++) {
      if (p % 2 === 0) {
        words.push(parts[p]);
      } else {
        seps.push(parts[p].indexOf(" ") >= 0 ? " " : " ");
      }
    }

    function makeWord(index) {
      var span = document.createElement("span");
      span.className = "ss-scroll-heading__word";
      if (phrases.length && isAccentWord(words, index, phrases)) {
        span.classList.add("ss-heading-script");
      }
      span.textContent = words[index];
      return span;
    }

    line.textContent = "";
    var i = 0;
    while (i < words.length) {
      /* Hvor langt gaar kjeden av  -bundne ord? Som regel to. */
      var end = i;
      while (end < words.length - 1 && seps[end] === " ") end++;

      var host = line;
      if (end > i) {
        host = document.createElement("span");
        host.className = "ss-scroll-heading__bind";
        host.style.whiteSpace = "nowrap";
        line.appendChild(host);
      }
      for (var k = i; k <= end; k++) {
        host.appendChild(makeWord(k));
        if (k < end) host.appendChild(document.createTextNode(" "));
      }
      if (end < words.length - 1) {
        line.appendChild(document.createTextNode(seps[end]));
      }
      i = end + 1;
    }
  }

  function buildWordSpans(heading) {
    var phrases = getAccentPhrases(heading);
    heading.querySelectorAll(".ss-scroll-heading__line").forEach(function (line) {
      splitLineIntoWords(line, phrases);
    });
    heading.classList.add("ss-scroll-heading--ready");
  }

  function getRevealRange(heading, vh) {
    var startRatio = parseFloat(heading.getAttribute("data-scroll-start"));
    var endRatio = parseFloat(heading.getAttribute("data-scroll-end"));
    if (isNaN(startRatio)) startRatio = DEFAULT_START;
    if (isNaN(endRatio)) endRatio = DEFAULT_END;

    var start = vh * startRatio;
    var end = vh * endRatio;

    if (!heading._revealAnchored) {
      heading._revealAnchored = true;
      var rect = heading.getBoundingClientRect();
      if (rect.top < start) {
        heading._revealStartTop = rect.top;
      }
    }

    if (heading._revealStartTop !== undefined) {
      start = heading._revealStartTop;
      var minRange = vh * MIN_RANGE_RATIO;
      if (start - end < minRange) {
        end = Math.max(vh * 0.12, start - minRange);
      }
    }

    return { start: start, end: end };
  }

  function updateHeading(heading) {
    var rect = heading.getBoundingClientRect();
    var vh = window.innerHeight;
    var range = getRevealRange(heading, vh);
    var span = range.start - range.end;
    var progress = span > 0 ? clamp((range.start - rect.top) / span, 0, 1) : 1;

    var words = heading.querySelectorAll(".ss-scroll-heading__word");
    var total = words.length;
    if (!total) return;

    for (var i = 0; i < total; i++) {
      var wordStart = i / total;
      var wordEnd = (i + 1) / total;
      var wordSpan = wordEnd - wordStart;
      var wordProgress = wordSpan > 0 ? clamp((progress - wordStart) / wordSpan, 0, 1) : 1;
      words[i].style.setProperty("--word-progress", String(wordProgress));
    }
  }

  function updateAll() {
    for (var i = 0; i < headings.length; i++) {
      updateHeading(headings[i]);
    }
    ticking = false;
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateAll);
  }

  function setAllWordsVisible() {
    headings.forEach(function (heading) {
      heading.querySelectorAll(".ss-scroll-heading__word").forEach(function (word) {
        word.style.setProperty("--word-progress", "1");
      });
    });
  }

  /* Er overskriften synlig allerede naar sida lastes, blir den staaende
     paa 22 % opasitet og 28 % blekk til brukeren ruller: getRevealRange
     forankrer start paa rect.top, og da er progress 0 fra foerste
     bilde. Paa en hoy skjerm rammer det den foerste overskriften paa
     hver side - maalt paa tjenester: y 711 av 1366 px viewport.
     Slike overskrifter settes rett i sluttilstanden og tas ut av
     oppdateringslista, saa sloyfa ikke nullstiller dem igjen. Det blir
     momentant: css/scroll-heading.css har ingen transition, bare
     verdier bundet til --word-progress. */
  function ferdigMedEnGang(heading) {
    var r = heading.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  function settFerdig(heading) {
    var ord = heading.querySelectorAll(".ss-scroll-heading__word");
    for (var i = 0; i < ord.length; i++) ord[i].style.setProperty("--word-progress", "1");
  }

  function init() {
    headings = Array.prototype.slice.call(document.querySelectorAll("[data-scroll-heading]"));
    if (!headings.length) return;

    headings.forEach(buildWordSpans);
    document.documentElement.classList.add("js-scroll-heading");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAllWordsVisible();
      return;
    }

    headings = headings.filter(function (heading) {
      if (!ferdigMedEnGang(heading)) return true;
      settFerdig(heading);
      return false;
    });

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
