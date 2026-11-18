import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string | null;
}

interface SignaturePadProps {
  height?: number;
  onChange?: (isEmpty: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ height = 180, onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    const emptyRef = useRef(true);
    const [, setTick] = useState(0);

    const setEmpty = (v: boolean) => {
      if (emptyRef.current !== v) {
        emptyRef.current = v;
        onChange?.(v);
        setTick((t) => t + 1);
      }
    };

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const prev = emptyRef.current ? null : canvas.toDataURL();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#0f172a";
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prev;
      }
    };

    useEffect(() => {
      resize();
      const ro = new ResizeObserver(resize);
      if (canvasRef.current) ro.observe(canvasRef.current);
      return () => ro.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getPos = (e: PointerEvent | React.PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top };
    };

    const start = (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastRef.current = getPos(e);
    };
    const move = (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !lastRef.current) return;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastRef.current.x, lastRef.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastRef.current = p;
      setEmpty(false);
    };
    const end = () => {
      drawingRef.current = false;
      lastRef.current = null;
    };

    const clear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setEmpty(true);
    };

    useImperativeHandle(ref, () => ({
      clear,
      isEmpty: () => emptyRef.current,
      toDataURL: () => (emptyRef.current ? null : canvasRef.current?.toDataURL("image/png") || null),
    }));

    return (
      <div className="space-y-2">
        <div
          className="relative rounded-md border-2 border-dashed bg-white"
          style={{ height }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerLeave={end}
          />
          {emptyRef.current && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
              Sign here with finger, stylus, or mouse
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            <Eraser className="mr-1 h-3 w-3" /> Clear
          </Button>
        </div>
      </div>
    );
  },
);

SignaturePad.displayName = "SignaturePad";
