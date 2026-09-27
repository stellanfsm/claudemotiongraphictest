(function () {
  var STORAGE_KEY = "ss_cookie_consent_v1";

  function injectStyles() {
    if (document.getElementById("ss-cookie-banner-styles")) return;
    var style = document.createElement("style");
    style.id = "ss-cookie-banner-styles";
    style.textContent =
      ".ss-cookie-banner{position:fixed;z-index:120;left:0;right:0;bottom:0;padding:0 .75rem .75rem;pointer-events:none}" +
      ".ss-cookie-banner__card{pointer-events:auto;background:#fff;border:1px solid #0a0a0a;max-width:100%;margin:0 auto}" +
      ".ss-cookie-banner__accent{display:block;height:2px;width:2.5rem;background:#ff1e3c;margin-bottom:.625rem}" +
      ".ss-cookie-banner__label{margin:0 0 .5rem;font-size:.6875rem;font-weight:700;letter-spacing:.14em;line-height:1;text-transform:uppercase;color:#ff1e3c}" +
      ".ss-cookie-banner__text{margin:0;font-size:.9375rem;line-height:1.55;font-weight:500;color:rgba(10,10,10,.88)}" +
      ".ss-cookie-banner__custom{margin:.5rem 0 0;font-size:.875rem;line-height:1.5;color:rgba(10,10,10,.72)}" +
      ".ss-cookie-banner__custom.hidden{display:none}" +
      ".ss-cookie-banner__actions{display:flex;flex-wrap:wrap;align-items:center;gap:.375rem;margin-top:.875rem}" +
      ".ss-cookie-banner__btn{display:inline-flex;align-items:center;justify-content:center;min-height:2.125rem;padding:0 .75rem;font-family:inherit;font-size:.6875rem;font-weight:700;letter-spacing:.12em;line-height:1;text-transform:uppercase;cursor:pointer;transition:background-color .15s ease,color .15s ease,border-color .15s ease}" +
      ".ss-cookie-banner__btn:focus-visible{outline:2px solid #ff1e3c;outline-offset:2px}" +
      ".ss-cookie-banner__btn--primary{border:1px solid #0a0a0a;background:#0a0a0a;color:#fff}" +
      ".ss-cookie-banner__btn--primary:hover{background:#ff1e3c;border-color:#ff1e3c}" +
      ".ss-cookie-banner__btn--outline{border:1px solid #0a0a0a;background:transparent;color:#0a0a0a}" +
      ".ss-cookie-banner__btn--outline:hover{background:#f4f4f4}" +
      ".ss-cookie-banner__btn--ghost{border:1px solid transparent;background:transparent;color:#0a0a0a;padding:0 .5rem;min-height:2.125rem;text-decoration:underline;text-underline-offset:.15em}" +
      ".ss-cookie-banner__btn--ghost:hover{color:#ff1e3c}" +
      ".ss-cookie-banner__links{margin:.75rem 0 0;font-size:.8125rem;line-height:1.5;color:rgba(10,10,10,.65)}" +
      ".ss-cookie-banner__links a{color:#0a0a0a;text-decoration:underline;text-underline-offset:.12em}" +
      ".ss-cookie-banner__links a:hover{color:#ff1e3c}" +
      "@media (min-width:768px){.ss-cookie-banner{left:auto;right:1.25rem;bottom:1.25rem;width:min(30rem,calc(100vw - 2.5rem));padding:0}.ss-cookie-banner__card{padding:1rem 1.125rem 1rem}.ss-cookie-banner__actions{flex-wrap:nowrap;gap:.5rem}}" +
      "@media (max-width:767px){.ss-cookie-banner__card{padding:.875rem .875rem .75rem}.ss-cookie-banner__actions .ss-cookie-banner__btn--primary,.ss-cookie-banner__actions .ss-cookie-banner__btn--outline{flex:1 1 calc(50% - .1875rem);min-width:0}.ss-cookie-banner__actions .ss-cookie-banner__btn--ghost{flex:1 1 100%;justify-content:flex-start;padding-left:0;margin-top:.125rem}}";
    document.head.appendChild(style);
  }

  function getSavedChoice() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function saveChoice(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (err) {
      /* no-op when storage is unavailable */
    }
  }

  function createBanner() {
    var wrapper = document.createElement("aside");
    wrapper.className = "ss-cookie-banner";
    wrapper.setAttribute("aria-label", "Informasjonskapsler");
    /* role="region", ikke "dialog". To grunner:
       1) Elementet er en <aside>. dialog er ikke en tillatt rolle der
          (Lighthouse/axe: "ARIA role should be appropriate for the element"),
          region er det.
       2) dialog lover et modalt vindu som holder paa fokus til brukeren har
          valgt. Banneret gjoer ikke det, og skal ikke gjoere det - det ville
          sperret siden ved hver foerstegangsvisning. Det finnes verken
          fokusfelle, Escape-haandtering eller aria-modal her, og skal ikke
          legges til.
       aria-live="polite" staar: banneret settes inn etter sidelast, og
       skjermleseren skal lese det opp uten aa avbryte. */
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-live", "polite");

    wrapper.innerHTML =
      '<div class="ss-cookie-banner__card">' +
      '<span class="ss-cookie-banner__accent" aria-hidden="true"></span>' +
      '<p class="ss-cookie-banner__label">Informasjonskapsler</p>' +
      '<p class="ss-cookie-banner__text">Vi bruker funksjonelle cookies for at siden skal fungere. Vi bruker ikke analyse- eller markedsføringscookies nå.</p>' +
      '<p id="ss-cookie-custom-copy" class="ss-cookie-banner__custom hidden">Tilpasning er tilgjengelig, men det finnes foreløpig ingen valgfrie cookies å slå av eller på.</p>' +
      '<div class="ss-cookie-banner__actions">' +
      '<button type="button" data-cookie-action="accept" class="ss-cookie-banner__btn ss-cookie-banner__btn--primary">Godta alle</button>' +
      '<button type="button" data-cookie-action="reject" class="ss-cookie-banner__btn ss-cookie-banner__btn--outline">Avvis</button>' +
      '<button type="button" data-cookie-action="customize" class="ss-cookie-banner__btn ss-cookie-banner__btn--ghost">Tilpass</button>' +
      "</div>" +
      '<p class="ss-cookie-banner__links">Les mer i <a href="cookie-policy.html">Cookiepolicy</a> og <a href="privacy-policy.html">Personvernerklæring</a>.</p>' +
      "</div>";

    return wrapper;
  }

  function hideBanner(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function attachHandlers(banner) {
    var customCopy = banner.querySelector("#ss-cookie-custom-copy");
    banner.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var btn = target.closest("[data-cookie-action]");
      if (!btn) return;
      var action = btn.getAttribute("data-cookie-action");

      if (action === "customize") {
        if (customCopy) customCopy.classList.remove("hidden");
        saveChoice("customized");
        hideBanner(banner);
        return;
      }

      if (action === "accept") {
        saveChoice("accepted");
        hideBanner(banner);
        return;
      }

      if (action === "reject") {
        saveChoice("rejected");
        hideBanner(banner);
      }
    });
  }

  function init() {
    injectStyles();
    if (getSavedChoice()) return;
    var banner = createBanner();
    document.body.appendChild(banner);
    attachHandlers(banner);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
