// Popup Logic - STT&TTS de Satiro (100% Autônomo com Modo Direto Gemini)
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
    apiKey: '',
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

  function uint8ArrayToBase64(bytes) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([bytes]);
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-tts',
    'gemini-2.5-pro-preview-tts',
    'gemini-2.5-flash-lite-preview-tts'
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
      fullPrompt = '[Instrução da Voz: ' + voiceInstruction + ']\n' + fullPrompt;
    }
    fullPrompt += '\n' + text;
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
      return await uint8ArrayToBase64(new Uint8Array(wavBuffer));
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
    maybeAutoFetchKey();
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

  // Tentar obter chave automaticamente do servidor apenas se ainda não configurada
  function maybeAutoFetchKey() {
    if (!currentSettings.apiKey || !currentSettings.apiKey.trim()) {
      const rawServer = currentSettings.serverUrl || 'http://localhost:3000';
      const serverBase = rawServer.endsWith('/') ? rawServer.slice(0, -1) : rawServer;
      fetch(serverBase + '/api/get-key').then(r => r.json()).then(data => {
        if (!currentSettings.apiKey || !currentSettings.apiKey.trim()) {
          if (data.fullKey) {
            currentSettings.apiKey = data.fullKey;
            chrome.storage.sync.set({ apiKey: data.fullKey });
            if (quickApiKeyInput && !quickApiKeyInput.value) {
              quickApiKeyInput.value = data.fullKey;
            }
            updateApiKeyUI();
          }
        }
      }).catch(() => {});
    }
  }

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
        container.innerHTML = `
          <div style="text-align:center; padding:24px 8px; color:#64748b; font-size:11px;">
            Nenhuma fala gravada ainda.<br>Pressione Pause em qualquer campo para transcrever.
          </div>
        `;
        return;
      }

      container.innerHTML = list.slice(0, 8).map(item => `
        <div class="history-item">
          <div class="history-top">
            <span style="color:#34d399; font-weight:600;">${item.target || 'Campo'}</span>
            <span>${item.time}</span>
          </div>
          <div class="history-text">"${item.text}"</div>
          <div class="history-btns">
            <button class="btn-h-copy" data-text="${item.text}">Copiar</button>
            <button class="btn-h-tts" data-text="${item.text}">Ouvir TTS</button>
          </div>
        </div>
      `).join('');

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
        container.innerHTML = `
          <div style="text-align:center; padding:24px 8px; color:#64748b; font-size:11px;">
            Nenhuma requisição de API registrada ainda.<br>Realize uma ação para visualizar a telemetria.
          </div>
        `;
        return;
      }

      container.innerHTML = logs.slice(0, 10).map(item => `
        <div class="api-log-item">
          <div class="api-log-header">
            <span style="font-weight:700; color:#f8fafc;">${item.action} • ${item.model}</span>
            <span class="api-log-badge ${item.success ? 'success' : 'error'}">${item.statusCode} ${item.statusText}</span>
          </div>
          <div class="api-log-sub">
            <span style="color:#38bdf8;">${item.latencyMs}ms | ${item.payloadInfo}</span>
            <span>${item.timeFormatted}</span>
          </div>
          ${item.errorMessage ? `<div style="color:#f87171; font-size:9px; margin-top:2px;">Erro: ${item.errorMessage}</div>` : ''}
        </div>
      `).join('');
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
            const msg = data.commit?.message ? data.commit.message.split('\n')[0] : 'Último commit';
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
