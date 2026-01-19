
import React, { useState, useRef, useEffect } from 'react';
import { Character, CharacterGroup, Message, VoiceProfile, AppSettings, Attachment, Sticker } from '../types';
import { getAiResponse, generateSpeech, decodeAudioData, generateImageViaComfy } from '../services/geminiService';

interface ChatWindowProps {
  mode: 'single' | 'group';
  sessionData: Character | CharacterGroup;
  voiceProfile?: VoiceProfile; 
  onBack: () => void;
  onOpenLive: () => void;
  onEdit?: () => void;
  appSettings: AppSettings;
  allCharacters: Character[]; 
  onUpdateGroup?: (group: CharacterGroup) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onUpdateCharacter?: (char: Character) => void;
}

const EMOJI_LIST = ['😊', '🥰', '😘', '🥵', '🥺', '😭', '😳', '🙄', '❤️', '🔥', '💦', '🍑', '🔞', '🤡', '👻'];

// --- SUBCOMPONENTS ---

const AudioBubble = ({ src, duration, themeColor }: { src: string, duration?: number, themeColor: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex items-center space-x-3 min-w-[120px] p-1 cursor-pointer select-none" onClick={togglePlay}>
       <div className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isPlaying ? 'bg-white text-black scale-110' : 'bg-white/20 text-white hover:bg-white/30'}`}>
          {isPlaying ? (
             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          ) : (
             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
          )}
       </div>
       <div className="flex flex-col gap-1">
          <div className="h-1.5 w-20 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
             <div className={`h-full rounded-full transition-all duration-300 ${isPlaying ? 'animate-[pulse_1s_infinite]' : ''}`} style={{ width: '60%', backgroundColor: themeColor }}></div>
          </div>
          <span className="text-[9px] text-white/70 font-mono tracking-wider">{duration ? `${Math.round(duration)}s` : 'Voice'}</span>
       </div>
    </div>
  );
};

const FormattedText = ({ text, highlight }: { text: string, highlight?: string }) => {
  if (!text) return null;
  const parts = text.split(/(\*[^*]+\*)/g);
  
  return (
    <span>
      {parts.map((part, i) => {
        let content: React.ReactNode = part;
        
        // Handle search highlight
        if (highlight && part.toLowerCase().includes(highlight.toLowerCase())) {
            const regex = new RegExp(`(${highlight})`, 'gi');
            const hParts = part.split(regex);
            content = (
                <span>
                    {hParts.map((hp, idx) => 
                        hp.toLowerCase() === highlight.toLowerCase() 
                        ? <span key={idx} className="bg-yellow-500/50 text-white px-0.5 rounded">{hp}</span> 
                        : hp
                    )}
                </span>
            );
        }

        if (part.startsWith('*') && part.endsWith('*')) {
          return <span key={i} className="text-white/60 italic font-light mx-0.5">{content}</span>;
        }
        return <span key={i}>{content}</span>;
      })}
    </span>
  );
};

const ChatWindow: React.FC<ChatWindowProps> = ({ mode, sessionData, voiceProfile, onBack, onOpenLive, onEdit, appSettings, allCharacters, onUpdateGroup, onUpdateSettings, onUpdateCharacter }) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try { const s = localStorage.getItem(`chat_${sessionData.id}`); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  const [showStickerPicker, setShowStickerPicker] = useState(false); 
  const [showRedPacket, setShowRedPacket] = useState(false);
  const [redPacketAmount, setRedPacketAmount] = useState('520');
  const [redPacketNote, setRedPacketNote] = useState('给最爱的你');
  const [emojiTab, setEmojiTab] = useState<'emoji' | 'sticker'>('sticker');
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [visualSource, setVisualSource] = useState<'camera' | 'screen' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Search & Filter State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'voice'>('all');
  const [searchMatches, setSearchMatches] = useState<string[]>([]); // Array of message IDs
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  // Background Menu State
  const [showBgMenu, setShowBgMenu] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem(`chat_${sessionData.id}`, JSON.stringify(messages));
    if (!showSearch) {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sessionData.id]);

  // Search logic with Filters
  useEffect(() => {
      const matches = messages.filter(m => {
          // Filter match
          if (filterType === 'image' && !m.imageUrl) return false;
          if (filterType === 'voice' && m.type !== 'voice') return false;
          
          // Query match
          if (searchQuery.trim()) {
              if (m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase())) return true;
              return false;
          }
          return filterType !== 'all'; // If only filter is set, match all of that type
      }).map(m => m.id);

      setSearchMatches(matches);
      setCurrentMatchIndex(matches.length > 0 ? matches.length - 1 : -1); 
  }, [searchQuery, messages, filterType]);

  // Scroll to match
  useEffect(() => {
      if (currentMatchIndex >= 0 && searchMatches.length > 0) {
          const id = searchMatches[currentMatchIndex];
          const el = document.getElementById(`msg-${id}`);
          if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  }, [currentMatchIndex, searchMatches]);

  // Visual Perception Stream Attachment Logic (Fixed)
  useEffect(() => {
      if (visualSource && videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(e => console.warn("Video play interrupted", e));
      }
  }, [visualSource]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  useEffect(() => {
     if (messages.length === 0 && mode === 'single') {
        const char = sessionData as Character;
        if(char.greetings?.length > 0) {
           setMessages([{
              id: 'init', role: 'assistant', content: char.greetings[0], timestamp: Date.now(), type: 'text', senderName: char.name, senderId: char.id, emotion: 'neutral'
           }]);
        }
     }
     return () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
     };
  }, [sessionData.id]);

  const handleBgUrl = () => {
      const url = prompt("请输入背景图片 URL (https://...):", (sessionData as Character).backgroundImage || "");
      if (url !== null && onUpdateCharacter && mode === 'single') {
          onUpdateCharacter({ ...(sessionData as Character), backgroundImage: url });
      }
      setShowBgMenu(false);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onUpdateCharacter && mode === 'single') {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const result = ev.target?.result as string;
              onUpdateCharacter({ ...(sessionData as Character), backgroundImage: result });
          };
          reader.readAsDataURL(file);
      }
      setShowBgMenu(false);
      e.target.value = '';
  };

  const handleResetBg = () => {
      if (onUpdateCharacter && mode === 'single') {
          onUpdateCharacter({ ...(sessionData as Character), backgroundImage: '' });
      }
      setShowBgMenu(false);
  };

  const toggleVisualSource = async (type: 'camera' | 'screen') => {
     if (visualSource === type) {
        // Turn off
        if (streamRef.current) {
           streamRef.current.getTracks().forEach(t => t.stop());
           streamRef.current = null;
        }
        setVisualSource(null);
     } else {
        // Switch or Turn on
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        try {
           let stream;
           if (type === 'camera') stream = await navigator.mediaDevices.getUserMedia({ video: true });
           else stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
           
           streamRef.current = stream;
           setVisualSource(type);
           // Stream will be attached by useEffect
        } catch (e) {
           console.error("Visual perception error:", e);
           setVisualSource(null);
           alert("无法访问摄像头或屏幕共享。");
        }
     }
  };

  const captureVisualFrame = (): string | null => {
     if (!videoRef.current || !visualSource) return null;
     const canvas = document.createElement('canvas');
     canvas.width = videoRef.current.videoWidth;
     canvas.height = videoRef.current.videoHeight;
     const ctx = canvas.getContext('2d');
     if (!ctx) return null;
     ctx.drawImage(videoRef.current, 0, 0);
     return canvas.toDataURL('image/jpeg', 0.8);
  };

  const startRecording = async () => {
    try {
       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
       const recorder = new MediaRecorder(stream);
       mediaRecorderRef.current = recorder;
       audioChunksRef.current = [];
       
       recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
       recorder.onstop = handleRecordingStop;
       
       recorder.start();
       setIsRecording(true);
       setRecordingDuration(0);
       recordIntervalRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (err) {
       alert("无法访问麦克风");
    }
  };

  const stopRecording = () => {
     if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
     }
  };

  const handleRecordingStop = async () => {
     const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
     const reader = new FileReader();
     reader.readAsDataURL(audioBlob);
     reader.onloadend = () => {
        const base64 = reader.result as string;
        sendVoiceMessage(base64, recordingDuration);
     };
  };

  const sendVoiceMessage = (base64: string, duration: number) => {
     const msg: Message = {
        id: `v-${Date.now()}`, role: 'user', senderName: appSettings.userPersona.name, content: '[语音消息]', timestamp: Date.now(), type: 'voice', audioData: base64, audioDuration: duration
     };
     setMessages(prev => [...prev, msg]);
     handleSend("(System: User sent a voice message. Respond to what you hear or the context.)", false, true); 
  };

  const handleSendSticker = (sticker: Sticker) => {
     const msg: Message = {
        id: `s-${Date.now()}`, role: 'user', senderName: appSettings.userPersona.name, content: `[Sticker]`, timestamp: Date.now(), type: 'sticker', imageUrl: sticker.url
     };
     setMessages(prev => [...prev, msg]);
     setShowStickerPicker(false);
     handleSend(`[System: User sent a sticker: ${sticker.tags.join(', ')}]`);
  };

  const handleUploadSticker = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const url = ev.target?.result as string;
            const newSticker: Sticker = { id: Date.now().toString(), url, tags: ['custom'], isDynamic: false };
            onUpdateSettings({ ...appSettings, stickerLibrary: [...appSettings.stickerLibrary, newSticker] });
        };
        reader.readAsDataURL(file);
     }
     e.target.value = '';
  };
  
  const handleDeleteSticker = (id: string) => {
      onUpdateSettings({ ...appSettings, stickerLibrary: appSettings.stickerLibrary.filter(s => s.id !== id) });
  };

  const sendRedPacket = () => {
    const amount = parseFloat(redPacketAmount);
    if (!amount || amount <= 0) return;
    const msg: Message = {
      id: `rp-${Date.now()}`, role: 'user', senderName: appSettings.userPersona.name, content: redPacketNote || 'Best wishes!', timestamp: Date.now(), type: 'transaction', transactionAmount: amount
    };
    setMessages(prev => [...prev, msg]);
    setShowRedPacket(false);
    handleSend(`[System]: User sent a Red Packet of $${amount}. Note: "${msg.content}".`);
  };

  const handleCollectSticker = (url: string) => {
     if (appSettings.stickerLibrary.some(s => s.url === url)) return;
     const newSticker: Sticker = { id: `fav-${Date.now()}`, url, tags: ['collected'], isDynamic: url.endsWith('.gif') };
     onUpdateSettings({ ...appSettings, stickerLibrary: [...appSettings.stickerLibrary, newSticker] });
     alert('已收藏到表情包库');
  };

  const handleDeleteMessage = (id: string) => {
    if(confirm('删除这条消息？')) setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleSend = async (retryContent?: string, isProactiveTrigger: boolean = false, isVoiceTrigger: boolean = false) => {
    if ((!input.trim() && attachments.length === 0 && !visualSource && !retryContent && !isProactiveTrigger && !isVoiceTrigger) || isTyping) return;
    
    const timestamp = Date.now();
    let currentInput = retryContent || input;
    let currentAttachments = retryContent ? [] : [...attachments];

    let visualFrame: string | null = null;
    if (visualSource && !retryContent && !isProactiveTrigger) {
        visualFrame = captureVisualFrame();
        if (visualFrame) {
            currentAttachments.push({ id: `vis-${Date.now()}`, type: 'image', base64: visualFrame, mimeType: 'image/jpeg' });
        }
    }

    const isRealUserMessage = !retryContent && !isProactiveTrigger && !isVoiceTrigger;

    if (isRealUserMessage) {
      const userMsg: Message = {
        id: `u-${timestamp}`, role: 'user', senderName: appSettings.userPersona.name, content: currentInput || (currentAttachments.length > 0 ? (visualSource ? "[Visual Input]" : "[Image]") : ""), timestamp: timestamp, type: 'text', imageUrl: currentAttachments.find(a => a.type === 'image')?.base64
      };
      setMessages(prev => [...prev, userMsg]);
    }
    
    if (visualFrame && !retryContent) currentInput += `\n(System: The user is showing you their ${visualSource}. React to the visual input.)`;

    setInput(''); setAttachments([]); setIsTyping(true);

    try {
      const contextMessages = retryContent ? messages : (isProactiveTrigger ? messages : [...messages, {
          id: `u-${timestamp}`, role: 'user', content: currentInput, timestamp, type: 'text', senderName: appSettings.userPersona.name
      } as Message]); 

      if (mode === 'single') {
         const char = sessionData as Character;
         const { text, emotion, sources, activeLore } = await getAiResponse(currentInput, char, appSettings, currentAttachments, contextMessages);
         
         let finalContent = text;
         let stickerMsg: Message | null = null;
         let imagePrompt: string | null = null;
         
         const stickerMatch = text.match(/\[STICKER:\s*([a-zA-Z0-9_]+)\]/i);
         if (stickerMatch) {
            const tag = stickerMatch[1].toLowerCase();
            finalContent = finalContent.replace(/\[STICKER:.*?\]/gi, '').trim();
            const sticker = appSettings.stickerLibrary.find(s => s.tags.includes(tag)) || appSettings.stickerLibrary[0];
            if (sticker) {
              stickerMsg = {
                 id: `as-${Date.now()}`, role: 'assistant', senderName: char.name, senderId: char.id, content: `[Sticker: ${tag}]`, timestamp: Date.now() + 10, type: 'sticker', imageUrl: sticker.url
              };
            }
         }

         const imageMatch = text.match(/\[IMAGE:\s*(.*?)\]/i);
         if (imageMatch) {
            imagePrompt = imageMatch[1];
            finalContent = finalContent.replace(/\[IMAGE:.*?\]/gi, '').trim();
         }
         
         const newAiMsg: Message = {
            id: `a-${Date.now()}`, role: 'assistant', senderName: char.name, senderId: char.id, content: finalContent || "...", timestamp: Date.now(), type: 'text', emotion: emotion, sources: sources, activeLore
         };

         setMessages(prev => stickerMsg ? [...prev, newAiMsg, stickerMsg] : [...prev, newAiMsg]);
         
         if (char.voiceFrequency !== 'never' && voiceProfile) {
            const chance = char.voiceFrequency === 'always' ? 1.0 : 0.4;
            if (Math.random() <= chance || isVoiceTrigger) playVoice(finalContent, voiceProfile);
         }

         if (imagePrompt || (appSettings.enableComfyUI && (input.includes('画') || input.toLowerCase().includes('generate')))) {
            setIsGeneratingImg(true);
            const promptToUse = imagePrompt || input;
            generateImageViaComfy(promptToUse, char, appSettings).then(imageUrl => {
               if (imageUrl) {
                   setMessages(prev => [...prev, {
                      id: `img-${Date.now()}`, role: 'assistant', senderName: char.name, senderId: char.id, content: promptToUse || "Generated Image", timestamp: Date.now(), type: 'image', imageUrl: imageUrl
                   }]);
               }
            }).finally(() => setIsGeneratingImg(false));
         }

      } else {
         const group = sessionData as CharacterGroup;
         const members = allCharacters.filter(c => group.members.includes(c.id));
         let responders = members.filter(m => currentInput.includes(m.name));
         if (responders.length === 0) responders = [members[Math.floor(Math.random() * members.length)]];

         for (const char of responders) {
            const { text, emotion, sources } = await getAiResponse(currentInput, char, appSettings, currentAttachments, contextMessages, true);
            setMessages(prev => [...prev, {
              id: `g-${Date.now()}-${char.id}`, role: 'assistant', senderId: char.id, senderName: char.name, content: text, timestamp: Date.now(), type: 'text', emotion: emotion, sources: sources
            }]);
            await new Promise(r => setTimeout(r, 800));
         }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { id: 'err', role: 'system', content: `Error: ${err.message}`, timestamp: Date.now(), type: 'text' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const playVoice = async (text: string, vp: VoiceProfile) => {
      try {
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
        
        const res = await generateSpeech(text, vp);
        if (res && res.type === 'base64') {
             const buffer = await decodeAudioData(res.data, audioContextRef.current);
             const source = audioContextRef.current.createBufferSource();
             source.buffer = buffer;
             source.connect(audioContextRef.current.destination);
             if (vp.speed) source.playbackRate.value = vp.speed;
             source.start();
        } else if (res && res.type === 'url') {
             const audio = new Audio(res.data);
             if (vp.speed) audio.playbackRate = vp.speed;
             audio.play();
        }
      } catch (e) { console.error("Audio playback failed", e); }
  };

  const bgUrl = (mode === 'single' && (sessionData as Character).backgroundImage) || appSettings.theme.chatBackground || appSettings.theme.globalBackground;
  const themeColor = appSettings.theme.primaryColor;

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--bg-primary)] relative overflow-hidden font-sans transition-colors duration-500" onClick={() => showBgMenu && setShowBgMenu(false)}>
      
      {/* 1. Dynamic Background */}
      {bgUrl && (
        <>
          <div className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000 opacity-60" style={{ backgroundImage: `url(${bgUrl})` }} />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none"></div>
        </>
      )}
      
      {/* 2. Header (Safe Area Adapted) */}
      <div className="relative z-10 px-4 md:px-6 py-3 flex items-center justify-between border-b border-white/5 bg-black/30 backdrop-blur-xl safe-pt shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden flex-1">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white active:scale-95 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5}/></svg></button>
          
          {mode === 'single' ? (
              <div className="relative shrink-0">
                  <img src={sessionData.avatar} className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border border-white/20 shadow-lg" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 border-2 border-black rounded-full"></div>
              </div>
          ) : (
              <div className="grid grid-cols-2 w-9 h-9 md:w-10 md:h-10 rounded-xl overflow-hidden bg-gray-800 gap-0.5 border border-white/20 shrink-0">
                  {(sessionData as CharacterGroup).members.slice(0, 4).map(mid => <img key={mid} src={allCharacters.find(c=>c.id===mid)?.avatar} className="w-full h-full object-cover"/>)}
              </div>
          )}
          
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
               <span className="truncate">{sessionData.name}</span>
               {mode === 'single' && (sessionData as Character).isNsfw && <span className="text-[8px] md:text-[9px] border border-red-500 text-red-400 px-1 rounded shrink-0">18+</span>}
            </h3>
            <p className="text-[10px] text-gray-400 truncate opacity-80">{mode === 'single' ? (sessionData as Character).description : `${(sessionData as CharacterGroup).members.length} members`}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0">
           {/* Custom Background Menu Button */}
           {mode === 'single' && (
               <div className="relative">
                   <button 
                        onClick={(e) => { e.stopPropagation(); setShowBgMenu(!showBgMenu); }} 
                        className={`p-2 rounded-full transition-all ${showBgMenu ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`} 
                        title="更换背景"
                   >
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                   </button>
                   
                   {/* Dropdown Menu */}
                   {showBgMenu && (
                       <div className="absolute top-full right-0 mt-3 w-48 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col p-1.5 animate-enter origin-top-right overflow-hidden">
                           <button onClick={() => bgInputRef.current?.click()} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition-colors text-xs font-bold text-gray-200">
                               <span className="text-base">🖼️</span> 上传本地图片
                           </button>
                           <button onClick={handleBgUrl} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-left transition-colors text-xs font-bold text-gray-200">
                               <span className="text-base">🔗</span> 输入图片链接
                           </button>
                           <div className="h-px bg-white/10 my-1 mx-2"></div>
                           <button onClick={handleResetBg} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-left transition-colors text-xs font-bold text-red-400">
                               <span className="text-base">🗑️</span> 恢复默认背景
                           </button>
                       </div>
                   )}
                   <input type="file" ref={bgInputRef} hidden accept="image/*" onChange={handleBgUpload} />
               </div>
           )}
           
           {/* Search Toggle */}
           <button onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); setFilterType('all'); }} className={`p-2 rounded-full transition-all ${showSearch ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </button>
           {mode === 'single' && <button onClick={onOpenLive} className="px-3 md:px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-500/20 active:scale-95 transition-all flex items-center gap-1"><span>📞</span> <span className="hidden md:inline">通话</span></button>}
           {onEdit && <button onClick={onEdit} className="p-2 md:p-2.5 glass rounded-full text-gray-400 hover:text-white active:scale-95 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>}
        </div>
      </div>

      {/* 2.5 Search Bar with Filters */}
      {showSearch && (
          <div className="absolute top-[60px] left-0 right-0 z-30 bg-[#18181b]/95 backdrop-blur-xl border-b border-white/10 p-3 animate-slide-up flex flex-col gap-2 shadow-xl">
              <div className="flex gap-2">
                  <input 
                    autoFocus
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500/50"
                    placeholder="搜索聊天记录..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <div className="flex items-center gap-1 text-[10px] font-mono text-gray-400 whitespace-nowrap">
                      {searchMatches.length > 0 ? (
                          <>
                            <span>{currentMatchIndex + 1}/{searchMatches.length}</span>
                            <button onClick={() => setCurrentMatchIndex(prev => prev > 0 ? prev - 1 : searchMatches.length - 1)} className="p-1 bg-white/10 rounded hover:bg-white/20">↑</button>
                            <button onClick={() => setCurrentMatchIndex(prev => prev < searchMatches.length - 1 ? prev + 1 : 0)} className="p-1 bg-white/10 rounded hover:bg-white/20">↓</button>
                          </>
                      ) : <span>0 matches</span>}
                  </div>
                  <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1.5 text-gray-500 hover:text-white">✕</button>
              </div>
              
              <div className="flex gap-2 justify-start">
                  <button onClick={() => setFilterType('all')} className={`px-3 py-1 rounded-full text-[10px] border transition-all ${filterType === 'all' ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-transparent'}`}>全部</button>
                  <button onClick={() => setFilterType('image')} className={`px-3 py-1 rounded-full text-[10px] border transition-all ${filterType === 'image' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white/5 text-gray-400 border-transparent'}`}>🖼️ 图片</button>
                  <button onClick={() => setFilterType('voice')} className={`px-3 py-1 rounded-full text-[10px] border transition-all ${filterType === 'voice' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white/5 text-gray-400 border-transparent'}`}>🔊 语音</button>
              </div>
          </div>
      )}

      {/* 3. Visual Perception PiP */}
      {visualSource && (
        <div className="absolute top-24 right-4 z-50 glass rounded-xl overflow-hidden shadow-2xl w-32 md:w-48 border border-white/20 animate-enter">
            <video ref={videoRef} className="w-full h-auto object-cover" playsInline muted></video>
            <div className="absolute top-1 right-1 flex space-x-1">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            </div>
        </div>
      )}

      {/* 4. Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 md:space-y-6 no-scrollbar z-0 relative pb-32">
         {messages.map((m) => {
             const senderChar = m.senderId ? allCharacters.find(c => c.id === m.senderId) : null;
             const isUser = m.role === 'user';
             const isMatch = searchMatches.includes(m.id);
             const isCurrentMatch = searchMatches[currentMatchIndex] === m.id;
             
             // Apply Filter Visualization (Dim unmatched)
             const isFilteredOut = (filterType === 'image' && !m.imageUrl) || (filterType === 'voice' && m.type !== 'voice');
             if (isFilteredOut && searchQuery.trim() === '') return null; // Hide completely if filtering by type only

             return (
               <div id={`msg-${m.id}`} key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-enter group mb-1 ${isCurrentMatch ? 'ring-2 ring-yellow-500/50 rounded-2xl' : ''} ${isFilteredOut ? 'opacity-30 grayscale' : ''}`}>
                  {!isUser && (
                      <div className="flex flex-col items-center mr-2 self-end">
                          <img src={senderChar?.avatar || sessionData.avatar} className="w-7 h-7 md:w-8 md:h-8 rounded-full shadow-lg object-cover mb-1 border border-white/10" />
                          {mode === 'group' && <span className="text-[8px] text-gray-500 max-w-[40px] truncate">{m.senderName}</span>}
                      </div>
                  )}
                  
                  <div className={`max-w-[80%] md:max-w-[65%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* World Info Trigger Badge */}
                    {!isUser && m.activeLore && m.activeLore.length > 0 && (
                        <div className="mb-1 flex items-center gap-1 text-[9px] text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                            <span>🧠</span> 触发世界书/记忆
                        </div>
                    )}

                    <div className={`relative px-4 py-2.5 md:px-5 md:py-3 shadow-lg transition-all duration-300 ${
                        isUser 
                          ? (m.type === 'transaction' ? 'bg-gradient-to-r from-red-600 to-orange-500 border-none text-white rounded-2xl' : 'rounded-2xl rounded-br-none bg-gradient-to-br from-pink-600 to-purple-700 text-white border border-pink-500/20') 
                          : 'rounded-2xl rounded-bl-none bg-[#18181b]/90 text-gray-200 border border-white/10 backdrop-blur-md'
                    }`}>
                         {m.type === 'voice' && m.audioData ? (
                            <AudioBubble src={m.audioData} duration={m.audioDuration} themeColor={isUser ? '#fff' : themeColor} />
                         ) : m.type === 'sticker' ? (
                            <div className="relative group/sticker">
                              <img src={m.imageUrl} className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-lg" />
                              <button onClick={() => m.imageUrl && handleCollectSticker(m.imageUrl)} className="absolute -top-2 -right-2 bg-black/50 p-1.5 rounded-full text-yellow-400 opacity-0 group-hover/sticker:opacity-100 transition-opacity">⭐</button>
                            </div>
                         ) : m.type === 'transaction' ? (
                            <div className="flex flex-col min-w-[180px] md:min-w-[200px]">
                               <div className="flex items-center gap-2 mb-2 border-b border-white/20 pb-2">
                                  <div className="w-6 h-6 rounded-full bg-yellow-400 text-red-900 flex items-center justify-center font-bold text-sm">¥</div>
                                  <span className="font-bold text-sm">红包</span>
                               </div>
                               <div className="text-xl md:text-2xl font-black mb-1">¥ {m.transactionAmount?.toFixed(2)}</div>
                               <div className="text-[10px] md:text-xs opacity-80 italic">{m.content}</div>
                            </div>
                         ) : m.imageUrl ? (
                            <div className="relative group/img rounded-xl overflow-hidden">
                              <img src={m.imageUrl} className="max-h-56 md:max-h-64 w-full object-cover cursor-pointer" onClick={() => window.open(m.imageUrl)} />
                              <button onClick={() => m.imageUrl && handleCollectSticker(m.imageUrl)} className="absolute top-2 right-2 bg-black/60 p-2 rounded-full text-yellow-400 opacity-0 group-hover/img:opacity-100 transition-opacity">⭐</button>
                            </div>
                         ) : (
                            <div className="text-[14px] md:text-[15px] leading-relaxed tracking-wide break-words">
                                <FormattedText text={m.content} highlight={searchQuery} />
                            </div>
                         )}

                         {m.sources && (
                             <div className="mt-2 pt-2 border-t border-white/10 text-[10px] space-y-1">
                                 <div className="font-bold opacity-50 uppercase">信息来源</div>
                                 {m.sources.map((s, idx) => <a key={idx} href={s.uri} target="_blank" className="block text-blue-400 hover:underline truncate">• {s.title}</a>)}
                             </div>
                         )}
                    </div>
                    
                    {/* Message Actions */}
                    <div className={`flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 ${isUser ? 'flex-row-reverse' : ''}`}>
                         <button onClick={() => handleDeleteMessage(m.id)} className="hover:text-red-400 text-[10px]">删除</button>
                         {!isUser && voiceProfile && m.type === 'text' && (
                             <button onClick={() => playVoice(m.content, voiceProfile)} className="hover:text-blue-400 text-[10px]">播放语音</button>
                         )}
                    </div>
                  </div>
               </div>
             )
         })}
         {isTyping && <div className="text-xs text-gray-500 ml-10 animate-pulse font-mono pl-1 flex items-center gap-2"><span>⚡ 思考中...</span></div>}
         {isGeneratingImg && <div className="text-center text-[10px] text-pink-400 animate-pulse bg-black/50 py-1 rounded-full w-fit mx-auto px-4 border border-pink-500/30">正在绘制图片...</div>}
      </div>

      {/* 5. Input Area (Floating & Safe Area) */}
      <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4 z-20 bg-gradient-to-t from-black via-black/90 to-transparent pt-8 safe-pb">
        
        {/* Toolbar */}
        <div className="flex items-center space-x-2 md:space-x-3 mb-2 px-1 overflow-x-auto no-scrollbar mask-linear-fade">
          {appSettings.enableComfyUI && (
             <button onClick={() => handleSend("(System: The user wants you to generate an image/drawing of yourself or the current scene. Describe it in detail inside [IMAGE: ...])")} className="px-3 py-1 bg-purple-500/10 rounded-full text-purple-400 text-[10px] font-bold border border-purple-500/20 hover:bg-purple-500/20 transition-all shrink-0">🎨 绘画</button>
          )}
          {(sessionData as Character).enableVisualPerception && mode === 'single' && (
             <>
             <button onClick={() => toggleVisualSource('camera')} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 shrink-0 ${visualSource === 'camera' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}>
                <span>👁️</span> 摄像头
             </button>
             <button onClick={() => toggleVisualSource('screen')} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 shrink-0 ${visualSource === 'screen' ? 'bg-blue-500/20 text-blue-400 border-blue-500' : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'}`}>
                <span>🖥️</span> 屏幕
             </button>
             </>
          )}
          <button onClick={() => { setShowStickerPicker(!showStickerPicker); setShowRedPacket(false); }} className="px-3 py-1 bg-yellow-500/10 rounded-full text-yellow-500 text-[10px] font-bold border border-yellow-500/20 hover:bg-yellow-500/20 transition-all shrink-0">🤩 表情</button>
          <button onClick={() => { setShowRedPacket(!showRedPacket); setShowStickerPicker(false); }} className="px-3 py-1 bg-red-500/10 rounded-full text-red-500 text-[10px] font-bold border border-red-500/20 hover:bg-red-500/20 transition-all shrink-0">🧧 红包</button>
          <button onClick={() => handleSend("(System: Please send me a selfie/photo based on your current context.)")} className="px-3 py-1 bg-pink-500/10 rounded-full text-pink-500 text-[10px] font-bold border border-pink-500/20 hover:bg-pink-500/20 transition-all shrink-0">📸 求照</button>
        </div>

        {/* Sticker Picker Overlay (Responsive) */}
        {showStickerPicker && (
          <div className="absolute bottom-20 left-2 right-2 md:left-4 md:w-80 h-72 glass rounded-3xl p-4 shadow-2xl z-30 flex flex-col animate-enter border border-white/10 bg-[#18181b]/95 backdrop-blur-xl">
             <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                <div className="flex gap-2">
                   <button onClick={() => setEmojiTab('sticker')} className={`text-xs font-bold px-2 py-1 rounded ${emojiTab === 'sticker' ? 'text-pink-400' : 'text-gray-500'}`}>表情包</button>
                   <button onClick={() => setEmojiTab('emoji')} className={`text-xs font-bold px-2 py-1 rounded ${emojiTab === 'emoji' ? 'text-yellow-400' : 'text-gray-500'}`}>Emoji</button>
                </div>
                <button onClick={() => setShowStickerPicker(false)} className="text-gray-500 hover:text-white px-2">✕</button>
             </div>
             
             {emojiTab === 'sticker' ? (
               <div className="flex-1 flex flex-col min-h-0">
                 <div className="mb-2 flex gap-2">
                    <button onClick={() => stickerInputRef.current?.click()} className="w-full py-1.5 border border-dashed border-white/20 rounded-lg text-[10px] text-gray-400 hover:text-white hover:border-pink-500 transition-all">
                      + 上传表情
                    </button>
                    <input type="file" ref={stickerInputRef} className="hidden" accept="image/*" onChange={handleUploadSticker} />
                 </div>
                 <div className="flex-1 overflow-y-auto grid grid-cols-4 md:grid-cols-3 gap-2 custom-scrollbar pr-1">
                    {appSettings.stickerLibrary.map(s => (
                       <div key={s.id} className="relative group aspect-square bg-white/5 rounded-lg border border-white/5 hover:border-pink-500 transition-all cursor-pointer">
                         <img src={s.url} onClick={() => handleSendSticker(s)} className="w-full h-full object-contain p-1" />
                         <button onClick={(e) => { e.stopPropagation(); handleDeleteSticker(s.id); }} className="absolute top-0 right-0 bg-red-500/80 text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 text-[10px]">✕</button>
                       </div>
                    ))}
                 </div>
               </div>
             ) : (
               <div className="flex-1 overflow-y-auto no-scrollbar p-1 grid grid-cols-8 gap-1">
                  {EMOJI_LIST.map(e => <button key={e} onClick={() => setInput(v => v + e)} className="text-2xl hover:scale-125 transition-transform p-1">{e}</button>)}
               </div>
             )}
          </div>
        )}

        {/* Red Packet Overlay (Responsive) */}
        {showRedPacket && (
           <div className="absolute bottom-20 left-4 right-4 md:w-72 rounded-3xl p-5 shadow-2xl z-30 animate-enter border border-red-500/30 bg-gradient-to-br from-red-900 to-red-950 text-white">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-red-200">发红包</h3>
                 <button onClick={() => setShowRedPacket(false)} className="text-red-300 hover:text-white">✕</button>
              </div>
              <div className="space-y-3">
                 <div>
                    <label className="text-[10px] text-red-300 font-bold uppercase">金额</label>
                    <div className="relative mt-1">
                       <span className="absolute left-3 top-2.5 text-red-500 font-bold">¥</span>
                       <input type="number" value={redPacketAmount} onChange={e => setRedPacketAmount(e.target.value)} className="w-full bg-black/40 border border-red-500/30 rounded-xl pl-8 pr-3 py-2 text-white font-mono outline-none focus:border-red-400" />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] text-red-300 font-bold uppercase">寄语</label>
                    <input value={redPacketNote} onChange={e => setRedPacketNote(e.target.value)} className="w-full bg-black/40 border border-red-500/30 rounded-xl px-3 py-2 mt-1 text-sm outline-none focus:border-red-400" />
                 </div>
                 <button onClick={sendRedPacket} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 py-2.5 rounded-xl font-bold text-red-900 shadow-lg mt-2">塞钱进红包</button>
              </div>
           </div>
        )}

        {/* Attachment Preview */}
        {attachments.length > 0 && (
           <div className="absolute -top-16 left-4 flex gap-2">
              {attachments.map(a => (
                 <div key={a.id} className="relative group">
                    <img src={a.base64} className="w-14 h-14 object-cover rounded-xl border border-white/20 shadow-lg" />
                    <button onClick={() => setAttachments([])} className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full w-4 h-4 text-white flex items-center justify-center text-[10px]">✕</button>
                 </div>
              ))}
           </div>
        )}

        {/* Main Input Bar */}
        <div className="glass-float rounded-[2rem] p-1.5 md:p-2 pl-3 md:pl-4 flex items-end gap-2 md:gap-3 shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10 bg-[#18181b]/90 backdrop-blur-2xl">
          <button onClick={() => fileInputRef.current?.click()} className="p-2 mb-0.5 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5 active:scale-95">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={2}/></svg>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
             const file = e.target.files?.[0];
             if (file) {
               const reader = new FileReader();
               reader.onload = (ev) => setAttachments([{ id: Date.now().toString(), type: 'image', base64: ev.target?.result as string, mimeType: file.type }]);
               reader.readAsDataURL(file);
             }
          }} />

          {/* Record Button */}
          <button 
             onMouseDown={startRecording} onMouseUp={stopRecording} 
             onTouchStart={(e) => { e.preventDefault(); startRecording(); }} onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
             className={`p-2 mb-0.5 rounded-full transition-all flex items-center justify-center active:scale-90 ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_red]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
             {isRecording ? (
                 <div className="flex items-center gap-2 px-1">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span className="text-xs font-mono">{recordingDuration}s</span>
                 </div>
             ) : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
          </button>
          
          <textarea 
            ref={textareaRef}
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => {
                if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            }} 
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm py-3 min-w-0 resize-none max-h-32" 
            placeholder={isRecording ? "松开结束..." : (mode === 'group' ? "发送群消息..." : `发送消息...`)}
            disabled={isRecording}
            rows={1}
          />
          
          <button 
            onClick={() => handleSend()} 
            disabled={!input.trim() && attachments.length === 0 && !visualSource}
            className={`p-2.5 md:p-3 mb-0.5 rounded-full transition-all shadow-lg flex items-center justify-center shrink-0 ${(!input.trim() && attachments.length === 0 && !visualSource) ? 'bg-white/5 text-gray-500' : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white active:scale-90 shadow-pink-500/30'}`}
          >
             <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
