import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AudioFile, AudioEffect } from '@/types/audio';
import { AudioContextManager } from '@/lib/audio/audioUtils';
import { AudioEffectProcessor } from '@/lib/audio/audioEffects';
import { WaveformVisualizer } from './WaveformVisualizer';

interface AudioPlayerProps {
  audioFile: AudioFile;
  effects?: AudioEffect[];
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onEnded?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  analyserRef?: React.MutableRefObject<AnalyserNode | null>;
  className?: string;
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  volume?: number;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioFile,
  effects = [],
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onPlayStateChange,
  analyserRef,
  className = '',
  showControls = true,
  autoPlay = false,
  loop = false,
  volume = 1,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const internalAnalyserRef = useRef<AnalyserNode | null>(null);
  const contextManagerRef = useRef<AudioContextManager | null>(null);
  const effectProcessorRef = useRef<AudioEffectProcessor | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    contextManagerRef.current = AudioContextManager.getInstance();
    effectProcessorRef.current = new AudioEffectProcessor();
    setDuration(audioFile.duration);
    onLoadedMetadata?.(audioFile.duration);

    return () => {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      // cleanup analyser
      internalAnalyserRef.current = null;
      if (analyserRef) analyserRef.current = null;
      effectProcessorRef.current?.cleanup();
    };
  }, [audioFile, onLoadedMetadata, analyserRef]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  const playFunctionRef = useRef<(() => Promise<void>) | null>(null);

  const updateTime = useCallback(() => {
    if (isPlaying && contextManagerRef.current) {
      const elapsed = contextManagerRef.current.getCurrentTime() - startTimeRef.current + pauseTimeRef.current;
      const newCurrentTime = Math.min(elapsed, duration);
      setCurrentTime(newCurrentTime);
      onTimeUpdate?.(newCurrentTime);

      if (newCurrentTime >= duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
        onEnded?.();
        if (loop && playFunctionRef.current) {
          setTimeout(() => {
            playFunctionRef.current?.();
          }, 100);
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    }
  }, [isPlaying, duration, onTimeUpdate, onEnded, loop]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateTime]);

  const createAudioNodes = useCallback(async () => {
    if (!contextManagerRef.current || !effectProcessorRef.current) return null;

    const context = contextManagerRef.current.getContext();
    await contextManagerRef.current.resumeContext();

    const source = context.createBufferSource();
    source.buffer = audioFile.audioBuffer;
    source.playbackRate.value = playbackRate;

    const gainNode = context.createGain();
    gainNode.gain.value = volume;

    // Apply effects if any
    if (effects.length > 0) {
      effectProcessorRef.current.applyEffectsChain(source, effects, gainNode);
    } else {
      source.connect(gainNode);
    }

    // If parent requests analyser, create and insert it
    if (analyserRef) {
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.85;
      gainNode.connect(analyser);
      analyser.connect(context.destination);
      internalAnalyserRef.current = analyser;
      analyserRef.current = analyser;
    } else {
      gainNode.connect(context.destination);
    }

    sourceRef.current = source;
    gainNodeRef.current = gainNode;

    return source;
  }, [audioFile.audioBuffer, effects, volume, playbackRate, analyserRef]);

  const play = useCallback(async () => {
    if (isPlaying) return;

    setIsLoading(true);
    try {
      const source = await createAudioNodes();
      if (!source || !contextManagerRef.current) return;

      const currentTimeValue = pauseTimeRef.current;
      source.start(0, currentTimeValue);
      startTimeRef.current = contextManagerRef.current.getCurrentTime() - currentTimeValue;

      source.onended = () => {
        if (currentTime >= duration - 0.1) {
          setIsPlaying(false);
          setCurrentTime(0);
          pauseTimeRef.current = 0;
          onEnded?.();
          if (loop && playFunctionRef.current) {
            setTimeout(() => {
              playFunctionRef.current?.();
            }, 100);
          }
        }
      };

      setIsPlaying(true);
      onPlayStateChange?.(true);
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, createAudioNodes, currentTime, duration, onEnded, loop, onPlayStateChange]);

  // Update the play function ref
  useEffect(() => {
    playFunctionRef.current = play;
  }, [play]);

  const pause = useCallback(() => {
    if (!isPlaying || !sourceRef.current || !contextManagerRef.current) return;

    sourceRef.current.stop();
    pauseTimeRef.current = contextManagerRef.current.getCurrentTime() - startTimeRef.current + pauseTimeRef.current;
    setIsPlaying(false);
    onPlayStateChange?.(false);
    sourceRef.current = null;
  }, [isPlaying, onPlayStateChange]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setIsPlaying(false);
    onPlayStateChange?.(false);
    setCurrentTime(0);
    pauseTimeRef.current = 0;
    startTimeRef.current = 0;
  }, [onPlayStateChange]);

  const seek = useCallback((time: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      pause();
    }
    pauseTimeRef.current = Math.max(0, Math.min(time, duration));
    setCurrentTime(pauseTimeRef.current);
    if (wasPlaying) {
      setTimeout(play, 50);
    }
  }, [isPlaying, pause, play, duration]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const formatTime = useCallback((time: number): string => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (autoPlay) {
      play();
    }
  }, [autoPlay, play]);

  if (!showControls) {
    return null;
  }

  return (
    <div className={`audio-player ${className}`}>
      <div className="audio-player-controls">
        <button
          className="play-pause-btn"
          onClick={togglePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="loading-spinner" />
          ) : isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="8,5 19,12 8,19" />
            </svg>
          )}
        </button>

        <button className="stop-btn" onClick={stop}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </button>

        <div className="time-display">
          <span className="current-time">{formatTime(currentTime)}</span>
          <span className="time-separator">/</span>
          <span className="total-time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="progress-container">
        <WaveformVisualizer
          audioFile={audioFile}
          width={undefined}
          height={80}
          currentTime={currentTime}
          onSeek={seek}
          showProgress={true}
          interactive={true}
          className="audio-player-waveform"
          samples={500}
        />
      </div>

      <div className="audio-player-extras">
        <div className="playback-rate">
          <label>Speed:</label>
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>

        <div className="audio-info">
          <span>{audioFile.name}</span>
          <span className="audio-meta">
            {audioFile.channels} ch • {Math.round(audioFile.sampleRate / 1000)}kHz
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;