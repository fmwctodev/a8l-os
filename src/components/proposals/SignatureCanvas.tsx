import { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void;
  onClear: () => void;
  value?: string;
  darkMode?: boolean;
}

export function SignatureCanvas({ onSave, onClear, value, darkMode = false }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.strokeStyle = darkMode ? '#e2e8f0' : '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setIsEmpty(false);
      };
      img.src = value;
    }
  }, [value, darkMode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.closePath();
    setIsDrawing(false);

    if (!isEmpty) {
      const signatureData = canvas.toDataURL('image/png');
      onSave(signatureData);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onClear();
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full h-40 border-2 rounded-lg cursor-crosshair touch-none ${
            darkMode
              ? 'border-[#334155] bg-[#162032]'
              : 'border-slate-300 bg-white'
          }`}
          style={{ width: '100%', height: '160px' }}
        />
        {!isEmpty && (
          <button
            type="button"
            onClick={clearCanvas}
            className={`absolute top-2 right-2 p-1.5 border rounded-lg transition-colors ${
              darkMode
                ? 'bg-[#1e293b] border-[#334155] hover:bg-[#334155]'
                : 'bg-white border-slate-300 hover:bg-slate-50'
            }`}
            title="Clear signature"
          >
            <X className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`} />
          </button>
        )}
      </div>
      <p className={`text-sm text-center ${darkMode ? 'text-slate-600' : 'text-slate-500'}`}>
        Sign above using your mouse or touch screen
      </p>
    </div>
  );
}
