import { AudioFile, WaveformData, AudioAnalysis } from '@/types/audio';

/**
 * AudioContext singleton manager
 */
class AudioContextManager {
  private static instance: AudioContextManager;
  private audioContext: AudioContext | null = null;
  private suspendedAt: number = 0;
  private isPlaying: boolean = false;
  private activeSources: AudioBufferSourceNode[] = [];
  private lastPauseTime: number = 0;
  private actualPlaybackStartTime: number = 0;

  private constructor() {}

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  getContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    return this.audioContext;
  }
  
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  registerSource(source: AudioBufferSourceNode, startOffset: number = 0): void {
    console.log(`AudioContextManager: Registering new source, offset: ${startOffset}`);
    this.activeSources.push(source);
    
    // Update timekeeping for accurate elapsed time calculation
    if (this.audioContext) {
      this.actualPlaybackStartTime = this.audioContext.currentTime - startOffset;
      this.lastPauseTime = startOffset;
    }
    
    // Create a wrapper for the onended callback
    const originalOnEnded = source.onended;
    
    // Replace with our own handler that manages our internal state
    source.onended = (event) => {
      console.log("AudioContextManager: Source ended");
      
      // Remove the source from our active sources
      this.activeSources = this.activeSources.filter(s => s !== source);
      
      // If we have no more active sources, we're not playing
      if (this.activeSources.length === 0) {
        console.log("AudioContextManager: No active sources left, setting isPlaying to false");
        this.isPlaying = false;
        
        // Also suspend the context to reduce CPU usage
        this.suspendContext().catch(e => console.error("Failed to suspend context after all sources ended:", e));
      }
      
      // Call the original onended if it exists
      if (typeof originalOnEnded === 'function') {
        originalOnEnded.call(source, event);
      }
    };
  }
  
  stopAllActiveSources(): void {
    // Stop all active sources
    console.log(`AudioContextManager: Stopping ${this.activeSources.length} active sources`);
    
    this.activeSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
        console.log("AudioContextManager: Error stopping source", e);
      }
    });
    
    // Clear the array
    this.activeSources = [];
    
    // Since we've stopped all sources, we're not playing anymore
    this.isPlaying = false;
  }

  async resumeContext(): Promise<void> {
    if (!this.audioContext) return;
    
    console.log("Resuming AudioContext");
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log("AudioContext resumed successfully");
        
        // Update actual playback start time to calculate elapsed time correctly
        this.actualPlaybackStartTime = this.audioContext.currentTime - this.lastPauseTime;
      } catch (error) {
        console.error("Failed to resume AudioContext:", error);
      }
    }
  }

  async suspendContext(): Promise<void> {
    if (!this.audioContext) return;
    
    console.log("Suspending AudioContext");
    if (this.audioContext.state === 'running') {
      try {
        // Record the current time before suspending
        this.suspendedAt = this.audioContext.currentTime;
        this.lastPauseTime = this.calculateElapsedTime();
        
        await this.audioContext.suspend();
        console.log("AudioContext suspended successfully");
      } catch (error) {
        console.error("Failed to suspend AudioContext:", error);
      }
    }
  }
  
  // Calculate the actual playback time taking into account pauses
  calculateElapsedTime(): number {
    if (!this.audioContext) return 0;
    
    const rawElapsed = this.audioContext.currentTime - this.actualPlaybackStartTime;
    return rawElapsed;
  }

  async closeContext(): Promise<void> {
    this.stopAllActiveSources();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
      this.suspendedAt = 0;
      this.isPlaying = false;
    }
  }

  getSampleRate(): number {
    return this.getContext().sampleRate;
  }

  getCurrentTime(): number {
    return this.getContext().currentTime;
  }
  
  getSuspendedTime(): number {
    return this.suspendedAt;
  }
  
  setPlayingState(isPlaying: boolean): void {
    console.log(`AudioContextManager: Setting isPlaying to ${isPlaying}`);
    this.isPlaying = isPlaying;
    
    // Coordinate audio context state with playback state
    if (isPlaying) {
      this.resumeContext().catch(e => console.error("Failed to resume context on state change:", e));
      this.actualPlaybackStartTime = this.audioContext ? this.audioContext.currentTime - this.lastPauseTime : 0;
    } else {
      if (this.audioContext && this.audioContext.state === 'running') {
        this.suspendContext().catch(e => console.error("Failed to suspend context on state change:", e));
      }
    }
  }
  
  getPlayingState(): boolean {
    // Double-check our understanding of playing state against the actual context state
    if (this.isPlaying && this.audioContext && this.audioContext.state !== 'running') {
      console.warn("AudioContextManager state mismatch: isPlaying=true but context is not running");
    }
    
    return this.isPlaying;
  }
  
  getActiveSourceCount(): number {
    return this.activeSources.length;
  }
}

/**
 * Audio file loading and processing utilities
 */
export const audioUtils = {
  /**
   * Load audio file and create AudioFile object
   */
  async loadAudioFile(file: File): Promise<AudioFile> {
    const buffer = await file.arrayBuffer();
    const audioContext = AudioContextManager.getInstance().getContext();
    const audioBuffer = await audioContext.decodeAudioData(buffer.slice(0));

    return {
      file,
      buffer,
      audioBuffer,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
    };
  },

  /**
   * Generate waveform data from audio buffer
   */
  generateWaveformData(audioBuffer: AudioBuffer, samples: number = 1000): WaveformData {
    const peaks: Float32Array[] = [];
    const samplesPerPixel = Math.floor(audioBuffer.length / samples);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const channelPeaks = new Float32Array(samples);

      for (let i = 0; i < samples; i++) {
        const start = i * samplesPerPixel;
        const end = Math.min(start + samplesPerPixel, channelData.length);
        
        let min = 0;
        let max = 0;
        
        for (let j = start; j < end; j++) {
          const value = channelData[j];
          if (value > max) max = value;
          if (value < min) min = value;
        }
        
        channelPeaks[i] = Math.max(Math.abs(min), Math.abs(max));
      }

      peaks.push(channelPeaks);
    }

    return {
      peaks,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
    };
  },

  /**
   * Analyze audio buffer for various audio features
   */
  analyzeAudio(audioBuffer: AudioBuffer): AudioAnalysis {
    const channelData = audioBuffer.getChannelData(0);
    const length = channelData.length;
    const sampleRate = audioBuffer.sampleRate;

    // RMS (Root Mean Square)
    let rmsSum = 0;
    let peak = 0;
    let zeroCrossings = 0;

    for (let i = 0; i < length; i++) {
      const sample = channelData[i];
      rmsSum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      
      if (i > 0 && ((channelData[i-1] > 0) !== (sample > 0))) {
        zeroCrossings++;
      }
    }

    const rms = Math.sqrt(rmsSum / length);
    const zeroCrossingRate = zeroCrossings / (length / sampleRate);

    // FFT for spectral analysis
    const fftSize = 2048;
    const fftData = this.performFFT(channelData.slice(0, fftSize));
    const spectralCentroid = this.calculateSpectralCentroid(fftData, sampleRate);
    const spectralRolloff = this.calculateSpectralRolloff(fftData, sampleRate);

    return {
      rms,
      peak,
      spectralCentroid,
      spectralRolloff,
      zeroCrossingRate,
      mfcc: this.calculateMFCC(fftData),
      chroma: this.calculateChroma(fftData, sampleRate),
      tempo: this.estimateTempo(channelData, sampleRate),
      key: this.estimateKey(fftData, sampleRate),
      loudness: this.calculateLoudness(rms),
    };
  },

  /**
   * Simple FFT implementation for spectral analysis
   */
  performFFT(signal: Float32Array): Float32Array {
    const N = signal.length;
    const spectrum = new Float32Array(N / 2);
    
    // Simple magnitude spectrum calculation
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += signal[n] * Math.cos(angle);
        imag += signal[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  },

  /**
   * Calculate spectral centroid
   */
  calculateSpectralCentroid(spectrum: Float32Array, sampleRate: number): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = (i * sampleRate) / (2 * spectrum.length);
      weightedSum += frequency * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  },

  /**
   * Calculate spectral rolloff
   */
  calculateSpectralRolloff(spectrum: Float32Array, sampleRate: number, threshold: number = 0.85): number {
    const totalEnergy = spectrum.reduce((sum, magnitude) => sum + magnitude * magnitude, 0);
    const rolloffEnergy = totalEnergy * threshold;
    
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i] * spectrum[i];
      if (cumulativeEnergy >= rolloffEnergy) {
        return (i * sampleRate) / (2 * spectrum.length);
      }
    }
    
    return sampleRate / 2;
  },

  /**
   * Calculate MFCC (simplified version)
   */
  calculateMFCC(spectrum: Float32Array): number[] {
    const numCoefficients = 13;
    const mfcc = new Array(numCoefficients).fill(0);
    
    // This is a simplified MFCC calculation
    // In a real implementation, you'd use mel-scale filtering and DCT
    const logSpectrum = spectrum.map(x => Math.log(x + 1e-10));
    
    for (let i = 0; i < numCoefficients && i < logSpectrum.length; i++) {
      mfcc[i] = logSpectrum[i];
    }
    
    return mfcc;
  },

  /**
   * Calculate chroma features
   */
  calculateChroma(spectrum: Float32Array, sampleRate: number): number[] {
    const chroma = new Array(12).fill(0);
    const A4_FREQ = 440;
    
    for (let i = 1; i < spectrum.length; i++) {
      const frequency = (i * sampleRate) / (2 * spectrum.length);
      if (frequency > 80 && frequency < 8000) {
        const pitch = 12 * Math.log2(frequency / A4_FREQ) + 69;
        const chromaIndex = Math.round(pitch) % 12;
        if (chromaIndex >= 0 && chromaIndex < 12) {
          chroma[chromaIndex] += spectrum[i];
        }
      }
    }
    
    // Normalize
    const sum = chroma.reduce((a, b) => a + b, 0);
    return sum > 0 ? chroma.map(x => x / sum) : chroma;
  },

  /**
   * Estimate tempo using autocorrelation
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  estimateTempo(_signal: Float32Array, _sampleRate: number): number {
    // This is a simplified tempo estimation
    // Real implementation would use onset detection and autocorrelation
    // For now, return a default tempo
    return 120;
  },

  /**
   * Estimate musical key
   */
  estimateKey(spectrum: Float32Array, sampleRate: number): string {
    const chroma = this.calculateChroma(spectrum, sampleRate);
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Find the chroma bin with maximum energy
    let maxIndex = 0;
    for (let i = 1; i < chroma.length; i++) {
      if (chroma[i] > chroma[maxIndex]) {
        maxIndex = i;
      }
    }
    
    return keys[maxIndex];
  },

  /**
   * Calculate loudness in LUFS (simplified)
   */
  calculateLoudness(rms: number): number {
    return 20 * Math.log10(rms + 1e-10);
  },

  /**
   * Normalize audio buffer
   */
  normalizeAudio(audioBuffer: AudioBuffer): AudioBuffer {
    const audioContext = AudioContextManager.getInstance().getContext();
    const normalizedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = normalizedBuffer.getChannelData(channel);
      
      // Find peak
      let peak = 0;
      for (let i = 0; i < inputData.length; i++) {
        peak = Math.max(peak, Math.abs(inputData[i]));
      }
      
      // Normalize
      const normalizationFactor = peak > 0 ? 1 / peak : 1;
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i] * normalizationFactor;
      }
    }

    return normalizedBuffer;
  },

  /**
   * Apply fade in/out to audio buffer
   */
  applyFade(audioBuffer: AudioBuffer, fadeInDuration: number = 0, fadeOutDuration: number = 0): AudioBuffer {
    const audioContext = AudioContextManager.getInstance().getContext();
    const fadedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const fadeInSamples = Math.floor(fadeInDuration * audioBuffer.sampleRate);
    const fadeOutSamples = Math.floor(fadeOutDuration * audioBuffer.sampleRate);

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = fadedBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        let gain = 1;
        
        // Fade in
        if (i < fadeInSamples) {
          gain *= i / fadeInSamples;
        }
        
        // Fade out
        if (i >= inputData.length - fadeOutSamples) {
          gain *= (inputData.length - i) / fadeOutSamples;
        }
        
        outputData[i] = inputData[i] * gain;
      }
    }

    return fadedBuffer;
  },

  /**
   * Convert time to samples
   */
  timeToSamples(time: number, sampleRate: number): number {
    return Math.floor(time * sampleRate);
  },

  /**
   * Convert samples to time
   */
  samplesToTime(samples: number, sampleRate: number): number {
    return samples / sampleRate;
  },

  /**
   * Format time as MM:SS.mmm
   */
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  },
};

// Export the AudioContextManager for use in other files
export { AudioContextManager };