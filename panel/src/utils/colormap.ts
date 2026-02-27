/** Map brightness (0–100) to a grayscale RGB string. */
export function brightnessToColor(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  const gray = Math.round((clamped / 100) * 255);
  return `rgb(${gray},${gray},${gray})`;
}

/**
 * Map color temperature in Kelvin (2000–5500) to an RGB string.
 * Uses Tanner Helland's algorithm for approximate blackbody radiation colors.
 */
export function kelvinToRgb(kelvin: number): string {
  const clamped = Math.max(1000, Math.min(40000, kelvin));
  const temp = clamped / 100;

  let r: number;
  let g: number;
  let b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
  }

  // Green
  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));

  return `rgb(${r},${g},${b})`;
}

/**
 * Same algorithm as kelvinToRgb but returns an [r, g, b] tuple
 * instead of a CSS string. Needed for HSV interpolation input.
 */
export function kelvinToRgbTuple(kelvin: number): [number, number, number] {
  const clamped = Math.max(1000, Math.min(40000, kelvin));
  const temp = clamped / 100;

  let r: number;
  let g: number;
  let b: number;

  if (temp <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
  }

  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  return [
    Math.max(0, Math.min(255, Math.round(r))),
    Math.max(0, Math.min(255, Math.round(g))),
    Math.max(0, Math.min(255, Math.round(b))),
  ];
}
