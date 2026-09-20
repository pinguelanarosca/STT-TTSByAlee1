import React, { useState, useEffect } from 'react';
import {
  Mic,
  Send,
  Sparkles,
  Check,
  Copy,
  AlertCircle,
  X,
  CornerDownLeft,
  Volume2,
  Sliders,
  Play,
  Square,
  History,
  Clock,
  ChevronRight,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { ExtensionSettings, NarrationLog, RecordingStatus } from '../types';

interface RecordingHudProps {
  status: RecordingStatus;
  targetFieldId: string | null;
  targetFieldName?: string;
  transcribedText?: string;
  durationSeconds: number;
  settings: ExtensionSettings;
  onUpdateSettings?: (settings: Partial<ExtensionSettings>) => void;
  recentLogs?: NarrationLog[];
  onPlayTts?: (text: string, voice?: string) => void;
  onStopTts?: () => void;
  isTtsPlaying?: boolean;
  onStopRecording: () => void;
  onDismiss: () => void;
  onInsertIntoField?: (fieldId: string) => void;
}

export const RecordingHud: React.FC<RecordingHudProps> = ({
  status,
  targetFieldId,
  targetFieldName,
  transcribedText,
  durationSeconds,
  settings,
  onUpdateSettings,
  recentLogs = [],
  onPlayTts,
  onStopTts,
  isTtsPlaying = false,
  onStopRecording,
  onDismiss,
  onInsertIntoField,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'tts' | 'history'>('status');
  const [copied, setCopied] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [waitingForFieldClick, setWaitingForFieldClick] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Troca para a aba de status sempre que a gravação mudar de estado ativo
  useEffect(() => {
    if (status !== 'idle') {
      setActiveTab('status');
      setIsMinimized(false);
    }
  }, [status]);

  // Formatação do timer 00:00
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleCopy = async () => {
    if (transcribedText) {
      try {
        const prev = await navigator.clipboard.readText().catch(() => '');
        await navigator.clipboard.writeText(transcribedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);

        // Se havia conteúdo anterior no clipboard, restaura após colar ou 10s
        if (prev && prev !== transcribedText) {
          const restoreOnPaste = () => {
            window.removeEventListener('paste', restoreOnPaste, true);
            setTimeout(async () => {
              try {
                await navigator.clipboard.writeText(prev);
                console.log('[STT&TTS de Satiro] Clipboard anterior restaurado com sucesso.');
              } catch (e) {}
            }, 300);
          };
          window.addEventListener('paste', restoreOnPaste, true);
          setTimeout(() => {
            window.removeEventListener('paste', restoreOnPaste, true);
          }, 10000);
        }
      } catch (err) {
        console.warn('Erro ao copiar:', err);
      }
    }
  };

  const handleCopyLogText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 1800);
  };

  // Se o usuário clicar em "Inserir no campo clicado" quando não havia alvo
  useEffect(() => {
    if (!waitingForFieldClick || !transcribedText || !onInsertIntoField) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        const id = target.id;
        if (id) {
          onInsertIntoField(id);
          setWaitingForFieldClick(false);
        }
      }
    };

    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, [waitingForFieldClick, transcribedText, onInsertIntoField]);

  if (status === 'idle' && isMinimized) return null;

  // Transcrições recentes para a mini-lista
  const transcriptionLogs = recentLogs.filter((l) => l.type === 'transcription').slice(0, 4);

  return (
    <aside
      id="vocallens-hud-container"
      aria-label="Console e Status STT&TTS de Satiro"
      className="fixed top-4 right-4 z-50 w-92 max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl transition-all duration-300 backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-top-4"
      style={{
        backgroundColor:
          status === 'recording'
            ? 'rgba(24, 10, 10, 0.96)'
            : status === 'ready'
            ? 'rgba(10, 24, 18, 0.96)'
            : 'rgba(15, 23, 42, 0.96)',
        borderColor:
          status === 'recording'
            ? '#ef4444'
            : status === 'sending'
            ? '#38bdf8'
            : status === 'processing'
            ? '#a855f7'
            : status === 'ready'
            ? '#10b981'
            : '#334155',
      }}
    >
      {/* Barra de Topo do Balão com Navegação em Mini-Abas */}
      <div
        className="px-3.5 py-2.5 border-b flex items-center justify-between gap-2"
        style={{
          borderColor:
            status === 'recording'
              ? 'rgba(239, 68, 68, 0.25)'
              : status === 'ready'
              ? 'rgba(16, 185, 129, 0.25)'
              : 'rgba(51, 65, 85, 0.6)',
        }}
      >
        {/* Indicador de Status / Mini Abas */}
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-medium">
          <button
            id="hud-tab-status-btn"
            onClick={() => setActiveTab('status')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'status'
                ? status === 'recording'
                  ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                  : 'bg-slate-800 text-blue-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {status === 'recording' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <span>Gravando {formattedTime}</span>
              </>
            ) : status === 'sending' ? (
              <>
                <span className="h-2 w-2 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                <span>Enviando...</span>
              </>
            ) : status === 'processing' ? (
              <>
                <Sparkles className="h-3 w-3 text-purple-400 animate-spin" />
                <span>Processando...</span>
              </>
            ) : status === 'ready' ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span>Transcrito!</span>
              </>
            ) : (
              <>
                <Mic className="h-3 w-3" />
                <span>Microfone</span>
              </>
            )}
          </button>

          <button
            id="hud-tab-tts-btn"
            onClick={() => setActiveTab('tts')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tts'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="h-3 w-3 text-cyan-400" />
            <span>Console TTS</span>
          </button>

          <button
            id="hud-tab-history-btn"
            onClick={() => setActiveTab('history')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-3 w-3 text-purple-400" />
            <span>Histórico</span>
            {transcriptionLogs.length > 0 && (
              <span className="text-[10px] px-1 rounded-full bg-slate-800 text-slate-300 font-bold">
                {transcriptionLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Botão de Fechar Balão */}
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer shrink-0"
          title="Fechar balão"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ABA 1: STATUS DE GRAVAÇÃO / PAUSE BREAK */}
      {activeTab === 'status' && (
        <div className="p-4 space-y-3">
          {status === 'recording' && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Campo Alvo:</span>
                {targetFieldId ? (
                  <span className="font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded text-[11px] truncate max-w-[180px]">
                    {targetFieldName || targetFieldId}
                  </span>
                ) : (
                  <span className="font-medium text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded text-[11px]">
                    Nenhum campo em foco (Livre)
                  </span>
                )}
              </div>

              {/* Ondas sonoras animadas */}
              <div className="flex items-center justify-center gap-1.5 h-8 py-1">
                <span className="w-1 bg-rose-500 rounded-full animate-bounce [animation-delay:0.0s] h-3" />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce [animation-delay:0.15s] h-6" />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce [animation-delay:0.3s] h-8" />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce [animation-delay:0.1s] h-5" />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce [animation-delay:0.25s] h-7" />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce [animation-delay:0.05s] h-4" />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce [animation-delay:0.2s] h-6" />
              </div>

              <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                Fale ao microfone. Pressione <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono">Pause</kbd> para finalizar e digitar no campo.
              </p>

              <button
                id="hud-stop-recording-btn"
                onClick={onStopRecording}
                className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold shadow-md shadow-rose-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Mic className="h-3.5 w-3.5" />
                <span>Concluir Gravação</span>
              </button>
            </>
          )}

          {status === 'sending' && (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2 text-xs text-blue-300 font-medium">
                <Send className="h-4 w-4 text-blue-400" />
                <span>Codificando e enviando áudio para o servidor...</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full w-2/3 animate-pulse" />
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2 text-xs text-purple-300 font-medium">
                <Sparkles className="h-4 w-4 text-purple-400 animate-spin" />
                <span>Modelo Gemini transcrevendo e pontuando...</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full w-5/6 animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-400">
                Formatando gramática, pontuação e removendo ruídos de fala.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-200 text-xs font-mono leading-relaxed max-h-32 overflow-y-auto">
                "{transcribedText || 'Nenhum texto detectado.'}"
              </div>

              {targetFieldId ? (
                <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/60">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Inserido no campo <strong>{targetFieldName || targetFieldId}</strong>
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Pronto para digitar!</span>
                      <span className="text-[11px] text-amber-300/80">
                        Nenhum campo estava em foco no início da fala.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleCopy}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setWaitingForFieldClick(!waitingForFieldClick)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        waitingForFieldClick
                          ? 'bg-blue-600 text-white animate-pulse border border-blue-400'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <CornerDownLeft className="h-3.5 w-3.5" />
                      <span>{waitingForFieldClick ? 'Clique no Campo...' : 'Digitar no Campo'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'idle' && (
            <div className="text-center py-3 space-y-2 text-xs text-slate-400">
              <div className="p-2.5 rounded-full bg-slate-800/80 w-fit mx-auto text-rose-400">
                <Mic className="h-5 w-5" />
              </div>
              <p>
                Microfone em repouso. Clique em qualquer campo e tecle <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono">Pause</kbd> para gravar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: PEQUENO CONSOLE DE CONTROLE DO TTS (Solicitado pelo usuário) */}
      {activeTab === 'tts' && (
        <div className="p-4 space-y-3.5 text-xs">
          {/* Seleção de Voz mantida */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-semibold flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                Voz Gemini
              </span>
              <span className="text-[11px] text-cyan-300 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
                {settings.ttsVoice}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as const).map((voice) => (
                <button
                  key={voice}
                  onClick={() => onUpdateSettings && onUpdateSettings({ ttsVoice: voice })}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-medium text-center transition cursor-pointer ${
                    settings.ttsVoice === voice
                      ? 'bg-cyan-600 text-white font-bold shadow-sm'
                      : 'bg-slate-800/90 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                  title={`Selecionar voz ${voice}`}
                >
                  {voice}
                </button>
              ))}
            </div>
          </div>

          {/* Mini Controle de Velocidade */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span>Velocidade de Fala</span>
              <span className="font-mono text-cyan-400 text-[11px]">
                {(settings.ttsSpeed ?? 1.0).toFixed(1)}x
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.8, 1.0, 1.2, 1.5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => onUpdateSettings && onUpdateSettings({ ttsSpeed: speed })}
                  className={`py-1 rounded-md text-[11px] font-mono transition cursor-pointer ${
                    (settings.ttsSpeed ?? 1.0) === speed
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>

          {/* Mini Controle de Volume */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span>Volume da Narração</span>
              <span className="font-mono text-slate-400 text-[11px]">
                {Math.round((settings.ttsVolume ?? 1.0) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.ttsVolume ?? 1.0}
              onChange={(e) =>
                onUpdateSettings && onUpdateSettings({ ttsVolume: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
            />
          </div>

          {/* Botões de Ação de Áudio (Play / Pause / Stop) */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            {isTtsPlaying ? (
              <button
                onClick={onStopTts}
                className="flex-1 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Parar Narração</span>
              </button>
            ) : (
              <button
                onClick={() =>
                  onPlayTts &&
                  onPlayTts(
                    transcribedText ||
                      'STT&TTS de Satiro: leitura com voz neural Google Gemini e alta fidelidade.',
                    settings.ttsVoice
                  )
                }
                className="flex-1 py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Testar Voz ({settings.ttsVoice})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: PEQUENO HISTÓRICO DE TRANSCRIÇÕES (Solicitado pelo usuário) */}
      {activeTab === 'history' && (
        <div className="p-4 space-y-2.5 text-xs max-h-72 overflow-y-auto">
          {transcriptionLogs.length === 0 ? (
            <div className="text-center py-6 text-slate-400 space-y-1.5">
              <History className="h-6 w-6 mx-auto text-slate-500" />
              <p className="font-medium">Nenhuma transcrição recente</p>
              <p className="text-[11px] text-slate-500">
                Pressione Pause num campo para gravar suas falas.
              </p>
            </div>
          ) : (
            transcriptionLogs.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-800/40 truncate max-w-[140px]">
                    {item.targetFieldName || item.targetField || 'Livre'}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3" />
                    {new Date(item.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-slate-200 font-mono text-[11px] line-clamp-2 leading-relaxed">
                  "{item.text}"
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
                  <span className="text-slate-400">{item.wordCount || item.text.split(' ').length} palavras</span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLogText(item.id, item.text)}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                      title="Copiar texto"
                    >
                      {copiedLogId === item.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedLogId === item.id ? 'Copiado' : 'Copiar'}</span>
                    </button>

                    {onPlayTts && (
                      <button
                        onClick={() => onPlayTts(item.text, settings.ttsVoice)}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer font-medium"
                        title="Ouvir com Gemini TTS"
                      >
                        <Play className="h-2.5 w-2.5 fill-current" />
                        <span>Ouvir</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
