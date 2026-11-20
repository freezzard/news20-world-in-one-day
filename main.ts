// news-image-20261120: one image summing up Friday 20 November 2026.
// Pure Node 22 standard library: a tiny rasterizer draws the digest, then a
// hand-rolled PNG encoder writes /output/entry.png. Fully deterministic:
// no clock, no network, no randomness outside a fixed-seed generator, so two
// runs produce byte-identical output.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

type Rgb = [number, number, number];
const PAPER: Rgb = [246, 241, 229];
const INK: Rgb = [28, 39, 51];
const NAVY: Rgb = [22, 40, 63];
const GOLD: Rgb = [201, 162, 39];
const RED: Rgb = [179, 39, 30];
const TEAL: Rgb = [15, 118, 110];
const CARD: Rgb = [255, 253, 247];
const LINE: Rgb = [216, 207, 184];
const WHITE: Rgb = [255, 255, 255];
const SOFT: Rgb = [90, 100, 112];

function setPx(x: number, y: number, c: Rgb): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: Rgb): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
  }
}

function hline(x: number, y: number, w: number, c: Rgb): void {
  rect(x, y, w, 1, c);
}

function vline(x: number, y: number, h: number, c: Rgb): void {
  rect(x, y, 1, h, c);
}

function disc(cx: number, cy: number, r: number, c: Rgb): void {
  for (let yy = cy - r; yy <= cy + r; yy++) {
    for (let xx = cx - r; xx <= cx + r; xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) setPx(xx, yy, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, c: Rgb): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPx(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

function seg(x0: number, y0: number, x1: number, y1: number, c: Rgb): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (let guard = 0; guard < 4000; guard++) {
    setPx(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: Rgb): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const a = ((x1 - xx) * (y2 - yy) - (y1 - yy) * (x2 - xx)) / d;
      const b = ((x2 - xx) * (y0 - yy) - (y2 - yy) * (x0 - xx)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) setPx(xx, yy, c);
    }
  }
}

// Classic 5x7 bitmap font, column-major: each glyph is 5 bytes, bit 0 is the
// top row. Covers printable ASCII 32..126; unknown codes render blank.
const FONT: Record<number, number[]> = {
  32: [0x00, 0x00, 0x00, 0x00, 0x00], 33: [0x00, 0x00, 0x5f, 0x00, 0x00],
  34: [0x00, 0x07, 0x00, 0x07, 0x00], 35: [0x14, 0x7f, 0x14, 0x7f, 0x14],
  36: [0x24, 0x2a, 0x7f, 0x2a, 0x12], 37: [0x23, 0x13, 0x08, 0x64, 0x62],
  38: [0x36, 0x49, 0x55, 0x22, 0x50], 39: [0x00, 0x05, 0x03, 0x00, 0x00],
  40: [0x00, 0x1c, 0x22, 0x41, 0x00], 41: [0x00, 0x41, 0x22, 0x1c, 0x00],
  42: [0x14, 0x08, 0x3e, 0x08, 0x14], 43: [0x08, 0x08, 0x3e, 0x08, 0x08],
  44: [0x00, 0x50, 0x30, 0x00, 0x00], 45: [0x08, 0x08, 0x08, 0x08, 0x08],
  46: [0x00, 0x60, 0x60, 0x00, 0x00], 47: [0x20, 0x10, 0x08, 0x04, 0x02],
  48: [0x3e, 0x51, 0x49, 0x45, 0x3e], 49: [0x00, 0x42, 0x7f, 0x40, 0x00],
  50: [0x42, 0x61, 0x51, 0x49, 0x46], 51: [0x21, 0x41, 0x45, 0x4b, 0x31],
  52: [0x18, 0x14, 0x12, 0x7f, 0x10], 53: [0x27, 0x45, 0x45, 0x45, 0x39],
  54: [0x3c, 0x4a, 0x49, 0x49, 0x30], 55: [0x01, 0x71, 0x09, 0x05, 0x03],
  56: [0x36, 0x49, 0x49, 0x49, 0x36], 57: [0x06, 0x49, 0x49, 0x29, 0x1e],
  58: [0x00, 0x36, 0x36, 0x00, 0x00], 59: [0x00, 0x56, 0x36, 0x00, 0x00],
  60: [0x08, 0x14, 0x22, 0x41, 0x00], 61: [0x14, 0x14, 0x14, 0x14, 0x14],
  62: [0x00, 0x41, 0x22, 0x14, 0x08], 63: [0x02, 0x01, 0x51, 0x09, 0x06],
  64: [0x32, 0x49, 0x79, 0x41, 0x3e], 65: [0x7e, 0x11, 0x11, 0x11, 0x7e],
  66: [0x7f, 0x49, 0x49, 0x49, 0x36], 67: [0x3e, 0x41, 0x41, 0x41, 0x22],
  68: [0x7f, 0x41, 0x41, 0x22, 0x1c], 69: [0x7f, 0x49, 0x49, 0x49, 0x41],
  70: [0x7f, 0x09, 0x09, 0x09, 0x01], 71: [0x3e, 0x41, 0x49, 0x49, 0x7a],
  72: [0x7f, 0x08, 0x08, 0x08, 0x7f], 73: [0x00, 0x41, 0x7f, 0x41, 0x00],
  74: [0x20, 0x40, 0x41, 0x3f, 0x01], 75: [0x7f, 0x08, 0x14, 0x22, 0x41],
  76: [0x7f, 0x40, 0x40, 0x40, 0x40], 77: [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  78: [0x7f, 0x04, 0x08, 0x10, 0x7f], 79: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  80: [0x7f, 0x09, 0x09, 0x09, 0x06], 81: [0x3e, 0x41, 0x51, 0x21, 0x5e],
  82: [0x7f, 0x09, 0x19, 0x29, 0x46], 83: [0x46, 0x49, 0x49, 0x49, 0x31],
  84: [0x01, 0x01, 0x7f, 0x01, 0x01], 85: [0x3f, 0x40, 0x40, 0x40, 0x3f],
  86: [0x1f, 0x20, 0x40, 0x20, 0x1f], 87: [0x3f, 0x40, 0x38, 0x40, 0x3f],
  88: [0x63, 0x14, 0x08, 0x14, 0x63], 89: [0x07, 0x08, 0x70, 0x08, 0x07],
  90: [0x61, 0x51, 0x49, 0x45, 0x43], 91: [0x00, 0x7f, 0x41, 0x41, 0x00],
  92: [0x02, 0x04, 0x08, 0x10, 0x20], 93: [0x00, 0x41, 0x41, 0x7f, 0x00],
  94: [0x04, 0x02, 0x01, 0x02, 0x04], 95: [0x40, 0x40, 0x40, 0x40, 0x40],
  96: [0x00, 0x01, 0x02, 0x04, 0x00], 97: [0x20, 0x54, 0x54, 0x54, 0x78],
  98: [0x7f, 0x48, 0x44, 0x44, 0x38], 99: [0x38, 0x44, 0x44, 0x44, 0x20],
  100: [0x38, 0x44, 0x44, 0x48, 0x7f], 101: [0x38, 0x54, 0x54, 0x54, 0x18],
  102: [0x08, 0x7e, 0x09, 0x01, 0x02], 103: [0x0c, 0x52, 0x52, 0x52, 0x3e],
  104: [0x7f, 0x08, 0x04, 0x04, 0x78], 105: [0x00, 0x44, 0x7d, 0x40, 0x00],
  106: [0x20, 0x40, 0x44, 0x3d, 0x00], 107: [0x7f, 0x10, 0x28, 0x44, 0x00],
  108: [0x00, 0x41, 0x7f, 0x40, 0x00], 109: [0x7c, 0x04, 0x18, 0x04, 0x78],
  110: [0x7c, 0x08, 0x04, 0x04, 0x78], 111: [0x38, 0x44, 0x44, 0x44, 0x38],
  112: [0x7c, 0x14, 0x14, 0x14, 0x08], 113: [0x08, 0x14, 0x14, 0x18, 0x7c],
  114: [0x7c, 0x08, 0x04, 0x04, 0x08], 115: [0x48, 0x54, 0x54, 0x54, 0x20],
  116: [0x04, 0x3f, 0x44, 0x40, 0x20], 117: [0x3c, 0x40, 0x40, 0x20, 0x7c],
  118: [0x1c, 0x20, 0x40, 0x20, 0x1c], 119: [0x3c, 0x40, 0x30, 0x40, 0x3c],
  120: [0x44, 0x28, 0x10, 0x28, 0x44], 121: [0x0c, 0x50, 0x50, 0x50, 0x3c],
  122: [0x44, 0x64, 0x54, 0x4c, 0x44], 123: [0x00, 0x08, 0x36, 0x41, 0x00],
  124: [0x00, 0x00, 0x7f, 0x00, 0x00], 125: [0x00, 0x41, 0x36, 0x08, 0x00],
  126: [0x08, 0x04, 0x08, 0x10, 0x08],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(x: number, y: number, s: string, scale: number, c: Rgb): void {
  for (let i = 0; i < s.length; i++) {
    const glyph = FONT[s.charCodeAt(i)] ?? FONT[32];
    const gx = x + i * 6 * scale;
    for (let col = 0; col < 5; col++) {
      const bits = glyph[col];
      for (let row = 0; row < 7; row++) {
        if ((bits >> row) & 1) rect(gx + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawTextCenter(x: number, y: number, w: number, s: string, scale: number, c: Rgb): void {
  drawText(x + Math.floor((w - textWidth(s, scale)) / 2), y, s, scale, c);
}

function wrapText(s: string, maxChars: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const cand = cur === '' ? word : cur + ' ' + word;
    if (cand.length <= maxChars) {
      cur = cand;
    } else {
      if (cur !== '') lines.push(cur);
      cur = word;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// Fixed-seed generator for the starfield and texture dots.
let starSeed = 20261120;
function starNext(): number {
  starSeed = (starSeed * 1103515245 + 12345) & 0x7fffffff;
  return starSeed / 0x7fffffff;
}

// ---- PNG encoder (filter 0 scanlines, zlib level 9) ----
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(out.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc32(crcData));
  return out;
}
function encodePng(): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0))];
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ---- The day's stories: 1 lead + 12 cards + 22 briefs = 35 ----
interface StoryCard { tag: string; head: string; sub: string; art: number; region: string; field: string; }
const LEAD_HEAD = 'TRUMP PUSHES IRAN WAR DECISION TO 2027';
const LEAD_SUB1 = "HE WILL 'SEE WHAT HAPPENS' AFTER JAN 1";
const LEAD_SUB2 = 'SENATE REPUBLICANS REJECT CURB ON WAR POWERS';
const CARDS: StoryCard[] = [
  { tag: 'CHINA', head: 'TRUMP, XI, PUTIN MEET IN SHENZHEN', sub: 'FIRST THREE-WAY SUMMIT AT APEC', art: 0, region: 'ASIA', field: 'POLITICS' },
  { tag: 'THE HAGUE', head: 'COURT: MYANMAR COMMITTED GENOCIDE', sub: 'ICJ RULES FOR THE ROHINGYA', art: 1, region: 'EUROPE', field: 'JUSTICE' },
  { tag: 'INDIA', head: 'CYCLONE AKVAN NEARS ODISHA', sub: '300,000 EVACUATED, 423 TEAMS OUT', art: 2, region: 'ASIA', field: 'CLIMATE' },
  { tag: 'SPACE', head: 'VOYAGER 1 ONE LIGHT-DAY AWAY', sub: 'NASA CONFIRMS HISTORIC MILESTONE', art: 3, region: 'SPACE', field: 'SPACE' },
  { tag: 'JAPAN', head: 'HAYABUSA2 DROPS ASTEROID LANDING', sub: 'ENGINE TROUBLE FORCES NEW PLAN', art: 4, region: 'ASIA', field: 'SPACE' },
  { tag: 'SAUDI', head: 'HOUTHIS HIT RIYADH TOWER', sub: 'SAUDI WEALTH FUND HQ DAMAGED', art: 5, region: 'MIDDLE EAST', field: 'CONFLICT' },
  { tag: 'EUROPE', head: 'EUROPE READY FOR RUSSIA TALKS', sub: 'LEADERS EYE END TO UKRAINE WAR', art: 6, region: 'EUROPE', field: 'POLITICS' },
  { tag: 'CULTURE', head: 'GTA 6 PASSES $1.8BN ODYSSEY RUN', sub: "GAME OUTSELLS FILM'S GLOBAL TAKE", art: 7, region: 'GLOBAL', field: 'CULTURE' },
  { tag: 'MARKETS', head: 'ANTHROPIC DEBUTS AT $1.5TN', sub: "AI GIANT AMONG WORLD'S TOP FIRMS", art: 8, region: 'N AMERICA', field: 'MARKETS' },
  { tag: 'SPORT', head: 'PHILLIPS 118, NICHOLLS 146*', sub: 'NEW ZEALAND 317-6 VS INDIA', art: 9, region: 'OCEANIA', field: 'SPORT' },
  { tag: 'BRITAIN', head: 'ROYALS MEET MODI IN DELHI', sub: 'WILLIAM AND KATE ON INDIA VISIT', art: 10, region: 'ASIA', field: 'POLITICS' },
  { tag: 'BANGLADESH', head: 'FIRE AT YUNUS FAMILY HOME', sub: 'POLICE SUSPECT ARSON ATTACK', art: 11, region: 'ASIA', field: 'POLITICS' },
];
const BRIEFS: [string, string, string][] = [
  ['SENATE REJECTS IRAN WAR POWERS CURB', 'N AMERICA', 'POLITICS'],
  ['ADNOC SHIP HIT IN HORMUZ, 1 MISSING', 'MIDDLE EAST', 'CONFLICT'],
  ['COP31 AI PLEDGE SHUNNED BY US TECH', 'EUROPE', 'CLIMATE'],
  ['CALIFORNIA PROBES NVIDIA CHINA CHIPS', 'N AMERICA', 'TECH'],
  ["MUSK: 'NOT MAGA', REGRETS $500M SPEND", 'N AMERICA', 'TECH'],
  ['PEW: ISLAM SET TO PASS CHRISTIANITY', 'GLOBAL', 'SOCIETY'],
  ['TRUMP PARDONS BASEBALL GREAT PETE ROSE', 'N AMERICA', 'CULTURE'],
  ['FIONA THE HIPPO DIES AFTER EATING A HAT', 'N AMERICA', 'CULTURE'],
  ['SENSEX JUMPS 1.2% IN STRONG THURSDAY', 'ASIA', 'MARKETS'],
  ['INDIA INKS ISRAEL MISSILE DEAL', 'ASIA', 'CONFLICT'],
  ['MODI OPENS FICCI CENTENARY MEET', 'ASIA', 'POLITICS'],
  ['NEW FLYING FROG FOUND IN INDONESIA', 'ASIA', 'SCIENCE'],
  ['STAR SEEN SWALLOWING ITS COMPANION', 'SPACE', 'SCIENCE'],
  ['GRINDR LAUNCHES $120-A-MONTH AI PLAN', 'N AMERICA', 'TECH'],
  ['MAN CHARGED OVER $60M JET AXE ATTACK', 'EUROPE', 'JUSTICE'],
  ['ROME REBUKES KYIV OVER MP BLACKLIST', 'EUROPE', 'POLITICS'],
  ['VOICES FROM BESIEGED TAIZ, YEMEN', 'MIDDLE EAST', 'CONFLICT'],
  ['CANADA WOOS AI DATA CENTRES', 'N AMERICA', 'TECH'],
  ['MEASLES SURGES AS VACCINE FEARS SPREAD', 'N AMERICA', 'SOCIETY'],
  ['SOUTH AFRICA TOP WORLD TEST TABLE', 'AFRICA', 'SPORT'],
  ['ENGLAND BEAT AUSTRALIA IN 3RD ODI', 'EUROPE', 'SPORT'],
  ["ECONOMIST UNVEILS 'WORLD AHEAD 2027'", 'GLOBAL', 'CULTURE'],
];
const NUMBERS: [string, string][] = [
  ['300,000', 'EVACUATED'], ['423', 'RESCUE TEAMS'], ['1', 'LIGHT-DAY'],
  ['$1.8BN', 'GTA 6'], ['$1.5TN', 'ANTHROPIC'], ['146*', 'NICHOLLS'],
];
const PINS: [number, number][] = [
  [-77, 39], [114, 22], [4, 52], [47, 25], [85, 20], [175, -41], [140, 36], [77, 29],
];
// Stylised dot-matrix world map, 60 columns x 20 rows, '#' is land.
const MAP_ROWS: string[] = [
  '                                                            ',
  '    #############    ####             ##################### ',
  '  ################## ###      ##############################',
  '  ###################       ############################### ',
  '   #################         ###############################',
  '     ##############           ######  ###################   ',
  '       ##########            ######### ################    ',
  '         ######             ########### #############       ',
  '            ###    #####     ##########   #########         ',
  '                  #######    #########                      ',
  '                  #######     ########                      ',
  '                   ######      ######                       ',
  '                   #####        #####                       ',
  '                    ####         ###              ######    ',
  '                    ###                          ########   ',
  '                     ##                           #####   # ',
  '                     #                                    # ',
  '                                                            ',
  '                                                            ',
  '                                                            ',
];

const ART_BG: Rgb[] = [
  [38, 64, 110], [232, 222, 196], [24, 68, 92], [8, 12, 28], [52, 52, 60],
  [40, 32, 48], [30, 58, 138], [58, 32, 86], [16, 92, 66], [26, 92, 44],
  [122, 24, 28], [32, 28, 24],
];

function drawArt(kind: number, x: number, y: number, w: number, h: number): void {
  const bg = ART_BG[kind];
  rect(x, y, w, h, bg);
  if (kind === 0) {
    const fw = Math.floor(w / 3);
    for (let i = 0; i < 7; i++) rect(x, y + i * 8, fw - 4, 4, i % 2 ? WHITE : RED);
    rect(x, y, 26, 22, NAVY);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) disc(x + 5 + i * 8, y + 5 + j * 8, 1, WHITE);
    rect(x + fw, y, fw - 4, h, RED);
    disc(x + fw + 22, y + 16, 4, GOLD); disc(x + fw + 34, y + 12, 2, GOLD); disc(x + fw + 34, y + 34, 2, GOLD);
    rect(x + 2 * fw, y, fw - 4, 18, WHITE); rect(x + 2 * fw, y + 18, fw - 4, 18, [30, 90, 180]); rect(x + 2 * fw, y + 36, fw - 4, 18, RED);
  } else if (kind === 1) {
    tri(x + 20, y + 4, x + w - 20, y + 4, x + Math.floor(w / 2), y + 20, [120, 96, 60]);
    for (let i = 0; i < 4; i++) rect(x + 28 + i * 48, y + 22, 12, 24, [240, 234, 214]);
    rect(x + 12, y + 46, w - 24, 5, [120, 96, 60]);
  } else if (kind === 2) {
    ring(x + 90, y + 27, 20, WHITE); ring(x + 90, y + 27, 14, [170, 210, 230]); ring(x + 90, y + 27, 8, WHITE);
    disc(x + 90, y + 27, 4, GOLD);
    for (let i = 0; i < 8; i++) seg(x + 150 + i * 9, y + 6, x + 146 + i * 9, y + 20, [150, 190, 220]);
    for (let i = 0; i < 6; i++) seg(x + 8 + i * 10, y + 40, x + 4 + i * 10, y + 52, [150, 190, 220]);
  } else if (kind === 3) {
    for (let i = 0; i < 40; i++) {
      const sx = x + Math.floor(starNext() * w);
      const sy = y + Math.floor(starNext() * h);
      setPx(sx, sy, WHITE);
    }
    rect(x + 150, y + 20, 26, 10, [212, 175, 55]);
    tri(x + 176, y + 18, x + 176, y + 32, x + 192, y + 25, [212, 175, 55]);
    seg(x + 60, y + 44, x + 146, y + 26, GOLD);
    disc(x + 52, y + 46, 7, [120, 170, 220]);
  } else if (kind === 4) {
    disc(x + 60, y + 28, 18, [140, 140, 150]); disc(x + 74, y + 20, 10, [160, 160, 170]); disc(x + 48, y + 36, 8, [120, 120, 130]);
    rect(x + 170, y + 18, 22, 12, [220, 220, 230]);
    seg(x + 170, y + 24, x + 150, y + 24, WHITE);
    seg(x + 100, y + 12, x + 118, y + 30, RED); seg(x + 118, y + 12, x + 100, y + 30, RED);
  } else if (kind === 5) {
    rect(x + 96, y + 8, 26, 40, [90, 90, 110]);
    tri(x + 96, y + 8, x + 122, y + 8, x + 109, y - 4, [110, 110, 130]);
    for (let i = 0; i < 5; i++) rect(x + 100, y + 12 + i * 7, 18, 3, [250, 220, 120]);
    disc(x + 190, y + 14, 4, [255, 170, 40]); disc(x + 190, y + 14, 9, [255, 120, 30]);
    seg(x + 176, y + 4, x + 204, y + 24, [255, 170, 40]); seg(x + 204, y + 4, x + 176, y + 24, [255, 170, 40]);
  } else if (kind === 6) {
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 * Math.PI) / 180;
      disc(x + 70 + Math.round(22 * Math.cos(a)), y + 27 + Math.round(20 * Math.sin(a)), 2, GOLD);
    }
    disc(x + 70, y + 27, 5, GOLD);
    rect(x + 150, y + 14, 70, 12, WHITE); rect(x + 158, y + 30, 54, 12, [220, 200, 120]);
  } else if (kind === 7) {
    for (let i = 0; i < 6; i++) {
      const bw = 26 + (i % 3) * 8;
      const bh = 18 + ((i * 7) % 20);
      rect(x + 8 + i * 38, y + h - bh, bw, bh, [30, 20, 52]);
      for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 2; wx++) setPx(x + 14 + i * 38 + wx * 10, y + h - bh + 5 + wy * 6, [250, 220, 120]);
    }
    drawText(x + 158, y + 8, '$1.8BN', 2, GOLD);
  } else if (kind === 8) {
    seg(x + 10, y + 44, x + 70, y + 30, [120, 220, 170]); seg(x + 70, y + 30, x + 130, y + 18, [120, 220, 170]); seg(x + 130, y + 18, x + 200, y + 6, [120, 220, 170]);
    tri(x + 200, y + 6, x + 188, y + 4, x + 198, y + 16, [120, 220, 170]);
  } else if (kind === 9) {
    rect(x, y + 34, w, 20, [26, 92, 44]);
    rect(x, y, w, 34, [120, 190, 130]);
    for (let i = 0; i < 3; i++) rect(x + 30 + i * 8, y + 12, 4, 26, [250, 220, 120]);
    seg(x + 180, y + 8, x + 205, y + 40, [150, 100, 50]); seg(x + 183, y + 8, x + 208, y + 40, [150, 100, 50]);
    rect(x + 176, y + 4, 12, 8, [150, 100, 50]);
    disc(x + 220, y + 44, 6, RED);
  } else if (kind === 10) {
    for (let i = 0; i < 5; i++) {
      const cx = x + 40 + i * 16;
      tri(cx, y + 8, cx + 8, y + 22, cx + 16, y + 8, GOLD);
      rect(cx + 2, y + 22, 12, 4, GOLD);
    }
    rect(x + 160, y + 16, 60, 26, [240, 230, 200]);
    tri(x + 160, y + 16, x + 220, y + 16, x + 190, y + 2, [240, 230, 200]);
    rect(x + 182, y + 26, 16, 16, NAVY);
  } else if (kind === 11) {
    rect(x + 60, y + 22, 70, 26, [170, 130, 95]);
    tri(x + 55, y + 22, x + 135, y + 22, x + 95, y + 4, [120, 80, 60]);
    tri(x + 112, y + 2, x + 120, y + 22, x + 128, y + 2, [255, 150, 30]);
    tri(x + 120, y + 0, x + 128, y + 22, x + 136, y + 0, [255, 200, 60]);
    disc(x + 190, y + 40, 5, [255, 120, 30]);
  }
}

function tally(items: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

function drawMasthead(): void {
  rect(0, 0, W, 96, NAVY);
  rect(0, 96, W, 4, GOLD);
  drawTextCenter(0, 14, W, 'THE WORLD IN ONE DAY', 4, WHITE);
  drawTextCenter(0, 56, W, 'FRIDAY - 20 NOVEMBER 2026', 2, GOLD);
  drawText(16, 58, '35 STORIES', 2, WHITE);
  drawText(W - 16 - textWidth('ONE IMAGE', 2), 58, 'ONE IMAGE', 2, WHITE);
}

function drawLead(): void {
  const y = 108;
  rect(14, y, 996, 76, CARD);
  rect(14, y, 996, 1, LINE); rect(14, y + 75, 996, 1, LINE);
  rect(14, y, 6, 76, RED);
  drawText(28, y + 12, 'TOP STORY - USA', 2, RED);
  drawText(28, y + 34, '2027', 4, RED);
  drawText(220, y + 10, LEAD_HEAD, 3, INK);
  drawText(220, y + 38, LEAD_SUB1, 2, INK);
  drawText(220, y + 56, LEAD_SUB2, 2, SOFT);
}

function drawCard(card: StoryCard, x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, CARD);
  rect(x, y, w, 1, LINE); rect(x, y + h - 1, w, 1, LINE);
  rect(x, y, 1, h, LINE); rect(x + w - 1, y, 1, h, LINE);
  drawArt(card.art, x + 1, y + 1, w - 2, 54);
  rect(x + 8, y + 8, textWidth(card.tag, 2) + 12, 20, INK);
  drawText(x + 14, y + 11, card.tag, 2, WHITE);
  const headLines = wrapText(card.head, 18);
  const subLines = wrapText(card.sub, 18);
  for (let i = 0; i < headLines.length && i < 2; i++) drawText(x + 8, y + 62 + i * 17, headLines[i], 2, INK);
  for (let i = 0; i < subLines.length && i < 2; i++) drawText(x + 8, y + 96 + i * 15, subLines[i], 2, SOFT);
}

function drawMapPanel(): void {
  const y = 598;
  rect(14, y, 996, 118, CARD);
  rect(14, y, 996, 1, LINE); rect(14, y + 117, 996, 1, LINE);
  drawText(24, y + 8, 'WHERE THE DAY HAPPENED', 2, INK);
  const mx = 24;
  const my = y + 26;
  const mw = 580;
  const mh = 88;
  const cw = mw / 60;
  const ch = mh / 20;
  for (let r = 0; r < 20; r++) {
    for (let c = 0; c < 60; c++) {
      if (MAP_ROWS[r][c] === '#') {
        rect(Math.round(mx + c * cw + 1), Math.round(my + r * ch + 1), 3, 3, [120, 140, 160]);
      }
    }
  }
  for (const [lon, lat] of PINS) {
    const px = Math.round(mx + ((lon + 180) / 360) * mw);
    const py = Math.round(my + ((90 - lat) / 180) * mh);
    disc(px, py, 6, RED);
    ring(px, py, 6, WHITE);
    disc(px, py, 2, WHITE);
  }
  drawText(502, my + 28, 'SHENZHEN', 2, RED);
  drawText(392, my + 40, 'RIYADH', 2, RED);
  drawText(411, my + 56, 'ODISHA', 2, RED);
  drawText(460, my + 70, 'WELLINGTON', 2, RED);
  const regions = tally([
    'N AMERICA',
    ...CARDS.map((c) => c.region),
    ...BRIEFS.map((b) => b[1]),
  ]);
  const fields = tally([
    'POLITICS',
    ...CARDS.map((c) => c.field),
    ...BRIEFS.map((b) => b[2]),
  ]);
  drawText(640, y + 8, 'BY REGION', 2, INK);
  for (let i = 0; i < 4 && i < regions.length; i++) {
    drawText(640, y + 32 + i * 18, regions[i][0] + ' ' + regions[i][1], 2, SOFT);
  }
  drawText(830, y + 8, 'BY FIELD', 2, INK);
  for (let i = 0; i < 4 && i < fields.length; i++) {
    drawText(830, y + 32 + i * 18, fields[i][0] + ' ' + fields[i][1], 2, SOFT);
  }
}

function drawNumbers(): void {
  const y = 724;
  rect(14, y, 996, 40, NAVY);
  const cw = 996 / 6;
  for (let i = 0; i < NUMBERS.length; i++) {
    const cx = 14 + i * cw;
    if (i > 0) vline(Math.round(cx), y + 6, 28, [70, 90, 120]);
    drawTextCenter(Math.round(cx), y + 4, Math.round(cw), NUMBERS[i][0], 3, GOLD);
    drawTextCenter(Math.round(cx), y + 25, Math.round(cw), NUMBERS[i][1], 2, WHITE);
  }
}

function drawBriefs(): void {
  const y = 772;
  drawText(16, y, 'THE REST OF THE DAY - IN BRIEF', 2, INK);
  hline(16, y + 20, 992, INK);
  for (let i = 0; i < BRIEFS.length; i++) {
    const col = i < 11 ? 0 : 1;
    const row = i % 11;
    const bx = 16 + col * 500;
    const by = y + 28 + row * 16;
    const num = String(i + 1).padStart(2, '0');
    drawText(bx, by, num, 2, RED);
    drawText(bx + 30, by, BRIEFS[i][0], 2, INK);
  }
}

function drawFooter(): void {
  drawTextCenter(0, 984, W, 'SOURCES: REUTERS, BBC, AP, THE HINDU, SPACE.COM', 2, SOFT);
  drawTextCenter(0, 1002, W, "THE DAY'S NEWS AS REPORTED ON FRIDAY 20 NOVEMBER 2026", 2, SOFT);
}

function main(): void {
  rect(0, 0, W, H, PAPER);
  drawMasthead();
  drawLead();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 4 + c;
      drawCard(CARDS[idx], 14 + c * (243 + 8), 192 + r * (128 + 8), 243, 128);
    }
  }
  drawMapPanel();
  drawNumbers();
  drawBriefs();
  drawFooter();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePng();
  writeFileSync(join(outDir, 'entry.png'), png);
  console.log('wrote entry.png ' + png.length + ' bytes');
}

main();
