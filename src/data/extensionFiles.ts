import { ExtensionFileItem } from '../types';

export const DEFAULT_SETTINGS = {
  connectionMode: 'direct' as const,
  apiKey: 'AQ.Ab8RN6JkFmDWomdC0iYpYX9D787FfbLg5_Vpn0uyY_U8USm50Q',
  serverUrl: '',
  ttsVoice: 'Kore' as const,
  narratorInstruction: 'Você é um narrador natural e expressivo. Leia o texto com dicção impecável, ritmo equilibrado e entonação humana. Converta siglas e números para forma falada fluida.',
  transcriberInstruction: 'Transcreva com fidelidade absoluta o áudio recebido. Aplique pontuação correta (pontos, vírgulas, interrogações), remova gagueiras e vícios de linguagem comuns (como "ééé", "tipo assim"). Retorne estritamente o texto transcrito, sem introduções ou observações.',
  visionInstruction: 'Analise detalhadamente a imagem capturada da tela com o Google Lens. Se contiver texto, transcreva ou leia-o com máxima precisão. Se contiver gráficos, tabelas ou código, resuma e descreva os pontos centrais de forma concisa e natural para ser ouvida.',
  enableCtrlB: true,
  enableCtrlDrag: true,
  enablePauseBreak: true,
  soundFeedback: true,
  ttsSpeed: 1.0,
  ttsPitch: 0,
  ttsVolume: 1.0,
  ttsBass: 0,
  ttsMid: 0,
  ttsTreble: 0,
  ttsAmbience: 'none' as const,
  ttsAmbienceVolume: 0.2,
};

export const EXTENSION_FILES: ExtensionFileItem[] = [
  {
    filename: '.env',
    path: '.env',
    description: 'Arquivo de configuração local da chave de API do Google Gemini',
    language: 'text',
    content: `GEMINI_API_KEY=AQ.Ab8RN6JkFmDWomdC0iYpYX9D787FfbLg5_Vpn0uyY_U8USm50Q\n`
  },
  {
    filename: 'manifest.json',
    path: 'manifest.json',
    description: 'Manifesto da extensão Chrome (Manifest V3)',
    language: 'json',
    content: `{
  "manifest_version": 3,
  "name": "STT&TTS de Satiro",
  "version": "1.2.0",
  "description": "Narra seleções com Ctrl+B, captura tela com Google Lens via Ctrl+Shift+Arrastar e transcreve áudio no campo ativo com Pause/Break ou Ctrl+Shift+Espaço via Google Gemini.",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "contextMenus"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "STT&TTS de Satiro",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  },
  "options_page": "options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}`
  },
  {
    filename: 'background.js',
    path: 'background.js',
    description: 'Service Worker: Captura de tela para Google Lens e auto-injeção em abas abertas',
    language: 'javascript',
    content: `// Background Service Worker - STT&TTS de Satiro
function createContextMenu() {
  if (chrome?.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'vocallens_narrate_selection',
        title: '🎙️ Iniciar Narração (Gemini TTS)',
        contexts: ['selection']
      }, () => {
        if (chrome.runtime.lastError) {
          console.log('[STT&TTS de Satiro] Context menu registrado');
        }
      });
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[STT&TTS de Satiro] Extensão instalada/atualizada.');
  createContextMenu();
  
  // Injeta automaticamente os scripts em todas as abas web comuns já abertas
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {});
        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content.css']
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[STT&TTS de Satiro] Falha na auto-injeção de abas existentes:', err);
  }
});

// Listener para cliques no Menu de Contexto (Botão Direito -> Iniciar Narração)
if (chrome?.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'vocallens_narrate_selection' && tab?.id) {
      const selectedText = info.selectionText || '';
      chrome.tabs.sendMessage(tab.id, {
        action: 'narrate_selected_text',
        text: selectedText
      }).catch(() => {
        // Fallback: reinjeta e tenta enviar novamente
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).then(() => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'narrate_selected_text',
              text: selectedText
            }).catch(() => {});
          }, 200);
        }).catch(() => {});
      });
    }
  });
}

// Captura de tela para Google Lens (Ctrl + Shift + Arrastar)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture_visible_tab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Falha ao capturar tela' });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true; // Canal assíncrono
  }

  // Abrir opções a partir de qualquer script
  if (request.action === 'open_options_page') {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
    sendResponse({ success: true });
    return true;
  }

  // Recarregar a extensão
  if (request.action === 'reload_extension') {
    sendResponse({ success: true });
    setTimeout(() => {
      chrome.runtime.reload();
    }, 100);
    return true;
  }

  // Reiniciar o navegador Google Chrome via chrome://restart
  if (request.action === 'restart_chrome') {
    try {
      chrome.tabs.create({ url: 'chrome://restart' });
    } catch {
      chrome.runtime.reload();
    }
    sendResponse({ success: true });
    return true;
  }
});
`
  },
  {
    filename: 'content.js',
    path: 'content.js',
    description: 'Script de Conteúdo: Atalhos Ctrl+B, Ctrl+Shift+Arrastar (Google Lens) e Pause/Break ou Ctrl+Shift+Espaço com HUD unificado e Telemetria API',
    language: 'javascript',
    content: `// Content Script - STT&TTS de Satiro (100% Autônomo com Modo Direto Gemini & HUD Aprimorado)
(function() {
  // Previne injeção duplicada na mesma página
  if (window.__VOCALLENS_LOADED__) return;
  window.__VOCALLENS_LOADED__ = true;

  let isRecordingAudio = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let targetInputElement = null;
  let activeAudioPlayer = null;

  // Variáveis para seleção de área Google Lens (Ctrl + Shift + Arrastar)
  let isSelectingArea = false;
  let startX = 0, startY = 0;
  let overlayEl = null;
  let selectionBoxEl = null;

  // Histórico local de transcrições e logs de API da sessão
  let sessionTranscriptions = [];
  let apiLogs = [];

  // Configurações padrão com modo direto prioritário
  let settings = {
    connectionMode: 'direct',
    serverUrl: '',
    apiKey: 'AQ.Ab8RN6JkFmDWomdC0iYpYX9D787FfbLg5_Vpn0uyY_U8USm50Q',
    ttsVoice: 'Kore',
    narratorInstruction: 'Você é um narrador natural e expressivo. Leia o texto com dicção impecável.',
    transcriberInstruction: 'Transcreva com fidelidade absoluta o áudio recebido. Aplique pontuação correta.',
    visionInstruction: 'Analise detalhadamente a imagem capturada da tela com o Google Lens.',
    enableCtrlB: true,
    enableCtrlDrag: true,
    enablePauseBreak: true,
    soundFeedback: true,
    ttsSpeed: 1.0,
    ttsVolume: 1.0,
    shortcutNarrateConfig: { ctrl: true, shift: false, alt: false, code: 'KeyB', key: 'b' },
    shortcutRecordConfig: { ctrl: false, shift: false, alt: false, code: 'Pause', key: 'Pause' }
  };

  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(settings, (loaded) => {
        if (loaded) settings = Object.assign(settings, loaded);
      });
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get({ sessionTranscriptions: [], apiLogs: [] }, (res) => {
        if (res && res.sessionTranscriptions) sessionTranscriptions = res.sessionTranscriptions;
        if (res && res.apiLogs) apiLogs = res.apiLogs;
      });
    }
  }
  loadSettings();

  // Escuta alterações de configurações em tempo real
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (let key in changes) {
          settings[key] = changes[key].newValue;
        }
        // Aplica velocidade imediatamente se houver áudio tocando
        if (changes.ttsSpeed && activeAudioPlayer) {
          const newSpd = parseFloat(changes.ttsSpeed.newValue || 1.0);
          activeAudioPlayer.playbackRate = newSpd;
          activeAudioPlayer.defaultPlaybackRate = newSpd;
        }
      }
      if (area === 'local') {
        if (changes.sessionTranscriptions) sessionTranscriptions = changes.sessionTranscriptions.newValue || [];
        if (changes.apiLogs) apiLogs = changes.apiLogs.newValue || [];
      }
    });
  }

  // -------------------------------------------------------------
  // TELEMETRIA & LOGS DETALHADOS DE API GEMINI
  // -------------------------------------------------------------
  function logApiCall(entry) {
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logItem = {
      id: 'api-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: Date.now(),
      timeFormatted: timeStr,
      action: entry.action || 'API',
      model: entry.model || 'gemini-3.5-flash-lite',
      endpoint: entry.endpoint || 'generateContent',
      latencyMs: entry.latencyMs || 0,
      statusCode: entry.statusCode || (entry.success ? 200 : 500),
      statusText: entry.statusText || (entry.success ? 'OK' : 'Error'),
      success: Boolean(entry.success),
      payloadInfo: entry.payloadInfo || '',
      errorMessage: entry.errorMessage || null,
      mode: entry.mode || 'direct'
    };

    apiLogs.unshift(logItem);
    if (apiLogs.length > 50) apiLogs.pop();

    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ apiLogs });
    }

    console.log('[STT&TTS API Log]', logItem.action, logItem.model, logItem.latencyMs + 'ms', logItem.statusCode, logItem.payloadInfo);
  }

  // -------------------------------------------------------------
  // FLOATING HUD ELEGANTE UNIFICADO PARA TODAS AS AÇÕES
  // -------------------------------------------------------------
  let hudRecordingTimer = null;
  let hudSeconds = 0;

  function ensureHudElement() {
    let hud = document.getElementById('vocallens-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'vocallens-hud';
      hud.className = 'vocallens-hud-box';
      document.body.appendChild(hud);
    }
    return hud;
  }

  function showHud(text, icon = '🔊', duration = 3500, type = 'info') {
    const hud = ensureHudElement();
    hud.setAttribute('data-type', type);
    hud.style.display = 'flex';
    hud.style.opacity = '1';

    hud.innerHTML = \`
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="vocallens-hud-icon">\${icon}</span>
        <span class="vocallens-hud-text">\${text}</span>
      </div>
    \`;

    if (hud._timer) clearTimeout(hud._timer);
    if (duration > 0) {
      hud._timer = setTimeout(() => hideHud(), duration);
    }
  }

  // Exibe HUD com Estágio Numerado e Rico para Qualquer Ação (TTS, STT, Vision)
  function showStageHud({ actionType, currentStage, totalStages, title, subtitle, details, icon, type = 'processing', duration = 0 }) {
    const hud = ensureHudElement();
    hud.setAttribute('data-type', type);
    hud.style.display = 'flex';
    hud.style.opacity = '1';

    const stageBadge = actionType + ' [' + currentStage + '/' + totalStages + ']';

    let iconHtml = '<span class="vocallens-hud-spinner"></span>';
    if (icon === 'pulse') {
      iconHtml = '<span class="vocallens-hud-dot-pulse"></span>';
    } else if (icon === 'check') {
      iconHtml = '<span class="vocallens-hud-check">✓</span>';
    } else if (icon) {
      iconHtml = '<span style="font-size:14px;">' + icon + '</span>';
    }

    hud.innerHTML = \`
      <div class="vocallens-hud-inner">
        <div class="vocallens-hud-header" style="justify-content: space-between;">
          <div style="display:flex; align-items:center; gap:6px;">
            \${iconHtml}
            <strong class="vocallens-hud-title">\${title}</strong>
          </div>
          <span class="vocallens-hud-stage-badge">\${stageBadge}</span>
        </div>
        \${subtitle ? \`<div class="vocallens-hud-sub">\${subtitle}</div>\` : ''}
        \${details ? \`<div class="vocallens-hud-details">\${details}</div>\` : ''}
      </div>
    \`;

    if (hud._timer) clearTimeout(hud._timer);
    if (duration > 0) {
      hud._timer = setTimeout(() => hideHud(), duration);
    }
  }

  function showRecordingHud(hasTargetField) {
    const hud = ensureHudElement();
    hud.setAttribute('data-type', 'recording');
    hud.style.display = 'flex';
    hud.style.opacity = '1';

    hudSeconds = 0;
    hud.innerHTML = \`
      <div class="vocallens-hud-inner">
        <div class="vocallens-hud-header">
          <span class="vocallens-hud-dot-pulse"></span>
          <strong class="vocallens-hud-title">Gravando Voz no Microfone...</strong>
          <span class="vocallens-hud-counter" id="vocallens-hud-sec">0s</span>
        </div>
        <div class="vocallens-hud-sub">
          \${hasTargetField ? '🎯 Alvo identificado no campo. Fale agora e pressione Pause ou Ctrl+Shift+Espaço ao terminar.' : '🎙️ Fale agora com clareza. Pressione Pause ou Ctrl+Shift+Espaço para finalizar.'}
        </div>
        <div class="vocallens-hud-stage-footer">
          <span>STT [1/4] • Captura de Áudio</span>
        </div>
      </div>
    \`;

    clearInterval(hudRecordingTimer);
    hudRecordingTimer = setInterval(() => {
      hudSeconds++;
      const el = document.getElementById('vocallens-hud-sec');
      if (el) el.innerText = \`\${hudSeconds}s\`;
    }, 1000);
  }

  function showSendingHud(actionName = 'STT', extraInfo = 'Enviando áudio comprimido para Gemini STT...') {
    clearInterval(hudRecordingTimer);
    showStageHud({
      actionType: actionName,
      currentStage: actionName === 'TTS' ? 1 : 2,
      totalStages: actionName === 'TTS' ? 3 : 4,
      title: 'Enviando Dados...',
      subtitle: extraInfo,
      details: 'Modelo: gemini-3.5-flash-lite (Google Generative AI)',
      type: 'sending'
    });
  }

  function showProcessingHud(actionName = 'STT', extraInfo = 'Transcrevendo fala e aplicando pontuação com IA...') {
    showStageHud({
      actionType: actionName,
      currentStage: actionName === 'TTS' ? 2 : 3,
      totalStages: actionName === 'TTS' ? 3 : 4,
      title: 'Processando com Gemini...',
      subtitle: extraInfo,
      details: 'Latência média: 250ms - 450ms',
      type: 'processing'
    });
  }

  // -------------------------------------------------------------
  // POP-UP HUD DE NARRAÇÃO COM CONTROLE DE VELOCIDADE INSTANTÂNEO
  // -------------------------------------------------------------
  function ensureNarrationHudElement() {
    let hud = document.getElementById('vocallens-narration-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'vocallens-narration-hud';
      hud.className = 'vocallens-narration-box';
      document.body.appendChild(hud);
    }
    return hud;
  }

  function showNarrationHud(text, source = 'selection') {
    const hud = ensureNarrationHudElement();
    const snippet = text.length > 85 ? text.substring(0, 82) + '...' : text;
    hud.style.display = 'block';
    hud.style.opacity = '1';

    const currentSpd = Number(settings.ttsSpeed || 1.0);
    const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5];

    const pillsHtml = speedOptions.map(sp => {
      const isActive = Math.abs(sp - currentSpd) < 0.05;
      return \`<button class="vocallens-sp-btn \${isActive ? 'active' : ''}" data-speed="\${sp}">\${sp}x</button>\`;
    }).join('');

    hud.innerHTML = \`
      <div class="vocallens-nhud-header">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="vocallens-nhud-pulse"></span>
          <strong class="vocallens-nhud-title">Narrando com Gemini (\${settings.ttsVoice || 'Kore'})</strong>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="vocallens-hud-stage-badge">TTS [3/3]</span>
          <button id="vocallens-nhud-close" class="vocallens-nhud-close-btn" title="Fechar">&times;</button>
        </div>
      </div>

      <div class="vocallens-nhud-snippet">"\${snippet}"</div>

      <div class="vocallens-nhud-controls">
        <button id="vocallens-nhud-playpause" class="vocallens-nhud-btn-action">⏸️ Pausar</button>
        <button id="vocallens-nhud-stop" class="vocallens-nhud-btn-stop">⏹️ Parar</button>
      </div>

      <div class="vocallens-nhud-sliders">
        <div class="vocallens-nhud-row">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>Velocidade de Fala:</span>
            <strong id="vocallens-speed-val" style="color:#38bdf8; font-family:monospace;">\${currentSpd}x</strong>
          </div>
          <div class="vocallens-speed-pills">
            \${pillsHtml}
          </div>
        </div>

        <div class="vocallens-nhud-row">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>Volume da Voz:</span>
            <strong id="vocallens-vol-val" style="color:#38bdf8; font-family:monospace;">\${Math.round((settings.ttsVolume ?? 1.0) * 100)}%</strong>
          </div>
          <input type="range" id="vocallens-vol-slider" min="0" max="1" step="0.05" value="\${settings.ttsVolume ?? 1.0}" class="vocallens-slider" />
        </div>
      </div>
    \`;

    // Eventos dos botões do HUD de Narração
    const closeBtn = document.getElementById('vocallens-nhud-close');
    if (closeBtn) closeBtn.onclick = () => hideNarrationHud();

    const stopBtn = document.getElementById('vocallens-nhud-stop');
    if (stopBtn) {
      stopBtn.onclick = () => {
        if (activeAudioPlayer) {
          activeAudioPlayer.pause();
          activeAudioPlayer = null;
        }
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        hideNarrationHud();
      };
    }

    const playPauseBtn = document.getElementById('vocallens-nhud-playpause');
    if (playPauseBtn) {
      playPauseBtn.onclick = () => {
        if (activeAudioPlayer) {
          if (activeAudioPlayer.paused) {
            activeAudioPlayer.play();
            playPauseBtn.innerHTML = '⏸️ Pausar';
          } else {
            activeAudioPlayer.pause();
            playPauseBtn.innerHTML = '▶️ Continuar';
          }
        } else if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
            playPauseBtn.innerHTML = '⏸️ Pausar';
          } else {
            window.speechSynthesis.pause();
            playPauseBtn.innerHTML = '▶️ Continuar';
          }
        }
      };
    }

    // CORREÇÃO CRÍTICA DE VELOCIDADE: Atualiza instantaneamente a instância ativa de áudio
    hud.querySelectorAll('.vocallens-sp-btn').forEach(btn => {
      btn.onclick = () => {
        const sp = parseFloat(btn.getAttribute('data-speed'));
        settings.ttsSpeed = sp;

        // Aplica imediatamente ao player ativo
        if (activeAudioPlayer) {
          activeAudioPlayer.playbackRate = sp;
          activeAudioPlayer.defaultPlaybackRate = sp;
        }

        // Salva nas configurações
        if (typeof chrome !== 'undefined' && chrome?.storage?.sync) {
          chrome.storage.sync.set({ ttsSpeed: sp });
        }

        // Atualiza visualmente
        hud.querySelectorAll('.vocallens-sp-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const valEl = document.getElementById('vocallens-speed-val');
        if (valEl) valEl.innerText = sp + 'x';

        console.log('[STT&TTS de Satiro] Velocidade de reprodução alterada para:', sp + 'x');
      };
    });

    // Slider de Volume
    const volSlider = document.getElementById('vocallens-vol-slider');
    if (volSlider) {
      volSlider.oninput = (e) => {
        const vol = parseFloat(e.target.value);
        settings.ttsVolume = vol;
        if (activeAudioPlayer) activeAudioPlayer.volume = vol;
        if (typeof chrome !== 'undefined' && chrome?.storage?.sync) {
          chrome.storage.sync.set({ ttsVolume: vol });
        }
        const valEl = document.getElementById('vocallens-vol-val');
        if (valEl) valEl.innerText = Math.round(vol * 100) + '%';
      };
    }
  }

  function hideNarrationHud() {
    const hud = document.getElementById('vocallens-narration-hud');
    if (hud) {
      hud.style.opacity = '0';
      setTimeout(() => { hud.style.display = 'none'; }, 250);
    }
  }

  function saveToHistory(text, target, imageBase64 = null) {
    const dateStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    sessionTranscriptions.unshift({
      id: 'tx-' + Date.now(),
      text: text,
      target: target,
      time: dateStr,
      image: imageBase64
    });
    if (sessionTranscriptions.length > 50) sessionTranscriptions.pop();
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ sessionTranscriptions });
    }
  }

  function showReadyToTypeHud(transcribedText, targetElement) {
    const hud = ensureHudElement();
    hud.setAttribute('data-type', 'ready');

    const targetName = targetElement ? (targetElement.id || targetElement.name || targetElement.tagName.toLowerCase()) : 'Campo Livre';
    saveToHistory(transcribedText, targetName);

    if (targetElement) {
      hud.innerHTML = \`
        <div class="vocallens-hud-inner">
          <div class="vocallens-hud-header" style="justify-content: space-between;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="vocallens-hud-check">✓</span>
              <strong class="vocallens-hud-title">Texto Inserido com Sucesso!</strong>
            </div>
            <span class="vocallens-hud-stage-badge">STT [4/4]</span>
          </div>
          <div class="vocallens-hud-preview">"\${transcribedText.length > 70 ? transcribedText.substring(0, 67) + '...' : transcribedText}"</div>
          <div class="vocallens-hud-sub">Inserido no elemento: <strong style="color:#6ee7b7;">\${targetName}</strong></div>
        </div>
      \`;
      setTimeout(() => hideHud(), 4000);
    } else {
      const snippet = transcribedText.length > 70 ? transcribedText.substring(0, 68) + '...' : transcribedText;
      hud.innerHTML = \`
        <div class="vocallens-hud-inner">
          <div class="vocallens-hud-header" style="justify-content: space-between;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="vocallens-hud-check">✓</span>
              <strong class="vocallens-hud-title">Transcrição Concluída</strong>
            </div>
            <button id="vocallens-copy-btn" class="vocallens-hud-btn-copy">Copiar Texto</button>
          </div>
          <div class="vocallens-hud-preview">"\${snippet}"</div>
          <div class="vocallens-hud-sub">Clique em qualquer campo para auto-digitar ou use o botão copiar.</div>
        </div>
      \`;

      const btn = document.getElementById('vocallens-copy-btn');
      if (btn) {
        btn.onclick = async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(transcribedText);
            btn.innerText = '✓ Copiado';
            setTimeout(() => { btn.innerText = 'Copiar Texto'; }, 2000);
          } catch (err) {
            navigator.clipboard.writeText(transcribedText);
          }
        };
      }

      // Permite colar no próximo campo clicado
      const onFieldClick = (e) => {
        if (isTextInputElement(e.target)) {
          insertTranscribedText(e.target, transcribedText);
          showHud('Texto inserido no campo clicado!', '✅', 2500, 'success');
          document.removeEventListener('click', onFieldClick, true);
        }
      };
      document.addEventListener('click', onFieldClick, true);
      setTimeout(() => {
        document.removeEventListener('click', onFieldClick, true);
      }, 12000);
    }
  }

  function hideHud() {
    clearInterval(hudRecordingTimer);
    const hud = document.getElementById('vocallens-hud');
    if (hud) {
      hud.style.opacity = '0';
      setTimeout(() => { hud.style.display = 'none'; }, 300);
    }
  }

  // Reprodução de áudio com garantia de velocidade no Chrome
  function playAudio(audioBase64, mimeType = 'audio/wav', originalText = '') {
    try {
      if (activeAudioPlayer) {
        activeAudioPlayer.pause();
        activeAudioPlayer = null;
      }
      const audioUrl = audioBase64.startsWith('data:') 
        ? audioBase64 
        : \`data:\${mimeType};base64,\${audioBase64}\`;
      
      const audio = new Audio(audioUrl);
      const targetSpeed = Number(settings.ttsSpeed || 1.0);
      const targetVolume = settings.ttsVolume !== undefined ? Number(settings.ttsVolume) : 1.0;

      audio.playbackRate = targetSpeed;
      audio.defaultPlaybackRate = targetSpeed;
      audio.volume = targetVolume;

      // Event listeners para impedir que o Chrome resete playbackRate ao iniciar reprodução
      audio.addEventListener('loadedmetadata', () => {
        audio.playbackRate = Number(settings.ttsSpeed || 1.0);
      });
      audio.addEventListener('play', () => {
        audio.playbackRate = Number(settings.ttsSpeed || 1.0);
      });
      audio.addEventListener('playing', () => {
        audio.playbackRate = Number(settings.ttsSpeed || 1.0);
      });
      audio.addEventListener('canplay', () => {
        audio.playbackRate = Number(settings.ttsSpeed || 1.0);
      });

      activeAudioPlayer = audio;
      audio.onended = () => {
        activeAudioPlayer = null;
        hideNarrationHud();
      };

      audio.play().catch(e => console.warn('[STT&TTS de Satiro] Falha na reprodução de áudio:', e));
      if (originalText) {
        showNarrationHud(originalText);
      }
    } catch (err) {
      console.error('[STT&TTS de Satiro] Erro ao instanciar áudio:', err);
    }
  }

  // -------------------------------------------------------------
  // MOTOR DE IA DIRETO & FALLBACK INTELIGENTE (SEM ERROS 403 / 404)
  // -------------------------------------------------------------
  function pcm16ToWavBlob(pcmBytes, sampleRate = 24000) {
    const dataLength = pcmBytes.length;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataLength, true);
    return new Blob([header, pcmBytes], { type: 'audio/wav' });
  }

  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  function speakFallbackNative(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-BR';
      if (settings.ttsSpeed) utter.rate = Number(settings.ttsSpeed);
      window.speechSynthesis.speak(utter);
      showNarrationHud(text, 'browser');
      return true;
    }
    return false;
  }

  function isQuotaOrNotFoundError(err) {
    if (!err) return false;
    const msg = String(err.message || err.error?.message || (typeof err === 'object' ? JSON.stringify(err) : err) || '').toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('404') ||
      msg.includes('503') ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted') ||
      msg.includes('exceeded your current quota') ||
      msg.includes('rate limit') ||
      msg.includes('unavailable') ||
      msg.includes('high demand') ||
      msg.includes('not_found') ||
      msg.includes('not found') ||
      msg.includes('não retornou fluxo') ||
      msg.includes('não gerou áudio') ||
      msg.includes('nenhum áudio gerado') ||
      msg.includes('não retornou áudio')
    );
  }

  const EXT_TTS_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-tts-preview'
  ];

  const EXT_STT_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  const EXT_VISION_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  async function executeDirectWithFallback(taskName, cascade, payloadInfo, action) {
    let lastErr = null;
    const modelList = cascade || EXT_TTS_CASCADE;
    const startTime = Date.now();

    for (let m = 0; m < modelList.length; m++) {
      const model = modelList[m];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const attemptStart = Date.now();
        try {
          const res = await action(model);
          const latency = Date.now() - attemptStart;
          
          // Registra Log de API bem sucedido
          logApiCall({
            action: taskName,
            model: model,
            latencyMs: latency,
            statusCode: 200,
            statusText: 'OK',
            success: true,
            payloadInfo: payloadInfo || (taskName + ' concluído com sucesso'),
            mode: 'direct'
          });

          return res;
        } catch (err) {
          lastErr = err;
          const latency = Date.now() - attemptStart;
          console.warn('[STT&TTS de Satiro ' + taskName + '] Tentativa ' + attempt + '/3 no modelo ' + model + ' falhou:', err);

          // Registra Log de API com erro da tentativa
          logApiCall({
            action: taskName,
            model: model,
            latencyMs: latency,
            statusCode: isQuotaOrNotFoundError(err) ? 429 : 500,
            statusText: 'Tentativa ' + attempt + ' falhou: ' + (err.message || 'Erro'),
            success: false,
            payloadInfo: payloadInfo,
            errorMessage: err.message || String(err),
            mode: 'direct'
          });

          if (isQuotaOrNotFoundError(err)) {
            console.warn('[STT&TTS de Satiro ' + taskName + '] Cota excedida ou modelo ' + model + ' indisponível. Alternando para o próximo modelo...');
            break;
          }

          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 350));
          } else {
            break;
          }
        }
      }
      console.warn('[STT&TTS de Satiro ' + taskName + '] Tentativas concluídas no modelo ' + model + '. Alternando para o próximo modelo de fallback.');
    }

    console.error('[STT&TTS de Satiro ' + taskName + '] Falha em todos os modelos de fallback.');
    let msg = lastErr?.message || 'Erro desconhecido';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      msg = 'Cota do plano gratuito do Gemini excedida (429). Por favor aguarde alguns segundos ou adicione sua própria chave Gemini.';
    }
    throw new Error('Falha após retries na cadeia de fallback (' + modelList.join(' -> ') + '): ' + msg);
  }

  async function directGeminiTTS(text, voiceOverride = null, instOverride = null) {
    if (!settings.apiKey) throw new Error('Sem chave de API configurada');

    let baseVoiceName = voiceOverride || settings.ttsVoice || 'Kore';
    let voiceInstruction = instOverride || '';

    // Resolução se for voz customizada
    const customVoices = settings.customVoices || [];
    const customMatch = customVoices.find(cv => cv.id === baseVoiceName || cv.name === baseVoiceName);
    if (customMatch) {
      baseVoiceName = customMatch.baseVoice || 'Kore';
      if (customMatch.instruction) {
        voiceInstruction = customMatch.instruction;
      }
    }

    let fullInstruction = settings.narratorInstruction || 'Narre com dicção clara e entonação natural em português:';
    if (voiceInstruction) {
      fullInstruction = '[Instrução da Voz: ' + voiceInstruction + ']\\n' + fullInstruction;
    }
    const prompt = fullInstruction + '\\n' + text;
    const payloadInfo = 'Texto: ' + text.length + ' chars | Voz: ' + baseVoiceName;

    // Cascade de síntese neural TTS
    return await executeDirectWithFallback('TTS', EXT_TTS_CASCADE, payloadInfo, async (modelName) => {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + encodeURIComponent(settings.apiKey);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: baseVoiceName } }
            }
          }
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || ('HTTP ' + res.status));
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!raw) throw new Error('O modelo ' + modelName + ' não retornou áudio');
      const bin = atob(raw);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const wavBlob = pcm16ToWavBlob(bytes, 24000);
      return await blobToBase64(wavBlob);
    });
  }

  async function directGeminiSTT(audioBase64, mimeType) {
    if (!settings.apiKey) throw new Error('Sem chave de API configurada');
    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const cleanMime = (mimeType || 'audio/webm').split(';')[0];
    const prompt = settings.transcriberInstruction || 'Transcreva com fidelidade absoluta o áudio recebido. Retorne apenas o texto transcrito, sem introduções ou aspas.';
    const payloadInfo = 'Áudio base64 (' + Math.round(cleanBase64.length / 1024) + ' KB, ' + cleanMime + ')';

    // Cascade de transcrição de áudio STT
    return await executeDirectWithFallback('STT', EXT_STT_CASCADE, payloadInfo, async (modelName) => {
      const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${modelName}:generateContent?key=\${encodeURIComponent(settings.apiKey)}\`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: cleanMime, data: cleanBase64 } },
              { text: prompt }
            ]
          }]
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || ('HTTP ' + res.status));
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error('O modelo ' + modelName + ' retornou transcrição vazia');
      return text;
    });
  }

  async function directGeminiVision(imageBase64) {
    if (!settings.apiKey) throw new Error('Sem chave de API configurada');
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const prompt = settings.visionInstruction || 'Analise detalhadamente a imagem capturada da tela com o Google Lens e descreva os textos e elementos visuais com clareza em português.';
    const payloadInfo = 'Imagem PNG recortada (' + Math.round(cleanBase64.length / 1024) + ' KB)';

    // Cascade de análise visual OCR/Vision
    return await executeDirectWithFallback('Vision', EXT_VISION_CASCADE, payloadInfo, async (modelName) => {
      const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${modelName}:generateContent?key=\${encodeURIComponent(settings.apiKey)}\`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
              { text: prompt }
            ]
          }]
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || ('HTTP ' + res.status));
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error('O modelo ' + modelName + ' não gerou interpretação visual');
      return text;
    });
  }

  // -------------------------------------------------------------
  // REQUISITO 1: NARRAÇÃO DE TEXTO SELECIONADO COM ESTÁGIOS E HUD
  // -------------------------------------------------------------
  async function narrateSelection(selectedText) {
    if (!selectedText || !selectedText.trim()) {
      showHud('Selecione um texto na página antes de iniciar a narração.', '⚠️', 3000, 'warning');
      return;
    }

    const textToNarrate = selectedText.trim();
    
    // Estágio 1/3: Enviando
    showSendingHud('TTS', 'Enviando texto (' + textToNarrate.length + ' caracteres) para Gemini TTS...');

    let narrated = false;

    // 1. PRIORIDADE MÁXIMA: Conexão Direta com API Gemini (Sem Servidor)
    if (settings.apiKey && settings.apiKey.trim()) {
      try {
        // Estágio 2/3: Processando
        showProcessingHud('TTS', 'Sintetizando áudio neural com a voz ' + (settings.ttsVoice || 'Kore') + '...');
        const wavBase64 = await directGeminiTTS(textToNarrate);

        // Estágio 3/3: Narrando
        showStageHud({
          actionType: 'TTS',
          currentStage: 3,
          totalStages: 3,
          title: 'Narrando com Gemini',
          subtitle: 'Voz Neural: ' + (settings.ttsVoice || 'Kore') + ' (24kHz PCM)',
          icon: 'pulse',
          type: 'ready',
          duration: 3000
        });

        playAudio(wavBase64, 'audio/wav', textToNarrate);
        narrated = true;
      } catch (apiErr) {
        console.warn('[STT&TTS de Satiro] Falha na API direta do Gemini TTS:', apiErr);
      }
    }

    // 2. Servidor Backend Opcional (apenas se configurado)
    if (!narrated && settings.serverUrl && settings.serverUrl.trim() && !settings.serverUrl.includes('localhost:3000')) {
      try {
        showProcessingHud('TTS', 'Sintetizando via backend local...');
        const res = await fetch(\`\${settings.serverUrl}/api/tts\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: textToNarrate,
            instruction: settings.narratorInstruction,
            voice: settings.ttsVoice,
            apiKey: settings.apiKey
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.audioBase64) {
            playAudio(data.audioBase64, data.mimeType || 'audio/wav', textToNarrate);
            narrated = true;
          }
        }
      } catch (err) {
        // Servidor indisponível
      }
    }

    // 3. Fallback Instantâneo: Voz Nativa do Navegador
    if (!narrated) {
      const spoken = speakFallbackNative(textToNarrate);
      if (spoken) {
        if (!settings.apiKey) {
          showHud('Narrando com voz local do navegador. Adicione sua Chave Gemini para vozes neurais!', '🔊', 5000, 'info');
        } else {
          showHud('Narrando com voz alternativa...', '🔊', 3000, 'info');
        }
      } else {
        showHud('Insira sua Chave Gemini no ícone da extensão para narrar!', '🔑', 5000, 'warning');
      }
    }
  }

  // Listener de mensagens do Service Worker
  if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'narrate_selected_text') {
        const sel = request.text || window.getSelection()?.toString().trim();
        narrateSelection(sel);
        sendResponse({ success: true });
      }
    });
  }

  // Pop-up flutuante de apoio ao clicar com o botão direito na seleção de texto
  let floatingMenuEl = null;

  function hideFloatingMenu() {
    if (floatingMenuEl) {
      floatingMenuEl.style.display = 'none';
    }
  }

  document.addEventListener('contextmenu', (e) => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length > 0) {
      if (!floatingMenuEl) {
        floatingMenuEl = document.createElement('div');
        floatingMenuEl.id = 'vocallens-quick-narrate-btn';
        floatingMenuEl.style.cssText = 'position: fixed; z-index: 2147483647; background: #0f172a; border: 1px solid #38bdf8; border-radius: 8px; padding: 6px 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.8), 0 0 15px rgba(56,189,248,0.3); color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none; transition: transform 0.1s ease, background 0.15s ease;';
        floatingMenuEl.innerHTML = '<span style="font-size:14px;">🎙️</span><span>Iniciar Narração</span><span style="background:#0284c7; color:#fff; font-size:9px; padding:1px 5px; border-radius:4px; margin-left:2px; font-weight:700;">Gemini</span>';
        document.body.appendChild(floatingMenuEl);

        floatingMenuEl.addEventListener('mouseenter', () => {
          floatingMenuEl.style.background = '#1e293b';
          floatingMenuEl.style.borderColor = '#0284c7';
        });
        floatingMenuEl.addEventListener('mouseleave', () => {
          floatingMenuEl.style.background = '#0f172a';
          floatingMenuEl.style.borderColor = '#38bdf8';
        });

        floatingMenuEl.addEventListener('click', (evt) => {
          evt.stopPropagation();
          evt.preventDefault();
          hideFloatingMenu();
          const currentText = window.getSelection()?.toString().trim();
          narrateSelection(currentText);
        });
      }

      const posX = Math.min(e.clientX + 10, window.innerWidth - 180);
      const posY = Math.min(e.clientY + 10, window.innerHeight - 50);
      floatingMenuEl.style.left = posX + 'px';
      floatingMenuEl.style.top = posY + 'px';
      floatingMenuEl.style.display = 'flex';
    } else {
      hideFloatingMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (floatingMenuEl && !floatingMenuEl.contains(e.target)) {
      hideFloatingMenu();
    }
  });

  document.addEventListener('scroll', hideFloatingMenu, true);

  // Atalho Configurável (Ctrl + B)
  document.addEventListener('keydown', async (e) => {
    if (!settings.enableCtrlB) return;
    
    const sc = settings.shortcutNarrateConfig;
    const match = sc && 
      (Boolean(e.ctrlKey) === Boolean(sc.ctrl)) &&
      (Boolean(e.shiftKey) === Boolean(sc.shift)) &&
      (Boolean(e.altKey) === Boolean(sc.alt)) &&
      (e.code === sc.code || e.key.toLowerCase() === sc.key.toLowerCase());

    if (match || ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B') && !sc)) {
      const selectedText = window.getSelection()?.toString().trim();
      e.preventDefault();
      narrateSelection(selectedText);
    }
  });

  // -------------------------------------------------------------
  // REQUISITO 2: GOOGLE LENS VISION COM ESTÁGIOS [1/4] A [4/4]
  // -------------------------------------------------------------
  function createSelectionOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'vocallens-selection-overlay';

    selectionBoxEl = document.createElement('div');
    selectionBoxEl.id = 'vocallens-selection-box';
    selectionBoxEl.className = 'vocallens-lens-box';

    selectionBoxEl.innerHTML = \`
      <div class="vocallens-lens-corner top-left"></div>
      <div class="vocallens-lens-corner top-right"></div>
      <div class="vocallens-lens-corner bottom-left"></div>
      <div class="vocallens-lens-corner bottom-right"></div>
      <div class="vocallens-lens-laser"></div>
      <div class="vocallens-lens-badge">
        <span class="vocallens-lens-dot"></span>
        <span>Google Lens • Solte para Fotografar e Analisar</span>
      </div>
    \`;

    overlayEl.appendChild(selectionBoxEl);
    document.body.appendChild(overlayEl);
  }

  document.addEventListener('mousedown', (e) => {
    if (!settings.enableCtrlDrag) return;
    if ((e.ctrlKey && e.shiftKey) && e.button === 0) {
      isSelectingArea = true;
      startX = e.clientX;
      startY = e.clientY;

      createSelectionOverlay();
      overlayEl.style.display = 'block';
      selectionBoxEl.style.left = startX + 'px';
      selectionBoxEl.style.top = startY + 'px';
      selectionBoxEl.style.width = '0px';
      selectionBoxEl.style.height = '0px';
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (!isSelectingArea || !selectionBoxEl) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBoxEl.style.left = left + 'px';
    selectionBoxEl.style.top = top + 'px';
    selectionBoxEl.style.width = width + 'px';
    selectionBoxEl.style.height = height + 'px';
  });

  async function finishAreaSelection(e) {
    if (!isSelectingArea) return;
    isSelectingArea = false;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const rect = {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
      devicePixelRatio: window.devicePixelRatio || 1
    };

    if (overlayEl) overlayEl.style.display = 'none';
    if (rect.width < 15 || rect.height < 15) return;

    // Estágio 1/4: Capturando
    showStageHud({
      actionType: 'Lens',
      currentStage: 1,
      totalStages: 4,
      title: 'Capturando Área da Tela...',
      subtitle: 'Dimensões: ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px',
      icon: '📸',
      type: 'sending'
    });

    chrome.runtime.sendMessage({ action: 'capture_visible_tab' }, async (response) => {
      if (!response || !response.success || !response.dataUrl) {
        showHud('Não foi possível capturar a tela', '❌', 3000, 'error');
        return;
      }

      // Estágio 2/4: Enviando
      showStageHud({
        actionType: 'Lens',
        currentStage: 2,
        totalStages: 4,
        title: 'Enviando Recorte Visual...',
        subtitle: 'Enviando imagem para Gemini Vision (gemini-3.5-flash-lite)...',
        icon: '🚀',
        type: 'sending'
      });

      const croppedBase64 = await cropImage(response.dataUrl, rect);

      let processed = false;

      // 1. PRIORIDADE: Conexão Direta à API Gemini
      if (settings.apiKey && settings.apiKey.trim()) {
        try {
          // Estágio 3/4: Processando Análise Visual
          showStageHud({
            actionType: 'Lens',
            currentStage: 3,
            totalStages: 4,
            title: 'Interpretando Imagem com IA...',
            subtitle: 'Extraindo textos, contexto e elementos visuais...',
            icon: '🧠',
            type: 'processing'
          });

          const description = await directGeminiVision(croppedBase64);
          if (description) {
            // Estágio 4/4: Sintetizando e Narrando
            showStageHud({
              actionType: 'Lens',
              currentStage: 4,
              totalStages: 4,
              title: 'Narrando Leitura do Google Lens...',
              subtitle: 'Sintetizando voz neural do resultado visual...',
              icon: '🔊',
              type: 'ready',
              duration: 3500
            });

            try {
              const wavBase64 = await directGeminiTTS(description);
              playAudio(wavBase64, 'audio/wav', description);
            } catch {
              speakFallbackNative(description);
            }
            saveToHistory(description, 'Google Lens', croppedBase64);
            processed = true;
          }
        } catch (apiErr) {
          console.warn('[STT&TTS de Satiro] Falha na API direta do Google Lens:', apiErr);
        }
      }

      // 2. Servidor Backend Opcional
      if (!processed && settings.serverUrl && settings.serverUrl.trim() && !settings.serverUrl.includes('localhost:3000')) {
        try {
          const res = await fetch(\`\${settings.serverUrl}/api/vision-tts\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: croppedBase64,
              instruction: settings.visionInstruction,
              narratorInstruction: settings.narratorInstruction,
              voice: settings.ttsVoice,
              apiKey: settings.apiKey
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              if (data.audioBase64) {
                playAudio(data.audioBase64, data.mimeType || 'audio/wav', data.text);
              }
              saveToHistory(data.text || 'Análise visual narrada via servidor', 'Google Lens', croppedBase64);
              processed = true;
            }
          }
        } catch (err) {
          // Servidor indisponível
        }
      }

      if (!processed) {
        showHud('Insira sua Chave Gemini no ícone da extensão para ativar o Google Lens!', '🔑', 5000, 'warning');
      }
    });
  }

  document.addEventListener('mouseup', finishAreaSelection);

  function cropImage(dataUrl, rect) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const dpr = rect.devicePixelRatio;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
          img,
          rect.x * dpr,
          rect.y * dpr,
          rect.width * dpr,
          rect.height * dpr,
          0,
          0,
          canvas.width,
          canvas.height
        );
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  // -------------------------------------------------------------
  // REQUISITO 3: PAUSE / BREAK OU CTRL + SHIFT + ESPAÇO -> STT COM ESTÁGIOS
  // -------------------------------------------------------------
  function isRecordingToggleKey(e) {
    const sc = settings.shortcutRecordConfig;
    if (sc) {
      const match = (Boolean(e.ctrlKey) === Boolean(sc.ctrl)) &&
                    (Boolean(e.shiftKey) === Boolean(sc.shift)) &&
                    (Boolean(e.altKey) === Boolean(sc.alt)) &&
                    (e.code === sc.code || e.key.toLowerCase() === sc.key.toLowerCase());
      if (match) return true;
    }

    const isPause = (
      e.key === 'Pause' ||
      e.code === 'Pause' ||
      e.key === 'Break' ||
      e.code === 'Break' ||
      e.keyCode === 19 ||
      e.which === 19 ||
      e.key === 'MediaPlayPause'
    );
    if (isPause) return true;

    if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ' || e.keyCode === 32)) {
      return true;
    }

    return false;
  }

  let lastToggleTimestamp = 0;

  async function handleRecordingToggle(e) {
    if (!settings.enablePauseBreak) return;
    if (!isRecordingToggleKey(e)) return;

    const now = Date.now();
    if (now - lastToggleTimestamp < 350) return;
    lastToggleTimestamp = now;

    e.preventDefault();
    e.stopPropagation();

    if (!isRecordingAudio) {
      // INICIAR GRAVAÇÃO
      const active = document.activeElement;
      targetInputElement = isTextInputElement(active) ? active : null;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          
          // Estágio 2/4: Enviando
          showSendingHud('STT', 'Enviando áudio gravado (' + hudSeconds + 's) para Gemini STT...');

          const reader = new FileReader();
          reader.onloadend = async () => {
            // Estágio 3/4: Processando
            showProcessingHud('STT', 'Transcrevendo fala e aplicando pontuação com Gemini...');
            const base64Audio = reader.result;

            let transcribedText = null;

            // 1. PRIORIDADE: Conexão Direta com API Gemini
            if (settings.apiKey && settings.apiKey.trim()) {
              try {
                transcribedText = await directGeminiSTT(base64Audio, 'audio/webm');
              } catch (apiErr) {
                console.warn('[STT&TTS de Satiro] Falha na transcrição direta:', apiErr);
              }
            }

            // 2. Servidor Backend Opcional
            if (!transcribedText && settings.serverUrl && settings.serverUrl.trim() && !settings.serverUrl.includes('localhost:3000')) {
              try {
                const res = await fetch(\`\${settings.serverUrl}/api/stt\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    audioBase64: base64Audio,
                    mimeType: 'audio/webm',
                    instruction: settings.transcriberInstruction,
                    apiKey: settings.apiKey
                  })
                });

                if (res.ok) {
                  const data = await res.json();
                  if (data.success && data.text) {
                    transcribedText = data.text;
                  }
                }
              } catch (err) {
                // Servidor indisponível
              }
            }

            // Estágio 4/4: Concluído
            if (transcribedText) {
              if (targetInputElement) {
                insertTranscribedText(targetInputElement, transcribedText);
                showReadyToTypeHud(transcribedText, targetInputElement);
              } else {
                showReadyToTypeHud(transcribedText, null);
              }
            } else {
              showHud('Insira sua Chave Gemini no ícone da extensão para transcrever!', '🔑', 5000, 'warning');
            }
          };
          reader.readAsDataURL(audioBlob);
        };

        mediaRecorder.start();
        isRecordingAudio = true;
        if (targetInputElement) highlightTargetElement(targetInputElement, true);
        showRecordingHud(Boolean(targetInputElement));

      } catch (err) {
        console.warn('[STT&TTS de Satiro] Permissão de microfone negada ou erro:', err);
        showHud('Microfone bloqueado! Clique no ícone da extensão para permitir.', '🎙️❌', 5500, 'warning');
      }

    } else {
      // PARAR GRAVAÇÃO
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      isRecordingAudio = false;
      if (targetInputElement) highlightTargetElement(targetInputElement, false);
    }
  }

  document.addEventListener('keydown', handleRecordingToggle, true);
  document.addEventListener('keyup', handleRecordingToggle, true);

  function isTextInputElement(el) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email', 'tel', 'password', ''].includes(type);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function highlightTargetElement(el, enable) {
    if (!el) return;
    if (enable) {
      el.dataset.vocallensOldOutline = el.style.outline;
      el.style.outline = '3px solid #0284c7';
      el.style.outlineOffset = '2px';
    } else {
      el.style.outline = el.dataset.vocallensOldOutline || '';
    }
  }

  function insertTranscribedText(el, text) {
    if (!el) return;
    try {
      el.focus();
      if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
        const start = el.selectionStart || el.value.length;
        const end = el.selectionEnd || el.value.length;
        const currentVal = el.value || '';
        const needsSpace = start > 0 && !currentVal.slice(start - 1, start).match(/\\s/);
        const textToInsert = (needsSpace ? ' ' : '') + text;

        el.value = currentVal.substring(0, start) + textToInsert + currentVal.substring(end);
        el.selectionStart = el.selectionEnd = start + textToInsert.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        document.execCommand('insertText', false, ' ' + text);
      }
    } catch (err) {
      console.error('[STT&TTS de Satiro] Falha na injeção de texto:', err);
    }
  }
})();
`
  },
  {
    filename: 'content.css',
    path: 'content.css',
    description: 'Estilos do Google Lens e do Toast HUD flutuante da extensão',
    language: 'css',
    content: `/* Overlay e Viewfinder Google Lens */
#vocallens-selection-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2147483640;
  cursor: crosshair;
  display: none;
  pointer-events: none;
}

.vocallens-lens-box {
  position: absolute;
  box-shadow: 0 0 0 9999px rgba(3, 7, 18, 0.65);
  pointer-events: none;
  border-radius: 12px;
  background: rgba(6, 182, 212, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.35);
  transition: box-shadow 0.1s ease;
}

.vocallens-lens-corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border-color: #ffffff;
  border-style: solid;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.9));
}
.vocallens-lens-corner.top-left {
  top: -2px; left: -2px;
  border-width: 3px 0 0 3px;
  border-top-left-radius: 6px;
}
.vocallens-lens-corner.top-right {
  top: -2px; right: -2px;
  border-width: 3px 3px 0 0;
  border-top-right-radius: 6px;
}
.vocallens-lens-corner.bottom-left {
  bottom: -2px; left: -2px;
  border-width: 0 0 3px 3px;
  border-bottom-left-radius: 6px;
}
.vocallens-lens-corner.bottom-right {
  bottom: -2px; right: -2px;
  border-width: 0 3px 3px 0;
  border-bottom-right-radius: 6px;
}

.vocallens-lens-laser {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #22d3ee, #38bdf8, #818cf8, transparent);
  box-shadow: 0 0 10px #38bdf8, 0 0 20px #818cf8;
  animation: lens-laser-scan 1.6s ease-in-out infinite alternate;
}

@keyframes lens-laser-scan {
  0% { top: 15%; opacity: 0.6; }
  50% { opacity: 1; }
  100% { top: 85%; opacity: 0.6; }
}

.vocallens-lens-badge {
  position: absolute;
  bottom: -36px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.94);
  color: #22d3ee;
  border: 1px solid rgba(34, 211, 238, 0.45);
  font-family: system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 9999px;
  white-space: nowrap;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  gap: 6px;
}

.vocallens-lens-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22d3ee;
  box-shadow: 0 0 8px #22d3ee;
  animation: vocallens-pulse 1s infinite;
}

/* Toast HUD Flutuante */
.vocallens-hud-box {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2147483647;
  background: rgba(15, 23, 42, 0.96);
  color: #f8fafc;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 12px;
  border-radius: 14px;
  border: 1px solid #334155;
  box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.6);
  display: flex;
  padding: 10px 14px;
  transition: opacity 0.25s ease;
  pointer-events: auto;
  max-width: 360px;
  min-width: 280px;
  backdrop-filter: blur(12px);
}

.vocallens-hud-inner {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
}

.vocallens-hud-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vocallens-hud-title {
  font-size: 12px;
  font-weight: 600;
  color: #f8fafc;
}

.vocallens-hud-sub {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.35;
}

.vocallens-hud-preview {
  font-size: 11px;
  color: #e2e8f0;
  background: #1e293b;
  border-radius: 6px;
  padding: 6px 8px;
  font-style: italic;
  max-height: 55px;
  overflow: hidden;
  text-overflow: ellipsis;
  border-left: 2px solid #10b981;
}

.vocallens-hud-counter {
  margin-left: auto;
  font-family: monospace;
  font-size: 11px;
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.vocallens-hud-badge-ready {
  font-size: 10px;
  font-weight: 700;
  color: #6ee7b7;
  background: rgba(16, 185, 129, 0.2);
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid rgba(16, 185, 129, 0.4);
  text-transform: uppercase;
}

.vocallens-hud-btn-copy {
  background: #2563eb;
  color: white;
  border: none;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 5px;
  cursor: pointer;
}

.vocallens-hud-dot-pulse {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  animation: vocallens-pulse 1.4s infinite;
  display: inline-block;
  flex-shrink: 0;
}

.vocallens-hud-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: vocallens-spin 0.8s linear infinite;
  display: inline-block;
  flex-shrink: 0;
}

.vocallens-hud-check {
  color: #10b981;
  font-weight: bold;
  font-size: 13px;
}

@keyframes vocallens-pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

@keyframes vocallens-spin {
  to { transform: rotate(360deg); }
}

.vocallens-hud-box[data-type="recording"] {
  border-color: #ef4444;
  background: #180909;
}
.vocallens-hud-box[data-type="sending"] {
  border-color: #38bdf8;
  background: #081a2e;
}
.vocallens-hud-box[data-type="processing"] {
  border-color: #a855f7;
  background: #180b2a;
}
.vocallens-hud-box[data-type="ready"] {
  border-color: #10b981;
  background: #062016;
}

/* Pop-up HUD de Narração Superior Direito */
.vocallens-narration-box {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2147483647;
  background: rgba(15, 23, 42, 0.98);
  color: #f8fafc;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  border-radius: 14px;
  border: 1px solid #38bdf8;
  box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.7);
  padding: 12px 14px;
  width: 320px;
  max-width: 90vw;
  backdrop-filter: blur(16px);
  display: none;
  transition: opacity 0.25s ease;
}

.vocallens-nhud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.vocallens-nhud-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  animation: vocallens-pulse 1.2s infinite;
}

.vocallens-nhud-title {
  font-size: 12px;
  font-weight: 700;
  color: #38bdf8;
}

.vocallens-nhud-close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.vocallens-nhud-close-btn:hover {
  color: #fff;
}

.vocallens-nhud-snippet {
  font-size: 11px;
  color: #cbd5e1;
  background: #1e293b;
  border-radius: 6px;
  padding: 6px 8px;
  font-style: italic;
  margin-bottom: 10px;
  max-height: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
  border-left: 2px solid #38bdf8;
}

.vocallens-nhud-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.vocallens-nhud-btn-action {
  flex: 1;
  background: #0284c7;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.vocallens-nhud-btn-action:hover {
  background: #0369a1;
}

.vocallens-nhud-btn-stop {
  background: #dc2626;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.vocallens-nhud-btn-stop:hover {
  background: #b91c1c;
}

.vocallens-nhud-sliders {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #0f172a;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #1e293b;
}

.vocallens-nhud-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.vocallens-speed-pills {
  display: flex;
  gap: 4px;
}

.vocallens-sp-btn {
  flex: 1;
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  font-size: 10px;
  padding: 3px 0;
  border-radius: 4px;
  cursor: pointer;
}
.vocallens-sp-btn:hover {
  background: #38bdf8;
  color: #0f172a;
  font-weight: 700;
}

.vocallens-slider {
  width: 100%;
  accent-color: #38bdf8;
  cursor: pointer;
}
`
  },
  {
    filename: 'popup.html',
    path: 'popup.html',
    description: 'Popup moderno com Console TTS, Histórico, Telemetria de API, Gravação Direta e Links Funcionais',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>STT&TTS de Satiro</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 360px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      padding: 14px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 10px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 15px;
      color: #38bdf8;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: #34d399;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 2px 7px;
      border-radius: 9999px;
    }
    .status-badge.warning {
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.12);
      border-color: rgba(245, 158, 11, 0.3);
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }
    .status-badge.warning .status-dot {
      background: #f59e0b;
    }

    /* Abas do Popup */
    .popup-tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .popup-tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .popup-tab-btn:hover { color: #fff; background: #1e293b; }
    .popup-tab-btn.active {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border-color: rgba(56, 189, 248, 0.3);
    }

    .tab-pane { display: none; }
    .tab-pane.active { display: block; }

    /* Card de Chave Rápida no Topo */
    .api-key-banner {
      background: #111e38;
      border: 1px solid #1e3a8a;
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .api-key-banner.saved {
      background: #064e3b;
      border-color: #059669;
    }
    .api-banner-title {
      font-size: 11px;
      font-weight: 700;
      color: #93c5fd;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .api-key-banner.saved .api-banner-title {
      color: #6ee7b7;
    }

    /* Botão Central de Gravação de Voz */
    .mic-hero-btn {
      width: 100%;
      background: linear-gradient(135deg, #0284c7, #2563eb);
      border: 1px solid #38bdf8;
      color: white;
      padding: 12px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
      transition: all 0.15s;
    }
    .mic-hero-btn:hover { background: linear-gradient(135deg, #0369a1, #1d4ed8); }
    .mic-hero-btn.recording {
      background: linear-gradient(135deg, #dc2626, #991b1b);
      border-color: #ef4444;
      animation: pulse-red 1.2s infinite;
    }
    @keyframes pulse-red {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
      70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    /* Lista de Atalhos */
    .shortcut-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .shortcut-card {
      background: #0f172a;
      border: 1px solid #1e293b;
      padding: 6px 10px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
    }
    .badge {
      background: #1e293b;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 10px;
      color: #93c5fd;
      border: 1px solid #334155;
    }

    /* Console TTS */
    .tts-box {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .form-group {
      margin-bottom: 8px;
    }
    label {
      display: block;
      font-size: 10px;
      color: #94a3b8;
      margin-bottom: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }
    select, input[type="text"], input[type="password"] {
      width: 100%;
      padding: 6px 8px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #fff;
      font-size: 12px;
      outline: none;
    }
    select:focus, input:focus {
      border-color: #38bdf8;
    }
    .speed-pills {
      display: flex;
      gap: 3px;
      flex-wrap: wrap;
    }
    .speed-pill {
      flex: 1;
      min-width: 34px;
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      font-size: 10px;
      font-family: monospace;
      padding: 4px 0;
      text-align: center;
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s;
    }
    .speed-pill:hover {
      background: #334155;
      color: #fff;
    }
    .speed-pill.active {
      background: #0284c7;
      color: white;
      border-color: #38bdf8;
      font-weight: bold;
    }

    .tts-actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .btn-action {
      flex: 1;
      padding: 7px;
      border-radius: 6px;
      border: none;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .btn-test { background: #0284c7; color: white; }
    .btn-test:hover { background: #0369a1; }
    .btn-stop { background: #dc2626; color: white; display: none; }
    .btn-stop:hover { background: #b91c1c; }

    /* Sub-abas de Histórico e Logs */
    .sub-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
      background: #0f172a;
      padding: 3px;
      border-radius: 6px;
      border: 1px solid #1e293b;
    }
    .sub-tab-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 600;
      padding: 4px;
      border-radius: 4px;
      cursor: pointer;
    }
    .sub-tab-btn.active {
      background: #1e293b;
      color: #38bdf8;
    }

    /* Histórico */
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 220px;
      overflow-y: auto;
    }
    .history-item {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 8px;
      font-size: 11px;
    }
    .history-top {
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 10px;
      margin-bottom: 4px;
    }
    .history-text {
      color: #e2e8f0;
      line-height: 1.3;
      margin-bottom: 6px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .history-btns {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
    }
    .history-btns button {
      background: #1e293b;
      border: 1px solid #334155;
      color: #93c5fd;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
    }

    /* Log de API */
    .api-log-item {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 10px;
      font-family: monospace;
      margin-bottom: 4px;
    }
    .api-log-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .api-log-badge {
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: 700;
      font-size: 9px;
    }
    .api-log-badge.success { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .api-log-badge.error { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .api-log-sub {
      color: #94a3b8;
      font-size: 9px;
      display: flex;
      justify-content: space-between;
    }

    /* Botões Principais */
    .btn-full {
      width: 100%;
      padding: 8px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-decoration: none;
      border: none;
      margin-bottom: 6px;
    }
    .btn-web {
      background: #2563eb;
      color: white;
    }
    .btn-web:hover { background: #1d4ed8; }
    .btn-opt {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
    }
    .btn-opt:hover { background: #334155; color: white; }
    .btn-mic-perm {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6ee7b7;
    }
    .btn-mic-perm:hover { background: rgba(16, 185, 129, 0.25); }

    .toast-msg {
      font-size: 11px;
      text-align: center;
      color: #34d399;
      margin-top: 6px;
      display: none;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <span>🎙️</span>
      <span>STT&TTS de Satiro</span>
    </div>
    <div id="headerStatusBadge" class="status-badge">
      <span class="status-dot"></span>
      <span id="headerStatus">Modo Direto</span>
    </div>
  </div>

  <div class="popup-tabs">
    <button class="popup-tab-btn active" data-tab="tab-control">🎛️ Voz &amp; Ações</button>
    <button class="popup-tab-btn" data-tab="tab-history">📜 Logs &amp; API (<span id="histCount">0</span>)</button>
    <button class="popup-tab-btn" data-tab="tab-config">⚙️ Chave</button>
    <button class="popup-tab-btn" data-tab="tab-update">🔄 GitHub</button>
  </div>

  <!-- ABA 1: CONTROLE & VOZ -->
  <div id="tab-control" class="tab-pane active">
    <!-- Banner de Status da Chave Gemini -->
    <div id="apiKeyBanner" class="api-key-banner saved">
      <div class="api-banner-title">
        <span id="apiKeyBannerTitle">⚡ Chave Gemini Ativa (.env)</span>
        <span id="apiKeyBannerState" style="font-size:10px; opacity:0.8;">Modo Direto</span>
      </div>
      <div id="apiKeyBannerBody">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:4px; font-family:monospace; font-size:11px; color:#34d399; background:#020617; padding:5px 8px; border-radius:6px; border:1px solid #1e293b;" id="maskedKeyDisplay">
          <span>AIzaSy... (.env)</span>
          <span style="font-size:9px; background:#065f46; color:#a7f3d0; padding:1px 5px; border-radius:4px; font-family:sans-serif;">RAIZ</span>
        </div>
      </div>
    </div>

    <!-- Botão de Gravação Imediata com Microfone -->
    <button id="directRecordBtn" class="mic-hero-btn">
      <span id="micIcon">🎙️</span>
      <span id="micLabel">Gravar Fala no Microfone</span>
      <span id="micTimer" style="display:none; font-family:monospace; margin-left:auto;">0s</span>
    </button>
    <div id="micStatusSub" style="font-size:10px; color:#94a3b8; text-align:center; margin-top:-8px; margin-bottom:10px;">
      Clique para ditar e transcrever via Gemini STT com HUD flutuante
    </div>

    <!-- Console de Controle TTS -->
    <div class="tts-box">
      <div class="form-group">
        <label>Voz Neural Gemini</label>
        <select id="voiceSelect">
          <option value="Kore">Kore (Equilibrada e Humana - Padrão)</option>
          <option value="Puck">Puck (Dinâmica e Jovem)</option>
          <option value="Charon">Charon (Grave e Serena)</option>
          <option value="Fenrir">Fenrir (Forte e Firme)</option>
          <option value="Zephyr">Zephyr (Suave e Calma)</option>
        </select>
      </div>

      <div class="form-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label style="margin-bottom:0;">Velocidade de Reprodução</label>
          <span id="popupSpeedBadge" style="font-family:monospace; font-size:11px; color:#38bdf8; font-weight:bold;">1.0x</span>
        </div>
        <div class="speed-pills">
          <div class="speed-pill" data-speed="0.5">0.5x</div>
          <div class="speed-pill" data-speed="0.75">0.75x</div>
          <div class="speed-pill active" data-speed="1.0">1.0x</div>
          <div class="speed-pill" data-speed="1.25">1.25x</div>
          <div class="speed-pill" data-speed="1.5">1.5x</div>
          <div class="speed-pill" data-speed="1.75">1.75x</div>
          <div class="speed-pill" data-speed="2.0">2.0x</div>
          <div class="speed-pill" data-speed="2.5">2.5x</div>
        </div>
      </div>

      <div class="tts-actions">
        <button id="testTtsBtn" class="btn-action btn-test">▶️ Testar Voz com Gemini</button>
        <button id="stopTtsBtn" class="btn-action btn-stop">⏹️ Parar Áudio</button>
      </div>
    </div>

    <!-- Atalhos da Extensão com Estágios Informativos -->
    <div class="shortcut-list">
      <div class="shortcut-card">
        <div>
          <div style="font-weight:600; color:#f8fafc;">Narra Seleção (TTS)</div>
          <div style="font-size:9px; color:#94a3b8;">Estágios: Enviando ➔ Síntese ➔ Narrando</div>
        </div>
        <span class="badge">Ctrl + B</span>
      </div>
      <div class="shortcut-card">
        <div>
          <div style="font-weight:600; color:#38bdf8;">Google Lens Vision</div>
          <div style="font-size:9px; color:#94a3b8;">Estágios: Recorte ➔ Envio ➔ IA ➔ Narração</div>
        </div>
        <span class="badge" style="color:#38bdf8;">Ctrl + Shift + Arrastar</span>
      </div>
      <div class="shortcut-card">
        <div>
          <div style="font-weight:600; color:#fca5a5;">Gravar no Campo (STT)</div>
          <div style="font-size:9px; color:#94a3b8;">Estágios: Captura ➔ Envio ➔ IA ➔ Inserção</div>
        </div>
        <span class="badge" style="color:#fca5a5;">Pause OU Ctrl+Shift+Espaço</span>
      </div>
    </div>
  </div>

  <!-- ABA 2: HISTÓRICO & TELEMETRIA API -->
  <div id="tab-history" class="tab-pane">
    <div class="sub-tabs">
      <button class="sub-tab-btn active" id="subTabHistoryBtn">🎙️ Transcrições</button>
      <button class="sub-tab-btn" id="subTabApiLogsBtn">⚡ Telemetria API Gemini</button>
    </div>

    <!-- Lista de Transcrições -->
    <div id="historyViewContainer">
      <div id="historyList" class="history-list">
        <div style="text-align:center; padding:24px 8px; color:#64748b; font-size:11px;">
          Nenhuma fala gravada ainda.<br>Pressione Pause em qualquer campo para transcrever.
        </div>
      </div>
    </div>

    <!-- Lista de Logs de API -->
    <div id="apiLogsViewContainer" style="display:none;">
      <div id="apiLogsList" class="history-list">
        <div style="text-align:center; padding:24px 8px; color:#64748b; font-size:11px;">
          Nenhuma requisição de API registrada ainda.<br>Faça uma narração ou transcrição para ver os logs.
        </div>
      </div>
    </div>
  </div>

  <!-- ABA 3: CONEXÃO & CONFIGURAÇÃO -->
  <div id="tab-config" class="tab-pane">
    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:10px; margin-bottom:10px;">
      <label>🔑 Chave Obtida do Arquivo (.env)</label>
      <div style="font-family:monospace; font-size:12px; color:#34d399; background:#020617; padding:8px 10px; border-radius:6px; border:1px solid #1e293b; margin:6px 0;" id="configMaskedKeyDisplay">
        AIzaSy... (.env)
      </div>
      <div style="display:flex; gap:6px; margin:8px 0;">
        <input type="password" id="quickApiKeyInput" placeholder="Inserir ou alterar chave..." style="flex:1; font-size:11px;" />
        <button id="quickSaveApiKeyBtn" type="button" class="btn-action btn-test" style="width:auto; padding:4px 10px; font-size:11px;">Salvar</button>
      </div>
      <button id="validateApiKeyBtn" class="btn-full btn-web" style="margin-bottom:4px; font-size:11px;">
        <span>🔍 Validar Chave no Google Gemini</span>
      </button>
      <div id="apiKeyValidationMsg" style="font-size:10px; margin-top:4px; text-align:center; color:#94a3b8;">
        Lida exclusivamente do arquivo .env na raiz do projeto.
      </div>
    </div>

    <button id="reqMicBtn" class="btn-full btn-mic-perm">
      <span>🎤 Permitir / Testar Microfone</span>
    </button>

    <button id="openOptionsBtn" class="btn-full btn-opt">
      <span>⚙️ Central de Opções Completa</span>
    </button>

    <div id="toastSaved" class="toast-msg">✓ Configurações salvas!</div>
  </div>

  <!-- ABA 4: ATUALIZAÇÃO VIA GITHUB -->
  <div id="tab-update" class="tab-pane">
    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:10px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:11px; font-weight:700; color:#cbd5e1;">Repositório GitHub</span>
        <span id="popupGitBadge" style="font-size:9px; background:#1e293b; color:#93c5fd; padding:1px 6px; border-radius:4px; font-family:monospace;">main</span>
      </div>
      <div style="font-size:10px; color:#94a3b8; line-height:1.5;">
        <div>Commit: <strong id="popupGitCommit" style="color:#38bdf8; font-family:monospace;">Consultar status</strong></div>
        <div>Árvore Local: <strong id="popupGitDirty" style="color:#34d399;">Limpa</strong></div>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
      <button id="popupCheckGitBtn" class="btn-full btn-opt" style="margin-bottom:0; font-size:11px;">
        <span>🔍 1. Verificar Status Git</span>
      </button>

      <button id="popupPullGitBtn" class="btn-full btn-web" style="margin-bottom:0; font-size:11px;">
        <span>⬇️ 2. Baixar &amp; Instalar do GitHub</span>
      </button>

      <button id="popupReloadExtBtn" class="btn-full" style="background:#059669; color:white; margin-bottom:0; font-size:11px;">
        <span>🔄 3. Recarregar Extensão</span>
      </button>

      <button id="popupRestartChromeBtn" class="btn-full" style="background:#b45309; color:white; margin-bottom:0; font-size:11px;">
        <span>🚀 4. Reiniciar Google Chrome</span>
      </button>
    </div>

    <div id="popupUpdateLogs" style="background:#020617; border:1px solid #1e293b; border-radius:6px; padding:6px; font-family:monospace; font-size:9px; color:#94a3b8; max-height:85px; overflow-y:auto; line-height:1.3;">
      [$] Pronto para atualizar via GitHub.
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
`
  },
  {
    filename: 'popup.js',
    path: 'popup.js',
    description: 'Lógica do Popup: Gravação Direta com Permissão, Player TTS e Abertura Segura de URLs',
    language: 'javascript',
    content: `// Popup Logic - STT&TTS de Satiro (100% Autônomo com Modo Direto Gemini)
(function initPopup() {
  let activeAudio = null;
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimer = null;
  let recordSeconds = 0;

  const defaults = {
    serverUrl: '',
    connectionMode: 'direct',
    ttsVoice: 'Kore',
    ttsSpeed: 1.0,
    apiKey: 'AQ.Ab8RN6JkFmDWomdC0iYpYX9D787FfbLg5_Vpn0uyY_U8USm50Q',
    narratorInstruction: 'Você é um narrador natural e expressivo.',
    transcriberInstruction: 'Transcreva fielmente em português do Brasil sem explicações.'
  };

  let currentSettings = { ...defaults };

  // Utilitário de reprodução PCM 24kHz
  function pcmToWav(pcm16Data, sampleRate = 24000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = new ArrayBuffer(44 + pcm16Data.length);
    const view = new DataView(buffer);

    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcm16Data.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, pcm16Data.length, true);

    new Uint8Array(buffer, 44).set(pcm16Data);
    return buffer;
  }

  function isQuotaOrNotFoundError(err) {
    if (!err) return false;
    const msg = String(err.message || err.error?.message || (typeof err === 'object' ? JSON.stringify(err) : err) || '').toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('404') ||
      msg.includes('503') ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted') ||
      msg.includes('exceeded your current quota') ||
      msg.includes('rate limit') ||
      msg.includes('unavailable') ||
      msg.includes('high demand') ||
      msg.includes('not_found') ||
      msg.includes('not found') ||
      msg.includes('não retornou fluxo') ||
      msg.includes('não gerou áudio') ||
      msg.includes('nenhum áudio gerado') ||
      msg.includes('não retornou áudio')
    );
  }

  const POPUP_TTS_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-tts-preview'
  ];

  const POPUP_STT_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  function savePopupApiLog(entry) {
    chrome.storage.local.get({ apiLogs: [] }, (res) => {
      const logs = res.apiLogs || [];
      const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      logs.unshift({
        id: 'pop-' + Date.now(),
        timestamp: Date.now(),
        timeFormatted: timeStr,
        action: entry.action,
        model: entry.model,
        latencyMs: entry.latencyMs,
        statusCode: entry.statusCode || 200,
        statusText: entry.statusText || 'OK',
        success: Boolean(entry.success),
        payloadInfo: entry.payloadInfo || '',
        errorMessage: entry.errorMessage || null,
        mode: 'direct'
      });
      if (logs.length > 50) logs.pop();
      chrome.storage.local.set({ apiLogs: logs }, () => {
        if (typeof loadApiLogs === 'function') loadApiLogs();
      });
    });
  }

  async function executePopupFallback(taskName, cascade, payloadInfo, action) {
    let lastErr = null;
    const modelList = cascade || POPUP_TTS_CASCADE;
    for (let m = 0; m < modelList.length; m++) {
      const model = modelList[m];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const start = Date.now();
        try {
          const res = await action(model);
          const latency = Date.now() - start;
          savePopupApiLog({
            action: taskName,
            model: model,
            latencyMs: latency,
            statusCode: 200,
            statusText: 'OK',
            success: true,
            payloadInfo: payloadInfo
          });
          return res;
        } catch (err) {
          lastErr = err;
          const latency = Date.now() - start;
          console.warn('[Popup ' + taskName + '] Tentativa ' + attempt + '/3 no modelo ' + model + ' falhou:', err);
          
          savePopupApiLog({
            action: taskName,
            model: model,
            latencyMs: latency,
            statusCode: isQuotaOrNotFoundError(err) ? 429 : 500,
            statusText: 'Falha: ' + (err.message || 'Erro'),
            success: false,
            payloadInfo: payloadInfo,
            errorMessage: err.message
          });

          if (isQuotaOrNotFoundError(err)) {
            console.warn('[Popup ' + taskName + '] Cota excedida ou modelo ' + model + ' indisponível. Alternando para o próximo modelo...');
            break;
          }

          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 300));
          } else {
            break;
          }
        }
      }
      console.warn('[Popup ' + taskName + '] Tentativas concluídas no modelo ' + model + '. Alternando para o próximo modelo.');
    }
    let msg = lastErr?.message || 'Erro desconhecido';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      msg = 'Cota do plano gratuito do Gemini excedida (429). Aguarde alguns segundos ou insira sua própria chave Gemini.';
    }
    throw new Error('Falha em todos os modelos (' + modelList.join(' -> ') + '): ' + msg);
  }

  // Direct Gemini TTS - Primário: Gemini 3.5 Flash Lite (com fallback 3.1 Flash Lite -> 3.5 Flash -> TTS Preview)
  async function directGeminiTTS(text, voiceOverride = null, instOverride = null) {
    if (!currentSettings.apiKey) throw new Error('Chave Gemini não configurada');
    
    let baseVoiceName = voiceOverride || currentSettings.ttsVoice || 'Kore';
    let voiceInstruction = instOverride || '';

    // Resolução de Voz Personalizada
    const customList = currentSettings.customVoices || [];
    const customMatch = customList.find(cv => cv.id === baseVoiceName || cv.name === baseVoiceName);
    if (customMatch) {
      baseVoiceName = customMatch.baseVoice || 'Kore';
      if (customMatch.instruction) {
        voiceInstruction = customMatch.instruction;
      }
    }

    let fullPrompt = currentSettings.narratorInstruction || 'Narre com tom natural e fluida articulação em português:';
    if (voiceInstruction) {
      fullPrompt = '[Instrução da Voz: ' + voiceInstruction + ']\\n' + fullPrompt;
    }
    fullPrompt += '\\n' + text;
    const payloadInfo = 'Texto: ' + text.length + ' chars | Voz: ' + baseVoiceName;

    return await executePopupFallback('TTS', POPUP_TTS_CASCADE, payloadInfo, async (modelName) => {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + currentSettings.apiKey;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: baseVoiceName
                }
              }
            }
          }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || ('Erro Gemini TTS: ' + res.status));
      }

      const data = await res.json();
      const candidate = data.candidates?.[0]?.content?.parts?.[0];
      const audioData = candidate?.inlineData?.data;
      if (!audioData) throw new Error('Nenhum áudio gerado pelo modelo ' + modelName);

      const binaryStr = atob(audioData);
      const pcmBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        pcmBytes[i] = binaryStr.charCodeAt(i);
      }
      const wavBuffer = pcmToWav(pcmBytes, 24000);
      const wavBytes = new Uint8Array(wavBuffer);
      let wavBinary = '';
      for (let i = 0; i < wavBytes.length; i++) {
        wavBinary += String.fromCharCode(wavBytes[i]);
      }
      return btoa(wavBinary);
    });
  }

  // Direct Gemini STT - Primário: Gemini 3.5 Flash Lite (com fallback 3.1 Flash Lite -> 3.5 Flash)
  async function directGeminiSTT(base64Audio, mimeType = 'audio/webm') {
    if (!currentSettings.apiKey) throw new Error('Chave Gemini não configurada');
    const cleanBase64 = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
    const promptText = currentSettings.transcriberInstruction || 'Transcreva com precisão o que foi dito neste áudio em português.';
    const payloadInfo = 'Áudio base64 (' + Math.round(cleanBase64.length / 1024) + ' KB)';

    return await executePopupFallback('STT', POPUP_STT_CASCADE, payloadInfo, async (modelName) => {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + currentSettings.apiKey;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: mimeType, data: cleanBase64 } },
              { text: promptText }
            ]
          }]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || ('Erro Gemini STT: ' + res.status));
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error('Transcrição vazia retornada por ' + modelName);
      return text;
    });
  }

  function speakFallbackNative(text) {
    if (!window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = currentSettings.ttsSpeed || 1.0;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function maskKey(key) {
    if (!key) return 'Nenhuma chave (.env)';
    if (key.length <= 10) return key.substring(0, 3) + '***' + key.substring(key.length - 2);
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
  }

  // Atualizar UI de Status da Chave
  function updateApiKeyUI() {
    const banner = document.getElementById('apiKeyBanner');
    const title = document.getElementById('apiKeyBannerTitle');
    const state = document.getElementById('apiKeyBannerState');
    const maskedDisplay = document.getElementById('maskedKeyDisplay');
    const configMaskedDisplay = document.getElementById('configMaskedKeyDisplay');

    const hasKey = Boolean(currentSettings.apiKey && currentSettings.apiKey.trim());
    const keyVal = currentSettings.apiKey ? maskKey(currentSettings.apiKey) : 'AIzaSy... (.env)';

    if (maskedDisplay) {
      maskedDisplay.innerHTML = '<span>' + keyVal + '</span><span style="font-size:9px; background:#065f46; color:#a7f3d0; padding:1px 5px; border-radius:4px; font-family:sans-serif;">RAIZ</span>';
    }
    if (configMaskedDisplay) {
      configMaskedDisplay.innerText = keyVal + ' (.env)';
    }

    if (hasKey) {
      if (banner) {
        banner.className = 'api-key-banner saved';
      }
      if (title) title.innerText = '⚡ Chave Obtida (.env)';
      if (state) state.innerText = 'Ativa';
    }
  }

  function renderVoiceDropdown() {
    const voiceSelect = document.getElementById('voiceSelect');
    if (!voiceSelect) return;

    voiceSelect.innerHTML = '';

    const stdGroup = document.createElement('optgroup');
    stdGroup.label = 'Vozes Nativas Gemini';

    const stdVoices = [
      { id: 'Kore', name: 'Kore (Equilibrada e Humana)' },
      { id: 'Puck', name: 'Puck (Dinâmica e Jovem)' },
      { id: 'Charon', name: 'Charon (Grave e Serena)' },
      { id: 'Fenrir', name: 'Fenrir (Forte e Firme)' },
      { id: 'Zephyr', name: 'Zephyr (Suave e Calma)' },
      { id: 'Aoede', name: 'Aoede (Expressiva)' },
      { id: 'Calliope', name: 'Calliope (Melódica)' },
      { id: 'Orpheus', name: 'Orpheus (Narrador)' }
    ];

    stdVoices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      stdGroup.appendChild(opt);
    });
    voiceSelect.appendChild(stdGroup);

    const customList = currentSettings.customVoices || [];
    if (customList.length > 0) {
      const customGroup = document.createElement('optgroup');
      customGroup.label = '⭐ Vozes Personalizadas';
      customList.forEach(cv => {
        const opt = document.createElement('option');
        opt.value = cv.id;
        opt.textContent = '⭐ ' + cv.name + ' (Base ' + cv.baseVoice + ')';
        customGroup.appendChild(opt);
      });
      voiceSelect.appendChild(customGroup);
    }

    if (currentSettings.ttsVoice) {
      voiceSelect.value = currentSettings.ttsVoice;
    }
  }

  // Navegação de Abas
  document.querySelectorAll('.popup-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.popup-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });

  // Carregar dados salvos
  chrome.storage.sync.get(defaults, (items) => {
    currentSettings = Object.assign(currentSettings, items);
    
    // Voz dropdown com suporte a vozes nativas e personalizadas
    renderVoiceDropdown();

    // Seleção de voz
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
      voiceSelect.addEventListener('change', (e) => {
        const selected = e.target.value;
        currentSettings.ttsVoice = selected;
        chrome.storage.sync.set({ ttsVoice: selected });
      });
    }

    // Expandir/Recolher formulário de Voz Personalizada
    const toggleFormBtn = document.getElementById('toggleCustomVoiceFormBtn');
    const customContainer = document.getElementById('customVoiceFormContainer');
    if (toggleFormBtn && customContainer) {
      toggleFormBtn.addEventListener('click', () => {
        if (customContainer.style.display === 'none' || !customContainer.style.display) {
          customContainer.style.display = 'flex';
          toggleFormBtn.innerText = '- Recolher';
        } else {
          customContainer.style.display = 'none';
          toggleFormBtn.innerText = '+ Expandir';
        }
      });
    }

    // Testar nova voz personalizada
    const testNewVoiceBtn = document.getElementById('testNewVoiceBtn');
    if (testNewVoiceBtn) {
      testNewVoiceBtn.addEventListener('click', async () => {
        const text = document.getElementById('newVoiceTestTextInput')?.value || 'Demonstração de voz.';
        const baseVoice = document.getElementById('newVoiceBaseSelect')?.value || 'Kore';
        const inst = document.getElementById('newVoiceInstInput')?.value || '';

        testNewVoiceBtn.innerText = 'Gerando...';
        try {
          const wavBase64 = await directGeminiTTS(text, baseVoice, inst);
          if (activeAudio) activeAudio.pause();
          activeAudio = new Audio('data:audio/wav;base64,' + wavBase64);
          activeAudio.playbackRate = currentSettings.ttsSpeed || 1.0;
          activeAudio.play();
        } catch (err) {
          alert('Erro ao testar voz: ' + (err.message || err));
        } finally {
          testNewVoiceBtn.innerText = '▶️ Testar Voz';
        }
      });
    }

    // Salvar nova voz personalizada
    const saveNewVoiceBtn = document.getElementById('saveNewVoiceBtn');
    if (saveNewVoiceBtn) {
      saveNewVoiceBtn.addEventListener('click', () => {
        const name = document.getElementById('newVoiceNameInput')?.value?.trim();
        const baseVoice = document.getElementById('newVoiceBaseSelect')?.value || 'Kore';
        const inst = document.getElementById('newVoiceInstInput')?.value?.trim() || '';

        if (!name) {
          alert('Por favor, informe um nome para a nova voz.');
          return;
        }

        const newVoice = {
          id: 'cv-' + Date.now(),
          name: name,
          baseVoice: baseVoice,
          instruction: inst
        };

        const customList = currentSettings.customVoices || [];
        customList.push(newVoice);
        currentSettings.customVoices = customList;
        currentSettings.ttsVoice = newVoice.id;

        chrome.storage.sync.set({
          customVoices: customList,
          ttsVoice: newVoice.id
        }, () => {
          renderVoiceDropdown();
          saveNewVoiceBtn.innerText = '✓ Salvo!';
          setTimeout(() => { saveNewVoiceBtn.innerText = '➕ Salvar Voz'; }, 2000);
        });
      });
    }

    // Velocidade
    document.querySelectorAll('.speed-pill').forEach(pill => {
      const spd = parseFloat(pill.dataset.speed);
      if (Math.abs(spd - (currentSettings.ttsSpeed || 1.0)) < 0.05) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    updateApiKeyUI();
  });

  // Salvar Chave Rápida
  const quickSaveApiKeyBtn = document.getElementById('quickSaveApiKeyBtn');
  const quickApiKeyInput = document.getElementById('quickApiKeyInput');
  if (quickSaveApiKeyBtn && quickApiKeyInput) {
    quickSaveApiKeyBtn.addEventListener('click', () => {
      const val = quickApiKeyInput.value.trim();
      currentSettings.apiKey = val;
      currentSettings.connectionMode = 'direct';
      chrome.storage.sync.set({ apiKey: val, connectionMode: 'direct' }, () => {
        updateApiKeyUI();
        quickSaveApiKeyBtn.innerText = '✓ Salvo';
        setTimeout(() => { quickSaveApiKeyBtn.innerText = 'Salvar'; }, 2000);
      });
    });
  }

  // Tentar obter chave automaticamente do servidor se necessário
  const rawServer = currentSettings.serverUrl || 'http://localhost:3000';
  const serverBase = rawServer.endsWith('/') ? rawServer.slice(0, -1) : rawServer;
  fetch(serverBase + '/api/get-key').then(r => r.json()).then(data => {
    if (data.fullKey) {
      currentSettings.apiKey = data.fullKey;
      chrome.storage.sync.set({ apiKey: data.fullKey });
      if (quickApiKeyInput && !quickApiKeyInput.value) {
        quickApiKeyInput.value = data.fullKey;
      }
      updateApiKeyUI();
    }
  }).catch(() => {});

  // Validar Chave de .env no Google
  const validateApiKeyBtn = document.getElementById('validateApiKeyBtn');
  const apiKeyValidationMsg = document.getElementById('apiKeyValidationMsg');
  if (validateApiKeyBtn) {
    validateApiKeyBtn.addEventListener('click', async () => {
      const key = currentSettings.apiKey || (quickApiKeyInput ? quickApiKeyInput.value.trim() : '');
      if (!key) {
        if (apiKeyValidationMsg) {
          apiKeyValidationMsg.innerText = '⚠️ Nenhuma chave encontrada em .env.';
          apiKeyValidationMsg.style.color = '#f59e0b';
        }
        return;
      }

      validateApiKeyBtn.innerText = 'Testando com Google...';
      try {
        const rawUrl = currentSettings.serverUrl || 'http://localhost:3000';
        const sUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
        const res = await fetch(sUrl + '/api/validate-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key })
        });

        if (res.ok) {
          if (apiKeyValidationMsg) {
            apiKeyValidationMsg.innerText = '✓ Chave de .env Válida!';
            apiKeyValidationMsg.style.color = '#34d399';
          }
        } else {
          const err = await res.json().catch(() => ({}));
          if (apiKeyValidationMsg) {
            apiKeyValidationMsg.innerText = '❌ Erro na chave: ' + (err.error?.message || 'Código ' + res.status);
            apiKeyValidationMsg.style.color = '#f87171';
          }
        }
      } catch (err) {
        if (apiKeyValidationMsg) {
          apiKeyValidationMsg.innerText = '❌ Erro de conexão com a API Google';
          apiKeyValidationMsg.style.color = '#f87171';
        }
      } finally {
        validateApiKeyBtn.innerText = '🔍 Validar Chave de .env';
      }
    });
  }

  // Sub-abas de Histórico e Logs
  const subTabHistoryBtn = document.getElementById('subTabHistoryBtn');
  const subTabApiLogsBtn = document.getElementById('subTabApiLogsBtn');
  const historyViewContainer = document.getElementById('historyViewContainer');
  const apiLogsViewContainer = document.getElementById('apiLogsViewContainer');

  if (subTabHistoryBtn && subTabApiLogsBtn) {
    subTabHistoryBtn.addEventListener('click', () => {
      subTabHistoryBtn.classList.add('active');
      subTabApiLogsBtn.classList.remove('active');
      if (historyViewContainer) historyViewContainer.style.display = 'block';
      if (apiLogsViewContainer) apiLogsViewContainer.style.display = 'none';
      loadHistory();
    });

    subTabApiLogsBtn.addEventListener('click', () => {
      subTabApiLogsBtn.classList.add('active');
      subTabHistoryBtn.classList.remove('active');
      if (historyViewContainer) historyViewContainer.style.display = 'none';
      if (apiLogsViewContainer) apiLogsViewContainer.style.display = 'block';
      loadApiLogs();
    });
  }

  // Carregar Histórico
  function loadHistory() {
    chrome.storage.local.get({ sessionTranscriptions: [] }, (res) => {
      const list = res.sessionTranscriptions || [];
      const countEl = document.getElementById('histCount');
      if (countEl) countEl.innerText = list.length;

      const container = document.getElementById('historyList');
      if (!container) return;

      if (list.length === 0) {
        container.innerHTML = \`
          <div style="text-align:center; padding:24px 8px; color:#64748b; font-size:11px;">
            Nenhuma fala gravada ainda.<br>Pressione Pause em qualquer campo para transcrever.
          </div>
        \`;
        return;
      }

      container.innerHTML = list.slice(0, 8).map(item => \`
        <div class="history-item">
          <div class="history-top">
            <span style="color:#34d399; font-weight:600;">\${item.target || 'Campo'}</span>
            <span>\${item.time}</span>
          </div>
          <div class="history-text">"\${item.text}"</div>
          <div class="history-btns">
            <button class="btn-h-copy" data-text="\${item.text}">Copiar</button>
            <button class="btn-h-tts" data-text="\${item.text}">Ouvir TTS</button>
          </div>
        </div>
      \`).join('');

      document.querySelectorAll('.btn-h-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
          navigator.clipboard.writeText(e.target.dataset.text);
          e.target.innerText = '✓ Copiado';
          setTimeout(() => { e.target.innerText = 'Copiar'; }, 1500);
        });
      });

      document.querySelectorAll('.btn-h-tts').forEach(btn => {
        btn.addEventListener('click', (e) => {
          playTtsSample(e.target.dataset.text);
        });
      });
    });
  }
  loadHistory();

  // Carregar Logs e Telemetria de API
  function loadApiLogs() {
    chrome.storage.local.get({ apiLogs: [] }, (res) => {
      const logs = res.apiLogs || [];
      const container = document.getElementById('apiLogsList');
      if (!container) return;

      if (logs.length === 0) {
        container.innerHTML = \`
          <div style="text-align:center; padding:24px 8px; color:#64748b; font-size:11px;">
            Nenhuma requisição de API registrada ainda.<br>Realize uma ação para visualizar a telemetria.
          </div>
        \`;
        return;
      }

      container.innerHTML = logs.slice(0, 10).map(item => \`
        <div class="api-log-item">
          <div class="api-log-header">
            <span style="font-weight:700; color:#f8fafc;">\${item.action} • \${item.model}</span>
            <span class="api-log-badge \${item.success ? 'success' : 'error'}">\${item.statusCode} \${item.statusText}</span>
          </div>
          <div class="api-log-sub">
            <span style="color:#38bdf8;">\${item.latencyMs}ms | \${item.payloadInfo}</span>
            <span>\${item.timeFormatted}</span>
          </div>
          \${item.errorMessage ? \`<div style="color:#f87171; font-size:9px; margin-top:2px;">Erro: \${item.errorMessage}</div>\` : ''}
        </div>
      \`).join('');
    });
  }

  // Mudança de voz
  const voiceSelect = document.getElementById('voiceSelect');
  if (voiceSelect) {
    voiceSelect.addEventListener('change', () => {
      currentSettings.ttsVoice = voiceSelect.value;
      chrome.storage.sync.set({ ttsVoice: currentSettings.ttsVoice });
    });
  }

  // CORREÇÃO CRÍTICA DE VELOCIDADE NO POPUP (Persistência Imediata e Re-aplicação Robusta)
  document.querySelectorAll('.speed-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const sp = parseFloat(pill.dataset.speed);
      currentSettings.ttsSpeed = sp;
      
      document.querySelectorAll('.speed-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      chrome.storage.sync.set({ ttsSpeed: sp });

      if (activeAudio) {
        activeAudio.playbackRate = sp;
        activeAudio.defaultPlaybackRate = sp;
      }
      console.log('[Popup STT&TTS] Velocidade alterada para:', sp + 'x');
    });
  });

  // Reproduzir Amostra TTS
  async function playTtsSample(textToPlay) {
    const testBtn = document.getElementById('testTtsBtn');
    const stopBtn = document.getElementById('stopTtsBtn');

    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }

    testBtn.innerText = 'Sintetizando...';
    testBtn.disabled = true;

    const sampleText = textToPlay || ('Olá! Esta é uma demonstração da voz neural ' + (currentSettings.ttsVoice || 'Kore') + ' do STT&TTS de Satiro.');

    // 1. Tenta Modo Direto Gemini
    if (currentSettings.apiKey && currentSettings.apiKey.trim()) {
      try {
        const wavBase64 = await directGeminiTTS(sampleText);
        const audio = new Audio('data:audio/wav;base64,' + wavBase64);
        const spd = Number(currentSettings.ttsSpeed || 1.0);
        
        audio.playbackRate = spd;
        audio.defaultPlaybackRate = spd;

        audio.addEventListener('loadedmetadata', () => {
          audio.playbackRate = Number(currentSettings.ttsSpeed || 1.0);
        });
        audio.addEventListener('play', () => {
          audio.playbackRate = Number(currentSettings.ttsSpeed || 1.0);
        });
        audio.addEventListener('playing', () => {
          audio.playbackRate = Number(currentSettings.ttsSpeed || 1.0);
        });

        activeAudio = audio;

        testBtn.style.display = 'none';
        stopBtn.style.display = 'flex';

        activeAudio.onended = () => {
          activeAudio = null;
          testBtn.style.display = 'flex';
          stopBtn.style.display = 'none';
          testBtn.innerText = '▶️ Testar Voz com Gemini';
          testBtn.disabled = false;
        };

        await activeAudio.play();
        return;
      } catch (err) {
        console.warn('[STT&TTS de Satiro] Falha na síntese direta:', err);
      }
    }

    // 2. Fallback de voz nativa se não houver chave ou der erro
    speakFallbackNative(sampleText);
    testBtn.innerText = '▶️ Testar Voz com Gemini';
    testBtn.disabled = false;
  }

  const testBtn = document.getElementById('testTtsBtn');
  if (testBtn) testBtn.addEventListener('click', () => playTtsSample());

  const stopBtn = document.getElementById('stopTtsBtn');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      testBtn.style.display = 'flex';
      stopBtn.style.display = 'none';
      testBtn.innerText = '▶️ Testar Voz com Gemini';
      testBtn.disabled = false;
    });
  }

  // GRAVAÇÃO DIRETA NO POPUP COM SOLICITAÇÃO NATIVA DE MICROFONE
  const directRecordBtn = document.getElementById('directRecordBtn');
  const micLabel = document.getElementById('micLabel');
  const micTimer = document.getElementById('micTimer');
  const micStatusSub = document.getElementById('micStatusSub');

  if (directRecordBtn) {
    directRecordBtn.addEventListener('click', async () => {
      if (!isRecording) {
        // INICIAR GRAVAÇÃO NO POPUP
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioChunks = [];
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) audioChunks.push(e.data);
          };

          mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            micLabel.innerText = 'Transcrevendo com Gemini...';
            micStatusSub.innerText = 'Enviando áudio diretamente para a API Gemini...';

            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                let transcribedText = '';
                if (currentSettings.apiKey && currentSettings.apiKey.trim()) {
                  transcribedText = await directGeminiSTT(reader.result, 'audio/webm');
                } else {
                  throw new Error('Chave Gemini ausente. Insira sua chave acima.');
                }

                if (transcribedText) {
                  micLabel.innerText = '✓ Fala Transcrita!';
                  micStatusSub.innerText = '"' + transcribedText + '"';

                  // Copia para área de transferência
                  navigator.clipboard.writeText(transcribedText);

                  // Salva no histórico
                  chrome.storage.local.get({ sessionTranscriptions: [] }, (r) => {
                    const list = r.sessionTranscriptions || [];
                    list.unshift({
                      text: transcribedText,
                      target: 'Popup STT&TTS de Satiro',
                      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    });
                    chrome.storage.local.set({ sessionTranscriptions: list }, () => loadHistory());
                  });

                  setTimeout(() => {
                    micLabel.innerText = 'Gravar Fala no Microfone';
                    micStatusSub.innerText = 'Clique para ditar e transcrever via Gemini STT';
                  }, 4000);

                } else {
                  micLabel.innerText = 'Nenhuma fala detectada';
                  micStatusSub.innerText = 'Fale mais próximo ao microfone e tente novamente.';
                }
              } catch (err) {
                micLabel.innerText = 'Erro na Transcrição';
                micStatusSub.innerText = err.message || 'Verifique sua Chave Gemini.';
              }
            };
            reader.readAsDataURL(audioBlob);
          };

          mediaRecorder.start();
          isRecording = true;
          recordSeconds = 0;
          directRecordBtn.classList.add('recording');
          micLabel.innerText = 'Pressione para Finalizar';
          micTimer.style.display = 'inline';
          micTimer.innerText = '0s';
          micStatusSub.innerText = 'Ouvindo sua fala... Clique novamente para transcrever com IA.';

          recordTimer = setInterval(() => {
            recordSeconds++;
            micTimer.innerText = recordSeconds + 's';
          }, 1000);

        } catch (err) {
          micLabel.innerText = 'Permissão Negada';
          micStatusSub.innerText = 'O Chrome precisa de permissão de microfone. Clique em "Permitir Microfone" na aba Chave & Config.';
        }

      } else {
        // PARAR GRAVAÇÃO
        clearInterval(recordTimer);
        micTimer.style.display = 'none';
        directRecordBtn.classList.remove('recording');
        isRecording = false;

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }
    });
  }

  // Solicitar Permissão de Microfone explicitamente
  const reqMicBtn = document.getElementById('reqMicBtn');
  if (reqMicBtn) {
    reqMicBtn.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        reqMicBtn.innerText = '✓ Permissão de Microfone Concedida!';
        reqMicBtn.style.background = '#065f46';
        reqMicBtn.style.color = '#ecfdf5';
      } catch (err) {
        alert('Permissão de microfone não concedida pelo Chrome: ' + err.message);
      }
    });
  }

  // Abrir Central de Opções
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
      }
    });
  }

  // ==========================================
  // LÓGICA DA ABA DE ATUALIZAÇÃO VIA GITHUB
  // ==========================================
  const popupCheckGitBtn = document.getElementById('popupCheckGitBtn');
  const popupPullGitBtn = document.getElementById('popupPullGitBtn');
  const popupReloadExtBtn = document.getElementById('popupReloadExtBtn');
  const popupRestartChromeBtn = document.getElementById('popupRestartChromeBtn');
  const popupGitCommit = document.getElementById('popupGitCommit');
  const popupGitDirty = document.getElementById('popupGitDirty');
  const popupGitBadge = document.getElementById('popupGitBadge');
  const popupUpdateLogs = document.getElementById('popupUpdateLogs');

  function addPopupUpdateLog(msg) {
    if (!popupUpdateLogs) return;
    const line = document.createElement('div');
    line.innerText = msg;
    line.style.padding = '1px 0';
    popupUpdateLogs.appendChild(line);
    popupUpdateLogs.scrollTop = popupUpdateLogs.scrollHeight;
  }

  function getServerBaseUrl() {
    const raw = currentSettings.serverUrl || 'http://localhost:3000';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  // Consulta direta à API Pública do GitHub com detecção inteligente de repositório e branch
  async function fetchDirectGitHubStatus() {
    const candidateRepos = [
      'pinguelanarosca/STT-TTSByAlee',
      'pinguelanarosca/STT-TTSByAlee1'
    ];
    const candidateBranches = ['main', 'master'];

    let lastError = null;

    for (const repo of candidateRepos) {
      for (const branch of candidateBranches) {
        try {
          const res = await fetch('https://api.github.com/repos/' + repo + '/commits/' + branch, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
          });
          if (res.ok) {
            const data = await res.json();
            const sha = data.sha ? data.sha.substring(0, 7) : branch;
            const msg = data.commit?.message ? data.commit.message.split('\\n')[0] : 'Último commit';
            const author = data.commit?.author?.name || 'GitHub';
            const date = data.commit?.author?.date ? new Date(data.commit.author.date).toLocaleString('pt-BR') : '';

            return {
              isGitRepo: true,
              branch: branch,
              currentCommit: sha,
              commitDate: date,
              commitMessage: msg,
              author: author,
              remoteUrl: 'https://github.com/' + repo,
              repoName: repo,
              dirty: false,
              hasUpdates: true,
              source: 'github_api'
            };
          } else if (res.status === 404) {
            lastError = new Error('Repositório ou branch não encontrada (' + repo + '@' + branch + ')');
          } else {
            lastError = new Error('GitHub API HTTP ' + res.status);
          }
        } catch (e) {
          lastError = e;
        }
      }
    }

    throw lastError || new Error('Não foi possível conectar ao GitHub');
  }

  async function checkGitStatusInPopup() {
    if (!popupCheckGitBtn) return;
    popupCheckGitBtn.disabled = true;
    popupCheckGitBtn.innerText = 'Consultando...';
    addPopupUpdateLog('[$] Consultando status no GitHub (pinguelanarosca/STT-TTSByAlee)...');

    try {
      let data = null;

      // 1. Tenta API direta do GitHub
      try {
        data = await fetchDirectGitHubStatus();
        addPopupUpdateLog('✓ Conectado diretamente à API pública do GitHub!');
      } catch (ghErr) {
        // 2. Se a API do GitHub falhar, tenta o servidor local caso esteja ativo
        const sUrl = getServerBaseUrl();
        try {
          const res = await fetch(sUrl + '/api/git/status', {
            headers: { 'Accept': 'application/json' }
          });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            data = await res.json();
            addPopupUpdateLog('✓ Conectado ao servidor local.');
          }
        } catch {}

        if (!data) {
          throw new Error(ghErr.message || 'Verifique sua conexão com a internet');
        }
      }

      if (data) {
        if (popupGitBadge) popupGitBadge.innerText = (data.repoName ? data.repoName.split('/')[1] : '') + ' (' + (data.branch || 'main') + ')';
        if (popupGitCommit) popupGitCommit.innerText = data.currentCommit || 'N/A';
        if (popupGitDirty) {
          popupGitDirty.innerText = data.source === 'github_api' ? 'Sincronizado com GitHub' : (data.dirty ? (data.modifiedFiles?.length + ' alterados') : 'Limpa (Clean)');
          popupGitDirty.style.color = '#34d399';
        }

        addPopupUpdateLog('📌 Último Commit: ' + data.currentCommit + ' - "' + (data.commitMessage || '') + '"');
        if (data.commitDate) {
          addPopupUpdateLog('📅 Data: ' + data.commitDate + (data.author ? ' (' + data.author + ')' : ''));
        }
        addPopupUpdateLog('⚡ Dica: execute "atualizar_extensao.bat" na pasta da extensão para atualizar tudo automaticamente!');
      }
    } catch (err) {
      addPopupUpdateLog('❌ Falha na consulta: ' + (err.message || err));
      addPopupUpdateLog('💡 Para atualizar sem internet ou API, execute atualizar_extensao.bat na pasta.');
    } finally {
      popupCheckGitBtn.disabled = false;
      popupCheckGitBtn.innerText = '🔍 1. Verificar Status Git';
    }
  }

  if (popupCheckGitBtn) {
    popupCheckGitBtn.addEventListener('click', checkGitStatusInPopup);
  }

  if (popupPullGitBtn) {
    popupPullGitBtn.addEventListener('click', async () => {
      popupPullGitBtn.disabled = true;
      popupPullGitBtn.innerText = 'Baixando...';
      addPopupUpdateLog('[$] Iniciando download da versão mais recente do GitHub...');

      let pullSucceeded = false;

      // 1. Tentar pull via servidor local se existir
      try {
        const sUrl = getServerBaseUrl();
        const res = await fetch(sUrl + '/api/git/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ repoUrl: 'https://github.com/pinguelanarosca/STT-TTSByAlee1', branch: 'main', force: false, runInstall: true })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data.steps) {
            data.steps.forEach(s => {
              addPopupUpdateLog((s.success ? '✓ ' : '⚠️ ') + s.name + ' (' + s.durationMs + 'ms)');
            });
          }
          if (data.success) {
            pullSucceeded = true;
            addPopupUpdateLog('✓ ' + data.message);
          }
        }
      } catch (e) {
        // Servidor local não respondeu, usaremos download direto
      }

      // 2. Se não estiver rodando servidor local, abrir download direto do ZIP do GitHub
      if (!pullSucceeded) {
        const repoZipUrl = 'https://github.com/pinguelanarosca/STT-TTSByAlee1/archive/refs/heads/main.zip';
        addPopupUpdateLog('📥 Baixando pacote ZIP atualizado do repositório GitHub...');
        chrome.tabs.create({ url: repoZipUrl });
        addPopupUpdateLog('✓ Download do arquivo ZIP iniciado!');
        addPopupUpdateLog('⚡ Após descompactar na pasta da extensão, clique no botão 3 (Recarregar Extensão).');
      }

      popupPullGitBtn.disabled = false;
      popupPullGitBtn.innerText = '⬇️ 2. Baixar & Instalar do GitHub';
    });
  }

  if (popupReloadExtBtn) {
    popupReloadExtBtn.addEventListener('click', () => {
      addPopupUpdateLog('[$] Recarregando extensão com nova versão...');
      setTimeout(() => {
        chrome.runtime.reload();
      }, 150);
    });
  }

  if (popupRestartChromeBtn) {
    popupRestartChromeBtn.addEventListener('click', async () => {
      addPopupUpdateLog('[$] Enviando sinal de reinício ao Chrome...');
      try {
        const sUrl = getServerBaseUrl();
        fetch(sUrl + '/api/git/restart-chrome', { method: 'POST' }).catch(() => {});
      } catch {}

      try {
        navigator.clipboard.writeText('chrome://restart');
        addPopupUpdateLog('✓ chrome://restart copiado para área de transferência.');
      } catch {}

      try {
        chrome.tabs.create({ url: 'chrome://restart' });
      } catch {
        addPopupUpdateLog('Abra uma nova aba e digite chrome://restart para reiniciar.');
      }
    });
  }
})();
`
  },
  {
    filename: 'options.html',
    path: 'options.html',
    description: 'Central Completa de Configuração e Testes com Mixer, Prompts e Microfone Integrado',
    language: 'html',
    content: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>STT&TTS de Satiro - Central de Configurações & Laboratório</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      line-height: 1.5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(15, 23, 42, 0.9);
      border-bottom: 1px solid #1e293b;
      padding: 14px 24px;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      font-size: 24px;
      background: linear-gradient(135deg, #0284c7, #8b5cf6);
      border-radius: 10px;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 700;
      color: #f8fafc;
    }
    .brand-sub {
      font-size: 11px;
      color: #38bdf8;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-web-app {
      background: #2563eb;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 8px;
      text-decoration: none;
      border: 1px solid #3b82f6;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-web-app:hover { background: #1d4ed8; }

    .nav-tabs {
      display: flex;
      gap: 6px;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      padding: 8px 24px;
      overflow-x: auto;
    }
    .tab-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .tab-btn:hover { color: #f8fafc; background: #1e293b; }
    .tab-btn.active {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border-color: rgba(56, 189, 248, 0.3);
    }

    main {
      flex: 1;
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      padding: 24px;
    }

    .tab-content { display: none; }
    .tab-content.active { display: block; animation: fadeIn 0.2s ease-in; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #1e293b;
    }
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-desc {
      font-size: 12px;
      color: #94a3b8;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .shortcut-banner {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
    }
    .shortcut-badge {
      background: #0f172a;
      border: 1px solid #475569;
      color: #38bdf8;
      font-family: monospace;
      font-size: 11px;
      padding: 3px 6px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 6px;
    }
    .shortcut-input {
      background: #0f172a;
      border: 1px solid #475569;
      color: #34d399;
      font-family: monospace;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      margin-bottom: 6px;
      width: 100%;
      cursor: text;
      outline: none;
    }
    .shortcut-input:focus {
      border-color: #34d399;
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #cbd5e1;
      margin-bottom: 6px;
    }
    input[type="text"], input[type="password"], textarea, select {
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      color: #f8fafc;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    input:focus, textarea:focus, select:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }
    textarea {
      min-height: 90px;
      resize: vertical;
    }

    .slider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
    }
    input[type="range"] {
      width: 100%;
      accent-color: #38bdf8;
      margin-bottom: 14px;
    }

    .voice-btn-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-top: 8px;
    }
    .voice-pill {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 10px;
      border-radius: 10px;
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .voice-pill.active {
      background: #0284c7;
      color: #fff;
      border-color: #38bdf8;
      box-shadow: 0 0 15px rgba(2, 132, 199, 0.35);
    }

    .toast-saved {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #065f46;
      border: 1px solid #10b981;
      color: #ecfdf5;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      gap: 8px;
      z-index: 999;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-logo">🎙️</div>
      <div>
        <div class="brand-title">STT&TTS de Satiro • Central de Opções & Laboratório</div>
        <div class="brand-sub">Google Gemini TTS / STT & Google Lens Vision</div>
      </div>
    </div>
    <div class="header-actions">
      <button id="optGrantMicBtn" class="btn-web-app" style="background:#065f46; border-color:#10b981;">
        <span>🎤 Permitir Microfone</span>
      </button>
    </div>
  </header>

  <nav class="nav-tabs">
    <button class="tab-btn active" data-target="tab-lab">🧪 Laboratório de Teste & Atalhos</button>
    <button class="tab-btn" data-target="tab-mixer">🎛️ Mixer de Áudio TTS</button>
    <button class="tab-btn" data-target="tab-prompts">🎙️ Estúdio de Instruções & Vozes</button>
    <button class="tab-btn" data-target="tab-history">📜 Histórico de Transcrições</button>
    <button class="tab-btn" data-target="tab-connection">⚙️ Conexão do Servidor & API</button>
    <button class="tab-btn" data-target="tab-github">🔄 Atualização via GitHub</button>
  </nav>

  <main>
    <!-- ABA 1: LABORATÓRIO DE TESTE -->
    <div id="tab-lab" class="tab-content active">
      <div class="grid-3">
        <div class="shortcut-banner">
          <input type="text" id="shortcutNarrateDisplay" class="shortcut-input" placeholder="Clique e aperte as teclas..." readonly />
          <h4 style="font-size:13px; font-weight:600; margin-bottom:4px;">Narra Seleção TTS</h4>
          <p style="font-size:12px; color:#94a3b8;">Selecione qualquer texto na web e use o atalho para ouvir a narração neural do Gemini.</p>
        </div>
        <div class="shortcut-banner" style="border-color:#0284c7;">
          <span class="shortcut-badge" style="color:#38bdf8;">Ctrl + Shift + Arrastar</span>
          <h4 style="font-size:13px; font-weight:600; margin-bottom:4px;">Google Lens Vision</h4>
          <p style="font-size:12px; color:#94a3b8;">Segure Ctrl+Shift e arraste o mouse sobre gráficos ou textos para narrar a foto.</p>
        </div>
        <div class="shortcut-banner" style="border-color:#ef4444;">
          <input type="text" id="shortcutRecordDisplay" class="shortcut-input" style="color:#fca5a5; border-color:#991b1b;" placeholder="Clique e aperte as teclas..." readonly />
          <h4 style="font-size:13px; font-weight:600; margin-bottom:4px;">Gravar & Transcrever</h4>
          <p style="font-size:12px; color:#94a3b8;">Foque em um campo e use o atalho para gravar. Fale no microfone e use novamente para digitar.</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📝 Campos de Teste Imediato (Com Microfone Integrado)</div>
            <div class="card-desc">Clique no campo e pressione <b>Pause / Break</b> (ou <b>Ctrl+Shift+Espaço</b>), ou use o botão de microfone do campo!</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="margin:0;">1. Título do Relatório / Assunto</label>
              <button class="opt-field-mic-btn" data-target="demoField1" style="background:#1e293b; border:1px solid #334155; color:#38bdf8; font-size:11px; padding:2px 8px; border-radius:4px; cursor:pointer;">🎙️ Ditar aqui</button>
            </div>
            <input type="text" id="demoField1" placeholder="Clique aqui e pressione Pause ou Ctrl+Shift+Espaço para ditar..." />
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="margin:0;">2. E-mail de Resposta Rápida</label>
              <button class="opt-field-mic-btn" data-target="demoField2" style="background:#1e293b; border:1px solid #334155; color:#38bdf8; font-size:11px; padding:2px 8px; border-radius:4px; cursor:pointer;">🎙️ Ditar aqui</button>
            </div>
            <input type="text" id="demoField2" placeholder="Clique aqui e pressione Pause para ditar..." />
          </div>

          <div style="grid-column: 1 / -1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="margin:0;">3. Notas Detalhadas da Reunião</label>
              <button class="opt-field-mic-btn" data-target="demoField3" style="background:#1e293b; border:1px solid #334155; color:#38bdf8; font-size:11px; padding:2px 8px; border-radius:4px; cursor:pointer;">🎙️ Ditar aqui</button>
            </div>
            <textarea id="demoField3" placeholder="Clique aqui e pressione Pause ou Ctrl+Shift+Espaço para ditar um parágrafo inteiro com pontuação automática..."></textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- ABA 2: MIXER DE ÁUDIO TTS -->
    <div id="tab-mixer" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🎛️ Mixer de Masterização & Equalização TTS</div>
            <div class="card-desc">Ajuste os graves, médios, agudos, velocidade e volume da voz neural.</div>
          </div>
          <button id="testMixerAudioBtn" class="btn-web-app" style="background:#0284c7;">▶️ Testar Áudio</button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
          <div>
            <h4 style="font-size:13px; color:#38bdf8; margin-bottom:12px;">Equalizador de 3 Vias</h4>
            <div class="slider-row">
              <span>Graves (Bass)</span>
              <span id="bassVal" style="font-family:monospace; color:#38bdf8;">0 dB</span>
            </div>
            <input type="range" id="ttsBass" min="-10" max="10" step="1" value="0" />

            <div class="slider-row">
              <span>Médios (Mid)</span>
              <span id="midVal" style="font-family:monospace; color:#38bdf8;">0 dB</span>
            </div>
            <input type="range" id="ttsMid" min="-10" max="10" step="1" value="0" />

            <div class="slider-row">
              <span>Agudos (Treble)</span>
              <span id="trebleVal" style="font-family:monospace; color:#38bdf8;">0 dB</span>
            </div>
            <input type="range" id="ttsTreble" min="-10" max="10" step="1" value="0" />
          </div>

          <div>
            <h4 style="font-size:13px; color:#38bdf8; margin-bottom:12px;">Dinâmica e Velocidade</h4>
            <div class="slider-row">
              <span>Velocidade de Fala</span>
              <span id="speedVal" style="font-family:monospace; color:#38bdf8;">1.0x</span>
            </div>
            <input type="range" id="ttsSpeed" min="0.5" max="2.0" step="0.1" value="1.0" />

            <div class="slider-row">
              <span>Volume Master</span>
              <span id="volVal" style="font-family:monospace; color:#38bdf8;">100%</span>
            </div>
            <input type="range" id="ttsVolume" min="0" max="1" step="0.05" value="1.0" />

            <div class="slider-row">
              <span>Pitch (Semitons)</span>
              <span id="pitchVal" style="font-family:monospace; color:#38bdf8;">0 st</span>
            </div>
            <input type="range" id="ttsPitch" min="-6" max="6" step="1" value="0" />
          </div>
        </div>
      </div>
    </div>

    <!-- ABA 3: ESTÚDIO DE INSTRUÇÕES E VOZES -->
    <div id="tab-prompts" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🎙️ Seleção de Vozes Google Gemini</div>
            <div class="card-desc">Escolha o timbre neural padrão utilizado nas narrações de texto e de tela.</div>
          </div>
        </div>

        <div class="voice-btn-grid">
          <div class="voice-pill active" data-voice="Kore">Kore<br><small style="font-size:10px; font-weight:normal; opacity:0.8;">Equilibrada e Clara</small></div>
          <div class="voice-pill" data-voice="Puck">Puck<br><small style="font-size:10px; font-weight:normal; opacity:0.8;">Dinâmica e Jovem</small></div>
          <div class="voice-pill" data-voice="Charon">Charon<br><small style="font-size:10px; font-weight:normal; opacity:0.8;">Grave e Serena</small></div>
          <div class="voice-pill" data-voice="Fenrir">Fenrir<br><small style="font-size:10px; font-weight:normal; opacity:0.8;">Forte e Firme</small></div>
          <div class="voice-pill" data-voice="Zephyr">Zephyr<br><small style="font-size:10px; font-weight:normal; opacity:0.8;">Suave e Acolhedora</small></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🧠 Prompts de Sistema para os Modelos de IA</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="margin:0;">1. Instruções para o Sistema Narrador (TTS - Ctrl + B)</label>
              <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="preset-btn" data-target="narratorInstruction" data-val="Você é um narrador natural e expressivo. Leia o texto com dicção impecável, ritmo equilibrado e entonação humana. Converta siglas e números para forma falada fluida." style="background:#1e293b; border:1px solid #334155; color:#93c5fd; font-size:10px; padding:2px 6px; border-radius:4px; cursor:pointer;">Humano & Equilibrado</button>
                <button class="preset-btn" data-target="narratorInstruction" data-val="Você é um âncora de notícias. Narre o texto de maneira dinâmica, ágil, objetiva e com alta clareza de articulação, mantendo cadência profissional." style="background:#1e293b; border:1px solid #334155; color:#93c5fd; font-size:10px; padding:2px 6px; border-radius:4px; cursor:pointer;">Locutor Jornalístico</button>
                <button class="preset-btn" data-target="narratorInstruction" data-val="Você é um assistente de leitura acessível. Fale com ritmo sereno, pausas adequadas nas vírgulas e pontos, facilitando a compreensão integral de pessoas com deficiência visual." style="background:#1e293b; border:1px solid #334155; color:#93c5fd; font-size:10px; padding:2px 6px; border-radius:4px; cursor:pointer;">Acessibilidade</button>
              </div>
            </div>
            <textarea id="narratorInstruction" placeholder="Ex: Você é um narrador natural e expressivo..."></textarea>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="margin:0;">2. Instruções para o Sistema Transcritor (STT - Pause / Break)</label>
              <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="preset-btn" data-target="transcriberInstruction" data-val="Transcreva com fidelidade absoluta o áudio recebido. Aplique pontuação correta (pontos, vírgulas, interrogações), remova gagueiras e vícios de linguagem comuns. Retorne estritamente o texto transcrito, sem introduções ou observações." style="background:#1e293b; border:1px solid #334155; color:#fca5a5; font-size:10px; padding:2px 6px; border-radius:4px; cursor:pointer;">Fidelidade Absoluta</button>
                <button class="preset-btn" data-target="transcriberInstruction" data-val="Transcreva o áudio organizando as ideias principais em tópicos limpos caso o orador dite múltiplos pontos. Remova hesitações e garanta concordância gramatical impecável." style="background:#1e293b; border:1px solid #334155; color:#fca5a5; font-size:10px; padding:2px 6px; border-radius:4px; cursor:pointer;">Ditado em Tópicos</button>
              </div>
            </div>
            <textarea id="transcriberInstruction" placeholder="Ex: Transcreva com fidelidade absoluta o áudio recebido..."></textarea>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="margin:0;">3. Instruções para o Gravador de Tela / Gemini Vision (Ctrl + Shift + Arrastar)</label>
              <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="preset-btn" data-target="visionInstruction" data-val="Analise detalhadamente a imagem capturada da tela com o Google Lens. Se contiver texto, transcreva ou leia-o com máxima precisão. Se contiver gráficos, resuma os pontos centrais de forma concisa e natural para ser ouvida." style="background:#1e293b; border:1px solid #334155; color:#c4b5fd; font-size:10px; padding:2px 6px; border-radius:4px; cursor:pointer;">Texto & OCR</button>
                <button class="preset-btn" data-target="visionInstruction" data-val="Descreva detalhadamente a composição visual, cores principais, layout e conteúdo escrito do recorte da tela para permitir que uma pessoa com deficiência visual compreenda perfeitamente o contexto." style="background:#1e293b; border:1px solid #334155; color:#c4b5fd; font-size:10px; padding:2px 6px; border-radius:4px; cursor:pointer;">Audiodescrição</button>
              </div>
            </div>
            <textarea id="visionInstruction" placeholder="Ex: Analise detalhadamente a imagem capturada da tela com o Google Lens..."></textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- ABA 4: HISTÓRICO DE TRANSCRIÇÕES -->
    <div id="tab-history" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📜 Registro Recente de Transcrições da Extensão</div>
            <div class="card-desc">Histórico das falas transcritas nos campos e seus respectivos alvos.</div>
          </div>
          <button id="clearHistoryBtn" class="tab-btn" style="background:#334155; color:#fca5a5;">Limpar Histórico</button>
        </div>

        <div id="historyTableContainer" style="font-size:12px;">
          <div style="text-align:center; padding:32px; color:#64748b;">Nenhuma transcrição gravada ainda. Pressione Pause em qualquer página para começar.</div>
        </div>
      </div>
    </div>

    <!-- ABA 5: CONEXÃO E API -->
    <div id="tab-connection" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div class="card-title">⚙️ Endereço do Servidor STT&TTS de Satiro & Credenciais</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <label>URL do Servidor STT&TTS de Satiro Backend</label>
            <div style="display:flex; gap:10px;">
              <input type="text" id="serverUrl" placeholder="http://localhost:3000" />
              <button id="testPingBtn" class="btn-web-app" style="white-space:nowrap; background:#334155;">Testar Conexão</button>
            </div>
            <span id="pingResult" style="font-size:11px; margin-top:4px; display:block; color:#94a3b8;">Status da API: Pronto</span>
          </div>

          <div>
            <label>Chave de API Gemini (<code style="color:#f59e0b;">.env</code> / Manual)</label>
            <div style="display:flex; gap:10px; margin-bottom:8px;">
              <input type="password" id="apiKey" placeholder="Cole sua chave Gemini (ou use a lida de .env)" style="flex:1;" />
              <button type="button" id="toggleApiKeyBtn" class="btn-web-app" style="white-space:nowrap; background:#334155;">Mostrar</button>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; font-family:monospace; font-size:13px; color:#34d399; background:#020617; padding:10px 14px; border-radius:8px; border:1px solid #1e293b;" id="optionsMaskedKeyDisplay">
              <span>AIzaSy... (.env)</span>
              <span style="font-size:10px; background:#065f46; color:#a7f3d0; padding:2px 8px; border-radius:4px; font-family:sans-serif;">LIDO DA RAIZ</span>
            </div>
            <span style="font-size:11px; margin-top:4px; display:block; color:#94a3b8;">Chave de API do Google Gemini para síntese neural e transcrição.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ABA 6: ATUALIZAÇÃO VIA GITHUB -->
    <div id="tab-github" class="tab-content">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">🔄 Atualização do Aplicativo e Extensão via GitHub</div>
            <div class="card-desc">Verifique o status do repositório, baixe as novidades direto do GitHub e reinicie o Google Chrome.</div>
          </div>
          <span id="optGitBadge" class="shortcut-badge" style="color:#a5b4fc; background:#312e81; font-size:12px; padding:4px 10px;">main</span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:20px;">
          <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">Commit Local Atual</div>
            <div id="optGitCommit" style="font-family:monospace; font-size:13px; font-weight:700; color:#38bdf8;">Consultando...</div>
          </div>
          <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">Árvore de Arquivos</div>
            <div id="optGitDirty" style="font-family:monospace; font-size:13px; font-weight:700; color:#34d399;">Limpa (Clean)</div>
          </div>
          <div style="background:#1e293b; border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">Atualizações no Remoto</div>
            <div id="optGitUpdates" style="font-family:monospace; font-size:13px; font-weight:700; color:#94a3b8;">Aguardando verificação</div>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px;">
          <button id="optCheckGitBtn" class="btn-web-app" style="background:#1e293b; border-color:#334155;">
            <span>🔍 1. Verificar Status Git</span>
          </button>
          <button id="optPullGitBtn" class="btn-web-app" style="background:#2563eb;">
            <span>⬇️ 2. Baixar &amp; Instalar do GitHub</span>
          </button>
          <button id="optReloadExtBtn" class="btn-web-app" style="background:#059669; border-color:#10b981;">
            <span>🔄 3. Recarregar Extensão</span>
          </button>
          <button id="optRestartChromeBtn" class="btn-web-app" style="background:#b45309; border-color:#d97706;">
            <span>🚀 4. Reiniciar Google Chrome</span>
          </button>
        </div>

        <div>
          <label>Terminal de Operações Git &amp; Instalação</label>
          <div id="optGitTerminalLogs" style="background:#020617; border:1px solid #1e293b; border-radius:10px; padding:14px; font-family:monospace; font-size:12px; color:#94a3b8; height:180px; overflow-y:auto; line-height:1.5;">
            <div>[$] Terminal pronto para operações Git.</div>
            <div>[$] Clique em "Verificar Status Git" para consultar o repositório remoto.</div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <div id="toastSaved" class="toast-saved">
    <span>✓ Configuração salva automaticamente no navegador!</span>
  </div>

  <script src="options.js"></script>
</body>
</html>
`
  },
  {
    filename: 'options.js',
    path: 'options.js',
    description: 'Lógica das opções com microfone, ping em tempo real e abertura segura de abas',
    language: 'javascript',
    content: `// Options Logic - STT&TTS de Satiro (100% Autônomo com Modo Direto)
(function initOptions() {
  const fields = [
    'apiKey',
    'narratorInstruction',
    'transcriberInstruction',
    'visionInstruction',
    'ttsSpeed',
    'ttsVolume',
    'ttsBass',
    'ttsMid',
    'ttsTreble',
    'ttsPitch'
  ];

  const defaults = {
    serverUrl: '',
    apiKey: 'AQ.Ab8RN6JkFmDWomdC0iYpYX9D787FfbLg5_Vpn0uyY_U8USm50Q',
    ttsVoice: 'Kore',
    narratorInstruction: 'Você é um narrador natural e expressivo. Leia o texto com dicção impecável, ritmo equilibrado e entonação humana.',
    transcriberInstruction: 'Transcreva com fidelidade absoluta o áudio recebido. Aplique pontuação correta e remova vícios de linguagem comuns.',
    visionInstruction: 'Analise detalhadamente a imagem capturada da tela com o Google Lens. Se contiver texto, transcreva ou leia-o com máxima precisão.',
    ttsSpeed: 1.0,
    ttsVolume: 1.0,
    ttsBass: 0,
    ttsMid: 0,
    ttsTreble: 0,
    ttsPitch: 0
  };

  let currentSettings = { ...defaults };
  let selectedVoice = 'Kore';
  let activeAudio = null;

  function isQuotaOrNotFoundError(err) {
    if (!err) return false;
    const msg = String(err.message || err.error?.message || (typeof err === 'object' ? JSON.stringify(err) : err) || '').toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('404') ||
      msg.includes('503') ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted') ||
      msg.includes('exceeded your current quota') ||
      msg.includes('rate limit') ||
      msg.includes('unavailable') ||
      msg.includes('high demand') ||
      msg.includes('not_found') ||
      msg.includes('not found') ||
      msg.includes('não retornou fluxo') ||
      msg.includes('não gerou áudio') ||
      msg.includes('nenhum áudio gerado') ||
      msg.includes('não retornou áudio')
    );
  }

  // PCM to WAV helper
  function pcmToWav(pcm16Data, sampleRate = 24000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = new ArrayBuffer(44 + pcm16Data.length);
    const view = new DataView(buffer);

    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcm16Data.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, pcm16Data.length, true);

    new Uint8Array(buffer, 44).set(pcm16Data);
    return buffer;
  }

  const OPTIONS_TTS_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-tts-preview'
  ];

  const OPTIONS_STT_CASCADE = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite'
  ];

  async function executeOptionsFallback(taskName, cascade, action) {
    let lastErr = null;
    const modelList = cascade || OPTIONS_TTS_CASCADE;
    for (let m = 0; m < modelList.length; m++) {
      const model = modelList[m];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await action(model);
        } catch (err) {
          lastErr = err;
          console.warn('[Options ' + taskName + '] Tentativa ' + attempt + '/3 no modelo ' + model + ' falhou:', err);
          
          if (isQuotaOrNotFoundError(err)) {
            console.warn('[Options ' + taskName + '] Cota excedida ou modelo ' + model + ' indisponível. Alternando para o próximo modelo...');
            break;
          }

          if (attempt < 3) {
            await new Promise(r => setTimeout(r, attempt * 400));
          } else {
            break;
          }
        }
      }
      console.warn('[Options ' + taskName + '] Tentativas concluídas no modelo ' + model + '. Alternando para o próximo modelo.');
    }
    let msg = lastErr?.message || 'Erro desconhecido';
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      msg = 'Cota do plano gratuito do Gemini excedida (429). Aguarde alguns segundos ou insira sua própria chave Gemini.';
    }
    throw new Error('Falha em todos os modelos de fallback (' + modelList.join(' -> ') + '): ' + msg);
  }

  async function directGeminiTTS(text, apiKey, voiceOverride = null, instOverride = null) {
    if (!apiKey) throw new Error('Chave Gemini não configurada');

    let baseVoiceName = voiceOverride || selectedVoice || 'Kore';
    let voiceInstruction = instOverride || '';

    // Resolução se for voz customizada
    const customList = currentSettings.customVoices || [];
    const customMatch = customList.find(cv => cv.id === baseVoiceName || cv.name === baseVoiceName);
    if (customMatch) {
      baseVoiceName = customMatch.baseVoice || 'Kore';
      if (customMatch.instruction) {
        voiceInstruction = customMatch.instruction;
      }
    }

    let fullPrompt = currentSettings.narratorInstruction || 'Narre com tom natural e fluida articulação em português:';
    if (voiceInstruction) {
      fullPrompt = '[Instrução da Voz: ' + voiceInstruction + ']\\n' + fullPrompt;
    }
    fullPrompt += '\\n' + text;

    // Cascade com política de 3 tentativas por modelo no TTS
    return await executeOptionsFallback('TTS', OPTIONS_TTS_CASCADE, async (modelName) => {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + apiKey;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: baseVoiceName
                }
              }
            }
          }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || ('Erro Gemini TTS: ' + res.status));
      }

      const data = await res.json();
      const candidate = data.candidates?.[0]?.content?.parts?.[0];
      const audioData = candidate?.inlineData?.data;
      if (!audioData) throw new Error('Nenhum áudio gerado pelo modelo ' + modelName);

      const binaryStr = atob(audioData);
      const pcmBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        pcmBytes[i] = binaryStr.charCodeAt(i);
      }
      const wavBuffer = pcmToWav(pcmBytes, 24000);
      const wavBytes = new Uint8Array(wavBuffer);
      let wavBinary = '';
      for (let i = 0; i < wavBytes.length; i++) {
        wavBinary += String.fromCharCode(wavBytes[i]);
      }
      return btoa(wavBinary);
    });
  }

  async function directGeminiSTT(base64Audio, apiKey, instruction) {
    if (!apiKey) throw new Error('Chave Gemini não configurada');
    const cleanBase64 = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
    const promptText = instruction || 'Transcreva com precisão o que foi dito neste áudio em português.';

    // Cascade com política de 3 tentativas por modelo no STT
    return await executeOptionsFallback('STT', OPTIONS_STT_CASCADE, async (modelName) => {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + apiKey;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: 'audio/webm', data: cleanBase64 } },
              { text: promptText }
            ]
          }]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || ('Erro Gemini STT: ' + res.status));
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error('Transcrição vazia retornada por ' + modelName);
      return text;
    });
  }

  function speakFallbackNative(text, speed = 1.0) {
    if (!window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = speed;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  let shortcutNarrateConfig = { ctrl: true, shift: false, alt: false, code: 'KeyB', key: 'b', display: 'Ctrl + B' };
  let shortcutRecordConfig = { ctrl: false, shift: false, alt: false, code: 'Pause', key: 'Pause', display: 'Pause' };

  function formatShortcut(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    let keyName = e.key === ' ' ? 'Espaço' : e.key;
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(keyName)) return '';
    parts.push(keyName.toUpperCase());
    return parts.join(' + ');
  }

  function attachShortcutListener(inputId, configObj) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      e.preventDefault();
      const display = formatShortcut(e);
      if (!display) return;
      configObj.ctrl = e.ctrlKey;
      configObj.shift = e.shiftKey;
      configObj.alt = e.altKey;
      configObj.code = e.code;
      configObj.key = e.key;
      configObj.display = display;
      el.value = display;
      saveSettingsAuto();
    });
  }

  attachShortcutListener('shortcutNarrateDisplay', shortcutNarrateConfig);
  attachShortcutListener('shortcutRecordDisplay', shortcutRecordConfig);

  // Navegação por Abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.target);
      if (target) target.classList.add('active');
    });
  });

  function maskKey(key) {
    if (!key) return 'Nenhuma chave (.env)';
    if (key.length <= 10) return key.substring(0, 3) + '***' + key.substring(key.length - 2);
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
  }

  function updateOptionsKeyDisplay(key) {
    const el = document.getElementById('optionsMaskedKeyDisplay');
    if (el) {
      el.innerHTML = '<span>' + maskKey(key) + ' (.env)</span><span style="font-size:10px; background:#065f46; color:#a7f3d0; padding:2px 8px; border-radius:4px; font-family:sans-serif;">LIDO DA RAIZ</span>';
    }
  }

  // Carregar dados salvos
  chrome.storage.sync.get(defaults, (items) => {
    currentSettings = Object.assign(currentSettings, items);
    fields.forEach(field => {
      const el = document.getElementById(field);
      if (el) {
        el.value = items[field] !== undefined ? items[field] : defaults[field];
      }
    });

    if (items.apiKey) {
      updateOptionsKeyDisplay(items.apiKey);
    }

    // Tentar carregar da rota /api/get-key
    const rawSUrl = items.serverUrl || document.getElementById('serverUrl')?.value || 'http://localhost:3000';
    const sUrl = rawSUrl.endsWith('/') ? rawSUrl.slice(0, -1) : rawSUrl;
    fetch(sUrl + '/api/get-key').then(r => r.json()).then(data => {
      if (data.fullKey) {
        currentSettings.apiKey = data.fullKey;
        chrome.storage.sync.set({ apiKey: data.fullKey });
        const keyInp = document.getElementById('apiKey');
        if (keyInp && !keyInp.value) keyInp.value = data.fullKey;
        updateOptionsKeyDisplay(data.fullKey);
      }
    }).catch(() => {});

    if (items.ttsVoice) {
      selectedVoice = items.ttsVoice;
      updateVoiceButtonsUI(selectedVoice);
    }
    
    if (items.shortcutNarrateConfig) shortcutNarrateConfig = items.shortcutNarrateConfig;
    if (items.shortcutRecordConfig) shortcutRecordConfig = items.shortcutRecordConfig;
    
    const snEl = document.getElementById('shortcutNarrateDisplay');
    if (snEl) snEl.value = shortcutNarrateConfig.display;
    
    const srEl = document.getElementById('shortcutRecordDisplay');
    if (srEl) srEl.value = shortcutRecordConfig.display;

    updateLabels();
  });

  function updateLabels() {
    const sEl = document.getElementById('ttsSpeed');
    const vEl = document.getElementById('ttsVolume');
    const bEl = document.getElementById('ttsBass');
    const mEl = document.getElementById('ttsMid');
    const tEl = document.getElementById('ttsTreble');
    const pEl = document.getElementById('ttsPitch');

    if (sEl) document.getElementById('speedVal').innerText = parseFloat(sEl.value).toFixed(1) + 'x';
    if (vEl) document.getElementById('volVal').innerText = Math.round(parseFloat(vEl.value) * 100) + '%';
    if (bEl) document.getElementById('bassVal').innerText = bEl.value + ' dB';
    if (mEl) document.getElementById('midVal').innerText = mEl.value + ' dB';
    if (tEl) document.getElementById('trebleVal').innerText = tEl.value + ' dB';
    if (pEl) document.getElementById('pitchVal').innerText = pEl.value + ' st';
  }

  function updateVoiceButtonsUI(voice) {
    document.querySelectorAll('.voice-pill').forEach(pill => {
      if (pill.dataset.voice === voice) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }

  document.querySelectorAll('.voice-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      selectedVoice = pill.dataset.voice;
      updateVoiceButtonsUI(selectedVoice);
      saveSettingsAuto();
    });
  });

  let autoSaveTimeout = null;
  function saveSettingsAuto() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      const toSave = { 
        ttsVoice: selectedVoice,
        shortcutNarrateConfig: shortcutNarrateConfig,
        shortcutRecordConfig: shortcutRecordConfig
      };
      fields.forEach(field => {
        const el = document.getElementById(field);
        if (el) {
          toSave[field] = el.type === 'range' ? parseFloat(el.value) : el.value;
        }
      });

      chrome.storage.sync.set(toSave, () => {
        showToast();
      });
    }, 250);
  }

  fields.forEach(field => {
    const el = document.getElementById(field);
    if (el) {
      el.addEventListener('input', () => {
        updateLabels();
        saveSettingsAuto();
      });
    }
  });

  function showToast() {
    const toast = document.getElementById('toastSaved');
    if (toast) {
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 2000);
    }
  }

  // Toggle visualização de chave
  const toggleKeyBtn = document.getElementById('toggleApiKeyBtn');
  const apiKeyEl = document.getElementById('apiKey');
  if (toggleKeyBtn && apiKeyEl) {
    toggleKeyBtn.addEventListener('click', () => {
      if (apiKeyEl.type === 'password') {
        apiKeyEl.type = 'text';
        toggleKeyBtn.innerText = 'Ocultar';
      } else {
        apiKeyEl.type = 'password';
        toggleKeyBtn.innerText = 'Mostrar';
      }
    });
  }

  // Permitir Microfone
  const grantMicBtn = document.getElementById('optGrantMicBtn');
  if (grantMicBtn) {
    grantMicBtn.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        grantMicBtn.innerText = '✓ Microfone Liberado!';
        grantMicBtn.style.background = '#065f46';
      } catch (err) {
        alert('Erro ao liberar microfone: ' + err.message);
      }
    });
  }

  // Gravação por microfone nos campos de teste do options.html (Modo Direto sem Servidor)
  document.querySelectorAll('.opt-field-mic-btn').forEach(btn => {
    let micRecording = false;
    let localRecorder = null;
    let chunks = [];

    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);

      if (!micRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          chunks = [];
          localRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

          localRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          localRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            btn.innerText = 'Transcrevendo...';

            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const apiKey = document.getElementById('apiKey')?.value || '';
              const transcriberInstruction = document.getElementById('transcriberInstruction')?.value || '';

              try {
                if (!apiKey) {
                  throw new Error('Insira sua Chave Gemini na aba Conexão e API para transcrever!');
                }

                const text = await directGeminiSTT(reader.result, apiKey, transcriberInstruction);
                if (text && targetEl) {
                  const val = targetEl.value || '';
                  targetEl.value = (val ? val + ' ' : '') + text;
                  btn.innerText = '✓ Inserido!';
                  setTimeout(() => { btn.innerText = '🎙️ Ditar aqui'; }, 2000);
                } else {
                  alert('Nenhuma fala detectada pelo modelo.');
                  btn.innerText = '🎙️ Ditar aqui';
                }
              } catch (err) {
                alert(err.message || 'Erro ao transcrever.');
                btn.innerText = '🎙️ Ditar aqui';
              }
            };
            reader.readAsDataURL(blob);
          };

          localRecorder.start();
          micRecording = true;
          btn.innerText = '⏹️ Parar Gravação';
          btn.style.background = '#dc2626';
          btn.style.color = '#fff';

        } catch (err) {
          alert('Microfone bloqueado ou indisponível: ' + err.message);
        }

      } else {
        micRecording = false;
        btn.style.background = '#1e293b';
        btn.style.color = '#38bdf8';
        if (localRecorder && localRecorder.state !== 'inactive') {
          localRecorder.stop();
        }
      }
    });
  });

  // Testar Mixer Áudio (Modo Direto sem Servidor)
  const testAudioBtn = document.getElementById('testMixerAudioBtn');
  if (testAudioBtn) {
    testAudioBtn.addEventListener('click', async () => {
      const apiKey = document.getElementById('apiKey')?.value || '';
      const speed = parseFloat(document.getElementById('ttsSpeed')?.value || '1.0');
      const volume = parseFloat(document.getElementById('ttsVolume')?.value || '1.0');
      const sampleText = \`STT&TTS de Satiro: Demonstração de voz neural na velocidade \${speed.toFixed(1)}x com timbre \${selectedVoice}.\`;

      testAudioBtn.innerText = 'Sintetizando...';
      testAudioBtn.disabled = true;

      try {
        if (apiKey) {
          const wavBase64 = await directGeminiTTS(sampleText, apiKey);
          if (activeAudio) activeAudio.pause();
          activeAudio = new Audio('data:audio/wav;base64,' + wavBase64);
          activeAudio.playbackRate = speed;
          activeAudio.volume = volume;
          activeAudio.onended = () => {
            testAudioBtn.innerText = '▶️ Testar Áudio';
            testAudioBtn.disabled = false;
          };
          activeAudio.play();
        } else {
          speakFallbackNative(sampleText, speed);
          testAudioBtn.innerText = '▶️ Testar Áudio';
          testAudioBtn.disabled = false;
        }
      } catch (err) {
        speakFallbackNative(sampleText, speed);
        testAudioBtn.innerText = '▶️ Testar Áudio';
        testAudioBtn.disabled = false;
      }
    });
  }

  // Presets Rápidos de Instrução
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetVal = btn.dataset.val;
      const targetEl = document.getElementById(targetId);
      if (targetEl && targetVal) {
        targetEl.value = targetVal;
        saveSettingsAuto();
      }
    });
  });

  // Ping Teste Gemini Direto ou Servidor Backend
  const testPingBtn = document.getElementById('testPingBtn');
  const pingResult = document.getElementById('pingResult');
  if (testPingBtn && pingResult) {
    testPingBtn.addEventListener('click', async () => {
      pingResult.innerText = 'Validando conexão com Servidor & .env...';
      pingResult.style.color = '#38bdf8';

      try {
        const rawSUrl = document.getElementById('serverUrl')?.value || currentSettings.serverUrl || 'http://localhost:3000';
        const sUrl = rawSUrl.endsWith('/') ? rawSUrl.slice(0, -1) : rawSUrl;
        const res = await fetch(sUrl + '/api/get-key');
        const data = await res.json();
        if (data.hasKey && data.fullKey) {
          currentSettings.apiKey = data.fullKey;
          chrome.storage.sync.set({ apiKey: data.fullKey });
          const keyInp = document.getElementById('apiKey');
          if (keyInp && !keyInp.value) keyInp.value = data.fullKey;
          updateOptionsKeyDisplay(data.fullKey);
          pingResult.innerText = '✓ Chave obtida de .env (' + data.maskedKey + ') e Servidor Operacional!';
          pingResult.style.color = '#34d399';
        } else {
          pingResult.innerText = '⚠️ Servidor respondeu mas nenhuma chave foi encontrada em .env.';
          pingResult.style.color = '#f59e0b';
        }
      } catch (err) {
        pingResult.innerText = '❌ Falha ao alcançar o servidor backend: ' + err.message;
        pingResult.style.color = '#f87171';
      }
    });
  }

  // Histórico
  function loadHistoryTable() {
    chrome.storage.local.get({ sessionTranscriptions: [] }, (res) => {
      const container = document.getElementById('historyTableContainer');
      if (!container) return;
      const list = res.sessionTranscriptions || [];
      if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:32px; color:#64748b;">Nenhuma transcrição gravada ainda. Pressione Pause em qualquer página para começar.</div>';
        return;
      }

      container.innerHTML = \`
        <table style="width:100%; border-collapse:collapse; text-align:left;">
          <thead>
            <tr style="border-bottom:1px solid #334155; color:#94a3b8; font-size:11px;">
              <th style="padding:8px;">HORA</th>
              <th style="padding:8px;">ALVO</th>
              <th style="padding:8px;">TEXTO TRANSCRITO</th>
              <th style="padding:8px; text-align:right;">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            \${list.map(item => \`
              <tr style="border-bottom:1px solid #1e293b;">
                <td style="padding:10px 8px; font-family:monospace; color:#94a3b8;">\${item.time}</td>
                <td style="padding:10px 8px;"><span style="background:rgba(16,185,129,0.15); color:#34d399; padding:2px 6px; border-radius:4px; font-weight:600;">\${item.target}</span></td>
                <td style="padding:10px 8px; color:#f1f5f9;">"\${item.text}"</td>
                <td style="padding:10px 8px; text-align:right;">
                  <button class="opt-copy-btn" data-text="\${item.text}" style="background:#1e293b; border:1px solid #475569; color:#93c5fd; padding:3px 8px; border-radius:5px; cursor:pointer; font-size:11px;">Copiar</button>
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      \`;

      document.querySelectorAll('.opt-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          navigator.clipboard.writeText(e.target.dataset.text);
          e.target.innerText = '✓ Copiado';
          setTimeout(() => { e.target.innerText = 'Copiar'; }, 1500);
        });
      });
    });
  }
  loadHistoryTable();

  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chrome.storage.local.set({ sessionTranscriptions: [] }, () => {
        loadHistoryTable();
      });
    });
  }

  // ==========================================
  // LÓGICA DE ATUALIZAÇÃO VIA GITHUB (OPTIONS)
  // ==========================================
  const optCheckGitBtn = document.getElementById('optCheckGitBtn');
  const optPullGitBtn = document.getElementById('optPullGitBtn');
  const optReloadExtBtn = document.getElementById('optReloadExtBtn');
  const optRestartChromeBtn = document.getElementById('optRestartChromeBtn');
  const optGitCommit = document.getElementById('optGitCommit');
  const optGitDirty = document.getElementById('optGitDirty');
  const optGitUpdates = document.getElementById('optGitUpdates');
  const optGitBadge = document.getElementById('optGitBadge');
  const optGitTerminalLogs = document.getElementById('optGitTerminalLogs');

  function addOptGitLog(msg) {
    if (!optGitTerminalLogs) return;
    const line = document.createElement('div');
    line.innerText = msg;
    line.style.padding = '2px 0';
    optGitTerminalLogs.appendChild(line);
    optGitTerminalLogs.scrollTop = optGitTerminalLogs.scrollHeight;
  }

  function getOptionsServerBaseUrl() {
    const raw = currentSettings.serverUrl || 'http://localhost:3000';
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  // Consulta direta à API Pública do GitHub com detecção inteligente de repositório e branch
  async function fetchDirectGitHubStatusOptions() {
    const candidateRepos = [
      'pinguelanarosca/STT-TTSByAlee',
      'pinguelanarosca/STT-TTSByAlee1'
    ];
    const candidateBranches = ['main', 'master'];

    let lastError = null;

    for (const repo of candidateRepos) {
      for (const branch of candidateBranches) {
        try {
          const res = await fetch('https://api.github.com/repos/' + repo + '/commits/' + branch, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
          });
          if (res.ok) {
            const data = await res.json();
            const sha = data.sha ? data.sha.substring(0, 7) : branch;
            const msg = data.commit?.message ? data.commit.message.split('\\n')[0] : 'Último commit';
            const author = data.commit?.author?.name || 'GitHub';
            const date = data.commit?.author?.date ? new Date(data.commit.author.date).toLocaleString('pt-BR') : '';

            return {
              isGitRepo: true,
              branch: branch,
              currentCommit: sha,
              commitDate: date,
              commitMessage: msg,
              author: author,
              remoteUrl: 'https://github.com/' + repo,
              repoName: repo,
              dirty: false,
              hasUpdates: true,
              source: 'github_api'
            };
          } else if (res.status === 404) {
            lastError = new Error('Repositório ou branch não encontrada (' + repo + '@' + branch + ')');
          } else {
            lastError = new Error('GitHub API HTTP ' + res.status);
          }
        } catch (e) {
          lastError = e;
        }
      }
    }

    throw lastError || new Error('Não foi possível conectar ao GitHub');
  }

  async function checkGitStatusInOptions() {
    if (!optCheckGitBtn) return;
    optCheckGitBtn.disabled = true;
    optCheckGitBtn.innerText = 'Consultando...';
    addOptGitLog('[$] Consultando status no GitHub (pinguelanarosca/STT-TTSByAlee)...');

    try {
      let data = null;

      // 1. Tentar API direta do GitHub
      try {
        data = await fetchDirectGitHubStatusOptions();
        addOptGitLog('✓ Conectado diretamente à API pública do GitHub!');
      } catch (ghErr) {
        // 2. Fallback para servidor local se houver
        const sUrl = getOptionsServerBaseUrl();
        try {
          const res = await fetch(sUrl + '/api/git/status', {
            headers: { 'Accept': 'application/json' }
          });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            data = await res.json();
            addOptGitLog('✓ Conectado ao servidor local.');
          }
        } catch {}

        if (!data) {
          throw new Error(ghErr.message || 'Verifique sua conexão com a internet');
        }
      }

      if (data) {
        if (optGitBadge) optGitBadge.innerText = (data.repoName ? data.repoName.split('/')[1] : '') + ' (' + (data.branch || 'main') + ')';
        if (optGitCommit) optGitCommit.innerText = data.currentCommit || 'N/A';
        if (optGitDirty) {
          optGitDirty.innerText = data.source === 'github_api' ? 'Sincronizado com GitHub' : (data.dirty ? (data.modifiedFiles?.length + ' alterados') : 'Limpa (Clean)');
          optGitDirty.style.color = '#34d399';
        }
        if (optGitUpdates) {
          optGitUpdates.innerText = 'Disponível no GitHub';
          optGitUpdates.style.color = '#34d399';
        }

        addOptGitLog('📌 Último Commit: ' + data.currentCommit + ' - "' + (data.commitMessage || '') + '"');
        if (data.commitDate) {
          addOptGitLog('📅 Data: ' + data.commitDate + (data.author ? ' (' + data.author + ')' : ''));
        }
        addOptGitLog('⚡ Dica: execute "atualizar_extensao.bat" na pasta da extensão para atualizar tudo automaticamente!');
      }
    } catch (err) {
      addOptGitLog('❌ Falha ao consultar status: ' + (err.message || err));
      addOptGitLog('💡 Para atualizar sem internet ou API, execute atualizar_extensao.bat na pasta.');
    } finally {
      optCheckGitBtn.disabled = false;
      optCheckGitBtn.innerText = '🔍 1. Verificar Status Git';
    }
  }

  if (optCheckGitBtn) {
    optCheckGitBtn.addEventListener('click', checkGitStatusInOptions);
  }

  if (optPullGitBtn) {
    optPullGitBtn.addEventListener('click', async () => {
      optPullGitBtn.disabled = true;
      optPullGitBtn.innerText = 'Baixando...';
      addOptGitLog('[$] Iniciando download da versão mais recente do GitHub...');

      let pullSucceeded = false;

      // 1. Tentar pull via servidor local se existir
      try {
        const sUrl = getOptionsServerBaseUrl();
        const res = await fetch(sUrl + '/api/git/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ repoUrl: 'https://github.com/pinguelanarosca/STT-TTSByAlee1', branch: 'main', force: false, runInstall: true })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data.steps) {
            data.steps.forEach(s => {
              addOptGitLog((s.success ? '✓ ' : '⚠️ ') + s.name + ' (' + s.durationMs + 'ms)' + (s.output ? ': ' + s.output.slice(0, 80) : ''));
            });
          }
          if (data.success) {
            pullSucceeded = true;
            addOptGitLog('✓ ' + data.message);
          }
        }
      } catch (e) {
        // Servidor local não respondeu, usaremos download direto
      }

      // 2. Se não estiver rodando servidor local, abrir download direto do ZIP do GitHub
      if (!pullSucceeded) {
        const repoZipUrl = 'https://github.com/pinguelanarosca/STT-TTSByAlee1/archive/refs/heads/main.zip';
        addOptGitLog('📥 Baixando pacote ZIP atualizado do repositório GitHub...');
        chrome.tabs.create({ url: repoZipUrl });
        addOptGitLog('✓ Download do arquivo ZIP iniciado!');
        addOptGitLog('⚡ Após descompactar na pasta da extensão, clique no botão 3 (Recarregar Extensão).');
      }

      optPullGitBtn.disabled = false;
      optPullGitBtn.innerText = '⬇️ 2. Baixar & Instalar do GitHub';
    });
  }

  if (optReloadExtBtn) {
    optReloadExtBtn.addEventListener('click', () => {
      addOptGitLog('[$] Recarregando extensão...');
      setTimeout(() => {
        chrome.runtime.reload();
      }, 150);
    });
  }

  if (optRestartChromeBtn) {
    optRestartChromeBtn.addEventListener('click', async () => {
      addOptGitLog('[$] Enviando sinal de reinício ao Chrome...');
      try {
        const sUrl = getOptionsServerBaseUrl();
        fetch(sUrl + '/api/git/restart-chrome', { method: 'POST' }).catch(() => {});
      } catch {}

      try {
        navigator.clipboard.writeText('chrome://restart');
        addOptGitLog('✓ URL "chrome://restart" copiada para a área de transferência.');
      } catch {}

      try {
        chrome.tabs.create({ url: 'chrome://restart' });
      } catch {
        addOptGitLog('Abra uma nova aba e digite chrome://restart para reiniciar o navegador.');
      }
    });
  }
})();
`
  },
  {
    filename: 'README.md',
    path: 'README.md',
    description: 'Guia de instalação da extensão no Google Chrome e uso dos atalhos',
    language: 'markdown',
    content: `# STT&TTS de Satiro - Extensão Google Chrome TTS & STT

## Como Instalar no Google Chrome:

1. Baixe o arquivo **vocallens-chrome-extension.zip** clicando no botão **"Baixar Extensão (.ZIP)"**.
2. Descompacte o arquivo ZIP em uma pasta do seu computador.
3. Abra o Google Chrome e digite na barra de endereços: \`chrome://extensions/\`
4. No canto superior direito da página, ative a chave **"Modo do desenvolvedor"** (Developer Mode).
5. Se você já tinha uma versão anterior do STT&TTS de Satiro instalada, clique em **"Remover"** nela para limpar resquícios antigos.
6. Clique no botão **"Carregar sem compactação"** (Load Unpacked) no canto superior esquerdo.
7. Selecione a pasta onde você descompactou os arquivos (a pasta que contém o \`manifest.json\`).
8. Pronto! O ícone do STT&TTS de Satiro aparecerá na sua barra de extensões no canto superior direito. Fixe-o na barra de ferramentas clicando no ícone do quebra-cabeça.

---

## Como Usar o Popup da Extensão:

- Dê um clique sobre o ícone do **STT&TTS de Satiro** na barra de ferramentas do Chrome (no canto superior direito).
- O popup abrirá com:
  - **Botão Central de Microfone**: Clique nele para ditar e o Chrome solicitará automaticamente a permissão de microfone se ainda não foi concedida!
  - **Console de Áudio TTS**: Altere vozes (*Kore*, *Puck*, *Charon*, *Fenrir*, *Zephyr*), controle a velocidade (0.8x a 1.5x) e teste a narração em tempo real.
  - **Histórico**: Veja todas as suas falas transcritas recentemente e copie-as com 1 clique.
  - **Botão "Abrir Painel Completo na Web"**: Abre a aplicação web em tela cheia diretamente no seu navegador.
  - **Botão "Abrir Central de Opções Completa"**: Abre a tela com o Laboratório de Testes e Mixer Equalizador.

---

## Como Utilizar os Atalhos em Qualquer Página da Web:

> **Importante:** Abra qualquer site comum (ex: Wikipedia, Google, YouTube, G1, etc.) para testar os atalhos. Extensões do Chrome não têm permissão para rodar em páginas internas como \`chrome://extensions\` ou abas em branco novas.

- **Ctrl + B**: Selecione qualquer texto em qualquer página web e tecle \`Ctrl + B\`. O Gemini TTS narrará a seleção com voz humana em tempo real!
- **Ctrl + Shift + Arrastar (Google Lens)**: Segure as teclas \`Ctrl\` e \`Shift\` juntas e arraste com o botão esquerdo do mouse para abrir a moldura Google Lens sobre qualquer gráfico, diagrama, foto ou texto. Ao soltar, a foto é analisada e narrada!
- **Pause / Break** OU **Ctrl + Shift + Espaço**: Clique em qualquer campo de texto (\`<input>\` ou \`<textarea>\`) e tecle \`Pause / Break\` (ou \`Ctrl + Shift + Espaço\` para notebooks sem a tecla Pause). O microfone gravará sua fala e transcreverá diretamente no campo!

---

## Atualização Automática via GitHub:

1. **Acesse o Menu "Atualização via GitHub"**: Disponível na barra de navegação da aplicação web, no Popup da extensão e na Central de Opções.
2. **Passo 1 - Verificar Status Git**: Consulta o status atual da branch local, commit SHA e se há alterações ou novos commits no GitHub.
3. **Passo 2 - Baixar e Instalar**: Executa \`git fetch\`, \`git pull\` e compilação/instalação das dependências automaticamente.
4. **Passo 3 - Recarregar Extensão**: Recarrega a extensão em execução para carregar os novos scripts instantaneamente.
5. **Passo 4 - Reiniciar Google Chrome**: Envia sinal de reinício e abre \`chrome://restart\` para reiniciar o navegador mantendo todas as abas abertas.
`
  },
  {
    filename: 'atualizar_extensao.bat',
    path: 'atualizar_extensao.bat',
    description: 'Script executável para Windows que atualiza todos os arquivos da extensão com 1 clique diretamente do GitHub',
    language: 'bat',
    content: `@echo off
chcp 65001 >nul
title Atualizador Automatico - STT e TTS de Satiro
echo ================================================================
echo       STT & TTS de Satiro - Atualizador do Repositorio GitHub
echo ================================================================
echo.
echo [1/3] Verificando conexao com o GitHub (pinguelanarosca/STT-TTSByAlee)...
echo.

where git >nul 2>nul
if %errorlevel% == 0 (
    echo [2/3] Executando git pull para atualizar os arquivos...
    git pull origin main
    if %errorlevel% neq 0 (
        git pull origin master
    )
) else (
    echo [2/3] Git nao detectado no PATH do Windows.
    echo Baixando e extraindo arquivos atualizados via PowerShell...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $repo = 'pinguelanarosca/STT-TTSByAlee'; Write-Host 'Conectando ao GitHub...'; Invoke-WebRequest -Uri ('https://github.com/' + $repo + '/archive/refs/heads/main.zip') -OutFile 'update_temp.zip'; Expand-Archive -Path 'update_temp.zip' -DestinationPath 'temp_ext' -Force; Get-ChildItem -Path 'temp_ext\\*' | ForEach-Object { Copy-Item -Path ($_.FullName + '\\*') -Destination '.' -Recurse -Force }; Remove-Item 'update_temp.zip' -Force; Remove-Item 'temp_ext' -Recurse -Force; Write-Host '✓ Arquivos substituidos com sucesso!'"
)

echo.
echo [3/3] Atualizacao concluida com sucesso!
echo ================================================================
echo Proximo passo:
echo  1. Abra o Google Chrome.
echo  2. Clique no icone do STT & TTS de Satiro.
echo  3. Na aba 'Atualizacao', clique em '3. Recarregar Extensao'.
echo ================================================================
echo.
pause
`
  },
  {
    filename: 'atualizar_extensao.sh',
    path: 'atualizar_extensao.sh',
    description: 'Script bash para Linux/macOS para atualizar os arquivos da extensão diretamente do GitHub',
    language: 'bash',
    content: `#!/usr/bin/env bash
echo "================================================================"
echo "      STT & TTS de Satiro - Atualizador do Repositório GitHub   "
echo "================================================================"
echo ""
echo "[1/3] Verificando repositório GitHub..."
if command -v git &> /dev/null; then
    echo "[2/3] Executando git pull origin main..."
    git pull origin main || git pull origin master
else
    echo "[2/3] Baixando pacote mais recente via curl..."
    curl -L "https://github.com/pinguelanarosca/STT-TTSByAlee/archive/refs/heads/main.zip" -o update_temp.zip
    unzip -o update_temp.zip -d temp_ext
    cp -r temp_ext/*/* .
    rm -rf update_temp.zip temp_ext
fi
echo ""
echo "[3/3] ✓ Extensão atualizada com sucesso!"
echo "Abra o Chrome e clique em 'Recarregar Extensão' no menu da extensão."
`
  }
];
