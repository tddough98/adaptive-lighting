# React Dashboard

The React Dashboard is the editing surface for Adaptive Lighting's Enhanced Mode. It exists so users can shape lighting behavior visually before saving it back to Home Assistant.

## Language

**Enhanced Mode**:
The Home Assistant lighting behavior where brightness and color temperature are driven by a Lighting Plan instead of the upstream default, linear, or tanh brightness behavior.
_Avoid_: React dashboard, enhanced dashboard

**React Dashboard**:
The Home Assistant custom panel that edits Enhanced Mode curves.
_Avoid_: Enhanced Mode

**Lighting Plan**:
The complete editable Enhanced Mode configuration: one brightness curve, one color temperature curve, timing link behavior, and color mode boundaries.
_Avoid_: CurveSet, enhanced curve config

**Lighting Curve**:
A 24-hour value schedule with six editable control points.
_Avoid_: curve definition

**Lighting Curve Control Point**:
A user-editable time/value point on a Lighting Curve.
_Avoid_: point, marker

**Value Range**:
The allowed minimum and maximum values for a Lighting Curve.
_Avoid_: display scale, y-axis range

**Curve Shape**:
The continuous path produced between Lighting Curve Control Points.
_Avoid_: interpolation algorithm, spline

**Evening Start**:
The Lighting Curve Control Point where the curve starts moving away from daytime behavior.
_Avoid_: P1, transition start

**Night Hold Start**:
The Lighting Curve Control Point where the curve reaches the night hold value.
_Avoid_: P2, hold start

**Valley**:
The Lighting Curve Control Point with the lowest intended nighttime value.
_Avoid_: minimum, P3

**Night Hold End**:
The Lighting Curve Control Point where the curve leaves the night hold value.
_Avoid_: P4, hold end

**Morning End**:
The Lighting Curve Control Point where the curve finishes returning to daytime behavior.
_Avoid_: P5, transition end

**Peak**:
The Lighting Curve Control Point with the highest intended daytime value.
_Avoid_: maximum, P6

**Brightness Curve**:
The Lighting Curve in a Lighting Plan that determines brightness percentage.
_Avoid_: brightness config

**Color Temperature Curve**:
The Lighting Curve in a Lighting Plan that determines color temperature in Kelvin.
_Avoid_: color temp config, CT curve

**Color Mode Window**:
The interval in a Lighting Plan where Enhanced Mode should prefer color temperature over sleep RGB color.
_Avoid_: color mode boundary, RGB/CT zone

**Linked Timing**:
Lighting Plan behavior where the Brightness Curve and Color Temperature Curve share control-point times while keeping independent values.
_Avoid_: linked curves, linked values

**Lighting Plan Draft**:
The unsaved local Lighting Plan being edited in the React Dashboard.
_Avoid_: local curve set, React state

**Saved Lighting Plan**:
The Lighting Plan currently stored by Home Assistant.
_Avoid_: persisted curve set, entity config

**Save Lighting Plan**:
Submit a Lighting Plan Draft to Home Assistant so it becomes the Saved Lighting Plan for the Selected Adaptive Lighting Instance.
_Avoid_: publish, apply

**Adaptive Lighting Instance**:
One configured Adaptive Lighting controller in Home Assistant, represented by a main switch entity and associated with zero or more controlled lights.
_Avoid_: Adaptive Lighting Group, Profile, switch

**Selected Adaptive Lighting Instance**:
The Adaptive Lighting Instance whose Lighting Plan is currently being viewed or edited.
_Avoid_: active switch, first switch

**Enhanced Mode Seed**:
The initial Lighting Plan Draft derived from an Adaptive Lighting Instance's existing non-enhanced settings.
_Avoid_: fallback defaults

**Lighting State**:
The brightness, color temperature, and sleep RGB preference produced by applying a Lighting Plan at a specific time for a specific Adaptive Lighting Instance.
_Avoid_: resolved curve, sample, light command

**Sun Anchor**:
Sunrise or sunset used as a reference point for a Lighting Curve Control Point or Color Mode Window edge.
_Avoid_: sun time

**Clock Time**:
A fixed wall-clock time in a Lighting Plan.
_Avoid_: absolute time

**Sun-Relative Time**:
A time in a Lighting Plan expressed as an offset from a Sun Anchor.
_Avoid_: relative time

**Plan Validity**:
Whether a Lighting Plan satisfies required control-point ordering and value constraints.
_Avoid_: valid curve

**Seasonal Clipping**:
Evaluation-time adjustment that keeps a Lighting Plan valid when changing sunrise or sunset times would otherwise violate required ordering.
_Avoid_: saved plan mutation, auto-fix

## Relationships

- The **React Dashboard** edits **Enhanced Mode** curves.
- A **Lighting Plan** belongs to **Enhanced Mode**.
- A **Lighting Plan** contains exactly one **Brightness Curve** and exactly one **Color Temperature Curve**.
- A **Lighting Plan** contains exactly one **Color Mode Window**.
- A **Brightness Curve** is a **Lighting Curve** measured in percent.
- A **Color Temperature Curve** is a **Lighting Curve** measured in Kelvin.
- A **Lighting Curve** has exactly six **Lighting Curve Control Points**: **Evening Start**, **Night Hold Start**, **Valley**, **Night Hold End**, **Morning End**, and **Peak**.
- A **Lighting Curve** has exactly one **Value Range**.
- A **Lighting Curve** has one **Curve Shape**.
- **Peak** and **Valley** are first-class **Lighting Curve Control Points**, not derived extrema.
- **Linked Timing** copies Brightness Curve timing to the Color Temperature Curve when enabled.
- While **Linked Timing** is enabled, dragging timing on either Lighting Curve updates both Lighting Curves.
- **Linked Timing** never links Brightness Curve values to Color Temperature Curve values.
- While **Linked Timing** is enabled, **Seasonal Clipping** should preserve shared evaluated timing across the Brightness Curve and Color Temperature Curve.
- When **Linked Timing** is disabled, each Lighting Curve may use **Seasonal Clipping** independently.
- The **Color Mode Window** is part of a **Lighting Plan**, but backend persistence for it is currently incomplete.
- Home Assistant is the source of truth for the **Saved Lighting Plan**.
- The **React Dashboard** owns a **Lighting Plan Draft** while the user edits.
- A **Saved Lighting Plan** belongs to exactly one **Adaptive Lighting Instance**.
- **Save Lighting Plan** submits the **Lighting Plan Draft** to Home Assistant; after save or entity switch, the **React Dashboard** should refresh from the **Saved Lighting Plan**.
- **Save Lighting Plan** sends a complete **Lighting Plan**, not a partial patch.
- **Save Lighting Plan** saves user intent only; it must not save evaluated **Lighting State**, sampled points, or **Seasonal Clipping** results.
- After **Save Lighting Plan**, the **React Dashboard** should wait for Home Assistant confirmation before treating the **Lighting Plan Draft** as the **Saved Lighting Plan**.
- The **React Dashboard** may show a saving state while waiting for Home Assistant confirmation.
- If Home Assistant rejects **Save Lighting Plan**, keep the **Lighting Plan Draft** and show the save error.
- If Home Assistant accepts but normalizes the **Saved Lighting Plan**, refresh the **Lighting Plan Draft** from the normalized saved version and surface that confirmation changed the plan.
- External updates to the same **Saved Lighting Plan** should not silently overwrite an active **Lighting Plan Draft**.
- The **React Dashboard** should eventually surface externally changed saved state as a draft staleness or conflict state.
- The current **React Dashboard** edits one active **Lighting Plan** for the selected Adaptive Lighting switch.
- Profile support is future scope and should not be baked into the current **Lighting Plan** model.
- The **React Dashboard** edits the **Lighting Plan** for one selected **Adaptive Lighting Instance**.
- Editing or saving a **Lighting Plan** opts the **Selected Adaptive Lighting Instance** into **Enhanced Mode**.
- If the **Selected Adaptive Lighting Instance** is not already using **Enhanced Mode**, the **React Dashboard** should make that behavior change explicit before saving.
- When opting an **Adaptive Lighting Instance** into **Enhanced Mode**, the initial **Lighting Plan Draft** should be seeded from that instance's existing settings where possible.
- Only Enhanced Mode-specific shape details that do not exist in the prior settings should use defaults.
- An **Enhanced Mode Seed** should be deterministic and covered by reference fixtures.
- An **Adaptive Lighting Instance** controls zero or more Home Assistant lights.
- A controlled light may be an individual Home Assistant light or a Home Assistant light group.
- The main `switch.adaptive_lighting_*` entity is Home Assistant's representation of an **Adaptive Lighting Instance**.
- The **React Dashboard** has exactly one **Selected Adaptive Lighting Instance** at a time.
- If Home Assistant has multiple **Adaptive Lighting Instances**, the user should be able to choose the **Selected Adaptive Lighting Instance**.
- Auto-selecting the first Enhanced Mode instance is a temporary implementation fallback, not the domain rule.
- A **Lighting Plan** is editable configuration.
- A **Lighting State** is calculated output.
- A **Lighting State** is not a Home Assistant light command payload.
- The Home Assistant integration translates **Lighting State** into actual light commands using device capabilities and integration settings.
- A **Lighting Plan** may store **Sun Anchors** and offsets.
- Actual sunrise and sunset times belong to the **Adaptive Lighting Instance** evaluation context, not to the **Lighting Plan**.
- The same **Lighting Plan** can produce different **Lighting States** on different dates or locations.
- Each **Lighting Curve Control Point** uses either **Clock Time** or **Sun-Relative Time**.
- Each **Color Mode Window** edge uses either **Clock Time** or **Sun-Relative Time**.
- Peak and Valley **Sun-Relative Time** are supported in the **Lighting Plan Draft** but are not fully persisted through the Home Assistant Enhanced Mode settings yet.
- The **React Dashboard** should prevent edits that would make a **Lighting Plan Draft** invalid.
- **Plan Validity** requires each **Lighting Curve** to preserve its daytime-to-nighttime value hierarchy: **Peak** is the upper anchor, **Valley** is the lower anchor, and transition endpoints cannot invert that shape.
- For the **Brightness Curve**, higher values mean brighter light.
- For the **Color Temperature Curve**, higher values mean cooler daytime color temperature and lower values mean warmer nighttime color temperature.
- Changing a **Lighting Curve's** **Value Range** remaps existing control-point values proportionally into the new range.
- Changing a **Value Range** preserves relative shape, not absolute values.
- The current **React Dashboard** exposes **Value Range** editing for the **Color Temperature Curve** only, but the concept applies to any **Lighting Curve**.
- A **Curve Shape** should be smooth, pass through every **Lighting Curve Control Point**, and stay within the **Value Range**.
- The exact interpolation algorithm is an implementation detail unless it becomes a user-facing choice.
- The **React Dashboard** preview and Home Assistant runtime must evaluate the same **Lighting Plan** into the same **Lighting State** for the same time and sun context.
- Preview/runtime parity is a production-readiness gate for **Enhanced Mode**, not a blocker for local prototype saves during development.
- If changing sun times would make a **Saved Lighting Plan** invalid for a date or location, evaluation should use **Seasonal Clipping** to preserve **Plan Validity**.
- **Seasonal Clipping** affects only the evaluated **Lighting State**, not the **Saved Lighting Plan** or **Lighting Plan Draft**.
- The **React Dashboard** should render clipped evaluated positions when **Seasonal Clipping** affects the displayed date or location.
- Draggable handles in the **React Dashboard** represent **Lighting Plan Draft** intent.
- Clipped evaluated positions should be rendered as secondary indicators when they differ from draft intent.
- The **Color Mode Window** has its own **Plan Validity** constraints.
- **Seasonal Clipping** may preserve the evaluated **Color Mode Window** independently of Lighting Curve Control Point clipping.

## Example dialogue

> **Dev:** "Does enabling **Enhanced Mode** mean the **React Dashboard** is open?"
> **Domain expert:** "No - **Enhanced Mode** is the lighting behavior; the **React Dashboard** is only the editing surface."
>
> **Dev:** "When I save a **Lighting Plan**, am I saving only the **Brightness Curve**?"
> **Domain expert:** "No - a **Lighting Plan** includes both curves, timing link behavior, and the **Color Mode Window**."
>
> **Dev:** "If **Linked Timing** is on, does dragging brightness from 80% to 60% lower the **Color Temperature Curve** too?"
> **Domain expert:** "No - **Linked Timing** shares control-point times only; each curve keeps independent values."
>
> **Dev:** "Can the **React Dashboard** be the source of truth for a **Saved Lighting Plan**?"
> **Domain expert:** "No - Home Assistant owns the **Saved Lighting Plan**; the **React Dashboard** only owns the current **Lighting Plan Draft**."
>
> **Dev:** "Should we call the draft-to-saved action apply?"
> **Domain expert:** "No - `adaptive_lighting.apply` already means applying current settings to lights on demand. Use **Save Lighting Plan**."
>
> **Dev:** "After **Save Lighting Plan**, can the dashboard immediately mark the draft saved?"
> **Domain expert:** "No - Home Assistant confirmation is authoritative."
>
> **Dev:** "Does **Save Lighting Plan** send only the changed control point?"
> **Domain expert:** "No - it sends the complete **Lighting Plan** for the **Selected Adaptive Lighting Instance**."
>
> **Dev:** "Should **Save Lighting Plan** persist clipped evaluated positions?"
> **Domain expert:** "No - saving preserves intent, not evaluated output."
>
> **Dev:** "If Home Assistant clamps a saved point, should the dashboard still show my original draft as saved?"
> **Domain expert:** "No - refresh from the normalized **Saved Lighting Plan** and surface that confirmation changed the plan."
>
> **Dev:** "If Home Assistant receives a changed **Saved Lighting Plan** while I am editing, should my **Lighting Plan Draft** reset?"
> **Domain expert:** "No - do not silently overwrite an active draft; surface the saved-plan change as staleness or conflict."
>
> **Dev:** "Does the current **React Dashboard** edit several profiles?"
> **Domain expert:** "No - it edits one active **Lighting Plan**. Profiles are a future layer above that model."
>
> **Dev:** "Is an **Adaptive Lighting Instance** just one light?"
> **Domain expert:** "No - it is one configured controller that may control zero, one, or many Home Assistant lights."
>
> **Dev:** "If Home Assistant has several **Adaptive Lighting Instances**, should the **React Dashboard** silently pick one?"
> **Domain expert:** "No - the user should choose the **Selected Adaptive Lighting Instance**. Silent auto-selection is only a temporary fallback."
>
> **Dev:** "Can two **Adaptive Lighting Instances** share the same **Saved Lighting Plan**?"
> **Domain expert:** "Not in the current model - a **Saved Lighting Plan** belongs to exactly one **Adaptive Lighting Instance**. Reusable plans are future scope."
>
> **Dev:** "If I save a **Lighting Plan** for an instance using the default brightness mode, is it still default mode?"
> **Domain expert:** "No - saving a **Lighting Plan** opts the **Selected Adaptive Lighting Instance** into **Enhanced Mode**."
>
> **Dev:** "When enabling **Enhanced Mode**, should the dashboard ignore the instance's existing brightness and color temperature ranges?"
> **Domain expert:** "No - seed the initial **Lighting Plan Draft** from existing settings where possible."
>
> **Dev:** "Is the first **Lighting Plan Draft** for a non-enhanced instance just generic defaults?"
> **Domain expert:** "No - it is an **Enhanced Mode Seed** derived from that instance's existing settings where possible."
>
> **Dev:** "Is the current brightness value part of the **Lighting Plan**?"
> **Domain expert:** "No - it is part of the **Lighting State** calculated from the **Lighting Plan**."
>
> **Dev:** "Does a **Lighting State** say exactly which `light.turn_on` payload to send?"
> **Domain expert:** "No - the Home Assistant integration translates **Lighting State** into light commands."
>
> **Dev:** "If **Evening Start** is 30 minutes before sunset, does the **Lighting Plan** store today's sunset time?"
> **Domain expert:** "No - the **Lighting Plan** stores a **Sun Anchor** and offset; the actual sunset time comes from the **Adaptive Lighting Instance** context."
>
> **Dev:** "Is 23:00 the same kind of time as 30 minutes before sunset?"
> **Domain expert:** "No - 23:00 is **Clock Time**; 30 minutes before sunset is **Sun-Relative Time**."
>
> **Dev:** "Can **Peak** or **Valley** be tied to sunrise or sunset?"
> **Domain expert:** "Yes - all six **Lighting Curve Control Points** may use **Sun-Relative Time**, though persistence for **Peak** and **Valley** still needs to be completed."
>
> **Dev:** "If seasonal sunrise/sunset changes would make a **Saved Lighting Plan** invalid, should we reject the plan?"
> **Domain expert:** "No - prevent invalid edits in the UI, but use **Seasonal Clipping** during evaluation when sun times change."
>
> **Dev:** "If **Seasonal Clipping** changes what happens today, should the saved point move?"
> **Domain expert:** "No - the saved plan stays the same, but the **React Dashboard** should render the clipped evaluated position."
>
> **Dev:** "Should a clipped control point replace the draggable handle?"
> **Domain expert:** "No - the handle represents draft intent; clipped evaluated positions are secondary indicators."
>
> **Dev:** "If **Linked Timing** is enabled, can **Seasonal Clipping** move only the **Brightness Curve** timing?"
> **Domain expert:** "No - linked curves should keep shared evaluated timing. Unlinked curves may clip independently."
>
> **Dev:** "Does the **Color Mode Window** clip only because nearby curve points clipped?"
> **Domain expert:** "No - the **Color Mode Window** has its own validity rules and can clip independently."
>
> **Dev:** "Can a **Lighting Curve** make **Valley** brighter than **Peak**?"
> **Domain expert:** "No - **Plan Validity** preserves the daytime-to-nighttime value hierarchy."
>
> **Dev:** "Does a high **Color Temperature Curve** value mean more light?"
> **Domain expert:** "No - it means cooler color temperature in Kelvin."
>
> **Dev:** "Is changing the Kelvin min/max only changing the chart scale?"
> **Domain expert:** "No - it changes the **Color Temperature Curve's** **Value Range** and remaps existing values."
>
> **Dev:** "If a point is halfway through the old **Value Range**, does it keep the same Kelvin value after the range changes?"
> **Domain expert:** "No - it stays halfway through the new **Value Range**."
>
> **Dev:** "Should domain docs say this uses Catmull-Rom?"
> **Domain expert:** "No - the domain concept is **Curve Shape**. The interpolation algorithm is implementation detail unless exposed to users."
>
> **Dev:** "Can the **React Dashboard** preview use a slightly different **Curve Shape** than Home Assistant runtime?"
> **Domain expert:** "No - preview and runtime must evaluate the same **Lighting Plan** into the same **Lighting State**."
>
> **Dev:** "Should local prototype saves be blocked until preview/runtime parity fixtures exist?"
> **Domain expert:** "No - but parity is required before treating **Enhanced Mode** as production-ready."

## Flagged ambiguities

- "enhanced mode" was used to mean both the backend lighting behavior and the React editing surface. Resolved: **Enhanced Mode** is the lighting behavior; **React Dashboard** is the editing surface.
- "curves" and `CurveSet` were used for the complete editable configuration. Resolved: **Lighting Plan** is the domain term for the full configuration.
- "curve" was used both for the shared shape and for specific brightness/color-temperature schedules. Resolved: **Lighting Curve** is the shared shape; **Brightness Curve** and **Color Temperature Curve** are unit-specific Lighting Curves.
- P1/P2/P4/P5 names were used for editable points. Resolved: use **Evening Start**, **Night Hold Start**, **Night Hold End**, and **Morning End** in domain language.
- "linked" could mean linked timing or linked values. Resolved: **Linked Timing** links control-point times only.
- The **Color Mode Window** exists in the React Dashboard but is not fully persisted through the Home Assistant Enhanced Mode settings yet.
- `CurveSet` in React state was used for both draft and saved configuration. Resolved: use **Lighting Plan Draft** for local edits and **Saved Lighting Plan** for Home Assistant state.
- "publish" implied making something public, and "apply" conflicts with an existing Home Assistant service. Resolved: use **Save Lighting Plan** for the draft-to-saved action.
- Optimistic save status could conflict with Home Assistant failures or normalization. Resolved: saved status comes from Home Assistant confirmation.
- Patch-style saves were considered. Resolved: **Save Lighting Plan** replaces the complete saved plan.
- Evaluated or clipped values could accidentally become persisted intent. Resolved: **Save Lighting Plan** saves intent only.
- Home Assistant may reject or normalize a save. Resolved: rejected saves keep the draft with an error; accepted normalized saves refresh the draft from confirmed saved state.
- Home Assistant updates during editing could be mistaken for authoritative resets. Resolved: active **Lighting Plan Drafts** must not be silently overwritten by external **Saved Lighting Plan** changes.
- Planning docs mention profiles, but the current implementation has no profile model. Resolved: profile support is future scope above the current **Lighting Plan** model.
- "switch", "group", and "profile" were all considered for the selected Home Assistant target. Resolved: use **Adaptive Lighting Instance** because the target is a configured controller, not a light group or future profile.
- The code currently auto-selects the first enhanced switch entity. Resolved: this is a temporary fallback; the domain term is **Selected Adaptive Lighting Instance**.
- Reusable plans across instances are not part of the current implementation. Resolved: a **Saved Lighting Plan** belongs to exactly one **Adaptive Lighting Instance**.
- Saving currently sends `brightness_mode: "enhanced"`. Resolved: saving a **Lighting Plan** opts the **Selected Adaptive Lighting Instance** into **Enhanced Mode** and should be made explicit when it changes behavior.
- The backend setting is currently named `brightness_mode`, but **Enhanced Mode** is not brightness-only; it governs both brightness and color temperature through the **Lighting Plan**.
- Opting an existing instance into **Enhanced Mode** could discard prior settings. Resolved: seed the initial **Lighting Plan Draft** from existing settings where possible.
- The initial draft for non-enhanced instances could be mistaken for fallback defaults. Resolved: model it as a deterministic **Enhanced Mode Seed**.
- "resolved curve" and "sample" are implementation terms for calculated values. Resolved: use **Lighting State** for output at a specific time.
- Actual `light.turn_on` payloads include device and integration concerns. Resolved: **Lighting State** is conceptual output only.
- Sunrise/sunset can mean either a saved reference or today's actual time. Resolved: **Sun Anchor** is the saved reference; actual sun times are evaluation context.
- "absolute" and "relative" were implementation-oriented timing labels. Resolved: use **Clock Time** and **Sun-Relative Time** in domain language.
- The React model supports Sun-Relative Time for Peak and Valley, but the Home Assistant enhanced curve dict currently persists only their resolved hours. Resolved: all six **Lighting Curve Control Points** may use **Sun-Relative Time**; Peak/Valley persistence is an implementation gap.
- Invalid plans can come from direct user edits or from changing sun times. Resolved: the UI prevents invalid edits, while **Seasonal Clipping** preserves **Plan Validity** when sun times change.
- **Seasonal Clipping** could be mistaken for mutating saved intent. Resolved: clipping affects evaluated **Lighting State** only, while the **React Dashboard** renders clipped evaluated positions when relevant.
- Rendered clipped positions could be mistaken for saved edits. Resolved: draggable handles show **Lighting Plan Draft** intent; clipped evaluated positions use secondary indicators.
- **Seasonal Clipping** could drift linked curves apart. Resolved: preserve shared evaluated timing while **Linked Timing** is enabled.
- **Color Mode Window** clipping could be conflated with Lighting Curve clipping. Resolved: it has its own **Plan Validity** constraints and may clip independently.
- Non-monotonic value shapes were considered. Resolved: **Lighting Curves** preserve a daytime-to-nighttime value hierarchy.
- The shared value hierarchy applies to both curves, but the unit meaning differs. Resolved: brightness values mean intensity; color temperature values mean Kelvin warmth/coolness.
- Min/max value editing could be mistaken for chart display scaling. Resolved: **Value Range** is part of the **Lighting Curve** and remaps control-point values when changed.
- **Value Range** changes could preserve absolute values or relative shape. Resolved: preserve relative shape.
- Interpolation names appeared in planning docs and code. Resolved: use **Curve Shape** in domain language and keep algorithm names as implementation details.
- Preview/runtime drift would make the **React Dashboard** misleading. Resolved: preview and runtime evaluation must match for the same **Lighting Plan** and sun context.
- Preview/runtime parity is not fully proven yet. Resolved: keep development saves possible, but treat parity fixtures as a production-readiness gate.
