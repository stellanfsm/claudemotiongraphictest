// gl3d.js — a compact WebGL2 renderer for the reel's 3D shots.
//
// Meshes (boxes, rounded device bodies, lathed chess pieces, drums), one
// studio-lit PBR-style material with a procedural softbox environment, a
// PCF-filtered shadow map, a glossy reflective chessboard floor (mirror pass +
// Fresnel blend), canvas textures, and a post chain (bloom, chromatic
// aberration, lens breathing, vignette, grain). Everything is deterministic, so
// it renders identically in headless Chromium (SwiftShader) and in a browser.

// ─── matrices (column-major, like GL) ──────────────────────────────────────
export const m4 = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
export const chain = (...ms) => ms.reduce((a, b) => mul(a, b));
export function T(x, y, z) {
  const m = m4();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}
export function S(x, y = x, z = x) {
  const m = m4();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}
export function Rx(a) {
  const m = m4();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}
export function Ry(a) {
  const m = m4();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}
export function Rz(a) {
  const m = m4();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}
export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
export function ortho(l, r, b, t, n, f) {
  const m = m4();
  m[0] = 2 / (r - l);
  m[5] = 2 / (t - b);
  m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l);
  m[13] = -(t + b) / (t - b);
  m[14] = -(f + n) / (f - n);
  return m;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function lookAt(eye, target, up = [0, 1, 0], roll = 0) {
  const z = norm(sub(eye, target));
  let x = norm(cross(up, z));
  let y = cross(z, x);
  if (roll) {
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const nx = [x[0] * c + y[0] * s, x[1] * c + y[1] * s, x[2] * c + y[2] * s];
    y = [y[0] * c - x[0] * s, y[1] * c - x[1] * s, y[2] * c - x[2] * s];
    x = nx;
  }
  const m = m4();
  m[0] = x[0];
  m[4] = x[1];
  m[8] = x[2];
  m[1] = y[0];
  m[5] = y[1];
  m[9] = y[2];
  m[2] = z[0];
  m[6] = z[1];
  m[10] = z[2];
  m[12] = -dot(x, eye);
  m[13] = -dot(y, eye);
  m[14] = -dot(z, eye);
  return m;
}
function normalMatrix(m) {
  const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  const inv = 1 / det;
  // inverse-transpose of the upper 3×3
  return new Float32Array([
    A * inv, B * inv, C * inv,
    -(b * i - c * h) * inv, (a * i - c * g) * inv, -(a * h - b * g) * inv,
    (b * f - c * e) * inv, -(a * f - c * d) * inv, (a * e - b * d) * inv,
  ]);
}
export function project(vp, p, W, H) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  return [((x / w) * 0.5 + 0.5) * W, (1 - ((y / w) * 0.5 + 0.5)) * H, w];
}
export const transformPoint = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

// ─── mesh builders (interleaved pos3 nor3 uv2) ─────────────────────────────
class Builder {
  constructor() {
    this.v = [];
    this.i = [];
  }
  vert(p, n, uv) {
    this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1]);
    return this.v.length / 8 - 1;
  }
  tri(a, b, c) {
    this.i.push(a, b, c);
  }
  quad(a, b, c, d) {
    this.i.push(a, b, c, a, c, d);
  }
}

// Axis-aligned box centred on the origin. The +z face maps uv 0..1 with v
// running downwards (screen convention); the −z face maps mirrored in y so a
// tile flipped 180° about X shows its back image upright.
export function boxGeo(w, h, d) {
  const B = new Builder();
  const x = w / 2, y = h / 2, z = d / 2;
  const face = (n, corners, uvs) => {
    const ids = corners.map((p, k) => B.vert(p, n, uvs[k]));
    B.quad(ids[0], ids[1], ids[2], ids[3]);
  };
  const std = [[0, 1], [1, 1], [1, 0], [0, 0]];
  face([0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], std);
  face([0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]], [[1, 0], [0, 0], [0, 1], [1, 1]]);
  face([1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]], std);
  face([-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]], std);
  face([0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]], std);
  face([0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]], std);
  return B;
}

// Rounded rectangle outline, counter-clockwise, with outward 2D normals.
function roundRectOutline(w, h, r, seg) {
  const pts = [];
  const cs = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of cs) {
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (k / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)]);
    }
  }
  return pts;
}

// A device body: a rounded rectangle in XY, depth d along Z, with the z-edges
// rounded by radius b. Front face is +Z.
export function slabGeo(w, h, d, r, b, seg = 10, bseg = 6) {
  const B = new Builder();
  const rings = [];
  for (let k = 0; k <= bseg * 2 + 1; k++) {
    // front bevel (θ 0..π/2), then back bevel
    let th, z, inset;
    if (k <= bseg) {
      th = (k / bseg) * (Math.PI / 2);
      z = d / 2 - b + b * Math.cos(th);
      inset = b * (1 - Math.sin(th));
    } else {
      const kk = k - bseg - 1;
      th = Math.PI / 2 + (kk / bseg) * (Math.PI / 2);
      z = -(d / 2 - b) + b * Math.cos(th);
      inset = b * (1 - Math.sin(th));
    }
    const out = roundRectOutline(w - 2 * inset, h - 2 * inset, Math.max(0.001, r - inset), seg);
    const nz = Math.cos(th);
    const nxy = Math.sin(th);
    rings.push(out.map(([x, y, nx, ny]) => B.vert([x, y, z], [nx * nxy, ny * nxy, nz], [0.5 + x / w, 0.5 - y / h])));
  }
  const n = rings[0].length;
  for (let k = 0; k < rings.length - 1; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      B.quad(rings[k + 1][j], rings[k + 1][j2], rings[k][j2], rings[k][j]);
    }
  }
  // caps
  const capF = B.vert([0, 0, d / 2], [0, 0, 1], [0.5, 0.5]);
  const f0 = roundRectOutline(w - 2 * b, h - 2 * b, Math.max(0.001, r - b), seg).map(([x, y]) => B.vert([x, y, d / 2], [0, 0, 1], [0.5 + x / w, 0.5 - y / h]));
  for (let j = 0; j < n; j++) B.tri(capF, f0[j], f0[(j + 1) % n]);
  const capB = B.vert([0, 0, -d / 2], [0, 0, -1], [0.5, 0.5]);
  const b0 = roundRectOutline(w - 2 * b, h - 2 * b, Math.max(0.001, r - b), seg).map(([x, y]) => B.vert([x, y, -d / 2], [0, 0, -1], [0.5 + x / w, 0.5 - y / h]));
  for (let j = 0; j < n; j++) B.tri(capB, b0[(j + 1) % n], b0[j]);
  return B;
}

// Flat rounded rectangle facing +Z (screens). uv: u right, v down.
export function panelGeo(w, h, r, seg = 10) {
  const B = new Builder();
  const c = B.vert([0, 0, 0], [0, 0, 1], [0.5, 0.5]);
  const out = roundRectOutline(w, h, r, seg).map(([x, y]) => B.vert([x, y, 0], [0, 0, 1], [0.5 + x / w, 0.5 - y / h]));
  for (let j = 0; j < out.length; j++) B.tri(c, out[j], out[(j + 1) % out.length]);
  return B;
}

// Surface of revolution around Y from a profile of [radius, y] points.
export function latheGeo(profile, seg = 64) {
  const B = new Builder();
  const P = profile;
  // per-point normals from neighbouring segments (sharp where marked with a 3rd value)
  const segN = [];
  for (let k = 0; k < P.length - 1; k++) {
    const dr = P[k + 1][0] - P[k][0];
    const dy = P[k + 1][1] - P[k][1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([dy / l, -dr / l]);
  }
  let len = 0;
  const vs = [0];
  for (let k = 1; k < P.length; k++) vs.push((len += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1])));
  for (let k = 0; k < P.length - 1; k++) {
    const nA = P[k][2] || k === 0 ? segN[k] : norm2(add2(segN[k - 1], segN[k]));
    const nB = P[k + 1][2] || k + 1 === P.length - 1 ? segN[k] : norm2(add2(segN[k], segN[k + 1]));
    const row = [];
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      row.push([
        B.vert([P[k][0] * ca, P[k][1], P[k][0] * sa], [nA[0] * ca, nA[1], nA[0] * sa], [s / seg, vs[k] / len]),
        B.vert([P[k + 1][0] * ca, P[k + 1][1], P[k + 1][0] * sa], [nB[0] * ca, nB[1], nB[0] * sa], [s / seg, vs[k + 1] / len]),
      ]);
    }
    for (let s = 0; s < seg; s++) B.quad(row[s][0], row[s][1], row[s + 1][1], row[s + 1][0]);
  }
  return B;
}
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const norm2 = (a) => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};

// Cylinder along X (odometer drum); u wraps around, v across.
export function drumGeo(radius, width, seg = 96) {
  const B = new Builder();
  const rows = [];
  for (let s = 0; s <= seg; s++) {
    const a = (s / seg) * Math.PI * 2;
    const y = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const n = [0, Math.cos(a), Math.sin(a)];
    rows.push([B.vert([-width / 2, y, z], n, [0, s / seg]), B.vert([width / 2, y, z], n, [1, s / seg])]);
  }
  for (let s = 0; s < seg; s++) B.quad(rows[s][0], rows[s + 1][0], rows[s + 1][1], rows[s][1]);
  for (const side of [-1, 1]) {
    const c = B.vert([(side * width) / 2, 0, 0], [side, 0, 0], [0.5, 0.5]);
    const ring = [];
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      ring.push(B.vert([(side * width) / 2, Math.cos(a) * radius, Math.sin(a) * radius], [side, 0, 0], [0.5, 0.5]));
    }
    for (let s = 0; s < seg; s++) side > 0 ? B.tri(c, ring[s + 1], ring[s]) : B.tri(c, ring[s], ring[s + 1]);
  }
  return B;
}

// The front arc of a cylinder along X (a0..a1 radians, π/2 faces +z). The drum
// itself never turns: v = (a − π/2)/2π, and the digits roll by scrolling v.
export function drumArcGeo(radius, width, a0, a1, seg = 48) {
  const B = new Builder();
  const rows = [];
  for (let s = 0; s <= seg; s++) {
    const a = a0 + (s / seg) * (a1 - a0);
    const y = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const n = [0, Math.cos(a), Math.sin(a)];
    const v = (a - Math.PI / 2) / (Math.PI * 2);
    rows.push([B.vert([-width / 2, y, z], n, [0, v]), B.vert([width / 2, y, z], n, [1, v])]);
  }
  for (let s = 0; s < seg; s++) B.quad(rows[s][0], rows[s + 1][0], rows[s + 1][1], rows[s][1]);
  return B;
}

// Extrude a 2D polygon (CCW, convex or star-shaped around its centroid) along Z.
export function prismGeo(poly, depth) {
  const B = new Builder();
  const n = poly.length;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of poly) {
    cx += x / n;
    cy += y / n;
  }
  for (const s of [1, -1]) {
    const c = B.vert([cx, cy, (s * depth) / 2], [0, 0, s], [0.5, 0.5]);
    const ids = poly.map(([x, y]) => B.vert([x, y, (s * depth) / 2], [0, 0, s], [0.5, 0.5]));
    for (let j = 0; j < n; j++) s > 0 ? B.tri(c, ids[j], ids[(j + 1) % n]) : B.tri(c, ids[(j + 1) % n], ids[j]);
  }
  for (let j = 0; j < n; j++) {
    const a = poly[j];
    const b = poly[(j + 1) % n];
    const nn = norm([b[1] - a[1], -(b[0] - a[0]), 0]);
    const ids = [
      B.vert([a[0], a[1], depth / 2], nn, [0, 0]),
      B.vert([b[0], b[1], depth / 2], nn, [1, 0]),
      B.vert([b[0], b[1], -depth / 2], nn, [1, 1]),
      B.vert([a[0], a[1], -depth / 2], nn, [0, 1]),
    ];
    B.quad(ids[3], ids[2], ids[1], ids[0]);
  }
  return B;
}

export function mergeGeo(...parts) {
  const B = new Builder();
  for (const [g, m] of parts) {
    const base = B.v.length / 8;
    const nm = m ? normalMatrix(m) : null;
    for (let k = 0; k < g.v.length; k += 8) {
      let p = [g.v[k], g.v[k + 1], g.v[k + 2]];
      let n = [g.v[k + 3], g.v[k + 4], g.v[k + 5]];
      if (m) {
        p = transformPoint(m, p);
        n = norm([nm[0] * n[0] + nm[3] * n[1] + nm[6] * n[2], nm[1] * n[0] + nm[4] * n[1] + nm[7] * n[2], nm[2] * n[0] + nm[5] * n[1] + nm[8] * n[2]]);
      }
      B.v.push(p[0], p[1], p[2], n[0], n[1], n[2], g.v[k + 6], g.v[k + 7]);
    }
    for (const i of g.i) B.i.push(base + i);
  }
  return B;
}

// ─── shaders ───────────────────────────────────────────────────────────────
const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DShadow;
`;

const MESH_VS = HEAD + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUv;
uniform mat4 uModel, uVP, uLightVP;
uniform mat3 uNM;
uniform float uMirror;
out vec3 vPos; out vec3 vNor; out vec3 vONor; out vec2 vUv; out vec4 vLight;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vPos = wp.xyz; vNor = uNM * aNor; vONor = aNor; vUv = aUv;
  vLight = uLightVP * wp;
  if (uMirror > 0.5) wp.y = -wp.y;
  gl_Position = uVP * wp;
}`;

const ENV = `
uniform float uEnvRot; uniform vec3 uEnvKey; uniform vec3 uEnvStrip; uniform vec3 uEnvKick; uniform float uEnvI;
const float PI = 3.14159265;
float soft(float x, float h, float w){ return 1.0 - smoothstep(h - w, h + w, abs(x)); }
// A vertical strip light at azimuth a (radians, 0 = +z), half-width hw, spanning y0±hh.
float strip(vec3 d, vec2 f, float hw, float y0, float hh, float w){
  float front = dot(d.xz, f);
  float side = dot(d.xz, vec2(f.y, -f.x));
  return soft(side, hw, w) * soft(d.y - y0, hh, w) * smoothstep(0.0, 0.2, front);
}
vec3 env(vec3 d, float r){
  float cs = cos(uEnvRot), sn = sin(uEnvRot);
  d.xz = mat2(cs, -sn, sn, cs) * d.xz;
  float w = 0.012 + r * 0.45;
  float spread = mix(1.0, 0.3, r);
  vec3 c = mix(vec3(0.003), vec3(0.016), smoothstep(-0.4, 0.9, d.y));
  c += uEnvKey * smoothstep(0.80 - w, 0.80 + w * 0.4 + 0.02, d.y) * spread;            // overhead softbox
  c += uEnvStrip * strip(d, vec2(0.8866, -0.4625), 0.07, 0.25, 0.55, w) * spread;                        // strip, back right
  c += uEnvStrip * 0.7 * strip(d, vec2(-0.8085, -0.5885), 0.055, 0.1, 0.5, w) * spread;                   // strip, back left
  c += uEnvStrip * 0.35 * strip(d, vec2(0.8134, 0.5817), 0.15, 0.35, 0.25, w) * spread;                 // card, front right
  c += uEnvKick * strip(d, vec2(0.0, -1.0), 0.5, 0.05, 0.4, w + 0.2) * spread;                       // red kicker from behind
  return c * uEnvI;
}
vec3 envFloor(vec3 d){
  vec3 c = mix(vec3(0.003), vec3(0.016), smoothstep(-0.4, 0.9, d.y));
  c += uEnvKey * smoothstep(0.66, 0.84, d.y) * 0.8;
  return c * uEnvI;
}
vec3 knee(vec3 c){ return mix(c, 0.82 + 0.18 * (1.0 - exp(-(c - 0.82) / 0.18)), step(0.82, c)); }
vec3 lin(vec3 c){ return c * c; }
float shadowPCF(highp sampler2DShadow sm, vec4 lp, vec2 texel, float bias, float spread){
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float z = p.z - bias;
  vec2 o = texel * spread;
  float s = texture(sm, vec3(p.xy, z));
  s += texture(sm, vec3(p.xy + vec2(-o.x, -o.y), z));
  s += texture(sm, vec3(p.xy + vec2( o.x, -o.y), z));
  s += texture(sm, vec3(p.xy + vec2(-o.x,  o.y), z));
  s += texture(sm, vec3(p.xy + vec2( o.x,  o.y), z));
  return s / 5.0;
}
`;

// One fragment shader per material mode (compiled separately: SwiftShader pays
// for every branch of an uber-shader). 0 lit · 1 screen · 2 two-sided tile ·
// 3 unlit · 4 lit with albedo texture. SHADOW 0/1 compiles the lookup in or out.
const meshFS = (mode, shadow) => HEAD + `#define MODE ${mode}
#define SHADOW ${shadow}
` + ENV + `
in vec3 vPos; in vec3 vNor; in vec3 vONor; in vec2 vUv; in vec4 vLight;
uniform vec3 uCam;
uniform vec3 uColor; uniform float uRough, uMetal, uCoat, uAlpha, uEmit;
uniform sampler2D uTexA; uniform sampler2D uTexB;
uniform vec4 uRectA; uniform vec4 uRectB;
uniform vec3 uSideCol;
uniform highp sampler2DShadow uShadow; uniform vec2 uShadowTexel;
uniform vec3 uKeyDir, uKeyCol, uRimDir, uRimCol, uAmb;
uniform float uMirror, uFloorFade, uFogD; uniform vec3 uFogCol;
uniform float uGlass; uniform vec3 uTint;
out vec4 o;
void main(){
  if (uMirror > 0.5 && vPos.y < -0.001) discard;
  vec3 col;
#if MODE == 3
  col = uColor * uEmit;
#else
  vec3 N = normalize(vNor);
  vec3 V = normalize(uCam - vPos);
  float NdV = max(dot(N, V), 0.0005);
  vec3 R = reflect(-V, N);
  vec3 L = normalize(uKeyDir);
  float NdL = max(dot(N, L), 0.0);
#if SHADOW == 1
  float sh = shadowPCF(uShadow, vLight, uShadowTexel, 0.0018, 1.3);
#else
  float sh = 1.0;
#endif
  float m1 = 1.0 - NdV; float m2 = m1 * m1; float Fg = 0.04 + 0.96 * m2 * m2 * m1;
#if MODE == 1 || MODE == 2
  vec3 tex;
  float lit = 1.0;
#if MODE == 1
  tex = lin(texture(uTexA, uRectA.xy + vUv * uRectA.zw).rgb);
#else
  if (vONor.z > 0.5) tex = lin(texture(uTexA, uRectA.xy + vUv * uRectA.zw).rgb);
  else if (vONor.z < -0.5) tex = lin(texture(uTexB, uRectB.xy + vUv * uRectB.zw).rgb);
  else tex = uSideCol;
  lit = 0.72 + 0.42 * NdL;
#endif
  col = tex * uEmit * lit * uTint * (1.0 - Fg * uGlass);
  col += uGlass * Fg * env(R, 0.02);
  vec3 H = normalize(L + V);
  col += uGlass * uKeyCol * pow(max(dot(N, H), 0.0), 900.0) * 1.4 * sh;
#else
  vec3 base = uColor;
#if MODE == 4
  base *= lin(texture(uTexA, uRectA.xy + vUv * uRectA.zw).rgb);
#endif
  vec3 F0 = mix(vec3(0.04), base, uMetal);
  vec3 F = F0 + (1.0 - F0) * (m2 * m2 * m1);
  vec3 H = normalize(L + V);
  float NdH = max(dot(N, H), 0.0);
  float a = max(uRough * uRough, 0.0025);
  float a2 = a * a;
  float dd = NdH * NdH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * dd * dd);
  float k = (uRough + 1.0) * (uRough + 1.0) / 8.0;
  float G = (NdL / (NdL * (1.0 - k) + k)) * (NdV / (NdV * (1.0 - k) + k));
  vec3 spec = D * G * F / max(4.0 * NdL * NdV, 0.0001);
  vec3 kd = (1.0 - F) * (1.0 - uMetal);
  col = kd * base * (uKeyCol * NdL * sh + uAmb + env(N, 1.0) * 0.6);
  col += spec * uKeyCol * NdL * sh;
  col += F * env(R, uRough) * mix(1.0, 0.55, uRough);
  col = col * (1.0 - Fg * uCoat) + uCoat * Fg * env(R, 0.03);
  col += uRimCol * pow(1.0 - NdV, 3.0) * max(dot(N, normalize(uRimDir)), 0.0);
  col += base * uEmit;
#endif
#endif
  if (uMirror > 0.5) col *= exp(-vPos.y * uFloorFade);
  if (uFogD > 0.0) col = mix(col, uFogCol, 1.0 - exp(-length(uCam - vPos) * uFogD));
  col = knee(max(col, 0.0));
  o = vec4(sqrt(col) * uAlpha, uAlpha);
}`;

const FLOOR_VS = HEAD + `
layout(location=0) in vec3 aPos;
uniform mat4 uVP, uLightVP; uniform float uY;
out vec3 vPos; out vec4 vLight;
void main(){ vec4 wp = vec4(aPos.x, uY, aPos.z, 1.0); vPos = wp.xyz; vLight = uLightVP * wp; gl_Position = uVP * wp; }`;

const floorFS = (mask) => HEAD + `#define MASK ${mask}
` + ENV + `
in vec3 vPos; in vec4 vLight;
uniform vec3 uCam; uniform float uSq; uniform vec2 uOff; uniform vec3 uColA, uColB; uniform float uReflA, uReflB;
uniform float uBoard; uniform float uRadius; uniform vec3 uRimC; uniform float uEdge;
uniform highp sampler2DShadow uShadow; uniform float uShadowOn; uniform vec2 uShadowTexel;
uniform vec3 uKeyDir, uKeyCol, uAmb; uniform float uFogD; uniform vec3 uFogCol; uniform float uAlpha;
uniform sampler2D uMask; uniform float uMaskOn; uniform vec4 uMaskRect; uniform float uFloorEnv;
out vec4 o;
float shadowAt(){ return uShadowOn < 0.5 ? 1.0 : shadowPCF(uShadow, vLight, uShadowTexel, 0.002, 1.6); }
float checker(vec2 p){
  vec2 w = fwidth(p) + 0.001;
  vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
  return 0.5 - 0.5 * i.x * i.y;
}
void main(){
  vec2 q = (vPos.xz - uOff) / uSq;
  float c = checker(q);
  // inside the board? (uBoard = half-size in squares; 0 = infinite)
  float inside = 1.0;
  if (uBoard > 0.0) {
    vec2 e = abs(q) - uBoard;
    float dOut = max(e.x, e.y);
    inside = 1.0 - smoothstep(-0.01, 0.01 + fwidth(dOut), dOut);
  }
  vec3 base = mix(uColB, uColA, c * inside);
  float refl = mix(uReflB, uReflA, c * inside);
#if MASK == 1
  {
    vec2 muv = (vPos.xz - uMaskRect.xy) / uMaskRect.zw;
    float m = (muv.x < 0.0 || muv.x > 1.0 || muv.y < 0.0 || muv.y > 1.0) ? 0.0 : texture(uMask, muv).r;
    base *= m; refl *= mix(0.6, 1.0, m);
  }
#endif
  vec3 N = vec3(0.0, 1.0, 0.0);
  vec3 V = normalize(uCam - vPos);
  float NdV = max(V.y, 0.001);
  float F = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
  vec3 L = normalize(uKeyDir);
  float sh = shadowAt();
  vec3 col = base * (uKeyCol * max(L.y, 0.0) * sh + uAmb);
  col += envFloor(reflect(-V, N)) * mix(0.15, 1.0, F) * refl * uFloorEnv;
  vec3 H = normalize(L + V);
  col += uKeyCol * pow(max(H.y, 0.0), 220.0) * 0.8 * sh * refl;
  float rr = length(vPos.xz - uOff);
  float fade = 1.0 - smoothstep(uRadius * 0.55, uRadius, rr);
  col *= fade;
  col += uRimC * uEdge * exp(-abs(max(abs(q.x), abs(q.y)) - uBoard) * 40.0) * step(0.0, uBoard) * fade;
  if (uFogD > 0.0) col = mix(col, uFogCol, 1.0 - exp(-length(uCam - vPos) * uFogD));
  float a = 1.0 - clamp(refl * mix(0.55, 1.0, F), 0.0, 0.95);
  a = mix(1.0, a, fade);
  col = knee(max(col, 0.0));
  o = vec4(sqrt(col) * a * uAlpha, a * uAlpha);
}`;

const DEPTH_VS = HEAD + `
layout(location=0) in vec3 aPos;
uniform mat4 uModel, uLightVP;
void main(){ gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;
const DEPTH_FS = HEAD + `out vec4 o; void main(){ o = vec4(1.0); }`;

// ─── renderer ──────────────────────────────────────────────────────────────
function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  const u = {};
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export const DEFAULT_MAT = {
  mode: 0,
  color: [0.5, 0.5, 0.5],
  rough: 0.4,
  metal: 0,
  coat: 0,
  emit: 0,
  alpha: 1,
  texA: null,
  texB: null,
  rectA: [0, 0, 1, 1],
  rectB: [0, 0, 1, 1],
  sideCol: [0.02, 0.02, 0.02],
  glass: 1,
  tint: [1, 1, 1],
  shadow: true, // casts a shadow
  cull: true,
};

export function createRenderer(canvas, { antialias = false } = {}) {
  const gl = canvas.getContext('webgl2', { antialias, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const progMesh = {};
  const meshProg = (mode, sh) => (progMesh[mode * 2 + sh] ??= compile(gl, MESH_VS, meshFS(mode, sh)));
  const progFloors = [compile(gl, FLOOR_VS, floorFS(0)), compile(gl, FLOOR_VS, floorFS(1))];
  const progDepth = compile(gl, DEPTH_VS, DEPTH_FS);

  // shadow map
  const SM = 1536;
  const shadowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SM, SM);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const shadowFB = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const noShadow = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, noShadow);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 1, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, noShadow, 0);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // 1×1 white fallback
  const white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

  // floor quad (big)
  const floorVao = gl.createVertexArray();
  gl.bindVertexArray(floorVao);
  const fb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fb);
  const E = 400;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-E, 0, -E, E, 0, -E, E, 0, E, -E, 0, -E, E, 0, E, -E, 0, E]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  function mesh(builder) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(builder.v), gl.STATIC_DRAW);
    for (const [loc, size, off] of [
      [0, 3, 0],
      [1, 3, 12],
      [2, 2, 24],
    ]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 32, off);
    }
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    const big = builder.v.length / 8 > 65535;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(builder.i) : new Uint16Array(builder.i), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: builder.i.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  }

  function texture(src, { mips = true, repeat = false, nearest = false } = {}) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    if (nearest) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      mips = false;
    } else if (mips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    t.mips = mips;
    t.nearest = nearest;
    t.w = src.width;
    t.h = src.height;
    return t;
  }
  function updateTexture(t, src) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (t.mips) gl.generateMipmap(gl.TEXTURE_2D);
  }

  const LIGHT_DEFAULT = {
    keyDir: [0.45, 0.85, 0.35],
    keyCol: [2.2, 2.15, 2.1],
    rimDir: [-0.6, 0.3, -0.7],
    rimCol: [0, 0, 0],
    amb: [0.02, 0.02, 0.022],
    envKey: [1.4, 1.4, 1.45],
    envStrip: [2.4, 2.4, 2.5],
    envKick: [0, 0, 0],
    envI: 1,
    envRot: 0,
    fogD: 0,
    fogCol: [0, 0, 0],
    shadow: true,
    shadowCenter: [0, 0, 0],
    shadowSize: 6,
  };

  // Render a list of { mesh, model, mat } with camera { eye, target, fov, up?, roll? }.
  // opts.floor: { y, sq, colA, colB, reflA, reflB, board, radius, rim, edge, off } or null.
  function render(items, cam, opts = {}) {
    const Lt = { ...LIGHT_DEFAULT, ...(opts.light || {}) };
    const W = canvas.width;
    const H = canvas.height;
    const aspect = W / H;
    const proj = perspective(cam.fov ?? 0.6, aspect, cam.near ?? 0.05, cam.far ?? 200);
    if (cam.jitter) {
      // sub-pixel offsets per motion-blur sample double as anti-aliasing
      proj[8] += (2 * cam.jitter[0]) / W;
      proj[9] += (2 * cam.jitter[1]) / H;
    }
    const view = lookAt(cam.eye, cam.target, cam.up ?? [0, 1, 0], cam.roll ?? 0);
    const vp = mul(proj, view);
    const kd = norm(Lt.keyDir);
    const sc = Lt.shadowCenter;
    const lpos = [sc[0] + kd[0] * 20, sc[1] + kd[1] * 20, sc[2] + kd[2] * 20];
    const lview = lookAt(lpos, sc, Math.abs(kd[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]);
    const ss = Lt.shadowSize;
    const lvp = mul(ortho(-ss, ss, -ss, ss, 1, 45), lview);

    // shadow pass
    const useShadow = Lt.shadow && items.some((it) => it.mat.shadow !== false);
    if (useShadow) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
      gl.viewport(0, 0, SM, SM);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.useProgram(progDepth.p);
      gl.uniformMatrix4fv(progDepth.u.uLightVP, false, lvp);
      for (const it of items) {
        if (it.mat.shadow === false || it.mat.alpha < 0.5) continue;
        gl.uniformMatrix4fv(progDepth.u.uModel, false, it.model);
        gl.bindVertexArray(it.mesh.vao);
        gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, W, H);
    const cc = opts.clear ?? [0, 0, 0, 0];
    gl.clearColor(cc[0], cc[1], cc[2], cc[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const setCommon = (P, camPos) => {
      const u = P.u;
      gl.uniform3fv(u.uCam, camPos);
      if (u.uKeyDir) gl.uniform3fv(u.uKeyDir, kd);
      if (u.uKeyCol) gl.uniform3fv(u.uKeyCol, Lt.keyCol);
      if (u.uRimDir) gl.uniform3fv(u.uRimDir, Lt.rimDir);
      if (u.uRimCol) gl.uniform3fv(u.uRimCol, Lt.rimCol);
      if (u.uAmb) gl.uniform3fv(u.uAmb, Lt.amb);
      gl.uniform3fv(u.uEnvKey, Lt.envKey);
      gl.uniform3fv(u.uEnvStrip, Lt.envStrip);
      gl.uniform3fv(u.uEnvKick, Lt.envKick);
      gl.uniform1f(u.uEnvI, Lt.envI);
      gl.uniform1f(u.uEnvRot, Lt.envRot);
      if (u.uFogD) gl.uniform1f(u.uFogD, Lt.fogD);
      if (u.uFogCol) gl.uniform3fv(u.uFogCol, Lt.fogCol);
      if (u.uLightVP) gl.uniformMatrix4fv(u.uLightVP, false, lvp);
      if (u.uShadowOn) gl.uniform1f(u.uShadowOn, useShadow ? 1 : 0);
      if (u.uShadowTexel) gl.uniform2f(u.uShadowTexel, 1 / SM, 1 / SM);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, useShadow ? shadowTex : noShadow);
      if (u.uShadow) gl.uniform1i(u.uShadow, 2);
    };

    const drawItems = (mirror, list) => {
      const camPos = mirror ? [cam.eye[0], -cam.eye[1], cam.eye[2]] : cam.eye;
      gl.frontFace(mirror ? gl.CW : gl.CCW);
      let P = null;
      let u = null;
      for (const it of list) {
        const m = { ...DEFAULT_MAT, ...it.mat };
        if (m.alpha <= 0.001) continue;
        const next = meshProg(m.mode, useShadow && m.mode !== 3 && m.receive !== false ? 1 : 0);
        if (next !== P) {
          P = next;
          u = P.u;
          gl.useProgram(P.p);
          setCommon(P, camPos);
          gl.uniformMatrix4fv(u.uVP, false, vp);
          gl.uniform1f(u.uMirror, mirror ? 1 : 0);
          gl.uniform1f(u.uFloorFade, opts.floor?.fade ?? 1.2);
        }
        if (m.cull) {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.BACK);
        } else gl.disable(gl.CULL_FACE);
        gl.uniformMatrix4fv(u.uModel, false, it.model);
        gl.uniformMatrix3fv(u.uNM, false, normalMatrix(it.model));
        gl.uniform3fv(u.uColor, m.color);
        gl.uniform1f(u.uRough, m.rough);
        gl.uniform1f(u.uMetal, m.metal);
        gl.uniform1f(u.uCoat, m.coat);
        gl.uniform1f(u.uEmit, m.emit);
        gl.uniform1f(u.uAlpha, m.alpha);
        gl.uniform1f(u.uGlass, m.glass);
        gl.uniform3fv(u.uTint, m.tint);
        gl.uniform3fv(u.uSideCol, m.sideCol);
        gl.uniform4fv(u.uRectA, m.rectA);
        gl.uniform4fv(u.uRectB, m.rectB);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, m.texA || white);
        gl.uniform1i(u.uTexA, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, m.texB || white);
        gl.uniform1i(u.uTexB, 1);
        gl.bindVertexArray(it.mesh.vao);
        gl.drawElements(gl.TRIANGLES, it.mesh.count, it.mesh.type, 0);
      }
      gl.frontFace(gl.CCW);
    };

    const fl = opts.floor;
    if (fl) {
      // reflections first, then the floor blends over them
      if (fl.reflA > 0 || fl.reflB > 0) drawItems(true, items.filter((it) => it.mat.reflect !== false));
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const P = progFloors[fl.mask ? 1 : 0];
      gl.useProgram(P.p);
      setCommon(P, cam.eye);
      const u = P.u;
      gl.uniformMatrix4fv(u.uVP, false, vp);
      gl.uniform1f(u.uY, fl.y ?? 0);
      gl.uniform1f(u.uSq, fl.sq ?? 1);
      gl.uniform2fv(u.uOff, fl.off ?? [0, 0]);
      gl.uniform3fv(u.uColA, fl.colA ?? [0.8, 0.8, 0.8]);
      gl.uniform3fv(u.uColB, fl.colB ?? [0.01, 0.01, 0.01]);
      gl.uniform1f(u.uReflA, fl.reflA ?? 0.2);
      gl.uniform1f(u.uReflB, fl.reflB ?? 0.5);
      gl.uniform1f(u.uBoard, fl.board ?? 0);
      gl.uniform1f(u.uRadius, fl.radius ?? 30);
      gl.uniform3fv(u.uRimC, fl.rim ?? [1, 0.1, 0.2]);
      gl.uniform1f(u.uEdge, fl.edge ?? 0);
      gl.uniform1f(u.uAlpha, fl.alpha ?? 1);
      gl.uniform1f(u.uFloorEnv, fl.envI ?? 1);
      gl.uniform1f(u.uMaskOn, fl.mask ? 1 : 0);
      gl.uniform4fv(u.uMaskRect, fl.maskRect ?? [0, 0, 1, 1]);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, fl.mask || white);
      gl.uniform1i(u.uMask, 3);
      gl.disable(gl.CULL_FACE);
      // reflections sit below the plane, so the floor can write depth and still blend over them
      gl.bindVertexArray(floorVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    // opaque, then translucent (back to front by the caller's order)
    drawItems(false, items.filter((it) => (it.mat.alpha ?? 1) >= 0.999));
    gl.depthMask(false);
    drawItems(false, items.filter((it) => (it.mat.alpha ?? 1) < 0.999));
    gl.depthMask(true);
    gl.bindVertexArray(null);
    return { vp, view, proj };
  }

  return { gl, canvas, mesh, texture, updateTexture, render };
}

// ─── post chain ────────────────────────────────────────────────────────────
const QUAD_VS = HEAD + `
layout(location=0) in vec2 aP; out vec2 vUv;
void main(){ vUv = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;

const BRIGHT_FS = HEAD + `
in vec2 vUv; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh; out vec4 o;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec3 c = vec3(0.0);
  c += lin(texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  c += lin(texture(uSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb);
  c += lin(texture(uSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb);
  c += lin(texture(uSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb);
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThresh, uThresh + 0.35, l);
  // saturated reds bloom a little more (the brand's accent glows)
  float red = smoothstep(0.25, 0.8, c.r - max(c.g, c.b));
  o = vec4(c * max(k, red * 0.6), 1.0);
}`;

const DOWN_FS = HEAD + `
in vec2 vUv; uniform sampler2D uSrc; uniform vec2 uTexel; out vec4 o;
void main(){
  vec3 c = texture(uSrc, vUv).rgb * 0.25;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 0.1875;
  c += texture(uSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb * 0.1875;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb * 0.1875;
  c += texture(uSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb * 0.1875;
  o = vec4(c, 1.0);
}`;

const UP_FS = HEAD + `
in vec2 vUv; uniform sampler2D uSrc; uniform sampler2D uAdd; uniform vec2 uTexel; uniform float uW; out vec4 o;
void main(){
  vec3 c = vec3(0.0);
  c += texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2( 0.0, -1.0)).rgb * 2.0;
  c += texture(uSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0,  0.0)).rgb * 2.0;
  c += texture(uSrc, vUv).rgb * 4.0;
  c += texture(uSrc, vUv + uTexel * vec2( 1.0,  0.0)).rgb * 2.0;
  c += texture(uSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2( 0.0,  1.0)).rgb * 2.0;
  c += texture(uSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  o = vec4(c / 16.0 * uW + texture(uAdd, vUv).rgb, 1.0);
}`;

const FINAL_FS = HEAD + `
in vec2 vUv; uniform sampler2D uSrc; uniform sampler2D uBloom;
uniform float uBloomI, uCA, uGrain, uVig, uSeed, uLens, uFlash; uniform vec2 uRes; uniform vec3 uFlashCol; out vec4 o;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  d.x *= uRes.x / uRes.y;
  float r2 = dot(d, d);
  uv = 0.5 + (uv - 0.5) * (1.0 - uLens * r2);
  vec2 dir = (uv - 0.5);
  vec3 c;
  if (uCA > 0.0001) {
    c.r = lin(texture(uSrc, 0.5 + dir * (1.0 + uCA)).rgb).r;
    c.g = lin(texture(uSrc, 0.5 + dir * (1.0 + uCA * 0.5)).rgb).g;
    c.b = lin(texture(uSrc, uv).rgb).b;
  } else c = lin(texture(uSrc, uv).rgb);
  c += texture(uBloom, uv).rgb * uBloomI;
  float v = 1.0 - uVig * smoothstep(0.15, 0.95, r2 * 1.6);
  c *= v;
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c = mix(c, pow(uFlashCol, vec3(1.0 / 2.2)), uFlash);
  c += (h(gl_FragCoord.xy) - 0.5) * uGrain;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export function createPost(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  const W = canvas.width;
  const H = canvas.height;
  const half = !!gl.getExtension('EXT_color_buffer_float');
  const P = {
    bright: compile(gl, QUAD_VS, BRIGHT_FS),
    down: compile(gl, QUAD_VS, DOWN_FS),
    up: compile(gl, QUAD_VS, UP_FS),
    final: compile(gl, QUAD_VS, FINAL_FS),
  };
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const target = (w, h) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, half ? gl.RGBA16F : gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb, w, h };
  };
  const levels = [];
  let w = W >> 1;
  let h = H >> 1;
  for (let i = 0; i < 6; i++) {
    levels.push({ down: target(w, h), up: target(w, h) });
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  const black = target(1, 1);
  gl.bindFramebuffer(gl.FRAMEBUFFER, black.fb);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const src = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const pass = (prog, fbo, w, h, setup) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const bind = (unit, tex, loc) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  };

  // frame: a canvas; fx: { bloom, thresh, ca, grain, vignette, seed, lens, flash, flashCol }
  function run(frame, fx) {
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    // bright pass → level 0, then downsample chain
    pass(P.bright, levels[0].down.fb, levels[0].down.w, levels[0].down.h, (u) => {
      bind(0, src, u.uSrc);
      gl.uniform2f(u.uTexel, 1 / W, 1 / H);
      gl.uniform1f(u.uThresh, fx.thresh ?? 0.7);
    });
    for (let i = 1; i < levels.length; i++) {
      const s = levels[i - 1].down;
      pass(P.down, levels[i].down.fb, levels[i].down.w, levels[i].down.h, (u) => {
        bind(0, s.t, u.uSrc);
        gl.uniform2f(u.uTexel, 1 / s.w, 1 / s.h);
      });
    }
    // upsample: up[i] = blur(up[i+1]) + down[i]
    for (let i = levels.length - 1; i >= 0; i--) {
      const s = i === levels.length - 1 ? levels[i].down : levels[i + 1].up;
      const add = i === levels.length - 1 ? black : levels[i].down;
      pass(P.up, levels[i].up.fb, levels[i].up.w, levels[i].up.h, (u) => {
        bind(0, s.t, u.uSrc);
        bind(1, add.t, u.uAdd);
        gl.uniform2f(u.uTexel, 1 / s.w, 1 / s.h);
        gl.uniform1f(u.uW, i === levels.length - 1 ? 0 : 1);
      });
    }
    pass(P.final, null, W, H, (u) => {
      bind(0, src, u.uSrc);
      bind(1, levels[0].up.t, u.uBloom);
      gl.uniform1f(u.uBloomI, fx.bloom ?? 0.25);
      gl.uniform1f(u.uCA, fx.ca ?? 0);
      gl.uniform1f(u.uGrain, fx.grain ?? 0.03);
      gl.uniform1f(u.uVig, fx.vignette ?? 0.25);
      gl.uniform1f(u.uSeed, fx.seed ?? 0);
      gl.uniform1f(u.uLens, fx.lens ?? 0);
      gl.uniform1f(u.uFlash, fx.flash ?? 0);
      gl.uniform3fv(u.uFlashCol, fx.flashCol ?? [1, 1, 1]);
      gl.uniform2f(u.uRes, W, H);
    });
  }
  return { gl, run };
}
