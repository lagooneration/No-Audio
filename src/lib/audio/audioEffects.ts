import { AudioEffect } from '@/types/audio';
import { AudioContextManager } from './audioUtils';

/**
 * Audio effects processing utilities
 */
export class AudioEffectProcessor {
  private context: AudioContext;
  private effectNodes: Map<string, AudioNode> = new Map();

  constructor() {
    this.context = AudioContextManager.getInstance().getContext();
  }

  /**
   * Create a filter effect
   */
  createFilter(params: {
    type: BiquadFilterType;
    frequency: number;
    Q: number;
    gain?: number;
  }): BiquadFilterNode {
    const filter = this.context.createBiquadFilter();
    filter.type = params.type;
    filter.frequency.value = params.frequency;
    filter.Q.value = params.Q;
    if (params.gain !== undefined) {
      filter.gain.value = params.gain;
    }
    return filter;
  }

  /**
   * Create a simple delay effect
   */
  createDelay(delayTime: number = 0.3): DelayNode {
    const delay = this.context.createDelay(1.0);
    delay.delayTime.value = delayTime;
    return delay;
  }

  /**
   * Create a gain node for volume control
   */
  createGain(gainValue: number = 1): GainNode {
    const gain = this.context.createGain();
    gain.gain.value = gainValue;
    return gain;
  }

  /**
   * Create a distortion effect
   */
  createDistortion(amount: number = 50): WaveShaperNode {
    const shaper = this.context.createWaveShaper();
    const samples = 44100;
    const curve = new Float32Array(new ArrayBuffer(samples * 4));
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    shaper.curve = curve;
    shaper.oversample = '4x';
    return shaper;
  }

  /**
   * Create a compressor effect
   */
  createCompressor(params: {
    threshold?: number;
    knee?: number;
    ratio?: number;
    attack?: number;
    release?: number;
  } = {}): DynamicsCompressorNode {
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = params.threshold ?? -24;
    compressor.knee.value = params.knee ?? 30;
    compressor.ratio.value = params.ratio ?? 12;
    compressor.attack.value = params.attack ?? 0.003;
    compressor.release.value = params.release ?? 0.25;
    return compressor;
  }

  /**
   * Create a simple reverb using convolution
   */
  createReverb(roomSize: number = 2, decay: number = 2): ConvolverNode {
    const convolver = this.context.createConvolver();
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * decay;
    const impulse = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const n = length - i;
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(n / length, roomSize);
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  /**
   * Create an EQ with multiple bands
   */
  createEQ(bands: Array<{
    frequency: number;
    gain: number;
    Q?: number;
    type?: BiquadFilterType;
  }>): BiquadFilterNode[] {
    return bands.map(band => {
      const filter = this.context.createBiquadFilter();
      filter.type = band.type || 'peaking';
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = band.Q || 1;
      return filter;
    });
  }

  /**
   * Apply basic effects chain
   */
  applyEffectsChain(
    source: AudioBufferSourceNode,
    effects: AudioEffect[],
    destination: AudioNode = this.context.destination
  ): AudioNode {
    let currentNode: AudioNode = source;

    for (const effect of effects) {
      if (!effect.enabled) continue;

      let effectNode: AudioNode;

      switch (effect.type) {
        case 'filter':
          effectNode = this.createFilter({
            type: 'lowpass',
            frequency: effect.parameters.frequency || 1000,
            Q: effect.parameters.Q || 1,
            gain: effect.parameters.gain,
          });
          break;

        case 'delay':
          effectNode = this.createDelay(effect.parameters.delayTime || 0.3);
          break;

        case 'distortion':
          effectNode = this.createDistortion(effect.parameters.amount || 50);
          break;

        case 'dynamics':
          effectNode = this.createCompressor({
            threshold: effect.parameters.threshold || -24,
            knee: effect.parameters.knee || 30,
            ratio: effect.parameters.ratio || 12,
            attack: effect.parameters.attack || 0.003,
            release: effect.parameters.release || 0.25,
          });
          break;

        case 'reverb':
          effectNode = this.createReverb(
            effect.parameters.roomSize || 2,
            effect.parameters.decay || 2
          );
          break;

        default:
          continue;
      }

      currentNode.connect(effectNode);
      currentNode = effectNode;
    }

    currentNode.connect(destination);
    return currentNode;
  }

  /**
   * Clean up effect nodes
   */
  cleanup(): void {
    this.effectNodes.forEach(node => {
      if ('disconnect' in node) {
        node.disconnect();
      }
    });
    this.effectNodes.clear();
  }
}