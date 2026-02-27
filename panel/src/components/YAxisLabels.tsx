import { useEffect, useRef } from 'react';
import { axisLeft, axisRight, select, type ScaleLinear } from 'd3';

interface YAxisLabelsProps {
  yBrightnessScale: ScaleLinear<number, number>;
  yColorTempScale: ScaleLinear<number, number>;
  width: number;
}

export function YAxisLabels({
  yBrightnessScale,
  yColorTempScale,
  width,
}: YAxisLabelsProps) {
  const leftRef = useRef<SVGGElement>(null);
  const rightRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!leftRef.current) return;
    const axis = axisLeft(yBrightnessScale)
      .ticks(5)
      .tickFormat((d) => `${d}%`)
      .tickSize(0)
      .tickPadding(6);

    const g = select(leftRef.current);
    g.call(axis);
    g.select('.domain').remove();
    g.selectAll('text')
      .attr('fill', 'var(--accent-brightness)')
      .attr('font-size', '9px');
  }, [yBrightnessScale]);

  useEffect(() => {
    if (!rightRef.current) return;
    const axis = axisRight(yColorTempScale)
      .ticks(5)
      .tickFormat((d) => `${d}K`)
      .tickSize(0)
      .tickPadding(6);

    const g = select(rightRef.current);
    g.call(axis);
    g.select('.domain').remove();
    g.selectAll('text')
      .attr('fill', 'var(--accent-colortemp)')
      .attr('font-size', '9px');
  }, [yColorTempScale]);

  return (
    <>
      <g ref={leftRef} />
      {/* Left axis label */}
      <text
        transform="rotate(-90)"
        x={-yBrightnessScale(50)}
        y={-44}
        textAnchor="middle"
        fill="var(--accent-brightness)"
        fontSize={10}
        fontWeight={500}
      >
        Brightness %
      </text>

      <g ref={rightRef} transform={`translate(${width},0)`} />
      {/* Right axis label */}
      <text
        transform="rotate(90)"
        x={yColorTempScale(3750)}
        y={-(width + 48)}
        textAnchor="middle"
        fill="var(--accent-colortemp)"
        fontSize={10}
        fontWeight={500}
      >
        Color Temp (K)
      </text>
    </>
  );
}
