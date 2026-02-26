# Year Slider UI Specification

> **Version**: 1.0
> **Status**: Final

---

## Overview

The year slider allows users to scrub through any day of the year and see how sunrise/sunset times affect their lighting curves. This validates that settings work well in both summer (long days) and winter (short days).

---

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec    │
│    ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤     │
│    ○─────────────────────────●─────────────────────────────────────────○    │
│                              ↑                                              │
│                          Feb 3 (today)                                      │
│                                                                             │
│   Sunrise: 07:02    Sunset: 17:18    Day Length: 10h 16m                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### Slider Track

```typescript
interface YearSliderProps {
  latitude: number;          // User's location
  longitude: number;
  selectedDate: Date;        // Currently selected date
  onDateChange: (date: Date) => void;
  showSunInfo: boolean;      // Show sunrise/sunset below slider
}
```

### Visual Elements

1. **Track**: Full-width bar representing Jan 1 → Dec 31
2. **Month markers**: Tick marks or labels at month boundaries
3. **Handle**: Draggable circle showing current selection
4. **Today marker**: Small indicator showing actual current date
5. **Solstice markers**: Optional markers for summer/winter solstice

### Sun Info Display

Below the slider:
- **Sunrise time**: e.g., "07:02"
- **Sunset time**: e.g., "17:18"
- **Day length**: e.g., "10h 16m"
- **Sun icon**: Animated or static based on day length

---

## Interaction

### Drag Behavior

```typescript
function handleSliderDrag(clientX: number, trackBounds: DOMRect) {
  // Map pixel position to day of year (0-364)
  const relativeX = (clientX - trackBounds.left) / trackBounds.width;
  const dayOfYear = Math.round(relativeX * 364);
  
  // Convert to Date
  const year = new Date().getFullYear();
  const date = new Date(year, 0, 1 + dayOfYear);
  
  return date;
}
```

### Keyboard Support

| Key | Action |
|-----|--------|
| ← | Previous day |
| → | Next day |
| Shift+← | Previous week |
| Shift+→ | Next week |
| Home | January 1 |
| End | December 31 |
| T | Jump to today |

### Click Behavior

- Click anywhere on track: Jump to that date
- Click on month label: Jump to 15th of that month

---

## Sun Calculation

```typescript
import SunCalc from 'suncalc';

interface SunTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  dayLength: number;  // hours
}

function getSunTimesForDate(
  date: Date,
  latitude: number,
  longitude: number
): SunTimes {
  const times = SunCalc.getTimes(date, latitude, longitude);
  
  const sunrise = times.sunrise;
  const sunset = times.sunset;
  const dayLength = (sunset.getTime() - sunrise.getTime()) / (1000 * 60 * 60);
  
  return {
    sunrise,
    sunset,
    solarNoon: times.solarNoon,
    dayLength
  };
}
```

### Precompute Year Data

For smooth slider performance, precompute all 365 days on component mount:

```typescript
function precomputeYearSunData(
  latitude: number,
  longitude: number
): Map<number, SunTimes> {
  const year = new Date().getFullYear();
  const data = new Map<number, SunTimes>();
  
  for (let day = 0; day < 365; day++) {
    const date = new Date(year, 0, 1 + day);
    data.set(day, getSunTimesForDate(date, latitude, longitude));
  }
  
  return data;
}

// Usage
const yearData = useMemo(
  () => precomputeYearSunData(latitude, longitude),
  [latitude, longitude]
);
```

---

## Integration with Curve Editor

When the year slider date changes:

1. Update sunrise/sunset times used for relative point resolution
2. Recalculate curve paths with new sun times
3. Move sun event markers on the chart
4. Show how the "effective" curve shifts seasonally

```typescript
// In parent component
function handleYearSliderChange(date: Date) {
  const sunTimes = getSunTimesForDate(date, latitude, longitude);
  
  // Update curve editor's sun times
  setCurveEditorSunTimes({
    sunriseHour: sunTimes.sunrise.getHours() + sunTimes.sunrise.getMinutes() / 60,
    sunsetHour: sunTimes.sunset.getHours() + sunTimes.sunset.getMinutes() / 60
  });
}
```

---

## Visual Feedback

### Day Length Visualization

Show a mini visualization of day vs night:

```
┌──────────────────────────────────────┐
│███████░░░░░░░░░░░░░░░░░░░░░░░░░░░███│  Winter (short day)
│███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██│  Summer (long day)
└──────────────────────────────────────┘
 ↑                                     ↑
 midnight                           midnight
 
 ███ = Night (dark)
 ░░░ = Day (light)
```

### Seasonal Colors

Optionally tint the slider track:

```css
.year-slider-track {
  background: linear-gradient(
    90deg,
    #a8d8ff 0%,    /* Winter - cool blue */
    #a8d8ff 8%,    /* Jan */
    #c8e8c0 25%,   /* Spring - green */
    #fff8a0 42%,   /* Early summer - warm yellow */
    #ffcc80 58%,   /* Peak summer - orange */
    #fff8a0 67%,   /* Late summer */
    #e8c080 83%,   /* Fall - brown/orange */
    #a8d8ff 100%   /* Winter again */
  );
}
```

---

## Edge Cases

### Polar Regions

Near the Arctic/Antarctic circles:

- **Polar day**: Sun doesn't set (show "No sunset" message)
- **Polar night**: Sun doesn't rise (show "No sunrise" message)

```typescript
function getSunTimesForDate(date: Date, lat: number, lng: number): SunTimes {
  const times = SunCalc.getTimes(date, lat, lng);
  
  // SunCalc returns NaN for polar day/night
  if (isNaN(times.sunrise.getTime())) {
    return {
      sunrise: null,
      sunset: null,
      isPolarDay: lat > 0 && date.getMonth() >= 4 && date.getMonth() <= 8,
      isPolarNight: lat > 0 && (date.getMonth() <= 1 || date.getMonth() >= 10)
    };
  }
  
  // Normal case
  return { sunrise: times.sunrise, sunset: times.sunset };
}
```

### Leap Years

Handle Feb 29:

```typescript
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function getDaysInYear(year: number): number {
  return ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
}
```

---

## Performance

- **Precompute**: Calculate all 365 days of sun data on mount
- **Throttle**: Throttle drag events to 30fps (slider can be fast)
- **Memoize**: Memoize curve recalculations
- **Debounce**: Debounce the curve editor update by 50ms

```typescript
// Throttled drag handler
const throttledDateChange = useMemo(
  () => throttle((date: Date) => onDateChange(date), 33),  // ~30fps
  [onDateChange]
);

// Memoized sun data lookup
const currentSunTimes = useMemo(
  () => yearData.get(getDayOfYear(selectedDate)),
  [yearData, selectedDate]
);
```

---

## Accessibility

```typescript
<input
  type="range"
  role="slider"
  aria-label="Select date to preview"
  aria-valuemin={0}
  aria-valuemax={364}
  aria-valuenow={getDayOfYear(selectedDate)}
  aria-valuetext={`${selectedDate.toLocaleDateString()}, sunrise ${formatTime(sunrise)}, sunset ${formatTime(sunset)}`}
/>
```

---

## Mobile Considerations

- Increase touch target size (min 44px handle)
- Consider a calendar picker as alternative to slider on small screens
- Show sun info in a bottom sheet instead of inline
