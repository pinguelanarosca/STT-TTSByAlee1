import React from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  FastForward,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';
import { ExtensionSettings } from '../types';

interface NarrationHudProps {
  isPlaying: boolean;
  isPaused?: boolean;
  narratedText?: string;
  sourceType?: 'selection' | 'vision' | 'preview';
  speed: number;
  volume: number;
  voiceName?: string;
  onTogglePlayPause: () => void;
  onStop: () => void;
  onChangeSpeed: (newSpeed: number) => void;
  onChangeVolume: (newVolume: number) => void;
  onDismiss: () => void;
}

export const NarrationHud: React.FC<NarrationHudProps> = ({
  isPlaying,
  isPaused = false,
  narratedText = '',
  sourceType = 'selection',
  speed,
  volume,
  voiceName = 'Kore',
  onTogglePlayPause,
  onStop,
  onChangeSpeed,
  onChangeVolume,
  onDismiss,
}) => {
  if (!isPlaying && !isPaused) return null;

  const speedOptions = [0.75, 1.0, 1.25, 1.5, 2.0];
  const truncatedText =
    narratedText.length > 90 ? narratedText.substring(0, 87) + '...' : narratedText;

  return (
    <aside
      id="vocallens-narration-hud"
      aria-label="Console de Narração STT&TTS de Satiro"
      className="fixed top-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-cyan-500/40 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4"
      style={{
        boxShadow: '0 20px 40px -10px rgba(6, 182, 212, 0.25)',
      }}
    >
      {/* Cabeçalho do Card */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex h-3 w-3">
            {!isPaused ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            )}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>{isPaused ? 'Narração Pausada' : 'Narrando com Gemini (Voz Neural)'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                {voiceName}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              {sourceType === 'vision' ? 'Google Lens (Visão + Narração)' : 'Texto Selecionado (Ctrl+B)'}
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          title="Fechar painel de narração"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Onda sonora / Preview do texto */}
      <div className="mt-3 space-y-2">
        {!isPaused ? (
          <div className="flex items-center justify-center gap-1 h-6 py-1 bg-cyan-950/30 rounded-lg border border-cyan-900/40">
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.0s] h-2" />
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.1s] h-4" />
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s] h-5" />
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.3s] h-3" />
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.15s] h-6" />
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.25s] h-4" />
            <span className="w-1 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.05s] h-3" />
          </div>
        ) : (
          <div className="text-center py-1 bg-amber-950/30 rounded-lg border border-amber-900/40 text-[11px] text-amber-300 font-medium">
            Áudio pausado. Clique em Continuar para retomar.
          </div>
        )}

        {truncatedText && (
          <p className="text-[11px] text-slate-300 font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800 leading-relaxed italic">
            "{truncatedText}"
          </p>
        )}
      </div>

      {/* Controles Principais: Play/Pause, Stop */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          id="narration-play-pause-btn"
          onClick={onTogglePlayPause}
          className={`py-2 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
            isPaused
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Continuar</span>
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5 fill-current" />
              <span>Pausar</span>
            </>
          )}
        </button>

        <button
          id="narration-stop-btn"
          onClick={onStop}
          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800/60 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          <span>Parar Narração</span>
        </button>
      </div>

      {/* Controles de Ajuste Fino: Velocidade & Volume */}
      <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
        {/* Velocidade */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
            <span className="flex items-center gap-1">
              <FastForward className="h-3 w-3 text-cyan-400" />
              <span>Velocidade de Fala:</span>
            </span>
            <span className="font-bold text-cyan-300">{speed}x</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {speedOptions.map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  speed === s
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Volume */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-medium">
            <span className="flex items-center gap-1">
              {volume > 0 ? (
                <Volume2 className="h-3 w-3 text-cyan-400" />
              ) : (
                <VolumeX className="h-3 w-3 text-slate-500" />
              )}
              <span>Volume da Narração:</span>
            </span>
            <span className="font-bold text-slate-200">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </aside>
  );
};
