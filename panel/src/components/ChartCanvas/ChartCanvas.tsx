import type { ReactNode } from 'react';
import type { ChartMargins } from '../../types/curves';

interface ChartCanvasProps {
  width: number;
  height: number;
  margins: ChartMargins;
  children: ReactNode;
  ref?: React.Ref<SVGSVGElement>;
}

export function ChartCanvas({ width, height, margins, children, ref }: ChartCanvasProps) {
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ display: 'block' }}
    >
      <defs>
        <filter id="drag-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`translate(${margins.left},${margins.top})`}>
        {children}
      </g>
    </svg>
  );
}
