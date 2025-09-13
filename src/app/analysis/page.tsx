"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { AudioUploader } from "@/components/AudioUploader";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import AudioPlayer from "@/components/AudioPlayer";
import Spectrogram from "@/components/Spectrogram";
import StaggeredMenu from "@/components/StaggeredMenu";
import { AudioContextManager } from "@/lib/audio/audioUtils";
import { AudioEffectProcessor } from "@/lib/audio/audioEffects";
import { MLAudioAnalyzer } from "@/lib/audio/mlAudioAnalysis";
import { AudioFile, MLAudioFeatures } from "@/types/audio";

// CSS (paths from components per workspace)
import "@/styles/AudioUploader.css";
import "@/styles/WaveformVisualizer.css";
import "@/styles/AudioPlayer.css";

export default function AnalysisPage() {
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [analysisResults, setAnalysisResults] = useState<MLAudioFeatures | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  // loading state handled inside AudioPlayer
  const [playbackRate] = useState(1);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextManagerRef = useRef<AudioContextManager | null>(null);
  const effectProcessorRef = useRef<AudioEffectProcessor | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const handleFileUpload = useCallback(async (file: AudioFile) => {
    setAudioFile(file);
    try {
      const features = MLAudioAnalyzer.extractFeatures(file);
      setAnalysisResults(features);
    } catch (e) {
      console.error("Error analyzing audio:", e);
      setAnalysisResults(null);
    }
  }, []);

  const handleFileError = useCallback((error: string) => {
    console.error("File upload error:", error);
  }, []);

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

  const updateTime = useCallback(() => {
    if (isPlaying && contextManagerRef.current && audioFile) {
      const elapsed =
        contextManagerRef.current.getCurrentTime() - startTimeRef.current + pauseTimeRef.current;
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
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, updateTime]);

  const createAudioNodes = useCallback(async () => {
    if (!contextManagerRef.current || !effectProcessorRef.current || !audioFile) return null;
    const context = contextManagerRef.current.getContext();
    await contextManagerRef.current.resumeContext();

    const source = context.createBufferSource();
    source.buffer = audioFile.audioBuffer;
    source.playbackRate.value = playbackRate;

    const gainNode = context.createGain();
    gainNode.gain.value = 1;

    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;

    source.connect(gainNode);
    gainNode.connect(analyser);
    analyser.connect(context.destination);

    sourceRef.current = source;
    gainNodeRef.current = gainNode;
    analyserRef.current = analyser;

    return source;
  }, [audioFile, playbackRate]);

  const play = useCallback(async () => {
    if (isPlaying || !audioFile) return;
  // loading handled inside AudioPlayer
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
    } catch (e) {
      console.error("Error playing audio:", e);
    } finally {
      // no-op
    }
  }, [isPlaying, createAudioNodes, currentTime, audioFile]);

  const pause = useCallback(() => {
    if (!isPlaying || !sourceRef.current || !contextManagerRef.current) return;
    sourceRef.current.stop();
    pauseTimeRef.current =
      contextManagerRef.current.getCurrentTime() - startTimeRef.current + pauseTimeRef.current;
    setIsPlaying(false);
    sourceRef.current = null;
  }, [isPlaying]);

  // CardNav toggle removed; AudioPlayer handles play state internally

  const seek = useCallback(
    (time: number) => {
      if (!audioFile) return;
      const wasPlaying = isPlaying;
      if (wasPlaying) pause();
      pauseTimeRef.current = Math.max(0, Math.min(time, audioFile.duration));
      setCurrentTime(pauseTimeRef.current);
      if (wasPlaying) setTimeout(play, 50);
    },
    [isPlaying, pause, play, audioFile]
  );

  // formatting helper removed (not used in compact cards)

  // Removed CardNav items; analysis is shown in compact cards below

  // Menu items for navigation
  const menuItems = [
    { label: 'Beats', ariaLabel: 'Beat Generator', link: '/beats' },
    { label: 'Chords', ariaLabel: 'Chord Generator', link: '/chords' },
    { label: 'Editing', ariaLabel: 'Audio Editing', link: '/editing' },
    { label: '3D Sound', ariaLabel: '3D Sound Editor', link: '/3d-sound-editor' },
    { label: 'Plugin Matcher', ariaLabel: 'Plugin Sound Matcher', link: '/plugin-sound-matcher' }
  ];

  const socialItems = [
    { label: 'GitHub', link: 'https://github.com' },
    { label: 'LinkedIn', link: 'https://linkedin.com' }
  ];

  return (
    <main>
    <div style={{ height: '100vh', background: '#1a1a1a', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <StaggeredMenu
        position="right"
        items={menuItems}
        socialItems={socialItems}
        displaySocials={true}
        displayItemNumbering={true}
        menuButtonColor="#fff"
        openMenuButtonColor="#000"
        changeMenuColorOnOpen={true}
        colors={['#B19EEF', '#5227FF']}
        logoUrl="/logo.svg"
        accentColor="#ff6b6b"
        onMenuOpen={() => console.log('Menu opened')}
        onMenuClose={() => console.log('Menu closed')}
      />
      </div>
      <div className="container mx-auto px-4 lg:h-screen lg:overflow-hidden">

      <div className="max-w-7xl mx-auto h-full flex flex-col gap-4 py-6 overflow-y-auto lg:overflow-hidden">
        {!audioFile && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center mb-5">
            <AudioUploader onFileLoad={handleFileUpload} onError={handleFileError} className="max-w-2xl mx-auto" />
          </div>
        )}

        {audioFile && (
          <div className="bg-gray-900 rounded-lg shadow p-3">
            <AudioPlayer
              audioFile={audioFile}
              onTimeUpdate={setCurrentTime}
              onEnded={() => setIsPlaying(false)}
              onPlayStateChange={setIsPlaying}
              analyserRef={analyserRef}
              className=""
              showControls={true}
              autoPlay={false}
              loop={false}
              volume={1}
            />
          </div>
        )}

        {audioFile && (
          <div className="flex-1 min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0">
              <div className="bg-gray-800 rounded-lg p-3 h-64 lg:h-full min-h-0 flex flex-col lg:col-span-2">
                <div className="text-sm font-semibold text-blue-300 mb-2">Waveform</div>
                <div className="flex-1 min-h-0">
                  <WaveformVisualizer audioFile={audioFile} currentTime={currentTime} onSeek={seek} className="h-full" />
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 h-64 lg:h-full min-h-0 flex flex-col">
                <div className="text-sm font-semibold text-green-300 mb-2">
                  Spectrogram
                  {analyserRef.current ? (
                    <span className="ml-2 text-xs text-green-500">(Connected)</span>
                  ) : (
                    <span className="ml-2 text-xs text-yellow-500">(Waiting...)</span>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  <Spectrogram analyser={analyserRef.current} isPlaying={isPlaying} className="h-full" />
                </div>
              </div>
              {/* Compact analysis cards */}
              <div className="lg:col-span-3 grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-3">
                <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                  <div className="text-xs text-gray-400">Duration</div>
                  <div className="text-lg font-semibold text-white">{audioFile.duration.toFixed(2)}s</div>
                </div>
                <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                  <div className="text-xs text-gray-400">Sample Rate</div>
                  <div className="text-lg font-semibold text-white">{audioFile.sampleRate} Hz</div>
                </div>
                <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                  <div className="text-xs text-gray-400">Channels</div>
                  <div className="text-lg font-semibold text-white">{audioFile.channels}</div>
                </div>
                {analysisResults && (
                  <>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">Centroid</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.spectralFeatures.centroid.toFixed(0)} Hz</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">Bandwidth</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.spectralFeatures.bandwidth.toFixed(0)} Hz</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">Rolloff</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.spectralFeatures.rolloff.toFixed(0)} Hz</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">Flatness</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.spectralFeatures.flatness.toFixed(3)}</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">ZCR</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.temporalFeatures.zcr.toFixed(0)} Hz</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">Energy</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.temporalFeatures.energy.toFixed(3)}</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">RMS</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.temporalFeatures.rms.toFixed(3)}</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">Pitch</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.harmonicFeatures.pitch.toFixed(0)} Hz</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">Harmonicity</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.harmonicFeatures.harmonicity.toFixed(3)}</div>
                    </div>
                    <div className="bg-gray-800 rounded-md p-3 text-center col-span-1">
                      <div className="text-xs text-gray-400">Inharmonicity</div>
                      <div className="text-lg font-semibold text-white">{analysisResults.harmonicFeatures.inharmonicity.toFixed(3)}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </main>
  );
}
