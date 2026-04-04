"""Enhanced 6-segment timing model for adaptive lighting.

Implements cyclic Catmull-Rom spline interpolation matching the React panel's
curvemath.ts exactly. The 24-hour cycle is divided into 6 phases defined by
6 control points: transition_start, hold_start, valley, hold_end,
transition_end, peak.
"""

from __future__ import annotations


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
