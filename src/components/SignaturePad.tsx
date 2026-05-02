import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

export function SignaturePad({
  value,
  onChange,
  height = 120,
  hasError = false,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  height?: number;
  hasError?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.parentElement?.clientWidth || 320;
    canvas.width = cssWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cssWidth, height);
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [height]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    const pos = getPos(e);
    if (!ctx || !lastPos.current) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function end() {
    if (!drawing) return;
    setDrawing(false);
    lastPos.current = null;
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (dataUrl) onChange(dataUrl);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onChange('');
    }
  }

  const borderClass = hasError
    ? 'border-red-500/40'
    : 'border-[var(--form-input-border)]';

  return (
    <div className="space-y-2">
      <div className={`relative border rounded-lg bg-white overflow-hidden ${borderClass}`}>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          className="block touch-none cursor-crosshair w-full"
        />
        {!value && !drawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-gray-400 italic">
            Sign here
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="inline-flex items-center gap-1 text-xs text-[var(--form-text-muted)] hover:text-[var(--form-text-secondary)]"
      >
        <RotateCcw className="w-3 h-3" /> Clear signature
      </button>
    </div>
  );
}
