"""Enhanced 6-segment timing model for adaptive lighting.

Implements cyclic Catmull-Rom spline interpolation matching the React panel's
curvemath.ts exactly. The 24-hour cycle is divided into 6 phases defined by
6 control points: transition_start, hold_start, valley, hold_end,
transition_end, peak.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

CurvePhase = Literal[
    "evening_transition",
    "descent_to_valley",
    "ascent_from_valley",
    "morning_transition",
    "ascent_to_peak",
    "descent_from_peak",
]


def is_in_arc(hour: float, start: float, end: float) -> bool:
    """Check if hour is within the arc from start to end (handles midnight wrap).

    Start is inclusive, end is exclusive.
    """
    if start <= end:
        return hour >= start and hour < end
    return hour >= start or hour < end


def elapsed_hours(from_hour: float, to_hour: float) -> float:
    """Elapsed hours between two times, handling midnight wrap."""
    return to_hour - from_hour if to_hour >= from_hour else to_hour + 24 - from_hour


def catmull_rom(t: float, p0: float, p1: float, p2: float, p3: float) -> float:
    """Uniform Catmull-Rom spline at parameter t in [0,1] with 4 control point values."""
    return 0.5 * (
        (2 * p1)
        + (-p0 + p2) * t
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
        + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
    )


def get_phase(
    hour: float,
    transition_start: float,
    hold_start: float,
    valley_hour: float,
    hold_end: float,
    transition_end: float,
    peak_hour: float,
) -> CurvePhase:
    """Determine which of the 6 phases a given hour falls in."""
    if is_in_arc(hour, transition_start, hold_start):
        return "evening_transition"
    if is_in_arc(hour, hold_start, valley_hour):
        return "descent_to_valley"
    if is_in_arc(hour, valley_hour, hold_end):
        return "ascent_from_valley"
    if is_in_arc(hour, hold_end, transition_end):
        return "morning_transition"
    if is_in_arc(hour, transition_end, peak_hour):
        return "ascent_to_peak"
    return "descent_from_peak"


@dataclass(frozen=True)
class ResolvedCurve:
    """All timing points resolved to absolute decimal hours with their values."""

    transition_start: float
    hold_start: float
    hold_end: float
    transition_end: float
    transition_start_value: float
    hold_start_value: float
    hold_end_value: float
    transition_end_value: float
    peak_hour: float
    peak_value: float
    valley_hour: float
    valley_value: float
    min_value: float
    max_value: float


def calculate_value_at_hour(hour: float, resolved: ResolvedCurve) -> float:
    """Calculate the curve value (brightness % or color temp K) at a given hour.

    Uses cyclic Catmull-Rom interpolation across 6 segments.
    Points in cyclic order: transition_start, hold_start, valley, hold_end,
    transition_end, peak.
    """
    phase = get_phase(
        hour,
        resolved.transition_start,
        resolved.hold_start,
        resolved.valley_hour,
        resolved.hold_end,
        resolved.transition_end,
        resolved.peak_hour,
    )

    ts_val = resolved.transition_start_value
    hs_val = resolved.hold_start_value
    he_val = resolved.hold_end_value
    te_val = resolved.transition_end_value
    pk_val = resolved.peak_value
    vl_val = resolved.valley_value

    if phase == "evening_transition":
        duration = elapsed_hours(resolved.transition_start, resolved.hold_start)
        t = elapsed_hours(resolved.transition_start, hour) / duration if duration > 0 else 0
        raw = catmull_rom(t, pk_val, ts_val, hs_val, vl_val)
    elif phase == "descent_to_valley":
        duration = elapsed_hours(resolved.hold_start, resolved.valley_hour)
        t = elapsed_hours(resolved.hold_start, hour) / duration if duration > 0 else 0
        raw = catmull_rom(t, ts_val, hs_val, vl_val, he_val)
    elif phase == "ascent_from_valley":
        duration = elapsed_hours(resolved.valley_hour, resolved.hold_end)
        t = elapsed_hours(resolved.valley_hour, hour) / duration if duration > 0 else 0
        raw = catmull_rom(t, hs_val, vl_val, he_val, te_val)
    elif phase == "morning_transition":
        duration = elapsed_hours(resolved.hold_end, resolved.transition_end)
        t = elapsed_hours(resolved.hold_end, hour) / duration if duration > 0 else 0
        raw = catmull_rom(t, vl_val, he_val, te_val, pk_val)
    elif phase == "ascent_to_peak":
        duration = elapsed_hours(resolved.transition_end, resolved.peak_hour)
        t = elapsed_hours(resolved.transition_end, hour) / duration if duration > 0 else 0
        raw = catmull_rom(t, he_val, te_val, pk_val, ts_val)
    else:  # descent_from_peak
        duration = elapsed_hours(resolved.peak_hour, resolved.transition_start)
        t = elapsed_hours(resolved.peak_hour, hour) / duration if duration > 0 else 0
        raw = catmull_rom(t, te_val, pk_val, ts_val, hs_val)

    return max(resolved.min_value, min(resolved.max_value, raw))
