
import { useState, useCallback } from 'react';
import { generateSpeech } from '../services/geminiService.ts';

// Helper functions for audio decoding, must be defined outside the hook
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export const useTTS = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playSpeech = useCallback(async (text: string) => {
    if (!text || isPlaying) return;

    setIsPlaying(true);
    setError(null);

    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const decodedBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedBytes, outputAudioContext, 24000, 1);
        
        const source = outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outputAudioContext.destination);
        source.start();

        source.onended = () => {
          setIsPlaying(false);
          outputAudioContext.close();
        };
      } else {
        throw new Error("No audio data received.");
      }
    } catch (err) {
      console.error("TTS Error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      setIsPlaying(false);
    }
  }, [isPlaying]);

  return { playSpeech, isPlaying, error };
};