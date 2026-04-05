'use client';

import { useEffect, useRef } from 'react';

interface VoiceWaveProps {
  getAnalyserData: () => Uint8Array | null;
  interimTranscript: string;
  onCancel: () => void;
}

const BAR_COUNT = 32;
const BAR_GAP = 3;
const BAR_WIDTH = 3;
const HEIGHT = 48;

export function VoiceWave({ getAnalyserData, interimTranscript, onCancel }: VoiceWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
    canvas.width = width;
    canvas.height = HEIGHT;

    const draw = () => {
      ctx.clearRect(0, 0, width, HEIGHT);
      const data = getAnalyserData();

      for (let i = 0; i < BAR_COUNT; i++) {
        // Sample from frequency data or use idle animation
        let value: number;
        if (data) {
          const idx = Math.floor((i / BAR_COUNT) * data.length);
          value = data[idx] / 255;
        } else {
          // Idle wave animation
          value = 0.15 + 0.1 * Math.sin(Date.now() / 300 + i * 0.3);
        }

        const barHeight = Math.max(3, value * HEIGHT * 0.8);
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = (HEIGHT - barHeight) / 2;

        // Green gradient
        const intensity = Math.floor(150 + value * 105);
        ctx.fillStyle = `rgb(${Math.floor(197 * value + 100)}, ${intensity + 50}, ${Math.floor(138 * value + 50)})`;
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, barHeight, 1.5);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [getAnalyserData]);

  return (
    <div className="flex flex-col items-center gap-3 py-4 animate-fade-in">
      <canvas
        ref={canvasRef}
        style={{ width: BAR_COUNT * (BAR_WIDTH + BAR_GAP), height: HEIGHT }}
        className="opacity-90"
      />
      {interimTranscript && (
        <p className="text-sm text-[var(--color-text-secondary)] text-center max-w-[80%] truncate">
          {interimTranscript}
        </p>
      )}
      {!interimTranscript && (
        <p className="text-xs text-[var(--color-text-secondary)]">Listening...</p>
      )}
      <button
        onClick={onCancel}
        className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
