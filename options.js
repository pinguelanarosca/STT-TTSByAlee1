// Options Logic - STT&TTS de Satiro (100% Autônomo com Modo Direto)
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
    apiKey: '',
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

  function uint8ArrayToBase64(bytes) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([bytes]);
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const OPTIONS_TTS_CASCADE = [
    'gemini-3.1-flash-tts-preview',
    'gemini-2.5-flash-tts',
    'gemini-2.5-pro-preview-tts',
    'gemini-2.5-flash-lite-preview-tts'
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
      fullPrompt = '[Instrução da Voz: ' + voiceInstruction + ']\n' + fullPrompt;
    }
    fullPrompt += '\n' + text;

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
      return await uint8ArrayToBase64(new Uint8Array(wavBuffer));
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

    // Só buscar da rota /api/get-key se NÃO houver chave já configurada
    if (!items.apiKey || !String(items.apiKey).trim()) {
      const rawSUrl = items.serverUrl || document.getElementById('serverUrl')?.value || 'http://localhost:3000';
      const sUrl = rawSUrl.endsWith('/') ? rawSUrl.slice(0, -1) : rawSUrl;
      fetch(sUrl + '/api/get-key').then(r => r.json()).then(data => {
        if (!currentSettings.apiKey || !String(currentSettings.apiKey).trim()) {
          if (data.fullKey) {
            currentSettings.apiKey = data.fullKey;
            chrome.storage.sync.set({ apiKey: data.fullKey });
            const keyInp = document.getElementById('apiKey');
            if (keyInp && !keyInp.value) keyInp.value = data.fullKey;
            updateOptionsKeyDisplay(data.fullKey);
          }
        }
      }).catch(() => {});
    }

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
      const sampleText = `STT&TTS de Satiro: Demonstração de voz neural na velocidade ${speed.toFixed(1)}x com timbre ${selectedVoice}.`;

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

      container.innerHTML = `
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
            ${list.map(item => `
              <tr style="border-bottom:1px solid #1e293b;">
                <td style="padding:10px 8px; font-family:monospace; color:#94a3b8;">${item.time}</td>
                <td style="padding:10px 8px;"><span style="background:rgba(16,185,129,0.15); color:#34d399; padding:2px 6px; border-radius:4px; font-weight:600;">${item.target}</span></td>
                <td style="padding:10px 8px; color:#f1f5f9;">"${item.text}"</td>
                <td style="padding:10px 8px; text-align:right;">
                  <button class="opt-copy-btn" data-text="${item.text}" style="background:#1e293b; border:1px solid #475569; color:#93c5fd; padding:3px 8px; border-radius:5px; cursor:pointer; font-size:11px;">Copiar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

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
