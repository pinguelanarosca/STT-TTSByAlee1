import JSZip from 'jszip';
import { EXTENSION_FILES } from '../data/extensionFiles';
import { ExtensionSettings } from '../types';

/**
 * Gera o ícone PNG oficial para a extensão Chrome baseado no design STT&TTS de Satiro
 */
export function createExtensionIcon(size: number): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Fundo transparente ou suavemente arredondado escuro para alto contraste na barra do Chrome
    const radius = size * 0.18;
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();

    // Borda sutil de destaque
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.stroke();

    // 1. Estrela Gemini 4 Pontas no Topo (Azul -> Violeta)
    const starCx = size * 0.5;
    const starCy = size * 0.26;
    const starOuter = size * 0.22;

    const starGrad = ctx.createLinearGradient(
      starCx - starOuter,
      starCy - starOuter,
      starCx + starOuter,
      starCy + starOuter
    );
    starGrad.addColorStop(0, '#38bdf8');
    starGrad.addColorStop(0.5, '#6366f1');
    starGrad.addColorStop(1, '#a855f7');

    ctx.save();
    ctx.fillStyle = starGrad;
    ctx.shadowColor = 'rgba(99, 102, 241, 0.6)';
    ctx.shadowBlur = size * 0.1;
    ctx.beginPath();
    ctx.moveTo(starCx, starCy - starOuter);
    ctx.quadraticCurveTo(starCx, starCy, starCx + starOuter, starCy);
    ctx.quadraticCurveTo(starCx, starCy, starCx, starCy + starOuter);
    ctx.quadraticCurveTo(starCx, starCy, starCx - starOuter, starCy);
    ctx.quadraticCurveTo(starCx, starCy, starCx, starCy - starOuter);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Microfone (Esquerda) inclinado em direção ao Alto-Falante
    const micX = size * 0.38;
    const micY = size * 0.54;
    ctx.save();
    ctx.translate(micX, micY);
    ctx.rotate(-Math.PI / 7); // ~25 graus de inclinação

    // Corpo metálico escuro do microfone
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.beginPath();
    ctx.roundRect(-size * 0.035, 0, size * 0.07, size * 0.15, size * 0.015);
    ctx.fill();
    ctx.stroke();

    // Cabeça do microfone (gaiola esférica com gradiente brilhante)
    const headGrad = ctx.createRadialGradient(-size * 0.01, -size * 0.04, 0, 0, -size * 0.04, size * 0.06);
    headGrad.addColorStop(0, '#f8fafc');
    headGrad.addColorStop(0.5, '#64748b');
    headGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, -size * 0.04, size * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Alto-falante de Som (Direita)
    const spkX = size * 0.63;
    const spkY = size * 0.54;
    const spkR = size * 0.11;

    ctx.save();
    // Aro externo metálico
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.beginPath();
    ctx.arc(spkX, spkY, spkR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cone central
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(spkX, spkY, spkR * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Domo central brilhante
    const domeGrad = ctx.createRadialGradient(spkX - spkR * 0.1, spkY - spkR * 0.1, 0, spkX, spkY, spkR * 0.35);
    domeGrad.addColorStop(0, '#38bdf8');
    domeGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(spkX, spkY, spkR * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Ondas Sonoras na Base
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(1.2, size * 0.035);
    ctx.lineCap = 'round';

    const waveY = size * 0.72;
    // Arcos esquerdos
    [0.12, 0.18, 0.24].forEach((rMult) => {
      ctx.beginPath();
      ctx.arc(size * 0.38, waveY, size * rMult, Math.PI * 0.55, Math.PI * 1.05);
      ctx.stroke();
    });

    // Arcos direitos
    [0.12, 0.18, 0.24].forEach((rMult) => {
      ctx.beginPath();
      ctx.arc(size * 0.62, waveY, size * rMult, -Math.PI * 0.05, Math.PI * 0.45);
      ctx.stroke();
    });
    ctx.restore();

    canvas.toBlob((blob) => {
      resolve(blob || new Blob([]));
    }, 'image/png');
  });
}

/**
 * Cria o arquivo .ZIP com todos os arquivos da extensão prontos para carregar no Chrome
 */
export async function generateExtensionZip(currentSettings?: Partial<ExtensionSettings>): Promise<Blob> {
  const zip = new JSZip();

  // Determina a URL real do servidor na nuvem ou local
  let effectiveServerUrl = currentSettings?.serverUrl;
  if (!effectiveServerUrl || effectiveServerUrl === 'http://localhost:3000' || effectiveServerUrl === '') {
    if (typeof window !== 'undefined' && window.location.origin) {
      effectiveServerUrl = window.location.origin;
    } else {
      effectiveServerUrl = 'http://localhost:3000';
    }
  }

  // Se for o ambiente interno de desenvolvimento do AI Studio (ais-dev-),
  // converte para a URL pública sem erro 403 (ais-pre-)
  if (effectiveServerUrl.includes('ais-dev-')) {
    effectiveServerUrl = effectiveServerUrl.replace('ais-dev-', 'ais-pre-');
  }

  // 1. Adicionar arquivos de código injetando a URL real do servidor
  for (const file of EXTENSION_FILES) {
    let content = file.content;
    
    // Substitui http://localhost:3000 pela URL real do servidor em todos os arquivos de configuration
    content = content.replace(/http:\/\/localhost:3000/g, effectiveServerUrl);

    // Se houver configurações customizadas de vozes ou instruções, injeta
    if (currentSettings?.ttsVoice && file.filename === 'options.js') {
      content = content.replace(
        "ttsVoice: 'Kore'",
        `ttsVoice: '${currentSettings.ttsVoice}'`
      );
    }

    zip.file(file.path, content);
  }

  // 2. Gerar e adicionar ícones
  const icon16 = await createExtensionIcon(16);
  const icon48 = await createExtensionIcon(48);
  const icon128 = await createExtensionIcon(128);

  const iconsFolder = zip.folder('icons');
  if (iconsFolder) {
    iconsFolder.file('icon16.png', icon16);
    iconsFolder.file('icon48.png', icon48);
    iconsFolder.file('icon128.png', icon128);
  }

  return await zip.generateAsync({ type: 'blob' });
}
