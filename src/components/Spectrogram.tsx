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
      if (!analyser) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Prepare frequency data buffer
      if (!freqDataRef.current || freqDataRef.current.length !== analyser.frequencyBinCount) {
        freqDataRef.current = new Float32Array(analyser.frequencyBinCount);
      }

      // Only shift existing image if playing - creates scrolling effect
      if (isPlaying) {
        ctx.drawImage(canvas, -1, 0);
      } else {
        // When not playing, clear canvas to draw static spectrum
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      // Read new frequency data
      // TS DOM lib may mismatch Float32Array generic with WebAudio types in some environments
      // @ts-expect-error WebAudio Float32Array typing mismatch (ArrayBuffer vs ArrayBufferLike)
      analyser.getFloatFrequencyData(freqDataRef.current);
      const data = freqDataRef.current as Float32Array;

      const bins = data.length;

      if (isPlaying) {
        // Draw just the new column at the right edge for scrolling effect
        const colX = canvas.width - 1;
        for (let y = 0; y < canvas.height; y++) {
          // Invert so low frequencies at the bottom, highs at the top
          const t = 1 - y / (canvas.height - 1);
          const bin = Math.min(bins - 1, Math.floor(t * bins));
          // data are decibels (negative values). Map to 0..1 based on analyser's range
          const vDb = data[bin];
          const minDb = analyser.minDecibels ?? -100;
          const maxDb = analyser.maxDecibels ?? -30;
          const norm = Math.min(1, Math.max(0, (vDb - minDb) / (maxDb - minDb)));

        // Enhanced color mapping for better visibility
        // Use a jet-like colormap (blue -> cyan -> green -> yellow -> red)
        let r, g, b;
        
        if (norm < 0.2) {
          // Blue to Cyan (0-0.2)
          const t = norm / 0.2;
          r = 0;
          g = Math.floor(t * 255);
          b = 255;
        } else if (norm < 0.4) {
          // Cyan to Green (0.2-0.4)
          const t = (norm - 0.2) / 0.2;
          r = 0;
          g = 255;
          b = Math.floor(255 * (1 - t));
        } else if (norm < 0.6) {
          // Green to Yellow (0.4-0.6)
          const t = (norm - 0.4) / 0.2;
          r = Math.floor(t * 255);
          g = 255;
          b = 0;
        } else if (norm < 0.8) {
          // Yellow to Red (0.6-0.8)
          const t = (norm - 0.6) / 0.2;
          r = 255;
          g = Math.floor(255 * (1 - t));
          b = 0;
        } else {
          // Red to White (0.8-1.0)
          const t = (norm - 0.8) / 0.2;
          r = 255;
          g = Math.floor(t * 255);
          b = Math.floor(t * 255);
        }
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(colX, y, 1, 1);
      }
      } else {
        // Draw the entire spectrum when not playing (static view)
        const barWidth = Math.max(1, Math.floor(canvas.width / bins));
        
        for (let bin = 0; bin < bins; bin++) {
          // data are decibels (negative values). Map to 0..1 based on analyser's range
          const vDb = data[bin];
          const minDb = analyser.minDecibels ?? -100;
          const maxDb = analyser.maxDecibels ?? -30;
          const norm = Math.min(1, Math.max(0, (vDb - minDb) / (maxDb - minDb)));
          
          // Enhanced color mapping for better visibility
          let r, g, b;
          
          if (norm < 0.2) {
            const t = norm / 0.2;
            r = 0;
            g = Math.floor(t * 255);
            b = 255;
          } else if (norm < 0.4) {
            const t = (norm - 0.2) / 0.2;
            r = 0;
            g = 255;
            b = Math.floor(255 * (1 - t));
          } else if (norm < 0.6) {
            const t = (norm - 0.4) / 0.2;
            r = Math.floor(t * 255);
            g = 255;
            b = 0;
          } else if (norm < 0.8) {
            const t = (norm - 0.6) / 0.2;
            r = 255;
            g = Math.floor(255 * (1 - t));
            b = 0;
          } else {
            const t = (norm - 0.8) / 0.2;
            r = 255;
            g = Math.floor(t * 255);
            b = Math.floor(t * 255);
          }
          
          const x = bin * barWidth;
          const height = Math.max(1, Math.floor(norm * canvas.height));
          const y = canvas.height - height;
          
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, y, barWidth, height);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    // Always animate when analyser is available, but only scroll when playing
    if (analyser) {
      rafRef.current = requestAnimationFrame(draw);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
    } else {
      // If no analyser, cancel RAF
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
