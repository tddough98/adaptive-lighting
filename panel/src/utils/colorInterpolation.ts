/** RGB tuple type: [r, g, b] where each channel is 0–255. */
export type RgbTuple = [number, number, number];

/**
 * Convert RGB to HSV. Matches Python colorsys.rgb_to_hsv.
 * Input: r, g, b in 0–255
 * Output: [h, s, v] where h in 0–1, s in 0–1, v in 0–1
 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const maxc = Math.max(rn, gn, bn);
  const minc = Math.min(rn, gn, bn);
  const v = maxc;
  if (minc === maxc) return [0, 0, v];
  const s = (maxc - minc) / maxc;
  const rc = (maxc - rn) / (maxc - minc);
  const gc = (maxc - gn) / (maxc - minc);
  const bc = (maxc - bn) / (maxc - minc);
  let h: number;
  if (rn === maxc) {
    h = bc - gc;
  } else if (gn === maxc) {
    h = 2.0 + rc - bc;
  } else {
    h = 4.0 + gc - rc;
  }
  h = ((h / 6.0) % 1.0 + 1.0) % 1.0;
  return [h, s, v];
}

/**
 * Convert HSV to RGB. Matches Python colorsys.hsv_to_rgb.
 * Input: h in 0–1, s in 0–1, v in 0–1
 * Output: [r, g, b] where each channel is 0–255
 */
export function hsvToRgb(h: number, s: number, v: number): RgbTuple {
  if (s === 0) {
    const c = Math.round(v * 255);
    return [c, c, c];
  }
  const i = Math.floor(h * 6.0);
  const f = h * 6.0 - i;
  const p = v * (1.0 - s);
  const q = v * (1.0 - s * f);
  const t = v * (1.0 - s * (1.0 - f));
  let rn: number, gn: number, bn: number;
  switch (i % 6) {
    case 0: rn = v; gn = t; bn = p; break;
    case 1: rn = q; gn = v; bn = p; break;
    case 2: rn = p; gn = v; bn = t; break;
    case 3: rn = p; gn = q; bn = v; break;
    case 4: rn = t; gn = p; bn = v; break;
    default: rn = v; gn = p; bn = q; break;
  }
  return [
    Math.round(rn * 255),
    Math.round(gn * 255),
    Math.round(bn * 255),
  ];
}

/**
 * Interpolate between two RGB colors in HSV space.
 * Takes abs(t), interpolates H/S/V linearly. Matches Shiny's lerp_color_hsv.
 * Input: rgb1 and rgb2 as [r,g,b] tuples (0–255), t as interpolation factor
 * Output: [r, g, b] tuple (0–255)
 */
export function lerpColorHsv(rgb1: RgbTuple, rgb2: RgbTuple, t: number): RgbTuple {
  const ta = Math.abs(t);
  const [h1, s1, v1] = rgbToHsv(rgb1[0], rgb1[1], rgb1[2]);
  const [h2, s2, v2] = rgbToHsv(rgb2[0], rgb2[1], rgb2[2]);
  const h = h1 + (h2 - h1) * ta;
  const s = s1 + (s2 - s1) * ta;
  const v = v1 + (v2 - v1) * ta;
  return hsvToRgb(h, s, v);
}

/** Convert an RGB tuple to a CSS rgb() string. */
export function rgbTupleToString(rgb: RgbTuple): string {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}
