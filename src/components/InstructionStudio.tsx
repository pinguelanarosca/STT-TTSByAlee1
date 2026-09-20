import React, { useState } from 'react';
import { Sparkles, Volume2, Mic, Eye, Check, Play, Loader2, RotateCcw, Sliders, Plus, Trash2, VolumeX } from 'lucide-react';
import { ExtensionSettings, CustomVoice } from '../types';
import { DEFAULT_SETTINGS } from '../data/extensionFiles';
import { playAudioFromBase64 } from '../utils/audio';
import { SecureApiKeyCard } from './SecureApiKeyCard';

interface InstructionStudioProps {
  settings: ExtensionSettings;
  onUpdateSettings: (newSettings: Partial<ExtensionSettings>) => void;
  onNavigateToMixer?: () => void;
}

export const InstructionStudio: React.FC<InstructionStudioProps> = ({
  settings,
  onUpdateSettings,
  onNavigateToMixer,
}) => {
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingNewVoice, setTestingNewVoice] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estados para nova voz personalizada
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceBase, setNewVoiceBase] = useState('Kore');
  const [newVoiceInstruction, setNewVoiceInstruction] = useState('');
  const [sampleTestText, setSampleTestText] = useState(
    'Olá! Esta é uma demonstração de teste da minha nova voz personalizada no STT&TTS de Satiro.'
  );

  const baseVoiceOptions = [
    { id: 'Kore', label: 'Kore', desc: 'Equilibrada e Clara' },
    { id: 'Puck', label: 'Puck', desc: 'Jovem e Enérgica' },
    { id: 'Charon', label: 'Charon', desc: 'Grave e Confiável' },
    { id: 'Fenrir', label: 'Fenrir', desc: 'Forte e Firme' },
    { id: 'Zephyr', label: 'Zephyr', desc: 'Suave e Serena' },
    { id: 'Aoede', label: 'Aoede', desc: 'Expressiva' },
    { id: 'Calliope', label: 'Calliope', desc: 'Melódica' },
    { id: 'Orpheus', label: 'Orpheus', desc: 'Narrador' },
  ];

  // Presets de instruções para o Narrador
  const narratorPresets = [
    {
      name: 'Padrão Humano & Equilibrado',
      text: 'Você é um narrador natural e expressivo. Leia o texto com dicção impecável, ritmo equilibrado e entonação humana. Converta siglas e números para forma falada fluida.',
    },
    {
      name: 'Locutor Jornalístico Rápido',
      text: 'Você é um âncora de notícias. Narre o texto de maneira dinâmica, ágil, objetiva e com alta clareza de articulação, mantendo cadência profissional.',
    },
    {
      name: 'Acessibilidade & Calma',
      text: 'Você é um assistente de leitura acessível. Fale com ritmo sereno, pausas adequadas nas vírgulas e pontos, facilitando a compreensão integral.',
    },
    {
      name: 'Leitor Técnico & Programação',
      text: 'Você é um instrutor de software. Ao ler nomes de variáveis em camelCase, comandos ou trechos de código, pronuncie os termos técnicos com clareza.',
    },
  ];

  // Presets para o Transcritor
  const transcriberPresets = [
    {
      name: 'Fidelidade Absoluta & Pontuação',
      text: 'Transcreva com fidelidade absoluta o áudio recebido. Aplique pontuação correta, remova gagueiras e vícios de linguagem comuns.',
    },
    {
      name: 'Ditado Executivo em Tópicos',
      text: 'Transcreva o áudio organizando as ideias principais em tópicos limpos caso o orador dite múltiplos pontos.',
    },
    {
      name: 'Modo Código & Notações',
      text: 'Transcreva comandos técnicos, variáveis ou queries de forma limpa, mantendo termos preservados.',
    },
  ];

  // Presets para Visão
  const visionPresets = [
    {
      name: 'Texto Prioritário (OCR)',
      text: 'Analise detalhadamente a imagem capturada da tela. Se contiver texto, transcreva ou leia-o com máxima precisão.',
    },
    {
      name: 'Audiodescrição Completa',
      text: 'Descreva detalhadamente a composição visual, cores principais, layout e conteúdo escrito do recorte da tela.',
    },
  ];

  const handleTestVoice = async (voiceId: string) => {
    try {
      setTestingVoice(true);
      
      // Procura se é voz customizada
      const customList = settings.customVoices || [];
      const customFound = customList.find((c) => c.id === voiceId || c.name === voiceId);

      const targetVoice = customFound ? customFound.baseVoice : voiceId;
      const extraInst = customFound?.instruction
        ? `${customFound.instruction}\n${settings.narratorInstruction}`
        : settings.narratorInstruction;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Demonstração de voz do STT&TTS de Satiro. Testando timbre ${customFound ? customFound.name : voiceId}.`,
          instruction: extraInst,
          voice: targetVoice,
          apiKey: settings.apiKey,
        }),
      });
      const data = await res.json();
      if (data.success && data.audioBase64) {
        playAudioFromBase64(data.audioBase64, data.mimeType || 'audio/wav');
      }
    } catch (err) {
      console.error('Erro ao testar voz:', err);
    } finally {
      setTestingVoice(false);
    }
  };

  const handleTestNewVoiceForm = async () => {
    if (!sampleTestText.trim()) return;
    try {
      setTestingNewVoice(true);
      const fullInst = newVoiceInstruction
        ? `${newVoiceInstruction}\n${settings.narratorInstruction}`
        : settings.narratorInstruction;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleTestText,
          instruction: fullInst,
          voice: newVoiceBase,
          apiKey: settings.apiKey,
        }),
      });
      const data = await res.json();
      if (data.success && data.audioBase64) {
        playAudioFromBase64(data.audioBase64, data.mimeType || 'audio/wav');
      }
    } catch (err) {
      console.error('Erro ao testar nova voz:', err);
    } finally {
      setTestingNewVoice(false);
    }
  };

  const handleAddCustomVoice = () => {
    if (!newVoiceName.trim()) return;

    const newVoice: CustomVoice = {
      id: `cv-${Date.now()}`,
      name: newVoiceName.trim(),
      baseVoice: newVoiceBase,
      instruction: newVoiceInstruction.trim(),
    };

    const currentCustoms = settings.customVoices || [];
    const updatedCustoms = [...currentCustoms, newVoice];

    onUpdateSettings({
      customVoices: updatedCustoms,
      ttsVoice: newVoice.id,
    });

    setNewVoiceName('');
    setNewVoiceInstruction('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleDeleteCustomVoice = (idToDelete: string) => {
    const currentCustoms = settings.customVoices || [];
    const filtered = currentCustoms.filter((c) => c.id !== idToDelete);
    const newSelectedVoice = settings.ttsVoice === idToDelete ? 'Kore' : settings.ttsVoice;

    onUpdateSettings({
      customVoices: filtered,
      ttsVoice: newSelectedVoice,
    });
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            Estúdio de Instruções &amp; Gestor de Vozes
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Personalize vozes neurais, crie timbres customizados e defina as instruções do Google Gemini.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onUpdateSettings(DEFAULT_SETTINGS)}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restaurar Padrões</span>
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-600/20"
          >
            {saveSuccess ? (
              <>
                <Check className="h-4 w-4 text-emerald-300" />
                <span>Configurações Salvas!</span>
              </>
            ) : (
              <span>Salvar Alterações</span>
            )}
          </button>
        </div>
      </div>

      {/* CONFIGURAÇÃO SEGURA DA CHAVE DE API GOOGLE GEMINI */}
      <SecureApiKeyCard settings={settings} onUpdateSettings={onUpdateSettings} />

      {/* 1. SELEÇÃO DE VOZ GEMINI TTS (BASE + CUSTOMIZADAS) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-blue-400" />
              Seleção de Voz Neural Ativa (Google Gemini)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Esta voz será usada no popup do Chrome, no atalho Ctrl+B e no Google Lens.
            </p>
          </div>

          <button
            onClick={() => handleTestVoice(settings.ttsVoice)}
            disabled={testingVoice}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {testingVoice ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>Testar Voz Selecionada</span>
          </button>
        </div>

        {/* Vozes Nativas Base */}
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Vozes Nativas Gemini
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {baseVoiceOptions.map((v) => {
              const isSelected = settings.ttsVoice === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onUpdateSettings({ ttsVoice: v.id })}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 text-white ring-1 ring-blue-500'
                      : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-semibold text-xs flex items-center justify-between">
                    <span>{v.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{v.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vozes Personalizadas Adicionadas */}
        {(settings.customVoices && settings.customVoices.length > 0) && (
          <div>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
              ⭐ Suas Vozes Personalizadas Criadas ({settings.customVoices.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {settings.customVoices.map((cv) => {
                const isSelected = settings.ttsVoice === cv.id;
                return (
                  <div
                    key={cv.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300'
                    }`}
                  >
                    <button
                      onClick={() => onUpdateSettings({ ttsVoice: cv.id })}
                      className="flex-1 text-left cursor-pointer pr-2"
                    >
                      <div className="font-semibold text-xs flex items-center gap-2">
                        <span>⭐ {cv.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          Base {cv.baseVoice}
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-amber-400" />}
                      </div>
                      {cv.instruction && (
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">
                          "{cv.instruction}"
                        </p>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteCustomVoice(cv.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Excluir esta voz personalizada"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PAINEL PARA ADICIONAR NOVA VOZ PERSONALIZADA */}
        <div className="pt-4 border-t border-slate-800/80 space-y-4 bg-slate-950/60 p-4 rounded-xl border border-blue-500/20">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-300 flex items-center gap-1.5 uppercase tracking-wide">
              <Plus className="h-4 w-4 text-blue-400" />
              Adicionar Nova Voz Neural Personalizada
            </h4>
            <span className="text-[10px] text-slate-400">
              Disponível no menu da extensão Chrome e no mixer
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Nome da Nova Voz
              </label>
              <input
                type="text"
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
                placeholder="Ex: Satiro - Emotivo e Calmo"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Voz Base Gemini
              </label>
              <select
                value={newVoiceBase}
                onChange={(e) => setNewVoiceBase(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {baseVoiceOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.desc})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Instrução / Personalidade Única para esta Voz
            </label>
            <textarea
              rows={2}
              value={newVoiceInstruction}
              onChange={(e) => setNewVoiceInstruction(e.target.value)}
              placeholder="Ex: Fale de forma extremamente entusiasmada, afetuosa, muito clara e fluida."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">
              Texto de Teste para Reprodução
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sampleTestText}
                onChange={(e) => setSampleTestText(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleTestNewVoiceForm}
                disabled={testingNewVoice || !sampleTestText.trim()}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {testingNewVoice ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span>Ouvir Teste</span>
              </button>

              <button
                type="button"
                onClick={handleAddCustomVoice}
                disabled={!newVoiceName.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-md shadow-blue-600/20"
              >
                <Plus className="h-4 w-4" />
                <span>Adicionar Voz</span>
              </button>
            </div>
          </div>
        </div>

        {onNavigateToMixer && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-cyan-400" />
              Deseja ajustar equalização de frequências, compressor de voz ou som ambiente?
            </span>
            <button
              type="button"
              onClick={onNavigateToMixer}
              className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <span>Abrir Mixer de TTS Completo →</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. INSTRUÇÕES DO NARRADOR (TTS - CTRL+B) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-blue-400" />
              Instruções Gerais para o Narrador (TTS)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Define a postura geral de leitura para todos os textos selecionados com <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300 text-[10px]">Ctrl+B</kbd>.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {narratorPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onUpdateSettings({ narratorInstruction: preset.text })}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition cursor-pointer"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          value={settings.narratorInstruction}
          onChange={(e) => onUpdateSettings({ narratorInstruction: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
          placeholder="Ex: Você é um narrador natural e expressivo..."
        />
      </div>

      {/* 3. INSTRUÇÕES DO TRANSCRITOR (STT - PAUSE/BREAK) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Mic className="h-4 w-4 text-rose-400" />
              Instruções para o Transcritor de Voz (STT)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Controla como o áudio gravado com <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300 text-[10px]">Pause</kbd> é convertido em texto.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {transcriberPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onUpdateSettings({ transcriberInstruction: preset.text })}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition cursor-pointer"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          value={settings.transcriberInstruction}
          onChange={(e) => onUpdateSettings({ transcriberInstruction: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500 leading-relaxed font-sans"
          placeholder="Ex: Transcreva com fidelidade absoluta..."
        />
      </div>

      {/* 4. INSTRUÇÕES DE VISÃO (OCR & IMAGEM - CTRL+ARRASTAR) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-400" />
              Instruções para Recorte de Tela &amp; Imagem (Google Lens)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Orienta o modelo na leitura de textos, gráficos e telas com <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300 text-[10px]">Ctrl+Shift+Arrastar</kbd>.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {visionPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onUpdateSettings({ visionInstruction: preset.text })}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition cursor-pointer"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={3}
          value={settings.visionInstruction}
          onChange={(e) => onUpdateSettings({ visionInstruction: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
          placeholder="Ex: Analise detalhadamente a imagem capturada..."
        />
      </div>
    </div>
  );
};
