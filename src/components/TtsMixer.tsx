import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Play,
  Square,
  Volume2,
  VolumeX,
  Sparkles,
  Download,
  RotateCcw,
  Layers,
  Radio,
  Music,
  Zap,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Users,
  Mic,
  SlidersHorizontal,
} from 'lucide-react';
import { ExtensionSettings } from '../types';
import {
  audioMixer,
  MixerTrackConfig,
  MixerEqConfig,
  MixerCompressorConfig,
  MixerReverbConfig,
  AmbienceType,
  audioBufferToWavBlob,
} from '../utils/audioMixerEngine';
import { AudioVisualizerCanvas } from './AudioVisualizerCanvas';

interface TtsMixerProps {
  settings: ExtensionSettings;
  onUpdateSettings: (newSettings: Partial<ExtensionSettings>) => void;
}

export const TtsMixer: React.FC<TtsMixerProps> = ({
  settings,
  onUpdateSettings,
}) => {
  // Master controls
  const [masterVolume, setMasterVolume] = useState<number>(settings.ttsVolume ?? 1.0);
  const [masterMuted, setMasterMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Pronto para mixar');
  const [applySuccess, setApplySuccess] = useState(false);

  // Track 1 (Voice A)
  const [voiceA, setVoiceA] = useState<string>(settings.ttsVoice || 'Kore');
  const [trackA, setTrackA] = useState<MixerTrackConfig>({
    volume: 1.0,
    pan: -0.15,
    speed: settings.ttsSpeed ?? 1.0,
    pitchSemi: settings.ttsPitch ?? 0,
    mute: false,
    solo: false,
  });

  // Track 2 (Voice B - Dialogue / Second Speaker)
  const [enableDialogue, setEnableDialogue] = useState(false);
  const [voiceB, setVoiceB] = useState<string>('Puck');
  const [trackB, setTrackB] = useState<MixerTrackConfig>({
    volume: 1.0,
    pan: 0.25,
    speed: 1.0,
    pitchSemi: 0,
    mute: false,
    solo: false,
  });
  const [dialoguePauseGap, setDialoguePauseGap] = useState<number>(0.4); // seconds

  // Track 3 (Ambience / BGM)
  const [ambienceType, setAmbienceType] = useState<AmbienceType>(
    (settings.ttsAmbience as AmbienceType) || 'none'
  );
  const [ambienceVolume, setAmbienceVolume] = useState<number>(
    settings.ttsAmbienceVolume ?? 0.4
  );
  const [ambienceMuted, setAmbienceMuted] = useState(false);

  // DSP Rack: 3-Band Equalizer
  const [eq, setEq] = useState<MixerEqConfig>({
    bass: settings.ttsBass ?? 2,
    mid: settings.ttsMid ?? 1,
    treble: settings.ttsTreble ?? 2,
    enabled: true,
  });

  // DSP Rack: Broadcast Compressor
  const [compressor, setCompressor] = useState<MixerCompressorConfig>({
    threshold: -18,
    ratio: 3.5,
    attack: 0.005,
    release: 0.15,
    enabled: true,
  });

  // DSP Rack: Studio Reverb / Space
  const [reverb, setReverb] = useState<MixerReverbConfig>({
    roomSize: 'studio',
    wet: 0.2,
  });

  // Script text area
  const [scriptMode, setScriptMode] = useState<'solo' | 'dialogue'>('solo');
  const [soloScript, setSoloScript] = useState<string>(
    'Bem-vindo ao STT&TTS de Satiro Studio. Esta é uma demonstração do mixer de áudio profissional integrado com o Google Gemini. O equalizador de três bandas e a compressão dinâmica trazem presença e nitidez para cada palavra narrada.'
  );
  const [dialogueScript, setDialogueScript] = useState<string>(
    `[A]: Olá! Sejam muito bem-vindos ao episódio de hoje. Hoje vamos falar sobre síntese vocal em tempo real.
[B]: Com certeza, Kore! O mais impressionante é como a clareza e a entonação do modelo Gemini soam naturais.
[A]: Exatamente. E agora temos espacialização estéreo e controle total de frequências no mixer!`
  );

  // Cached decoded AudioBuffers for instant playback without re-fetching
  const cachedBuffersRef = useRef<{ [key: string]: AudioBuffer }>({});
  const lastRenderedBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize engine & sync DSP changes
  useEffect(() => {
    audioMixer.init();
    audioMixer.setOnStateChange((playing) => {
      setIsPlaying(playing);
    });

    return () => {
      audioMixer.stopAll();
    };
  }, []);

  // Update real-time Web Audio parameters
  useEffect(() => {
    audioMixer.setMasterVolume(masterMuted ? 0 : masterVolume);
  }, [masterVolume, masterMuted]);

  useEffect(() => {
    audioMixer.setEQ(eq.bass, eq.mid, eq.treble, eq.enabled);
  }, [eq]);

  useEffect(() => {
    audioMixer.setCompressor(compressor);
  }, [compressor]);

  useEffect(() => {
    audioMixer.setReverb(reverb);
  }, [reverb]);

  useEffect(() => {
    if (isPlaying && ambienceType !== 'none' && !ambienceMuted) {
      audioMixer.startAmbience(ambienceType, ambienceVolume);
    } else {
      audioMixer.stopAmbience();
    }
  }, [isPlaying, ambienceType, ambienceVolume, ambienceMuted]);

  // Mixer Presets
  const mixerPresets = [
    {
      name: '🎙️ Locutor Podcast / Rádio FM',
      apply: () => {
        setTrackA((p) => ({ ...p, speed: 1.05, pitchSemi: -1 }));
        setEq({ bass: 5, mid: 2, treble: 4, enabled: true });
        setCompressor({ threshold: -20, ratio: 4.5, attack: 0.003, release: 0.12, enabled: true });
        setReverb({ roomSize: 'studio', wet: 0.15 });
        setAmbienceType('vinyl');
        setAmbienceVolume(0.2);
        setStatusMessage('Preset "Locutor Podcast / Rádio FM" carregado!');
      },
    },
    {
      name: '🍃 Narrador Zen & Meditação',
      apply: () => {
        setVoiceA('Zephyr');
        setTrackA((p) => ({ ...p, speed: 0.85, pitchSemi: 0 }));
        setEq({ bass: 3, mid: -1, treble: 1, enabled: true });
        setCompressor({ threshold: -14, ratio: 2.0, attack: 0.01, release: 0.3, enabled: true });
        setReverb({ roomSize: 'room', wet: 0.45 });
        setAmbienceType('drone');
        setAmbienceVolume(0.35);
        setStatusMessage('Preset "Narrador Zen & Meditação" carregado!');
      },
    },
    {
      name: '⚡ Noticiário Dinâmico & Rápido',
      apply: () => {
        setVoiceA('Puck');
        setTrackA((p) => ({ ...p, speed: 1.25, pitchSemi: 1 }));
        setEq({ bass: -1, mid: 4, treble: 5, enabled: true });
        setCompressor({ threshold: -24, ratio: 5.0, attack: 0.002, release: 0.08, enabled: true });
        setReverb({ roomSize: 'off', wet: 0 });
        setAmbienceType('none');
        setStatusMessage('Preset "Noticiário Dinâmico" carregado!');
      },
    },
    {
      name: '🎧 Acessibilidade & Articulação Limpa',
      apply: () => {
        setTrackA((p) => ({ ...p, speed: 0.95, pitchSemi: 0 }));
        setEq({ bass: 0, mid: 3, treble: 2, enabled: true });
        setCompressor({ threshold: -16, ratio: 3.0, attack: 0.005, release: 0.15, enabled: true });
        setReverb({ roomSize: 'off', wet: 0 });
        setAmbienceType('none');
        setStatusMessage('Preset "Acessibilidade & Articulação" carregado!');
      },
    },
    {
      name: '👥 Podcast Duplo (Kore & Puck)',
      apply: () => {
        setScriptMode('dialogue');
        setEnableDialogue(true);
        setVoiceA('Kore');
        setVoiceB('Puck');
        setTrackA((p) => ({ ...p, pan: -0.35, speed: 1.0 }));
        setTrackB((p) => ({ ...p, pan: 0.35, speed: 1.05 }));
        setEq({ bass: 4, mid: 2, treble: 3, enabled: true });
        setReverb({ roomSize: 'studio', wet: 0.2 });
        setAmbienceType('coffee');
        setAmbienceVolume(0.25);
        setStatusMessage('Preset "Podcast Duplo" carregado!');
      },
    },
  ];

  // Helper to fetch and decode TTS audio
  const fetchAudioBuffer = async (text: string, voiceName: string): Promise<AudioBuffer> => {
    const cacheKey = `${voiceName}:${text.trim()}`;
    if (cachedBuffersRef.current[cacheKey]) {
      return cachedBuffersRef.current[cacheKey];
    }

    const res = await fetch(`${settings.serverUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: voiceName,
        instruction: settings.narratorInstruction,
        apiKey: settings.apiKey,
      }),
    });

    const data = await res.json();
    if (!data.success || !data.audioBase64) {
      throw new Error(data.error || 'Falha ao sintetizar áudio no servidor');
    }

    const buffer = await audioMixer.decodeAudio(data.audioBase64);
    cachedBuffersRef.current[cacheKey] = buffer;
    return buffer;
  };

  // Play Solo Script
  const handlePlaySolo = async () => {
    if (isPlaying) {
      audioMixer.stopAll();
      setIsPlaying(false);
      return;
    }

    try {
      setIsSynthesizing(true);
      setStatusMessage(`Sintetizando voz "${voiceA}" via Gemini TTS...`);

      const buffer = await fetchAudioBuffer(soloScript, voiceA);
      lastRenderedBufferRef.current = buffer;

      setStatusMessage('Reproduzindo com equalização e efeitos ativos');
      audioMixer.playVoiceTrack(buffer, trackA, 'A', () => {
        setStatusMessage('Reprodução finalizada');
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Erro: ${err.message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Play Dialogue Script (Sequence alternating speakers)
  const handlePlayDialogue = async () => {
    if (isPlaying) {
      audioMixer.stopAll();
      setIsPlaying(false);
      return;
    }

    try {
      setIsSynthesizing(true);
      setStatusMessage('Sintetizando diálogos com vozes alternadas...');

      // Parse lines: [A]: ... or [B]: ...
      const lines = dialogueScript
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const parsedSequence: { speaker: 'A' | 'B'; text: string }[] = [];
      for (const line of lines) {
        if (line.startsWith('[A]:') || line.startsWith('A:')) {
          parsedSequence.push({ speaker: 'A', text: line.replace(/^\[?A\]?:?\s*/i, '') });
        } else if (line.startsWith('[B]:') || line.startsWith('B:')) {
          parsedSequence.push({ speaker: 'B', text: line.replace(/^\[?B\]?:?\s*/i, '') });
        } else {
          parsedSequence.push({ speaker: 'A', text: line });
        }
      }

      if (parsedSequence.length === 0) {
        setStatusMessage('Nenhuma linha de diálogo encontrada');
        return;
      }

      // Pre-fetch all buffers
      const renderedSequence: { speaker: 'A' | 'B'; buffer: AudioBuffer }[] = [];
      for (let i = 0; i < parsedSequence.length; i++) {
        const item = parsedSequence[i];
        const voiceToUse = item.speaker === 'A' ? voiceA : voiceB;
        setStatusMessage(`Sintetizando linha ${i + 1}/${parsedSequence.length} (Voz: ${voiceToUse})...`);
        const buf = await fetchAudioBuffer(item.text, voiceToUse);
        renderedSequence.push({ speaker: item.speaker, buffer: buf });
      }

      // Sequentially play items with pause gap
      setStatusMessage('Tocando diálogo espacializado...');
      let currentIndex = 0;

      const playNextLine = () => {
        if (currentIndex >= renderedSequence.length) {
          setStatusMessage('Diálogo concluído');
          audioMixer.stopAll();
          return;
        }

        const current = renderedSequence[currentIndex];
        currentIndex++;

        const trackConfig = current.speaker === 'A' ? trackA : trackB;
        audioMixer.playVoiceTrack(current.buffer, trackConfig, current.speaker, () => {
          setTimeout(() => {
            playNextLine();
          }, dialoguePauseGap * 1000);
        });
      };

      playNextLine();
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Erro no diálogo: ${err.message}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleStop = () => {
    audioMixer.stopAll();
    setIsPlaying(false);
    setStatusMessage('Reprodução parada');
  };

  // Download mixed WAV file
  const handleDownloadWav = () => {
    const buffer = lastRenderedBufferRef.current;
    if (!buffer) {
      setStatusMessage('Toque uma prévia primeiro para carregar o áudio na memória.');
      return;
    }

    try {
      const wavBlob = audioBufferToWavBlob(buffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vocallens-mixed-${voiceA.toLowerCase()}-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('Áudio WAV exportado com sucesso!');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Erro ao exportar áudio: ${err.message}`);
    }
  };

  // Apply settings to STT&TTS de Satiro Extension
  const handleApplyToExtension = () => {
    onUpdateSettings({
      ttsVoice: voiceA,
      ttsSpeed: trackA.speed,
      ttsPitch: trackA.pitchSemi,
      ttsVolume: masterVolume,
      ttsBass: eq.bass,
      ttsMid: eq.mid,
      ttsTreble: eq.treble,
      ttsAmbience: ambienceType,
      ttsAmbienceVolume: ambienceVolume,
    });
    setApplySuccess(true);
    setStatusMessage('Configurações aplicadas com sucesso à extensão STT&TTS de Satiro!');
    setTimeout(() => setApplySuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                  Mixer de TTS Profissional
                </h1>
                <span className="text-[11px] font-bold tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full uppercase">
                  Studio DSP Rack
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Controle avançado de vozes Gemini, equalização de 3 bandas, ambiência analógica e mixagem estéreo.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            id="btn-apply-mixer-to-ext"
            onClick={handleApplyToExtension}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 transition cursor-pointer"
          >
            {applySuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Aplicado na Extensão!</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span>Aplicar ao STT&TTS de Satiro</span>
              </>
            )}
          </button>

          <button
            id="btn-download-mixed-wav"
            onClick={handleDownloadWav}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            title="Exporta o áudio renderizado em formato WAV PCM puro"
          >
            <Download className="h-4 w-4" />
            <span>Baixar .WAV</span>
          </button>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-1">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Presets de Mixagem:
        </span>
        {mixerPresets.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={preset.apply}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition cursor-pointer hover:border-slate-600"
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Real-Time Spectrum & VU Meter Monitor */}
      <AudioVisualizerCanvas isPlaying={isPlaying} />

      {/* Main Mixer Surface: Channel Strips + DSP Rack */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Channel Strips (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* TRACK 1: Master Voice A */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-black">
                  CH 1
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Voz Principal (Orador A)</h3>
                  <span className="text-[11px] text-slate-400">Canal primário de narração do Gemini</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTrackA((p) => ({ ...p, mute: !p.mute }))}
                  className={`px-2 py-1 rounded text-xs font-bold transition cursor-pointer ${
                    trackA.mute
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  MUTE
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Voice Selector */}
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                  Voz Gemini Neural
                </label>
                <select
                  value={voiceA}
                  onChange={(e) => setVoiceA(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <optgroup label="Vozes Nativas Gemini">
                    <option value="Kore">Kore — Equilibrada, Clara e Fluida</option>
                    <option value="Puck">Puck — Jovem, Enérgica e Dinâmica</option>
                    <option value="Charon">Charon — Grave, Sólida e Confiante</option>
                    <option value="Fenrir">Fenrir — Firme, Expressiva e Marcante</option>
                    <option value="Zephyr">Zephyr — Aveludada, Calma e Suave</option>
                    <option value="Aoede">Aoede — Expressiva e Rítmica</option>
                    <option value="Calliope">Calliope — Melódica e Fluida</option>
                    <option value="Orpheus">Orpheus — Narrador Clássico</option>
                  </optgroup>
                  {settings.customVoices && settings.customVoices.length > 0 && (
                    <optgroup label="⭐ Vozes Personalizadas Adicionadas">
                      {settings.customVoices.map((cv) => (
                        <option key={cv.id} value={cv.id}>
                          ⭐ {cv.name} (Base {cv.baseVoice})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Volume Fader */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-300">Volume da Voz</span>
                  <span className="font-mono text-slate-400">{Math.round(trackA.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={trackA.volume}
                  onChange={(e) => setTrackA((p) => ({ ...p, volume: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Stereo Panning */}
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-300">Panorâmica Estéreo (L / R)</span>
                  <span className="font-mono text-slate-400">
                    {trackA.pan < -0.05
                      ? `L ${Math.abs(Math.round(trackA.pan * 100))}%`
                      : trackA.pan > 0.05
                      ? `R ${Math.round(trackA.pan * 100)}%`
                      : 'Centro'}
                  </span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={trackA.pan}
                  onChange={(e) => setTrackA((p) => ({ ...p, pan: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Speed & Pitch */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-300">Velocidade (Rate)</span>
                  <span className="font-mono text-blue-400 font-bold">{trackA.speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={trackA.speed}
                  onChange={(e) => setTrackA((p) => ({ ...p, speed: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex gap-1 justify-between text-[10px]">
                  {[0.75, 1.0, 1.25, 1.5].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setTrackA((p) => ({ ...p, speed: spd }))}
                      className={`px-1.5 py-0.5 rounded ${
                        trackA.speed === spd
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* TRACK 2: Voice B (Dialogue Mode) */}
          <div className={`bg-slate-900 border rounded-xl p-5 shadow-lg transition duration-200 ${enableDialogue ? 'border-indigo-500/40' : 'border-slate-800 opacity-85'}`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-black">
                  CH 2
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    Segunda Voz / Orador B (Modo Diálogo)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Alterna oradores automaticamente em diálogos e entrevistas
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-indigo-300">
                  <input
                    type="checkbox"
                    checked={enableDialogue}
                    onChange={(e) => {
                      setEnableDialogue(e.target.checked);
                      if (e.target.checked) setScriptMode('dialogue');
                    }}
                    className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Habilitar Canal B</span>
                </label>
              </div>
            </div>

            {enableDialogue ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                    Voz do Orador B
                  </label>
                  <select
                    value={voiceB}
                    onChange={(e) => setVoiceB(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <optgroup label="Vozes Nativas Gemini">
                      <option value="Puck">Puck — Jovem e Expressivo</option>
                      <option value="Charon">Charon — Profundo e Firme</option>
                      <option value="Kore">Kore — Calmo e Didático</option>
                      <option value="Fenrir">Fenrir — Intenso e Decidido</option>
                      <option value="Zephyr">Zephyr — Suave e Fluido</option>
                      <option value="Aoede">Aoede — Expressiva e Rítmica</option>
                      <option value="Calliope">Calliope — Melódica e Fluida</option>
                      <option value="Orpheus">Orpheus — Narrador Clássico</option>
                    </optgroup>
                    {settings.customVoices && settings.customVoices.length > 0 && (
                      <optgroup label="⭐ Vozes Personalizadas Adicionadas">
                        {settings.customVoices.map((cv) => (
                          <option key={cv.id} value={cv.id}>
                            ⭐ {cv.name} (Base {cv.baseVoice})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-300">Volume Orador B</span>
                    <span className="font-mono text-slate-400">{Math.round(trackB.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={trackB.volume}
                    onChange={(e) => setTrackB((p) => ({ ...p, volume: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-300">Pan Estéreo Orador B</span>
                    <span className="font-mono text-slate-400">
                      {trackB.pan < -0.05
                        ? `L ${Math.abs(Math.round(trackB.pan * 100))}%`
                        : trackB.pan > 0.05
                        ? `R ${Math.round(trackB.pan * 100)}%`
                        : 'Centro'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={trackB.pan}
                    onChange={(e) => setTrackB((p) => ({ ...p, pan: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-300">Pausa Entre Falas</span>
                    <span className="font-mono text-indigo-400 font-bold">{dialoguePauseGap}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.1"
                    value={dialoguePauseGap}
                    onChange={(e) => setDialoguePauseGap(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-500">
                Ative o Canal B acima para mixar podcasts, roteiros com múltiplos oradores e diálogos dramatizados.
              </div>
            )}
          </div>

          {/* TRACK 3: Ambience & BGM */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs font-black">
                  BGM
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Fader de Ambiência & Trilha de Fundo</h3>
                  <span className="text-[11px] text-slate-400">Sintetizador analógico de fundo sem latência</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAmbienceMuted(!ambienceMuted)}
                className={`px-2 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  ambienceMuted
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                MUTE
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                  Tipo de Ambiência
                </label>
                <select
                  value={ambienceType}
                  onChange={(e) => setAmbienceType(e.target.value as AmbienceType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="none">Nenhuma (Voz Pura de Estúdio)</option>
                  <option value="rain">Chuva Relaxante de Fundo (Rain Noise)</option>
                  <option value="vinyl">Vinil Lo-Fi Aconchegante (Vinyl Crackle)</option>
                  <option value="coffee">Café Aconchegante (Warm Brown Noise)</option>
                  <option value="drone">Drone Harmônico Zen (Ambient Chords)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-300">Volume da Ambiência</span>
                  <span className="font-mono text-slate-400">{Math.round(ambienceVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.05"
                  value={ambienceVolume}
                  onChange={(e) => setAmbienceVolume(parseFloat(e.target.value))}
                  disabled={ambienceType === 'none'}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Studio DSP Processing Rack (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* DSP 1: 3-Band Parametric EQ */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Equalizador de 3 Bandas</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEq((p) => ({ ...p, enabled: !p.enabled }))}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded transition ${
                    eq.enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {eq.enabled ? 'ATIVO' : 'BYPASS'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Bass (80Hz) */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Graves / Proximidade (100 Hz)</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {eq.bass > 0 ? `+${eq.bass}` : eq.bass} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={eq.bass}
                  onChange={(e) => setEq((p) => ({ ...p, bass: parseInt(e.target.value, 10) }))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-[10px] text-slate-500 block">Dá peso, calor e corpo à voz</span>
              </div>

              {/* Mid (1200Hz) */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Médios / Presença (1.2 kHz)</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {eq.mid > 0 ? `+${eq.mid}` : eq.mid} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={eq.mid}
                  onChange={(e) => setEq((p) => ({ ...p, mid: parseInt(e.target.value, 10) }))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-[10px] text-slate-500 block">Eleva clareza e dicção de consoantes</span>
              </div>

              {/* Treble (6000Hz) */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Agudos / Brilho (6 kHz)</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {eq.treble > 0 ? `+${eq.treble}` : eq.treble} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={eq.treble}
                  onChange={(e) => setEq((p) => ({ ...p, treble: parseInt(e.target.value, 10) }))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-[10px] text-slate-500 block">Garante ar e acabamento de estúdio</span>
              </div>
            </div>
          </div>

          {/* DSP 2: Broadcast Dynamics Compressor */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-bold text-slate-100">Compressor Dinâmico de Rádio</h3>
              </div>

              <button
                type="button"
                onClick={() => setCompressor((p) => ({ ...p, enabled: !p.enabled }))}
                className={`text-[11px] font-bold px-2 py-0.5 rounded transition ${
                  compressor.enabled ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {compressor.enabled ? 'LIGADO' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Threshold</span>
                  <span className="font-mono text-purple-300">{compressor.threshold} dB</span>
                </div>
                <input
                  type="range"
                  min="-40"
                  max="0"
                  step="1"
                  value={compressor.threshold}
                  onChange={(e) => setCompressor((p) => ({ ...p, threshold: parseInt(e.target.value, 10) }))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Ratio</span>
                  <span className="font-mono text-purple-300">{compressor.ratio}:1</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={compressor.ratio}
                  onChange={(e) => setCompressor((p) => ({ ...p, ratio: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 block">
              Nivela picos de voz e torna a fala uniforme como em transmissões de FM e podcasts.
            </span>
          </div>

          {/* DSP 3: Reverb / Studio Spatialization */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">Espacialização & Reverb</h3>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 mb-1.5 block">Ambiente Acústico</label>
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {[
                    { id: 'off', label: 'Seco' },
                    { id: 'studio', label: 'Estúdio' },
                    { id: 'room', label: 'Sala' },
                    { id: 'hall', label: 'Auditório' },
                  ].map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setReverb((p) => ({ ...p, roomSize: room.id as any }))}
                      className={`py-1.5 rounded text-center font-medium transition cursor-pointer ${
                        reverb.roomSize === room.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {room.label}
                    </button>
                  ))}
                </div>
              </div>

              {reverb.roomSize !== 'off' && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">Intensidade (Wet Mix)</span>
                    <span className="font-mono text-cyan-400">{Math.round(reverb.wet * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={reverb.wet}
                    onChange={(e) => setReverb((p) => ({ ...p, wet: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Master Output Level */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Volume Master de Saída
              </span>
              <button
                type="button"
                onClick={() => setMasterMuted(!masterMuted)}
                className="text-slate-400 hover:text-slate-200 p-1"
                title={masterMuted ? 'Desmutar' : 'Mutar Master'}
              >
                {masterMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={masterMuted ? 0 : masterVolume}
                onChange={(e) => {
                  setMasterVolume(parseFloat(e.target.value));
                  if (masterMuted) setMasterMuted(false);
                }}
                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <span className="text-xs font-mono font-bold text-slate-200 w-12 text-right">
                {masterMuted ? '0%' : `${Math.round(masterVolume * 100)}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scripting & Audition Workspace */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-100">
              Roteiro de Teste & Execução do Mixer
            </h2>
          </div>

          {/* Script Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setScriptMode('solo')}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                scriptMode === 'solo'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Narração Solo (Orador A)
            </button>
            <button
              type="button"
              onClick={() => {
                setScriptMode('dialogue');
                setEnableDialogue(true);
              }}
              className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                scriptMode === 'dialogue'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-3 w-3" />
              <span>Diálogo / Podcast (A & B)</span>
            </button>
          </div>
        </div>

        {/* Textarea */}
        {scriptMode === 'solo' ? (
          <div>
            <textarea
              id="solo-script-textarea"
              rows={4}
              value={soloScript}
              onChange={(e) => setSoloScript(e.target.value)}
              placeholder="Digite qualquer texto para ser narrado pelo mixer de áudio..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-sans leading-relaxed resize-none"
            />
          </div>
        ) : (
          <div>
            <textarea
              id="dialogue-script-textarea"
              rows={5}
              value={dialogueScript}
              onChange={(e) => setDialogueScript(e.target.value)}
              placeholder="Use [A]: Fala da voz A e [B]: Fala da voz B..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed resize-none"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Dica: Inicie cada linha com <strong className="text-slate-400">[A]:</strong> ou <strong className="text-slate-400">[B]:</strong> para alternar automaticamente os oradores e espacialização estéreo.
            </span>
          </div>
        )}

        {/* Transport Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <button
              id="btn-play-mixer"
              type="button"
              onClick={scriptMode === 'solo' ? handlePlaySolo : handlePlayDialogue}
              disabled={isSynthesizing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {isSynthesizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Sintetizando com Gemini...</span>
                </>
              ) : isPlaying ? (
                <>
                  <Square className="h-4 w-4 text-rose-300 fill-rose-300" />
                  <span>Pausar Mixagem</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Sintetizar & Ouvir Mixagem</span>
                </>
              )}
            </button>

            {isPlaying && (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer border border-slate-700"
              >
                <Square className="h-3.5 w-3.5" />
                <span>Parar</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className={`h-2 w-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-ping' : isSynthesizing ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="font-medium text-slate-300">{statusMessage}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
