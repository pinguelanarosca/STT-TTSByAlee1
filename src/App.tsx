/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TestArena } from './components/TestArena';
import { InstructionStudio } from './components/InstructionStudio';
import { ExtensionViewer } from './components/ExtensionViewer';
import { ActivityLog } from './components/ActivityLog';
import { TtsMixer } from './components/TtsMixer';
import { GithubUpdater } from './components/GithubUpdater';
import { ExtensionSettings, NarrationLog } from './types';
import { DEFAULT_SETTINGS } from './data/extensionFiles';
import { Sparkles, Terminal, Volume2, Mic, Eye, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'test' | 'mixer' | 'instructions' | 'extension' | 'history' | 'github'>('test');

  // Carregar configurações com persistência local
  const [settings, setSettings] = useState<ExtensionSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vocallens_settings');
      if (saved) {
        try {
          const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
          if (parsed.serverUrl && parsed.serverUrl.includes('ais-dev-')) {
            parsed.serverUrl = parsed.serverUrl.replace('ais-dev-', 'ais-pre-');
          }
          return parsed;
        } catch (e) {
          console.error(e);
        }
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Carregar logs com persistência local e dados demonstrativos iniciais
  const [logs, setLogs] = useState<NarrationLog[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vocallens_logs');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    // Dados de exemplo caso esteja vazio
    return [
      {
        id: 'demo-stt-1',
        timestamp: Date.now() - 1000 * 60 * 4,
        type: 'transcription',
        text: 'Apresentação do balanço financeiro e metas de expansão para o terceiro trimestre de 2026.',
        targetField: 'fieldTitle',
        targetFieldName: '1. Título do Relatório',
        targetSelector: '#fieldTitle',
        targetTag: 'INPUT',
        wordCount: 14,
        charCount: 94,
        durationMs: 780,
        audioDurationSec: 4,
      },
      {
        id: 'demo-stt-2',
        timestamp: Date.now() - 1000 * 60 * 22,
        type: 'transcription',
        text: 'Prezados diretores, informamos que a migração dos servidores de voz neural e processamento de áudio via Gemini API foi concluída com êxito sem nenhum downtime.',
        targetField: 'fieldEmail',
        targetFieldName: '2. Resposta de E-mail',
        targetSelector: '#fieldEmail',
        targetTag: 'INPUT',
        wordCount: 24,
        charCount: 161,
        durationMs: 890,
        audioDurationSec: 6,
      },
      {
        id: 'demo-stt-3',
        timestamp: Date.now() - 1000 * 60 * 55,
        type: 'transcription',
        text: 'Decisões da reunião: habilitar atalho Pause/Break no Wayland wl_keyboard (key: 127) para transcrição imediata no campo em foco.',
        targetField: 'fieldNotes',
        targetFieldName: '3. Notas & Decisões da Reunião',
        targetSelector: '#fieldNotes',
        targetTag: 'TEXTAREA',
        wordCount: 20,
        charCount: 133,
        durationMs: 1050,
        audioDurationSec: 7,
      },
      {
        id: 'demo-tts-1',
        timestamp: Date.now() - 1000 * 60 * 120,
        type: 'selection',
        text: 'STT&TTS de Satiro: Extensão do Google Chrome com narração em tempo real de textos selecionados e áudio sintetizado em alta definição.',
        targetFieldName: 'Texto Selecionado na Página',
        targetSelector: 'window.getSelection()',
        targetTag: 'SELECTION',
        wordCount: 18,
        charCount: 125,
        durationMs: 620,
      },
    ];
  });

  const handleUpdateSettings = (newSettings: Partial<ExtensionSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('vocallens_settings', JSON.stringify(updated));
      return updated;
    });
  };

  // Busca automaticamente a chave obtida única e exclusivamente do arquivo .env do servidor
  useEffect(() => {
    fetch('/api/get-key')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.fullKey) {
          handleUpdateSettings({ apiKey: data.fullKey });
        }
      })
      .catch((err) => console.warn('Não foi possível obter a chave de .env:', err));
  }, []);

  const handleAddLog = (newLog: Omit<NarrationLog, 'id' | 'timestamp'>) => {
    const entry: NarrationLog = {
      ...newLog,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setLogs((prev) => {
      const updated = [entry, ...prev].slice(0, 200);
      localStorage.setItem('vocallens_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleDeleteLog = (id: string) => {
    setLogs((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem('vocallens_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSeedSampleLogs = () => {
    const samples: NarrationLog[] = [
      {
        id: 'sample-' + Math.random().toString(36).substring(2, 7),
        timestamp: Date.now() - 1000 * 60 * 2,
        type: 'transcription',
        text: 'Revisão das permissões do manifest.json da extensão e injeção do script de captura de atalhos.',
        targetField: 'fieldTitle',
        targetFieldName: '1. Título do Relatório',
        targetSelector: '#fieldTitle',
        targetTag: 'INPUT',
        wordCount: 15,
        charCount: 104,
        durationMs: 820,
        audioDurationSec: 5,
      },
      {
        id: 'sample-' + Math.random().toString(36).substring(2, 7),
        timestamp: Date.now() - 1000 * 60 * 15,
        type: 'transcription',
        text: 'Olá equipe, o teste com a tecla Pause na área de trabalho funcionou perfeitamente nos campos de formulário.',
        targetField: 'fieldEmail',
        targetFieldName: '2. Resposta de E-mail',
        targetSelector: '#fieldEmail',
        targetTag: 'INPUT',
        wordCount: 18,
        charCount: 111,
        durationMs: 750,
        audioDurationSec: 4,
      },
      {
        id: 'sample-' + Math.random().toString(36).substring(2, 7),
        timestamp: Date.now() - 1000 * 60 * 40,
        type: 'transcription',
        text: 'Ajuste fino nos parâmetros do compressor e reverb do mixer de TTS para obter resposta acústica ideal.',
        targetField: 'fieldNotes',
        targetFieldName: '3. Notas & Decisões da Reunião',
        targetSelector: '#fieldNotes',
        targetTag: 'TEXTAREA',
        wordCount: 18,
        charCount: 106,
        durationMs: 940,
        audioDurationSec: 5,
      },
    ];
    setLogs((prev) => {
      const updated = [...samples, ...prev].slice(0, 200);
      localStorage.setItem('vocallens_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearLogs = () => {
    setLogs([]);
    localStorage.removeItem('vocallens_logs');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Barra de Navegação Superior */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        historyCount={logs.length}
      />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'test' && (
          <TestArena
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onAddLog={handleAddLog}
            logs={logs}
          />
        )}

        {activeTab === 'mixer' && (
          <TtsMixer
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'instructions' && (
          <InstructionStudio
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onNavigateToMixer={() => setActiveTab('mixer')}
          />
        )}

        {activeTab === 'extension' && (
          <ExtensionViewer settings={settings} />
        )}

        {activeTab === 'github' && (
          <GithubUpdater settings={settings} />
        )}

        {activeTab === 'history' && (
          <ActivityLog
            logs={logs}
            onClearLogs={handleClearLogs}
            onDeleteLog={handleDeleteLog}
            onSeedSampleLogs={handleSeedSampleLogs}
            onNavigateToTest={() => setActiveTab('test')}
          />
        )}
      </main>

      {/* Rodapé Informativo */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-400 font-medium">Google Gemini TTS & STT API Integrados</span>
            <span>•</span>
            <span className="font-mono text-emerald-400">gemini-3.5-flash-lite → gemini-3.1-flash-lite → gemini-2.5-flash-lite</span>
            <span>•</span>
            <span>Cascade Fallbacks</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Atalhos: Ctrl+B (TTS) | Ctrl+Arrastar (Visão) | Pause (STT)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
