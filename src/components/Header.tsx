import React from 'react';
import { Download, Sparkles, Volume2, Mic, Eye, Code, FileText, CheckCircle2, Sliders, FolderGit2 } from 'lucide-react';
import { generateExtensionZip } from '../utils/zipGenerator';
import { ExtensionSettings } from '../types';

interface HeaderProps {
  activeTab: 'test' | 'mixer' | 'instructions' | 'extension' | 'history' | 'github';
  setActiveTab: (tab: 'test' | 'mixer' | 'instructions' | 'extension' | 'history' | 'github') => void;
  settings: ExtensionSettings;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  settings,
  historyCount,
}) => {
  const [downloading, setDownloading] = React.useState(false);
  const [downloadSuccess, setDownloadSuccess] = React.useState(false);

  const handleDownloadZip = async () => {
    try {
      setDownloading(true);
      const zipBlob = await generateExtensionZip(settings);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stt-tts-de-satiro.zip';
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

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 sticky top-0 z-40 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Nome */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-lg tracking-tight">STT&amp;TTS de Satiro</span>
                <span className="text-[11px] font-semibold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase">
                  Chrome Extension
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                TTS (Ctrl+B) • Visão (Ctrl+Arrastar) • STT (Pause/Break)
              </p>
            </div>
          </div>

          {/* Modelos, API Key e Download */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('instructions')}
              id="header-api-key-status-btn"
              className="flex items-center gap-1.5 text-xs bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/70 px-2.5 py-1.5 rounded-lg text-slate-300 transition cursor-pointer"
              title="Configurar Chave de API Google Gemini Segura"
            >
              <span className={`h-2 w-2 rounded-full ${settings.apiKey ? 'bg-blue-400' : 'bg-emerald-400'}`} />
              <span className="hidden sm:inline font-medium">
                {settings.apiKey ? 'Chave Personalizada' : 'API Gemini Ativa'}
              </span>
              <span className="sm:hidden font-medium">API</span>
            </button>

            <button
              id="download-extension-header-btn"
              onClick={handleDownloadZip}
              disabled={downloading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>Baixado!</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>{downloading ? 'Gerando ZIP...' : 'Baixar Extensão (.ZIP)'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Barra de Navegação */}
        <div className="flex items-center space-x-1 sm:space-x-2 border-t border-slate-800/80 overflow-x-auto py-2 text-xs sm:text-sm font-medium">
          <button
            id="tab-test-btn"
            onClick={() => setActiveTab('test')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'test'
                ? 'bg-slate-800 text-blue-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Laboratório de Teste</span>
          </button>

          <button
            id="tab-history-btn"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Mic className="h-4 w-4 text-rose-400" />
            <span>Histórico de Transcrições</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'history' ? 'bg-rose-500/30 text-rose-200' : 'bg-slate-800 text-slate-400'
            }`}>
              {historyCount}
            </span>
          </button>

          <button
            id="tab-mixer-btn"
            onClick={() => setActiveTab('mixer')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'mixer'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Sliders className="h-4 w-4 text-cyan-400" />
            <span>Mixer de TTS Completo</span>
          </button>

          <button
            id="tab-instructions-btn"
            onClick={() => setActiveTab('instructions')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'instructions'
                ? 'bg-slate-800 text-blue-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Estúdio de Instruções</span>
          </button>

          <button
            id="tab-extension-btn"
            onClick={() => setActiveTab('extension')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'extension'
                ? 'bg-slate-800 text-blue-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Code className="h-4 w-4" />
            <span>Código da Extensão</span>
          </button>

          <button
            id="tab-github-btn"
            onClick={() => setActiveTab('github')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'github'
                ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FolderGit2 className="h-4 w-4 text-indigo-400" />
            <span>Atualização via GitHub</span>
          </button>
        </div>
      </div>
    </header>
  );
};
