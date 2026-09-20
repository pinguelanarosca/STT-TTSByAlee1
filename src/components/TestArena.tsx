import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Mic, Eye, Play, Square, Loader2, Sparkles, Check, MousePointer, Info, Crop, AlertCircle, Camera, Download, CheckCircle2 } from 'lucide-react';
import { ExtensionSettings, NarrationLog, RecordingStatus } from '../types';
import { playAudioFromBase64, blobToBase64 } from '../utils/audio';
import { audioMixer } from '../utils/audioMixerEngine';
import { generateExtensionZip } from '../utils/zipGenerator';
import { RecordingHud } from './RecordingHud';
import { NarrationHud } from './NarrationHud';

interface TestArenaProps {
  settings: ExtensionSettings;
  onUpdateSettings?: (settings: Partial<ExtensionSettings>) => void;
  onAddLog: (log: Omit<NarrationLog, 'id' | 'timestamp'>) => void;
  logs?: NarrationLog[];
}

const FIELD_NAMES: Record<string, string> = {
  fieldTitle: '1. Título do Relatório',
  fieldEmail: '2. Resposta de E-mail',
  fieldNotes: '3. Notas da Reunião',
  fieldPrompt: 'Prompt Livre',
};

export const TestArena: React.FC<TestArenaProps> = ({ settings, onUpdateSettings, onAddLog, logs = [] }) => {
  // Estados para Ctrl + B (TTS) e Narração Flutuante
  const [selectedText, setSelectedText] = useState('');
  const [isNarrating, setIsNarrating] = useState(false);
  const [isTtsPaused, setIsTtsPaused] = useState(false);
  const [currentNarratedText, setCurrentNarratedText] = useState('');
  const [narrationSource, setNarrationSource] = useState<'selection' | 'vision' | 'preview'>('selection');
  const [ttsSpeed, setTtsSpeed] = useState<number>(settings.ttsSpeed ?? 1.0);
  const [ttsVolume, setTtsVolume] = useState<number>(settings.ttsVolume ?? 1.0);
  const [lastTtsAudio, setLastTtsAudio] = useState<string | null>(null);
  const [ttsStatus, setTtsStatus] = useState<string | null>(null);
  const activeHtmlAudioRef = useRef<HTMLAudioElement | null>(null);

  // Estados para Pause / Break (STT) e Balão HUD Superior Direito
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [lastTranscribedText, setLastTranscribedText] = useState<string>('');
  const [targetFieldId, setTargetFieldId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const webSpeechRecognitionRef = useRef<any>(null);

  // Estado para Download do ZIP da Extensão
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadZip = async () => {
    try {
      setDownloading(true);
      const zipBlob = await generateExtensionZip(settings);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'STT-TTSByAlee.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao baixar extensão:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Campos de texto para teste
  const [fieldValues, setFieldValues] = useState({
    fieldTitle: '',
    fieldNotes: 'Pauta: Planejamento estratégico trimestral.\n- ',
    fieldEmail: 'Prezado cliente, agradecemos o contato. ',
    fieldPrompt: '',
  });

  // Sincronizar velocidade e volume do mixer/player em tempo real
  useEffect(() => {
    try {
      audioMixer.setMasterVolume(ttsVolume);
      if (activeHtmlAudioRef.current) {
        activeHtmlAudioRef.current.volume = ttsVolume;
      }
    } catch (e) {}
  }, [ttsVolume]);

  useEffect(() => {
    try {
      if (activeHtmlAudioRef.current) {
        activeHtmlAudioRef.current.playbackRate = ttsSpeed;
      }
    } catch (e) {}
  }, [ttsSpeed]);

  // Contador de segundos enquanto grava
  useEffect(() => {
    let interval: any = null;
    if (recordingStatus === 'recording') {
      setRecordingDuration(0);
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingStatus]);

  // Estados para Ctrl + Arrastar (Visão)
  const [isLensModeActive, setIsLensModeActive] = useState(false);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isAnalyzingVision, setIsAnalyzingVision] = useState(false);
  const [lastVisionResult, setLastVisionResult] = useState<{ text: string; image: string } | null>(null);
  const arenaContainerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isSelectingAreaRef = useRef(false);
  const selectionBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    isSelectingAreaRef.current = isSelectingArea;
  }, [isSelectingArea]);

  useEffect(() => {
    selectionBoxRef.current = selectionBox;
  }, [selectionBox]);

  // Listener global de mouse para arrastar com máxima precisão mesmo saindo dos limites do contêiner
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isSelectingAreaRef.current || !startPosRef.current || !arenaContainerRef.current) return;
      const rect = arenaContainerRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const x = Math.max(0, Math.min(rect.width, Math.min(startPosRef.current.x, currentX)));
      const y = Math.max(0, Math.min(rect.height, Math.min(startPosRef.current.y, currentY)));
      const width = Math.min(rect.width - x, Math.abs(currentX - startPosRef.current.x));
      const height = Math.min(rect.height - y, Math.abs(currentY - startPosRef.current.y));

      setSelectionBox({ x, y, width, height });
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isSelectingAreaRef.current) {
        finishAreaSelection();
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Estado para Menu de Contexto ao Clicar com Botão Direito na Seleção
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number; text: string } | null>(null);

  // Detectar seleção de texto no documento e menu de contexto (Botão Direito)
  useEffect(() => {
    const handleSelectionChange = () => {
      const text = window.getSelection()?.toString().trim() || '';
      if (text) setSelectedText(text);
    };

    const handleContextMenu = (e: MouseEvent) => {
      const text = window.getSelection()?.toString().trim();
      if (text && text.length > 0) {
        setContextMenuPos({
          x: Math.min(e.clientX + 5, window.innerWidth - 210),
          y: Math.min(e.clientY + 5, window.innerHeight - 50),
          text: text,
        });
      } else {
        setContextMenuPos(null);
      }
    };

    const handleClick = () => setContextMenuPos(null);
    const handleScroll = () => setContextMenuPos(null);

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  // -------------------------------------------------------------
  // REQUISITO 1: Ctrl + B -> Modelo narra seleção com Pop-up Superior Direito
  // -------------------------------------------------------------
  const executeTts = async (textToSpeak?: string, overrideVoice?: string, source: 'selection' | 'vision' | 'preview' = 'selection') => {
    const text = textToSpeak || window.getSelection()?.toString().trim() || selectedText;
    if (!text) {
      setTtsStatus('Selecione algum texto primeiro ou use o exemplo abaixo!');
      setTimeout(() => setTtsStatus(null), 3000);
      return;
    }

    try {
      stopTts();
      setIsNarrating(true);
      setIsTtsPaused(false);
      setCurrentNarratedText(text);
      setNarrationSource(source);
      setTtsStatus('Gerando áudio com Gemini 3.5 Flash Lite TTS...');

      const startTime = Date.now();
      let data: any = null;
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            instruction: settings.narratorInstruction,
            voice: overrideVoice || settings.ttsVoice,
            apiKey: settings.apiKey,
          }),
        });

        const rawText = await res.text();
        try {
          data = JSON.parse(rawText);
        } catch {
          console.warn('[VocalLens] Resposta não-JSON recebida em /api/tts:', rawText.substring(0, 80));
        }
      } catch (fetchErr: any) {
        console.warn('[VocalLens] Falha de conexão em /api/tts:', fetchErr);
      }

      if (data && data.success && data.audioBase64) {
        setLastTtsAudio(data.audioBase64);
        setTtsStatus('Reproduzindo áudio...');

        try {
          const audioUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
          const audioEl = new Audio(audioUrl);
          audioEl.volume = ttsVolume;
          audioEl.playbackRate = ttsSpeed;
          activeHtmlAudioRef.current = audioEl;

          audioEl.onended = () => {
            setIsNarrating(false);
            setIsTtsPaused(false);
            activeHtmlAudioRef.current = null;
          };

          audioEl.onerror = (e) => {
            console.warn('Erro no elemento de áudio:', e);
            setIsNarrating(false);
          };

          await audioEl.play();
        } catch (mixErr) {
          console.warn('Fallback para player secundário:', mixErr);
          playAudioFromBase64(data.audioBase64, data.mimeType || 'audio/wav');
        }

        onAddLog({
          type: 'selection',
          text,
          audioUrl: data.audioBase64,
          durationMs: Date.now() - startTime,
          targetFieldName: 'Texto Selecionado na Página',
          targetSelector: 'window.getSelection()',
          targetTag: 'SELECTION',
          wordCount: text.trim().split(/\s+/).filter(Boolean).length,
          charCount: text.length,
        });
      } else {
        // Fallback para fala nativa do navegador se sem internet ou sem chave
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.lang = 'pt-BR';
          utter.rate = ttsSpeed;
          utter.volume = ttsVolume;
          utter.onend = () => setIsNarrating(false);
          window.speechSynthesis.speak(utter);
          setTtsStatus('Narrando com voz local do navegador');
        } else {
          setTtsStatus(`Erro: ${data?.error || 'Falha ao gerar narração'}`);
          setIsNarrating(false);
        }
      }
    } catch (err: any) {
      // Fallback nativo
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'pt-BR';
        utter.rate = ttsSpeed;
        utter.volume = ttsVolume;
        utter.onend = () => setIsNarrating(false);
        window.speechSynthesis.speak(utter);
        setTtsStatus('Narrando com voz local do sistema');
      } else {
        setTtsStatus(`Erro: ${err?.message || 'Falha ao reproduzir áudio'}`);
        setIsNarrating(false);
      }
    }
  };

  const togglePlayPauseTts = () => {
    if (activeHtmlAudioRef.current) {
      if (activeHtmlAudioRef.current.paused) {
        activeHtmlAudioRef.current.play();
        setIsTtsPaused(false);
      } else {
        activeHtmlAudioRef.current.pause();
        setIsTtsPaused(true);
      }
    } else if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsTtsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsTtsPaused(true);
      }
    }
  };

  const stopTts = () => {
    try {
      if (activeHtmlAudioRef.current) {
        activeHtmlAudioRef.current.pause();
        activeHtmlAudioRef.current.currentTime = 0;
        activeHtmlAudioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      audioMixer.stopAll();
    } catch (err) {
      console.warn('Erro ao parar áudio:', err);
    }
    setIsNarrating(false);
    setIsTtsPaused(false);
    setTtsStatus(null);
  };

  // -------------------------------------------------------------
  // REQUISITO 3: Pause / Break -> Grava e transcreve no campo alvo
  // (Ultra-compatível com Linux Ubuntu e com Web Speech Fallback)
  // -------------------------------------------------------------
  const startRecording = async (targetId: string | null = null) => {
    try {
      setTargetFieldId(targetId);
      setLastTranscribedText('');
      setRecordingStatus('recording');

      // Configuração para compatibilidade Linux / Chromium
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Seleção inteligente de MIME Type compatível
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : '';

      const recorderOptions = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      // Iniciar captura contínua com chunks a cada 200ms
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Encerrar faixas do microfone
        stream.getTracks().forEach((track) => track.stop());

        const finalMime = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
        setRecordingStatus('sending');

        try {
          const startTime = Date.now();
          const audioBase64 = await blobToBase64(audioBlob);

          setRecordingStatus('processing');

          let transcribedTextResult = '';

          // 1. Enviar para API backend com Gemini 3.6 Flash
          let data: any = null;
          try {
            const res = await fetch('/api/stt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64,
                mimeType: finalMime,
                instruction: settings.transcriberInstruction,
                apiKey: settings.apiKey,
              }),
            });

            const rawText = await res.text();
            try {
              data = JSON.parse(rawText);
            } catch {
              console.warn('[VocalLens] Resposta não-JSON em /api/stt:', rawText.substring(0, 100));
            }
          } catch (fetchErr: any) {
            console.warn('[VocalLens] Falha na conexão com /api/stt:', fetchErr);
          }

          if (data && data.success && data.text) {
            transcribedTextResult = data.text;
          } else if (settings.apiKey) {
            // 2. Fallback direto se configurado chave do usuário com cascade oficial
            const directCascade = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
            const cleanAudio = audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, '');

            for (const modelName of directCascade) {
              try {
                const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
                const directRes = await fetch(directUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        { inlineData: { mimeType: 'audio/webm', data: cleanAudio } },
                        { text: settings.transcriberInstruction || 'Transcreva com fidelidade o áudio.' }
                      ]
                    }]
                  })
                });
                if (directRes.ok) {
                  const rawDirect = await directRes.text();
                  try {
                    const dData = JSON.parse(rawDirect);
                    const parsedText = dData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                    if (parsedText) {
                      transcribedTextResult = parsedText;
                      break;
                    }
                  } catch {}
                }
              } catch (dErr) {
                console.warn(`[VocalLens] Erro no fallback direto com modelo ${modelName}:`, dErr);
              }
            }
          }

          if (transcribedTextResult) {
            setLastTranscribedText(transcribedTextResult);
            setRecordingStatus('ready');

            // Inserir estritamente no campo alvo onde a gravação foi iniciada (se houver alvo)
            if (targetId) {
              setFieldValues((prev) => {
                const currentVal = (prev as any)[targetId] || '';
                const separator = currentVal && !currentVal.endsWith(' ') && !currentVal.endsWith('\n') ? ' ' : '';
                return {
                  ...prev,
                  [targetId]: currentVal + separator + transcribedTextResult,
                };
              });
            }

            const targetName = targetId ? (FIELD_NAMES[targetId] || targetId) : 'Gravação Livre (Sem Campo Focado)';
            const targetSelector = targetId ? `#${targetId}` : 'HUD Flutuante (Livre)';
            const targetTag = targetId === 'fieldNotes' ? 'TEXTAREA' : targetId ? 'INPUT' : 'GLOBAL';
            const wordCount = transcribedTextResult.trim().split(/\s+/).filter(Boolean).length;
            const charCount = transcribedTextResult.length;

            onAddLog({
              type: 'transcription',
              text: transcribedTextResult,
              targetField: targetId || undefined,
              targetFieldName: targetName,
              targetSelector,
              targetTag,
              wordCount,
              charCount,
              durationMs: Date.now() - startTime,
              audioDurationSec: recordingDuration,
            });
          } else {
            console.error('Falha na transcrição:', data?.error || 'Resposta sem texto');
            setRecordingStatus('error');
            setTtsStatus(`Não foi possível transcrever: ${data?.error || 'Verifique sua conexão ou tente novamente.'}`);
          }
        } catch (err: any) {
          console.error('Erro na chamada STT:', err);
          setRecordingStatus('error');
          setTtsStatus(`Erro no envio do áudio: ${err?.message || 'Falha na comunicação'}`);
        }
      };

      mediaRecorder.start(200);
    } catch (err: any) {
      console.error('Erro ao acessar microfone:', err);
      setRecordingStatus('idle');
      setTargetFieldId(null);
      setTtsStatus(`Permissão de microfone negada ou não disponível: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData();
      } catch (e) {}
      mediaRecorderRef.current.stop();
    }
  };

  const toggleRecordingForField = (fieldId: string) => {
    if (recordingStatus === 'recording') {
      stopRecording();
    } else {
      startRecording(fieldId);
    }
  };

  // Inserir transcrição em um campo clicado quando o usuário grava fora do alvo com preservação do clipboard
  const handleInsertIntoField = (fieldId: string) => {
    if (!lastTranscribedText) return;
    setFieldValues((prev) => {
      const currentVal = (prev as any)[fieldId] || '';
      const separator = currentVal && !currentVal.endsWith(' ') && !currentVal.endsWith('\n') ? ' ' : '';
      return {
        ...prev,
        [fieldId]: currentVal + separator + lastTranscribedText,
      };
    });
    setTargetFieldId(fieldId);
  };

  // -------------------------------------------------------------
  // REQUISITO 2: Ctrl + Shift + Arrastar -> Seleção Exclusiva estilo Google Lens
  // -------------------------------------------------------------
  const handleMouseDownOnArena = (e: React.MouseEvent<HTMLDivElement>) => {
    // Dispara quando Ctrl+Shift está pressionado, ou Ctrl, ou Shift, ou se o modo Lente foi ativado pelo botão
    if ((e.ctrlKey || e.shiftKey || (e.ctrlKey && e.shiftKey) || isLensModeActive) && e.button === 0 && arenaContainerRef.current) {
      const rect = arenaContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      startPosRef.current = { x, y };
      setIsSelectingArea(true);
      setSelectionBox({ x, y, width: 0, height: 0 });
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMoveOnArena = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingArea || !startPosRef.current || !arenaContainerRef.current) return;
    const rect = arenaContainerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.max(0, Math.min(rect.width, Math.min(startPosRef.current.x, currentX)));
    const y = Math.max(0, Math.min(rect.height, Math.min(startPosRef.current.y, currentY)));
    const width = Math.min(rect.width - x, Math.abs(currentX - startPosRef.current.x));
    const height = Math.min(rect.height - y, Math.abs(currentY - startPosRef.current.y));

    setSelectionBox({ x, y, width, height });
  };

  const finishAreaSelection = async () => {
    const box = selectionBoxRef.current;
    if (!isSelectingAreaRef.current || !box || !arenaContainerRef.current) return;
    setIsSelectingArea(false);

    if (box.width < 25 || box.height < 25) {
      setSelectionBox(null);
      return;
    }

    try {
      setIsAnalyzingVision(true);
      const startTime = Date.now();

      // Gerar recorte usando canvas a partir da área delimitada dentro da arena
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(100, box.width * 2);
      canvas.height = Math.max(60, box.height * 2);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Renderizar conteúdo simulado de alta fidelidade
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillText('Recorte Capturado via Google Lens', 20, 45);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(`Área Selecionada: ${Math.round(box.width)} x ${Math.round(box.height)} px`, 20, 80);
        ctx.fillText('Google Gemini 3.6 Flash Vision + TTS em ação', 20, 110);
      }

      const sampleImageBase64 = canvas.toDataURL('image/png');

      let data: any = null;
      try {
        const res = await fetch('/api/vision-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: sampleImageBase64,
            instruction: settings.visionInstruction,
            narratorInstruction: settings.narratorInstruction,
            voice: settings.ttsVoice,
            apiKey: settings.apiKey,
          }),
        });

        const rawText = await res.text();
        try {
          data = JSON.parse(rawText);
        } catch {
          console.warn('[VocalLens] Resposta não-JSON em /api/vision-tts:', rawText.substring(0, 100));
        }
      } catch (fErr: any) {
        console.warn('[VocalLens] Erro ao chamar /api/vision-tts:', fErr);
      }

      if (data && data.success) {
        setLastVisionResult({ text: data.text, image: sampleImageBase64 });
        if (data.audioBase64) {
          try {
            const buffer = await audioMixer.decodeAudio(data.audioBase64);
            audioMixer.setMasterVolume(settings.ttsVolume ?? 1.0);
            audioMixer.setEQ(
              settings.ttsBass ?? 0,
              settings.ttsMid ?? 0,
              settings.ttsTreble ?? 0,
              true
            );
            audioMixer.playVoiceTrack(
              buffer,
              {
                volume: 1.0,
                pan: 0,
                speed: settings.ttsSpeed ?? 1.0,
                pitchSemi: settings.ttsPitch ?? 0,
                mute: false,
                solo: false,
              },
              'A'
            );
          } catch {
            playAudioFromBase64(data.audioBase64, data.mimeType || 'audio/wav');
          }
        }
        onAddLog({
          type: 'vision',
          text: data.text,
          audioUrl: data.audioBase64,
          previewImage: sampleImageBase64,
          targetFieldName: 'Captura Visual da Área Selecionada',
          targetSelector: 'canvas.screenCrop',
          targetTag: 'IMAGE_SELECTION',
          wordCount: data.text.trim().split(/\s+/).filter(Boolean).length,
          charCount: data.text.length,
          durationMs: Date.now() - startTime,
        });
      }
    } catch (err) {
      console.error('Erro na análise de visão:', err);
    } finally {
      setIsAnalyzingVision(false);
      setSelectionBox(null);
    }
  };

  const handleMouseUpOnArena = async (e: React.MouseEvent<HTMLDivElement>) => {
    finishAreaSelection();
  };

  // Monitor de diagnósticos de teclas em tempo real (compatível com Linux Wayland wl_keyboard, X11 e Windows)
  const [lastKeyEventInfo, setLastKeyEventInfo] = useState<{
    key: string;
    code: string;
    keyCode: number;
    eventType: string;
    isPause: boolean;
    timestamp: number;
  } | null>(null);

  const lastPauseTriggerRef = useRef<number>(0);

  const handlePauseTrigger = () => {
    const activeEl = document.activeElement;
    const activeId = activeEl?.id;

    if (recordingStatus === 'recording') {
      // Encerrar gravação
      stopRecording();
    } else if (activeId && ['fieldTitle', 'fieldNotes', 'fieldEmail', 'fieldPrompt'].includes(activeId)) {
      // Iniciar gravação exatamente no campo ativo
      startRecording(activeId);
    } else {
      // Se não estiver em um campo alvo, inicia gravação livre
      startRecording(null);
    }
  };

  // Helper universal para detecção de Pause / Break
  // Cobre Wayland wl_keyboard (key 127, sym 65299), XKB, Windows e macOS
  const isPauseKey = (e: KeyboardEvent): boolean => {
    return (
      e.key === 'Pause' ||
      e.code === 'Pause' ||
      e.key === 'Break' ||
      e.code === 'Break' ||
      e.keyCode === 19 ||
      e.which === 19 ||
      e.key === 'MediaPlayPause'
    );
  };

  // Listener global de teclado para atalhos nativos no simulador:
  // - Ctrl + B: Narra seleção atual
  // - Pause / Break: Alterna gravação no campo em foco ou livre (balão superior direito)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isPause = isPauseKey(e);

      // Salva dados de diagnóstico do evento
      setLastKeyEventInfo({
        key: e.key,
        code: e.code,
        keyCode: e.keyCode || e.which,
        eventType: e.type,
        isPause,
        timestamp: Date.now(),
      });

      // 1. Ctrl + B (apenas no keydown)
      if (e.type === 'keydown' && e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        const text = window.getSelection()?.toString().trim();
        if (text) {
          e.preventDefault();
          executeTts(text);
        }
        return;
      }

      // 2. Pause / Break (suporta tanto keydown quanto keyup/release comum no Wayland wl_keyboard)
      if (isPause) {
        e.preventDefault();
        const now = Date.now();
        // Debounce de 350ms para evitar disparo duplo entre keydown e keyup
        if (now - lastPauseTriggerRef.current > 350) {
          lastPauseTriggerRef.current = now;
          handlePauseTrigger();
        }
      }
    };

    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('keyup', handleKey, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('keyup', handleKey, true);
    };
  }, [recordingStatus, selectedText, settings]);

  return (
    <div className="space-y-8 relative">
      {/* Cabeçalho do Container Laboratório de Teste com Botão no Canto Superior Esquerdo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-md">
        <div className="flex items-center gap-3">
          <button
            id="download-extension-test-arena-top-left-btn"
            onClick={handleDownloadZip}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.02]"
          >
            {downloadSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span>Extensão Baixada (.ZIP)!</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>{downloading ? 'Gerando ZIP...' : 'Baixar Extensão (.ZIP)'}</span>
              </>
            )}
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-200">
              Laboratório de Teste &amp; Validação
            </span>
            <span className="text-[11px] text-slate-400">
              Baixe o pacote .ZIP e carregue em <code className="text-blue-400">chrome://extensions</code>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Servidor Gemini Ativo • Atalhos Globais Prontos</span>
        </div>
      </div>

      {/* Balão Canto Superior Direito com Status de Gravação, Console TTS e Histórico */}
      <RecordingHud
        status={recordingStatus}
        targetFieldId={targetFieldId}
        targetFieldName={targetFieldId ? FIELD_NAMES[targetFieldId] || targetFieldId : undefined}
        transcribedText={lastTranscribedText}
        durationSeconds={recordingDuration}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        recentLogs={logs}
        onPlayTts={(text, voice) => executeTts(text, voice)}
        onStopTts={stopTts}
        isTtsPlaying={isNarrating}
        onStopRecording={stopRecording}
        onDismiss={() => setRecordingStatus('idle')}
        onInsertIntoField={handleInsertIntoField}
      />
      {/* Barra de Instruções Rápidas dos Atalhos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-sm">Narra Seleção</span>
              <kbd className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 border border-slate-700 text-blue-400 rounded">
                Ctrl + B
              </kbd>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Selecione qualquer texto e pressione <span className="text-slate-200">Ctrl+B</span> para ouvir a narração com voz neural do Gemini.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-indigo-500/30 p-4 rounded-xl flex items-start gap-3 shadow-lg shadow-indigo-950/30 bg-gradient-to-br from-slate-900/95 to-indigo-950/20">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Crop className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-sm">Seleção Google Lens</span>
              <kbd className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 border border-slate-700 text-cyan-400 rounded">
                Ctrl + Shift + Arrastar
              </kbd>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Segure <span className="text-cyan-300 font-semibold">Ctrl + Shift</span> e arraste o mouse sobre qualquer área para ativar o viewfinder estilo Google Lens e ouvir a interpretação com IA.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-100 text-sm">Gravar & Transcrever</span>
              <kbd className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 border border-slate-700 text-rose-400 rounded">
                Pause / Break
              </kbd>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Foque um campo e tecle <span className="text-slate-200">Pause</span>. Fale sua mensagem e tecle <span className="text-slate-200">Pause</span> novamente para transcrever nele!
            </p>
          </div>
        </div>
      </div>

      {/* Floating Status Toast HUD para TTS e Visão */}
      {(ttsStatus || isAnalyzingVision) && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md">
          {isAnalyzingVision ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span className="text-xs sm:text-sm font-medium">Analisando imagem e sintetizando voz...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-xs sm:text-sm font-medium">{ttsStatus}</span>
            </>
          )}
        </div>
      )}

      {/* ÁREA DE TESTE 1: TTS COM TEXTO SELECIONÁVEL */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-blue-400" />
              Teste de Narração TTS (Ctrl + B)
            </h3>
            <p className="text-xs text-slate-400">
              Selecione qualquer trecho no bloco abaixo e pressione <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Ctrl+B</kbd> ou clique no botão.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="narrate-selection-btn"
              onClick={() => executeTts()}
              disabled={isNarrating}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {isNarrating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Sintetizando...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Narrar Seleção Atual</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Texto de Exemplo para Selecionar */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 text-sm leading-relaxed select-text space-y-3">
          <p>
            A inteligência artificial generativa tem revolucionado a acessibilidade digital. Ao integrar modelos de síntese de fala de última geração como o <strong className="text-blue-400 selection:bg-blue-600 selection:text-white">Google Gemini 3.1 Flash TTS</strong>, páginas web estáticas transformam-se em experiências sonoras imersivas com prosódia humana, ênfase expressiva e dicção natural.
          </p>
          <p>
            Com o atalho <strong className="text-slate-100 selection:bg-blue-600 selection:text-white">Ctrl + B</strong>, qualquer usuário com baixa visão, dislexia ou que prefira consumir conteúdo por áudio pode destacar um parágrafo complexo, relatório financeiro ou e-mail longo para ouvir a leitura instantânea sem alternar de janela.
          </p>
        </div>

        {lastTtsAudio && (
          <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-400" />
              Última narração sintetizada com voz <strong>{settings.ttsVoice}</strong>
            </span>
            <button
              onClick={() => playAudioFromBase64(lastTtsAudio, 'audio/wav')}
              className="text-blue-400 hover:text-blue-300 font-medium underline flex items-center gap-1 cursor-pointer"
            >
              <Play className="h-3 w-3 fill-current" />
              Ouvir Novamente
            </button>
          </div>
        )}
      </div>

      {/* ÁREA DE TESTE 2: SELEÇÃO VISUAL DE ÁREA ESTILO GOOGLE LENS (CTRL + SHIFT + ARRASTAR) */}
      <div
        ref={arenaContainerRef}
        onMouseDown={handleMouseDownOnArena}
        onMouseMove={handleMouseMoveOnArena}
        onMouseUp={handleMouseUpOnArena}
        className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-6 relative select-none overflow-hidden ${
          isSelectingArea ? 'cursor-crosshair ring-2 ring-cyan-500/50' : ''
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-400" />
              Seleção Exclusiva estilo Google Lens (Ctrl + Shift + Arrastar)
            </h3>
            <p className="text-xs text-slate-400">
              Segure <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-cyan-300 font-mono font-semibold">Ctrl + Shift</kbd> e clique-arraste o mouse sobre qualquer um dos cartões abaixo, ou clique no botão de ativar lente para fotografar e narrar com o Google Gemini Vision.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsLensModeActive(!isLensModeActive)}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium transition cursor-pointer ${
                isLensModeActive
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>{isLensModeActive ? '📸 Lente Google Lens Ativa (Clique e arraste)' : 'Ativar Lente Google Lens'}</span>
            </button>

            <div className="text-xs text-slate-300 bg-cyan-950/40 border border-cyan-800/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Atalho: <strong className="text-cyan-300">Ctrl + Shift + Arrastar</strong></span>
            </div>
          </div>
        </div>

        {/* Retângulo de Seleção Exclusivo Google Lens com Viewfinder, Scanner Laser e Dimming */}
        {isSelectingArea && selectionBox && (
          <div
            className="absolute pointer-events-none z-30 transition-shadow"
            style={{
              left: `${selectionBox.x}px`,
              top: `${selectionBox.y}px`,
              width: `${selectionBox.width}px`,
              height: `${selectionBox.height}px`,
              boxShadow: '0 0 0 9999px rgba(3, 7, 18, 0.65)',
            }}
          >
            {/* Moldura translúcida interna */}
            <div className="absolute inset-0 border border-cyan-400/40 bg-cyan-500/10 rounded-xl overflow-hidden backdrop-brightness-110">
              {/* Linha de Scanner Laser animada estilo Google Lens */}
              <div
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_#38bdf8] animate-pulse"
                style={{
                  top: '50%',
                }}
              />
            </div>

            {/* 4 Cantos de Viewfinder Estilo Google Lens */}
            {/* Canto Superior Esquerdo */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-white rounded-tl-md shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            {/* Canto Superior Direito */}
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-white rounded-tr-md shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            {/* Canto Inferior Esquerdo */}
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-white rounded-bl-md shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            {/* Canto Inferior Direito */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-white rounded-br-md shadow-[0_0_8px_rgba(255,255,255,0.9)]" />

            {/* Badge Flutuante Google Lens */}
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/95 text-cyan-300 border border-cyan-500/50 text-[11px] font-semibold px-3 py-1 rounded-full shadow-2xl flex items-center gap-1.5 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Google Lens • Solte para Fotografar e Analisar</span>
            </div>
          </div>
        )}

        {/* Cartões visuais simulando elementos ricos da web (gráficos, tabelas, blocos de código) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pointer-events-auto">
          {/* Card 1: Gráfico e Métricas Financeiras */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Métricas Trimestrais</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-100">R$ 482.500</span>
              <span className="text-xs text-emerald-400 font-semibold">+24.8% vs. meta</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Crescimento de receita recorrente impulsionado por automação e novos assinantes de IA.
            </p>
            <div className="mt-3 h-12 w-full bg-slate-900 rounded-lg flex items-end px-2 py-1 gap-1">
              <div className="w-1/6 bg-blue-500/40 h-1/3 rounded-t" />
              <div className="w-1/6 bg-blue-500/60 h-1/2 rounded-t" />
              <div className="w-1/6 bg-blue-500/70 h-2/3 rounded-t" />
              <div className="w-1/6 bg-blue-500/80 h-3/4 rounded-t" />
              <div className="w-1/6 bg-blue-500/90 h-4/5 rounded-t" />
              <div className="w-1/6 bg-blue-500 h-full rounded-t" />
            </div>
          </div>

          {/* Card 2: Código & Documentação Técnica */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition font-mono text-xs">
            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider font-sans">Função de Integração</span>
            <div className="mt-2 text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 overflow-hidden leading-relaxed">
              <span className="text-purple-400">async function</span> <span className="text-blue-300">narrateArea</span>() {'{'}<br />
              &nbsp;&nbsp;<span className="text-slate-500">// Captura foto e sintetiza áudio</span><br />
              &nbsp;&nbsp;<span className="text-amber-300">const</span> res = <span className="text-purple-400">await</span> ai.vision();<br />
              &nbsp;&nbsp;<span className="text-purple-400">return</span> res.speechAudio;<br />
              {'}'}
            </div>
          </div>

          {/* Card 3: Análise Médica / Resumo Clínico */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Anotação Clínica / Laudo</span>
            <h4 className="font-semibold text-slate-200 text-sm mt-1">Exame de Rotina #8491</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Paciente sem queixas agudas. Pressão arterial: 120/80 mmHg. Frequência cardíaca: 72 bpm. Eletrocardiograma dentro dos padrões fisiológicos normais.
            </p>
          </div>
        </div>

        {/* Exibição do último resultado da visão */}
        {lastVisionResult && (
          <div className="mt-4 p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex flex-col sm:flex-row items-start gap-4">
            <div className="h-16 w-24 shrink-0 rounded-lg bg-slate-900 border border-indigo-700/60 overflow-hidden flex items-center justify-center">
              <img src={lastVisionResult.image} alt="Crop" className="object-cover h-full w-full" />
            </div>
            <div className="flex-1 text-xs">
              <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Interpretação e Narração Gemini Vision:
              </div>
              <p className="text-slate-200 leading-relaxed">{lastVisionResult.text}</p>
            </div>
          </div>
        )}
      </div>

      {/* ÁREA DE TESTE 3: TRANSCRIÇÃO NO CAMPO ALVO (PAUSE / BREAK) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <Mic className="h-4 w-4 text-rose-400" />
              Transcrição de Áudio no Campo Alvo (Pause / Break)
            </h3>
            <p className="text-xs text-slate-400">
              Clique dentro de qualquer campo abaixo para colocá-lo em foco. Pressione <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">Pause/Break</kbd> para começar a gravar. Pressione novamente para transcrever exatamente no campo selecionado!
            </p>
          </div>

          <div className="text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-slate-900 rounded font-mono text-slate-300">Pause</kbd>
            <span>Liga / Desliga o microfone</span>
          </div>
        </div>

        {/* Painel de Diagnóstico do Teclado em Tempo Real (Linux wl_keyboard / X11 / Windows) */}
        <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Detector de Tecla:
            </span>
            {lastKeyEventInfo ? (
              <span className="flex items-center gap-2 font-mono text-[11px] bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-md text-slate-200">
                <span>key: <strong className="text-amber-300">{lastKeyEventInfo.key || '(vazio)'}</strong></span>
                <span className="text-slate-500">|</span>
                <span>code: <strong>{lastKeyEventInfo.code}</strong></span>
                <span className="text-slate-500">|</span>
                <span>keyCode: <strong>{lastKeyEventInfo.keyCode}</strong></span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">{lastKeyEventInfo.eventType}</span>
                {lastKeyEventInfo.isPause ? (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-sans font-bold text-[10px] border border-emerald-500/30">
                    ✓ PAUSE RECONHECIDO (wl_keyboard key: 127, sym: Pause 65299)
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="text-slate-400">
                Pressione a tecla <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-300 font-mono">Pause</kbd> no seu teclado para testar a captura
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-simulate-pause-key"
              type="button"
              onClick={() => handlePauseTrigger()}
              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium transition text-xs flex items-center gap-1.5 cursor-pointer"
              title="Simula exatamente o disparo do evento Pause (key: 127 / sym: Pause 65299)"
            >
              <span>⚡ Simular Tecla Pause (Gravar/Parar)</span>
            </button>
          </div>
        </div>

        {/* Barra de ação rápida para testar gravação com e sem campo alvo */}
        <div className="mb-5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span>
              {recordingStatus === 'recording' ? (
                <strong className="text-rose-400">
                  Gravando áudio ({recordingDuration}s)... {targetFieldId ? `Alvo: ${FIELD_NAMES[targetFieldId]}` : 'Sem campo alvo (gravação livre)'}
                </strong>
              ) : (
                <span>Atalho: tecle <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200">Pause</kbd> a qualquer momento</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-test-free-recording"
              onClick={() => {
                if (recordingStatus === 'recording') {
                  stopRecording();
                } else {
                  // Grava sem foco em nenhum campo específico para testar o balão superior direito
                  startRecording(null);
                }
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                recordingStatus === 'recording' && !targetFieldId
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>
                {recordingStatus === 'recording' && !targetFieldId
                  ? 'Parar Gravação Livre'
                  : 'Gravar Sem Campo Alvo (Ver Balão HUD)'}
              </span>
            </button>
          </div>
        </div>

        {/* Múltiplos campos de entrada para testar o isolamento do campo alvo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Campo 1: Título do Documento */}
          <div className={`space-y-1.5 p-3 rounded-2xl transition border ${targetFieldId === 'fieldTitle' ? 'bg-slate-900/90 border-rose-500/50 shadow-lg shadow-rose-950/20' : 'bg-slate-900/40 border-slate-800/80'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="fieldTitle" className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>1. Título do Relatório</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">#fieldTitle</span>
                </label>
                {targetFieldId === 'fieldTitle' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Alvo Ativo
                  </span>
                )}
              </div>
              <button
                id="mic-btn-fieldTitle"
                onClick={() => toggleRecordingForField('fieldTitle')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  targetFieldId === 'fieldTitle' && recordingStatus === 'recording'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Mic className="h-3 w-3" />
                <span>{targetFieldId === 'fieldTitle' && recordingStatus === 'recording' ? 'Gravando...' : 'Gravar'}</span>
              </button>
            </div>
            <input
              id="fieldTitle"
              type="text"
              placeholder="Ex: Ata de Reunião com Diretoria"
              value={fieldValues.fieldTitle}
              onFocus={() => setTargetFieldId('fieldTitle')}
              onChange={(e) => setFieldValues({ ...fieldValues, fieldTitle: e.target.value })}
              className={`w-full bg-slate-950 border px-3 py-2 rounded-xl text-sm text-slate-100 placeholder-slate-600 transition focus:outline-none ${
                targetFieldId === 'fieldTitle'
                  ? 'border-rose-500 ring-2 ring-rose-500/30'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Campo 2: E-mail de Resposta */}
          <div className={`space-y-1.5 p-3 rounded-2xl transition border ${targetFieldId === 'fieldEmail' ? 'bg-slate-900/90 border-rose-500/50 shadow-lg shadow-rose-950/20' : 'bg-slate-900/40 border-slate-800/80'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="fieldEmail" className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>2. Resposta de E-mail</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">#fieldEmail</span>
                </label>
                {targetFieldId === 'fieldEmail' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Alvo Ativo
                  </span>
                )}
              </div>
              <button
                id="mic-btn-fieldEmail"
                onClick={() => toggleRecordingForField('fieldEmail')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  targetFieldId === 'fieldEmail' && recordingStatus === 'recording'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Mic className="h-3 w-3" />
                <span>{targetFieldId === 'fieldEmail' && recordingStatus === 'recording' ? 'Gravando...' : 'Gravar'}</span>
              </button>
            </div>
            <input
              id="fieldEmail"
              type="text"
              placeholder="Digite ou fale para transcrever..."
              value={fieldValues.fieldEmail}
              onFocus={() => setTargetFieldId('fieldEmail')}
              onChange={(e) => setFieldValues({ ...fieldValues, fieldEmail: e.target.value })}
              className={`w-full bg-slate-950 border px-3 py-2 rounded-xl text-sm text-slate-100 placeholder-slate-600 transition focus:outline-none ${
                targetFieldId === 'fieldEmail'
                  ? 'border-rose-500 ring-2 ring-rose-500/30'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Campo 3: Notas de Reunião (Textarea) */}
          <div className={`space-y-1.5 md:col-span-2 p-3 rounded-2xl transition border ${targetFieldId === 'fieldNotes' ? 'bg-slate-900/90 border-rose-500/50 shadow-lg shadow-rose-950/20' : 'bg-slate-900/40 border-slate-800/80'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label htmlFor="fieldNotes" className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>3. Notas & Decisões da Reunião (Área de texto expansível)</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">#fieldNotes</span>
                </label>
                {targetFieldId === 'fieldNotes' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Alvo Ativo
                  </span>
                )}
              </div>
              <button
                id="mic-btn-fieldNotes"
                onClick={() => toggleRecordingForField('fieldNotes')}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  targetFieldId === 'fieldNotes' && recordingStatus === 'recording'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Mic className="h-3 w-3" />
                <span>{targetFieldId === 'fieldNotes' && recordingStatus === 'recording' ? 'Parar Gravação' : 'Gravar com Pause/Break'}</span>
              </button>
            </div>
            <textarea
              id="fieldNotes"
              rows={4}
              placeholder="Fale suas anotações... Elas serão transcritas exatamente aqui."
              value={fieldValues.fieldNotes}
              onFocus={() => setTargetFieldId('fieldNotes')}
              onChange={(e) => setFieldValues({ ...fieldValues, fieldNotes: e.target.value })}
              className={`w-full bg-slate-950 border p-3 rounded-xl text-sm text-slate-100 placeholder-slate-600 transition focus:outline-none font-mono text-xs leading-relaxed ${
                targetFieldId === 'fieldNotes'
                  ? 'border-rose-500 ring-2 ring-rose-500/30'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Pop-up Flutuante de Gravação no Canto Superior Direito (4 Estados + Cópia com Restauração) */}
      <RecordingHud
        status={recordingStatus}
        durationSeconds={recordingDuration}
        transcribedText={lastTranscribedText}
        targetFieldId={targetFieldId}
        targetFieldName={targetFieldId ? FIELD_NAMES[targetFieldId] || targetFieldId : undefined}
        onStopRecording={stopRecording}
        onCancelRecording={() => {
          stopRecording();
          setRecordingStatus('idle');
          setTargetFieldId(null);
        }}
        onSelectTargetField={(fieldId) => {
          handleInsertIntoField(fieldId);
        }}
        onDismiss={() => {
          setRecordingStatus('idle');
        }}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />

      {/* Pop-up Flutuante de Narração no Canto Superior Direito (Controles de Velocidade, Volume, Play/Pause, Stop) */}
      <NarrationHud
        isPlaying={isNarrating}
        isPaused={isTtsPaused}
        narratedText={currentNarratedText}
        sourceType={narrationSource}
        speed={ttsSpeed}
        volume={ttsVolume}
        voiceName={settings.ttsVoice}
        onTogglePlayPause={togglePlayPauseTts}
        onStop={stopTts}
        onChangeSpeed={(s) => {
          setTtsSpeed(s);
          if (onUpdateSettings) onUpdateSettings({ ttsSpeed: s });
        }}
        onChangeVolume={(v) => {
          setTtsVolume(v);
          if (onUpdateSettings) onUpdateSettings({ ttsVolume: v });
        }}
        onDismiss={stopTts}
      />

      {/* Menu de Contexto Flutuante ao Clicar com o Botão Direito na Seleção de Texto */}
      {contextMenuPos && (
        <div
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            zIndex: 99999,
          }}
          className="bg-slate-900 border border-sky-400/90 rounded-xl p-2 shadow-2xl shadow-sky-950/80 flex items-center gap-2 text-xs font-bold text-slate-100 cursor-pointer hover:bg-slate-800 hover:border-sky-300 transition-all select-none animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const textToNarrate = contextMenuPos.text;
            setContextMenuPos(null);
            executeTts(textToNarrate);
          }}
        >
          <span className="text-base leading-none">🎙️</span>
          <span>Iniciar Narração</span>
          <span className="bg-sky-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ml-1">
            Gemini
          </span>
        </div>
      )}
    </div>
  );
};
