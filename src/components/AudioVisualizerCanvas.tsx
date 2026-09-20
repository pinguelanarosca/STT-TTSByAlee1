import React, { useRef, useEffect, useState } from 'react';
import { Activity, BarChart2 } from 'lucide-react';
import { audioMixer } from '../utils/audioMixerEngine';

interface AudioVisualizerCanvasProps {
  isPlaying: boolean;
}

export const AudioVisualizerCanvas: React.FC<AudioVisualizerCanvasProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visualizerMode, setVisualizerMode] = useState<'wave' | 'frequency'>('frequency');
  const [vuLevels, setVuLevels] = useState<{ left: number; right: number; peak: boolean }>({
    left: 0,
    right: 0,
    peak: false,
  });

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = audioMixer.getAnalyser();
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      // Dark studio visualizer canvas background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Subtle horizontal grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (analyser && isPlaying) {
        if (visualizerMode === 'frequency') {
          analyser.getByteFrequencyData(dataArray);

          // Calculate approximate VU level
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          const leftNormalized = Math.min(100, Math.round((avg / 128) * 95));
          const rightNormalized = Math.min(100, Math.round((avg / 128) * (88 + (Math.random() * 12 - 6))));
          setVuLevels({
            left: leftNormalized,
            right: rightNormalized,
            peak: leftNormalized > 92,
          });

          // Draw frequency bars with gradient
          const barCount = Math.min(48, bufferLength);
          const barWidth = (width / barCount) - 2;

          for (let i = 0; i < barCount; i++) {
            const rawVal = dataArray[i];
            const percent = rawVal / 255;
            const barHeight = Math.max(3, percent * (height - 12));
            const x = i * (barWidth + 2);
            const y = height - barHeight;

            // Gradient: Emerald -> Cyan -> Rose on peaks
            const gradient = ctx.createLinearGradient(0, height, 0, 0);
            gradient.addColorStop(0, '#10b981');
            gradient.addColorStop(0.65, '#06b6d4');
            gradient.addColorStop(0.9, '#3b82f6');
            gradient.addColorStop(1, '#f43f5e');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
            ctx.fill();

            // Little cap on top of bar
            if (percent > 0.3) {
              ctx.fillStyle = percent > 0.85 ? '#fda4af' : '#93c5fd';
              ctx.fillRect(x, Math.max(0, y - 2), barWidth, 1.5);
            }
          }
        } else {
          // Waveform Oscilloscope mode
          analyser.getByteTimeDomainData(dataArray);

          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#38bdf8';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#0284c7';
          ctx.beginPath();

          const sliceWidth = width / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.lineTo(width, height / 2);
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset
        }
      } else {
        // Idle ambient line
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        setVuLevels((prev) => ({
          left: Math.max(0, prev.left - 6),
          right: Math.max(0, prev.right - 6),
          peak: false,
        }));
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, visualizerMode]);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-inner">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
            Monitor de Espectro & Nível Master
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[11px]">
          <button
            type="button"
            onClick={() => setVisualizerMode('frequency')}
            className={`px-2 py-1 rounded flex items-center gap-1 transition ${
              visualizerMode === 'frequency'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="h-3 w-3" />
            <span>FFT</span>
          </button>
          <button
            type="button"
            onClick={() => setVisualizerMode('wave')}
            className={`px-2 py-1 rounded flex items-center gap-1 transition ${
              visualizerMode === 'wave'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="h-3 w-3" />
            <span>Onda</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Visualizer Canvas */}
        <div className="sm:col-span-9 relative w-full h-32 rounded-lg overflow-hidden border border-slate-800/80 bg-slate-950">
          <canvas
            ref={canvasRef}
            width={480}
            height={128}
            className="w-full h-full block"
          />
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] text-slate-500 font-medium">Aguardando reprodução de áudio...</span>
            </div>
          )}
        </div>

        {/* Dual VU Meter (L & R) */}
        <div className="sm:col-span-3 bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between h-32 text-[10px]">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[9px]">
            <span>VU dB</span>
            <span className={`px-1 rounded text-[8px] font-bold ${vuLevels.peak ? 'bg-rose-500 text-white' : 'text-slate-500'}`}>
              CLIP
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 py-1 flex-1">
            {/* Left Channel */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-20 bg-slate-950 rounded-full border border-slate-800 p-0.5 flex flex-col justify-end overflow-hidden">
                <div
                  className="w-full rounded-full transition-all duration-75"
                  style={{
                    height: `${vuLevels.left}%`,
                    background: vuLevels.left > 85 ? '#f43f5e' : vuLevels.left > 65 ? '#eab308' : '#10b981',
                  }}
                />
              </div>
              <span className="text-slate-400 font-bold">L</span>
            </div>

            {/* Right Channel */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-3 h-20 bg-slate-950 rounded-full border border-slate-800 p-0.5 flex flex-col justify-end overflow-hidden">
                <div
                  className="w-full rounded-full transition-all duration-75"
                  style={{
                    height: `${vuLevels.right}%`,
                    background: vuLevels.right > 85 ? '#f43f5e' : vuLevels.right > 65 ? '#eab308' : '#10b981',
                  }}
                />
              </div>
              <span className="text-slate-400 font-bold">R</span>
            </div>
          </div>

          <div className="flex justify-between text-[9px] text-slate-500 font-mono px-1">
            <span>-36</span>
            <span>-12</span>
            <span>0dB</span>
          </div>
        </div>
      </div>
    </div>
  );
};
