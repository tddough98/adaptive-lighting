/**
 * Generate reference Lighting Plan evaluation fixtures for parity tests.
 * Run: cd panel && pnpm gen:fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateLightingPlan } from '../src/domain/lightingPlanEvaluation';
import { DEFAULT_CURVE_SET } from '../src/data/defaults';
import type { ResolvedCurve, SunTimes } from '../src/types/curves';
import { calculateValueAtHour } from '../src/utils/curvemath';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(SCRIPT_DIR, '../fixtures/lighting-plan-evaluation.json');
const sunTimes: SunTimes = { sunriseHour: 6.5, sunsetHour: 18.75 };

const evaluation = evaluateLightingPlan(DEFAULT_CURVE_SET, sunTimes, 12);

const samples: Array<{ hour: number; brightness: number; colorTemp: number }> = [];

for (let h = 0; h < 24; h += 0.5) {
  const brightness = calculateValueAtHour(h, evaluation.resolvedBrightness);
  const colorTemp = calculateValueAtHour(h, evaluation.resolvedColorTemp);
  samples.push({
    hour: Number(h.toFixed(1)),
    brightness: Number(brightness.toFixed(4)),
    colorTemp: Number(colorTemp.toFixed(4)),
  });
}

function roundResolvedCurve(resolved: ResolvedCurve): ResolvedCurve {
  return Object.fromEntries(
    Object.entries(resolved).map(([key, value]) => [key, Number(value.toFixed(4))]),
  ) as unknown as ResolvedCurve;
}

const fixture = {
  version: 1,
  scenarios: [
    {
      id: 'default-lighting-plan',
      description: 'Default Lighting Plan evaluated every 30 minutes with fixed sunrise/sunset hours.',
      sunTimes,
      resolvedCurves: {
        brightness: roundResolvedCurve(evaluation.resolvedBrightness),
        colorTemp: roundResolvedCurve(evaluation.resolvedColorTemp),
      },
      colorModeWindow: evaluation.colorModeWindow,
      samples,
    },
  ],
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_PATH}`);
