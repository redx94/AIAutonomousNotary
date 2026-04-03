/**
 * Living Cipher — deterministic SVG art generator for Notary NFTs.
 *
 * Generates a unique cryptographic mandala visual for each token based on
 * its artSeed. The seed drives all visual parameters so the same seed always
 * produces the same artwork. No sensitive document content is encoded.
 *
 * Master NFT:  larger, more complex, uses the full 256-bit seed.
 * Page NFTs:   visually related to the master but distinct per page index.
 */

/** Convert a hex string seed into an array of pseudo-random numbers in [0,1). */
function seedToRNG(hexSeed: string): () => number {
  // Strip 0x prefix, pad/truncate to 64 hex chars
  const clean = hexSeed.replace(/^0x/i, '').padEnd(64, '0').slice(0, 64);
  let state = BigInt('0x' + clean);

  return () => {
    // xorshift64
    state ^= state << 13n;
    state ^= state >> 7n;
    state ^= state << 17n;
    // Keep lower 32 bits, convert to float in [0, 1)
    const val = Number(state & 0xffffffffn) / 0x100000000;
    return Math.abs(val);
  };
}

interface MandalaOptions {
  variant: 'master' | 'page';
  pageIndex?: number;
  size?: number;
}

function hslString(h: number, s: number, l: number, a = 1) {
  return `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a.toFixed(2)})`;
}

/**
 * Generate a deterministic SVG string from an artSeed.
 * Returns a data URI suitable for use in <img src={...} />.
 */
export function generateLivingCipherSVG(
  artSeed: string,
  opts: MandalaOptions = { variant: 'master' },
): string {
  const { variant, pageIndex = 0, size = variant === 'master' ? 480 : 240 } = opts;
  const rng = seedToRNG(artSeed);

  const cx = size / 2;
  const cy = size / 2;

  // Color palette — derived from seed
  const hue      = rng() * 360;
  const hue2     = (hue + 120 + rng() * 60) % 360;
  const hue3     = (hue + 240 + rng() * 60) % 360;
  const sat      = 55 + rng() * 30;
  const lit      = 40 + rng() * 20;

  const bg        = hslString(hue, sat * 0.2, 10);
  const primary   = hslString(hue, sat, lit);
  const secondary = hslString(hue2, sat - 10, lit + 10);
  const accent    = hslString(hue3, sat + 10, lit - 5);
  const glow      = hslString(hue, sat + 20, lit + 30, 0.35);

  // Ring count: 4–7 for master, 2–4 for page
  const ringCount = variant === 'master'
    ? Math.round(4 + rng() * 3)
    : Math.round(2 + rng() * 2);

  // Spoke count: 6, 8, 10, or 12
  const spokeCounts = [6, 8, 10, 12];
  const spokeCount = spokeCounts[Math.floor(rng() * spokeCounts.length)];

  let paths = '';
  let circles = '';
  let glyphs = '';

  // ── Rings ──────────────────────────────────────────────────────────────────
  for (let r = 0; r < ringCount; r++) {
    const radius    = (cx * 0.15) + (cx * 0.7 * (r + 1)) / ringCount;
    const opacity   = 0.15 + rng() * 0.55;
    const dashes    = Math.round(rng() * 3) * 4;
    const dashAttr  = dashes ? `stroke-dasharray="${dashes} ${dashes * 0.6}"` : '';
    const strokeW   = 0.5 + rng() * (variant === 'master' ? 2 : 1);
    const color     = r % 3 === 0 ? primary : r % 3 === 1 ? secondary : accent;

    circles += `<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(2)}" fill="none" `
      + `stroke="${color}" stroke-width="${strokeW.toFixed(2)}" opacity="${opacity.toFixed(2)}" ${dashAttr}/>\n`;
  }

  // ── Spokes / petals ────────────────────────────────────────────────────────
  const outerR = cx * 0.82;
  const innerR = cx * 0.08;

  for (let s = 0; s < spokeCount; s++) {
    const angle   = (2 * Math.PI * s) / spokeCount;
    const jitter  = (rng() - 0.5) * (Math.PI / spokeCount) * 0.4;
    const a       = angle + jitter;

    const x1 = cx + innerR * Math.cos(a);
    const y1 = cy + innerR * Math.sin(a);
    const x2 = cx + outerR * Math.cos(a);
    const y2 = cy + outerR * Math.sin(a);

    // Control points for a gentle curve
    const mid    = innerR + (outerR - innerR) * (0.4 + rng() * 0.2);
    const perp   = (rng() - 0.5) * mid * 0.35;
    const cpx    = cx + mid * Math.cos(a) - perp * Math.sin(a);
    const cpy    = cy + mid * Math.sin(a) + perp * Math.cos(a);

    const opacity = 0.2 + rng() * 0.6;
    const color   = s % 2 === 0 ? primary : secondary;
    const strokeW = 0.4 + rng() * (variant === 'master' ? 1.5 : 0.8);

    paths += `<path d="M${x1.toFixed(2)},${y1.toFixed(2)} Q${cpx.toFixed(2)},${cpy.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}" `
      + `fill="none" stroke="${color}" stroke-width="${strokeW.toFixed(2)}" opacity="${opacity.toFixed(2)}"/>\n`;

    // Small accent dot at outer tip
    const dotR = 0.8 + rng() * (variant === 'master' ? 3 : 1.5);
    glyphs += `<circle cx="${x2.toFixed(2)}" cy="${y2.toFixed(2)}" r="${dotR.toFixed(2)}" `
      + `fill="${accent}" opacity="${(0.4 + rng() * 0.5).toFixed(2)}"/>\n`;
  }

  // ── Inner mandala petals ───────────────────────────────────────────────────
  const petalCount = Math.round(3 + rng() * 3) * 2;
  const petalR     = cx * (variant === 'master' ? 0.28 : 0.22);

  for (let p = 0; p < petalCount; p++) {
    const a1 = (2 * Math.PI * p) / petalCount;
    const a2 = a1 + Math.PI / petalCount;
    const pr = petalR * (0.5 + rng() * 0.5);

    const px1 = cx + pr * Math.cos(a1);
    const py1 = cy + pr * Math.sin(a1);
    const px2 = cx + pr * Math.cos(a2);
    const py2 = cy + pr * Math.sin(a2);

    const cpx2 = cx + pr * 1.4 * Math.cos((a1 + a2) / 2);
    const cpy2 = cy + pr * 1.4 * Math.sin((a1 + a2) / 2);

    const opacity = 0.1 + rng() * 0.3;
    const color   = p % 2 === 0 ? primary : accent;

    paths += `<path d="M${cx},${cy} Q${px1.toFixed(2)},${py1.toFixed(2)} ${cpx2.toFixed(2)},${cpy2.toFixed(2)} Q${px2.toFixed(2)},${py2.toFixed(2)} ${cx},${cy}" `
      + `fill="${color}" opacity="${opacity.toFixed(2)}" stroke="none"/>\n`;
  }

  // ── Centre core ────────────────────────────────────────────────────────────
  const coreR = cx * (variant === 'master' ? 0.09 : 0.07);
  const coreR2 = coreR * 0.55;

  glyphs += `<circle cx="${cx}" cy="${cy}" r="${coreR.toFixed(2)}" fill="${primary}" opacity="0.75"/>\n`;
  glyphs += `<circle cx="${cx}" cy="${cy}" r="${coreR2.toFixed(2)}" fill="${accent}" opacity="0.9"/>\n`;

  // Page index indicator ring (page NFTs only)
  if (variant === 'page' && pageIndex !== undefined) {
    const indicatorR = cx * 0.88;
    const markerAngle = (2 * Math.PI * pageIndex) / (spokeCount);
    const mx = cx + indicatorR * Math.cos(markerAngle);
    const my = cy + indicatorR * Math.sin(markerAngle);
    glyphs += `<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="4" fill="${accent}" opacity="0.95"/>\n`;
  }

  // ── Radial glow gradient ───────────────────────────────────────────────────
  const gradId = `g${artSeed.slice(-6)}`;
  const defs = `<defs>
    <radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${glow}"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>`;

  const svgContent = `${defs}
<rect width="${size}" height="${size}" fill="${bg}"/>
<circle cx="${cx}" cy="${cy}" r="${cx * 0.98}" fill="url(#${gradId})"/>
${circles}${paths}${glyphs}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n${svgContent}\n</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Returns a compact preview thumbnail (64×64) of the Living Cipher visual.
 * Used in gallery / list views.
 */
export function generateLivingCipherThumbnail(artSeed: string, pageIndex = 0): string {
  return generateLivingCipherSVG(artSeed, { variant: 'page', pageIndex, size: 64 });
}
