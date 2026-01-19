
import React, { useState, useRef } from 'react';
import { VoiceProfile, VoiceName, TTSProvider } from '../types';
import { generateSpeech, decodeAudioData, pingServer } from '../services/geminiService';

interface VoiceLibraryProps {
  voices: VoiceProfile[];
  onSave: (voice: VoiceProfile) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_AUDIO_DURATION = 30; // 30 seconds

// --- Model Hub Data with Deployment Configs ---
const TTS_MODELS = [
    { 
        id: 'gpt-sovits', 
        name: 'GPT-SoVITS', 
        author: 'RVC-Boss', 
        desc: '当前最强少样本克隆模型，支持中英日韩，5秒素材即可克隆。', 
        tags: ['推荐', '克隆强', 'WebUI'], 
        url: 'https://github.com/RVC-Boss/GPT-SoVITS',
        defaultPort: 9880,
        dockerCmd: 'docker run -d --name gpt-sovits -p 9880:9880 --gpus all breakstring/gpt-sovits:latest',
        pipCmd: 'pip install -r requirements.txt && python api.py -dr "GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s1bert25hz-2kh-longer-epoch=0-step=233333.ckpt" -dt "GPT_SoVITS/pretrained_models/gsv-v2final-pretrained/s1bert25hz-2kh-longer-epoch=0-step=233333.ckpt" -dl "GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large"',
        requirements: ['torch', 'numpy', 'librosa']
    },
    { 
        id: 'chat-tts', 
        name: 'ChatTTS', 
        author: '2noise', 
        desc: '突破性的对话式 TTS，支持自然的笑声、停顿和口语化表达。', 
        tags: ['对话自然', '笑声', '多语言'], 
        url: 'https://github.com/2noise/ChatTTS',
        defaultPort: 9924,
        dockerCmd: 'docker run -d --name chat-tts -p 9924:9924 2noise/chattts:latest',
        pipCmd: 'pip install chattts && python examples/api_server.py'
    },
    { 
        id: 'fish-speech', 
        name: 'Fish Speech', 
        author: 'Fish Audio', 
        desc: '基于 VQ-GAN 和 Llama 的新一代自回归 TTS，适合长文本。', 
        tags: ['高性能', '长文本'], 
        url: 'https://github.com/fishaudio/fish-speech',
        defaultPort: 8000,
        dockerCmd: 'docker run -d --name fish-speech -p 8000:8000 --gpus all fishaudio/fish-speech:latest',
        pipCmd: 'pip install -e . && python tools/api_server.py'
    },
    { 
        id: 'alltalk', 
        name: 'AllTalk (Coqui XTTS)', 
        author: 'erew123', 
        desc: '基于 Coqui XTTS 的本地 API 封装，易于集成到 Text-Gen-WebUI。', 
        tags: ['XTTS', '易用'], 
        url: 'https://github.com/erew123/alltalk_tts',
        defaultPort: 7851,
        dockerCmd: 'docker run -d --name alltalk -p 7851:7851 erew123/alltalk:latest',
        pipCmd: 'pip install -r requirements.txt && python app.py'
    },
];

const VoiceLibrary: React.FC<VoiceLibraryProps> = ({ voices, onSave, onDelete, onClose }) => {
  const [view, setView] = useState<'editor' | 'hub'>('editor');
  const [editingVoice, setEditingVoice] = useState<Partial<VoiceProfile> | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  
  const [isTesting, setIsTesting] = useState(false); 
  const [isChecking, setIsChecking] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
  
  // Deploy Modal State
  const [showDeployModal, setShowDeployModal] = useState<any>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Actions ---

  const handleCreate = () => {
    const newVoice: Partial<VoiceProfile> = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Voice Protocol',
      provider: 'gemini', 
      baseVoice: VoiceName.Kore,
      speed: 1.0,
      tags: ['New'],
    };
    setEditingVoice(newVoice);
    setActiveVoiceId(newVoice.id!);
    setView('editor');
  };

  const selectVoice = (v: VoiceProfile) => {
      setEditingVoice({...v});
      setActiveVoiceId(v.id);
      setView('editor');
      setTestResult(null);
  };

  const handleSave = () => {
    if (!editingVoice || !editingVoice.name) return;
    const fullVoice = { ...editingVoice } as VoiceProfile;
    onSave(fullVoice);
    alert("配置已保存");
  };

  const handleCheckConnection = async () => {
    if (!editingVoice?.apiUrl) return;
    setIsChecking(true);
    setTestResult(null);
    const alive = await pingServer(editingVoice.apiUrl);
    setIsChecking(false);
    setTestResult(alive ? 'success' : 'fail');
  };

  // --- Audio Handling ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { alert("文件过大"); return; }
    
    // Check duration
    const audio = new Audio(URL.createObjectURL(file));
    audio.onloadedmetadata = () => {
        if (audio.duration > MAX_AUDIO_DURATION) {
            alert(`音频时长限制为 ${MAX_AUDIO_DURATION} 秒以内。`);
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => setEditingVoice(p => p ? ({ ...p, sampleAudio: event.target?.result as string }) : null);
        reader.readAsDataURL(file);
    };
  };

  const toggleRecording = async () => {
      if (isRecording) {
          mediaRecorderRef.current?.stop();
          setIsRecording(false);
      } else {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const recorder = new MediaRecorder(stream);
              mediaRecorderRef.current = recorder;
              audioChunksRef.current = [];
              recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
              recorder.onstop = () => {
                  const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                  // Duration check for recording
                  const audio = new Audio(URL.createObjectURL(blob));
                  audio.onloadedmetadata = () => {
                       if (audio.duration > MAX_AUDIO_DURATION) {
                           alert(`录音时长限制为 ${MAX_AUDIO_DURATION} 秒以内。`);
                           return;
                       }
                       const reader = new FileReader();
                       reader.onloadend = () => setEditingVoice(p => p ? ({ ...p, sampleAudio: reader.result as string }) : null);
                       reader.readAsDataURL(blob);
                  };
              };
              recorder.start();
              setIsRecording(true);
          } catch (e) { alert("麦克风访问失败"); }
      }
  };

  const handleTestVoice = async () => {
      if (!editingVoice) return;
      setIsTesting(true);
      try {
          const res = await generateSpeech("System online. Voice synchronization complete.", editingVoice as VoiceProfile);
          if (res?.data) {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const buffer = await decodeAudioData(res.data, ctx);
              const src = ctx.createBufferSource();
              src.buffer = buffer;
              src.connect(ctx.destination);
              src.start(0);
          }
      } catch (e) { alert("TTS Generation Failed"); }
      finally { setIsTesting(false); }
  };

  // --- Deployment Helpers ---

  const downloadBatScript = (model: any) => {
      const scriptContent = `@echo off
echo ===================================================
echo   ANNIE Local Deployment Helper: ${model.name}
echo ===================================================
echo.
echo 1. Cloning Repository...
git clone ${model.url} local_${model.id}
cd local_${model.id}
echo.
echo 2. Creating Virtual Environment...
python -m venv venv
call venv\\Scripts\\activate
echo.
echo 3. Installing Dependencies (This may take a while)...
${model.pipCmd.split('&&')[0]}
echo.
echo 4. Starting API Server...
echo The API will typically run on http://localhost:${model.defaultPort}
${model.pipCmd.split('&&')[1]}
pause
`;
      const blob = new Blob([scriptContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `start_${model.id}.bat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      alert("命令已复制 (Command Copied)");
  };

  const connectToModel = (model: any) => {
      if (!editingVoice) return;
      
      // Determine provider type based on model ID if supported
      let providerType: TTSProvider = 'openai-compatible';
      if (model.id === 'gpt-sovits') providerType = 'gpt-sovits';
      if (model.id === 'fish-speech') providerType = 'fish-speech';
      if (model.id === 'chat-tts') providerType = 'chat-tts';

      setEditingVoice({
          ...editingVoice,
          provider: providerType,
          apiUrl: `http://localhost:${model.defaultPort}`,
          name: `${model.name} Local`,
          apiKey: 'sk-annie-local' // Placeholder
      });
      setView('editor');
      alert(`已将 API 地址配置为 http://localhost:${model.defaultPort}`);
  };

  const ProviderCard = ({ id, label, icon, active }: any) => (
      <button 
        onClick={() => setEditingVoice(p => p ? ({...p, provider: id}) : null)}
        className={`relative p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${active ? 'bg-pink-600/20 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.2)]' : 'bg-[#18181b] border-white/10 hover:border-white/30 text-gray-400'}`}
      >
          <div className="text-xl">{icon}</div>
          <div className="text-[10px] font-bold text-center">{label}</div>
          {active && <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse"></div>}
      </button>
  );

  const showCloneStudio = editingVoice && ['gpt-sovits', 'fish-speech', 'chat-tts', 'custom-json'].includes(editingVoice.provider || '');

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[70] flex items-center justify-center p-0 md:p-8 animate-in fade-in">
       <div className="w-full h-full md:max-w-7xl md:h-[90vh] bg-[#0c0c0e] md:rounded-[2.5rem] border-0 md:border border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden relative safe-pb">
           
           {/* Sidebar */}
           <div className="w-full md:w-72 bg-[#09090b] border-b md:border-b-0 md:border-r border-white/5 flex flex-col shrink-0 safe-pt">
               <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center">
                   <div>
                        <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                            <span className="text-pink-500">❖</span> 音频引擎
                        </h2>
                        <p className="text-[9px] text-gray-500 font-mono">AUDIO CONSOLE</p>
                   </div>
                   <button onClick={onClose} className="md:hidden p-2 text-gray-400">✕</button>
               </div>
               
               <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto p-2 md:p-4 gap-2 no-scrollbar">
                   <button onClick={handleCreate} className="shrink-0 px-4 py-2 md:w-full md:py-3 bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 rounded-xl text-pink-300 font-bold text-xs hover:border-pink-500 hover:text-white transition-all whitespace-nowrap">
                       + 新建配置
                   </button>
                   
                   <div className="hidden md:block text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mt-2 mb-1">我的音色库 (My Voices)</div>
                   {voices.map(v => (
                       <div key={v.id} onClick={() => selectVoice(v)} className={`shrink-0 md:w-full min-w-[120px] group p-2 md:p-3 rounded-xl border cursor-pointer transition-all ${activeVoiceId === v.id ? 'bg-white/10 border-white/20 text-white' : 'border-transparent bg-white/5 md:bg-transparent text-gray-400'}`}>
                           <div className="flex flex-col md:flex-row justify-between md:items-center gap-1">
                               <span className="font-bold text-xs truncate">{v.name}</span>
                               <span className="text-[9px] px-1 py-0.5 rounded bg-black/40 border border-white/10 font-mono w-fit">{v.provider}</span>
                           </div>
                           <div className="hidden md:flex mt-2 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={(e) => {e.stopPropagation(); onDelete(v.id)}} className="text-[10px] text-red-400 hover:text-white hover:bg-red-500/50 px-2 rounded">删除</button>
                           </div>
                       </div>
                   ))}
               </div>

               <div className="p-2 md:p-4 border-t border-white/5 hidden md:block mt-auto">
                   <button onClick={() => setView('hub')} className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${view === 'hub' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                       <span>☁️</span> 本地模型部署
                   </button>
               </div>
           </div>

           {/* Main Content */}
           <div className="flex-1 bg-gradient-to-br from-[#0c0c0e] to-black overflow-y-auto no-scrollbar relative p-4 md:p-0">
               <button onClick={onClose} className="hidden md:block absolute top-6 right-6 p-2 bg-black/40 text-gray-400 hover:text-white rounded-full border border-white/10 z-50">✕</button>

               {view === 'hub' ? (
                   <div className="p-4 md:p-12 animate-enter pb-24">
                       <h2 className="text-2xl md:text-3xl font-black text-white mb-2">本地模型部署 (Local Deploy)</h2>
                       <p className="text-gray-400 text-sm mb-6">选择开源 TTS 模型，生成一键启动脚本或复制 Docker 命令。</p>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                           {TTS_MODELS.map(m => (
                               <div key={m.id} className="bg-[#18181b] border border-white/10 rounded-2xl p-5 hover:border-pink-500/50 transition-all flex flex-col">
                                   <div className="flex justify-between items-start mb-2">
                                      <h3 className="text-lg font-bold text-white">{m.name}</h3>
                                      <div className="flex gap-1">
                                          {m.tags.map(t => <span key={t} className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400">{t}</span>)}
                                      </div>
                                   </div>
                                   <p className="text-xs text-pink-400 font-mono mb-2">by {m.author} • Port: {m.defaultPort}</p>
                                   <p className="text-xs text-gray-400 mb-6 h-8 line-clamp-2">{m.desc}</p>
                                   
                                   <div className="mt-auto space-y-2">
                                       <button onClick={() => setShowDeployModal(m)} className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-xs font-bold text-white shadow-lg shadow-blue-900/20 hover:scale-[1.02] transition-transform">
                                           🚀 获取部署脚本 (Install)
                                       </button>
                                       {editingVoice && (
                                           <button onClick={() => connectToModel(m)} className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300">
                                               🔗 填入配置 (Connect)
                                           </button>
                                       )}
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               ) : editingVoice ? (
                   <div className="p-2 md:p-12 max-w-5xl mx-auto animate-enter pb-32">
                       <div className="flex flex-col md:flex-row justify-between md:items-end mb-6 border-b border-white/5 pb-4 gap-4">
                           <div>
                               <h1 className="text-2xl md:text-3xl font-black text-white">{editingVoice.name || '未命名音色'}</h1>
                               <div className="flex items-center gap-2 mt-2">
                                   <span className={`w-2 h-2 rounded-full ${isChecking ? 'bg-yellow-500 animate-pulse' : testResult === 'success' ? 'bg-green-500' : testResult === 'fail' ? 'bg-red-500' : 'bg-gray-500'}`}></span>
                                   <span className="text-xs font-mono text-gray-500">API 状态: {isChecking ? '检测中...' : testResult === 'success' ? '在线' : '空闲/离线'}</span>
                               </div>
                           </div>
                           <div className="flex gap-2 w-full md:w-auto">
                               <button onClick={handleTestVoice} disabled={isTesting} className="flex-1 md:flex-none px-4 py-2 bg-white/5 border border-white/10 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-2">
                                   {isTesting ? <span className="animate-spin">⏳</span> : '🔊'} 试听
                               </button>
                               <button onClick={handleSave} className="flex-1 md:flex-none px-6 py-2 bg-pink-600 rounded-xl font-bold text-xs text-white shadow-lg shadow-pink-900/30">
                                   保存配置
                               </button>
                           </div>
                       </div>

                       <div className="space-y-6">
                           <section className="space-y-3">
                               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><span className="w-4 h-px bg-gray-600"></span> 基础信息</h3>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div className="bg-[#18181b] p-4 rounded-2xl border border-white/5">
                                       <label className="text-xs font-bold text-gray-500 mb-1 block">配置名称</label>
                                       <input className="w-full bg-transparent border-b border-white/10 py-1 text-base font-bold text-white outline-none" value={editingVoice.name} onChange={e => setEditingVoice({...editingVoice, name: e.target.value})} />
                                   </div>
                                   <div className="bg-[#18181b] p-4 rounded-2xl border border-white/5">
                                       <label className="text-xs font-bold text-gray-500 mb-1 block">语速倍率 (Speed): {editingVoice.speed}x</label>
                                       <input type="range" min="0.5" max="2.0" step="0.1" value={editingVoice.speed || 1.0} onChange={e => setEditingVoice({...editingVoice, speed: parseFloat(e.target.value)})} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-pink-500" />
                                   </div>
                               </div>
                           </section>

                           <section className="space-y-3">
                               <div className="flex justify-between items-center">
                                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><span className="w-4 h-px bg-gray-600"></span> 推理后端 (Backend)</h3>
                                   <button onClick={() => setView('hub')} className="text-[10px] text-blue-400 hover:text-white underline">下载/部署新模型</button>
                               </div>
                               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                   <ProviderCard id="gemini" label="Gemini Cloud" icon="💎" active={editingVoice.provider === 'gemini'} />
                                   <ProviderCard id="gpt-sovits" label="GPT-SoVITS" icon="🌊" active={editingVoice.provider === 'gpt-sovits'} />
                                   <ProviderCard id="fish-speech" label="Fish Speech" icon="🐟" active={editingVoice.provider === 'fish-speech'} />
                                   <ProviderCard id="chat-tts" label="ChatTTS" icon="💬" active={editingVoice.provider === 'chat-tts'} />
                                   <ProviderCard id="openai-compatible" label="OpenAI API" icon="🤖" active={editingVoice.provider === 'openai-compatible'} />
                                   <ProviderCard id="custom-json" label="Custom HTTP" icon="🛠️" active={editingVoice.provider === 'custom-json'} />
                               </div>
                           </section>

                           {/* API Settings */}
                           {editingVoice.provider !== 'gemini' && (
                               <section className="space-y-3 animate-slide-up">
                                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><span className="w-4 h-px bg-gray-600"></span> 连接设置 (Connection)</h3>
                                   <div className="bg-[#18181b] p-4 md:p-6 rounded-3xl border border-white/10 space-y-4 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                                            <span className="text-6xl">🔌</span>
                                        </div>
                                        
                                        <div className="space-y-1 relative z-10">
                                            <label className="text-[10px] font-bold text-pink-300">API 地址 (Backend URL)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-pink-500/50" 
                                                    placeholder="http://127.0.0.1:9880/v1/audio/speech"
                                                    value={editingVoice.apiUrl || ''}
                                                    onChange={e => setEditingVoice({...editingVoice, apiUrl: e.target.value})}
                                                />
                                                <button onClick={handleCheckConnection} disabled={isChecking} className="px-3 bg-white/5 rounded-xl text-xs font-bold border border-white/10 text-white hover:bg-white/10">
                                                    {isChecking ? '...' : 'Ping'}
                                                </button>
                                            </div>
                                            <p className="text-[9px] text-gray-500">确保你的本地服务已启动并允许跨域 (CORS) 请求。</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 pt-2 border-t border-white/5">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-gray-400">API 密钥 (API Key)</label>
                                                <input 
                                                    type="password"
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-pink-500/50" 
                                                    placeholder="sk-..."
                                                    value={editingVoice.apiKey || ''}
                                                    onChange={e => setEditingVoice({...editingVoice, apiKey: e.target.value})}
                                                />
                                            </div>
                                            {editingVoice.provider === 'openai-compatible' && (
                                                <>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-gray-400">模型 ID (Model)</label>
                                                        <input 
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-pink-500/50" 
                                                            placeholder="tts-1 / gpt-sovits"
                                                            value={editingVoice.modelId || ''}
                                                            onChange={e => setEditingVoice({...editingVoice, modelId: e.target.value})}
                                                        />
                                                    </div>
                                                    <div className="space-y-1 md:col-span-2">
                                                        <label className="text-[10px] font-bold text-gray-400">发音人 ID (Voice ID)</label>
                                                        <input 
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-pink-500/50" 
                                                            placeholder="alloy / 9823 / user_custom"
                                                            value={editingVoice.voiceId || ''}
                                                            onChange={e => setEditingVoice({...editingVoice, voiceId: e.target.value})}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            {editingVoice.provider === 'custom-json' && (
                                                <div className="space-y-1 md:col-span-2">
                                                    <label className="text-[10px] font-bold text-gray-400">自定义请求体 (JSON Body)</label>
                                                    <textarea
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-mono text-white outline-none h-24 resize-none focus:border-pink-500/30"
                                                        placeholder='{"text": "{text}", "ref_audio": "{audio}", "format": "wav"}'
                                                        value={editingVoice.customBody || ''}
                                                        onChange={e => setEditingVoice({...editingVoice, customBody: e.target.value})}
                                                    />
                                                    <p className="text-[9px] text-gray-500 mt-1">占位符: <code className="text-pink-400">{"{text}"}</code>(文本), <code className="text-pink-400">{"{audio}"}</code>(参考音频Base64), <code className="text-pink-400">{"{ref_text}"}</code>(参考文本)</p>
                                                </div>
                                            )}
                                        </div>
                                   </div>
                               </section>
                           )}

                           {/* Cloning Studio */}
                           {showCloneStudio && (
                               <section className="space-y-3 animate-slide-up">
                                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><span className="w-4 h-px bg-gray-600"></span> 克隆工坊 (Clone Studio)</h3>
                                   <div className="bg-[#1c1c1f] p-4 rounded-3xl border border-white/5 flex flex-col gap-4">
                                       <div className="flex justify-between items-center">
                                            <label className="text-xs font-bold text-gray-300">参考音频 (Reference Audio)</label>
                                            <span className={`text-[9px] px-2 py-0.5 rounded ${editingVoice.sampleAudio ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{editingVoice.sampleAudio ? '已就绪' : '未上传'}</span>
                                       </div>
                                       
                                       {/* Audio Visualizer Placeholder */}
                                       <div className="h-16 bg-black/40 rounded-xl border border-dashed border-white/10 flex items-center justify-center relative overflow-hidden">
                                            {editingVoice.sampleAudio ? <audio src={editingVoice.sampleAudio} controls className="h-8 w-[90%]" /> : <span className="text-[10px] text-gray-600">上传或录制 3-10秒 音频 (Max 30s)</span>}
                                       </div>

                                       <div className="flex gap-2">
                                           <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2 bg-white/5 rounded-xl text-xs font-bold text-white border border-white/5 hover:bg-white/10">📁 上传文件</button>
                                           <button onClick={toggleRecording} className={`flex-1 py-2 rounded-xl text-xs font-bold text-white border transition-all ${isRecording ? 'bg-red-500/20 border-red-500 animate-pulse' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>{isRecording ? '⏹ 停止录制' : '🎙 开始录音'}</button>
                                           <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileUpload} />
                                       </div>
                                       
                                       <div className="space-y-1">
                                           <label className="text-[10px] font-bold text-gray-400">参考文本 (Transcript)</label>
                                           <textarea 
                                               className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-gray-300 outline-none h-20 resize-none focus:border-pink-500/30"
                                               placeholder="请输入参考音频中说的话 (精确匹配有助于效果)..."
                                               value={editingVoice.sampleText || ''}
                                               onChange={e => setEditingVoice({...editingVoice, sampleText: e.target.value})}
                                           />
                                       </div>
                                   </div>
                               </section>
                           )}
                       </div>
                   </div>
               ) : (
                   <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-4">
                       <div className="text-4xl opacity-20">🎹</div>
                       <p className="text-xs">选择或创建一个音色配置</p>
                       <button onClick={() => setView('hub')} className="px-4 py-2 bg-white/5 rounded-full text-xs hover:bg-white/10">去下载模型</button>
                   </div>
               )}
           </div>

           {/* Deploy Modal */}
           {showDeployModal && (
               <div className="absolute inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                   <div className="w-full max-w-lg bg-[#18181b] border border-white/10 rounded-3xl p-6 shadow-2xl animate-enter">
                       <div className="flex justify-between items-center mb-6">
                           <h3 className="text-xl font-black text-white">{showDeployModal.name} 部署向导</h3>
                           <button onClick={() => setShowDeployModal(null)} className="p-2 bg-white/5 rounded-full">✕</button>
                       </div>
                       
                       <div className="space-y-6">
                           <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                               <h4 className="text-sm font-bold text-blue-300 mb-2">方式 A: Docker (推荐)</h4>
                               <code className="block bg-black/40 p-3 rounded-lg text-[10px] font-mono text-gray-300 break-all mb-2">
                                   {showDeployModal.dockerCmd}
                               </code>
                               <button onClick={() => copyToClipboard(showDeployModal.dockerCmd)} className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold rounded-lg border border-blue-500/30">
                                   复制 Docker 命令
                               </button>
                           </div>

                           <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                               <h4 className="text-sm font-bold text-green-300 mb-2">方式 B: Python 脚本 (Windows)</h4>
                               <p className="text-[10px] text-gray-400 mb-3">生成一个 .bat 脚本，自动处理 Git Clone, Venv 创建和依赖安装。</p>
                               <button onClick={() => downloadBatScript(showDeployModal)} className="w-full py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs font-bold rounded-lg border border-green-500/30">
                                   ⬇️ 下载一键启动脚本 (.bat)
                               </button>
                           </div>

                           <div className="text-[10px] text-gray-500 text-center">
                               部署成功后，端口通常为: <span className="text-white font-bold">{showDeployModal.defaultPort}</span>
                           </div>
                       </div>
                   </div>
               </div>
           )}
       </div>
    </div>
  );
};

export default VoiceLibrary;
