/**
 * Audio Mixer Engine utilizing Web Audio API
 * Provides multi-track routing, 3-band EQ, studio compression, reverb,
 * stereo panning, real-time frequency/waveform visualization, and ambient audio generation.
 */

export interface MixerTrackConfig {
  volume: number;       // 0 to 1
  pan: number;          // -1 (Left) to +1 (Right)
  speed: number;        // 0.5 to 2.0
  pitchSemi: number;    // -12 to +12 semitones
  mute: boolean;
  solo: boolean;
}

export interface MixerEqConfig {
  bass: number;         // -12 to +12 dB (80 Hz)
  mid: number;          // -12 to +12 dB (1000 Hz)
  treble: number;       // -12 to +12 dB (6000 Hz)
  enabled: boolean;
}

export interface MixerCompressorConfig {
  threshold: number;    // -40 to 0 dB
  ratio: number;        // 1 to 12
  attack: number;       // 0.001 to 0.1 s
  release: number;      // 0.05 to 1.0 s
  enabled: boolean;
}

export interface MixerReverbConfig {
  roomSize: 'studio' | 'room' | 'hall' | 'off';
  wet: number;          // 0 to 1
}

export type AmbienceType = 'none' | 'rain' | 'vinyl' | 'coffee' | 'drone';

class AudioMixerEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private eqBass: BiquadFilterNode | null = null;
  private eqMid: BiquadFilterNode | null = null;
  private eqTreble: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbWet: GainNode | null = null;
  private reverbDry: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  // Active audio source nodes
  private voiceSourceA: AudioBufferSourceNode | null = null;
  private voiceSourceB: AudioBufferSourceNode | null = null;
  private voiceGainA: GainNode | null = null;
  private voiceGainB: GainNode | null = null;
  private voicePanA: StereoPannerNode | null = null;
  private voicePanB: StereoPannerNode | null = null;

  // Ambient sound generator nodes
  private ambienceNodes: { stop: () => void } | null = null;
  private ambienceGain: GainNode | null = null;

  private isPlaying = false;
  private onStateChangeCallback: ((playing: boolean) => void) | null = null;

  public init() {
    if (this.ctx && this.ctx.state !== 'closed') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    // Master chain: Compressor -> EQ -> Master Gain -> Analyser -> Destination
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 8;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;

    this.eqBass = this.ctx.createBiquadFilter();
    this.eqBass.type = 'lowshelf';
    this.eqBass.frequency.value = 100;
    this.eqBass.gain.value = 2;

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1200;
    this.eqMid.Q.value = 1.0;
    this.eqMid.gain.value = 1;

    this.eqTreble = this.ctx.createBiquadFilter();
    this.eqTreble.type = 'highshelf';
    this.eqTreble.frequency.value = 6000;
    this.eqTreble.gain.value = 2;

    // Simple warm room spatialization / delay
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.045; // 45ms room slap
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.25;

    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);

    this.reverbDry = this.ctx.createGain();
    this.reverbDry.gain.value = 1.0;
    this.reverbWet = this.ctx.createGain();
    this.reverbWet.gain.value = 0.0;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // Connect DSP chain:
    // Inputs connect to compressor -> eqBass -> eqMid -> eqTreble -> (reverbDry + reverbWet) -> masterGain -> analyser -> destination
    this.compressor.connect(this.eqBass);
    this.eqBass.connect(this.eqMid);
    this.eqMid.connect(this.eqTreble);

    this.eqTreble.connect(this.reverbDry);
    this.reverbDry.connect(this.masterGain);

    this.eqTreble.connect(this.delayNode);
    this.delayNode.connect(this.reverbWet);
    this.reverbWet.connect(this.masterGain);

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  public getContext(): AudioContext | null {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public setOnStateChange(cb: (playing: boolean) => void) {
    this.onStateChangeCallback = cb;
  }

  public setMasterVolume(vol: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(2, vol)), this.ctx.currentTime);
    }
  }

  public setEQ(bass: number, mid: number, treble: number, enabled: boolean) {
    if (!this.ctx || !this.eqBass || !this.eqMid || !this.eqTreble) return;
    const t = this.ctx.currentTime;
    if (!enabled) {
      this.eqBass.gain.setValueAtTime(0, t);
      this.eqMid.gain.setValueAtTime(0, t);
      this.eqTreble.gain.setValueAtTime(0, t);
    } else {
      this.eqBass.gain.setValueAtTime(bass, t);
      this.eqMid.gain.setValueAtTime(mid, t);
      this.eqTreble.gain.setValueAtTime(treble, t);
    }
  }

  public setCompressor(cfg: MixerCompressorConfig) {
    if (!this.ctx || !this.compressor) return;
    const t = this.ctx.currentTime;
    if (!cfg.enabled) {
      this.compressor.ratio.setValueAtTime(1, t);
      this.compressor.threshold.setValueAtTime(0, t);
    } else {
      this.compressor.threshold.setValueAtTime(cfg.threshold, t);
      this.compressor.ratio.setValueAtTime(cfg.ratio, t);
      this.compressor.attack.setValueAtTime(cfg.attack, t);
      this.compressor.release.setValueAtTime(cfg.release, t);
    }
  }

  public setReverb(cfg: MixerReverbConfig) {
    if (!this.ctx || !this.reverbWet || !this.delayNode || !this.delayFeedback) return;
    const t = this.ctx.currentTime;
    if (cfg.roomSize === 'off') {
      this.reverbWet.gain.setValueAtTime(0, t);
    } else {
      const delays: Record<string, { time: number; feedback: number }> = {
        studio: { time: 0.035, feedback: 0.2 },
        room: { time: 0.065, feedback: 0.4 },
        hall: { time: 0.12, feedback: 0.65 },
      };
      const preset = delays[cfg.roomSize] || delays.studio;
      this.delayNode.delayTime.setValueAtTime(preset.time, t);
      this.delayFeedback.gain.setValueAtTime(preset.feedback, t);
      this.reverbWet.gain.setValueAtTime(cfg.wet * 0.45, t);
    }
  }

  /**
   * Generates continuous ambient audio using Web Audio synthesizers (no external MP3 required)
   */
  public startAmbience(type: AmbienceType, volume: number) {
    this.stopAmbience();
    if (type === 'none' || volume <= 0) return;

    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    this.ambienceGain = ctx.createGain();
    this.ambienceGain.gain.setValueAtTime(volume * 0.35, ctx.currentTime);
    this.ambienceGain.connect(this.masterGain);

    if (type === 'rain') {
      // Pink/Brown noise filtered for soothing rain
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 850;

      whiteNoise.connect(filter);
      filter.connect(this.ambienceGain);
      whiteNoise.start();

      this.ambienceNodes = {
        stop: () => {
          try { whiteNoise.stop(); } catch {}
        },
      };
    } else if (type === 'vinyl') {
      // Vinyl crackle + warm 100Hz rumble
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Sparse clicks
        const isClick = Math.random() > 0.9992;
        output[i] = isClick ? (Math.random() * 2 - 1) * 0.7 : (Math.random() * 0.02 - 0.01);
      }
      const crackle = ctx.createBufferSource();
      crackle.buffer = noiseBuffer;
      crackle.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      filter.Q.value = 0.8;

      crackle.connect(filter);
      filter.connect(this.ambienceGain);
      crackle.start();

      this.ambienceNodes = {
        stop: () => {
          try { crackle.stop(); } catch {}
        },
      };
    } else if (type === 'coffee') {
      // Low frequency gentle brown rumble like a distant cozy coffee shop
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (last + (0.02 * white)) / 1.02;
        last = data[i];
        data[i] *= 3.5;
      }
      const brown = ctx.createBufferSource();
      brown.buffer = buffer;
      brown.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 450;

      brown.connect(filter);
      filter.connect(this.ambienceGain);
      brown.start();

      this.ambienceNodes = {
        stop: () => {
          try { brown.stop(); } catch {}
        },
      };
    } else if (type === 'drone') {
      // Gentle harmonic meditative sine chord (C - G - C)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const chordGain = ctx.createGain();
      chordGain.gain.value = 0.2;

      osc1.frequency.value = 130.81; // C3
      osc2.frequency.value = 196.00; // G3
      osc3.frequency.value = 261.63; // C4

      osc1.connect(chordGain);
      osc2.connect(chordGain);
      osc3.connect(chordGain);
      chordGain.connect(this.ambienceGain);

      osc1.start();
      osc2.start();
      osc3.start();

      this.ambienceNodes = {
        stop: () => {
          try {
            osc1.stop();
            osc2.stop();
            osc3.stop();
          } catch {}
        },
      };
    }
  }

  public stopAmbience() {
    if (this.ambienceNodes) {
      this.ambienceNodes.stop();
      this.ambienceNodes = null;
    }
    if (this.ambienceGain) {
      try { this.ambienceGain.disconnect(); } catch {}
      this.ambienceGain = null;
    }
  }

  public setAmbienceVolume(vol: number) {
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setValueAtTime(vol * 0.35, this.ctx.currentTime);
    }
  }

  /**
   * Decode base64 audio string (WAV or PCM converted to WAV) into AudioBuffer
   */
  public async decodeAudio(base64Wav: string): Promise<AudioBuffer> {
    const ctx = this.getContext();
    if (!ctx) throw new Error('AudioContext unavailable');

    const clean = base64Wav.replace(/^data:audio\/[a-z0-9]+;base64,/, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return await ctx.decodeAudioData(bytes.buffer);
  }

  /**
   * Plays a single voice track with track volume, pan, playbackRate and pitch
   */
  public playVoiceTrack(
    buffer: AudioBuffer,
    config: MixerTrackConfig,
    trackLabel: 'A' | 'B' = 'A',
    onEnded?: () => void
  ) {
    const ctx = this.getContext();
    if (!ctx || !this.compressor) return;

    this.stopVoiceTrack(trackLabel);

    if (config.mute) {
      if (onEnded) onEnded();
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(0.5, Math.min(2.0, config.speed));
    // Detune in cents (1 semitone = 100 cents)
    source.detune.value = config.pitchSemi * 100;

    const gainNode = ctx.createGain();
    const effectiveVol = config.mute ? 0 : Math.max(0, Math.min(1.5, config.volume));
    gainNode.gain.setValueAtTime(effectiveVol, ctx.currentTime);

    const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panNode) {
      panNode.pan.setValueAtTime(Math.max(-1, Math.min(1, config.pan)), ctx.currentTime);
    }

    // Connect: source -> gain -> pan -> compressor
    if (panNode) {
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(this.compressor);
    } else {
      source.connect(gainNode);
      gainNode.connect(this.compressor);
    }

    source.onended = () => {
      this.stopVoiceTrack(trackLabel);
      if (onEnded) onEnded();
      this.checkPlayingState();
    };

    if (trackLabel === 'A') {
      this.voiceSourceA = source;
      this.voiceGainA = gainNode;
      this.voicePanA = panNode;
    } else {
      this.voiceSourceB = source;
      this.voiceGainB = gainNode;
      this.voicePanB = panNode;
    }

    source.start();
    this.isPlaying = true;
    if (this.onStateChangeCallback) this.onStateChangeCallback(true);
  }

  public stopVoiceTrack(trackLabel: 'A' | 'B' = 'A') {
    if (trackLabel === 'A') {
      if (this.voiceSourceA) {
        try { this.voiceSourceA.stop(); } catch {}
        this.voiceSourceA.disconnect();
        this.voiceSourceA = null;
      }
      if (this.voiceGainA) {
        try { this.voiceGainA.disconnect(); } catch {}
        this.voiceGainA = null;
      }
    } else {
      if (this.voiceSourceB) {
        try { this.voiceSourceB.stop(); } catch {}
        this.voiceSourceB.disconnect();
        this.voiceSourceB = null;
      }
      if (this.voiceGainB) {
        try { this.voiceGainB.disconnect(); } catch {}
        this.voiceGainB = null;
      }
    }
  }

  public stopAll() {
    this.stopVoiceTrack('A');
    this.stopVoiceTrack('B');
    this.stopAmbience();
    this.isPlaying = false;
    if (this.onStateChangeCallback) this.onStateChangeCallback(false);
  }

  private checkPlayingState() {
    if (!this.voiceSourceA && !this.voiceSourceB) {
      this.isPlaying = false;
      if (this.onStateChangeCallback) this.onStateChangeCallback(false);
    }
  }

  public isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }
}

export const audioMixer = new AudioMixerEngine();

/**
 * Converts an AudioBuffer to a WAV format Blob for download
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
