import { useCallback, useEffect, useRef, useState } from 'react';
import { clientToSvgPoint } from '../utils/svgCoords';

export interface DragState {
  isDragging: boolean;
  activePointId: string | null;
}

export type ConstrainFn<T> = (svgX: number, svgY: number) => T;

interface UseDragOptions<T> {
  svgRef: React.RefObject<SVGSVGElement | null>;
  onDrag: (result: T) => void;
  onDragEnd: (result: T) => void;
}

export function useDrag<T>({ svgRef, onDrag, onDragEnd }: UseDragOptions<T>) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    activePointId: null,
  });

  const constrainRef = useRef<ConstrainFn<T> | null>(null);
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      if (!svgRef.current || !constrainRef.current) return;

      // Cancel any pending rAF to throttle to one update per frame
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const svg = svgRef.current;
        const constrain = constrainRef.current;
        if (!svg || !constrain) return;
        const pt = clientToSvgPoint(svg, e.clientX, e.clientY);
        onDrag(constrain(pt.x, pt.y));
      });
    },
    [svgRef, onDrag],
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      if (svgRef.current && constrainRef.current) {
        const pt = clientToSvgPoint(svgRef.current, e.clientX, e.clientY);
        onDragEnd(constrainRef.current(pt.x, pt.y));
      }

      constrainRef.current = null;
      setDragState({ isDragging: false, activePointId: null });
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    },
    [svgRef, onDragEnd, handleMouseMove],
  );

  /**
   * Returns a mousedown handler for a specific draggable point.
   * `constrainFn` converts raw SVG coordinates to the desired action/result.
   */
  const startDrag = useCallback(
    (pointId: string, constrainFn: ConstrainFn<T>) => {
      return (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        constrainRef.current = constrainFn;
        setDragState({ isDragging: true, activePointId: pointId });
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      };
    },
    [handleMouseMove, handleMouseUp],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { dragState, startDrag };
}
