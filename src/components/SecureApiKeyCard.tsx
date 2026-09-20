import React, { useState } from 'react';
import { Key, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Trash2, ExternalLink, Lock } from 'lucide-react';
import { ExtensionSettings } from '../types';

interface SecureApiKeyCardProps {
  settings: ExtensionSettings;
  onUpdateSettings: (newSettings: Partial<ExtensionSettings>) => void;
}

export const SecureApiKeyCard: React.FC<SecureApiKeyCardProps> = ({
  settings,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const getMaskedKey = (key?: string) => {
    if (!key) return 'Nenhuma chave encontrada em .env';
    if (key.length <= 10) return key.substring(0, 3) + '***' + key.substring(key.length - 2);
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
  };

  const handleValidateKey = async () => {
    if (!settings.apiKey) {
      setValidationResult({
        success: false,
        message: 'Nenhuma chave carregada do arquivo .env na raiz do projeto.',
      });
      return;
    }

    try {
      setValidating(true);
      setValidationResult(null);
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.apiKey }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setValidationResult({
          success: true,
          message: 'Chave do arquivo .env validada com sucesso no Google Gemini!',
        });
      } else {
        setValidationResult({
          success: false,
          message: data.error || 'Falha ao autenticar com o Gemini. Verifique a chave em .env.',
        });
      }
    } catch (err: any) {
      setValidationResult({
        success: false,
        message: 'Não foi possível conectar ao servidor de validação.',
      });
    } finally {
      setValidating(false);
    }
  };

  const isKeyActive = Boolean(settings.apiKey && settings.apiKey.trim().length > 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">Chave de API Google Gemini</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> .env
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Carregada única e exclusivamente do arquivo .env na raiz do projeto
            </p>
          </div>
        </div>

        {/* Status atual */}
        <div className="flex items-center">
          {isKeyActive ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Obtida de .env
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Arquivo .env Não Encontrado
            </span>
          )}
        </div>
      </div>

      {/* Campo mostrando parte da API obtida do arquivo .env */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-300">
          Chave Obtida (<code className="text-amber-400">.env</code>)
        </label>
        <div className="relative flex items-center">
          <div className="absolute left-3 text-slate-400">
            <Key className="h-4 w-4" />
          </div>
          <div
            id="gemini-api-key-display"
            className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-20 py-2.5 text-sm font-mono text-emerald-400 flex items-center justify-between select-all"
          >
            <span>{showKey ? (settings.apiKey || 'Nenhuma chave encontrada') : getMaskedKey(settings.apiKey)}</span>
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-sans px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              .env
            </span>
          </div>
          <div className="absolute right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              title={showKey ? 'Ocultar chave' : 'Mostrar chave'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback de Validação */}
      {validationResult && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
            validationResult.success
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
          }`}
        >
          {validationResult.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{validationResult.message}</span>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          id="validate-api-key-btn"
          onClick={handleValidateKey}
          disabled={validating || !settings.apiKey}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${validating ? 'animate-spin text-white' : ''}`} />
          <span>{validating ? 'Validando no Gemini...' : 'Validar Chave de .env'}</span>
        </button>
      </div>

      {/* Rodapé informativo */}
      <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">Origem da Chave API</span>
          <span className="text-amber-400 font-mono text-[10px] font-bold">/.env</span>
        </div>
        <p className="leading-relaxed">
          A chave de API é lida única e exclusivamente do arquivo <code className="text-slate-300">.env</code> localizado na raiz do projeto. Não busca em variáveis de ambiente.
        </p>
      </div>
    </div>
  );
};
