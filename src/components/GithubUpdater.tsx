import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitPullRequest,
  GitCommit,
  RefreshCw,
  Download,
  Terminal,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  FolderGit2,
  Copy,
  Check,
  Package,
  Layers,
  Sparkles,
  Upload,
  Key,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  Info,
} from 'lucide-react';
import { GitStatusData, GitUpdateResult, GitUpdateStep } from '../types';
import { generateExtensionZip } from '../utils/zipGenerator';
import { ExtensionSettings } from '../types';

interface GithubUpdaterProps {
  settings: ExtensionSettings;
}

export const GithubUpdater: React.FC<GithubUpdaterProps> = ({ settings }) => {
  const [repoUrl, setRepoUrl] = useState('https://github.com/pinguelanarosca/STT-TTSByAlee');
  const [branch, setBranch] = useState('main');
  const [force, setForce] = useState(false);
  const [runInstall, setRunInstall] = useState(true);

  // Estados para Envio / Push de Commit
  const [pushCommitMessage, setPushCommitMessage] = useState('Atualização STT & TTS Satiro');
  const [githubToken, setGithubToken] = useState('');
  const [pushForce, setPushForce] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusData, setStatusData] = useState<GitStatusData | null>(null);

  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<GitUpdateResult | null>(null);

  const [restartingChrome, setRestartingChrome] = useState(false);
  const [restartMessage, setRestartMessage] = useState<string | null>(null);

  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '[$] Módulo de Atualização via GitHub inicializado.',
    '[$] Pronto para verificar status, baixar atualizações, enviar commits e recarregar a extensão.',
  ]);

  const [copiedRestart, setCopiedRestart] = useState(false);
  const [copiedExtensions, setCopiedExtensions] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  // 1. Verificar Status do Git
  const handleCheckStatus = async () => {
    try {
      setLoadingStatus(true);
      addLog('Verificando status do Git e repositório local...');
      const res = await fetch('/api/git/status');
      const data: GitStatusData = await res.json();
      setStatusData(data);

      if (data.remoteUrl && data.remoteUrl !== 'https://github.com/pinguelanarosca/STT-TTSByAlee') {
        setRepoUrl(data.remoteUrl);
      }
      if (data.branch) {
        setBranch(data.branch);
      }

      addLog(`Status obtido: ${data.isGitRepo ? 'Repositório Git ativo' : 'Pasta não inicializada como Git'}`);
      addLog(`Branch: ${data.branch} | Commit: ${data.currentCommit} | Modificados: ${data.modifiedFiles.length}`);
      if (data.hasUpdates) {
        addLog(`⚡ Atualização detectada no GitHub! Commit remoto: ${data.remoteLatestCommit}`);
      }
    } catch (err: any) {
      addLog(`❌ Erro ao consultar status do Git: ${err.message}`);
    } finally {
      setLoadingStatus(false);
    }
  };

  // 2. Inicializar Git local se não for repo
  const handleInitGit = async () => {
    try {
      setLoadingStatus(true);
      addLog(`Inicializando repositório Git local com remote: ${repoUrl}...`);
      const res = await fetch('/api/git/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (data.steps) {
        data.steps.forEach((s: GitUpdateStep) => {
          addLog(`[$ ${s.command}] -> ${s.output}`);
        });
      }
      addLog(data.message);
      await handleCheckStatus();
    } catch (err: any) {
      addLog(`❌ Erro ao inicializar Git: ${err.message}`);
    } finally {
      setLoadingStatus(false);
    }
  };

  // 3. Baixar e Instalar do GitHub
  const handlePullAndInstall = async () => {
    try {
      setUpdating(true);
      setUpdateResult(null);
      addLog(`Iniciando download e instalação do GitHub (${repoUrl} @ ${branch})...`);

      const res = await fetch('/api/git/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          branch,
          force,
          runInstall,
        }),
      });

      const data: GitUpdateResult = await res.json();
      setUpdateResult(data);

      if (data.steps) {
        data.steps.forEach((step) => {
          const icon = step.success ? '✓' : '⚠️';
          addLog(`${icon} [${step.name}] ${step.command} (${step.durationMs}ms)`);
          if (step.output) {
            step.output.split('\n').forEach((line) => {
              if (line.trim()) addLog(`   ${line}`);
            });
          }
        });
      }

      if (data.success) {
        addLog(`✓ ${data.message}`);
        addLog('⚡ Pronto para reiniciar o Chrome ou recarregar a extensão.');
      } else {
        addLog(`❌ Falha na atualização: ${data.message} ${data.error ? '(' + data.error + ')' : ''}`);
      }

      await handleCheckStatus();
    } catch (err: any) {
      addLog(`❌ Erro crítico ao conectar com servidor: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // 3.1. Enviar Commit e Push para o GitHub
  const handlePushToGithub = async () => {
    try {
      setPushing(true);
      addLog(`Iniciando envio (git push) para ${repoUrl} na branch "${branch}"...`);
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          branch,
          commitMessage: pushCommitMessage,
          githubToken,
          force: pushForce,
        }),
      });
      const data = await res.json();

      if (data.steps) {
        data.steps.forEach((step: any) => {
          const icon = step.success ? '✓' : '⚠️';
          addLog(`${icon} [${step.name}] ${step.command} (${step.durationMs}ms)`);
          if (step.output) {
            step.output.split('\n').forEach((line: string) => {
              if (line.trim()) addLog(`   ${line}`);
            });
          }
        });
      }

      if (data.success) {
        addLog(`✓ ${data.message}`);
      } else {
        addLog(`❌ Falha no envio: ${data.message}`);
        if (data.error) addLog(`   Detalhe: ${data.error}`);
      }

      await handleCheckStatus();
    } catch (err: any) {
      addLog(`❌ Erro na requisição de push: ${err.message}`);
    } finally {
      setPushing(false);
    }
  };

  // 4. Reiniciar o Google Chrome
  const handleRestartChrome = async () => {
    try {
      setRestartingChrome(true);
      addLog('Enviando comando de reinício para o Google Chrome...');
      const res = await fetch('/api/git/restart-chrome', { method: 'POST' });
      const data = await res.json();

      if (data.actionsTaken) {
        data.actionsTaken.forEach((act: string) => addLog(`[Sistema] ${act}`));
      }
      addLog(`✓ ${data.message}`);
      setRestartMessage(data.message);

      // Tenta enviar mensagem para recarregar a extensão se estiver executando dentro do Chrome
      if (typeof window !== 'undefined' && (window as any).chrome?.runtime?.reload) {
        try {
          (window as any).chrome.runtime.reload();
          addLog('✓ Extensão recarregada diretamente via chrome.runtime.reload()');
        } catch {}
      }

      setTimeout(() => setRestartMessage(null), 8000);
    } catch (err: any) {
      addLog(`❌ Falha no comando de reinício: ${err.message}`);
    } finally {
      setRestartingChrome(false);
    }
  };

  const handleCopyText = (text: string, type: 'restart' | 'extensions') => {
    navigator.clipboard.writeText(text);
    if (type === 'restart') {
      setCopiedRestart(true);
      setTimeout(() => setCopiedRestart(false), 2000);
    } else {
      setCopiedExtensions(true);
      setTimeout(() => setCopiedExtensions(false), 2000);
    }
    addLog(`Copiado para a área de transferência: ${text}`);
  };

  const handleDownloadUpdatedZip = async () => {
    try {
      setDownloadingZip(true);
      addLog('Gerando arquivo ZIP atualizado da extensão...');
      const zipBlob = await generateExtensionZip(settings);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stt-tts-de-satiro-atualizado.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog('✓ Download do pacote ZIP atualizado concluído com sucesso!');
    } catch (err: any) {
      addLog(`❌ Erro ao baixar ZIP: ${err.message}`);
    } finally {
      setDownloadingZip(false);
    }
  };

  useEffect(() => {
    handleCheckStatus();
  }, []);

  return (
    <div className="space-y-6" id="github-updater-root">
      {/* Banner Principal com Identidade do GitHub */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/70 border border-slate-800 p-6 shadow-xl">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-100 shadow-md">
              <FolderGit2 className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                  Atualização do App via GitHub
                </h1>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {statusData?.branch || branch}
                </span>
                {statusData?.isGitRepo && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Git Ativo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Verifique o status do repositório, baixe e instale a versão mais recente diretamente do GitHub e reinicie o Chrome com um único clique.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="quick-check-status-btn"
              onClick={handleCheckStatus}
              disabled={loadingStatus || updating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin text-blue-400' : ''}`} />
              <span>{loadingStatus ? 'Verificando...' : 'Verificar Status'}</span>
            </button>

            <button
              id="quick-pull-btn"
              onClick={handlePullAndInstall}
              disabled={updating || loadingStatus}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition cursor-pointer disabled:opacity-50"
            >
              <Download className={`h-4 w-4 ${updating ? 'animate-bounce' : ''}`} />
              <span>{updating ? 'Baixando...' : 'Baixar & Instalar'}</span>
            </button>
          </div>
        </div>

        {/* Métricas de Status do Git */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-medium">Commit Atual</span>
            <div className="flex items-center gap-1.5 mt-1">
              <GitCommit className="h-3.5 w-3.5 text-blue-400" />
              <span className="font-mono font-bold text-slate-200">
                {statusData?.currentCommit || 'Verificando...'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-medium">Branch Ativo</span>
            <div className="flex items-center gap-1.5 mt-1">
              <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono font-bold text-emerald-300">
                {statusData?.branch || branch}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-medium">Árvore Local</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span className={`font-semibold ${statusData?.dirty ? 'text-amber-400' : 'text-emerald-400'}`}>
                {statusData?.dirty ? `${statusData.modifiedFiles.length} Modificados` : 'Limpa (Clean)'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-medium">Versão do Git</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Terminal className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-mono text-slate-300 truncate">
                {statusData?.gitVersion?.replace('git version ', '') || '2.34+'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Principal com 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda (2/3): Configurações e Ações */}
        <div className="lg:col-span-2 space-y-6">

          {/* ALERTA DIAGNÓSTICO: Como Resolver o Erro "A solicitação contém um argumento inválido" do AI Studio */}
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-amber-200">
                    Como resolver o erro: "Falha ao enviar commit para o GitHub: A solicitação contém um argumento inválido"
                  </h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                    Google AI Studio
                  </span>
                </div>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Esse erro ocorre na janela nativa de exportação/sincronização do AI Studio por um dos seguintes motivos:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 text-xs">
              <div className="bg-slate-950/80 rounded-xl p-3 border border-amber-500/20 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-full bg-amber-500/30 text-amber-200 text-[10px] flex items-center justify-center">1</span>
                  Formato do Nome do Repositório
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  No campo do repositório no modal do AI Studio, certifique-se de preencher exatamente:
                  <code className="block mt-1 p-1 bg-slate-900 rounded font-mono text-emerald-400 text-[10px] select-all">pinguelanarosca/STT-TTSByAlee</code>
                  <span className="text-rose-300 text-[10px] block mt-0.5">❌ Não inclua <code>https://github.com/</code> nem <code>.git</code>.</span>
                </p>
              </div>

              <div className="bg-slate-950/80 rounded-xl p-3 border border-amber-500/20 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-full bg-amber-500/30 text-amber-200 text-[10px] flex items-center justify-center">2</span>
                  Conflito na Branch ou Repositório Não Vazio
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Se o repositório já foi criado no GitHub com README ou outro histórico, o GitHub recusa commits diretos sem merge.
                  <span className="text-emerald-300 text-[10px] block mt-0.5">✓ No campo Branch, experimente criar uma branch como <code>v1</code> ou <code>update</code>.</span>
                </p>
              </div>

              <div className="bg-slate-950/80 rounded-xl p-3 border border-amber-500/20 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-full bg-amber-500/30 text-amber-200 text-[10px] flex items-center justify-center">3</span>
                  Mensagem de Commit Obrigatória
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Não deixe o campo de mensagem em branco. Digite um texto simples sem caracteres especiais como:
                  <code className="block mt-1 p-1 bg-slate-900 rounded font-mono text-emerald-400 text-[10px] select-all">Atualizacao STT TTS Satiro</code>
                </p>
              </div>

              <div className="bg-slate-950/80 rounded-xl p-3 border border-amber-500/20 space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-full bg-amber-500/30 text-amber-200 text-[10px] flex items-center justify-center">4</span>
                  Autorização GitHub Expirada
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Acesse <a href="https://github.com/settings/applications" target="_blank" rel="noreferrer" className="text-blue-400 underline font-medium">github.com/settings/applications</a>, revogue a autorização do Google AI Studio e clique para conectar novamente.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs border-t border-amber-500/20">
              <span className="text-amber-200/90 text-[11px]">
                💡 <strong>Alternativa direta:</strong> Você pode enviar commits para o GitHub diretamente pelo painel abaixo usando um Personal Access Token (PAT).
              </span>
            </div>
          </div>

          {/* Card 1: Configuração do Repositório GitHub (Pull & Download) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderGit2 className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-bold text-slate-100">Origem &amp; Repositório Remoto</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {statusData?.isGitRepo ? 'git remote: origin' : 'Pronto para Vincular'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-300">URL do Repositório GitHub</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/usuario/repositorio"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Opções de Atualização */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/80 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={runInstall}
                  onChange={(e) => setRunInstall(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Executar <code>npm install</code> após pull</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-amber-300">Forçar sobrescrita (descartar modificações locais não commitadas)</span>
              </label>
            </div>

            {/* Ações Rápidas de Git */}
            <div className="flex flex-wrap gap-2.5 pt-3">
              <button
                id="btn-action-status"
                onClick={handleCheckStatus}
                disabled={loadingStatus}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin text-blue-400' : ''}`} />
                <span>1. Verificar Status Git</span>
              </button>

              {!statusData?.isGitRepo && (
                <button
                  id="btn-action-init"
                  onClick={handleInitGit}
                  disabled={loadingStatus}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FolderGit2 className="h-3.5 w-3.5" />
                  <span>Inicializar Repositório Git</span>
                </button>
              )}

              <button
                id="btn-action-pull"
                onClick={handlePullAndInstall}
                disabled={updating}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className={`h-3.5 w-3.5 ${updating ? 'animate-bounce' : ''}`} />
                <span>2. Baixar e Instalar de Lá</span>
              </button>

              <button
                id="btn-action-restart"
                onClick={handleRestartChrome}
                disabled={restartingChrome}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer ml-auto"
              >
                <RotateCw className={`h-3.5 w-3.5 ${restartingChrome ? 'animate-spin' : ''}`} />
                <span>3. Reiniciar o Chrome</span>
              </button>
            </div>
          </div>

          {/* Card 1.5: Enviar Commit para o GitHub (Push Direto do Servidor) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-100">Enviar Commit para o GitHub (Push Direto)</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                git push origin {branch}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Use este envio direto caso o botão de sincronização do AI Studio apresente erro de argumento inválido.
              Todos os arquivos da aplicação e extensão serão commitados e enviados diretamente para o repositório remoto.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Mensagem do Commit</label>
                <input
                  type="text"
                  value={pushCommitMessage}
                  onChange={(e) => setPushCommitMessage(e.target.value)}
                  placeholder="Ex: Atualização STT & TTS Satiro"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                    <Key className="h-3 w-3 text-amber-400" />
                    Personal Access Token (PAT)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=Satiro_STT_TTS_Push"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center gap-0.5"
                  >
                    <span>Criar token no GitHub</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_... (necessário para repositórios privados ou push sem OAuth)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pushForce}
                  onChange={(e) => setPushForce(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span className="text-amber-300">Forçar envio (<code>--force</code>) se houver divergência remota</span>
              </label>

              <button
                id="btn-action-push"
                onClick={handlePushToGithub}
                disabled={pushing || loadingStatus}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Upload className={`h-4 w-4 ${pushing ? 'animate-bounce' : ''}`} />
                <span>{pushing ? 'Enviando Commit...' : '🚀 Enviar Commit para o GitHub'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Terminal Interativo de Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200">Terminal de Execução Git &amp; Atualização</h3>
              </div>
              <button
                onClick={() => setTerminalLogs(['[$] Terminal limpo. Pronto.'])}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition"
              >
                Limpar Logs
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/90 font-mono text-[11px] text-slate-300 h-64 overflow-y-auto space-y-1">
              {terminalLogs.map((line, idx) => {
                const isError = line.includes('❌') || line.includes('error') || line.includes('fatal');
                const isSuccess = line.includes('✓');
                const isCmd = line.startsWith('[$');
                return (
                  <div
                    key={idx}
                    className={`leading-relaxed break-all ${
                      isError
                        ? 'text-rose-400'
                        : isSuccess
                        ? 'text-emerald-400 font-semibold'
                        : isCmd
                        ? 'text-blue-400 font-semibold'
                        : 'text-slate-300'
                    }`}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Coluna Direita (1/3): Reinício do Chrome e Instruções */}
        <div className="space-y-6">
          {/* Card: Reiniciar o Google Chrome */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <RotateCw className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-100">Reiniciar Google Chrome</h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Após baixar e instalar a nova versão pelo GitHub, reinicie o navegador ou recarregue a extensão para que as alterações surtam efeito imediato.
            </p>

            {restartMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{restartMessage}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                id="btn-restart-chrome-main"
                onClick={handleRestartChrome}
                disabled={restartingChrome}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCw className={`h-4 w-4 ${restartingChrome ? 'animate-spin' : ''}`} />
                <span>Reiniciar Navegador Chrome</span>
              </button>

              <button
                onClick={handleDownloadUpdatedZip}
                disabled={downloadingZip}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="h-4 w-4 text-blue-400" />
                <span>{downloadingZip ? 'Gerando ZIP...' : 'Baixar ZIP Atualizado'}</span>
              </button>
            </div>

            {/* Caixa de URLs do Chrome com Cópia de 1 clique */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
              <span className="font-semibold text-slate-300 block text-[11px]">
                Atalhos Nativos do Google Chrome:
              </span>

              {/* chrome://restart */}
              <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                <code className="text-amber-400 font-mono text-[11px]">chrome://restart</code>
                <button
                  onClick={() => handleCopyText('chrome://restart', 'restart')}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-100 bg-slate-800 px-2 py-1 rounded transition"
                >
                  {copiedRestart ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedRestart ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              {/* chrome://extensions */}
              <div className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                <code className="text-blue-400 font-mono text-[11px]">chrome://extensions</code>
                <button
                  onClick={() => handleCopyText('chrome://extensions', 'extensions')}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-100 bg-slate-800 px-2 py-1 rounded transition"
                >
                  {copiedExtensions ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedExtensions ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Guia Rápido Passo a Passo */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3 text-xs text-slate-400">
            <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Como a Atualização Funciona:
            </h4>
            <ol className="list-decimal pl-4 space-y-2 leading-relaxed text-[11px]">
              <li>
                <strong className="text-slate-300">1. Verificar:</strong> O sistema inspeciona se há novos commits no GitHub e o estado da pasta local.
              </li>
              <li>
                <strong className="text-slate-300">2. Baixar &amp; Instalar:</strong> Realiza <code>git pull</code> dos arquivos e instala pacotes com <code>npm install</code>.
              </li>
              <li>
                <strong className="text-slate-300">3. Reiniciar:</strong> Recarrega a extensão em <code>chrome://extensions</code> ou reinicia o navegador pelo <code>chrome://restart</code>.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
