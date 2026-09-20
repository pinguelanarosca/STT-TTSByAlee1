// Content Script - STT&TTS de Satiro (100% Autônomo com Modo Direto Gemini & HUD Aprimorado)
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
    apiKey: '',
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

    hud.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="vocallens-hud-icon">${icon}</span>
        <span class="vocallens-hud-text">${text}</span>
      </div>
    `;

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

    hud.innerHTML = `
      <div class="vocallens-hud-inner">
        <div class="vocallens-hud-header" style="justify-content: space-between;">
          <div style="display:flex; align-items:center; gap:6px;">
            ${iconHtml}
            <strong class="vocallens-hud-title">${title}</strong>
          </div>
          <span class="vocallens-hud-stage-badge">${stageBadge}</span>
        </div>
        ${subtitle ? `<div class="vocallens-hud-sub">${subtitle}</div>` : ''}
        ${details ? `<div class="vocallens-hud-details">${details}</div>` : ''}
      </div>
    `;

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
    hud.innerHTML = `
      <div class="vocallens-hud-inner">
        <div class="vocallens-hud-header">
          <span class="vocallens-hud-dot-pulse"></span>
          <strong class="vocallens-hud-title">Gravando Voz no Microfone...</strong>
          <span class="vocallens-hud-counter" id="vocallens-hud-sec">0s</span>
        </div>
        <div class="vocallens-hud-sub">
          ${hasTargetField ? '🎯 Alvo identificado no campo. Fale agora e pressione Pause ou Ctrl+Shift+Espaço ao terminar.' : '🎙️ Fale agora com clareza. Pressione Pause ou Ctrl+Shift+Espaço para finalizar.'}
        </div>
        <div class="vocallens-hud-stage-footer">
          <span>STT [1/4] • Captura de Áudio</span>
        </div>
      </div>
    `;

    clearInterval(hudRecordingTimer);
    hudRecordingTimer = setInterval(() => {
      hudSeconds++;
      const el = document.getElementById('vocallens-hud-sec');
      if (el) el.innerText = `${hudSeconds}s`;
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
      return `<button class="vocallens-sp-btn ${isActive ? 'active' : ''}" data-speed="${sp}">${sp}x</button>`;
    }).join('');

    hud.innerHTML = `
      <div class="vocallens-nhud-header">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="vocallens-nhud-pulse"></span>
          <strong class="vocallens-nhud-title">Narrando com Gemini (${settings.ttsVoice || 'Kore'})</strong>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="vocallens-hud-stage-badge">TTS [3/3]</span>
          <button id="vocallens-nhud-close" class="vocallens-nhud-close-btn" title="Fechar">&times;</button>
        </div>
      </div>

      <div class="vocallens-nhud-snippet">"${snippet}"</div>

      <div class="vocallens-nhud-controls">
        <button id="vocallens-nhud-playpause" class="vocallens-nhud-btn-action">⏸️ Pausar</button>
        <button id="vocallens-nhud-stop" class="vocallens-nhud-btn-stop">⏹️ Parar</button>
      </div>

      <div class="vocallens-nhud-sliders">
        <div class="vocallens-nhud-row">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>Velocidade de Fala:</span>
            <strong id="vocallens-speed-val" style="color:#38bdf8; font-family:monospace;">${currentSpd}x</strong>
          </div>
          <div class="vocallens-speed-pills">
            ${pillsHtml}
          </div>
        </div>

        <div class="vocallens-nhud-row">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>Volume da Voz:</span>
            <strong id="vocallens-vol-val" style="color:#38bdf8; font-family:monospace;">${Math.round((settings.ttsVolume ?? 1.0) * 100)}%</strong>
          </div>
          <input type="range" id="vocallens-vol-slider" min="0" max="1" step="0.05" value="${settings.ttsVolume ?? 1.0}" class="vocallens-slider" />
        </div>
      </div>
    `;

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
      hud.innerHTML = `
        <div class="vocallens-hud-inner">
          <div class="vocallens-hud-header" style="justify-content: space-between;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="vocallens-hud-check">✓</span>
              <strong class="vocallens-hud-title">Texto Inserido com Sucesso!</strong>
            </div>
            <span class="vocallens-hud-stage-badge">STT [4/4]</span>
          </div>
          <div class="vocallens-hud-preview">"${transcribedText.length > 70 ? transcribedText.substring(0, 67) + '...' : transcribedText}"</div>
          <div class="vocallens-hud-sub">Inserido no elemento: <strong style="color:#6ee7b7;">${targetName}</strong></div>
        </div>
      `;
      setTimeout(() => hideHud(), 4000);
    } else {
      const snippet = transcribedText.length > 70 ? transcribedText.substring(0, 68) + '...' : transcribedText;
      hud.innerHTML = `
        <div class="vocallens-hud-inner">
          <div class="vocallens-hud-header" style="justify-content: space-between;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="vocallens-hud-check">✓</span>
              <strong class="vocallens-hud-title">Transcrição Concluída</strong>
            </div>
            <button id="vocallens-copy-btn" class="vocallens-hud-btn-copy">Copiar Texto</button>
          </div>
          <div class="vocallens-hud-preview">"${snippet}"</div>
          <div class="vocallens-hud-sub">Clique em qualquer campo para auto-digitar ou use o botão copiar.</div>
        </div>
      `;

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
        : `data:${mimeType};base64,${audioBase64}`;
      
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
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-tts',
    'gemini-2.5-pro-preview-tts',
    'gemini-2.5-flash-lite-preview-tts'
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
      fullInstruction = '[Instrução da Voz: ' + voiceInstruction + ']\n' + fullInstruction;
    }
    const prompt = fullInstruction + '\n' + text;
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
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
        const res = await fetch(`${settings.serverUrl}/api/tts`, {
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

    selectionBoxEl.innerHTML = `
      <div class="vocallens-lens-corner top-left"></div>
      <div class="vocallens-lens-corner top-right"></div>
      <div class="vocallens-lens-corner bottom-left"></div>
      <div class="vocallens-lens-corner bottom-right"></div>
      <div class="vocallens-lens-laser"></div>
      <div class="vocallens-lens-badge">
        <span class="vocallens-lens-dot"></span>
        <span>Google Lens • Solte para Fotografar e Analisar</span>
      </div>
    `;

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
          const res = await fetch(`${settings.serverUrl}/api/vision-tts`, {
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
                const res = await fetch(`${settings.serverUrl}/api/stt`, {
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
        const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
        const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length;
        const currentVal = el.value || '';
        const needsSpace = start > 0 && !currentVal.slice(start - 1, start).match(/\s/);
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
