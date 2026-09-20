# STT&TTS de Satiro - Extensão Google Chrome TTS & STT

## Como Instalar no Google Chrome:

1. Baixe o arquivo **vocallens-chrome-extension.zip** clicando no botão **"Baixar Extensão (.ZIP)"**.
2. Descompacte o arquivo ZIP em uma pasta do seu computador.
3. Abra o Google Chrome e digite na barra de endereços: `chrome://extensions/`
4. No canto superior direito da página, ative a chave **"Modo do desenvolvedor"** (Developer Mode).
5. Se você já tinha uma versão anterior do STT&TTS de Satiro instalada, clique em **"Remover"** nela para limpar resquícios antigos.
6. Clique no botão **"Carregar sem compactação"** (Load Unpacked) no canto superior esquerdo.
7. Selecione a pasta onde você descompactou os arquivos (a pasta que contém o `manifest.json`).
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

> **Importante:** Abra qualquer site comum (ex: Wikipedia, Google, YouTube, G1, etc.) para testar os atalhos. Extensões do Chrome não têm permissão para rodar em páginas internas como `chrome://extensions` ou abas em branco novas.

- **Ctrl + B**: Selecione qualquer texto em qualquer página web e tecle `Ctrl + B`. O Gemini TTS narrará a seleção com voz humana em tempo real!
- **Ctrl + Shift + Arrastar (Google Lens)**: Segure as teclas `Ctrl` e `Shift` juntas e arraste com o botão esquerdo do mouse para abrir a moldura Google Lens sobre qualquer gráfico, diagrama, foto ou texto. Ao soltar, a foto é analisada e narrada!
- **Pause / Break** OU **Ctrl + Shift + Espaço**: Clique em qualquer campo de texto (`<input>` ou `<textarea>`) e tecle `Pause / Break` (ou `Ctrl + Shift + Espaço` para notebooks sem a tecla Pause). O microfone gravará sua fala e transcreverá diretamente no campo!

---

## Atualização Automática via GitHub:

1. **Acesse o Menu "Atualização via GitHub"**: Disponível na barra de navegação da aplicação web, no Popup da extensão e na Central de Opções.
2. **Passo 1 - Verificar Status Git**: Consulta o status atual da branch local, commit SHA e se há alterações ou novos commits no GitHub.
3. **Passo 2 - Baixar e Instalar**: Executa `git fetch`, `git pull` e compilação/instalação das dependências automaticamente.
4. **Passo 3 - Recarregar Extensão**: Recarrega a extensão em execução para carregar os novos scripts instantaneamente.
5. **Passo 4 - Reiniciar Google Chrome**: Envia sinal de reinício e abre `chrome://restart` para reiniciar o navegador mantendo todas as abas abertas.
