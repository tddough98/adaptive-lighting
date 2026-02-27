import type { ScaleLinear } from 'd3';
import type { SunTimes } from '../../types/curves';
import { formatHour } from '../../utils/timeformat';

interface SunEventMarkersProps {
  sunTimes: SunTimes;
  height: number;
  xScale: ScaleLinear<number, number>;
}

export function SunEventMarkers({ sunTimes, height, xScale }: SunEventMarkersProps) {
  const events = [
    { hour: sunTimes.sunriseHour, label: `Sunrise ${formatHour(sunTimes.sunriseHour)}` },
    { hour: sunTimes.sunsetHour, label: `Sunset ${formatHour(sunTimes.sunsetHour)}` },
  ];

  return (
    <g className="sun-event-markers">
      {events.map((e) => {
        const x = xScale(e.hour);
        return (
          <g key={e.label}>
            <line
              x1={x}
              x2={x}
              y1={0}
              y2={height}
              stroke="var(--accent-sun)"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.6}
            />
            <text
              x={x}
              y={-4}
              textAnchor="middle"
              fill="var(--accent-sun)"
              fontSize={9}
              opacity={0.8}
            >
              {e.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
