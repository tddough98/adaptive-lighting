"""Tests for enhanced_timing module."""

import json
from pathlib import Path

import pytest

from homeassistant.components.adaptive_lighting.enhanced_timing import (
    CurveConfig,
    EnhancedColorModeConfig,
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


def _default_brightness_config() -> CurveConfig:
    return CurveConfig(
        transition_start_offset=-30,
        transition_start_is_relative=True,
        transition_start_anchor="sunset",
        transition_start_value=100.0,
        hold_start_hour=23.0,
        hold_start_is_relative=False,
        hold_start_anchor="",
        hold_start_value=1.0,
        hold_end_hour=5.5,
        hold_end_is_relative=False,
        hold_end_anchor="",
        hold_end_value=1.0,
        transition_end_offset=30,
        transition_end_is_relative=True,
        transition_end_anchor="sunrise",
        transition_end_value=100.0,
        peak_hour=13.0,
        peak_value=100.0,
        valley_hour=2.0,
        valley_value=1.0,
        min_value=1.0,
        max_value=100.0,
    )


class TestCurveConfig:
    def test_resolve_relative_transition_start(self):
        resolved = _default_brightness_config().resolve(sunset_hour=18.75, sunrise_hour=6.5)
        assert resolved.transition_start == pytest.approx(18.25)

    def test_resolve_relative_transition_end(self):
        resolved = _default_brightness_config().resolve(sunset_hour=18.75, sunrise_hour=6.5)
        assert resolved.transition_end == pytest.approx(7.0)

    def test_resolve_absolute_hold_start(self):
        resolved = _default_brightness_config().resolve(sunset_hour=18.75, sunrise_hour=6.5)
        assert resolved.hold_start == 23.0

    def test_resolve_wraps_past_midnight(self):
        resolved = _default_brightness_config().resolve(sunset_hour=23.8, sunrise_hour=0.25)
        assert resolved.transition_start == pytest.approx(23.3)
        assert resolved.transition_end == pytest.approx(0.75)

    def test_resolve_wraps_negative(self):
        cfg = CurveConfig(
            transition_start_offset=-120,
            transition_start_is_relative=True,
            transition_start_anchor="sunset",
            transition_start_value=100.0,
            hold_start_hour=23.0, hold_start_is_relative=False, hold_start_anchor="", hold_start_value=1.0,
            hold_end_hour=5.5, hold_end_is_relative=False, hold_end_anchor="", hold_end_value=1.0,
            transition_end_offset=30, transition_end_is_relative=True, transition_end_anchor="sunrise", transition_end_value=100.0,
            peak_hour=13.0, peak_value=100.0, valley_hour=2.0, valley_value=1.0,
            min_value=1.0, max_value=100.0,
        )
        resolved = cfg.resolve(sunset_hour=1.0, sunrise_hour=6.5)
        assert resolved.transition_start == pytest.approx(23.0)

    def test_resolve_preserves_values(self):
        resolved = _default_brightness_config().resolve(sunset_hour=18.75, sunrise_hour=6.5)
        assert resolved.transition_start_value == 100.0
        assert resolved.hold_start_value == 1.0
        assert resolved.hold_end_value == 1.0
        assert resolved.transition_end_value == 100.0
        assert resolved.peak_value == 100.0
        assert resolved.valley_value == 1.0

    def test_resolve_peak_and_valley_sun_relative(self):
        cfg = _default_brightness_config()
        relative = CurveConfig(
            **{
                **cfg.__dict__,
                "peak_is_relative": True,
                "peak_anchor": "sunrise",
                "peak_offset_minutes": 390,
                "valley_is_relative": True,
                "valley_anchor": "sunset",
                "valley_offset_minutes": 480,
            },
        )
        resolved = relative.resolve(sunset_hour=18.75, sunrise_hour=6.5)
        assert resolved.peak_hour == pytest.approx(13.0)
        assert resolved.valley_hour == pytest.approx(2.75)


class TestEnhancedColorModeConfig:
    def test_resolves_sun_relative_window(self):
        config = EnhancedColorModeConfig(
            color_temp_start_hour=None,
            color_temp_end_hour=None,
            start_offset_minutes=30,
            end_offset_minutes=-45,
            sleep_rgb_color=(1, 2, 3),
        )

        resolved = config.resolve(sunset_hour=18.75, sunrise_hour=6.5)

        assert resolved.color_temp_start == pytest.approx(7.0)
        assert resolved.color_temp_end == pytest.approx(18.0)

    def test_uses_color_temp_inside_window(self):
        config = EnhancedColorModeConfig(
            color_temp_start_hour=8,
            color_temp_end_hour=18,
            sleep_rgb_color=(1, 2, 3),
        )

        assert config.uses_color_temp(12, sunset_hour=18.75, sunrise_hour=6.5) is True
        assert config.uses_color_temp(20, sunset_hour=18.75, sunrise_hour=6.5) is False

    def test_wraps_out_of_range_relative_boundaries(self):
        config = EnhancedColorModeConfig(
            color_temp_start_hour=None,
            color_temp_end_hour=None,
            start_offset_minutes=-480,
            end_offset_minutes=0,
        )

        resolved = config.resolve(sunset_hour=18.75, sunrise_hour=6.5)

        assert resolved.color_temp_start == pytest.approx(22.5)
        assert config.uses_color_temp(23, sunset_hour=18.75, sunrise_hour=6.5) is True
        assert config.uses_color_temp(20, sunset_hour=18.75, sunrise_hour=6.5) is False


import datetime as dt
import zoneinfo

from astral import LocationInfo
from astral.location import Location

from homeassistant.components.adaptive_lighting.color_and_brightness import (
    SunLightSettings,
)


def _make_enhanced_settings() -> SunLightSettings:
    tz = zoneinfo.ZoneInfo("US/Eastern")
    location = Location(
        LocationInfo(name="Montvale", region="US", timezone="US/Eastern", latitude=41.0468, longitude=-74.0431),
    )
    brightness_curve = CurveConfig(
        transition_start_offset=-30, transition_start_is_relative=True,
        transition_start_anchor="sunset", transition_start_value=100.0,
        hold_start_hour=23.0, hold_start_is_relative=False, hold_start_anchor="", hold_start_value=1.0,
        hold_end_hour=5.5, hold_end_is_relative=False, hold_end_anchor="", hold_end_value=1.0,
        transition_end_offset=30, transition_end_is_relative=True,
        transition_end_anchor="sunrise", transition_end_value=100.0,
        peak_hour=13.0, peak_value=100.0, valley_hour=2.0, valley_value=1.0,
        min_value=1.0, max_value=100.0,
    )
    color_temp_curve = CurveConfig(
        transition_start_offset=-30, transition_start_is_relative=True,
        transition_start_anchor="sunset", transition_start_value=5500.0,
        hold_start_hour=23.0, hold_start_is_relative=False, hold_start_anchor="", hold_start_value=2000.0,
        hold_end_hour=5.5, hold_end_is_relative=False, hold_end_anchor="", hold_end_value=2000.0,
        transition_end_offset=30, transition_end_is_relative=True,
        transition_end_anchor="sunrise", transition_end_value=5500.0,
        peak_hour=13.0, peak_value=5500.0, valley_hour=2.0, valley_value=2000.0,
        min_value=2000.0, max_value=5500.0,
    )
    return SunLightSettings(
        name="test", astral_location=location, adapt_until_sleep=False,
        max_brightness=100, max_color_temp=5500, min_brightness=1, min_color_temp=2000,
        sleep_brightness=1, sleep_color_temp=1000, sleep_rgb_color=(255, 56, 0),
        sleep_rgb_or_color_temp="color_temp",
        sunrise_time=None, min_sunrise_time=None, max_sunrise_time=None,
        sunset_time=None, min_sunset_time=None, max_sunset_time=None,
        brightness_mode_time_dark=dt.timedelta(seconds=900),
        brightness_mode_time_light=dt.timedelta(seconds=3600),
        brightness_mode="enhanced", timezone=tz,
        enhanced_brightness_curve=brightness_curve,
        enhanced_color_temp_curve=color_temp_curve,
        enhanced_color_mode=EnhancedColorModeConfig(
            color_temp_start_hour=7.0,
            color_temp_end_hour=18.0,
            sleep_rgb_color=(12, 34, 56),
        ),
    )


class TestEnhancedSunLightSettings:
    def test_midday_brightness_is_high(self):
        settings = _make_enhanced_settings()
        noon = dt.datetime(2026, 6, 21, 12, 0, 0, tzinfo=zoneinfo.ZoneInfo("US/Eastern"))
        result = settings.brightness_and_color(noon, is_sleep=False)
        assert result["brightness_pct"] >= 95.0

    def test_midday_color_temp_is_cool(self):
        settings = _make_enhanced_settings()
        noon = dt.datetime(2026, 6, 21, 12, 0, 0, tzinfo=zoneinfo.ZoneInfo("US/Eastern"))
        result = settings.brightness_and_color(noon, is_sleep=False)
        assert result["color_temp_kelvin"] >= 5000

    def test_midnight_brightness_is_low(self):
        settings = _make_enhanced_settings()
        midnight = dt.datetime(2026, 6, 21, 2, 0, 0, tzinfo=zoneinfo.ZoneInfo("US/Eastern"))
        result = settings.brightness_and_color(midnight, is_sleep=False)
        assert result["brightness_pct"] <= 5.0

    def test_midnight_color_temp_is_warm(self):
        settings = _make_enhanced_settings()
        midnight = dt.datetime(2026, 6, 21, 2, 0, 0, tzinfo=zoneinfo.ZoneInfo("US/Eastern"))
        result = settings.brightness_and_color(midnight, is_sleep=False)
        assert result["color_temp_kelvin"] <= 2500

    def test_enhanced_color_mode_uses_sleep_rgb_outside_window(self):
        settings = _make_enhanced_settings()
        midnight = dt.datetime(2026, 6, 21, 2, 0, 0, tzinfo=zoneinfo.ZoneInfo("US/Eastern"))
        result = settings.brightness_and_color(midnight, is_sleep=False)
        assert result["rgb_color"] == (12, 34, 56)
        assert result["force_rgb_color"] is True

    def test_enhanced_color_mode_uses_color_temp_inside_window(self):
        settings = _make_enhanced_settings()
        noon = dt.datetime(2026, 6, 21, 12, 0, 0, tzinfo=zoneinfo.ZoneInfo("US/Eastern"))
        result = settings.brightness_and_color(noon, is_sleep=False)
        assert result["rgb_color"] != (12, 34, 56)
        assert result["force_rgb_color"] is False

    def test_sleep_mode_overrides_enhanced(self):
        settings = _make_enhanced_settings()
        noon = dt.datetime(2026, 6, 21, 12, 0, 0, tzinfo=zoneinfo.ZoneInfo("US/Eastern"))
        result = settings.brightness_and_color(noon, is_sleep=True)
        assert result["brightness_pct"] == 1

    def test_returns_all_expected_keys(self):
        settings = _make_enhanced_settings()
        noon = dt.datetime(2026, 6, 21, 12, 0, 0, tzinfo=zoneinfo.ZoneInfo("US/Eastern"))
        result = settings.brightness_and_color(noon, is_sleep=False)
        expected_keys = {"brightness_pct", "color_temp_kelvin", "color_temp_mired", "rgb_color", "xy_color", "hs_color", "sun_position", "force_rgb_color"}
        assert set(result.keys()) == expected_keys

    def test_backward_compatible_without_curves(self):
        tz = zoneinfo.ZoneInfo("US/Eastern")
        location = Location(
            LocationInfo(name="Test", region="US", timezone="US/Eastern", latitude=41.0, longitude=-74.0),
        )
        settings = SunLightSettings(
            name="test", astral_location=location, adapt_until_sleep=False,
            max_brightness=100, max_color_temp=5500, min_brightness=1, min_color_temp=2000,
            sleep_brightness=1, sleep_color_temp=1000, sleep_rgb_color=(255, 56, 0),
            sleep_rgb_or_color_temp="color_temp",
            sunrise_time=None, min_sunrise_time=None, max_sunrise_time=None,
            sunset_time=None, min_sunset_time=None, max_sunset_time=None,
            brightness_mode_time_dark=dt.timedelta(seconds=900),
            brightness_mode_time_light=dt.timedelta(seconds=3600),
            brightness_mode="default", timezone=tz,
        )
        noon = dt.datetime(2026, 6, 21, 12, 0, 0, tzinfo=tz)
        result = settings.brightness_and_color(noon, is_sleep=False)
        assert result["brightness_pct"] == 100


class TestCrossValidation:
    """Verify Python runtime math matches TypeScript reference data.

    The fixture includes raw Saved Lighting Plan intent plus TypeScript-resolved
    evaluation output. Python resolves raw curve and color-mode intent, then
    samples the resulting state. Seasonal clipping itself is currently
    TypeScript-only, so clipping scenarios compare Python sampling against the
    already-clipped evaluated fixture rather than asserting Python clipping.
    """

    @staticmethod
    def _load_reference_data() -> list[dict]:
        fixture_path = (
            Path(__file__).parent.parent
            / "panel"
            / "fixtures"
            / "lighting-plan-evaluation.json"
        )
        with fixture_path.open() as f:
            fixture = json.load(f)
        assert fixture["version"] == 4
        return fixture["scenarios"]

    @staticmethod
    def _resolved_curve_from_fixture(resolved_fixture: dict) -> ResolvedCurve:
        return ResolvedCurve(
            transition_start=resolved_fixture["p1"],
            hold_start=resolved_fixture["p2"],
            hold_end=resolved_fixture["p4"],
            transition_end=resolved_fixture["p5"],
            transition_start_value=resolved_fixture["p1Value"],
            hold_start_value=resolved_fixture["p2Value"],
            hold_end_value=resolved_fixture["p4Value"],
            transition_end_value=resolved_fixture["p5Value"],
            peak_hour=resolved_fixture["peakHour"],
            peak_value=resolved_fixture["peakValue"],
            valley_hour=resolved_fixture["valleyHour"],
            valley_value=resolved_fixture["valleyValue"],
            min_value=resolved_fixture["minValue"],
            max_value=resolved_fixture["maxValue"],
        )

    @staticmethod
    def _resolved_curve_from_raw(raw_curve: dict, sun_times: dict) -> ResolvedCurve:
        return CurveConfig(**raw_curve).resolve(
            sunset_hour=sun_times["sunsetHour"],
            sunrise_hour=sun_times["sunriseHour"],
        )

    @staticmethod
    def _with_timing(source: ResolvedCurve, timing: ResolvedCurve) -> ResolvedCurve:
        return ResolvedCurve(
            transition_start=timing.transition_start,
            hold_start=timing.hold_start,
            hold_end=timing.hold_end,
            transition_end=timing.transition_end,
            transition_start_value=source.transition_start_value,
            hold_start_value=source.hold_start_value,
            hold_end_value=source.hold_end_value,
            transition_end_value=source.transition_end_value,
            peak_hour=timing.peak_hour,
            peak_value=source.peak_value,
            valley_hour=timing.valley_hour,
            valley_value=source.valley_value,
            min_value=source.min_value,
            max_value=source.max_value,
        )

    @staticmethod
    def _assert_resolved_curve_matches(
        actual: ResolvedCurve,
        expected: ResolvedCurve,
        scenario_id: str,
        curve_name: str,
    ) -> None:
        for field in actual.__dataclass_fields__:
            assert getattr(actual, field) == pytest.approx(getattr(expected, field)), (
                f"{scenario_id} {curve_name} resolved {field} mismatch: "
                f"Python={getattr(actual, field)}, TS={getattr(expected, field)}"
            )

    def _resolved_curves_from_raw_intent(
        self,
        reference: dict,
    ) -> tuple[ResolvedCurve, ResolvedCurve]:
        raw_intent = reference["rawIntent"]
        sun_times = reference["sunTimes"]
        brightness = self._resolved_curve_from_raw(
            raw_intent["enhanced_brightness_curve"],
            sun_times,
        )
        color_temp = self._resolved_curve_from_raw(
            raw_intent["enhanced_color_temp_curve"],
            sun_times,
        )
        if raw_intent["enhanced_linked_timing"]:
            color_temp = self._with_timing(color_temp, brightness)
        return brightness, color_temp

    def test_raw_intent_resolves_to_typescript_evaluation(self):
        for reference in self._load_reference_data():
            if any(reference["clipping"].values()):
                continue
            brightness, color_temp = self._resolved_curves_from_raw_intent(reference)
            self._assert_resolved_curve_matches(
                brightness,
                self._resolved_curve_from_fixture(
                    reference["resolvedCurves"]["brightness"],
                ),
                reference["id"],
                "brightness",
            )
            self._assert_resolved_curve_matches(
                color_temp,
                self._resolved_curve_from_fixture(
                    reference["resolvedCurves"]["colorTemp"],
                ),
                reference["id"],
                "colorTemp",
            )

    def test_raw_color_mode_intent_resolves_to_typescript_evaluation(self):
        for reference in self._load_reference_data():
            if reference["clipping"]["colorModeWindow"]:
                continue
            raw_color_mode = reference["rawIntent"]["enhanced_color_mode"]
            actual = EnhancedColorModeConfig(**raw_color_mode).resolve(
                sunset_hour=reference["sunTimes"]["sunsetHour"],
                sunrise_hour=reference["sunTimes"]["sunriseHour"],
            )
            expected = reference["colorModeWindow"]
            assert actual.color_temp_start == pytest.approx(expected["startHour"])
            assert actual.color_temp_end == pytest.approx(expected["endHour"])

    def test_brightness_matches_typescript(self):
        for reference in self._load_reference_data():
            if any(reference["clipping"].values()):
                resolved = self._resolved_curve_from_fixture(
                    reference["resolvedCurves"]["brightness"],
                )
            else:
                resolved, _ = self._resolved_curves_from_raw_intent(reference)
            for sample in reference["samples"]:
                hour = sample["hour"]
                expected_brightness = sample["brightness"]
                actual = calculate_value_at_hour(hour, resolved)
                assert actual == pytest.approx(expected_brightness, abs=0.01), (
                    f"{reference['id']} brightness mismatch at hour {hour}: "
                    f"Python={actual}, TS={expected_brightness}"
                )

    def test_color_temp_matches_typescript(self):
        for reference in self._load_reference_data():
            if any(reference["clipping"].values()):
                resolved = self._resolved_curve_from_fixture(
                    reference["resolvedCurves"]["colorTemp"],
                )
            else:
                _, resolved = self._resolved_curves_from_raw_intent(reference)
            for sample in reference["samples"]:
                hour = sample["hour"]
                expected_ct = sample["colorTemp"]
                actual = calculate_value_at_hour(hour, resolved)
                assert actual == pytest.approx(expected_ct, abs=0.01), (
                    f"{reference['id']} color temp mismatch at hour {hour}: "
                    f"Python={actual}, TS={expected_ct}"
                )

    def test_color_preference_matches_typescript(self):
        for reference in self._load_reference_data():
            if reference["clipping"]["colorModeWindow"]:
                window = reference["colorModeWindow"]
                color_mode = EnhancedColorModeConfig(
                    color_temp_start_hour=window["startHour"],
                    color_temp_end_hour=window["endHour"],
                )
            else:
                color_mode = EnhancedColorModeConfig(
                    **reference["rawIntent"]["enhanced_color_mode"],
                )
            for sample in reference["samples"]:
                hour = sample["hour"]
                expected = sample["colorPreference"]
                actual = (
                    "colorTemp"
                    if color_mode.uses_color_temp(
                        hour,
                        sunset_hour=reference["sunTimes"]["sunsetHour"],
                        sunrise_hour=reference["sunTimes"]["sunriseHour"],
                    )
                    else "rgb"
                )
                assert actual == expected, (
                    f"{reference['id']} color preference mismatch at hour {hour}: "
                    f"Python={actual}, TS={expected}"
                )
