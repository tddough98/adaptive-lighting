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


@dataclass(frozen=True)
class ResolvedColorModeWindow:
    """Resolved Color Mode Window boundaries in absolute decimal hours."""

    color_temp_start: float
    color_temp_end: float


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


@dataclass(frozen=True)
class CurveConfig:
    """Configuration for a single enhanced curve (brightness or color temp).

    Each timing point can be relative (offset in minutes from a sun anchor)
    or absolute (decimal hour 0-24).
    """

    transition_start_offset: float
    transition_start_is_relative: bool
    transition_start_anchor: str
    transition_start_value: float

    hold_start_hour: float
    hold_start_is_relative: bool
    hold_start_anchor: str
    hold_start_value: float

    hold_end_hour: float
    hold_end_is_relative: bool
    hold_end_anchor: str
    hold_end_value: float

    transition_end_offset: float
    transition_end_is_relative: bool
    transition_end_anchor: str
    transition_end_value: float

    peak_hour: float
    peak_value: float
    valley_hour: float
    valley_value: float

    min_value: float
    max_value: float

    peak_is_relative: bool = False
    peak_anchor: str = ""
    peak_offset_minutes: float = 0
    valley_is_relative: bool = False
    valley_anchor: str = ""
    valley_offset_minutes: float = 0

    @staticmethod
    def _resolve_point(
        raw_value: float,
        is_relative: bool,
        anchor: str,
        sunset_hour: float,
        sunrise_hour: float,
    ) -> float:
        if not is_relative:
            return raw_value
        base = sunset_hour if anchor == "sunset" else sunrise_hour
        hour = base + raw_value / 60
        if hour < 0:
            hour += 24
        if hour >= 24:
            hour -= 24
        return hour

    def resolve(self, sunset_hour: float, sunrise_hour: float) -> ResolvedCurve:
        """Resolve sun-relative timing points to absolute decimal hours."""
        rp = self._resolve_point
        return ResolvedCurve(
            transition_start=rp(self.transition_start_offset, self.transition_start_is_relative, self.transition_start_anchor, sunset_hour, sunrise_hour),
            hold_start=rp(self.hold_start_hour, self.hold_start_is_relative, self.hold_start_anchor, sunset_hour, sunrise_hour),
            hold_end=rp(self.hold_end_hour, self.hold_end_is_relative, self.hold_end_anchor, sunset_hour, sunrise_hour),
            transition_end=rp(self.transition_end_offset, self.transition_end_is_relative, self.transition_end_anchor, sunset_hour, sunrise_hour),
            transition_start_value=self.transition_start_value,
            hold_start_value=self.hold_start_value,
            hold_end_value=self.hold_end_value,
            transition_end_value=self.transition_end_value,
            peak_hour=rp(
                self.peak_offset_minutes,
                self.peak_is_relative,
                self.peak_anchor,
                sunset_hour,
                sunrise_hour,
            )
            if self.peak_is_relative
            else self.peak_hour,
            peak_value=self.peak_value,
            valley_hour=rp(
                self.valley_offset_minutes,
                self.valley_is_relative,
                self.valley_anchor,
                sunset_hour,
                sunrise_hour,
            )
            if self.valley_is_relative
            else self.valley_hour,
            valley_value=self.valley_value,
            min_value=self.min_value,
            max_value=self.max_value,
        )


@dataclass(frozen=True)
class EnhancedColorModeConfig:
    """Saved enhanced color-mode intent.

    Inside the resolved window, enhanced mode sends color temperature. Outside
    the window it sends the configured sleep RGB color.
    """

    color_temp_start_hour: float | None = None
    color_temp_end_hour: float | None = None
    start_offset_minutes: float = 0
    end_offset_minutes: float = 0
    sleep_rgb_color: tuple[int, int, int] = (255, 56, 0)

    @staticmethod
    def _normalize_hour(hour: float) -> float:
        return hour % 24

    def resolve(self, sunset_hour: float, sunrise_hour: float) -> ResolvedColorModeWindow:
        """Resolve the Color Mode Window boundaries to absolute decimal hours."""
        start = (
            sunrise_hour + self.start_offset_minutes / 60
            if self.color_temp_start_hour is None
            else self.color_temp_start_hour
        )
        end = (
            sunset_hour + self.end_offset_minutes / 60
            if self.color_temp_end_hour is None
            else self.color_temp_end_hour
        )
        return ResolvedColorModeWindow(
            color_temp_start=self._normalize_hour(start),
            color_temp_end=self._normalize_hour(end),
        )

    def uses_color_temp(
        self,
        hour: float,
        sunset_hour: float,
        sunrise_hour: float,
    ) -> bool:
        """Return whether enhanced mode should emit color temperature at this hour."""
        resolved = self.resolve(sunset_hour, sunrise_hour)
        return is_in_arc(hour, resolved.color_temp_start, resolved.color_temp_end)
