/**
 * Applies strings from assets/site-copy.js to the page.
 * Edit all user-facing text in site-copy.js only.
 */
(function () {
  function get(obj, path) {
    if (!path || !obj) return null;
    return path.split(".").reduce(function (acc, key) {
      if (acc == null || acc[key] === undefined) return null;
      return acc[key];
    }, obj);
  }

  /* Line text only — scroll-heading-anim.js splits lines into word spans after copy runs. */
  function applyScrollHeadingCopy(el, fullText) {
    var lines = el.querySelectorAll(".ss-scroll-heading__line");
    var splitAt = el.getAttribute("data-scroll-split-at");
    if (lines.length >= 2 && splitAt) {
      var idx = fullText.toLowerCase().indexOf(splitAt.toLowerCase());
      if (idx > 0) {
        lines[0].textContent = fullText.slice(0, idx).trim();
        lines[1].textContent = fullText.slice(idx).trim();
        return;
      }
    }
    if (lines.length >= 1) {
      lines[0].textContent = fullText;
      for (var i = 1; i < lines.length; i++) lines[i].textContent = "";
    } else {
      el.textContent = fullText;
    }
  }

  function applyCopy() {
    var root = window.SITE_COPY;
    if (!root) return;

    var page = document.documentElement.getAttribute("data-page");
    if (page) {
      var meta = get(root, "pages." + page + ".meta");
      if (meta) {
        if (meta.title) {
          document.title = meta.title;
          var ogTitle = document.querySelector('meta[property="og:title"]');
          if (ogTitle) ogTitle.setAttribute("content", meta.title);
          var twTitle = document.querySelector('meta[name="twitter:title"]');
          if (twTitle) twTitle.setAttribute("content", meta.title);
        }
        if (meta.description) {
          var md = document.querySelector('meta[name="description"]');
          if (md) md.setAttribute("content", meta.description);
          var ogDesc = document.querySelector('meta[property="og:description"]');
          if (ogDesc) ogDesc.setAttribute("content", meta.description);
          var twDesc = document.querySelector('meta[name="twitter:description"]');
          if (twDesc) twDesc.setAttribute("content", meta.description);
        }
      }
    }

    document.querySelectorAll("[data-copy]").forEach(function (el) {
      var key = el.getAttribute("data-copy");
      var val = get(root, key);
      if (val == null) return;
      if (el.hasAttribute("data-scroll-heading")) {
        applyScrollHeadingCopy(el, val);
      } else {
        el.textContent = val;
      }
    });

    /* Same keys as data-copy, but value may contain <span class="text-accent">…</span> (trusted: site-copy.js only). */
    document.querySelectorAll("[data-copy-html]").forEach(function (el) {
      var key = el.getAttribute("data-copy-html");
      var val = get(root, key);
      if (val != null) el.innerHTML = val;
    });

    document.querySelectorAll("[data-copy-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-copy-placeholder");
      var val = get(root, key);
      if (val != null) el.setAttribute("placeholder", val);
    });

    document.querySelectorAll("[data-copy-aria-label]").forEach(function (el) {
      var key = el.getAttribute("data-copy-aria-label");
      var val = get(root, key);
      if (val != null) el.setAttribute("aria-label", val);
    });

    document.querySelectorAll("[data-copy-alt]").forEach(function (el) {
      var key = el.getAttribute("data-copy-alt");
      var val = get(root, key);
      if (val != null) el.setAttribute("alt", val);
    });

    document.querySelectorAll("[data-copy-href]").forEach(function (el) {
      var key = el.getAttribute("data-copy-href");
      var val = get(root, key);
      if (val != null) el.setAttribute("href", val);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyCopy);
  } else {
    applyCopy();
  }
})();
