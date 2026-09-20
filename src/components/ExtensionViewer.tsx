import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode,
  ExternalLink,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Settings,
  Sliders,
  Pin,
  Globe,
  Mic,
  Volume2,
  Sparkles,
  AlertCircle,
  Key,
  Cpu,
  Info,
} from 'lucide-react';
import { EXTENSION_FILES } from '../data/extensionFiles';
import { ExtensionSettings } from '../types';
import { generateExtensionZip } from '../utils/zipGenerator';

interface ExtensionViewerProps {
  settings: ExtensionSettings;
}

export const ExtensionViewer: React.FC<ExtensionViewerProps> = ({ settings }) => {
  const [selectedFile, setSelectedFile] = useState(EXTENSION_FILES[0].filename);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const serverEndpoint = settings.serverUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(serverEndpoint);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const activeFileItem = EXTENSION_FILES.find((f) => f.filename === selectedFile) || EXTENSION_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFileItem.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const zipBlob = await generateExtensionZip(settings);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vocallens-chrome-extension.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Banner de Download e Instalação */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold uppercase tracking-wider mb-2">
            Manifest V3 • 100% Compatível com Google Chrome
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            Pacote Completo da Extensão Chrome
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Baixe o arquivo ZIP com todos os arquivos prontos (<code className="text-blue-300">manifest.json</code>, scripts de conteúdo, background, popups, ícones e opções) para instalar no seu navegador em menos de 1 minuto.
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="shrink-0 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          <span>{downloading ? 'Gerando Pacote...' : 'Baixar Extensão (.ZIP)'}</span>
        </button>
      </div>

      {/* Card Explicativo: Erros 403/404 & O Novo Modo Direto sem Servidor */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-amber-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <h3 className="text-sm sm:text-base font-bold text-slate-100">
            Dúvidas sobre Erro 403 / 404 e Conexão da Extensão?
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="font-semibold text-rose-400 flex items-center gap-1.5">
              <span>🚫</span>
              <span>Por que os links deram erro 403 ou 404?</span>
            </div>
            <ul className="text-slate-300 space-y-2 leading-relaxed">
              <li>
                <strong className="text-slate-200">ais-dev-... (Erro 403):</strong> É o container de desenvolvimento do AI Studio. O Google Cloud Run bloqueia o acesso externo por questões de segurança.
              </li>
              <li>
                <strong className="text-slate-200">ais-pre-... (Erro 404):</strong> É a URL de compartilhamento. Ela só é ativada após você clicar no botão <strong className="text-blue-300">"Share"</strong> (Compartilhar) no canto superior direito do Google AI Studio.
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2">
            <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Cpu className="h-4 w-4" />
              <span>A Melhor Solução: Modo Direto (Sem Servidor)</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Você <strong>não precisa de nenhum servidor ligado</strong> para usar a extensão! Basta colocar sua <strong className="text-emerald-300">Chave de API Gemini</strong> nas opções ou no popup da extensão.
            </p>
            <p className="text-slate-400 leading-relaxed">
              A extensão agora conecta <strong>diretamente com a API oficial do Google Gemini</strong>. Funciona em qualquer lugar, 100% autônomo, sem erro 403 ou 404!
            </p>
          </div>
        </div>
      </div>

      {/* Passo a Passo Visual de Instalação */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-4">
          <Terminal className="h-4 w-4 text-blue-400" />
          Guia de Instalação Passo a Passo no Google Chrome
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Passo 1</span>
              <h4 className="text-sm font-semibold text-slate-100 mt-2">Extrair o arquivo ZIP</h4>
              <p className="text-xs text-slate-400 mt-1">
                Baixe o <code className="text-slate-200">.zip</code> e descompacte em uma pasta de sua preferência.
              </p>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 font-mono">/vocallens-extension/</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Passo 2</span>
              <h4 className="text-sm font-semibold text-slate-100 mt-2">Abrir Gerenciador de Extensões</h4>
              <p className="text-xs text-slate-400 mt-1">
                No Chrome, digite na barra de endereços:
              </p>
            </div>
            <div className="mt-3 text-[11px] text-blue-400 font-mono bg-slate-900 p-1.5 rounded border border-slate-800">
              chrome://extensions
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Passo 3</span>
              <h4 className="text-sm font-semibold text-slate-100 mt-2">Modo Desenvolvedor</h4>
              <p className="text-xs text-slate-400 mt-1">
                Ative a chave <strong className="text-slate-200">"Modo do desenvolvedor"</strong> no canto superior direito do Chrome.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Chave ativada
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Passo 4</span>
              <h4 className="text-sm font-semibold text-slate-100 mt-2">Carregar sem compactação</h4>
              <p className="text-xs text-slate-400 mt-1">
                Clique no botão <strong className="text-slate-200">"Carregar sem compactação"</strong> e selecione a pasta extraída.
              </p>
            </div>
            <div className="mt-3 text-[11px] text-slate-400">
              Pronto para usar em qualquer site!
            </div>
          </div>
        </div>
      </div>

      {/* Guia Prático: Como Configurar Após Instalar */}
      <div className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Como Configurar a Extensão Após Instalar no Chrome
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Siga estes 4 passos simples para ativar a comunicação com a IA e começar a usar os atalhos.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Item 1: Fixar o Ícone */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 border border-blue-500/20">
              <Pin className="h-4 w-4" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-semibold text-slate-100 text-sm">1. Fixar o Ícone na Barra do Chrome</h4>
              <p className="text-slate-300 leading-relaxed">
                Clique no ícone de peça de quebra-cabeça (<span className="text-slate-200 font-semibold">🧩 Extensões</span>) no canto superior direito do Chrome.
                Ao lado de <strong className="text-blue-300">STT&TTS de Satiro</strong>, clique no botão de <strong>Alfinete (Fixar)</strong> para que o ícone fique sempre visível.
              </p>
            </div>
          </div>

          {/* Item 2: Abrir a Página de Opções */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 border border-emerald-500/20">
              <Sliders className="h-4 w-4" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-semibold text-slate-100 text-sm">2. Acessar as Configurações (Opções)</h4>
              <p className="text-slate-300 leading-relaxed">
                Clique com o <strong className="text-slate-200">botão direito</strong> no ícone do STT&TTS de Satiro e escolha <strong className="text-emerald-300">"Opções"</strong>.
                Ou clique com o botão esquerdo no ícone da extensão e depois no botão <strong className="text-slate-200">"Instruções e Configurações"</strong>.
              </p>
            </div>
          </div>

          {/* Item 3: Conexão Direta ou URL do Servidor */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 border border-cyan-500/20">
              <Key className="h-4 w-4" />
            </div>
            <div className="space-y-2 text-xs flex-1">
              <h4 className="font-semibold text-slate-100 text-sm">3. Chave Gemini (Modo Direto) ou Servidor</h4>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-emerald-400">Modo Direto (Recomendado):</strong> Cole sua Chave de API Gemini no popup da extensão. Ela funcionará 100% autônoma, sem precisar de servidor ligado.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Se quiser usar servidor próprio, configure <code className="text-slate-200">http://localhost:3000</code> ou sua URL de produção:
              </p>
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                <code className="text-[11px] text-cyan-300 font-mono flex-1 truncate">
                  {serverEndpoint}
                </code>
                <button
                  id="copy-server-url-btn"
                  onClick={handleCopyUrl}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 shrink-0 transition cursor-pointer"
                >
                  {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
                  <span>{copiedUrl ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Item 4: Microfone e Voz */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 shrink-0 border border-rose-500/20">
              <Mic className="h-4 w-4" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-semibold text-slate-100 text-sm">4. Permitir Microfone & Escolher Voz</h4>
              <p className="text-slate-300 leading-relaxed">
                No menu popup você pode alternar entre as vozes <strong className="text-slate-200">Kore, Puck, Charon, Fenrir e Zephyr</strong>.
                Na primeira vez que apertar a tecla <strong className="text-rose-300">Pause / Break</strong> em um site, clique em <strong className="text-emerald-400">"Permitir"</strong> quando o Chrome solicitar acesso ao microfone.
              </p>
            </div>
          </div>
        </div>

        {/* Banner de Atalhos Rápidos */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span><strong>Pronto para usar!</strong> Experimente selecionar um texto e apertar <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-blue-300">Ctrl+B</kbd> ou clicar num campo e apertar <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-rose-300">Pause/Break</kbd>.</span>
          </div>
        </div>
      </div>

      {/* Explorador de Código e Arquivos da Extensão */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Cabeçalho de Arquivos */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {EXTENSION_FILES.map((file) => (
              <button
                key={file.filename}
                onClick={() => setSelectedFile(file.filename)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  selectedFile === file.filename
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <FileCode className="h-3.5 w-3.5" />
                <span>{file.filename}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar Código</span>
              </>
            )}
          </button>
        </div>

        {/* Descrição do Arquivo Selecionado */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
          <span>{activeFileItem.description}</span>
          <span className="font-mono text-slate-500 text-[11px]">{activeFileItem.path}</span>
        </div>

        {/* Bloco de Código com Sintaxe */}
        <div className="p-4 sm:p-6 bg-slate-950 overflow-x-auto max-h-[500px]">
          <pre className="text-xs font-mono text-slate-200 leading-relaxed">
            <code>{activeFileItem.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
