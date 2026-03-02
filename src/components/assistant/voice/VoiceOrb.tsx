import { useEffect, useRef } from 'react';
import type { ClaraVoiceMode } from '../../../types/assistant';

interface VoiceOrbProps {
  state: ClaraVoiceMode;
  size?: number;
  rmsLevel?: number;
}

const COLORS: Record<ClaraVoiceMode, { inner: string; outer: string }> = {
  idle: { inner: '#06b6d4', outer: '#0891b2' },
  passive_listening: { inner: '#0891b2', outer: '#065f6e' },
  active_listening: { inner: '#22d3ee', outer: '#06b6d4' },
  processing: { inner: '#14b8a6', outer: '#0d9488' },
  speaking: { inner: '#06b6d4', outer: '#0891b2' },
  interrupted: { inner: '#f87171', outer: '#dc2626' },
};

export function VoiceOrb({ state, size = 160, rmsLevel = 0 }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const phaseRef = useRef(0);
  const interruptFlashRef = useRef(0);
  const rmsRef = useRef(rmsLevel);
  rmsRef.current = rmsLevel;

  useEffect(() => {
    if (state === 'interrupted') {
      interruptFlashRef.current = 1.0;
    }
  }, [state]);

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
      const isPassive = state === 'passive_listening';
      const isActive = state === 'active_listening';
      const isProcessing = state === 'processing';
      const isSpeaking = state === 'speaking';
      const isIdle = state === 'idle';

      const speed = isIdle ? 0.008 : isPassive ? 0.005 : isActive ? 0.025 : isSpeaking ? 0.02 : 0.015;
      phaseRef.current += speed;
      const t = phaseRef.current;

      let colors = COLORS[state];
      let flashAlpha = 0;
      if (interruptFlashRef.current > 0) {
        flashAlpha = interruptFlashRef.current;
        interruptFlashRef.current = Math.max(0, interruptFlashRef.current - 0.04);
        if (flashAlpha > 0.01) {
          colors = COLORS.interrupted;
        }
      }

      ctx.clearRect(0, 0, size, size);

      const pulseAmp = isPassive ? 1.5 : isActive ? 8 : isSpeaking ? 6 : isProcessing ? 4 : 3;
      const pulseSpeed = isPassive ? 0.8 : isActive ? 3 : isSpeaking ? 4 : 1.5;

      for (let ring = 2; ring >= 0; ring--) {
        const ringRadius = baseRadius + ring * 12 + Math.sin(t * pulseSpeed + ring) * pulseAmp;
        let alpha = isPassive ? (0.03 - ring * 0.008) : (0.08 - ring * 0.02);
        if (flashAlpha > 0) alpha = Math.min(0.15, alpha + flashAlpha * 0.1);
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
      const innerAlpha = isPassive ? 0.5 : 0.9;
      grad.addColorStop(0, hexAlpha(colors.inner, innerAlpha));
      grad.addColorStop(0.7, hexAlpha(colors.inner, innerAlpha * 0.67));
      grad.addColorStop(1, hexAlpha(colors.outer, 0.3));

      const rmsWobble = isActive ? Math.min(rmsRef.current * 300, 12) : 0;
      const baseWobble = isIdle ? 0 : isPassive ? 0.5 : isActive ? 4 : isSpeaking ? 3 : 2;
      const wobble = baseWobble + rmsWobble;

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

      if (isProcessing) {
        const arcStart = t * 3;
        const arcEnd = arcStart + Math.PI * 1.2;
        ctx.beginPath();
        ctx.arc(center, center, baseRadius + 16, arcStart, arcEnd);
        ctx.strokeStyle = hexAlpha(colors.inner, 0.4);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      if (isSpeaking) {
        const glowRadius = baseRadius + 20;
        const rotAngle = t * 1.5;
        const arcLen = Math.PI * 0.8;
        for (let i = 0; i < 2; i++) {
          const start = rotAngle + i * Math.PI;
          ctx.beginPath();
          ctx.arc(center, center, glowRadius, start, start + arcLen);
          const gradColor = i === 0 ? colors.inner : colors.outer;
          ctx.strokeStyle = hexAlpha(gradColor, 0.25);
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
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
