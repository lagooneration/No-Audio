import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AudioFile, WaveformData } from '@/types/audio';
import { audioUtils } from '@/lib/audio/audioUtils';

interface WaveformVisualizerProps {
  audioFile: AudioFile;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
  className?: string;
  samples?: number;
  showProgress?: boolean;
  interactive?: boolean;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  audioFile,
  width = 800,
  height = 120,
  color = '#007bff',
  backgroundColor = 'transparent',
  currentTime = 0,
  onSeek,
  className = '',
  samples = 1000,
  showProgress = true,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canvasSize, setCanvasSize] = useState({ width, height });

  // Generate waveform data
  useEffect(() => {
    const generateWaveform = async () => {
      setIsLoading(true);
      try {
        const data = audioUtils.generateWaveformData(audioFile.audioBuffer, samples);
        setWaveformData(data);
      } catch (error) {
        console.error('Error generating waveform:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateWaveform();
  }, [audioFile, samples]);

  // Handle container resize with ResizeObserver for better responsiveness
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({
          width: rect.width, // Always use container width for full responsiveness
          height: height || rect.height,
        });
      }
    };

    // Use ResizeObserver for more accurate size tracking
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(containerRef.current);
    }

    // Fallback to window resize event
    updateSize();
    window.addEventListener('resize', updateSize);
    
    return () => {
      window.removeEventListener('resize', updateSize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [height]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: canvasWidth, height: canvasHeight } = canvasSize;
    canvas.width = canvasWidth * window.devicePixelRatio;
    canvas.height = canvasHeight * window.devicePixelRatio;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background
    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Get peak data for the first channel (or average if stereo)
    const peaks = waveformData.peaks[0];
    const barWidth = canvasWidth / peaks.length;
    const centerY = canvasHeight / 2;
    const maxAmplitude = canvasHeight / 2 - 2;

    // Draw waveform bars
    ctx.fillStyle = color;
    for (let i = 0; i < peaks.length; i++) {
      const amplitude = peaks[i] * maxAmplitude;
      const x = i * barWidth;
      
      // Draw bar from center going up and down
      if (amplitude > 0) {
        ctx.fillRect(x, centerY - amplitude, Math.max(barWidth - 1, 1), amplitude * 2);
      } else {
        ctx.fillRect(x, centerY - 1, Math.max(barWidth - 1, 1), 2);
      }
    }

    // Draw progress indicator
    if (showProgress && audioFile.duration > 0) {
      const progressX = (currentTime / audioFile.duration) * canvasWidth;
      
      // Draw progress overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, progressX, canvasHeight);
      
      // Draw progress line
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(progressX, 0);
      ctx.lineTo(progressX, canvasHeight);
      ctx.stroke();
    }
  }, [waveformData, canvasSize, color, backgroundColor, currentTime, audioFile.duration, showProgress]);

  // Redraw when dependencies change
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle canvas click for seeking
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !onSeek || !audioFile.duration) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progress = clickX / rect.width;
    const seekTime = progress * audioFile.duration;
    
    onSeek(Math.max(0, Math.min(seekTime, audioFile.duration)));
  }, [interactive, onSeek, audioFile.duration]);

  if (isLoading) {
    return (
      <div className={`waveform-loading ${className}`} style={{ width: canvasSize.width, height: canvasSize.height }}>
        <div className="loading-spinner"></div>
        <span>Generating waveform...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`waveform-container ${className}`}
      style={{ width: width || '100%', height }}
    >
      <canvas
        ref={canvasRef}
        className={`waveform-canvas ${interactive ? 'interactive' : ''}`}
        onClick={handleCanvasClick}
        style={{ cursor: interactive ? 'pointer' : 'default' }}
      />
      
      {/* Time markers */}
      <div className="waveform-timeline">
        {Array.from({ length: 5 }, (_, i) => {
          const time = (audioFile.duration / 4) * i;
          const position = (i / 4) * 100;
          return (
            <div
              key={i}
              className="timeline-marker"
              style={{ left: `${position}%` }}
            >
              {audioUtils.formatTime(time)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WaveformVisualizer;