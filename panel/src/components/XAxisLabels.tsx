import { useEffect, useRef } from 'react';
import { axisBottom, type ScaleLinear } from 'd3';
import { select } from 'd3';
import { formatHourShort } from '../utils/timeformat';

interface XAxisLabelsProps {
  xScale: ScaleLinear<number, number>;
  height: number;
}

const TICK_VALUES = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function XAxisLabels({ xScale, height }: XAxisLabelsProps) {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const axis = axisBottom(xScale)
      .tickValues(TICK_VALUES)
      .tickFormat((d) => formatHourShort(d as number))
      .tickSize(0)
      .tickPadding(8);

    const g = select(ref.current);
    g.call(axis);
    g.select('.domain').remove();
    g.selectAll('text')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px');
  }, [xScale]);

  return <g ref={ref} transform={`translate(0,${height})`} />;
}
