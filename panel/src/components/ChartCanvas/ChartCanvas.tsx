import type { ReactNode } from 'react';
import type { ChartMargins } from '../../types/curves';

interface ChartCanvasProps {
  width: number;
  height: number;
  margins: ChartMargins;
  children: ReactNode;
}

export function ChartCanvas({ width, height, margins, children }: ChartCanvasProps) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ display: 'block' }}
    >
      <g transform={`translate(${margins.left},${margins.top})`}>
        {children}
      </g>
    </svg>
  );
}
