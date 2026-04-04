"""Tests for enhanced_timing module."""

from homeassistant.components.adaptive_lighting.enhanced_timing import (
    catmull_rom,
    elapsed_hours,
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
