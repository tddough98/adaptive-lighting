/**
 * Generate reference curve values for Python cross-validation.
 * Run: cd panel && npx tsx scripts/generate_reference_data.ts
 */
import { resolveCurve, calculateValueAtHour } from '../src/utils/curvemath';
import { DEFAULT_CURVE_SET } from '../src/data/defaults';
import type { SunTimes } from '../src/types/curves';

const sunTimes: SunTimes = { sunriseHour: 6.5, sunsetHour: 18.75 };

const brightResolved = resolveCurve(DEFAULT_CURVE_SET.brightness, sunTimes);
const colorResolved = resolveCurve(DEFAULT_CURVE_SET.colorTemp, sunTimes);

console.log("# hour, brightness, colorTemp");
for (let h = 0; h < 24; h += 0.5) {
  const b = calculateValueAtHour(h, brightResolved);
  const c = calculateValueAtHour(h, colorResolved);
  console.log(`${h.toFixed(1)}, ${b.toFixed(4)}, ${c.toFixed(4)}`);
}
