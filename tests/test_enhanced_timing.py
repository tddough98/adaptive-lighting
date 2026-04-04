"""Tests for enhanced_timing module."""

import pytest

from homeassistant.components.adaptive_lighting.enhanced_timing import (
    ResolvedCurve,
    calculate_value_at_hour,
    catmull_rom,
    elapsed_hours,
    get_phase,
    is_in_arc,
)


class TestIsInArc:
    """Test midnight-wrapping arc containment."""

    def test_simple_arc(self):
        assert is_in_arc(10.0, 8.0, 12.0) is True

    def test_outside_simple_arc(self):
        assert is_in_arc(7.0, 8.0, 12.0) is False

    def test_wrapping_arc_before_midnight(self):
        assert is_in_arc(23.0, 22.0, 2.0) is True

    def test_wrapping_arc_after_midnight(self):
        assert is_in_arc(1.0, 22.0, 2.0) is True

    def test_outside_wrapping_arc(self):
        assert is_in_arc(12.0, 22.0, 2.0) is False

    def test_at_start_boundary(self):
        assert is_in_arc(8.0, 8.0, 12.0) is True

    def test_at_end_boundary(self):
        assert is_in_arc(12.0, 8.0, 12.0) is False


class TestElapsedHours:
    """Test elapsed time calculation with midnight wrap."""

    def test_same_day(self):
        assert elapsed_hours(8.0, 12.0) == 4.0

    def test_wraps_midnight(self):
        assert elapsed_hours(22.0, 2.0) == 4.0

    def test_zero_duration(self):
        assert elapsed_hours(5.0, 5.0) == 0.0


class TestCatmullRom:
    """Test uniform Catmull-Rom spline evaluation."""

    def test_at_t0_returns_p1(self):
        assert catmull_rom(0.0, 10, 50, 90, 130) == 50.0

    def test_at_t1_returns_p2(self):
        assert catmull_rom(1.0, 10, 50, 90, 130) == 90.0

    def test_midpoint_linear_data(self):
        result = catmull_rom(0.5, 0, 25, 50, 75)
        assert result == 37.5

    def test_produces_smooth_curve(self):
        result = catmull_rom(0.5, 100, 100, 1, 1)
        assert 40.0 < result < 60.0


class TestGetPhase:
    """Default resolved points (sunset=18.75, sunrise=6.5):
      transition_start=18.25, hold_start=23.0, valley=2.0,
      hold_end=5.5, transition_end=7.0, peak=13.0
    """

    TS = 18.25   # transition_start
    HS = 23.0    # hold_start
    VL = 2.0     # valley
    HE = 5.5     # hold_end
    TE = 7.0     # transition_end
    PK = 13.0    # peak

    def test_evening_transition(self):
        assert get_phase(20.0, self.TS, self.HS, self.VL, self.HE, self.TE, self.PK) == "evening_transition"

    def test_descent_to_valley(self):
        assert get_phase(23.5, self.TS, self.HS, self.VL, self.HE, self.TE, self.PK) == "descent_to_valley"

    def test_descent_to_valley_after_midnight(self):
        assert get_phase(1.0, self.TS, self.HS, self.VL, self.HE, self.TE, self.PK) == "descent_to_valley"

    def test_ascent_from_valley(self):
        assert get_phase(4.0, self.TS, self.HS, self.VL, self.HE, self.TE, self.PK) == "ascent_from_valley"

    def test_morning_transition(self):
        assert get_phase(6.0, self.TS, self.HS, self.VL, self.HE, self.TE, self.PK) == "morning_transition"

    def test_ascent_to_peak(self):
        assert get_phase(10.0, self.TS, self.HS, self.VL, self.HE, self.TE, self.PK) == "ascent_to_peak"

    def test_descent_from_peak(self):
        assert get_phase(15.0, self.TS, self.HS, self.VL, self.HE, self.TE, self.PK) == "descent_from_peak"

    def test_at_transition_start_boundary(self):
        assert get_phase(18.25, self.TS, self.HS, self.VL, self.HE, self.TE, self.PK) == "evening_transition"


DEFAULT_BRIGHTNESS = ResolvedCurve(
    transition_start=18.25,
    hold_start=23.0,
    hold_end=5.5,
    transition_end=7.0,
    transition_start_value=100.0,
    hold_start_value=1.0,
    hold_end_value=1.0,
    transition_end_value=100.0,
    peak_hour=13.0,
    peak_value=100.0,
    valley_hour=2.0,
    valley_value=1.0,
    min_value=1.0,
    max_value=100.0,
)


class TestCalculateValueAtHour:
    def test_at_peak(self):
        assert calculate_value_at_hour(13.0, DEFAULT_BRIGHTNESS) == 100.0

    def test_at_valley(self):
        assert calculate_value_at_hour(2.0, DEFAULT_BRIGHTNESS) == 1.0

    def test_at_transition_start(self):
        assert calculate_value_at_hour(18.25, DEFAULT_BRIGHTNESS) == 100.0

    def test_at_hold_start(self):
        assert calculate_value_at_hour(23.0, DEFAULT_BRIGHTNESS) == 1.0

    def test_evening_transition_midway(self):
        result = calculate_value_at_hour(20.0, DEFAULT_BRIGHTNESS)
        assert 60.0 < result < 75.0

    def test_evening_transition_late(self):
        result = calculate_value_at_hour(22.0, DEFAULT_BRIGHTNESS)
        assert 10.0 < result < 25.0

    def test_clamped_to_max(self):
        assert calculate_value_at_hour(15.0, DEFAULT_BRIGHTNESS) <= 100.0

    def test_clamped_to_min(self):
        assert calculate_value_at_hour(4.0, DEFAULT_BRIGHTNESS) >= 1.0

    def test_monotonic_evening_transition(self):
        values = [calculate_value_at_hour(h, DEFAULT_BRIGHTNESS) for h in [18.5, 19.5, 20.5, 21.5, 22.5]]
        for i in range(len(values) - 1):
            assert values[i] >= values[i + 1], f"Not monotonic at index {i}: {values}"
