"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { AudioUploader } from "@/components/AudioUploader";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import AudioPlayer from "@/components/AudioPlayer";
import Spectrogram from "@/components/Spectrogram";
import Spectrogram3D from "@/components/Spectrogram3D";
import StaggeredMenu from "@/components/StaggeredMenu";
import { getMenuItemsForPage, SOCIAL_ITEMS } from "@/constants/navigation";
import { AudioContextManager } from "@/lib/audio/audioUtils";
import { AudioEffectProcessor } from "@/lib/audio/audioEffects";
import { MLAudioAnalyzer } from "@/lib/audio/mlAudioAnalysis";
import { AudioFile, MLAudioFeatures } from "@/types/audio";

// CSS imports
import "@/styles/AudioUploader.css";
import "@/styles/WaveformVisualizer.css";
import "@/styles/AudioPlayer.css";
import "@/styles/Spectrogram.css";
import "@/styles/Spectrogram3D.css";
import "./analysis.css";

export default function AnalysisPage() {
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [analysisResults, setAnalysisResults] = useState<MLAudioFeatures | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate] = useState(1);
  const [analyserVersion, setAnalyserVersion] = useState(0);

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

  // Initialize audio context and processor
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
  }, []);

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

    // Clean up previous nodes properly to prevent double playback
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch {
        // Ignore errors if already stopped
      }
      sourceRef.current = null;
    }
    
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // Ignore errors
      }
      gainNodeRef.current = null;
    }
    
    // For the analyser, we'll disconnect but keep the reference
    // This helps the spectrograms to maintain visualization
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // Ignore errors
      }
      // Don't nullify the reference - we'll reuse it to maintain visualization state
    }

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
    
    // Increment analyser version to trigger component remounts
    setAnalyserVersion(prev => prev + 1);

    return source;
  }, [audioFile, playbackRate]);

  const play = useCallback(async () => {
    if (isPlaying || !audioFile) return;
    try {
      // Always recreate audio nodes to ensure a fresh analyser
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
          
          // We DON'T nullify the analyser here
          // This allows visualization to continue even after playback ends
          
          // Increment analyzer version to make sure components stay responsive
          setAnalyserVersion(prev => prev + 1);
        }
      };
      
      setIsPlaying(true);
    } catch (e) {
      console.error("Error playing audio:", e);
      // Try to create audio nodes anyway for visualization
      createAudioNodes().catch(err => console.error("Failed to create audio nodes:", err));
    }
  }, [isPlaying, createAudioNodes, currentTime, audioFile]);

  // Initialize audio nodes when audio file changes - but only once
  useEffect(() => {
    if (audioFile && contextManagerRef.current && !analyserRef.current) {
      // Create audio nodes only if we don't have an analyser yet
      createAudioNodes().catch(err => console.error("Failed to initialize audio nodes:", err));
    }
    
    // Always ensure we have an analyzer node, even when playback has ended
    return () => {
      // We don't set analyserRef.current = null here to allow visualization to continue
    };
  }, [audioFile, createAudioNodes]);

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
      
      // Store the current analyser node reference to preserve it
      const currentAnalyser = analyserRef.current;
      
      if (wasPlaying) {
        pause();
      }
      
      pauseTimeRef.current = Math.max(0, Math.min(time, audioFile.duration));
      setCurrentTime(pauseTimeRef.current);
      
      // If was playing, recreate audio nodes and resume
      if (wasPlaying) {
        // Recreate and play with short delay to ensure clean state
        setTimeout(async () => {
          await createAudioNodes();
          play();
        }, 50);
      } else {
        // Even if not playing, we should ensure the analyser is available for visualization
        if (!analyserRef.current) {
          createAudioNodes();
        }
      }
      
      // If for some reason we lost the analyser during seeking, trigger a version update
      // This forces the spectrogram components to remount and reconnect
      if (currentAnalyser !== analyserRef.current) {
        setAnalyserVersion(prev => prev + 1);
      }
    },
    [isPlaying, pause, play, audioFile, createAudioNodes]
  );

  // Menu items for navigation (excluding current page)
  const menuItems = getMenuItemsForPage('/analysis');

  return (
    <main className="analysis-page">
      {/* StaggeredMenu with proper z-index */}
      <StaggeredMenu
        position="right"
        items={menuItems}
        socialItems={SOCIAL_ITEMS}
        displaySocials={true}
        displayItemNumbering={true}
        menuButtonColor="#fff"
        openMenuButtonColor="#000"
        changeMenuColorOnOpen={true}
        colors={['#B19EEF', '#5227FF']}
        logoUrl="/logo.svg"
        accentColor="#630fffff"
        onMenuOpen={() => console.log('Menu opened')}
        onMenuClose={() => console.log('Menu closed')}
      />

      <div className="analysis-container mt-5">
        {!audioFile && (
          <div className="uploader-container">
            <AudioUploader onFileLoad={handleFileUpload} onError={handleFileError} />
          </div>
        )}

        {audioFile && (
          <div className="analysis-content">
            {/* Audio Player Section - Always at the bottom for optimal UX */}
            <div className="audio-player-container">
              <AudioPlayer
                audioFile={audioFile}
                onTimeUpdate={setCurrentTime}
                onEnded={() => setIsPlaying(false)}
                onPlayStateChange={setIsPlaying}
                analyserRef={analyserRef}
                onSeek={seek}
                showControls={true}
                autoPlay={false}
                loop={false}
                volume={1}
              />
            </div>
            
            {/* Main Analysis Content with Visualizations and Stats */}
            <div className="visualizer-container">
              <div className="spectrogram-container">
                <div className="spectrogram-2d">
                  <Spectrogram 
                    analyser={analyserRef.current} 
                    isPlaying={isPlaying} 
                    key={`spec2d-${analyserVersion}`}
                  />
                </div>
                <div className="spectrogram-3d">
                  <Spectrogram3D 
                    analyser={analyserRef.current} 
                    isPlaying={isPlaying}
                    key={`spec3d-${analyserVersion}`}
                  />
                </div>
              </div>
              
              <div className="audio-stats-container">
                <div className="stats-grid">
                  {/* Basic Audio Information */}
                  <div className="rowy gap-2">
                  {analysisResults && (
                    <>
                      {/* <div className="stat-card">
                        <div className="stat-title">Energy</div>
                        <div className="stat-value">{analysisResults.temporalFeatures.energy.toFixed(3)}</div>
                      </div> */}
                      
                      <div className="stat-card px-5">
                        <div className="stat-value">{analysisResults.harmonicFeatures.pitch.toFixed(0)} Hz</div>
                        <div className="stat-title">Pitch</div>
                      </div>  
                      <div className="stat-card">
                        <div className="stat-value">{analysisResults.harmonicFeatures.harmonicity.toFixed(3)}</div>
                        <div className="stat-title">Harmonicity</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">{analysisResults.temporalFeatures.rms.toFixed(3)}</div>
                        <div className="stat-title">RMS</div>
                      </div>        
                    </>
                  )}
                  </div>
                </div>
                
                {/* Oscilloscope Coming Soon Section */}
                <div className="oscilloscope-container">
                  <div className="oscilloscope-header">
                    <span className="oscilloscope-title">Oscilloscope</span>
                    <span className="coming-soon-badge">Coming Soon</span>
                  </div>
                  <div className="oscilloscope-placeholder">
                    <div className="oscilloscope-line"></div>
                    <div className="oscilloscope-text">Real-time waveform visualization</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
