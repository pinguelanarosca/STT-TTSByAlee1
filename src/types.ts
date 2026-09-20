export type RecordingStatus = 'idle' | 'recording' | 'sending' | 'processing' | 'ready' | 'error';

export interface CustomVoice {
  id: string;
  name: string;
  baseVoice: string;
  instruction: string;
}

export interface ExtensionSettings {
  serverUrl: string;
  apiKey?: string;
  ttsVoice: string; // 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' | custom voice ID
  customVoices?: CustomVoice[];
  narratorInstruction: string;
  transcriberInstruction: string;
  visionInstruction: string;
  enableCtrlB: boolean;
  enableCtrlDrag: boolean;
  enablePauseBreak: boolean;
  soundFeedback: boolean;
  // Mixer TTS parameters
  ttsSpeed?: number;
  ttsPitch?: number;
  ttsVolume?: number;
  ttsBass?: number;
  ttsMid?: number;
  ttsTreble?: number;
  ttsAmbience?: 'none' | 'rain' | 'vinyl' | 'coffee' | 'drone';
  ttsAmbienceVolume?: number;
}

export interface NarrationLog {
  id: string;
  timestamp: number;
  type: 'selection' | 'vision' | 'transcription';
  text: string;
  audioUrl?: string;
  durationMs?: number;
  targetField?: string;
  targetFieldName?: string;
  targetSelector?: string;
  targetTag?: string;
  wordCount?: number;
  charCount?: number;
  audioDurationSec?: number;
  previewImage?: string;
}

export interface ExtensionFileItem {
  filename: string;
  path: string;
  description: string;
  language: string;
  content: string;
}

export interface GitStatusData {
  success: boolean;
  isGitRepo: boolean;
  gitVersion: string;
  branch: string;
  currentCommit: string;
  commitDate?: string;
  commitMessage?: string;
  remoteUrl: string;
  dirty: boolean;
  modifiedFiles: string[];
  ahead?: number;
  behind?: number;
  remoteLatestCommit?: string;
  hasUpdates?: boolean;
  output: string;
  error?: string;
}

export interface GitUpdateStep {
  name: string;
  command: string;
  output: string;
  success: boolean;
  durationMs: number;
}

export interface GitUpdateResult {
  success: boolean;
  message: string;
  steps: GitUpdateStep[];
  commitsPulled?: string[];
  restartRequired?: boolean;
  error?: string;
}
