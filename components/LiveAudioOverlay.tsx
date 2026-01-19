
import React, { useState, useEffect, useRef } from 'react';
import { Character, VoiceProfile, VoiceName } from '../types';
import { startLiveSession, createPcmBlob, decodeAudioData } from '../services/geminiService';

interface LiveAudioOverlayProps {
  character: Character;
  voiceProfile?: VoiceProfile;
  onClose: () => void;
}

const LiveAudioOverlay: React.FC<LiveAudioOverlayProps> = ({ character, voiceProfile, onClose }) => {
  const [isConnecting, setIsConnecting] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState<{ text: string, isUser: boolean } | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    let scriptProcessor: ScriptProcessorNode | null = null;
    let micSource: MediaStreamAudioSourceNode | null = null;

    const initSession = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        outputNodeRef.current = audioContextRef.current.createGain();
        outputNodeRef.current.connect(audioContextRef.current.destination);

        const baseVoice = voiceProfile?.baseVoice || VoiceName.Kore;
        const systemInstruction = `${character.persona}。注意你的说话风格：${voiceProfile?.stylePrompt || '自然'}`;

        const sessionPromise = startLiveSession(systemInstruction, baseVoice, {
          onAudio: async (base64) => {
            if (!audioContextRef.current || !outputNodeRef.current) return;
            
            const buffer = await decodeAudioData(base64, audioContextRef.current, 24000);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(outputNodeRef.current);
            
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            
            sourcesRef.current.add(source);
            source.onended = () => sourcesRef.current.delete(source);
          },
          onTranscription: (text, isUser) => {
            setTranscription({ text, isUser });
            if (isUser) setIsListening(true);
            else setIsListening(false);
          },
          onInterrupted: () => {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        });

        sessionRef.current = await sessionPromise;
        setIsConnecting(false);

        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        micSource = inputCtx.createMediaStreamSource(stream);
        scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
        
        scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);
          sessionRef.current?.sendRealtimeInput({ media: pcmBlob });
        };

        micSource.connect(scriptProcessor);
        scriptProcessor.connect(inputCtx.destination);

      } catch (err) {
        console.error("Failed to init live audio", err);
        onClose();
      }
    };

    initSession();

    return () => {
      sessionRef.current?.close();
      scriptProcessor?.disconnect();
      micSource?.disconnect();
      audioContextRef.current?.close();
    };
  }, [character, voiceProfile]);

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-between p-8 text-white">
      <div className="w-full flex justify-between items-center">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="px-4 py-1 bg-pink-600/20 text-pink-500 rounded-full text-sm font-medium border border-pink-500/30">
          实时语音通话
        </div>
        <div className="w-8" />
      </div>

      <div className="flex flex-col items-center">
        <div className="relative mb-8">
          <div className={`absolute inset-0 bg-pink-600/20 rounded-full blur-3xl transition-transform duration-1000 ${isListening ? 'scale-150' : 'scale-100'}`} />
          <img 
            src={character.avatar} 
            alt={character.name} 
            className={`w-48 h-48 rounded-full object-cover border-4 border-pink-500 relative z-10 transition-transform duration-500 ${isListening ? 'scale-105' : 'scale-100'}`} 
          />
        </div>
        
        <h2 className="text-3xl font-bold mb-2">{character.name}</h2>
        <p className="text-gray-400 animate-pulse">
          {isConnecting ? "正在建立神经连接..." : isListening ? "正在聆听..." : "正在回应..."}
        </p>
      </div>

      <div className="w-full max-w-xl text-center min-h-[100px]">
        {transcription && (
          <p className={`text-xl font-medium transition-opacity duration-300 ${transcription.isUser ? 'text-gray-400' : 'text-pink-400'}`}>
            "{transcription.text}"
          </p>
        )}
      </div>

      <div className="flex items-center space-x-12">
        <button className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        </button>
        <button 
          onClick={onClose}
          className="p-6 bg-red-600 hover:bg-red-700 rounded-full shadow-2xl shadow-red-600/40 transition-transform active:scale-90"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <button className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
        </button>
      </div>
    </div>
  );
};

export default LiveAudioOverlay;
