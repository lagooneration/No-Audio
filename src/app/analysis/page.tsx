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

// CSS (paths from components per workspace)
import "@/styles/AudioUploader.css";
import "@/styles/WaveformVisualizer.css";
import "@/styles/AudioPlayer.css";
import "@/styles/BentoGrid.css";
import "@/styles/Spectrogram3D.css";


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

  // Menu items for navigation (excluding current page)
  const menuItems = getMenuItemsForPage('/analysis');

  return (
    <main>
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
        accentColor="#ff6b6b"
        onMenuOpen={() => console.log('Menu opened')}
        onMenuClose={() => console.log('Menu closed')}
      />
      
      <div 
        className="min-h-screen" 
        style={{ 
          background: '#1a1a1a',
          paddingTop: '0'
        }}
      >
        <div className="container mx-auto px-4 lg:h-screen lg:overflow-hidden">

      <div className="max-w-7xl mx-auto flex flex-col gap-4 py-6 overflow-y-auto lg:overflow-hidden">
        {!audioFile && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
            <AudioUploader onFileLoad={handleFileUpload} onError={handleFileError} className="max-w-2xl mx-auto" />
          </div>
        )}

        

        {audioFile && (
          <div className="flex-1 min-h-0 mt-5">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-full">
              
              
              <div className="bg-gray-800 rounded-lg p-3 h-64 lg:h-full min-h-0 flex flex-col">
                <div className="rowy flex-1 min-h-0 gap-2">
                  {/* 2D Spectrogram - Left Half */}
                  <div className="w-1/2 h-full flex flex-col">
                    <div className="text-xs text-green-400 mb-1">
                      2D Spectrogram
                      {analyserRef.current ? (
                        <span className="ml-2 text-xs text-green-500">🟢</span>
                      ) : (
                        <span className="ml-2 text-xs text-yellow-500">🟡</span>
                      )}
                    </div>
                    <div className="flex-1 min-h-0">
                      <Spectrogram analyser={analyserRef.current} isPlaying={isPlaying} className="h-full w-full" />
                    </div>
                  </div>
                  
                  {/* 3D Spectrogram Placeholder - Right Half */}
                  <div className="w-1/2 h-full flex flex-col">
                    <div className="text-xs text-purple-400 mb-1">3D Spectrogram</div>
                    <div className="flex-1 min-h-0">
                      <Spectrogram3D className="h-full w-full" />
                    </div>
                  </div>
                </div>
              </div>

              

              {/* Analysis Results in Bento Grid Format */}
              <div className="analysis-bento-grid">
                <div className="analysis-bento">
                  {/* Basic Audio Information */}
                  <div className="stats shadow bg-gray-800">
                    <div className="stat">
                      <div className="stat-title text-gray-400">Duration</div>
                      <div className="stat-value text-white">{audioFile.duration.toFixed(2)}s</div>
                    </div>
                  </div>
                  
                  <div className="stats shadow bg-gray-800">
                    <div className="stat">
                      <div className="stat-title text-gray-400">Sample Rate</div>
                      <div className="stat-value text-white">{audioFile.sampleRate} Hz</div>
                    </div>
                  </div>
                  
                  <div className="stats shadow bg-gray-800">
                    <div className="stat">
                      <div className="stat-title text-gray-400">Channels</div>
                      <div className="stat-value text-white">{audioFile.channels}</div>
                    </div>
                  </div>

                  {/* Analysis Results */}
                  {analysisResults && (
                    <>
                      {/* <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Spectral Centroid</div>
                          <div className="stat-value text-white">{analysisResults.spectralFeatures.centroid.toFixed(0)} Hz</div>
                          <div className="stat-desc text-gray-500">Spectral brightness</div>
                        </div>
                      </div>
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Bandwidth</div>
                          <div className="stat-value text-white">{analysisResults.spectralFeatures.bandwidth.toFixed(0)} Hz</div>
                          <div className="stat-desc text-gray-500">Spectral width</div>
                        </div>
                      </div>
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Rolloff</div>
                          <div className="stat-value text-white">{analysisResults.spectralFeatures.rolloff.toFixed(0)} Hz</div>
                          <div className="stat-desc text-gray-500">Spectral energy</div>
                        </div>
                      </div>
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Spectral Flatness</div>
                          <div className="stat-value text-white">{analysisResults.spectralFeatures.flatness.toFixed(3)}</div>
                          <div className="stat-desc text-gray-500">Noise-like quality</div>
                        </div>
                      </div>
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Zero Crossing Rate</div>
                          <div className="stat-value text-white">{analysisResults.temporalFeatures.zcr.toFixed(0)} Hz</div>
                          <div className="stat-desc text-gray-500">Signal changes</div>
                        </div>
                      </div> */}
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Energy</div>
                          <div className="stat-value text-white">{analysisResults.temporalFeatures.energy.toFixed(3)}</div>
                        </div>
                      </div>
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">RMS</div>
                          <div className="stat-value text-white">{analysisResults.temporalFeatures.rms.toFixed(3)}</div>
                        </div>
                      </div>
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Pitch</div>
                          <div className="stat-value text-white">{analysisResults.harmonicFeatures.pitch.toFixed(0)} Hz</div>
                        </div>
                      </div>
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Harmonicity</div>
                          <div className="stat-value text-white">{analysisResults.harmonicFeatures.harmonicity.toFixed(3)}</div>
                        </div>
                      </div>
                      
                      <div className="stats shadow bg-gray-800">
                        <div className="stat">
                          <div className="stat-title text-gray-400">Inharmonicity</div>
                          <div className="stat-value text-white">{analysisResults.harmonicFeatures.inharmonicity.toFixed(3)}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* <div className="">
                <div className="container-card-charts">
                  <div className="card-charts">
                    <div className="main-texts mt-4">
                      <p className="title">BTC 70K</p>
                      <p className="change">-2.92%</p>
                    </div>
                    <div className="charts-lines">
                      <i className="icon-week">
                        <svg viewBox="0 0 469 262" fill="none">
                          <path
                            d="M2.5 261L6.42112 216.887C6.4726 216.308 6.69121 215.757 7.05039 215.3L11.359 209.816C11.7743 209.287 12 208.635 12 207.962V202.987C12 202.346 12.2055 201.722 12.5863 201.206L27.2479 181.342C27.4151 181.115 27.5496 180.866 27.6474 180.602L31.7748 169.458C32.2107 168.281 33.333 167.5 34.588 167.5H35.5756C37.8226 167.5 39.292 169.89 38.4086 171.956C36.1137 177.322 34.0615 183.976 36.5 185.5C39.338 187.274 43.1722 202.55 45.2823 212.494C45.6701 214.321 47.5992 215.378 49.3403 214.701L53.6761 213.015C54.5141 212.689 55.1618 212.004 55.4407 211.15L78.3519 140.954C78.45 140.653 78.5 140.339 78.5 140.023V114.385C78.5 114.129 78.5327 113.875 78.5974 113.627L95.9026 47.3728C95.9673 47.1253 96 46.8705 96 46.6147V27L102.483 117.259C102.494 117.42 102.519 117.578 102.555 117.735L108.878 144.485C108.959 144.826 109.098 145.15 109.291 145.442L117.591 158.073C118.871 160.022 121.788 159.829 122.8 157.729L131.594 139.49C132.629 137.343 135.632 137.202 136.864 139.241L147.401 156.681C148.059 157.771 149.334 158.326 150.581 158.067L170.757 153.863C171.832 153.639 172.942 154.02 173.654 154.856L187.803 171.481C189.536 173.517 192.865 172.441 193.078 169.776L199.81 85.6203C200.037 82.7832 203.718 81.8273 205.297 84.1955L227.5 117.5L230.279 122.299C231.461 124.342 234.43 124.282 235.53 122.194L237.842 117.801C237.947 117.601 238.074 117.414 238.222 117.242L261.286 90.4123C262.029 89.5473 263.199 89.1789 264.304 89.4616L280.695 93.6546C282.448 94.1029 284.196 92.9099 284.416 91.1144L294.882 6.02633C295.16 3.76377 297.761 2.62601 299.611 3.95714L322.945 20.7414C323.618 21.2254 324.061 21.9662 324.168 22.7881L335.097 106.419C335.317 108.103 336.89 109.268 338.565 108.989L365.007 104.582C366.835 104.277 368.5 105.688 368.5 107.541V116.792C368.5 117.258 368.608 117.717 368.817 118.133L385.671 151.842C386.179 152.858 387.218 153.5 388.354 153.5H393.231C393.736 153.5 394.232 153.373 394.674 153.13L406.191 146.814C407.884 145.886 409.999 146.775 410.522 148.633L418.132 175.692C418.366 176.523 418.23 177.415 417.76 178.139L412.903 185.611C412.341 186.476 412.262 187.568 412.694 188.504L426.196 217.757C426.686 218.82 427.749 219.5 428.919 219.5H439.146C440.282 219.5 441.321 220.142 441.829 221.158L454.169 245.839C454.387 246.273 454.706 246.648 455.1 246.932L467 255.5"
                            stroke="url(#paint0_linear_230_5)"
                            stroke-width="5"
                            stroke-dasharray="1500"
                          ></path>
                          <defs>
                            <linearGradient
                              id="paint0_linear_230_5"
                              x1="3"
                              y1="176"
                              x2="463"
                              y2="189"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stop-color="#89FB73" stop-opacity="0.05"></stop>
                              <stop offset="0.5" stop-color="white"></stop>
                              <stop offset="1" stop-color="#A62727" stop-opacity="0.1"></stop>
                            </linearGradient>
                          </defs>
                        </svg>
                      </i>
                      <i className="icon-month">
                        <svg fill="none" viewBox="0 0 472 170">
                          <path
                            d="M2.5 167L7.87783 124.955C7.95728 124.334 8.22911 123.753 8.65521 123.294L12.5765 119.071C13.6568 117.908 15.4565 117.788 16.682 118.797L23 124L28.9022 129.246C30.4289 130.603 32.8358 130.071 33.648 128.197L37.7169 118.807C38.1923 117.71 39.2738 117 40.4696 117H47.9618C49.192 117 50.2976 116.249 50.7508 115.105L60.1181 91.4638C60.3655 90.8394 60.8153 90.316 61.3955 89.9776L72.0575 83.7581C72.3504 83.5873 72.6122 83.368 72.8317 83.1097L77.1069 78.0801C78.7093 76.195 81.7764 76.9507 82.3195 79.3645L85.1283 91.848C85.359 92.8733 86.1094 93.7031 87.1064 94.0355L93.877 96.2923C95.1364 96.7121 96.522 96.2542 97.2833 95.1666L116.458 67.7747C116.811 67.2705 117 66.6698 117 66.0543V52C117 50.3431 118.343 49 120 49H137.857C138.88 49 139.834 49.5221 140.385 50.3848L150.824 66.7248C150.941 66.9077 151.077 67.0774 151.231 67.2309L155.012 71.0123C156.318 72.3175 158.481 72.1456 159.563 70.6505L165.937 61.8495C167.019 60.3544 169.182 60.1824 170.488 61.4877L179.121 70.1213C179.684 70.6839 180.447 71 181.243 71H200.338C200.774 71 201.205 71.0952 201.601 71.279L213.688 76.891C214.517 77.2758 215.476 77.2619 216.293 76.8533L221.342 74.3292C222.358 73.821 223 72.7822 223 71.6459V37.4669C223 36.2725 223.704 35.1822 224.827 34.7763C228.907 33.3021 234.813 32.0629 235.5 35.5C236.221 39.1067 245.127 48.1338 250.781 53.4172C251.786 54.3559 253.302 54.4654 254.446 53.7028L261.5 49L279.106 36.4903C279.97 35.8764 281.094 35.7639 282.062 36.1944L292.391 40.7847C293.384 41.2263 294.539 41.0957 295.409 40.4433L301.025 36.2309C301.65 35.7622 302.068 35.0683 302.189 34.2966L306.775 5.11153C307.114 2.95384 309.572 1.87012 311.394 3.07489L337.527 20.3567C338.153 20.7705 338.601 21.4037 338.783 22.1314L344.852 46.4092C345.222 47.8862 346.639 48.8524 348.148 48.6567L370.337 45.7804C371.627 45.6132 372.877 46.296 373.434 47.4713L376.858 54.6994C376.952 54.8992 377.069 55.0879 377.205 55.2621L388.12 69.2333C388.938 70.281 390.349 70.665 391.585 70.1768L405.789 64.5701C407.299 63.9741 409.009 64.687 409.648 66.1788L414.257 76.934C414.417 77.3074 414.5 77.7095 414.5 78.1158V84.3944C414.5 85.3975 415.001 86.3342 415.836 86.8906L437 101L456.676 112.518C457.212 112.832 457.638 113.304 457.894 113.869L469.5 139.5"
                            stroke="url(#paint0_linear_230_6)"
                            stroke-width="5"
                            stroke-dasharray="1500"
                          ></path>
                          <defs>
                            <linearGradient
                              gradientUnits="userSpaceOnUse"
                              y2="84"
                              x2="465.5"
                              y1="84"
                              x1="14"
                              id="paint0_linear_230_6"
                            >
                              <stop stop-opacity="0.1" stop-color="white"></stop>
                              <stop stop-color="white" offset="0.5"></stop>
                              <stop stop-opacity="0.1" stop-color="white" offset="1"></stop>
                            </linearGradient>
                          </defs>
                        </svg>
                      </i>
                      <div className="lines">
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>

                </div> */}
              </div>
            </div>
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


        
        </div>
      </div>
      </div>
    </main>
  );
}
