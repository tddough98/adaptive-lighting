import { useEffect, useRef } from 'react';
import { axisLeft, select, type ScaleLinear } from 'd3';

interface YAxisLabelsProps {
  yScale: ScaleLinear<number, number>;
  label: string;
  accentColor: string;
  tickFormat: (d: number) => string;
}

export function YAxisLabels({
  yScale,
  label,
  accentColor,
  tickFormat,
}: YAxisLabelsProps) {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const axis = axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => tickFormat(d as number))
      .tickSize(0)
      .tickPadding(6);

    const g = select(ref.current);
    g.call(axis);
    g.select('.domain').remove();
    g.selectAll('text')
      .attr('fill', accentColor)
      .attr('font-size', '9px');
  }, [yScale, tickFormat, accentColor]);

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
