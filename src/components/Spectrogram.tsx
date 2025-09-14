"use client";

import React, { useEffect, useRef } from "react";
import "../styles/Spectrogram.css";

export interface SpectrogramProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  width?: number; // optional fixed width; otherwise fills parent
  height?: number; // optional fixed height; otherwise fills parent
  className?: string;
}

// Simple real-time spectrogram that scrolls left and draws new frequency column at the right
export const Spectrogram: React.FC<SpectrogramProps> = ({
  analyser,
  isPlaying,
  width,
  height,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const freqDataRef = useRef<Float32Array | null>(null);

  // Resize canvas to parent size if width/height not provided
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = width ?? parent.clientWidth;
      const h = height ?? parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      if (!analyser || !ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Prepare frequency data buffer
      if (!freqDataRef.current || freqDataRef.current.length !== analyser.frequencyBinCount) {
        freqDataRef.current = new Float32Array(analyser.frequencyBinCount);
      }

      // Shift existing image left by 1 pixel for scrolling effect
      ctx.drawImage(canvas, -1, 0);

      // Read new frequency data
      // TS DOM lib may mismatch Float32Array generic with WebAudio types in some environments
      // @ts-expect-error WebAudio Float32Array typing mismatch (ArrayBuffer vs ArrayBufferLike)
      analyser.getFloatFrequencyData(freqDataRef.current);
      const data = freqDataRef.current as Float32Array;

      // Draw the new vertical column at the right edge
      const colX = canvas.width - 1;
      const bins = data.length;

      // Map each bin to a vertical pixel. If more pixels than bins, we stretch; if fewer, we sample.
      for (let y = 0; y < canvas.height; y++) {
        // Invert so low frequencies at the bottom, highs at the top
        const t = 1 - y / (canvas.height - 1);
        const bin = Math.min(bins - 1, Math.floor(t * bins));
        // data are decibels (negative values). Map to 0..1 based on analyser's range
        const vDb = data[bin];
        const minDb = analyser.minDecibels ?? -100;
        const maxDb = analyser.maxDecibels ?? -30;
        const norm = Math.min(1, Math.max(0, (vDb - minDb) / (maxDb - minDb)));

        // Color mapping: dark -> bright using HSV-like ramp
        // Convert magnitude to hue (blue to red) and brightness
        const hue = 260 - norm * 260; // 260 (blue) to 0 (red)
        const light = 10 + norm * 50; // 10% to 60%
        ctx.fillStyle = `hsl(${hue}, 95%, ${light}%)`;
        ctx.fillRect(colX, y, 1, 1);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    // Only animate when playing to save resources
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(draw);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    } else {
      // If paused, cancel RAF
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [analyser, isPlaying]);

  return (
    <div className={`spectrogram-container ${className}`}>
      <canvas ref={canvasRef} className="spectrogram-canvas" />
      <div className="spectrogram-label">
        {analyser ? (
          <span className="spectrogram-status status-active"></span>
        ) : (
          <span className="spectrogram-status status-inactive"></span>
        )}
      </div>
    </div>
  );
};

export default Spectrogram;
