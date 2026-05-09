# React Dashboard Architecture Deepening Plan

This plan turns the React Dashboard / Enhanced Mode architecture review into implementation slices. It assumes the domain language in `panel/CONTEXT.md` and the decisions in `panel/docs/adr/` are authoritative.

## Goals

- Make the code speak in domain concepts: Lighting Plan, Lighting Plan Draft, Saved Lighting Plan, Adaptive Lighting Instance, Lighting State, Enhanced Mode Seed, Plan Validity, Seasonal Clipping, and Save Lighting Plan.
- Create deep modules with small interfaces and concentrated behavior.
- Preserve current prototype behavior while replacing shallow seams one slice at a time.
- Build toward preview/runtime parity as a production-readiness gate.

## Non-Goals

- Do not introduce the future profile system yet.
- Do not rename every existing TypeScript type immediately. Use adapter modules first, then rename opportunistically when interfaces stabilize.
- Do not make Seasonal Clipping mutate Saved Lighting Plans or Lighting Plan Drafts.

## Slice Order

### 1. Establish Test And Fixture Infrastructure

Create a test surface before moving domain behavior.

Files likely involved:

- `panel/package.json`
- `panel/src/utils/curvemath.ts`
- `panel/scripts/generate_reference_data.ts`
- `tests/test_enhanced_timing.py`

Work:

- Add Vitest as the TypeScript test runner for pure panel modules.
- Add tests around current Curve Shape behavior using the existing reference values.
- Replace the current CSV fixture output with structured JSON.
- Make fixture generation repeatable with `pnpm gen:fixtures`.
- Write fixtures to a stable path that both Vitest and `pytest` consume, such as `panel/fixtures/lighting-plan-evaluation.json`.
- Keep the existing Python cross-validation tests passing.

Acceptance:

- `pnpm test` exists and runs Vitest for panel pure logic.
- `pnpm gen:fixtures` regenerates structured JSON fixtures deterministically.
- Python and TypeScript both validate the same default Lighting Plan fixture file.
- No production behavior changes.

### 2. Create The Lighting Plan Evaluation Module

Move preview/runtime-critical behavior behind a deeper interface.

Files likely involved:

- `panel/src/utils/curvemath.ts`
- `panel/src/utils/pathgen.ts`
- `panel/src/hooks/useCurveData.ts`
- `panel/src/types/curves.ts`

New module candidate:

- `panel/src/domain/lightingPlanEvaluation.ts`

Interface shape:

- Input: Lighting Plan intent plus sun context and sampling options.
- Output type: `LightingPlanEvaluation`.
- Output contents: Lighting State samples, resolved control-point positions, evaluated Color Mode Window, validity metadata, and later clipped evaluated positions.

Work:

- Wrap existing `resolveCurve`, `calculateValueAtHour`, and sample generation behind the new module.
- Absorb `resolveColorModeBoundaries` from `useCurveSetReducer.ts` so Color Mode Window evaluation lives with the rest of Lighting State evaluation.
- Keep current `curvemath.ts` as implementation detail or internal helper.
- Preserve the current Curve Shape algorithm contract: TypeScript and Python must continue using the same Catmull-Rom behavior until an explicit ADR changes it.
- Extend the shared JSON fixture with resolved curve data so Python parity tests read resolved inputs as fixture data instead of hand-recomputing them.
- Add a fixture freshness guard, such as a CI/script check that fails when `pnpm gen:fixtures` leaves `git status` dirty.
- Do not implement Seasonal Clipping yet; reserve the output shape for it.

Acceptance:

- `useCurveData` calls the evaluation module instead of assembling evaluation itself.
- `CurveEditor` receives evaluated Color Mode Window data from `LightingPlanEvaluation`, not from reducer helpers.
- Existing visuals remain unchanged.
- Tests cover default brightness and color temperature evaluation through the new interface.
- Python parity tests no longer duplicate default resolved-curve construction for the fixture scenario.

### 3. Create The Lighting Plan Draft Module

Concentrate draft-edit behavior currently spread through the reducer.

Files likely involved:

- `panel/src/hooks/useCurveSetReducer.ts`
- `panel/src/types/curves.ts`
- `panel/src/utils/constraints.ts`

New module candidate:

- `panel/src/domain/lightingPlanDraft.ts`

Interface shape:

- Edit a Lighting Curve Control Point.
- Toggle Clock Time / Sun-Relative Time.
- Toggle Linked Timing.
- Change Value Range while preserving relative shape.
- Edit Color Mode Window intent.

Work:

- Move reducer helper behavior into domain operations.
- Consolidate the duplicated Linked Timing branches currently spread across `UPDATE_TIME_POINT`, `UPDATE_PEAK`, and `UPDATE_VALLEY`.
- Pull timing Plan Validity from `panel/src/utils/constraints.ts` into the draft module so bad action payloads cannot bypass timing constraints.
- Keep `constraints.ts` as an implementation helper only if useful; the draft module should own the interface.
- Keep the React reducer as a thin adapter over domain operations.
- Add tests for Plan Validity value hierarchy, Linked Timing, and Value Range remapping.
- Add tests proving invalid timing edits are clipped/rejected through the draft module, not only at the UI layer.

Acceptance:

- `useCurveSetReducer` contains little domain logic.
- Tests exercise draft edits through the same interface the reducer uses.
- Current drag behavior remains unchanged.

### 4. Create The Adaptive Lighting Instance Adapter

Make Home Assistant integration speak in selected-instance and save terms.

Files likely involved:

- `panel/src/ha/useAdaptiveLighting.ts`
- `panel/src/ha/dataConversion.ts`
- `panel/src/App.tsx`
- `panel/src/types/homeassistant.ts`

New module candidates:

- `panel/src/ha/adaptiveLightingInstanceAdapter.ts`
- `panel/src/ha/lightingPlanSave.ts`

Work:

- Replace raw `curveSet` returns with Saved Lighting Plan data for a Selected Adaptive Lighting Instance.
- Keep current auto-selection as a temporary fallback, but model it explicitly.
- Introduce save status: idle, saving, confirmed, rejected, normalized, stale.
- Make Save Lighting Plan submit complete intent only.
- Do not silently treat the draft as saved until Home Assistant confirms.
- Preserve and round-trip `linked` and Color Mode Window intent instead of silently substituting `DEFAULT_CURVE_SET` values when Home Assistant lacks data.
- Detect inbound Home Assistant changes to the Saved Lighting Plan while a Lighting Plan Draft is active, and mark the draft stale/conflicted instead of silently resetting it.

Acceptance:

- App code no longer knows how to find `switch.adaptive_lighting_*`.
- Save behavior has a typed status model.
- Inbound Saved Lighting Plan changes have a typed stale/conflict state, even if the first UI is minimal.
- Existing save call still works.

### 4b. Add Selected Adaptive Lighting Instance Chooser

Surface selection explicitly instead of relying only on first-switch fallback.

Files likely involved:

- `panel/src/ha/useAdaptiveLighting.ts`
- `panel/src/App.tsx`
- `panel/src/components/`

Work:

- Expose the list of available Adaptive Lighting Instances from the adapter.
- Add a compact chooser for the Selected Adaptive Lighting Instance when more than one exists.
- Keep auto-selecting the first Enhanced Mode instance as a temporary default selection.

Acceptance:

- Users can choose the Selected Adaptive Lighting Instance when multiple instances exist.
- Switching selection resets from the newly selected Saved Lighting Plan.
- The selected-instance state is explicit and testable.

### 4c. Add Save Status, Opt-In, And Conflict UI Surface

Make Save Lighting Plan lifecycle visible to users.

Files likely involved:

- `panel/src/App.tsx`
- `panel/src/components/CurveEditor/CurveEditor.tsx`
- `panel/src/ha/useAdaptiveLighting.ts`

Work:

- Add a save-status region for saving, confirmed, rejected, normalized, and stale/conflict states.
- If the Selected Adaptive Lighting Instance is not already using Enhanced Mode, require an explicit opt-in acknowledgement before Save Lighting Plan sends `brightness_mode: "enhanced"`.
- Surface save errors without dropping the Lighting Plan Draft.
- Surface normalized saves by refreshing from Home Assistant and telling the user confirmation changed the plan.
- Surface stale/conflict state when external Home Assistant updates arrive during editing.

Acceptance:

- The dashboard no longer silently opts non-enhanced instances into Enhanced Mode.
- Save failures and stale saved state are visible.
- The UI reflects the save lifecycle described in `panel/CONTEXT.md`.

### 5. Implement Enhanced Mode Seed

Replace generic fallback defaults for non-enhanced instances.

Files likely involved:

- `panel/src/ha/dataConversion.ts`
- `panel/src/data/defaults.ts`
- `custom_components/adaptive_lighting/const.py`
- `tests/test_enhanced_timing.py`

New module candidate:

- `panel/src/domain/enhancedModeSeed.ts`

Work:

- Derive the initial Lighting Plan Draft from existing Adaptive Lighting Instance settings where possible.
- Preserve brightness range, color temperature range, and sun-related settings immediately.
- Preserve sleep RGB/color settings once Slice 9 adds the complete Color Mode Window / sleep-color persistence path.
- Use defaults only for Enhanced Mode-specific shape details.
- Add fixture tests for several non-enhanced input configurations.

Acceptance:

- Non-enhanced instances no longer fall back blindly to `DEFAULT_CURVE_SET`.
- Seed behavior is deterministic and test-covered.
- ADR-0002 is enforced by tests.
- The implementation documents any seed fields gated on Slice 9 rather than pretending they are already persisted.

### 6. Add Seasonal Clipping To Evaluation

Implement evaluation-only Plan Validity repair.

Files likely involved:

- `panel/src/domain/lightingPlanEvaluation.ts`
- `panel/src/utils/constraints.ts`
- `panel/src/components/ChartCanvas/TimePointMarkers.tsx`
- `panel/src/components/ChartCanvas/ExtremePointMarkers.tsx`
- `panel/src/components/ChartCanvas/ColorModeBar.tsx`

Work:

- Add evaluation-time clipping for sun-time changes that would violate control-point ordering.
- Reuse existing primitives from `constraints.ts` where possible: `getTimePointConstraints`, `getPeakConstraints`, `getValleyConstraints`, and `clampHourInArc`.
- Define the collision policy before implementation:
  - Keep explicit `MIN_GAP_HOURS` behavior.
  - Decide which point yields when a sun-anchor compression makes a segment smaller than the minimum gap.
  - Decide whether clipping is symmetric around the compressed segment midpoint or gives precedence to earlier/later intent.
- For Linked Timing, compute clipped timing jointly for both curves and apply the same evaluated timing to the Brightness Curve and Color Temperature Curve.
- Preserve shared evaluated timing when Linked Timing is enabled.
- Allow unlinked Lighting Curves to clip independently.
- Add independent clipping for Color Mode Window validity.
- Return both draft-intent positions and clipped evaluated positions.
- Update `useCurveData` memoization inputs when clipping joins evaluation; clipping depends on the whole Lighting Plan, Linked Timing, Color Mode Window, sun context, and displayed date/location, not only individual curves.

Acceptance:

- Seasonal Clipping never mutates Lighting Plan Draft or Saved Lighting Plan data.
- Tests cover compressed/inverted sun-time scenarios.
- Tests document the collision policy.
- Evaluation output can tell rendering when a secondary clipped indicator is needed.

### 7. Render Draft Intent Versus Clipped Evaluated Positions

Make Seasonal Clipping visible without making it look saved.

Files likely involved:

- `panel/src/components/ChartCanvas/TimePointMarkers.tsx`
- `panel/src/components/ChartCanvas/ExtremePointMarkers.tsx`
- `panel/src/components/ChartCanvas/ColorModeBar.tsx`
- `panel/src/components/CurveEditor/SingleCurvePanel.tsx`
- `panel/src/hooks/useYearSimulation.ts`

Work:

- Keep draggable handles tied to Lighting Plan Draft intent.
- Render clipped evaluated positions as secondary indicators when they differ.
- Make labels/tooltips distinguish intent from evaluated state.
- Make year simulation consume the same `LightingPlanEvaluation` output so annual sun-time changes preview clipped evaluated state.

Acceptance:

- Users can see what will actually happen on the displayed date/location.
- Users do not confuse clipped evaluated positions with saved edits.
- Read-only year simulation can show evaluated clipping clearly.

### 8. Deepen Control Point Interaction

Extract repeated drag, snapping, double-click, and timing-mode behavior.

Files likely involved:

- `panel/src/components/ChartCanvas/TimePointMarkers.tsx`
- `panel/src/components/ChartCanvas/ExtremePointMarkers.tsx`
- `panel/src/components/ChartCanvas/ColorModeBar.tsx`
- `panel/src/hooks/useDrag.ts`

New module candidate:

- `panel/src/interaction/timeBearingControl.ts`

Work:

- Centralize drag-to-domain-operation conversion.
- Centralize double-click Clock Time / Sun-Relative Time toggling.
- Centralize snapping and pointer-to-hour conversion.
- Decide whether `useDrag.ts` becomes the new interaction module or is absorbed into `timeBearingControl.ts`.
- Keep rendering modules mostly visual.

Acceptance:

- Marker modules no longer each implement their own time-edit mechanics.
- Clock Time / Sun-Relative Time behavior has one test surface.
- No visible interaction regressions.

### 9. Make Color Mode Window Fully First-Class

Finish the known partial implementation.

Files likely involved:

- `panel/src/types/curves.ts`
- `panel/src/ha/dataConversion.ts`
- `custom_components/adaptive_lighting/const.py`
- `custom_components/adaptive_lighting/switch.py`
- `custom_components/adaptive_lighting/color_and_brightness.py`
- `panel/src/components/ChartCanvas/ColorModeBar.tsx`

Work:

- Commit the Home Assistant wire format for Color Mode Window and sleep RGB intent. This likely deserves an ADR before implementation.
- Include Peak and Valley Sun-Relative Time persistence in the same wire-format decision. Today `dataConversion.ts` serializes Peak and Valley as fixed hours, so saving a sun-relative Peak or Valley silently drops the Sun Anchor and offset on reload.
- Persist Color Mode Window intent through Home Assistant.
- Persist Peak and Valley Sun Anchors and offsets through Home Assistant.
- Include sleep RGB behavior in Saved Lighting Plan data.
- Add backward-compatible defaults for already-saved Enhanced Mode configs that lack Color Mode Window fields or Peak/Valley relativity fields.
- Evaluate Color Mode Window into Lighting State.
- Revisit mode-aware color rendering once arbitrary sleep RGB persistence exists.
- Add Python schema, attribute, and service tests for the new fields.
- Add parity fixtures that cover color temperature versus sleep RGB preference.

Acceptance:

- Color Mode Window is no longer local-only.
- Peak and Valley Sun-Relative Time round-trips through Save Lighting Plan and reload.
- Save Lighting Plan includes complete Lighting Plan intent.
- Runtime behavior and dashboard preview agree for color temperature versus sleep RGB preference.
- Existing enhanced configs without Color Mode Window fields continue to load.
- Python and TypeScript tests cover the wire format and runtime evaluation.

### 10. Expand Preview/Runtime Parity Fixtures

Turn ADR-0001 into a broad production-readiness gate.

Files likely involved:

- `panel/scripts/generate_reference_data.ts`
- `panel/src/domain/lightingPlanEvaluation.ts`
- `custom_components/adaptive_lighting/enhanced_timing.py`
- `tests/test_enhanced_timing.py`

Work:

- Add fixtures beyond the default plan:
  - Clock Time and Sun-Relative Time mix.
  - Peak/Valley Sun-Relative Time.
  - Linked and unlinked timing.
  - Value Range changes.
  - Seasonal Clipping cases.
  - Color Mode Window cases.
- Ensure Python and TypeScript consume the same fixture format.
- Add CI commands that run both the TypeScript and Python parity suites against the shared fixture file.

Acceptance:

- Preview/runtime parity covers the real behavior surface, not only the default curve.
- Enhanced Mode cannot be considered production-ready without these parity tests passing.
- CI enforces the parity gate.

## Suggested Implementation Discipline

- Each slice should keep the app runnable.
- Each slice should end with tests where the touched behavior is pure enough to test.
- Prefer adding adapter modules over broad renames until a slice has proven the interface.
- Keep user-facing behavior stable unless the slice explicitly changes it.
- After each slice, update `panel/CONTEXT.md` only if domain language changes, and create ADRs only for hard-to-reverse trade-offs.
