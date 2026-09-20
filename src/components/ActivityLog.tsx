import React, { useState, useMemo } from 'react';
import {
  Volume2,
  Eye,
  Mic,
  Play,
  Trash2,
  Clock,
  Calendar,
  Target,
  Copy,
  Check,
  Search,
  Download,
  Filter,
  FileSpreadsheet,
  FileJson,
  FileText,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Hash,
  Activity,
  AlignLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { NarrationLog } from '../types';
import { playAudioFromBase64 } from '../utils/audio';

interface ActivityLogProps {
  logs: NarrationLog[];
  onClearLogs: () => void;
  onDeleteLog?: (id: string) => void;
  onSeedSampleLogs?: () => void;
  onNavigateToTest?: () => void;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  logs,
  onClearLogs,
  onDeleteLog,
  onSeedSampleLogs,
  onNavigateToTest,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'transcription' | 'selection' | 'vision'>('transcription');
  const [selectedTarget, setSelectedTarget] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);

  // Copiar texto para o clipboard
  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
    }
  };

  // Reproduzir áudio existente ou sintetizar com Gemini TTS
  const handlePlayAudio = async (log: NarrationLog) => {
    if (log.audioUrl) {
      setPlayingId(log.id);
      playAudioFromBase64(log.audioUrl, 'audio/wav');
      setTimeout(() => setPlayingId(null), (log.durationMs || 3000));
      return;
    }

    // Se for transcrição sem áudio retornado, sintetiza sob demanda para ouvir
    try {
      setTtsLoadingId(log.id);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: log.text,
          voiceName: 'Puck',
          instruction: 'Fale de forma clara, natural e expressiva em português brasileiro.',
        }),
      });
      const data = await res.json();
      if (data.success && data.audioBase64) {
        setPlayingId(log.id);
        playAudioFromBase64(data.audioBase64, data.mimeType || 'audio/wav');
        setTimeout(() => setPlayingId(null), (log.durationMs || 3000));
      }
    } catch (err) {
      console.error('Erro ao sintetizar áudio para o histórico:', err);
    } finally {
      setTtsLoadingId(null);
    }
  };

  // Baixar transcrição única como arquivo de texto
  const handleDownloadSingleTxt = (log: NarrationLog) => {
    const dateStr = new Date(log.timestamp).toISOString();
    const content = `[HISTÓRICO VOCALLENS AI]
Data: ${new Date(log.timestamp).toLocaleDateString('pt-BR')}
Hora: ${new Date(log.timestamp).toLocaleTimeString('pt-BR')}
Tipo: ${log.type.toUpperCase()}
Alvo de Origem: ${log.targetFieldName || log.targetField || 'Global/Livre'}
Seletor DOM: ${log.targetSelector || 'N/A'}
Palavras: ${log.wordCount || log.text.split(/\s+/).filter(Boolean).length}
Caracteres: ${log.charCount || log.text.length}
Latência: ${log.durationMs || 'N/A'}ms

TEXTO:
${log.text}
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${log.id}-${dateStr.slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Exportar histórico completo para CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Data', 'Hora', 'Tipo', 'Campo_Alvo', 'Seletor', 'Tag', 'Palavras', 'Caracteres', 'Latencia_ms', 'Texto'];
    const rows = logs.map((l) => {
      const d = new Date(l.timestamp);
      const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
      return [
        l.id,
        d.toLocaleDateString('pt-BR'),
        d.toLocaleTimeString('pt-BR'),
        l.type,
        escape(l.targetFieldName || l.targetField || 'Livre'),
        escape(l.targetSelector || ''),
        escape(l.targetTag || ''),
        l.wordCount || l.text.split(/\s+/).filter(Boolean).length,
        l.charCount || l.text.length,
        l.durationMs || 0,
        escape(l.text),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-transcricoes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Exportar histórico completo para JSON
  const handleExportJSON = () => {
    if (logs.length === 0) return;
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-transcricoes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Métricas calculadas
  const metrics = useMemo(() => {
    const transcriptions = logs.filter((l) => l.type === 'transcription');
    const selections = logs.filter((l) => l.type === 'selection');
    const visions = logs.filter((l) => l.type === 'vision');

    const totalWords = transcriptions.reduce((acc, curr) => {
      const words = curr.wordCount ?? curr.text.split(/\s+/).filter(Boolean).length;
      return acc + words;
    }, 0);

    const totalChars = transcriptions.reduce((acc, curr) => {
      const chars = curr.charCount ?? curr.text.length;
      return acc + chars;
    }, 0);

    const avgLatency = transcriptions.length > 0
      ? Math.round(transcriptions.reduce((acc, curr) => acc + (curr.durationMs || 0), 0) / transcriptions.length)
      : 0;

    // Alvos únicos
    const targets = new Set<string>();
    transcriptions.forEach((t) => {
      if (t.targetFieldName) targets.add(t.targetFieldName);
      else if (t.targetField) targets.add(t.targetField);
    });

    return {
      transcriptionCount: transcriptions.length,
      selectionCount: selections.length,
      visionCount: visions.length,
      totalWords,
      totalChars,
      avgLatency,
      uniqueTargetsCount: targets.size,
    };
  }, [logs]);

  // Lista de alvos únicos para o dropdown
  const availableTargets = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.type === 'transcription') {
        const id = l.targetField || 'free';
        const label = l.targetFieldName || l.targetField || 'Gravação Livre';
        map.set(id, label);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [logs]);

  // Filtragem dos registros
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filtro de tipo
      if (activeFilter !== 'all' && log.type !== activeFilter) {
        return false;
      }

      // Filtro de alvo
      if (selectedTarget !== 'all') {
        if (selectedTarget === 'free' && log.targetField) return false;
        if (selectedTarget !== 'free' && log.targetField !== selectedTarget) return false;
      }

      // Filtro de termo de busca
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const textMatch = log.text.toLowerCase().includes(query);
        const targetMatch = (log.targetFieldName || log.targetField || '').toLowerCase().includes(query);
        const selectorMatch = (log.targetSelector || '').toLowerCase().includes(query);
        const dateMatch = new Date(log.timestamp).toLocaleDateString('pt-BR').includes(query);
        if (!textMatch && !targetMatch && !selectorMatch && !dateMatch) {
          return false;
        }
      }

      return true;
    });
  }, [logs, activeFilter, selectedTarget, searchTerm]);

  // Formatação amigável de tempo decorrido
  const getRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 10) return 'Agora mesmo';
    if (diff < 60) return `Há ${diff} segundos`;
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `Há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Há ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Há ${days} dias`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Cabeçalho Principal com Ações Globais */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-rose-500/20 to-blue-500/20 border border-rose-500/30 text-rose-400">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Histórico de Transcrições & Telemetria
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Rastreamento com indicação exata de alvo de destino, carimbo de hora e data, contagem léxica e telemetria Gemini.
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="flex items-center gap-2 flex-wrap">
          {logs.length > 0 && (
            <>
              <button
                id="export-csv-btn"
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                title="Exportar dados para planilha CSV"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>

              <button
                id="export-json-btn"
                onClick={handleExportJSON}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                title="Exportar dados estruturados JSON"
              >
                <FileJson className="h-3.5 w-3.5 text-blue-400" />
                <span>JSON</span>
              </button>

              <button
                id="clear-history-btn"
                onClick={onClearLogs}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-800 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                title="Limpar todos os registros"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpar Tudo</span>
              </button>
            </>
          )}

          {logs.length === 0 && onSeedSampleLogs && (
            <button
              id="seed-sample-logs-btn"
              onClick={onSeedSampleLogs}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-blue-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Gerar Exemplos de Demonstração</span>
            </button>
          )}
        </div>
      </div>

      {/* Cards de Métricas & Visão Geral */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Métrica 1: Transcrições STT */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold">Transcrições STT</span>
            <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
              <Mic className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-100">{metrics.transcriptionCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <span>{metrics.totalWords} palavras transcritas</span>
            </div>
          </div>
        </div>

        {/* Métrica 2: Alvos Monitorados */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold">Alvos Distintos</span>
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Target className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-100">{metrics.uniqueTargetsCount}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Campos identificados
            </div>
          </div>
        </div>

        {/* Métrica 3: Latência Média STT */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold">Latência Média STT</span>
            <div className="p-1 rounded-lg bg-amber-500/10 text-amber-400">
              <Activity className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-100">
              {metrics.avgLatency ? `${metrics.avgLatency}ms` : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Processamento Gemini
            </div>
          </div>
        </div>

        {/* Métrica 4: TTS & Visão */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold">TTS & Capturas Visão</span>
            <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Layers className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-100">
              {metrics.selectionCount + metrics.visionCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {metrics.selectionCount} narrações • {metrics.visionCount} capturas
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Abas de Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            id="filter-tab-all"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            Todos ({logs.length})
          </button>

          <button
            id="filter-tab-transcription"
            onClick={() => setActiveFilter('transcription')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
              activeFilter === 'transcription'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Mic className="h-3.5 w-3.5 text-rose-400" />
            <span>Transcrições STT ({metrics.transcriptionCount})</span>
          </button>

          <button
            id="filter-tab-selection"
            onClick={() => setActiveFilter('selection')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
              activeFilter === 'selection'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Volume2 className="h-3.5 w-3.5 text-blue-400" />
            <span>Narrações TTS ({metrics.selectionCount})</span>
          </button>

          <button
            id="filter-tab-vision"
            onClick={() => setActiveFilter('vision')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition cursor-pointer ${
              activeFilter === 'vision'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Eye className="h-3.5 w-3.5 text-indigo-400" />
            <span>Capturas de Área ({metrics.visionCount})</span>
          </button>
        </div>

        {/* Busca e Filtro de Alvo */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          {availableTargets.length > 0 && (
            <div className="relative shrink-0">
              <select
                id="filter-target-select"
                aria-label="Filtrar por campo alvo"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-rose-500 transition cursor-pointer"
              >
                <option value="all">🎯 Todos os Alvos</option>
                {availableTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              id="search-history-input"
              type="text"
              placeholder="Pesquisar por texto, alvo, data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-blue-500 transition placeholder-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Lista de Registros */}
      {filteredLogs.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 p-8">
          <div className="h-14 w-14 rounded-2xl bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500 mb-3.5 shadow-inner">
            <Mic className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-200">
            {searchTerm || activeFilter !== 'all' || selectedTarget !== 'all'
              ? 'Nenhum registro corresponde aos filtros'
              : 'Nenhuma transcrição ou atividade registrada'}
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {searchTerm || activeFilter !== 'all' || selectedTarget !== 'all'
              ? 'Experimente ajustar os termos de busca ou mudar a categoria selecionada.'
              : 'Clique em um campo na tela de teste e pressione a tecla Pause/Break (ou o botão Gravar) para gravar e registrar a transcrição com o alvo especificado.'}
          </p>

          <div className="mt-5 flex items-center justify-center gap-3">
            {onNavigateToTest && (
              <button
                onClick={onNavigateToTest}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              >
                <span>Ir para o Laboratório de Teste</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            {onSeedSampleLogs && (
              <button
                onClick={onSeedSampleLogs}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Carregar Registros de Teste
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredLogs.map((log) => {
            const dateObj = new Date(log.timestamp);
            const formattedDate = dateObj.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            });
            const shortDate = dateObj.toLocaleDateString('pt-BR');
            const formattedTime = dateObj.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const relativeTime = getRelativeTime(log.timestamp);
            const wordCount = log.wordCount ?? log.text.split(/\s+/).filter(Boolean).length;
            const charCount = log.charCount ?? log.text.length;

            return (
              <div
                key={log.id}
                className={`p-5 rounded-2xl bg-slate-900/90 border transition-all hover:shadow-lg ${
                  log.type === 'transcription'
                    ? 'border-slate-800 hover:border-rose-500/40 hover:shadow-rose-950/10'
                    : log.type === 'vision'
                    ? 'border-slate-800 hover:border-indigo-500/40'
                    : 'border-slate-800 hover:border-blue-500/40'
                }`}
              >
                {/* Linha Superior do Card: Tipo, Alvo e Data/Hora */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Badge do Tipo de Evento */}
                    {log.type === 'transcription' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/25 text-xs font-bold uppercase tracking-wider">
                        <Mic className="h-3.5 w-3.5 text-rose-400" />
                        <span>Transcrição de Voz (STT)</span>
                      </span>
                    )}
                    {log.type === 'selection' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/25 text-xs font-bold uppercase tracking-wider">
                        <Volume2 className="h-3.5 w-3.5 text-blue-400" />
                        <span>Narração de Seleção (TTS)</span>
                      </span>
                    )}
                    {log.type === 'vision' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 text-xs font-bold uppercase tracking-wider">
                        <Eye className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Captura de Tela (Visão)</span>
                      </span>
                    )}

                    {/* SINALIZAÇÃO EXPLÍCITA DO ALVO DE ONDE FOI TRANSCRITA */}
                    {log.type === 'transcription' && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs font-semibold">
                        <Target className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-slate-400">Alvo:</span>
                        <strong className="text-emerald-300 font-bold">
                          {log.targetFieldName || log.targetField || 'Gravação Livre (HUD Flutuante)'}
                        </strong>
                        {log.targetSelector && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                            {log.targetSelector}
                          </span>
                        )}
                        {log.targetTag && (
                          <span className="text-[9px] font-mono text-slate-300 bg-slate-800/80 px-1 py-0.2 rounded">
                            &lt;{log.targetTag}&gt;
                          </span>
                        )}
                      </div>
                    )}

                    {log.type !== 'transcription' && log.targetFieldName && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs">
                        <Target className="h-3 w-3 text-blue-400" />
                        <span className="text-slate-400">Origem:</span>
                        <span className="text-slate-200">{log.targetFieldName}</span>
                      </div>
                    )}
                  </div>

                  {/* CARIMBO DE DATA E HORA EXPLÍCITOS */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800/90 px-2.5 py-1 rounded-lg" title={`Data completa: ${formattedDate}`}>
                      <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="font-medium text-slate-200">{shortDate}</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800/90 px-2.5 py-1 rounded-lg">
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-mono font-medium text-slate-200">{formattedTime}</span>
                      <span className="text-[10px] text-slate-400">({relativeTime})</span>
                    </div>
                  </div>
                </div>

                {/* Conteúdo Principal do Card */}
                <div className="mt-3.5 flex flex-col md:flex-row items-start gap-4">
                  {/* Thumbnail de captura de visão se houver */}
                  {log.previewImage && (
                    <div className="h-20 w-28 shrink-0 rounded-xl bg-slate-950 border border-indigo-700/50 overflow-hidden shadow">
                      <img src={log.previewImage} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}

                  {/* Bloco de Texto Transcrito / Narrado */}
                  <div className="flex-1 min-w-0">
                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 relative group">
                      <p className="text-xs sm:text-sm text-slate-100 font-sans leading-relaxed break-words whitespace-pre-wrap selection:bg-rose-500/30">
                        {log.text}
                      </p>
                    </div>

                    {/* Metadados: Palavras, Caracteres, Duração do Áudio, Latência */}
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded-md text-slate-300">
                        <AlignLeft className="h-3 w-3 text-slate-400" />
                        <span>{wordCount} palavras</span>
                        <span className="text-slate-500">•</span>
                        <span>{charCount} caracteres</span>
                      </span>

                      {log.durationMs && (
                        <span className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded-md font-mono text-slate-300">
                          <Sparkles className="h-3 w-3 text-blue-400" />
                          <span>Latência: {log.durationMs}ms</span>
                        </span>
                      )}

                      {log.audioDurationSec !== undefined && log.audioDurationSec > 0 && (
                        <span className="flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded-md text-slate-300">
                          <Mic className="h-3 w-3 text-rose-400" />
                          <span>Gravação: {log.audioDurationSec}s</span>
                        </span>
                      )}

                      {log.type === 'transcription' && log.targetField && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                          ✓ Inserido com sucesso no campo alvo
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barra de Ações do Item */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Botão Copiar */}
                    <button
                      id={`copy-log-btn-${log.id}`}
                      onClick={() => handleCopyText(log.id, log.text)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedId === log.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-300 font-semibold">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>

                    {/* Botão Ouvir Áudio (Play direto se tiver áudio gerado ou Sintetizar TTS sob demanda) */}
                    <button
                      id={`play-log-btn-${log.id}`}
                      onClick={() => handlePlayAudio(log)}
                      disabled={ttsLoadingId === log.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border ${
                        playingId === log.id
                          ? 'bg-blue-600 text-white border-blue-500 animate-pulse'
                          : 'bg-slate-800/80 hover:bg-slate-700/80 text-blue-300 border-slate-700/60'
                      }`}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>
                        {ttsLoadingId === log.id
                          ? 'Sintetizando voz...'
                          : playingId === log.id
                          ? 'Reproduzindo...'
                          : log.audioUrl
                          ? 'Ouvir Gravação'
                          : 'Ouvir com Gemini TTS'}
                      </span>
                    </button>

                    {/* Botão Baixar Arquivo TXT individual */}
                    <button
                      id={`download-txt-btn-${log.id}`}
                      onClick={() => handleDownloadSingleTxt(log)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border border-slate-700/40 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                      title="Salvar esta transcrição em arquivo .txt"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-400" />
                      <span>Baixar .txt</span>
                    </button>
                  </div>

                  {/* Excluir registro individual */}
                  {onDeleteLog && (
                    <button
                      id={`delete-log-btn-${log.id}`}
                      onClick={() => onDeleteLog(log.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Excluir este registro"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
