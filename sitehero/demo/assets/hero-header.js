/**
 * Headeren foelger seksjonen den staar over.
 *
 * ETT skript eier hele headertilstanden, paa forsiden og paa
 * panelsiden. Det avloeste to systemer som kjempet om logoen: det gamle
 * hero-header.js (scrollposisjon mot heroen) og et eksperiment paa
 * panelsiden (IntersectionObserver mot merkede seksjoner). Naa er heroen
 * bare én merket seksjon blant flere.
 *
 * MERKING, i HTML - skriptet navngir ingen seksjon:
 *   data-header-ink="light"          headeren faar lyst blekk over denne
 *   data-header-fill="transparent"   OG headeren er gjennomsiktig over
 *                                    den, med fade paa vei ut. Bare
 *                                    heroen: den er trukket opp under
 *                                    headeren, saa videoen skal vises
 *                                    gjennom. Uten denne merkingen ville
 *                                    "les seksjonens farge" gitt solid
 *                                    sort over heroen - .hero HAR
 *                                    background: #000000.
 *   data-header-fill="<farge>"       headeren males i denne fargen i
 *                                    stedet for seksjonens egen. Seksjon
 *                                    02 trenger det: den blir sort av et
 *                                    lag oppaa, mens dens EGEN
 *                                    background-color fortsatt er
 *                                    betongens #f0f0f0.
 *   data-header-ink-if="<klasse>"    seksjonen teller som moerk BARE mens
 *                                    <html> har denne klassen. Seksjon 02
 *                                    er lys inntil terskelen.
 *   data-header-ink="dark"           farget seksjon med MOERKT blekk: headeren
 *                                    faar seksjonens farge og sort tekst
 *                                    (arbeid graa, kontakt roed). html.hdr-ink-dark.
 *   data-header-logo="mono"          svart-hvit logo over denne seksjonen
 *                                    (roedt forsvinner paa roedt)
 *   data-header-aktiv="<farge>"      aktivt navpunkt i denne fargen over
 *                                    seksjonen, naar standarden ikke bestaar
 *   (umerket)                        lys seksjon: hvit header, moerkt blekk
 *
 * TRE TILSTANDER, skrevet paa <html> og <header>:
 *   over heroen      ingen klasse. --header-bg 0..1 toner den hvite
 *                    flaten inn over de siste FADE_MAX px foer heroen
 *                    er passert; --header-ink flipper binaert ved
 *                    INK_FLIP. .is-stuck ved terskelen, som foer.
 *   over moerk       html.hdr-ink-light. --header-fill = seksjonens
 *                    egen farge, lest fra DOM. --header-ink 0. Momentant.
 *   over lys         html.hdr-lys. Hvit flate, --header-ink 1. Momentant.
 *
 * HVEM AVGJOER: en IntersectionObserver med roten krympet (rootMargin)
 * til et baand oeverst paa noeyaktig headerens maalte hoyde. Naar en
 * merket seksjon krysser inn i eller ut av baandet, regnes tilstanden
 * ut paa nytt fra geometrien. Ingen scroll-lytter for DET.
 *
 * SCROLL-LYTTEREN FINNES, MEN JOBBER BARE OVER HEROEN. Faden trenger
 * kontinuerlig scrollposisjon, og en observer gir bare inn/ut.
 * Utenfor heroen gjoer lytteren én sammenligning av scrollY mot
 * heroens underkant og returnerer - ingen layout, ingen skriving.
 * Over heroen koster den det samme som foer. Det var avgjoerelsen:
 * hensikten med "ikke scroll-lytter" var aa slippe et ANDRE
 * per-scroll-system, ikke aa fjerne det ene som finnes.
 *
 * Sammenligningen er ikke pynt: den fanger hoppet (dyplenke, refresh)
 * der scroll-hendelsen kommer foer observerens melding, og avgjoer
 * synkront i stedet for aa la faden male feil tilstand i mellomtida.
 * Se onScroll().
 *
 * FADEN ER IKKE ET VALG SOM KAN BYTTES MOT ET HARDT KUTT. INK_FLIP
 * 0,4684 er maalt: krysspunktet der hvit og sort tekst er like lesbare
 * mot den halvgjennomsiktige flaten, begge 4,45:1. Lar man begge tone
 * lineaert, bunner kontrasten ut paa 1,07:1 midt i.
 *
 * Ingen requestAnimationFrame i scroll-lytteren - fjernet i 8011505
 * fordi den tvang layout hver frame og utsatte skiftet med opptil en
 * frame. Her leses bare window.scrollY.
 *
 * FOERSTE AVGJOERELSE TAS SYNKRONT, og tre ganger til i
 * requestAnimationFrame. Ved dyplenke og ved refresh med gjenopprettet
 * scrollposisjon skjer hoppet ETTER at skriptet har kjoert, saa den
 * foerste avgjoerelsen tas paa scrollY = 0. Maalt paa panelsiden: uten
 * rundene én frame med feil header ved dyplenke, med dem null.
 *
 * ETT FRAMES ETTERSLEP VED KRYSSING AV DE ANDRE GRENSENE ER GODTATT -
 * IKKE "FIKS" DET MED EN SCROLL-LYTTER. Maalt med en rAF-loop som
 * regner ut fasiten selv: noeyaktig 1 frame i utakt per kryssing, ned
 * og opp. Forsinkelsen er iboende i IntersectionObserver, som er
 * asynkron. Hero-grensa er unntaket, se over: der finnes en
 * scrollY-formel, og den brukes.
 *
 * SEKSJON 02 MOERKNER, OG HEADEREN EIER DEN TILSTANDEN OGSAA.
 *
 * TERSKELEN ER BUNDET TIL ET ELEMENT, ikke til et tall per skjermbredde.
 * Ankeret er avsnittet merket data-om-terskel - det som slutter med
 * "hos tradisjonelle byraaer", rett over adminpanel-avsnittet. Punktet
 * er OVERKANTEN AV DEN SISTE LINJA i det avsnittet, regnet som
 * underkant minus én linjehoyde. Naar headerens underkant naar dit,
 * skjaerer den saa vidt den linja, og adminpanel-avsnittet under staar
 * helt synlig - som paa Stellans skjermbilde.
 *
 * Hvorfor den siste linja og ikke avsnittets boks: naar teksten brytes
 * paa flere linjer paa smale skjermer, flytter underkanten seg med, og
 * terskelen foelger av seg selv. Hadde jeg brukt overkanten, ville
 * punktet stivnet paa den bredden jeg maalte. Linjehoyden leses fra
 * computed style, saa den foelger ogsaa typografien.
 *
 * Terskelen var foer seksjonens topp mot headerens underkant. Det var
 * for tidlig: moerkningen startet foer man hadde lest avsnittene. Da settes
 * html.om-moerk, CSS toner seksjonen, og hvilken() begynner samtidig aa
 * telle seksjonen som moerk - saa headeren snur i samme oeyeblikk, uten
 * et andre system som kunne komme i utakt med det foerste.
 *
 * HYSTERESE 80 px paa vei opp: den moerkner naar toppen naar headeren,
 * men lyses foerst 80 px lenger opp. Uten den ville et lite rykk rundt
 * terskelen vippet fram og tilbake. Grensen er lest per scroll framfor
 * med en andre IntersectionObserver: en observer melder bare ved SIN
 * egen kant, og +80 px er ikke den kanten. Kostnaden er to
 * subtraksjoner i en lytter som allerede kjoerer.
 *
 * --header-h maales her og skrives paa <html>. Heroen trekkes opp med
 * den (margin-top: calc(-1 * var(--header-h))), saa den maa skrives
 * foer noe annet. CSS har 109/117 som reserve for foerste frame.
 *
 * reduced-motion haandteres i CSS, ikke her: en @media-blokk i
 * css/header.css gjoer hero-faden binaer. Da reagerer den ogsaa naar
 * brukeren endrer innstillingen etter sidelast.
 */
(function () {
  var header = document.querySelector("header");
  if (!header) return;
  var rot = document.documentElement;

  var merkede = document.querySelectorAll('[data-header-ink="light"], [data-header-ink="dark"]');
  var hero = null;
  for (var i = 0; i < merkede.length; i++) {
    if (merkede[i].getAttribute("data-header-fill") === "transparent") {
      hero = merkede[i];
      break;
    }
  }
  /* Seksjonen som moerkner ved terskelen. Finnes ikke paa panelsiden,
     og da er hele mekanikken under inert. */
  var om = document.querySelector('[data-header-ink-if="om-moerk"]');
  /* Sidekoordinaten terskelen maales mot: overkanten av siste linje i
     ankeravsnittet. Regnes om i measure(). */
  var omAnker = 0;
  /* Sidekoordinaten for seksjonens underkant - samme punkt som den
     roede streken og soeylenes topp. Brukes til aa hoppe toningen
     ferdig ved rask rulling, se vurderOm(). */
  var omBunn = 0;
  var omStraks = false;
  var omMoerk = false;
  /* Hysterese, se toppen av fila. */
  var HYST = 80;

  /* Faden ligger i de siste FADE_MAX pikslene FOER terskelen
     (heroens hoyde - headerens hoyde), ikke fra scroll 0. */
  var FADE_MAX = 160;
  /* Kvantisering: 1/50 er finere enn oeyet ser paa en hvit flate, og
     hopper over de aller fleste skrivingene under rask scrolling. */
  var STEPS = 50;
  /* Maalt krysspunkt, se toppen av fila. */
  var INK_FLIP = 0.4684;

  var headerH = 0;
  /* Scrollposisjonen der heroen slippes: underkanten naar headerens
     underkant. Samme punkt som hvilken() bruker, saa de to kan ikke
     komme i utakt. */
  var heroSlipp = 0;
  var threshold = 0;
  var fadeDist = 1;
  var lastStep = -1;
  var lastStuck = null;
  var over = null;      /* seksjonen headeren staar over naa; null = lys */
  var io = null;

  function measure() {
    var h = header.offsetHeight;
    if (h > 0 && h !== headerH) {
      headerH = h;
      rot.style.setProperty("--header-h", h + "px");
    }
    if (hero) {
      threshold = Math.max(0, hero.offsetHeight - headerH);
      fadeDist = Math.max(1, Math.min(FADE_MAX, threshold));
      heroSlipp = hero.getBoundingClientRect().bottom + window.scrollY - headerH;
    }
    if (om) {
      var anker = om.querySelector("[data-om-terskel]");
      if (anker) {
        var ar = anker.getBoundingClientRect();
        var lh = parseFloat(getComputedStyle(anker).lineHeight);
        /* line-height: normal gir NaN. text-body staar paa 1,6. */
        if (!(lh > 0)) lh = parseFloat(getComputedStyle(anker).fontSize) * 1.6;
        omAnker = ar.bottom + window.scrollY - lh;
      } else {
        /* Uten anker faller den tilbake paa seksjonens topp, som var
           den gamle terskelen. Da blir effekten tidlig, ikke borte. */
        omAnker = om.getBoundingClientRect().top + window.scrollY;
      }
      omBunn = om.getBoundingClientRect().bottom + window.scrollY;
    }
    lastStep = -1;
  }

  /* Hvilken merket seksjon ligger under headerens UNDERKANT? Siste
     treff i DOM-rekkefoelge vinner, altsaa den nederste. Regnes fra
     geometrien, ikke fra observerens entries; de sier bare at NOE
     krysset.

     FOERSTE TREFF VAR FEIL, og det viste seg foerst da seksjon 02 ble
     merket. Heroen og seksjon 02 er sammenhengende: naar seksjonens
     topp naar headerens underkant, ligger heroens BUNN fortsatt i
     baandet. Med foerste treff vant heroen, og headeren ble staaende
     hvit i de 117 pikslene det tok foer heroen var helt forbi - mens
     seksjonen under alt var sort. Maalt: header rgb(255,255,255) med
     --header-ink 1 over en ferdig sortnet seksjon.

     Inngangen er upaavirket: en seksjon som kommer nedenfra bindes av
     r.top <= h uansett. Det som endrer seg er utgangen - en seksjon
     slippes naar underkanten passerer headerens underkant, ikke naar
     den passerer toppen.

     INKLUSIVE KANTER, MED VILJE. Observeren melder "intersecting" idet
     kantene BEROERER hverandre - ratio 0, null piksler overlapp - og
     sier ingenting mer foer neste terskel. Maalt: rulling 8 px/frame
     opp fra 1100 traff y=900 paa slaget, heroens underkant noeyaktig
     paa baandets overkant. En streng test (bottom > 0) svarte "ingen
     seksjon", headeren ble hvit over heroen, og ingen ny melding kom
     paa 83 frames. Med <= og >= svarer denne det samme som observeren
     i det kallet som faktisk kommer. */
  function hvilken() {
    var h = headerH || header.getBoundingClientRect().height;
    var treff = null;
    for (var i = 0; i < merkede.length; i++) {
      /* Betinget merking: seksjonen teller som moerk bare mens klassen
         staar. Uten dette ville seksjon 02 vaert moerk fra start. */
      var betingelse = merkede[i].getAttribute("data-header-ink-if");
      if (betingelse && !rot.classList.contains(betingelse)) continue;
      var r = merkede[i].getBoundingClientRect();
      if (r.top <= h && r.bottom >= h) treff = merkede[i];
    }
    return treff;
  }

  /* Terskelen for seksjon 02, med hysterese. Returnerer true naar
     tilstanden faktisk endret seg, saa den som kaller vet at headeren
     maa regnes om. */
  function vurderOm() {
    if (!om) return false;
    var h = headerH || header.getBoundingClientRect().height;
    var topp = omAnker - window.scrollY;
    if (!omMoerk && topp <= h) {
      omMoerk = true;
      rot.classList.add("om-moerk");
      return true;
    }
    if (omMoerk && topp >= h + HYST) {
      omMoerk = false;
      rot.classList.remove("om-moerk");
      omStraks = false;
      rot.classList.remove("om-straks");
      return true;
    }
    /* Rekker ikke toningen aa bli ferdig foer seksjonen forlater
       skjermen, hoppes den til maalet. Ren tallsammenligning, ingen
       layout - omBunn er cachet i measure(). */
    var straks = omMoerk && (omBunn - window.scrollY) <= h;
    if (straks !== omStraks) {
      omStraks = straks;
      rot.classList.toggle("om-straks", straks);
    }
    return false;
  }

  /* Seksjonens EGNE farge, ikke en hardkodet sort. Paint-avsloeringen i
     animations.js flytter fargen fra elementet til ::before og lar
     elementet staa gjennomsiktig, saa ::before leses som andre valg.
     #000000 er bare reserven. */
  function fyll(el) {
    /* Eksplisitt farge vinner. Seksjon 02 blir sort av et lag oppaa,
       saa dens egen background-color er fortsatt betongens #f0f0f0. */
    var oppgitt = el.getAttribute("data-header-fill");
    if (oppgitt && oppgitt !== "transparent") return oppgitt;
    var bg = getComputedStyle(el).backgroundColor;
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
      bg = getComputedStyle(el, "::before").backgroundColor;
    }
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") bg = "#000000";
    return bg;
  }

  function setStuck(stuck) {
    if (stuck !== lastStuck) {
      lastStuck = stuck;
      header.classList.toggle("is-stuck", stuck);
    }
  }

  /* Bare over heroen. Skriver --header-bg og --header-ink i SAMME kall
     paa SAMME scroll-avlesning, saa de ikke kan komme ut av fase. */
  function heroFade() {
    var y = window.scrollY;
    setStuck(y > threshold);
    var p = (y - (threshold - fadeDist)) / fadeDist;
    var step = Math.round(Math.min(1, Math.max(0, p)) * STEPS);
    if (step === lastStep) return;
    lastStep = step;
    var bg = step / STEPS;
    header.style.setProperty("--header-bg", bg);
    header.style.setProperty("--header-ink", bg > INK_FLIP ? "1" : "0");
  }

  /* Logo og aktivt navpunkt fra seksjonens merking. Uten merking
     fjernes egenskapene, saa CSS-reservene gjelder - paa forsiden og
     panelsiden er det alltid tilfellet. */
  function merke(el) {
    var mono = el && el.getAttribute("data-header-logo") === "mono";
    var aktiv = el && el.getAttribute("data-header-aktiv");
    if (mono) header.style.setProperty("--header-mono", "1");
    else header.style.removeProperty("--header-mono");
    if (aktiv) header.style.setProperty("--header-aktiv", aktiv);
    else header.style.removeProperty("--header-aktiv");
  }

  function sett(el) {
    over = el;
    merke(el);
    if (hero && el === hero) {
      rot.classList.remove("hdr-ink-light");
      rot.classList.remove("hdr-ink-dark");
      rot.classList.remove("hdr-lys");
      header.style.removeProperty("--header-fill");
      lastStep = -1;
      heroFade();
      return;
    }
    /* Utenfor heroen har headeren alltid egen flate, saa kantlinja
       skal staa som festet - ogsaa ved dyplenke rett hit, der
       heroFade aldri har kjoert. */
    setStuck(true);
    lastStep = -1;
    if (el) {
      var moerkt = el.getAttribute("data-header-ink") === "dark";
      rot.classList.remove("hdr-lys");
      rot.classList.remove(moerkt ? "hdr-ink-light" : "hdr-ink-dark");
      rot.classList.add(moerkt ? "hdr-ink-dark" : "hdr-ink-light");
      header.style.setProperty("--header-fill", fyll(el));
      header.style.setProperty("--header-ink", moerkt ? "1" : "0");
    } else {
      rot.classList.remove("hdr-ink-light");
      rot.classList.remove("hdr-ink-dark");
      rot.classList.add("hdr-lys");
      header.style.setProperty("--header-fill", "#ffffff");
      header.style.setProperty("--header-ink", "1");
    }
    header.style.setProperty("--header-bg", "1");
  }

  function avgjoer() {
    vurderOm();
    sett(hvilken());
  }

  /* Én sammenligning av scrollY, ingen layout. Heroen ligger under
     baandet noeyaktig naar scrollY <= heroSlipp - samme svar som
     hvilken() gir for den, uten aa maale noe.

     Stemmer ikke det med hva observeren sist sa (over), avgjoeres det
     synkront HER. Det er hoppet: ved dyplenke og ved refresh med
     gjenopprettet posisjon kommer scroll-hendelsen foer observerens
     melding, og med over === hero ville heroFade() malt headeren hvit
     med moerkt blekk over en sort seksjon. Maalt: 2 malte frames slik,
     av 48, ved dyplenke til #sec-principles. Samme grep tar ogsaa den
     ene framen observeren henger etter ved vanlig kryssing av
     hero-grensa. De andre grensene har ingen scrollY-formel og beholder
     observerens ene frame. */
  function onScroll() {
    /* To subtraksjoner og to sammenligninger. Ingen layout. */
    if (vurderOm()) {
      sett(hvilken());
      return;
    }
    if (!hero) return;
    var inne = window.scrollY <= heroSlipp;
    if (inne !== (over === hero)) {
      avgjoer();
      return;
    }
    if (inne) heroFade();
  }

  function bygg() {
    if (io) io.disconnect();
    if (!merkede.length || typeof IntersectionObserver === "undefined") return;
    var bunn = Math.max(0, window.innerHeight - Math.round(headerH));
    /* BAANDET ER EN LINJE, headerens underkant - ikke hele headerhoyden.
       hvilken() tester en linje (top <= h <= bottom). Med baandet 0..h
       krysset observeren ingen terskel idet en seksjons underkant
       passerte headerens underkant: seksjonens andel av baandet synker
       jevnt uten aa gaa under 0,001 foer den er nesten ute. Maalt
       21.09.2026 med 1 px steg begge veier mot fasiten fra hvilken():
         forsiden   2511 av 11248 avlesninger feil, bl.a. hvit header
                    over sort seksjon fra y 3768 til 1373 paa vei opp
                    (bekreftet med musehjul og skjermbilde)
         services   158 av 402 feil rundt heroen (116 px for sent ned)
         panelsiden 0 av 15484 - uendret
       Med linja: 0 feil paa alle tre. Hero-grensa paa forsiden har
       fortsatt sin egen scrollY-formel, se onScroll(). */
    io = new IntersectionObserver(avgjoer, {
      rootMargin: "-" + Math.round(headerH) + "px 0px -" + bunn + "px 0px",
      /* 0 fyrer ved beroering. 0.001 fyrer igjen en piksel senere - en
         andre sjanse om den foerste avlesningen skulle lande paa kanten.
         1 naas aldri for seksjoner hoeyere enn baandet. */
      threshold: [0, 0.001, 1]
    });
    for (var i = 0; i < merkede.length; i++) io.observe(merkede[i]);
  }

  function onResize() {
    measure();
    bygg();
    avgjoer();
  }

  measure();
  avgjoer();
  var igjen = 3;
  (function tidlig() {
    avgjoer();
    if (--igjen > 0) requestAnimationFrame(tidlig);
  })();
  bygg();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  /* Logoen er et bilde: hoyden er ikke endelig foer den er dekodet.
     width/height staar i markupen, saa dette er kun en sikring. */
  if (document.readyState !== "complete") {
    window.addEventListener("load", onResize, { once: true });
  }
})();
