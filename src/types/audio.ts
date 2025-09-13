// Audio processing types and interfaces

export interface AudioFile {
  file: File;
  buffer: ArrayBuffer;
  audioBuffer: AudioBuffer;
  duration: number;
  sampleRate: number;
  channels: number;
  url: string;
  name: string;
  size: number;
  lastModified: number;
}

export interface WaveformData {
  peaks: Float32Array[];
  duration: number;
  sampleRate: number;
  channels: number;
  length: number;
}

export interface FrequencyData {
  frequencies: Uint8Array;
  binCount: number;
  sampleRate: number;
  nyquist: number;
}

export interface AudioAnalysis {
  rms: number;
  peak: number;
  spectralCentroid: number;
  spectralRolloff: number;
  zeroCrossingRate: number;
  mfcc: number[];
  chroma: number[];
  tempo: number;
  key: string;
  loudness: number;
}

export interface AudioEffect {
  id: string;
  name: string;
  type: 'filter' | 'delay' | 'reverb' | 'distortion' | 'modulation' | 'dynamics';
  parameters: Record<string, number>;
  enabled: boolean;
  wetness: number;
}

export interface AudioPlugin {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  parameters: PluginParameter[];
  presets: PluginPreset[];
}

export interface PluginParameter {
  id: string;
  name: string;
  type: 'knob' | 'slider' | 'toggle' | 'select';
  value: number;
  min: number;
  max: number;
  default: number;
  unit?: string;
  options?: string[];
}

export interface PluginPreset {
  id: string;
  name: string;
  parameters: Record<string, number>;
  tags: string[];
}

export interface AudioTimelineItem {
  id: string;
  type: 'audio' | 'midi' | 'automation';
  startTime: number;
  endTime: number;
  track: number;
  file?: AudioFile;
  volume: number;
  effects: AudioEffect[];
  muted: boolean;
  solo: boolean;
}

export interface BeatPattern {
  id: string;
  name: string;
  pattern: boolean[];
  tempo: number;
  timeSignature: [number, number];
  swing: number;
  sounds: BeatSound[];
}

export interface BeatSound {
  id: string;
  name: string;
  type: 'kick' | 'snare' | 'hihat' | 'cymbal' | 'percussion';
  file?: AudioFile;
  volume: number;
  pitch: number;
  pan: number;
}

export interface ChordProgression {
  id: string;
  name: string;
  chords: Chord[];
  key: string;
  mode: string;
  tempo: number;
}

export interface Chord {
  root: string;
  quality: string;
  extensions: string[];
  bass?: string;
  duration: number;
  velocity: number;
}

export interface Audio3DPosition {
  x: number;
  y: number;
  z: number;
}

export interface Audio3DSource {
  id: string;
  position: Audio3DPosition;
  file: AudioFile;
  volume: number;
  distance: number;
  cone: {
    innerAngle: number;
    outerAngle: number;
    outerGain: number;
  };
  doppler: boolean;
}

export interface AudioVisualizationSettings {
  type: 'waveform' | 'spectrum' | 'spectrogram' | '3d';
  colors: string[];
  sensitivity: number;
  smoothing: number;
  fftSize: number;
  minDecibels: number;
  maxDecibels: number;
}

export interface MLAudioFeatures {
  spectralFeatures: {
    centroid: number;
    bandwidth: number;
    rolloff: number;
    flatness: number;
  };
  temporalFeatures: {
    zcr: number;
    energy: number;
    rms: number;
  };
  harmonicFeatures: {
    harmonicity: number;
    inharmonicity: number;
    pitch: number;
  };
  mfcc: number[];
  chroma: number[];
  tonnetz: number[];
}

export interface PluginMatch {
  pluginId: string;
  similarity: number;
  suggestedParameters: Record<string, number>;
  confidence: number;
  description: string;
}

export type AudioProcessingState = 'idle' | 'loading' | 'analyzing' | 'processing' | 'error';

export interface AudioContextState {
  context: AudioContext | null;
  state: 'suspended' | 'running' | 'closed';
  sampleRate: number;
  currentTime: number;
  destination: AudioDestinationNode | null;
}

export interface AudioProcessingOptions {
  normalize: boolean;
  fadeIn: number;
  fadeOut: number;
  trim: {
    start: number;
    end: number;
  };
  effects: AudioEffect[];
}