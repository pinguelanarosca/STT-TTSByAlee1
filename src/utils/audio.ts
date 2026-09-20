/**
 * Converte PCM 16-bit Mono (ex: retornado pelo Gemini TTS a 24kHz) em áudio WAV com cabeçalho RIFF.
 */
export function pcmBase64ToWavBlob(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Blob {
  // Limpar prefixo data URI se houver
  const cleanBase64 = pcmBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, '');
  const binaryString = atob(cleanBase64);
  const pcmBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmBytes[i] = binaryString.charCodeAt(i);
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLength = pcmBytes.length;
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Escrever dados PCM
  const wavBytes = new Uint8Array(wavBuffer);
  wavBytes.set(pcmBytes, 44);

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Toca áudio a partir de dados base64 (trata tanto WAV/MP3 nativos quanto PCM bruto de TTS).
 */
export function playAudioFromBase64(base64Audio: string, mimeType?: string): HTMLAudioElement {
  let finalUrl = '';
  if (mimeType?.includes('pcm') || (!base64Audio.startsWith('data:') && !base64Audio.startsWith('blob:'))) {
    try {
      const blob = pcmBase64ToWavBlob(base64Audio);
      finalUrl = URL.createObjectURL(blob);
    } catch {
      finalUrl = base64Audio.startsWith('data:') ? base64Audio : `data:${mimeType || 'audio/wav'};base64,${base64Audio}`;
    }
  } else {
    finalUrl = base64Audio.startsWith('data:') ? base64Audio : `data:${mimeType || 'audio/wav'};base64,${base64Audio}`;
  }

  const audio = new Audio(finalUrl);
  audio.play().catch(err => {
    console.warn('Erro ao reproduzir áudio:', err);
  });
  return audio;
}

/**
 * Utilitário para conversão de Blob em base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
