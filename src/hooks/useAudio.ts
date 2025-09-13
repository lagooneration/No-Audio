import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioFile, AudioAnalysis, FrequencyData } from '@/types/audio';
import { audioUtils, AudioContextManager } from '@/lib/audio/audioUtils';

/**
 * Hook for loading and analyzing audio files
 */
export const useAudioLoader = () => {
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedAudio = await audioUtils.loadAudioFile(file);
      setAudioFile(loadedAudio);
      return loadedAudio;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load audio file';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearFile = useCallback(() => {
    if (audioFile?.url) {
      URL.revokeObjectURL(audioFile.url);
    }
    setAudioFile(null);
    setError(null);
  }, [audioFile]);

  return {
    audioFile,
    isLoading,
    error,
    loadFile,
    clearFile,
  };
};

/**
 * Hook for real-time audio analysis
 */
export const useAudioAnalysis = (audioFile: AudioFile | null) => {
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeAudio = useCallback(async () => {
    if (!audioFile) return null;

    setIsAnalyzing(true);
    try {
      const result = audioUtils.analyzeAudio(audioFile.audioBuffer);
      setAnalysis(result);
      return result;
    } catch (error) {
      console.error('Error analyzing audio:', error);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [audioFile]);

  useEffect(() => {
    if (audioFile) {
      analyzeAudio();
    } else {
      setAnalysis(null);
    }
  }, [audioFile, analyzeAudio]);

  return {
    analysis,
    isAnalyzing,
    analyzeAudio,
  };
};

/**
 * Hook for real-time frequency analysis
 */
export const useFrequencyAnalysis = (audioContext?: AudioContext) => {
  const [frequencyData, setFrequencyData] = useState<FrequencyData | null>(null);
  const [isActive, setIsActive] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const contextManagerRef = useRef<AudioContextManager | null>(null);

  useEffect(() => {
    contextManagerRef.current = AudioContextManager.getInstance();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      setIsActive(false);
    };
  }, []);

  const start = useCallback(async (source?: AudioNode) => {
    if (isActive) return;

    try {
      const context = audioContext || contextManagerRef.current?.getContext();
      if (!context) throw new Error('No audio context available');

      await contextManagerRef.current?.resumeContext();

      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.85;

      if (source) {
        source.connect(analyser);
      } else {
        // Connect to microphone if no source provided
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const sourceNode = context.createMediaStreamSource(stream);
        sourceNode.connect(analyser);
      }

      analyserRef.current = analyser;
      setIsActive(true);

      const updateFrequencyData = () => {
        if (!analyserRef.current || !isActive) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        setFrequencyData({
          frequencies: dataArray,
          binCount: bufferLength,
          sampleRate: context.sampleRate,
          nyquist: context.sampleRate / 2,
        });

        animationFrameRef.current = requestAnimationFrame(updateFrequencyData);
      };

      updateFrequencyData();
    } catch (error) {
      console.error('Error starting frequency analysis:', error);
      setIsActive(false);
    }
  }, [isActive, audioContext]);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    
    setIsActive(false);
    setFrequencyData(null);
  }, []);

  return {
    frequencyData,
    isActive,
    start,
    stop,
  };
};

/**
 * Hook for audio recording
 */
export const useAudioRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setIsRecording(false);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
      
      mediaRecorder.start(100); // Record in 100ms chunks
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Update duration timer
      intervalRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [isRecording]);

  const clearRecording = useCallback(() => {
    setRecordedBlob(null);
    setDuration(0);
    chunksRef.current = [];
  }, []);

  // Convert recorded blob to AudioFile
  const getAudioFile = useCallback(async (): Promise<AudioFile | null> => {
    if (!recordedBlob) return null;
    
    const file = new File([recordedBlob], `recording-${Date.now()}.webm`, {
      type: recordedBlob.type,
    });
    
    return audioUtils.loadAudioFile(file);
  }, [recordedBlob]);

  return {
    isRecording,
    recordedBlob,
    duration,
    startRecording,
    stopRecording,
    clearRecording,
    getAudioFile,
  };
};

/**
 * Hook for audio playback with effects
 */
export const useAudioPlayback = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const contextManagerRef = useRef<AudioContextManager | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);

  useEffect(() => {
    contextManagerRef.current = AudioContextManager.getInstance();
    return () => {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
    };
  }, []);

  const play = useCallback(async (audioBuffer: AudioBuffer, startOffset: number = 0) => {
    if (isPlaying) return;

    try {
      const context = contextManagerRef.current?.getContext();
      if (!context) throw new Error('No audio context available');

      await contextManagerRef.current?.resumeContext();

      const source = context.createBufferSource();
      const gainNode = context.createGain();
      
      source.buffer = audioBuffer;
      gainNode.gain.value = volume;
      
      source.connect(gainNode);
      gainNode.connect(context.destination);
      
      sourceRef.current = source;
      gainNodeRef.current = gainNode;
      
      source.start(0, startOffset);
      startTimeRef.current = context.currentTime - startOffset;
      
      setIsPlaying(true);
      
      source.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      
    } catch (error) {
      console.error('Error playing audio:', error);
      throw error;
    }
  }, [isPlaying, volume]);

  const pause = useCallback(() => {
    if (sourceRef.current && contextManagerRef.current) {
      sourceRef.current.stop();
      pauseTimeRef.current = contextManagerRef.current.getCurrentTime() - startTimeRef.current;
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    pauseTimeRef.current = 0;
  }, []);

  const seek = useCallback((time: number) => {
    pauseTimeRef.current = time;
    setCurrentTime(time);
  }, []);

  return {
    isPlaying,
    currentTime,
    volume,
    play,
    pause,
    stop,
    seek,
    setVolume,
  };
};

/**
 * Hook for audio visualization data
 */
export const useAudioVisualization = (audioFile: AudioFile | null, samples: number = 1000) => {
  const [waveformData, setWaveformData] = useState<Float32Array[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateWaveform = useCallback(async () => {
    if (!audioFile) return;

    setIsGenerating(true);
    try {
      const waveform = audioUtils.generateWaveformData(audioFile.audioBuffer, samples);
      setWaveformData(waveform.peaks);
    } catch (error) {
      console.error('Error generating waveform:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [audioFile, samples]);

  useEffect(() => {
    generateWaveform();
  }, [generateWaveform]);

  return {
    waveformData,
    isGenerating,
    regenerate: generateWaveform,
  };
};