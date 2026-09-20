// Background Service Worker - STT&TTS de Satiro
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
