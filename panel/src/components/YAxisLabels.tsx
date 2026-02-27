import { useEffect, useRef } from 'react';
import { axisLeft, select, type ScaleLinear } from 'd3';

interface YAxisLabelsProps {
  yScale: ScaleLinear<number, number>;
  label: string;
  accentColor: string;
  tickFormat: (d: number) => string;
  mapValueToColor?: (d: number) => string;
}

export function YAxisLabels({
  yScale,
  label,
  accentColor,
  tickFormat,
  mapValueToColor,
}: YAxisLabelsProps) {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const axis = axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => tickFormat(d as number))
      .tickSize(0)
      .tickPadding(mapValueToColor ? 14 : 6);

    const g = select(ref.current);
    g.call(axis);
    g.select('.domain').remove();
    g.selectAll('text').attr('font-size', '9px');
    if (mapValueToColor) {
      g.selectAll<SVGTextElement, number>('.tick text').each(function () {
        const tick = select(this);
        const tickValue = parseFloat(tick.text().replace(/[^0-9.]/g, ''));
        if (!isNaN(tickValue)) {
          tick.attr('fill', mapValueToColor(tickValue));
        }
      });
    } else {
      g.selectAll('text').attr('fill', accentColor);
    }
  }, [yScale, tickFormat, accentColor, mapValueToColor]);

  const [domainMin, domainMax] = yScale.domain();
  const midY = yScale((domainMin + domainMax) / 2);

  return (
    <>
      <g ref={ref} />
      <text
        transform="rotate(-90)"
        x={-midY}
        y={-44}
        textAnchor="middle"
        fill={accentColor}
        fontSize={10}
        fontWeight={500}
      >
        {label}
      </text>
    </>
  );
}
