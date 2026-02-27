import type { ScaleLinear } from 'd3';
import type { SunTimes } from '../../types/curves';
import { formatHour } from '../../utils/timeformat';

interface SunEventMarkersProps {
  sunTimes: SunTimes;
  height: number;
  xScale: ScaleLinear<number, number>;
}

function SunIcon({ x }: { x: number }) {
  return (
    <g transform={`translate(${x - 6}, -16)`}>
      <line x1="0" y1="10" x2="12" y2="10" stroke="var(--accent-sun)" strokeWidth={1.2} />
      <path d="M3 10 A3 3 0 0 1 9 10" fill="var(--accent-sun)" />
      <line x1="6" y1="1" x2="6" y2="3" stroke="var(--accent-sun)" strokeWidth={1.2} />
      <line x1="2" y1="3.5" x2="3.5" y2="5" stroke="var(--accent-sun)" strokeWidth={1.2} />
      <line x1="10" y1="3.5" x2="8.5" y2="5" stroke="var(--accent-sun)" strokeWidth={1.2} />
    </g>
  );
}

export function SunEventMarkers({ sunTimes, height, xScale }: SunEventMarkersProps) {
  const events = [
    { hour: sunTimes.sunriseHour, type: 'sunrise' as const },
    { hour: sunTimes.sunsetHour, type: 'sunset' as const },
  ];

  return (
    <g className="sun-event-markers">
      {events.map((e) => {
        const x = xScale(e.hour);
        return (
          <g key={e.type}>
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
            <SunIcon x={x} />
            <text
              x={x}
              y={12}
              textAnchor="middle"
              fill="var(--accent-sun)"
              fontSize={9}
              opacity={0.8}
            >
              {formatHour(e.hour)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
