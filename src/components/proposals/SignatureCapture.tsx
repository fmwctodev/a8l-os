import { useRef, useEffect, useState, useCallback } from 'react';
import { PenTool, Type, X } from 'lucide-react';

interface SignatureCaptureProps {
  signerName: string;
  onSignatureChange: (data: {
    type: 'typed' | 'drawn';
    text?: string;
    imageDataUrl: string;
  } | null) => void;
}

export function SignatureCapture({ signerName, onSignatureChange }: SignatureCaptureProps) {
  const [mode, setMode] = useState<'type' | 'draw'>('type');
  const [typedName, setTypedName] = useState(signerName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const renderTypedToCanvas = useCallback((name: string) => {
    if (!name.trim()) {
      onSignatureChange(null);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'italic 52px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.trim(), canvas.width / 2, canvas.height / 2);

    const imageDataUrl = canvas.toDataURL('image/png');
    onSignatureChange({ type: 'typed', text: name.trim(), imageDataUrl });
  }, [onSignatureChange]);

  useEffect(() => {
    if (mode === 'type') {
      renderTypedToCanvas(typedName);
    }
  }, [typedName, mode, renderTypedToCanvas]);

  useEffect(() => {
    if (mode === 'draw') {
      initCanvas();
      onSignatureChange(null);
      setHasDrawn(false);
    }
  }, [mode]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.closePath();
    setIsDrawing(false);
    if (hasDrawn || true) {
      const imageDataUrl = canvas.toDataURL('image/png');
      onSignatureChange({ type: 'drawn', imageDataUrl });
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setMode('type')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'type'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Type className="w-4 h-4" />
          Type
        </button>
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'draw'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <PenTool className="w-4 h-4" />
          Draw
        </button>
      </div>

      {mode === 'type' ? (
        <div className="space-y-3">
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 bg-white"
          />
          {typedName.trim() && (
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 bg-white flex items-center justify-center min-h-[100px]">
              <span
                className="text-4xl text-slate-900 select-none"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic' }}
              >
                {typedName.trim()}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
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
              className="w-full border-2 border-dashed border-slate-200 rounded-lg bg-white cursor-crosshair touch-none"
              style={{ width: '100%', height: '160px' }}
            />
            {hasDrawn && (
              <button
                type="button"
                onClick={clearCanvas}
                className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 text-center">
            Sign above using your mouse or touch screen
          </p>
        </div>
      )}
    </div>
  );
}
