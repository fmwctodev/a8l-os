import { useEffect, useRef } from 'react';

interface VoiceOrbProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  size?: number;
}

const COLORS = {
  idle: { inner: '#06b6d4', outer: '#0891b2' },
  listening: { inner: '#22d3ee', outer: '#06b6d4' },
  processing: { inner: '#14b8a6', outer: '#0d9488' },
  speaking: { inner: '#06b6d4', outer: '#0891b2' },
};

export function VoiceOrb({ state, size = 160 }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const baseRadius = size * 0.28;

    const draw = () => {
      phaseRef.current += state === 'idle' ? 0.008 : state === 'listening' ? 0.025 : 0.015;
      const t = phaseRef.current;
      const colors = COLORS[state];

      ctx.clearRect(0, 0, size, size);

      const pulseAmp = state === 'listening' ? 8 : state === 'speaking' ? 6 : 3;
      const pulseSpeed = state === 'listening' ? 3 : state === 'speaking' ? 4 : 1.5;

      for (let ring = 2; ring >= 0; ring--) {
        const ringRadius = baseRadius + ring * 12 + Math.sin(t * pulseSpeed + ring) * pulseAmp;
        const alpha = 0.08 - ring * 0.02;
        ctx.beginPath();
        ctx.arc(center, center, ringRadius, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(colors.outer, alpha);
        ctx.fill();
      }

      const grad = ctx.createRadialGradient(
        center - baseRadius * 0.2,
        center - baseRadius * 0.2,
        0,
        center,
        center,
        baseRadius
      );
      grad.addColorStop(0, hexAlpha(colors.inner, 0.9));
      grad.addColorStop(0.7, hexAlpha(colors.inner, 0.6));
      grad.addColorStop(1, hexAlpha(colors.outer, 0.3));

      const wobble = state === 'idle' ? 0 : state === 'listening' ? 4 : 2;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        const n = Math.sin(a * 3 + t * 2) * wobble + Math.sin(a * 5 + t * 3) * (wobble * 0.5);
        const r = baseRadius + n;
        const x = center + Math.cos(a) * r;
        const y = center + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      if (state === 'processing') {
        const arcStart = t * 3;
        const arcEnd = arcStart + Math.PI * 1.2;
        ctx.beginPath();
        ctx.arc(center, center, baseRadius + 16, arcStart, arcEnd);
        ctx.strokeStyle = hexAlpha(colors.inner, 0.4);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [state, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="pointer-events-none"
    />
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
