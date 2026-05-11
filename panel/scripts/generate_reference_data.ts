/**
 * Generate reference Lighting Plan evaluation fixtures for parity tests.
 * Run: cd panel && pnpm gen:fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateColorPreferenceAtHour, evaluateLightingPlan } from '../src/domain/lightingPlanEvaluation';
import { DEFAULT_CURVE_SET } from '../src/data/defaults';
import { curveSetToServiceData } from '../src/ha/dataConversion';
import type { CurveSet, SunTimes } from '../src/types/curves';
import { calculateValueAtHour } from '../src/utils/curvemath';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(SCRIPT_DIR, '../fixtures/lighting-plan-evaluation.json');
const DEFAULT_SUN_TIMES: SunTimes = { sunriseHour: 6.5, sunsetHour: 18.75 };

interface ScenarioDefinition {
  id: string;
  description: string;
  curveSet: CurveSet;
  sunTimes: SunTimes;
  currentHour?: number;
}

interface FixtureSample {
  hour: number;
  brightness: number;
  colorTemp: number;
  colorPreference: 'colorTemp' | 'rgb';
}

function cloneDefaultCurveSet(): CurveSet {
  return structuredClone(DEFAULT_CURVE_SET);
}

function buildSamples(
  evaluation: ReturnType<typeof evaluateLightingPlan>,
): FixtureSample[] {
  const samples: FixtureSample[] = [];

  for (let h = 0; h < 24; h += 0.5) {
    const brightness = calculateValueAtHour(h, evaluation.resolvedBrightness);
    const colorTemp = calculateValueAtHour(h, evaluation.resolvedColorTemp);
    samples.push({
      hour: Number(h.toFixed(1)),
      brightness: Number(brightness.toFixed(4)),
      colorTemp: Number(colorTemp.toFixed(4)),
      colorPreference: evaluateColorPreferenceAtHour(h, evaluation.colorModeWindow),
    });
  }

  return samples;
}

function buildScenario(definition: ScenarioDefinition) {
  const evaluation = evaluateLightingPlan(
    definition.curveSet,
    definition.sunTimes,
    definition.currentHour ?? 12,
  );

  return {
    id: definition.id,
    description: definition.description,
    sunTimes: definition.sunTimes,
    rawIntent: curveSetToServiceData(definition.curveSet),
    clipping: evaluation.clipping,
    resolvedCurves: {
      brightness: evaluation.resolvedBrightness,
      colorTemp: evaluation.resolvedColorTemp,
    },
    colorModeWindow: evaluation.colorModeWindow,
    samples: buildSamples(evaluation),
  };
}

function linkedTimingScenario(): ScenarioDefinition {
  const curveSet = cloneDefaultCurveSet();
  curveSet.linked = true;
  curveSet.colorTemp.transitionStart = {
    ...curveSet.colorTemp.transitionStart,
    value: -120,
  };
  curveSet.colorTemp.transitionEnd = {
    ...curveSet.colorTemp.transitionEnd,
    value: 90,
  };
  curveSet.colorTemp.peak = { ...curveSet.colorTemp.peak, hour: 14 };
  curveSet.colorTemp.valley = { ...curveSet.colorTemp.valley, hour: 3 };
  return {
    id: 'linked-color-temperature-drift',
    description: 'Linked Lighting Plan where divergent Color Temperature timing is reasserted from Brightness timing.',
    curveSet,
    sunTimes: DEFAULT_SUN_TIMES,
  };
}

function clockSunMixScenario(): ScenarioDefinition {
  const curveSet = cloneDefaultCurveSet();
  curveSet.brightness.transitionStart = {
    ...curveSet.brightness.transitionStart,
    value: 19,
    isRelative: false,
    anchor: undefined,
  };
  curveSet.brightness.holdStart = {
    ...curveSet.brightness.holdStart,
    value: 240,
    isRelative: true,
    anchor: 'sunset',
  };
  curveSet.brightness.transitionEnd = {
    ...curveSet.brightness.transitionEnd,
    value: 7,
    isRelative: false,
    anchor: undefined,
  };
  curveSet.colorTemp.transitionStart = {
    ...curveSet.colorTemp.transitionStart,
    value: 19,
    isRelative: false,
    anchor: undefined,
  };
  curveSet.colorTemp.holdStart = {
    ...curveSet.colorTemp.holdStart,
    value: 240,
    isRelative: true,
    anchor: 'sunset',
  };
  curveSet.colorTemp.transitionEnd = {
    ...curveSet.colorTemp.transitionEnd,
    value: 7,
    isRelative: false,
    anchor: undefined,
  };
  return {
    id: 'clock-and-sun-relative-mix',
    description: 'Lighting Plan with mixed Clock Time and Sun-Relative Time control points.',
    curveSet,
    sunTimes: DEFAULT_SUN_TIMES,
  };
}

function relativePeakValleyScenario(): ScenarioDefinition {
  const curveSet = cloneDefaultCurveSet();
  curveSet.brightness.peak = {
    hour: 13,
    value: 100,
    isRelative: true,
    anchor: 'sunrise',
    offsetMinutes: 390,
  };
  curveSet.brightness.valley = {
    hour: 2,
    value: 1,
    isRelative: true,
    anchor: 'sunset',
    offsetMinutes: 480,
  };
  curveSet.colorTemp.peak = {
    hour: 13,
    value: 5500,
    isRelative: true,
    anchor: 'sunrise',
    offsetMinutes: 390,
  };
  curveSet.colorTemp.valley = {
    hour: 2,
    value: 2000,
    isRelative: true,
    anchor: 'sunset',
    offsetMinutes: 480,
  };
  return {
    id: 'sun-relative-peak-valley',
    description: 'Lighting Plan with Peak and Valley stored as Sun-Relative Time.',
    curveSet,
    sunTimes: DEFAULT_SUN_TIMES,
  };
}

function unlinkedTimingScenario(): ScenarioDefinition {
  const curveSet = cloneDefaultCurveSet();
  curveSet.linked = false;
  curveSet.colorTemp.transitionStart = {
    ...curveSet.colorTemp.transitionStart,
    value: -120,
  };
  curveSet.colorTemp.transitionEnd = {
    ...curveSet.colorTemp.transitionEnd,
    value: 90,
  };
  curveSet.colorTemp.peak = { ...curveSet.colorTemp.peak, hour: 14 };
  curveSet.colorTemp.valley = { ...curveSet.colorTemp.valley, hour: 3 };
  return {
    id: 'unlinked-color-temperature-timing',
    description: 'Unlinked Lighting Plan where the Color Temperature Curve has independent timing.',
    curveSet,
    sunTimes: DEFAULT_SUN_TIMES,
  };
}

function valueRangeScenario(): ScenarioDefinition {
  const curveSet = cloneDefaultCurveSet();
  curveSet.colorTemp = {
    ...curveSet.colorTemp,
    minValue: 2200,
    maxValue: 5000,
    transitionStart: { ...curveSet.colorTemp.transitionStart, yValue: 5000 },
    holdStart: { ...curveSet.colorTemp.holdStart, yValue: 2200 },
    holdEnd: { ...curveSet.colorTemp.holdEnd, yValue: 2200 },
    transitionEnd: { ...curveSet.colorTemp.transitionEnd, yValue: 5000 },
    peak: { ...curveSet.colorTemp.peak, value: 5000 },
    valley: { ...curveSet.colorTemp.valley, value: 2200 },
  };
  return {
    id: 'color-temperature-value-range',
    description: 'Lighting Plan with a narrowed Color Temperature Curve value range.',
    curveSet,
    sunTimes: DEFAULT_SUN_TIMES,
  };
}

function seasonalClippingScenario(): ScenarioDefinition {
  return {
    id: 'seasonal-clipping-late-sunset',
    description: 'TypeScript evaluation clips late-sunset timing before sampling; Python parity consumes the clipped fixture because backend clipping is future scope.',
    curveSet: cloneDefaultCurveSet(),
    sunTimes: { sunriseHour: 6, sunsetHour: 23.75 },
  };
}

function colorModeWindowScenario(): ScenarioDefinition {
  const curveSet = cloneDefaultCurveSet();
  curveSet.colorMode = {
    ...curveSet.colorMode,
    colorTempStartHour: null,
    startOffsetMinutes: -480,
    colorTempEndHour: 18.25,
    endOffsetMinutes: 0,
    sleepRgbColor: [12, 34, 56],
  };
  return {
    id: 'wrapping-color-mode-window',
    description: 'Color Mode Window with modulo-24 sun-relative wrapping and RGB outside the window.',
    curveSet,
    sunTimes: DEFAULT_SUN_TIMES,
    currentHour: 20,
  };
}

const scenarioDefinitions: ScenarioDefinition[] = [
  {
    id: 'default-lighting-plan',
    description: 'Default Lighting Plan evaluated every 30 minutes with fixed sunrise/sunset hours.',
    curveSet: DEFAULT_CURVE_SET,
    sunTimes: DEFAULT_SUN_TIMES,
  },
  clockSunMixScenario(),
  relativePeakValleyScenario(),
  linkedTimingScenario(),
  unlinkedTimingScenario(),
  valueRangeScenario(),
  seasonalClippingScenario(),
  colorModeWindowScenario(),
];

const fixture = {
  version: 4,
  scenarios: scenarioDefinitions.map(buildScenario),
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote ${OUTPUT_PATH}`);
