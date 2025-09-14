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

  // Clean up previous nodes properly to prevent double playback
  const cleanupAudioNodes = useCallback(() => {
    // Stop all active sources from the context manager first
    if (contextManagerRef.current) {
      contextManagerRef.current.stopAllActiveSources();
    }
    
    // Clean up source node
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch {
        // Ignore errors if already stopped
      }
      sourceRef.current = null;
    }
    
    // Clean up gain node
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch {
        // Ignore errors
      }
      gainNodeRef.current = null;
    }
    
    // For the analyser, we'll disconnect but keep the reference
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // Ignore errors
      }
      // We keep the reference for visualization purposes
    }
  }, []);

  const updateTime = useCallback(() => {
    if (!contextManagerRef.current || !audioFile) return;
    
    // Only update time if the context manager also thinks we're playing
    if (isPlaying && contextManagerRef.current.getPlayingState()) {
      // Check if audio context is actually running
      const context = contextManagerRef.current.getAudioContext();
      if (context && context.state !== 'running') {
        console.log(`AudioContext state is ${context.state} but we think we're playing - resuming`);
        contextManagerRef.current.resumeContext().catch(err => console.warn("Failed to resume context:", err));
      }
      
      // Use the context manager's elapsed time calculation which accounts for pauses
      const elapsed = contextManagerRef.current.calculateElapsedTime();
      const newCurrentTime = Math.min(elapsed, audioFile.duration);
      
      // Update UI time only if it's significantly different to reduce renders
      if (Math.abs(newCurrentTime - currentTime) > 0.01) {
        setCurrentTime(newCurrentTime);
      }
      
      // Check if we've reached the end (with a small threshold to account for precision)
      if (Math.abs(newCurrentTime - audioFile.duration) < 0.1) {
        console.log("Animation loop detected end of audio");
        
        // Stop playback completely
        cleanupAudioNodes();
        
        // Reset state
        setIsPlaying(false);
        setCurrentTime(0);
        pauseTimeRef.current = 0;
        startTimeRef.current = 0;
        
        // Update context manager
        contextManagerRef.current.setPlayingState(false);
        
        // Trigger an analyzer version update
        setAnalyserVersion(prev => prev + 1);
      } else {
        // Continue animation loop
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    } else if (isPlaying) {
      // Our state thinks we're playing but context manager doesn't - fix inconsistency
      console.warn("Playback state mismatch detected - resetting state");
      setIsPlaying(false);
      
      // Ensure clean state
      cleanupAudioNodes();
      
      // Update analyzer version to refresh visualizations
      setAnalyserVersion(prev => prev + 1);
    }
  }, [isPlaying, audioFile, cleanupAudioNodes, currentTime]);

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

    // Clean up previous nodes to prevent double playback
    cleanupAudioNodes();

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
  }, [audioFile, playbackRate, cleanupAudioNodes]);

  const play = useCallback(async () => {
    if (!audioFile) return;
    
    console.log(`Play called. Current time: ${currentTime}, Pause time: ${pauseTimeRef.current}`);
    
    try {
      // If audio previously completed playback and is at the end or close to it
      const isAtEnd = Math.abs(currentTime - audioFile.duration) < 0.1;
      if (isAtEnd) {
        console.log("Restarting playback from beginning after completion");
        pauseTimeRef.current = 0;
        setCurrentTime(0);
      }
      
      // Always clean up existing nodes first to prevent double playback
      cleanupAudioNodes();
      
      // Set the state BEFORE creating nodes to prevent race conditions
      setIsPlaying(true);
      
      // Then create new audio nodes
      const source = await createAudioNodes();
      if (!source || !contextManagerRef.current) {
        // If we failed to create nodes, reset state
        setIsPlaying(false);
        return;
      }
      
      // Make sure we resume the context
      await contextManagerRef.current.resumeContext();
      
      // Use pauseTimeRef.current to start from the correct position
      const currentTimeValue = pauseTimeRef.current;
      console.log(`Starting playback from: ${currentTimeValue}`);
      
      // Register the source with the context manager - pass the start offset for accurate time tracking
      contextManagerRef.current.registerSource(source, currentTimeValue);
      contextManagerRef.current.setPlayingState(true);
      
      // Start playback from the pause position
      source.start(0, currentTimeValue);
      
      // Record the start time to calculate elapsed time later
      startTimeRef.current = contextManagerRef.current.getCurrentTime();
      
      source.onended = () => {
        // When audio naturally ends, we need to perform a complete cleanup
        // This check makes sure we don't trigger this for seek operations
        // We use a small threshold (0.1s) to account for floating point imprecision
        if (Math.abs(pauseTimeRef.current - audioFile.duration) < 0.1 || 
            Math.abs(currentTime - audioFile.duration) < 0.1) {
          console.log("Audio reached end naturally");
          
          // Perform full cleanup
          cleanupAudioNodes();
          
          // Reset all state
          setIsPlaying(false);
          setCurrentTime(0);
          pauseTimeRef.current = 0;
          startTimeRef.current = 0;
          
          // Update context manager state
          if (contextManagerRef.current) {
            contextManagerRef.current.setPlayingState(false);
          }
          
          // Trigger an analyzer version update to refresh visualizations
          setAnalyserVersion(prev => prev + 1);
        }
      };
    } catch (e) {
      console.error("Error playing audio:", e);
      // Reset state on error
      setIsPlaying(false);
      
      // Cleanup and try to create audio nodes anyway for visualization
      cleanupAudioNodes();
      createAudioNodes().catch(err => console.error("Failed to create audio nodes:", err));
    }
  }, [createAudioNodes, currentTime, audioFile, cleanupAudioNodes]);

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
    if (!isPlaying) return;
    
    console.log("Pausing audio playback");
    
    // Calculate current pause time before stopping
    if (contextManagerRef.current) {
      // Use the AudioContext's current time for precision
      const audioContextTime = contextManagerRef.current.getCurrentTime();
      pauseTimeRef.current = audioContextTime - startTimeRef.current + pauseTimeRef.current;
      console.log(`Pause time calculated: ${pauseTimeRef.current}`);
      
      // Also suspend the audio context to ensure it stops completely
      contextManagerRef.current.suspendContext().catch(err => {
        console.warn("Failed to suspend audio context:", err);
      });
    }
    
    // Stop all playback
    cleanupAudioNodes();
    
    // Update context manager state
    if (contextManagerRef.current) {
      contextManagerRef.current.setPlayingState(false);
    }
    
    // Update component state
    setIsPlaying(false);
    
    // Cancel any pending animation frames to stop time updates
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isPlaying, cleanupAudioNodes]);

  // CardNav toggle removed; AudioPlayer handles play state internally

  const seek = useCallback(
    (time: number) => {
      if (!audioFile) return;
      
      console.log(`Seeking to time: ${time}`);
      
      // Record if we were playing before seeking
      const wasPlaying = isPlaying;
      
      // Always stop current playback first
      if (isPlaying) {
        // If we were playing, pause first to update pauseTimeRef
        pause();
      }
      
      // Always clean up existing nodes to prevent double playback
      cleanupAudioNodes();
      
      // Update time position
      pauseTimeRef.current = Math.max(0, Math.min(time, audioFile.duration));
      setCurrentTime(pauseTimeRef.current);
      
      // Force context manager to recognize state change
      if (contextManagerRef.current) {
        contextManagerRef.current.setPlayingState(false);
      }
      
      // Use setTimeout to ensure state updates have propagated
      setTimeout(async () => {
        // Always recreate audio nodes for fresh state
        await createAudioNodes();
        
        // If we were playing before, resume playback
        if (wasPlaying) {
          play();
        } else {
          // Just update analyzer version to ensure spectrograms reconnect
          setAnalyserVersion(prev => prev + 1);
        }
      }, 50);
    },
    [isPlaying, pause, play, audioFile, createAudioNodes, cleanupAudioNodes]
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
                
                
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
