import { AudioFile, MLAudioFeatures, PluginMatch, AudioPlugin } from '@/types/audio';
import { audioUtils } from './audioUtils';

/**
 * Machine Learning Audio Analysis utilities
 */
export class MLAudioAnalyzer {
  /**
   * Extract comprehensive audio features for ML analysis
   */
  static extractFeatures(audioFile: AudioFile): MLAudioFeatures {
    const audioBuffer = audioFile.audioBuffer;
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const frameSize = 2048;

    // Extract spectral features
    const spectralFeatures = this.extractSpectralFeatures(channelData, frameSize, sampleRate);
    
    // Extract temporal features
    const temporalFeatures = this.extractTemporalFeatures(channelData, sampleRate);
    
    // Extract harmonic features
    const harmonicFeatures = this.extractHarmonicFeatures(channelData, sampleRate);
    
    // Extract MFCC, Chroma, and Tonnetz
    const mfcc = this.extractMFCC(channelData, sampleRate, frameSize);
    const chroma = this.extractChroma(channelData, sampleRate, frameSize);
    const tonnetz = this.extractTonnetz(chroma);

    return {
      spectralFeatures,
      temporalFeatures,
      harmonicFeatures,
      mfcc,
      chroma,
      tonnetz,
    };
  }

  /**
   * Extract spectral features
   */
  private static extractSpectralFeatures(
    signal: Float32Array, 
    frameSize: number, 
    sampleRate: number
  ) {
    const spectrum = audioUtils.performFFT(signal.slice(0, frameSize));
    
    // Spectral Centroid
    const centroid = audioUtils.calculateSpectralCentroid(spectrum, sampleRate);
    
    // Spectral Bandwidth
    const bandwidth = this.calculateSpectralBandwidth(spectrum, sampleRate, centroid);
    
    // Spectral Rolloff
    const rolloff = audioUtils.calculateSpectralRolloff(spectrum, sampleRate, 0.85);
    
    // Spectral Flatness
    const flatness = this.calculateSpectralFlatness(spectrum);

    return {
      centroid,
      bandwidth,
      rolloff,
      flatness,
    };
  }

  /**
   * Extract temporal features
   */
  private static extractTemporalFeatures(signal: Float32Array, sampleRate: number) {
    // Zero Crossing Rate
    let zeroCrossings = 0;
    for (let i = 1; i < signal.length; i++) {
      if ((signal[i] > 0) !== (signal[i - 1] > 0)) {
        zeroCrossings++;
      }
    }
    const zcr = zeroCrossings / (signal.length / sampleRate);

    // Energy
    const energy = signal.reduce((sum, sample) => sum + sample * sample, 0) / signal.length;

    // RMS
    const rms = Math.sqrt(energy);

    return {
      zcr,
      energy,
      rms,
    };
  }

  /**
   * Extract harmonic features
   */
  private static extractHarmonicFeatures(signal: Float32Array, sampleRate: number) {
    const frameSize = 2048;
    const spectrum = audioUtils.performFFT(signal.slice(0, frameSize));
    
    // Find fundamental frequency using autocorrelation
    const fundamental = this.findFundamentalFrequency(signal, sampleRate);
    
    // Calculate harmonicity (simplified)
    const harmonicity = this.calculateHarmonicity(spectrum, fundamental, sampleRate);
    
    // Inharmonicity (opposite of harmonicity)
    const inharmonicity = 1 - harmonicity;

    return {
      harmonicity,
      inharmonicity,
      pitch: fundamental,
    };
  }

  /**
   * Extract MFCC features
   */
  private static extractMFCC(
    signal: Float32Array, 
    sampleRate: number, 
    frameSize: number,
    numCoefficients: number = 13
  ): number[] {
    const spectrum = audioUtils.performFFT(signal.slice(0, frameSize));
    
    // Apply mel-scale filter bank (simplified)
    const melFilters = this.createMelFilterBank(frameSize / 2, sampleRate);
    const melSpectrum = this.applyMelFilters(spectrum, melFilters);
    
    // Apply logarithm
    const logMelSpectrum = melSpectrum.map(x => Math.log(x + 1e-10));
    
    // Apply DCT (simplified)
    const mfcc = this.discreteCosineTransform(logMelSpectrum, numCoefficients);
    
    return mfcc;
  }

  /**
   * Extract chroma features
   */
  private static extractChroma(
    signal: Float32Array, 
    sampleRate: number, 
    frameSize: number
  ): number[] {
    const spectrum = audioUtils.performFFT(signal.slice(0, frameSize));
    return audioUtils.calculateChroma(spectrum, sampleRate);
  }

  /**
   * Extract tonnetz features from chroma
   */
  private static extractTonnetz(chroma: number[]): number[] {
    const tonnetz: number[] = [];
    
    // Major thirds
    let major3rd = 0;
    for (let i = 0; i < 12; i++) {
      major3rd += chroma[i] * Math.cos(2 * Math.PI * i / 3);
    }
    tonnetz.push(major3rd);
    
    // Minor thirds
    let minor3rd = 0;
    for (let i = 0; i < 12; i++) {
      minor3rd += chroma[i] * Math.sin(2 * Math.PI * i / 3);
    }
    tonnetz.push(minor3rd);
    
    // Perfect fifths
    let fifth = 0;
    for (let i = 0; i < 12; i++) {
      fifth += chroma[i] * Math.cos(7 * 2 * Math.PI * i / 12);
    }
    tonnetz.push(fifth);
    
    // More complex harmonic relationships can be added here
    
    return tonnetz;
  }

  /**
   * Calculate spectral bandwidth
   */
  private static calculateSpectralBandwidth(
    spectrum: Float32Array, 
    sampleRate: number, 
    centroid: number
  ): number {
    let weightedVariance = 0;
    let totalMagnitude = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = (i * sampleRate) / (2 * spectrum.length);
      const magnitude = spectrum[i];
      weightedVariance += magnitude * Math.pow(frequency - centroid, 2);
      totalMagnitude += magnitude;
    }
    
    return totalMagnitude > 0 ? Math.sqrt(weightedVariance / totalMagnitude) : 0;
  }

  /**
   * Calculate spectral flatness
   */
  private static calculateSpectralFlatness(spectrum: Float32Array): number {
    let geometricMean = 1;
    let arithmeticMean = 0;
    let validBins = 0;
    
    for (let i = 1; i < spectrum.length; i++) { // Skip DC component
      if (spectrum[i] > 0) {
        geometricMean *= Math.pow(spectrum[i], 1 / spectrum.length);
        arithmeticMean += spectrum[i];
        validBins++;
      }
    }
    
    arithmeticMean /= validBins;
    return validBins > 0 ? geometricMean / arithmeticMean : 0;
  }

  /**
   * Find fundamental frequency using autocorrelation
   */
  private static findFundamentalFrequency(signal: Float32Array, sampleRate: number): number {
    const minPeriod = Math.floor(sampleRate / 800); // Highest expected freq: 800Hz
    const maxPeriod = Math.floor(sampleRate / 80);  // Lowest expected freq: 80Hz
    
    let maxAutocorr = 0;
    let bestPeriod = minPeriod;
    
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let autocorr = 0;
      const validSamples = signal.length - period;
      
      for (let i = 0; i < validSamples; i++) {
        autocorr += signal[i] * signal[i + period];
      }
      
      autocorr /= validSamples;
      
      if (autocorr > maxAutocorr) {
        maxAutocorr = autocorr;
        bestPeriod = period;
      }
    }
    
    return sampleRate / bestPeriod;
  }

  /**
   * Calculate harmonicity measure
   */
  private static calculateHarmonicity(
    spectrum: Float32Array, 
    fundamental: number, 
    sampleRate: number
  ): number {
    if (fundamental <= 0) return 0;
    
    let harmonicEnergy = 0;
    let totalEnergy = 0;
    const tolerance = 20; // Hz tolerance for harmonic detection
    
    for (let i = 0; i < spectrum.length; i++) {
      const frequency = (i * sampleRate) / (2 * spectrum.length);
      const energy = spectrum[i] * spectrum[i];
      totalEnergy += energy;
      
      // Check if this frequency is close to a harmonic
      const harmonicNumber = Math.round(frequency / fundamental);
      const expectedHarmonic = harmonicNumber * fundamental;
      
      if (Math.abs(frequency - expectedHarmonic) < tolerance && harmonicNumber > 0) {
        harmonicEnergy += energy;
      }
    }
    
    return totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;
  }

  /**
   * Create mel-scale filter bank
   */
  private static createMelFilterBank(numBins: number, sampleRate: number, numFilters: number = 26): number[][] {
    const melMin = this.hzToMel(0);
    const melMax = this.hzToMel(sampleRate / 2);
    const melStep = (melMax - melMin) / (numFilters + 1);
    
    const melPoints: number[] = [];
    for (let i = 0; i <= numFilters + 1; i++) {
      melPoints.push(melMin + i * melStep);
    }
    
    const hzPoints = melPoints.map(mel => this.melToHz(mel));
    const binPoints = hzPoints.map(hz => Math.floor(hz * numBins * 2 / sampleRate));
    
    const filterBank: number[][] = [];
    
    for (let i = 1; i <= numFilters; i++) {
      const filter = new Array(numBins).fill(0);
      
      for (let j = binPoints[i - 1]; j < binPoints[i]; j++) {
        filter[j] = (j - binPoints[i - 1]) / (binPoints[i] - binPoints[i - 1]);
      }
      
      for (let j = binPoints[i]; j < binPoints[i + 1]; j++) {
        filter[j] = (binPoints[i + 1] - j) / (binPoints[i + 1] - binPoints[i]);
      }
      
      filterBank.push(filter);
    }
    
    return filterBank;
  }

  /**
   * Apply mel filters to spectrum
   */
  private static applyMelFilters(spectrum: Float32Array, filterBank: number[][]): number[] {
    return filterBank.map(filter => {
      let sum = 0;
      for (let i = 0; i < Math.min(spectrum.length, filter.length); i++) {
        sum += spectrum[i] * filter[i];
      }
      return sum;
    });
  }

  /**
   * Discrete Cosine Transform (simplified)
   */
  private static discreteCosineTransform(input: number[], numCoefficients: number): number[] {
    const output: number[] = [];
    
    for (let k = 0; k < numCoefficients; k++) {
      let sum = 0;
      for (let n = 0; n < input.length; n++) {
        sum += input[n] * Math.cos(Math.PI * k * (2 * n + 1) / (2 * input.length));
      }
      output.push(sum);
    }
    
    return output;
  }

  /**
   * Convert Hz to Mel scale
   */
  private static hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Convert Mel scale to Hz
   */
  private static melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }
}

/**
 * Plugin Matcher for ML-based audio plugin recommendation
 */
export class PluginMatcher {
  private static pluginDatabase: AudioPlugin[] = [
    // Sample plugin database - in real implementation, this would be loaded from API
    {
      id: 'eq-vintage',
      name: 'Vintage EQ',
      manufacturer: 'Audio Corp',
      category: 'EQ',
      parameters: [
        { id: 'low', name: 'Low', type: 'knob', value: 0, min: -20, max: 20, default: 0, unit: 'dB' },
        { id: 'mid', name: 'Mid', type: 'knob', value: 0, min: -20, max: 20, default: 0, unit: 'dB' },
        { id: 'high', name: 'High', type: 'knob', value: 0, min: -20, max: 20, default: 0, unit: 'dB' },
      ],
      presets: [
        { id: 'bright', name: 'Bright', parameters: { low: -2, mid: 1, high: 4 }, tags: ['bright', 'crisp'] },
        { id: 'warm', name: 'Warm', parameters: { low: 3, mid: 2, high: -1 }, tags: ['warm', 'smooth'] },
      ],
    },
    {
      id: 'compressor-vintage',
      name: 'Vintage Compressor',
      manufacturer: 'Audio Corp',
      category: 'Dynamics',
      parameters: [
        { id: 'threshold', name: 'Threshold', type: 'knob', value: -10, min: -40, max: 0, default: -10, unit: 'dB' },
        { id: 'ratio', name: 'Ratio', type: 'knob', value: 4, min: 1, max: 20, default: 4, unit: ':1' },
        { id: 'attack', name: 'Attack', type: 'knob', value: 10, min: 0.1, max: 100, default: 10, unit: 'ms' },
        { id: 'release', name: 'Release', type: 'knob', value: 100, min: 10, max: 1000, default: 100, unit: 'ms' },
      ],
      presets: [
        { id: 'vocal', name: 'Vocal', parameters: { threshold: -15, ratio: 3, attack: 5, release: 50 }, tags: ['vocal', 'smooth'] },
        { id: 'drum', name: 'Drum Bus', parameters: { threshold: -8, ratio: 6, attack: 1, release: 200 }, tags: ['drums', 'punch'] },
      ],
    },
  ];

  /**
   * Find matching plugins based on audio features
   */
  static async findMatches(audioFile: AudioFile): Promise<PluginMatch[]> {
    const features = MLAudioAnalyzer.extractFeatures(audioFile);
    const matches: PluginMatch[] = [];

    for (const plugin of this.pluginDatabase) {
      const similarity = this.calculateSimilarity(features, plugin);
      const suggestedParameters = this.suggestParameters(features, plugin);
      
      matches.push({
        pluginId: plugin.id,
        similarity,
        suggestedParameters,
        confidence: this.calculateConfidence(features, plugin, similarity),
        description: this.generateDescription(features, plugin, similarity),
      });
    }

    // Sort by similarity score
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate similarity between audio features and plugin characteristics
   */
  private static calculateSimilarity(features: MLAudioFeatures, plugin: AudioPlugin): number {
    // This is a simplified similarity calculation
    // In a real implementation, this would use trained ML models
    
    let score = 0;
    
    // Spectral-based matching
    if (plugin.category === 'EQ') {
      // High frequency content suggests need for EQ
      const highFreqRatio = features.spectralFeatures.centroid / 8000;
      score += Math.min(highFreqRatio, 1) * 0.4;
      
      // Spectral flatness indicates need for frequency shaping
      score += features.spectralFeatures.flatness * 0.3;
    }
    
    if (plugin.category === 'Dynamics') {
      // High dynamic range suggests need for compression
      const dynamicRange = features.temporalFeatures.energy / (features.temporalFeatures.rms + 1e-10);
      score += Math.min(dynamicRange / 10, 1) * 0.5;
      
      // High zero crossing rate might indicate transients
      score += Math.min(features.temporalFeatures.zcr / 1000, 1) * 0.3;
    }
    
    // Harmonic content scoring
    if (plugin.category === 'Distortion' || plugin.category === 'Saturation') {
      score += (1 - features.harmonicFeatures.harmonicity) * 0.4;
    }
    
    return Math.min(score, 1);
  }

  /**
   * Suggest parameter values based on audio features
   */
  private static suggestParameters(features: MLAudioFeatures, plugin: AudioPlugin): Record<string, number> {
    const suggestions: Record<string, number> = {};
    
    for (const param of plugin.parameters) {
      switch (param.id) {
        case 'threshold':
          // Suggest threshold based on signal energy
          const energyDb = 20 * Math.log10(features.temporalFeatures.rms + 1e-10);
          suggestions[param.id] = Math.max(param.min, Math.min(param.max, energyDb - 10));
          break;
          
        case 'ratio':
          // Suggest ratio based on dynamic range
          const dynamicRange = features.temporalFeatures.energy / (features.temporalFeatures.rms + 1e-10);
          suggestions[param.id] = Math.max(param.min, Math.min(param.max, 2 + dynamicRange));
          break;
          
        case 'low':
          // Suggest low EQ based on spectral content
          const lowEnergyRatio = this.calculateBandEnergy(features.spectralFeatures, 0, 200);
          suggestions[param.id] = (lowEnergyRatio - 0.5) * 10;
          break;
          
        case 'high':
          // Suggest high EQ based on spectral content
          const highEnergyRatio = this.calculateBandEnergy(features.spectralFeatures, 5000, 20000);
          suggestions[param.id] = (highEnergyRatio - 0.5) * 10;
          break;
          
        default:
          suggestions[param.id] = param.default;
      }
    }
    
    return suggestions;
  }

  /**
   * Calculate confidence score for the match
   */
  private static calculateConfidence(
    features: MLAudioFeatures, 
    plugin: AudioPlugin, 
    similarity: number
  ): number {
    // Confidence is based on how well the features align with plugin expectations
    let confidence = similarity;
    
    // Boost confidence for clear indicators
    if (plugin.category === 'EQ' && features.spectralFeatures.flatness > 0.7) {
      confidence += 0.2;
    }
    
    if (plugin.category === 'Dynamics' && features.temporalFeatures.energy > features.temporalFeatures.rms * 5) {
      confidence += 0.3;
    }
    
    return Math.min(confidence, 1);
  }

  /**
   * Generate human-readable description of why this plugin was suggested
   */
  private static generateDescription(
    features: MLAudioFeatures, 
    plugin: AudioPlugin, 
    similarity: number
  ): string {
    const descriptions: string[] = [];
    
    if (plugin.category === 'EQ') {
      if (features.spectralFeatures.centroid > 2000) {
        descriptions.push('High frequency content detected - EQ can help balance the spectrum');
      }
      if (features.spectralFeatures.flatness < 0.3) {
        descriptions.push('Uneven frequency distribution - EQ can smooth the response');
      }
    }
    
    if (plugin.category === 'Dynamics') {
      const dynamicRange = features.temporalFeatures.energy / features.temporalFeatures.rms;
      if (dynamicRange > 5) {
        descriptions.push('High dynamic range detected - compression can control peaks');
      }
      if (features.temporalFeatures.zcr > 500) {
        descriptions.push('Transient content detected - compression can smooth dynamics');
      }
    }
    
    if (descriptions.length === 0) {
      descriptions.push(`This plugin scored ${(similarity * 100).toFixed(1)}% similarity based on audio analysis`);
    }
    
    return descriptions.join('. ');
  }

  /**
   * Calculate energy in a specific frequency band (simplified)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static calculateBandEnergy(_spectralFeatures: unknown, _lowFreq: number, _highFreq: number): number {
    // This is a simplified calculation
    // In reality, you'd need the actual spectrum to calculate band energy
    return 0.5; // Placeholder
  }

  /**
   * Get all available plugins
   */
  static getAvailablePlugins(): AudioPlugin[] {
    return this.pluginDatabase;
  }

  /**
   * Get plugin by ID
   */
  static getPlugin(id: string): AudioPlugin | undefined {
    return this.pluginDatabase.find(plugin => plugin.id === id);
  }
}