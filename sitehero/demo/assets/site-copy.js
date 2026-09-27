  /**
   * Seventh Seal — all tekst på nettsiden (bokmål).
   *
   * Rediger denne filen for å endre menyer, overskrifter og avsnitt.
   * Ingen ekstra byggekommando trengs for tekst — lagre filen og last opp til server
   * (sammen med resten av prosjektet). Kjør `npm run build` bare når du endrer HTML-maler
   * eller Tailwind-stiler.
   *
   * Nøkkelnavn (pages.index.hero.h1 osv.) må stemme med `data-copy` i HTML.
   * Utheving: <span class="font-bold">…</span> (fet), <span class="text-accent">…</span> (rød markering).
   */
  window.SITE_COPY = {
    shared: {
      skipToContent: "Hopp til innhold",
      menu: "Meny",
      navPrimaryAria: "Hovednavigasjon",
      navPrimaryMobileAria: "Hovednavigasjon, mobil",
      logoHomeAria: "Seventh Seal — hjem",
      logoAlt: "Seventh Seal",
      nav: {
        home: "Hjem",
        services: "Tjenester og priser",
        work: "Arbeid",
        about: "Om oss",
        contact: "Kontakt",
      },
      footer: {
        blurb:
          "Seventh Seal bygger moderne nettsider for små og mellomstore bedrifter — med tydelig design, teknisk kvalitet og enkel drift.",
        copyright: "© 2026 Seventh Seal",
        orgNr: "Org.nr. 937 419 597",
        contactTitle: "Kontakt",
        emailHref: "mailto:team@seventhseal.no",
        emailAddress: "team@seventhseal.no",
        phoneHref: "tel:+4748383197",
        phoneDisplay: "48 38 31 97",
        area: "Oslo / Norge",
        servicesTitle: "Tjenester",
        linkBusinessSites: "Nettsider for bedrifter",
        linkPriceGuide: "Hva koster en nettside?",
        linkBusinessGuide: "Lage nettside for bedrift",
        linkSelfEdit: "Oppdatere nettsiden selv",
        linkGuides: "Guider",
        linkWebdesign: "Webdesign",
        linkHosting: "Drift og hosting",
        linkOslo: "Webutvikler i Oslo",
        linkPricing: "Priser og tillegg",
        linkWebsiteCheck: "Gratis nettsidesjekk",
        pagesTitle: "Sider",
        legalTitle: "Juridisk",
        linkPrivacy: "Personvern",
        linkTerms: "Vilkår",
        linkCookies: "Informasjonskapsler",
        linkAccessibility: "Tilgjengelighet",
        partnersTitle: "Samarbeid",
        partnerFormaaNote: "Produktutvikling og design",
        ctaTitle: "Klar for ny nettside?",
        ctaBody: "Start med et gratis førsteutkast.",
      },
      cta: {
        startProject: "Få gratis utkast",
        startProjectLong: "Få gratis førsteutkast",
        viewWork: "Våre tjenester",
        contact: "Kontakt",
        allServices: "Se priser og tillegg →",
        requestQuote: "Ta kontakt",
        discussBuild: "Snakk om et lignende prosjekt →",
      },
    },

    pages: {
      index: {
        meta: {
          title: "Nettsider for bedrifter | Webdesign i Norge – Seventh Seal",
          description: "Seventh Seal bygger moderne nettsider for små og mellomstore bedrifter. Priser fra 7 500 kr + 500 kr/mnd — med adminpanel, hosting og gratis førsteutkast.",
        },
        tape: {
          left: "Digitale systemer for virksomheter i vekst",
          num: "01",
          dash: " — ",
          page: "Hjem",
        },
        hero: {
          /* Ute av heroen. Verdien staar tom framfor aa slettes, saa
             teksten kan settes tilbake uten aa skrives paa nytt:
             "Webdesign og utvikling" */
          kicker: "",
          h1:
            'Designer morgendagens <span>nettsider</span>, i&nbsp;dag',
          /* De tre broedtekstavsnittene er ute av heroen. Noekkelen staar
             tom framfor aa slettes, saa data-copy-html-oppslaget fortsatt
             finner den og ikke lar gammel markup bli staaende. */
          body: '',
        },

        om: {
          sectionNum: "02",
          h2: "Byråkvalitet, uten byråpris.",
          body1:
            "Seventh Seal bygger moderne nettsider for små og mellomstore bedrifter. Vi sørger for at designet, innholdet og det tekniske henger sammen slik at nettsiden både ser bra ut og skaper resultater.",
          body2:
            "Gjennom en effektiv arbeidsmodell leverer vi høy kvalitet til en brøkdel av prisen hos tradisjonelle byråer.",
          panel:
            'Hver nettside leveres med et adminpanel dere styrer innholdet fra selv. <a href="oppdatere-nettsiden-selv.html" class="ss-inline-link">Se hvordan det fungerer</a>.',
          cta: "Se arbeidet vårt",
        },
        principles: {
          sectionNum: "03",
          h2: "Seventh Seals 7 søyler for webdesign",
          intro:
            'Et godt nettsted er et resultat av et tydelig rammeverk, ikke tilfeldige designbeslutninger. Våre 7 søyler gir oss et tydelig utgangspunkt for hvordan nettsiden skal fungere i praksis, ikke bare hvordan den ser ut.',
          p1Title: "Profesjonelt design",
          p1Body:
            '<span class="ss-principle-row__stat ss-principle-row__stat--count" data-count-to="94" aria-label="94 prosent"><span class="ss-principle-row__stat-count__num">94</span> %</span> av brukere danner seg et førsteinntrykk av et nettsted basert på designet. Et godt design bygger troverdighet med én gang.',
          p2Title: "Struktur og navigasjon",
          p2Body:
            'Brukere forlater raskt sider som er vanskelig å forstå. Vi er nøye med informasjonsarkitektur og innholdsstruktur, slik at brukerne finner det de trenger uten friksjon.',
          p3Title: "Tydelig kommunikasjon",
          p3Body:
            '<span class="ss-principle-row__stat ss-principle-row__stat--count" data-count-to="38" aria-label="38 prosent"><span class="ss-principle-row__stat-count__num">38</span> %</span> av brukere slutter å engasjere seg hvis innholdet er uklart. Klare budskap gjør det enklere å forstå og ta beslutninger.',
          p4Title: "Ytelse og hastighet",
          p4Body:
            '<span class="ss-principle-row__stat ss-principle-row__stat--count" data-count-to="53" aria-label="53 prosent"><span class="ss-principle-row__stat-count__num">53</span> %</span> av brukere forlater en side som tar mer enn 3 sekunder å laste. Vi analyserer og optimaliserer nettsiden for rask lastetid.',
          p5Title: "Tilgjengelighet og kvalitet",
          p5Body:
            '<span class="ss-principle-row__stat ss-principle-row__stat--count" data-count-to="15" aria-label="15 prosent"><span class="ss-principle-row__stat-count__num">15</span> %</span> av verdens befolkning lever med en funksjonsnedsettelse. Vi følger EAA sine nye krav om universell utforming og gir dermed bedre brukeropplevelse for alle.',
          p6Title: "Konvertering i fokus",
          p6Body:
            'Designet skal støtte handling. Gjennom strategisk UI-design legger vi til rette for at besøkende tar det neste steget, enten det gjelder kjøp eller å ta kontakt.',
          p7Title: "Bygget for videre vekst",
          p7Body:
            'Bedrifter som investerer i skalerbare løsninger sparer tid og kostnader over tid. Vi bygger fleksible løsninger som tåler nye tjenester, markeder eller innhold, uten å bryte strukturen.',
        },
        capabilities: {
          sectionNum: "04",
          h2: "Ofte stilte spørsmål",
        },
        ctaBand: {
          sectionNum: "05",
          h2: "Klar for en prat?",
          body:
            'Fortell oss kort hva dere ønsker å få til, så gir vi dere et konkret forslag til neste steg.',
        },
      },

      services: {
        meta: {
          title: "Tjenester og priser | Nettside med adminpanel – Seventh Seal",
          description: "Grunnpakke med skreddersydd nettside, adminpanel, hosting og støtte: fra 7 500 kr + 500 kr/mnd. Se hva som er inkludert, og hvilke tillegg dere kan velge.",
        },
        tape: {
          left: "Det vi leverer",
          num: "02",
          dash: " — ",
          page: "Tjenester",
        },
        header: {
          h1:
            '<span class="block text-label uppercase text-accent mb-g4">Tjenester og priser</span><span class="sr-only">: </span><span>Fra idé til ferdig <span class="text-accent">nettside</span></span>',
          intro:
            'Gode resultater kommer ikke av tilfeldigheter. Vi jobber etter en strukturert prosess med <span class="text-accent">sju tydelige steg</span> – fra første samtale til ferdig nettside. Samtidig tilpasser vi hvert prosjekt etter deres utgangspunkt, behov og ambisjoner.',
          processH2: 'Våre 7 steg fra idé til fungerende nettside',
        },
        a1: {
          num: "01",
          title: "Første samtale",
          body:
            "Vi starter med en kort, uforpliktende prat der vi går gjennom behov, mål og budsjett. Målet er å forstå hva dere faktisk trenger.",
        },
        a2: {
          num: "02",
          title: "Utkast og retning",
          body:
            "Basert på samtalen lager vi et første utkast til nettside. Dette gir dere noe konkret å ta stilling til før dere bestemmer dere videre.",
        },
        a3: {
          num: "03",
          title: "Beslutning og oppstart",
          body:
            "Dersom dere ønsker å gå videre, formaliserer vi samarbeidet og starter prosjektet. Vi avklarer omfang, fremdrift og videre prioriteringer.",
        },
        a4: {
          num: "04",
          title: "Tilbakemelding og revisjoner",
          body:
            "Vi går gjennom utkastet sammen og gjør nødvendige justeringer. Grunnpakken inkluderer 3 revisjonsrunder for å finjustere design og innhold.",
        },
        a5: {
          num: "05",
          title: "Ferdigstillelse",
          body:
            "Når endringene er implementert og dere er fornøyde, ferdigstilles nettsiden. Vi tester at alt fungerer teknisk, visuelt og på ulike enheter, inkludert lastetid, SEO-optimalisering og sikkerhet (SSL).",
        },
        a6: {
          num: "06",
          title: "Lansering og overlevering",
          body:
            "Nettsiden publiseres og kobles til domene. Dere får tilgang til løsningen, og vi sørger for en trygg overlevering.",
        },
        a7: {
          num: "07",
          title: "Lansering og veien videre",
          body1:
            "Når nettsiden er klar, publiserer vi den og kobler den til riktig domene.",
          body2:
            "Etter lansering er hosting, oppetidsovervåkning og støtte inkludert i månedsabonnementet — og dere kan selv oppdatere tekst, bilder og logo i adminpanelet. Ønsker dere senere å stå helt på egne ben, kan rettighetene til kode og design kjøpes ut.",
        },
        models: {
          label: "Pris og drift",
          h2: "Én grunnpakke. Du velger resten.",
          intro:
            "Vi holder prisen enkel og forutsigbar. Grunnpakken dekker det de fleste bedrifter trenger — skreddersydd nettside, adminpanel, hosting og støtte. Trenger dere mer, legger dere til akkurat de funksjonene dere vil ha. Prisene er de dere betaler — ingen mva kommer i tillegg.",
          pkg1: {
            label: "Mest populær",
            title: "Nettside + adminpanel",
            ingress:
              "Skreddersydd nettside med eget adminpanel der dere selv kan redigere tekst, bilder og logo. Hosting og vedlikehold er inkludert.",
            priceLabel: "Pris",
            priceEtablering: "7 500–9 000 kr i engangsbeløp",
            priceDrift: "500 kr/mnd i abonnement",
            priceExtra: "+ 500 kr per ekstra underside",
            body:
              "Vi designer og bygger nettsiden, setter opp adminpanelet og sørger for at alt ligger stabilt på nett — med hosting, overvåkning og støtte inkludert i månedsprisen. Drift og oppdatering av panelet ligger i den samme månedsprisen, og er verken et tillegg eller noe dere overtar når nettsiden er levert. Se hva <a href=\"drifte-nettsider.html\" class=\"ss-inline-link\">drift av nettsider</a> innebærer.",
            includes:
              "<ul class=\"ss-models__list\"><li>Skreddersydd design og layout</li><li>Adminpanel med redigering av tekst, bilder og logo — <a href=\"oppdatere-nettsiden-selv.html\" class=\"ss-inline-link\">se hvordan det fungerer</a></li><li>Kontaktskjema koblet til e-post</li><li>Hosting og oppetidsovervåkning</li><li>E-poststøtte med 24-timers respons, ofte raskere</li><li>3 revisjonsrunder inkludert</li><li>Onboarding: 30 min gjennomgang der vi lærer dere å bruke adminpanelet</li></ul>",
            explain:
              "Passer for bedrifter som vil ha en profesjonell nettside uten å håndtere kode, hosting eller teknisk vedlikehold selv.",
            summaryLabel: "Kort fortalt:",
            summary: "Dere fokuserer på virksomheten. Vi sørger for at nettsiden fungerer.",
            panelNote:
              'Panelet er inkludert, ikke et tillegg. <a href="oppdatere-nettsiden-selv.html#sandkasse" class="ss-inline-link">Du kan prøve det selv</a> før dere bestemmer dere.',
          },
          addons: {
            label: "Tillegg",
            h3Onetime: "Tillegg — engangsbetaling",
            intro:
              "Alle tillegg kan bestilles ved oppstart eller legges til senere. Tillegg faktureres i sin helhet før arbeidet starter.",
            onetimeBadge: "Engangsbetaling",
            a2Title: "Nyhetsseksjon",
            a2Body: "Legg til, rediger og fjern nyheter direkte fra adminpanelet.",
            a2Price: "1 000 kr",
            a4Title: "Bookingintegrasjon",
            a4Body: "Kunder kan bestille tid direkte på nettsiden uten å ringe.",
            a4Price: "1 500 kr",
            a5Title: "Flerspråklig nettside",
            a5Body: "Toggle mellom norsk og engelsk. Begge språk redigeres separat.",
            a5Price: "1 500 kr",
          },
          referral: {
            label: "Vervprogram",
            title: "Verv en bedrift — få tre måneder gratis",
            body:
              "Eksisterende kunder som sender oss en ny betalende kunde får tre måneder gratis (1 500 kr i avslag). Det er ingen grense på antall vervinger. Rabatten aktiveres når den nye kunden har betalt sin første månedsfaktura.",
            summaryLabel: "Kort fortalt:",
            summary: "Ingen grense på antall vervinger — tre måneder gratis per ny kunde.",
          },
          vilkar: {
            label: "Vilkår",
            title: "Vilkår i korte trekk",
            items: [
              "50 % forskuddsbetaling ved oppstart, 50 % ved levering.",
              "3 revisjonsrunder er inkludert i grunnpakken. Ytterligere revisjoner gjøres ved nærmere avtale.",
              "Avtalt leveringsfrist forutsetter at kunden leverer tekst, bilder og logo innen fastsatt dato.",
              "30 dagers skriftlig oppsigelse. Ved oppsigelse kan rettighetene til kode og design kjøpes ut for avtalt pris.",
              "Prisene er de dere betaler — ingen mva kommer i tillegg.",
            ],
            linkText: "Les fullstendige vilkår",
          },
          unsure: {
            label: "Usikker?",
            title: "Usikker på hva dere trenger?",
            body:
              "Det er helt normalt. Derfor starter vi gjerne med en kort prat og et uforpliktende førsteutkast.<br><br>Da får dere se en konkret retning før dere bestemmer dere for omfang, tillegg og videre samarbeid.",
            cta: "Start med et gratis førsteutkast",
          },
        },
        closing: {
          line:
            'Fortell oss hva dere trenger <span class="text-accent">først</span> — så foreslår vi en <span class="text-accent">fornuftig rekkefølge</span>.',
        },
      },

      work: {
        meta: {
          title: "Arbeid | Eksempler på nettsider – Seventh Seal",
          description: "Se eksempler på nettsider og webdesign vi har laget for norske virksomheter, med fokus på tydelig kommunikasjon og profesjonelt uttrykk.",
        },
        tape: {
          left: "Utvalgte caser",
          num: "03",
          dash: " — ",
          page: "Arbeid",
        },
        header: {
          kicker: "Arbeid",
          h1: 'Eksempler på <span class="text-accent">nettsider</span>',
          intro:
            'Her er noen eksempler på nettsider og webdesign vi har laget for norske virksomheter, som ønsker et tydeligere og mer profesjonelt digitalt uttrykk.',
        },
        listAria: "Prosjekter",
        p1: {
          tag: "Økonomi / rådgivning — Økonomiledelse",
          title: "Økonomiledelse AS",
          body:
            'Resultat:<br>Tydelig presentasjon av CFO- og økonomitjenester, og en enklere vei til kontakt for nye oppdrag.',
          meta: "2026",
        },
        p2: {
          tag: "Reise / opplevelse — Skogli Gard",
          title: "Skogli Gard",
          body:
            'Resultat:<br>Bedre presentasjon av tilbud og enklere kontakt med kunder.',
          meta: "2026",
        },
        p3: {
          tag: "Tjenester — Lille Amir Frisør",
          title: "Lille Amir Frisør",
          body:
            'Resultat:<br>Mer profesjonell tilstedeværelse og enklere booking for kunder.',
          quote:
            '"Før hadde vi ikke en egen nettside, vi brukte Timma som booking, som føltes veldig upersonlig. Vi er veldig fornøyde med samarbeidet og nettsiden ble veldig clean og profesjonell. Akkurat det vi var ute etter."<br>— Amir Frisør',
          meta: "2026",
        },
        bottom: {
          line:
            "Vil dere se mer, eller diskutere et lignende prosjekt?",
        },
      },

      about: {
        meta: {
          title: "Om oss | Norsk designbyrå for moderne nettsider – Seventh Seal",
          description: "Seventh Seal er et lite, ambisiøst designbyrå i Norge. Vi designer, utvikler og drifter kostnadseffektive nettsider for bedrifter – med fokus på kvalitet fremfor kvantitet.",
        },
        tape: {
          left: "Studio",
          num: "04",
          dash: " — ",
          page: "Om oss",
        },
        hero: {
          kicker: "Om oss",
          h1:
            'Liten gjeng.<br>Stor<br><span class="text-accent">gjennomføringsevne</span>.',
          body:
            'Seventh Seal er et norsk webdesignbyrå i Oslo som lager moderne nettsider for bedrifter. Vi har et lite team bestående av to unge og ambisiøse utviklere – Trym og Stellan. Vi jobber tett på hvert prosjekt og tar ansvar for hele prosessen, fra første idé til ferdig løsning.',
        },
        team: {
          body:
            'Trym er kommunikasjons- og strukturansvarlig, med fokus på strategi og innhold. Stellan har ansvar for design, kode og teknisk oppsett, inkludert ytelse og sikkerhet.<br><br>Vi legger mye arbeid i hvert prosjekt og arbeider etter prinsippet: kvalitet over kvantitet. Som et lite team med fokus på å utvide vår portefølje, kan vi samtidig tilby svært kostnadseffektive løsninger sammenlignet med større byråer.',
        },
        process: {
          sectionNum: "02",
          h2: "Slik jobber vi",
          s1Title: "Design i Figma",
          s1Body:
            "Vi starter med å skreddersy hele nettsidens struktur og brukergrensesnitt i Figma. Her utvikler vi layout, navigasjon og visuell identitet fra bunnen av, tilpasset deres merkevare og målgruppe.",
          s2Title: "Utvikling i kode",
          s2Body:
            "Når designet er godkjent, bygger vi nettsiden manuelt i kode og gjør alt fullt funksjonelt, responsivt og optimalisert for både mobil og desktop.",
          s3Title: "Hosting og sikkerhet",
          s3Body:
            "Til slutt setter vi opp nettsiden gjennom Hostinger med hosting, SSL-sertifikat og teknisk infrastruktur, slik at løsningen er rask, trygg og klar for lansering.",
        },
        collab: {
          kicker: "Samarbeid",
          h2: "Samarbeidspartnere",
          body:
            'Vi samarbeider med utvalgte aktører når et prosjekt trenger kompetanse utenfor nettside, design og drift. Blant annet samarbeider vi med <a href="https://formaa.no/" class="ss-inline-link" target="_blank" rel="noopener">Formaa</a>, et norsk produktutviklingsbyrå som hjelper gründere og startups med produktdesign, prototyping, CAD og 3D-visualisering.',
        },
      },

      contact: {
        meta: {
          title: "Kontakt | Få gratis førsteutkast – Seventh Seal",
          description: "Start med en uforpliktende prat og få et gratis førsteutkast til nettside for bedriften deres.",
        },
        tape: {
          left: "Start en samtale",
          num: "05",
          dash: " — ",
          page: "Kontakt",
        },
        hero: {
          kicker: "Kontakt",
          h1: 'Få et <span class="text-accent">gratis utkast</span>',
          body:
            'Fortell oss kort om bedriften og behovet deres. Vi tar en <span class="text-accent">uforpliktende prat</span> og lager et første utkast til nettside — uten forpliktelser. Den første samtalen er et videomøte — se hvordan vi jobber som <a href="webutvikler-oslo.html" class="ss-inline-link">webutvikler i Oslo</a>.',
        },
        mainSr: "Kontakt og skjema",
        directKicker: "Direkte",
        emailLabel: "E-post",
        emailHref: "mailto:team@seventhseal.no",
        emailAddress: "team@seventhseal.no",
        locationLabel: "Sted",
        locationLine: "Oslo, Norge",
        formAria: "Kontaktskjema",
        form: {
          name: "Navn",
          namePh: "Ditt navn",
          email: "E-post",
          emailPh: "deg@firma.no",
          company: "Bedrift (valgfritt)",
          companyPh: "Bedriftsnavn",
          message: "Melding",
          messagePh: "Fortell oss kort hva dere trenger.",
          note: "",
          submit: "Send forespørsel",
          submitting: "Sender…",
          submitted: "Sendt",
          successText: "Takk! Meldingen er sendt. Vi tar kontakt så snart vi kan.",
          errorText: "Noe gikk galt. Prøv igjen, eller send oss en e-post direkte på team@seventhseal.no.",
        },
      },
    },
  };
