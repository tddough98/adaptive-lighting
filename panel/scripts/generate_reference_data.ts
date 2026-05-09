/**
 * Generate reference Lighting Plan evaluation fixtures for parity tests.
 * Run: cd panel && pnpm gen:fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCurve, calculateValueAtHour } from '../src/utils/curvemath';
import { DEFAULT_CURVE_SET } from '../src/data/defaults';
import type { SunTimes } from '../src/types/curves';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(SCRIPT_DIR, '../fixtures/lighting-plan-evaluation.json');
const sunTimes: SunTimes = { sunriseHour: 6.5, sunsetHour: 18.75 };

const brightResolved = resolveCurve(DEFAULT_CURVE_SET.brightness, sunTimes);
const colorResolved = resolveCurve(DEFAULT_CURVE_SET.colorTemp, sunTimes);

const samples: Array<{ hour: number; brightness: number; colorTemp: number }> = [];

for (let h = 0; h < 24; h += 0.5) {
  const b = calculateValueAtHour(h, brightResolved);
  const c = calculateValueAtHour(h, colorResolved);
  samples.push({
    hour: Number(h.toFixed(1)),
    brightness: Number(b.toFixed(4)),
    colorTemp: Number(c.toFixed(4)),
  });
}

const fixture = {
  version: 1,
  scenarios: [
    {
      id: 'default-lighting-plan',
      description: 'Default Lighting Plan evaluated every 30 minutes with fixed sunrise/sunset hours.',
      sunTimes,
      samples,
    },
  ],
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_PATH}`);
