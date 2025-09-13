'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from "next/image";
import { AudioUploader } from '@/components/AudioUploader';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import { useFrequencyAnalysis } from '@/hooks/useAudio';
import { AudioFile, MLAudioFeatures, AudioEffect } from '@/types/audio';
import { MLAudioAnalyzer } from '@/lib/audio/mlAudioAnalysis';
import { AudioContextManager } from '@/lib/audio/audioUtils';
import { AudioEffectProcessor } from '@/lib/audio/audioEffects';
import CardNav from '@/components/CardNav'
import logo from '@/components/logo.svg';

// Import CSS
import '@/components/AudioUploader.css';
import '@/components/WaveformVisualizer.css';
import '@/components/CardNav.css';

export default function AnalysisPage() {
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [analysisResults, setAnalysisResults] = useState<MLAudioFeatures | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Audio refs for playback
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const contextManagerRef = useRef<AudioContextManager | null>(null);
  const effectProcessorRef = useRef<AudioEffectProcessor | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Frequency analysis hook - only when playing
  const { frequencyData, isActive } = useFrequencyAnalysis();

  const handleFileUpload = useCallback(async (audioFile: AudioFile) => {
    setAudioFile(audioFile);
    setAnalysisResults(null);
    
    // Perform comprehensive audio analysis
    setIsAnalyzing(true);
    try {
      const features = MLAudioAnalyzer.extractFeatures(audioFile);
      setAnalysisResults(features);
    } catch (error) {
      console.error('Error analyzing audio:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleFileError = useCallback((error: string) => {
    console.error('File upload error:', error);
  }, []);

  // Initialize audio context and cleanup
  useEffect(() => {
    contextManagerRef.current = AudioContextManager.getInstance();
    effectProcessorRef.current = new AudioEffectProcessor();

    return () => {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      effectProcessorRef.current?.cleanup();
    };
  }, [audioFile]);

  // Update time during playback
  const updateTime = useCallback(() => {
    if (isPlaying && contextManagerRef.current && audioFile) {
      const elapsed = contextManagerRef.current.getCurrentTime() - startTimeRef.current + pauseTimeRef.current;
      const newCurrentTime = Math.min(elapsed, audioFile.duration);
      setCurrentTime(newCurrentTime);

      if (newCurrentTime >= audioFile.duration) {
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
      } else {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    }
  }, [isPlaying, audioFile]);

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

  // Audio playback functions
  const createAudioNodes = useCallback(async () => {
    if (!contextManagerRef.current || !effectProcessorRef.current || !audioFile) return null;

    const context = contextManagerRef.current.getContext();
    await contextManagerRef.current.resumeContext();

    const source = context.createBufferSource();
    source.buffer = audioFile.audioBuffer;
    source.playbackRate.value = playbackRate;

    const gainNode = context.createGain();
    gainNode.gain.value = 1;

    source.connect(gainNode);
    gainNode.connect(context.destination);

    sourceRef.current = source;
    gainNodeRef.current = gainNode;

    return source;
  }, [audioFile, playbackRate]);

  const play = useCallback(async () => {
    if (isPlaying || !audioFile) return;

    setIsLoading(true);
    try {
      const source = await createAudioNodes();
      if (!source || !contextManagerRef.current) return;

      const currentTimeValue = pauseTimeRef.current;
      source.start(0, currentTimeValue);
      startTimeRef.current = contextManagerRef.current.getCurrentTime() - currentTimeValue;

      source.onended = () => {
        if (currentTime >= audioFile.duration - 0.1) {
          setIsPlaying(false);
          setCurrentTime(0);
          pauseTimeRef.current = 0;
        }
      };

      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, createAudioNodes, currentTime, audioFile]);

  const pause = useCallback(() => {
    if (!isPlaying || !sourceRef.current || !contextManagerRef.current) return;

    sourceRef.current.stop();
    pauseTimeRef.current = contextManagerRef.current.getCurrentTime() - startTimeRef.current + pauseTimeRef.current;
    setIsPlaying(false);
    sourceRef.current = null;
  }, [isPlaying]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const seek = useCallback((time: number) => {
    if (!audioFile) return;
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      pause();
    }
    pauseTimeRef.current = Math.max(0, Math.min(time, audioFile.duration));
    setCurrentTime(pauseTimeRef.current);
    if (wasPlaying) {
      setTimeout(play, 50);
    }
  }, [isPlaying, pause, play, audioFile]);

  const formatValue = (value: number, precision: number = 2): string => {
    return value.toFixed(precision);
  };

  const getFrequencyDominantRange = (frequencies: Uint8Array): string => {
    if (!frequencies || frequencies.length === 0) return 'No data';
    
    const nyquist = 22050; // Assuming 44.1kHz sample rate
    const binSize = nyquist / frequencies.length;
    
    let maxValue = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < frequencies.length; i++) {
      if (frequencies[i] > maxValue) {
        maxValue = frequencies[i];
        maxIndex = i;
      }
    }
    
    const frequency = maxIndex * binSize;
    
    if (frequency < 250) return 'Sub-bass (20-60 Hz)';
    if (frequency < 500) return 'Bass (60-250 Hz)';
    if (frequency < 2000) return 'Low Midrange (250Hz-2kHz)';
    if (frequency < 6000) return 'High Midrange (2-6kHz)';
    if (frequency < 16000) return 'Presence (6-16kHz)';
    return 'Brilliance (16-20kHz)';
  };

  const getAudioCharacteristics = (features: MLAudioFeatures): string[] => {
    const characteristics: string[] = [];
    
    // Analyze spectral characteristics
    if (features.spectralFeatures.centroid > 2000) {
      characteristics.push('Bright/Crisp');
    } else if (features.spectralFeatures.centroid < 1000) {
      characteristics.push('Warm/Dark');
    }
    
    if (features.spectralFeatures.flatness > 0.5) {
      characteristics.push('Noise-like');
    } else if (features.spectralFeatures.flatness < 0.1) {
      characteristics.push('Tonal');
    }
    
    // Analyze temporal characteristics
    if (features.temporalFeatures.zcr > 1000) {
      characteristics.push('High Frequency Content');
    }
    
    if (features.temporalFeatures.energy > 0.5) {
      characteristics.push('High Energy');
    } else if (features.temporalFeatures.energy < 0.1) {
      characteristics.push('Low Energy');
    }
    
    // Analyze harmonic content
    if (features.harmonicFeatures.harmonicity > 0.7) {
      characteristics.push('Harmonic');
    } else if (features.harmonicFeatures.inharmonicity > 0.5) {
      characteristics.push('Inharmonic');
    }
    
    return characteristics.length > 0 ? characteristics : ['Neutral'];
  };

  // Analysis items for CardNav - populated with analysis results
  const items = analysisResults ? [
    {
      label: "Spectral Analysis",
      bgColor: "#0D0716",
      textColor: "#fff",
      links: [
        { label: "Centroid", value: `${formatValue(analysisResults.spectralFeatures.centroid)} Hz`, ariaLabel: "Spectral Centroid" },
        { label: "Bandwidth", value: `${formatValue(analysisResults.spectralFeatures.bandwidth)} Hz`, ariaLabel: "Spectral Bandwidth" },
        { label: "Rolloff", value: `${formatValue(analysisResults.spectralFeatures.rolloff)} Hz`, ariaLabel: "Spectral Rolloff" },
        { label: "Flatness", value: formatValue(analysisResults.spectralFeatures.flatness, 3), ariaLabel: "Spectral Flatness" }
      ]
    },
    {
      label: "Temporal Analysis", 
      bgColor: "#170D27",
      textColor: "#fff",
      links: [
        { label: "Zero Crossing Rate", value: `${formatValue(analysisResults.temporalFeatures.zcr)} Hz`, ariaLabel: "Zero Crossing Rate" },
        { label: "Energy", value: formatValue(analysisResults.temporalFeatures.energy, 3), ariaLabel: "Energy" },
        { label: "RMS", value: formatValue(analysisResults.temporalFeatures.rms, 3), ariaLabel: "RMS" }
      ]
    },
    {
      label: "Harmonic Analysis",
      bgColor: "#271E37", 
      textColor: "#fff",
      links: [
        { label: "Fundamental Pitch", value: `${formatValue(analysisResults.harmonicFeatures.pitch)} Hz`, ariaLabel: "Fundamental Pitch" },
        { label: "Harmonicity", value: formatValue(analysisResults.harmonicFeatures.harmonicity, 3), ariaLabel: "Harmonicity" },
        { label: "Inharmonicity", value: formatValue(analysisResults.harmonicFeatures.inharmonicity, 3), ariaLabel: "Inharmonicity" }
      ]
    }
  ] : [
    {
      label: "No Analysis",
      bgColor: "#333",
      textColor: "#fff",
      links: [
        { label: "Upload audio file", value: "", ariaLabel: "Upload audio file to see analysis" }
      ]
    },
    {
      label: "Ready",
      bgColor: "#444", 
      textColor: "#fff",
      links: [
        { label: "Waiting for data", value: "", ariaLabel: "Waiting for analysis data" }
      ]
    },
    {
      label: "Analysis",
      bgColor: "#555",
      textColor: "#fff", 
      links: [
        { label: "Results will appear here", value: "", ariaLabel: "Analysis results" }
      ]
    }
  ];

  

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="my-4">
                <Image src="/logo.svg" alt="Knowaudio Logo" width={170} height={50} />
              </div>
      
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-white">
          Audio Analysis Studio
        </h1>
        
        <p className="text-center text-gray-300 mb-8">
          Upload an audio file to get comprehensive spectral, temporal, and harmonic analysis
        </p>

        {/* Audio Upload Section */}
        <div className="mb-8">
          <AudioUploader
            onFileLoad={handleFileUpload}
            onError={handleFileError}
            className="max-w-2xl mx-auto"
          />
        </div>

        <CardNav
          logo={logo}
          logoAlt="Knowaudio Logo"
          items={items}
          baseColor="#fff"
          menuColor="#000"
          buttonBgColor="#111"
          buttonTextColor="#fff"
          ease="power3.out"
          // Audio props
          isPlaying={isPlaying}
          isLoading={isLoading}
          currentTime={currentTime}
          duration={audioFile?.duration || 0}
          playbackRate={playbackRate}
          audioFile={audioFile ? {
            name: audioFile.name,
            duration: audioFile.duration,
            channels: audioFile.channels,
            sampleRate: audioFile.sampleRate
          } : null}
          onTogglePlayPause={togglePlayPause}
          onSeek={seek}
          onPlaybackRateChange={setPlaybackRate}
          disabled={!audioFile}
        />

        {audioFile && (
          <>
            {/* Waveform Visualizer Section */}
            <div className="mb-8 bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-blue-400">Waveform</h2>
              <WaveformVisualizer
                audioFile={audioFile}
                currentTime={currentTime}
                onSeek={seek}
                className="mt-4"
              />
            </div>

            {/* Real-time Frequency Analysis */}
            <div className="mb-8 bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-green-400">Real-time Frequency Analysis</h2>
              {isActive && frequencyData ? (
                <div className="bg-gray-700 rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">Dominant Frequency Range:</span>
                    <span className="text-green-400 font-mono">
                      {getFrequencyDominantRange(frequencyData.frequencies)}
                    </span>
                  </div>
                  <div className="frequency-bars flex items-end gap-1 h-32 bg-gray-900 rounded p-2">
                    {Array.from(frequencyData.frequencies.slice(0, 64)).map((value, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-t from-green-600 to-green-400 rounded-sm flex-1 min-w-0"
                        style={{
                          height: `${Math.max(2, (value / 255) * 100)}%`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>20Hz</span>
                    <span>1kHz</span>
                    <span>10kHz</span>
                    <span>20kHz</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400">Play audio to see real-time frequency analysis</p>
              )}
            </div>

            {/* Comprehensive Analysis Results */}
            {isAnalyzing ? (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <div className="inline-block w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-300">Analyzing audio features...</p>
              </div>
            ) : analysisResults ? (
              <div className="space-y-6">
                {/* Audio Characteristics Summary */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-purple-400">Audio Characteristics</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700 rounded p-4">
                      <h3 className="font-medium text-gray-300 mb-2">File Information</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Duration:</span>
                          <span className="text-white">{formatValue(audioFile.duration)} seconds</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Sample Rate:</span>
                          <span className="text-white">{audioFile.sampleRate} Hz</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Channels:</span>
                          <span className="text-white">{audioFile.channels}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Format:</span>
                          <span className="text-white">{audioFile.file.type || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-700 rounded p-4">
                      <h3 className="font-medium text-gray-300 mb-2">Audio Profile</h3>
                      <div className="flex flex-wrap gap-2">
                        {getAudioCharacteristics(analysisResults).map((characteristic, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-purple-600 text-purple-100 text-sm rounded-full"
                          >
                            {characteristic}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spectral Analysis */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-blue-400">Spectral Analysis</h2>
                  <div className="grid grid-rows-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Spectral Centroid</h3>
                      <p className="text-2xl font-bold text-blue-400">
                        {formatValue(analysisResults.spectralFeatures.centroid)}
                      </p>
                      <p className="text-xs text-gray-400">Hz</p>
                      <p className="text-xs text-gray-500 mt-1">Brightness measure</p>
                    </div>
                    
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Bandwidth</h3>
                      <p className="text-2xl font-bold text-blue-400">
                        {formatValue(analysisResults.spectralFeatures.bandwidth)}
                      </p>
                      <p className="text-xs text-gray-400">Hz</p>
                      <p className="text-xs text-gray-500 mt-1">Spectral width</p>
                    </div>
                    
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Rolloff</h3>
                      <p className="text-2xl font-bold text-blue-400">
                        {formatValue(analysisResults.spectralFeatures.rolloff)}
                      </p>
                      <p className="text-xs text-gray-400">Hz</p>
                      <p className="text-xs text-gray-500 mt-1">85% energy point</p>
                    </div>
                    
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Flatness</h3>
                      <p className="text-2xl font-bold text-blue-400">
                        {formatValue(analysisResults.spectralFeatures.flatness, 3)}
                      </p>
                      <p className="text-xs text-gray-400">ratio</p>
                      <p className="text-xs text-gray-500 mt-1">Noise vs tonal</p>
                    </div>
                  </div>
                </div>

                {/* Temporal Analysis */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-yellow-400">Temporal Analysis</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Zero Crossing Rate</h3>
                      <p className="text-2xl font-bold text-yellow-400">
                        {formatValue(analysisResults.temporalFeatures.zcr)}
                      </p>
                      <p className="text-xs text-gray-400">Hz</p>
                      <p className="text-xs text-gray-500 mt-1">Noisiness indicator</p>
                    </div>
                    
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Energy</h3>
                      <p className="text-2xl font-bold text-yellow-400">
                        {formatValue(analysisResults.temporalFeatures.energy, 3)}
                      </p>
                      <p className="text-xs text-gray-400">normalized</p>
                      <p className="text-xs text-gray-500 mt-1">Overall loudness</p>
                    </div>
                    
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">RMS</h3>
                      <p className="text-2xl font-bold text-yellow-400">
                        {formatValue(analysisResults.temporalFeatures.rms, 3)}
                      </p>
                      <p className="text-xs text-gray-400">amplitude</p>
                      <p className="text-xs text-gray-500 mt-1">Power measure</p>
                    </div>
                  </div>
                </div>

                {/* Harmonic Analysis */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-green-400">Harmonic Analysis</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Fundamental Pitch</h3>
                      <p className="text-2xl font-bold text-green-400">
                        {formatValue(analysisResults.harmonicFeatures.pitch)}
                      </p>
                      <p className="text-xs text-gray-400">Hz</p>
                      <p className="text-xs text-gray-500 mt-1">Base frequency</p>
                    </div>
                    
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Harmonicity</h3>
                      <p className="text-2xl font-bold text-green-400">
                        {formatValue(analysisResults.harmonicFeatures.harmonicity, 3)}
                      </p>
                      <p className="text-xs text-gray-400">ratio</p>
                      <p className="text-xs text-gray-500 mt-1">Tonal strength</p>
                    </div>
                    
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <h3 className="text-sm font-medium text-gray-300 mb-2">Inharmonicity</h3>
                      <p className="text-2xl font-bold text-green-400">
                        {formatValue(analysisResults.harmonicFeatures.inharmonicity, 3)}
                      </p>
                      <p className="text-xs text-gray-400">ratio</p>
                      <p className="text-xs text-gray-500 mt-1">Harmonic deviation</p>
                    </div>
                  </div>
                </div>

                {/* Advanced Features */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-red-400">Advanced Features</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-3">MFCC Coefficients</h3>
                      <div className="bg-gray-700 rounded p-3">
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          {analysisResults.mfcc.slice(0, 12).map((coeff, index) => (
                            <div key={index} className="text-center">
                              <div className="text-gray-400">C{index + 1}</div>
                              <div className="text-white font-mono">{formatValue(coeff, 2)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-300 mb-3">Chroma Features</h3>
                      <div className="bg-gray-700 rounded p-3">
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((note, index) => (
                            <div key={index} className="text-center">
                              <div className="text-gray-400">{note}</div>
                              <div className="text-white font-mono">
                                {formatValue(analysisResults.chroma[index] || 0, 2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
        
        {!audioFile && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">
              Ready for Audio Analysis
            </h2>
            <p className="text-gray-400">
              Upload an audio file to explore its spectral, temporal, and harmonic characteristics
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
