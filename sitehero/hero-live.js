/**
 * Levende hero: 7- og S-tegnene fra hero-videoen, tegnet i sanntid.
 *
 * Erstatter <video class="hero__media"> med
 *   <canvas class="hero__media hero-live" width="1898" height="876" aria-hidden="true">
 * og arver dermed ALLE oppsettene .hero__media allerede har (fullskjerm,
 * baandet under 1024, raden i hoeykant) uten en eneste ny layoutregel.
 *
 * Hva som skjer:
 *   - tegnene kommer mot kameraet fra et forsvinningspunkt til HOEYRE for
 *     H1-en paa desktop (midt i baandet ellers), saa teksten slipper
 *     tettheten;
 *   - et svakt sjakkbrett-gulv i perspektiv (logoens brett) gir dybde;
 *   - «warp» inn ved lasting, fartsoekning naar man scroller ut av heroen;
 *   - tegnene viker for pekeren, klikk/trykk paa heroen gir et smell,
 *     og hover paa «Få gratis utkast» setter opp farten.
 *
 * Hva som IKKE skjer:
 *   - ingenting kjoerer med prefers-reduced-motion. .hero__media er da
 *     display: none fra foer, og posteren males paa .hero som i dag.
 *     Brukeren kan bytte innstilling etter sidelast; det lyttes paa.
 *   - ingenting kjoerer utenfor skjermen (IntersectionObserver) eller i
 *     en skjult fane (visibilitychange).
 *   - trege enheter faar faerre tegn og ingen uskarphet: gjennomsnittlig
 *     rammetid maales de foerste sekundene og antallet justeres EN gang.
 *
 * Ingen avhengigheter. Ett klassisk skript, defer.
 */
(function () {
  'use strict';

  var canvas = document.querySelector('canvas.hero-live');
  if (!canvas) return;
  var hero = canvas.closest('.hero') || canvas.parentElement;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var RED = '#ff1e3c';
  var DRED = '#d70022';
  var FONT = '"IBM Plex Sans", system-ui, sans-serif';
  var MANUAL = canvas.hasAttribute('data-hero-manual'); // opptak/test: ingen egen loop

  // ── seedet tilfeldighet, saa et opptak kan gjentas bilde for bilde ─────
  var seed = 7;
  function rnd() {
    seed = (seed + 0x6d2b79f5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function clamp(x, a, b) {
    return x < a ? a : x > b ? b : x;
  }
  function outExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  // ── sprites: hvert tegn er ferdig tegnet EN gang, i to roedtoner og tre
  //    skarphetsgrader (skarp / litt uskarp / bokeh) ─────────────────────
  var SPR = 256; // fontstoerrelse i spriten
  var sprites = null;
  var canBlur = typeof ctx.filter === 'string';
  function makeSprite(ch, color, blur) {
    var pad = 40 + blur * 3;
    var c = document.createElement('canvas');
    c.width = SPR + pad * 2;
    c.height = SPR + pad * 2;
    var g = c.getContext('2d');
    if (blur && canBlur) g.filter = 'blur(' + blur + 'px)';
    g.translate(c.width / 2, c.height / 2);
    g.transform(1, 0, -0.26, 1, 0, 0); // kursiv som i videoen
    g.fillStyle = color;
    g.font = '700 ' + SPR + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 0, SPR * 0.04);
    return c;
  }
  function buildSprites() {
    sprites = {};
    ['7', 'S'].forEach(function (ch) {
      [RED, DRED].forEach(function (col) {
        sprites[ch + col] = [makeSprite(ch, col, 0), makeSprite(ch, col, 5), makeSprite(ch, col, 14)];
      });
    });
  }

  // ── verden ─────────────────────────────────────────────────────────────
  var Z_FAR = 18;
  var Z_NEAR = 0.55;
  var glyphs = [];
  var W = 0;
  var H = 0;
  var dpr = 1;
  var layout = { vpX: 0, vpY: 0, hor: 0, f: 1, wide: true };
  var quality = 1; // 1 = full, 0 = redusert

  function spawn(g, z) {
    // flere tegn til hoeyre for teksten naar forsvinningspunktet ligger der
    var side = layout.wide ? (rnd() < 0.72 ? 1 : -1) : rnd() < 0.5 ? 1 : -1;
    g.x = side * (0.2 + Math.pow(rnd(), 0.9) * 6.5);
    g.y = (rnd() - 0.58) * 5.2;
    g.z = z == null ? Z_FAR * (0.85 + rnd() * 0.15) : z;
    g.ch = rnd() < 0.5 ? '7' : 'S';
    g.size = 0.45 + rnd() * 0.55;
    g.rot = rnd() * Math.PI * 2;
    g.spin = (rnd() - 0.5) * 1.6;
    g.yaw = rnd() * Math.PI * 2;
    g.yawSpeed = (rnd() - 0.5) * 5;
    g.ox = 0;
    g.oy = 0;
    g.vx = 0;
    g.vy = 0;
    return g;
  }
  function populate() {
    var target = Math.round(clamp((W * H) / 7500, 45, 175) * (quality ? 1 : 0.6));
    while (glyphs.length < target) glyphs.push(spawn({}, Z_NEAR + rnd() * (Z_FAR - Z_NEAR)));
    glyphs.length = target;
  }

  function measure() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, W > 1100 ? 1.5 : 2);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // desktop-oppsettet: teksten staar til venstre over hele heroen
    layout.wide = W >= 1024 && W / H > 0.8 && H > 400;
    layout.vpX = W * (layout.wide ? 0.7 : 0.5);
    layout.vpY = H * (layout.wide ? 0.46 : 0.45);
    layout.hor = H * (layout.wide ? 0.7 : 0.66);
    // brennvidde: samme tegnstoerrelse i fullskjerm og i baandet under 1024
    layout.f = layout.wide ? Math.max(H * 0.55, Math.min(W * 0.36, 520)) : Math.max(H * 1.1, W * 0.42);
    populate();
  }

  // ── tilstand fra brukeren ──────────────────────────────────────────────
  var pointer = { x: -9999, y: -9999, nx: 0, ny: 0, inside: false };
  var cam = { x: 0, y: 0 };
  var boost = 0;
  var boostTarget = 0;
  var bursts = [];
  var scrollP = 0;

  function toLocal(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var p = toLocal(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.nx = (p.x / p.w) * 2 - 1;
    pointer.ny = (p.y / p.h) * 2 - 1;
    pointer.inside = true;
  });
  hero.addEventListener('pointerleave', function () {
    pointer.inside = false;
    pointer.x = pointer.y = -9999;
  });
  hero.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button')) return; // lenkene er lenker, ikke leketoey
    var p = toLocal(e);
    if (p.x < 0 || p.y < 0 || p.x > p.w || p.y > p.h) return;
    burst(p.x, p.y);
  });
  function burst(x, y) {
    bursts.push({ x: x, y: y, t: 0 });
    for (var i = 0; i < glyphs.length; i++) {
      var g = glyphs[i];
      if (g.sx == null) continue;
      var dx = g.sx - x;
      var dy = g.sy - y;
      var d = Math.sqrt(dx * dx + dy * dy) + 1;
      var R = Math.max(W, H) * 0.45;
      if (d > R) continue;
      var k = Math.pow(1 - d / R, 1.5) * 1500;
      g.vx += (dx / d) * k;
      g.vy += (dy / d) * k;
      g.yawSpeed += (rnd() - 0.5) * 18;
    }
  }
  var cta = hero.querySelector('.index-hero-btn--solid');
  if (cta) {
    cta.addEventListener('pointerenter', function () {
      boostTarget = 1;
    });
    cta.addEventListener('pointerleave', function () {
      boostTarget = 0;
    });
    cta.addEventListener('focus', function () {
      boostTarget = 1;
    });
    cta.addEventListener('blur', function () {
      boostTarget = 0;
    });
  }
  function readScroll() {
    var r = hero.getBoundingClientRect();
    scrollP = clamp(-r.top / Math.max(1, r.height), 0, 1);
  }

  // ── en ramme ───────────────────────────────────────────────────────────
  var clock = 0;
  var travelled = 0;

  function step(dt) {
    clock += dt;
    var intro = 1 + 11 * (1 - outExpo(clamp(clock / 1.8, 0, 1)));
    boost += (boostTarget - boost) * (1 - Math.exp(-dt * 5));
    var speed = 2.1 * intro * (1 + boost * 1.4) * (1 + 5 * scrollP * scrollP);
    travelled += speed * dt;
    var par = pointer.inside ? 1 : 0;
    cam.x += (pointer.nx * 0.45 * par - cam.x) * (1 - Math.exp(-dt * 3));
    cam.y += (pointer.ny * 0.25 * par - cam.y) * (1 - Math.exp(-dt * 3));

    for (var i = 0; i < glyphs.length; i++) {
      var g = glyphs[i];
      g.z -= speed * dt;
      g.rot += g.spin * dt;
      g.yaw += g.yawSpeed * dt;
      g.yawSpeed += (Math.sign(g.yawSpeed) * 2.5 - g.yawSpeed) * (1 - Math.exp(-dt * 1.5));
      if (g.z < Z_NEAR) spawn(g);
      // smellet: fart som daempes
      g.ox += g.vx * dt;
      g.oy += g.vy * dt;
      var damp = Math.exp(-dt * 3.2);
      g.vx *= damp;
      g.vy *= damp;
    }
    for (var b = bursts.length - 1; b >= 0; b--) {
      bursts[b].t += dt;
      if (bursts[b].t > 0.8) bursts.splice(b, 1);
    }
    return speed;
  }

  function drawFloor(speed) {
    var hor = layout.hor;
    var f = (H - hor) * 1.1;
    var vpX = layout.vpX - cam.x * f * 0.25;
    var shift = travelled % 2;
    // horisont: roed strek som toner ut mot sidene
    var hg = ctx.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, 'rgba(255,30,60,0)');
    hg.addColorStop(clamp(vpX / W, 0.05, 0.95), 'rgba(255,30,60,0.6)');
    hg.addColorStop(1, 'rgba(255,30,60,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, hor - 1, W, 1.5);
    // brettet
    for (var k = 0; k < 34; k++) {
      var z0 = k + 1 - shift;
      var z1 = z0 + 1;
      if (z0 < 0.8) continue;
      var y0 = hor + f / z1;
      var y1 = hor + f / z0;
      if (y0 > H) continue;
      var fade = clamp(1 - k / 30, 0, 1);
      var alpha = 0.05 * fade * fade;
      if (alpha < 0.003) continue;
      ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(4) + ')';
      var parity = (k + Math.floor(travelled)) & 1;
      for (var X = -26; X < 26; X++) {
        if (((X + parity) & 1) !== 0) continue;
        var xa0 = vpX + (X * f) / z1;
        var xa1 = vpX + ((X + 1) * f) / z1;
        var xb0 = vpX + (X * f) / z0;
        var xb1 = vpX + ((X + 1) * f) / z0;
        if (Math.max(xa1, xb1) < 0 || Math.min(xa0, xb0) > W) continue;
        ctx.beginPath();
        ctx.moveTo(xa0, y0);
        ctx.lineTo(xa1, y0);
        ctx.lineTo(xb1, Math.min(y1, H + 50));
        ctx.lineTo(xb0, Math.min(y1, H + 50));
        ctx.fill();
      }
    }
    // gulvet svartner mot horisonten
    var fg = ctx.createLinearGradient(0, hor, 0, hor + (H - hor) * 0.45);
    fg.addColorStop(0, 'rgba(0,0,0,1)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, hor + 1, W, (H - hor) * 0.45);
  }

  function drawGlyphs(speed) {
    var f = layout.f;
    var order = glyphs.slice().sort(function (a, b) {
      return b.z - a.z;
    });
    var R = Math.min(220, Math.max(W, H) * 0.16);
    var streak = speed > 3 ? clamp((speed - 3) / 10, 0, 1) : 0;
    for (var i = 0; i < order.length; i++) {
      var g = order[i];
      var s = f / g.z;
      var bx = layout.vpX + (g.x - cam.x) * s;
      var by = layout.vpY + (g.y - cam.y) * s;
      // pekeren skyver tegnene til side, myk fjaer tilbake
      var px = 0;
      var py = 0;
      if (pointer.inside) {
        var dx = bx + g.ox - pointer.x;
        var dy = by + g.oy - pointer.y;
        var d = Math.sqrt(dx * dx + dy * dy) + 0.001;
        if (d < R) {
          var push = Math.pow(1 - d / R, 2) * R * 0.55;
          px = (dx / d) * push;
          py = (dy / d) * push;
        }
      }
      g.px = (g.px || 0) + (px - (g.px || 0)) * 0.16;
      g.py = (g.py || 0) + (py - (g.py || 0)) * 0.16;
      var sx = bx + g.ox + g.px;
      var sy = by + g.oy + g.py;
      g.sx = sx;
      g.sy = sy;
      var size = g.size * s;
      if (sx < -size * 2 || sx > W + size * 2 || sy < -size * 2 || sy > H + size * 2) continue;
      var a = clamp((Z_FAR - g.z) / (Z_FAR * 0.3), 0, 1) * clamp((g.z - Z_NEAR) / 0.35, 0, 1);
      if (a <= 0.01) continue;
      var face = Math.cos(g.yaw);
      var set = sprites[g.ch + (face >= 0 ? RED : DRED)];
      // dybdeskarphet: langt unna og helt naert blir uskarpt
      var lvl = quality ? (g.z > 15 ? 1 : g.z < 1.3 ? 2 : g.z < 2.1 ? 1 : 0) : 0;
      var spr = set[lvl];
      var k = size / SPR;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(sx, sy);
      ctx.rotate(g.rot);
      ctx.scale(k * (0.18 + 0.82 * Math.abs(face)), k);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
      // fartsstriper naar det gaar fort
      if (streak > 0 && quality) {
        for (var n = 1; n <= 3; n++) {
          var zz = g.z + n * 0.12 * speed * 0.05;
          var ss = f / zz;
          ctx.save();
          ctx.globalAlpha = a * streak * (0.28 - n * 0.07);
          ctx.translate(layout.vpX + (g.x - cam.x) * ss + g.ox, layout.vpY + (g.y - cam.y) * ss + g.oy);
          ctx.rotate(g.rot);
          var kk = (g.size * ss) / SPR;
          ctx.scale(kk * (0.18 + 0.82 * Math.abs(face)), kk);
          ctx.drawImage(set[1], -set[1].width / 2, -set[1].height / 2);
          ctx.restore();
        }
      }
    }
  }

  function drawOverlays() {
    // svak glo rundt pekeren
    if (pointer.inside) {
      var rg = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 240);
      rg.addColorStop(0, 'rgba(255,30,60,0.10)');
      rg.addColorStop(1, 'rgba(255,30,60,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(pointer.x - 240, pointer.y - 240, 480, 480);
    }
    for (var i = 0; i < bursts.length; i++) {
      var b = bursts[i];
      var p = b.t / 0.8;
      ctx.strokeStyle = 'rgba(255,30,60,' + (0.8 * (1 - p)).toFixed(3) + ')';
      ctx.lineWidth = 3 * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 12 + outExpo(p) * Math.max(W, H) * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    }
    // venstre side og bunnen toner mot sort, saa teksten og neste seksjon
    // aldri konkurrerer med et tegn i full styrke
    if (layout.wide) {
      var lg = ctx.createLinearGradient(0, 0, W * 0.55, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0.55)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, W * 0.55, H);
    }
    // toppen toner mot sort under headeren, saa navigasjonen alltid staar
    if (layout.wide) {
      var tg = ctx.createLinearGradient(0, 0, 0, H * 0.2);
      tg.addColorStop(0, 'rgba(0,0,0,0.8)');
      tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, W, H * 0.2);
    }
    var bg = ctx.createLinearGradient(0, H * 0.82, 0, H);
    bg.addColorStop(0, 'rgba(0,0,0,0)');
    bg.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, H * 0.82, W, H * 0.18 + 1);
  }

  function render(dt) {
    var speed = step(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    drawFloor(speed);
    drawGlyphs(speed);
    drawOverlays();
  }

  // ── loopen, med alle grunnene til IKKE aa kjoere ──────────────────────
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var visible = true;
  var raf = 0;
  var last = 0;
  var started = false;
  var perf = { n: 0, sum: 0, decided: false };

  function frame(ts) {
    raf = 0;
    var dt = last ? Math.min((ts - last) / 1000, 0.05) : 1 / 60;
    last = ts;
    readScroll();
    render(dt);
    if (!perf.decided && clock > 1) {
      perf.n++;
      perf.sum += dt;
      if (perf.n >= 90) {
        perf.decided = true;
        if (perf.sum / perf.n > 1 / 40) {
          quality = 0;
          populate();
        }
      }
    }
    schedule();
  }
  function schedule() {
    if (raf || MANUAL) return;
    if (reduce.matches || !visible || document.hidden) {
      last = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (started || reduce.matches) return;
    started = true;
    if (!sprites) buildSprites();
    measure();
    canvas.classList.add('is-live');
    if (MANUAL) {
      window.heroLive = {
        // opptak: styr tid, peker og scroll utenfra, én ramme om gangen
        frame: function (dt, s) {
          if (s) {
            if (s.pointer) {
              pointer.x = s.pointer[0];
              pointer.y = s.pointer[1];
              pointer.nx = (s.pointer[0] / W) * 2 - 1;
              pointer.ny = (s.pointer[1] / H) * 2 - 1;
              pointer.inside = true;
            } else {
              pointer.inside = false;
              pointer.x = pointer.y = -9999;
            }
            if (s.burst) burst(s.burst[0], s.burst[1]);
            boostTarget = s.boost ? 1 : 0;
          }
          readScroll();
          render(dt);
        },
        size: function () {
          return { w: W, h: H };
        },
      };
      return;
    }
    schedule();
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      if (started) measure();
    }).observe(canvas);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      schedule();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', schedule);
  var onReduce = function () {
    if (reduce.matches) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else {
      start();
      schedule();
    }
  };
  if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
  else if (reduce.addListener) reduce.addListener(onReduce);

  // Vent paa Plex (tegnene skal vaere sidens egen skrift), men aldri lenge.
  var fontReady = document.fonts && document.fonts.load ? document.fonts.load('700 100px "IBM Plex Sans"') : Promise.resolve();
  Promise.race([fontReady, new Promise(function (r) {
    setTimeout(r, 1200);
  })]).then(start, start);
})();
