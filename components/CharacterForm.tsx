
import React, { useState } from 'react';
import { Character, VoiceProfile, ModelConfig, PersonalityConfig, WorldInfoEntry, VoiceFrequency, MemoryEntry, Live2DConfig, AgentConfig, ActionStyleConfig } from '../types';
import VoiceLibrary from './VoiceLibrary';

interface CharacterFormProps {
  initialData?: Character;
  voices: VoiceProfile[];
  onSave: (char: Character) => void;
  onCancel: () => void;
  onSaveVoice: (voice: VoiceProfile) => void;
  onDeleteVoice: (id: string) => void;
}

const DEFAULT_CONFIG: ModelConfig = {
  temperature: 0.9,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  contextLimit: 8192,
  stopSequences: [],
  systemInstruction: ''
};

const DEFAULT_PERSONALITY: PersonalityConfig = {
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 80,
  neuroticism: 30,
};

const DEFAULT_LIVE2D: Live2DConfig = {
  enable: false,
  idleVideoUrl: '',
  talkVideoUrl: '',
  scale: 1.0,
  offsetX: 0,
  offsetY: 0,
  removeBgMode: 'none'
};

const DEFAULT_AGENT_CONFIG: AgentConfig = {
    enabled: false,
    role: 'companion',
    allowedTools: ['web_search'],
    thinkingBudget: 0,
    maxSteps: 5,
    requireApproval: true,
    keepWorkingMemory: false
};

const DEFAULT_ACTION_STYLE: ActionStyleConfig = {
    enabled: false,
    narrativePerspective: 'third',
    detailLevel: 'medium',
    includeInnerThoughts: true,
    customFormatting: 'Use asterisks *like this* for actions.'
};

const Card = ({ children, title, subtitle, required }: { children?: React.ReactNode, title: string, subtitle?: string, required?: boolean }) => (
  <div className="bg-[#18181b] rounded-3xl p-6 border border-white/5 shadow-sm space-y-4">
     <div className="flex justify-between items-center">
       <h3 className="text-sm font-bold text-gray-200 flex items-center">
         {title} 
         {required && <span className="text-red-500 ml-1">*</span>}
         {subtitle && <span className="ml-2 text-xs text-gray-500 font-normal">{subtitle}</span>}
       </h3>
     </div>
     {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className="w-full bg-[#27272a] text-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-gray-600 border border-transparent focus:border-purple-500/30" />
);

const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className="w-full bg-[#27272a] text-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none placeholder:text-gray-600 border border-transparent focus:border-purple-500/30 no-scrollbar" />
);

const Slider = ({ label, value, min, max, step, onChange, unit }: any) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      <div className="bg-[#27272a] px-2 py-0.5 rounded text-xs text-gray-300 font-mono">{Number(value).toFixed(1)}{unit}</div>
    </div>
    <div className="relative h-2 bg-[#27272a] rounded-full">
       <div className="absolute h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full" style={{ width: `${((value - min) / (max - min)) * 100}%` }}></div>
       <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
    </div>
  </div>
);

const CharacterForm: React.FC<CharacterFormProps> = ({ initialData, voices, onSave, onCancel, onSaveVoice, onDeleteVoice }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'style' | 'visuals' | 'audio' | 'world' | 'memory' | 'agent' | 'advanced'>('create');
  
  // Migration logic for legacy string actionStyle
  const initialActionStyle = typeof initialData?.actionStyle === 'string' 
      ? { ...DEFAULT_ACTION_STYLE, customFormatting: initialData.actionStyle, enabled: true } 
      : (initialData?.actionStyle || DEFAULT_ACTION_STYLE);

  const [formData, setFormData] = useState<Character>(initialData ? {
      ...initialData,
      actionStyle: initialActionStyle,
      agentConfig: { ...DEFAULT_AGENT_CONFIG, ...(initialData.agentConfig || {}) }
  } : {
    id: Math.random().toString(36).substr(2, 9),
    name: '',
    gender: 'female',
    avatar: 'https://picsum.photos/200',
    description: '',
    persona: '',
    appearance: '',
    scenario: '', 
    examples: '',
    greetings: ['你好呀！今天想聊点什么？'],
    expressionStyle: '',
    habitualPhrases: '',
    actionStyle: { ...DEFAULT_ACTION_STYLE },
    voiceId: voices[0]?.id || '',
    voiceFrequency: 'always',
    maxReplyCount: 1,
    proactiveChat: false,
    useSearch: false,
    enableVisualPerception: false,
    isNsfw: false,
    model: 'gemini-3-flash-preview',
    config: { ...DEFAULT_CONFIG },
    personality: { ...DEFAULT_PERSONALITY },
    relationship: { level: 1, xp: 0, nextLevelXp: 100, status: '初识' },
    memories: [],
    worldInfo: [],
    backgroundImage: '',
    live2dConfig: { ...DEFAULT_LIVE2D },
    sprites: {},
    agentConfig: { ...DEFAULT_AGENT_CONFIG }
  });

  const [newGreeting, setNewGreeting] = useState('');
  const [showVoiceLib, setShowVoiceLib] = useState(false);
  
  // Visuals State
  const [emotionKey, setEmotionKey] = useState('');
  const [emotionUrl, setEmotionUrl] = useState('');

  // World Info State
  const [newWorldKey, setNewWorldKey] = useState('');
  const [newWorldContent, setNewWorldContent] = useState('');

  // Memory State
  const [newMemory, setNewMemory] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addGreeting = () => {
    if (!newGreeting.trim()) return;
    setFormData(prev => ({...prev, greetings: [...(prev.greetings || []), newGreeting]}));
    setNewGreeting('');
  };

  const addWorldInfo = () => {
    if (!newWorldKey.trim() || !newWorldContent.trim()) return;
    const entry: WorldInfoEntry = {
      id: Date.now().toString(),
      keys: newWorldKey.split(',').map(k => k.trim()),
      content: newWorldContent,
      enabled: true
    };
    setFormData(prev => ({...prev, worldInfo: [...(prev.worldInfo || []), entry]}));
    setNewWorldKey('');
    setNewWorldContent('');
  };

  const addMemory = () => {
    if (!newMemory.trim()) return;
    const entry: MemoryEntry = {
      id: Date.now().toString(),
      content: newMemory,
      importance: 5,
      createdAt: Date.now()
    };
    setFormData(prev => ({...prev, memories: [...(prev.memories || []), entry]}));
    setNewMemory('');
  };

  const updateLive2D = (update: Partial<Live2DConfig>) => {
    setFormData(prev => ({
      ...prev,
      live2dConfig: { ...(prev.live2dConfig || DEFAULT_LIVE2D), ...update }
    }));
  };

  // Helper for safe action style update
  const updateActionStyle = (update: Partial<ActionStyleConfig>) => {
      setFormData(prev => ({
          ...prev,
          actionStyle: { ...(prev.actionStyle as ActionStyleConfig), ...update }
      }));
  };

  // Helper for audio playback preview
  const playSample = (voiceId: string) => {
      const v = voices.find(vo => vo.id === voiceId);
      if (v?.sampleAudio) {
          const audio = new Audio(v.sampleAudio);
          audio.play();
      } else {
          alert("该音色未配置试听音频。");
      }
  };

  const TABS = [
    { id: 'create', label: '基础 (Basic)' },
    { id: 'style', label: '风格 (Style)' },
    { id: 'visuals', label: '视觉 (Visual)' },
    { id: 'audio', label: '语音 (Voice)' },
    { id: 'world', label: '世界书 (World)' },
    { id: 'memory', label: '记忆 (Memory)' },
    { id: 'agent', label: '智能体 (Agent)' },
    { id: 'advanced', label: '高级 (Adv)' }
  ];

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col md:flex-row items-center justify-center p-0 md:p-6 animate-in fade-in duration-300 overflow-hidden">
      <div className="w-full max-w-6xl h-full md:h-[95vh] bg-[#09090b] md:rounded-[2.5rem] flex flex-col border border-white/5 shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-[#09090b] z-10">
          <div className="flex items-center space-x-4">
             <button onClick={onCancel} className="md:hidden p-2 -ml-2"><svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
             <h2 className="text-lg font-bold text-gray-100">{initialData ? '编辑角色' : '新建角色'}</h2>
          </div>
          <div className="flex bg-[#18181b] rounded-full p-1 border border-white/5 overflow-x-auto max-w-[60vw] no-scrollbar">
             {TABS.map(tab => (
               <button 
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)} 
                 className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
               >
                 {tab.label}
               </button>
             ))}
          </div>
          <button onClick={onCancel} className="hidden md:block p-2 hover:bg-white/5 rounded-full text-gray-400">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 bg-[#09090b]">
           <form id="charForm" onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto pb-20">
              
              {/* BASIC TAB */}
              {activeTab === 'create' && (
                <>
                  <div className="flex flex-col items-center mb-6">
                     <div className="relative group w-32 h-32 rounded-full overflow-hidden bg-[#18181b] border-2 border-dashed border-white/10 mb-4 hover:border-purple-500/50 transition-colors">
                        <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                           <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <input type="text" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => { const url = prompt("请输入头像图片 URL:", formData.avatar); if(url) setFormData({...formData, avatar: url}); }} />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card title="角色信息" required>
                       <Input placeholder="角色名称 (必填)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                       <Input placeholder="一句话简介，例如：高冷的黑长直学姐" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                       <div className="space-y-1 mt-2">
                          <label className="text-xs text-gray-400 font-bold">性别 (Gender)</label>
                          <select className="w-full bg-[#27272a] text-gray-200 rounded-xl px-4 py-3 text-sm outline-none" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                             <option value="female">女性 (Female)</option>
                             <option value="male">男性 (Male)</option>
                             <option value="non-binary">非二元 (Non-binary)</option>
                             <option value="other">其他/未知 (Other)</option>
                          </select>
                       </div>
                       
                       {/* Voice Selector in Basic Tab */}
                       <div className="space-y-1 mt-2 pt-2 border-t border-white/5">
                           <div className="flex justify-between items-center">
                               <label className="text-xs font-bold text-gray-400">角色音色 (Voice)</label>
                               <button 
                                    type="button"
                                    onClick={() => playSample(formData.voiceId)}
                                    className="text-[10px] text-pink-400 hover:text-white flex items-center gap-1"
                               >
                                   🔊 试听
                               </button>
                           </div>
                           <select 
                               className="w-full bg-[#27272a] text-gray-200 rounded-xl px-4 py-3 text-sm outline-none" 
                               value={formData.voiceId} 
                               onChange={(e) => setFormData({...formData, voiceId: e.target.value})}
                           >
                              {voices.map(v => <option key={v.id} value={v.id}>{v.name} [{v.provider}]</option>)}
                           </select>
                       </div>
                    </Card>

                    <Card title="开场白 (First Message)" required>
                       <div className="space-y-3">
                          <TextArea rows={3} placeholder="例如：你终于来了，我等你好久了... (必填)" value={formData.greetings[0] || ''} onChange={e => {
                             const newGreetings = [...formData.greetings];
                             newGreetings[0] = e.target.value;
                             setFormData({...formData, greetings: newGreetings});
                          }} />
                          <div className="flex gap-2">
                             <Input placeholder="添加更多开场白变体（可选）" value={newGreeting} onChange={e => setNewGreeting(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGreeting())} />
                             <button type="button" onClick={addGreeting} className="bg-white/10 hover:bg-white/20 px-3 rounded-xl font-bold">+</button>
                          </div>
                       </div>
                    </Card>
                  </div>

                  <Card title="核心设定 (Persona)" subtitle="详细描述性格、外貌、经历" required>
                     <TextArea rows={12} placeholder="详细描述角色的性格特征、身世背景、喜好厌恶等。可以使用 {{char}} 代表角色名，{{user}} 代表用户。&#10;例如：{{char}} 是一个生活在赛博朋克世界的黑客，性格孤僻但技术高超..." value={formData.persona} onChange={e => setFormData({...formData, persona: e.target.value})} className="font-mono text-xs leading-relaxed" />
                  </Card>
                </>
              )}

              {/* STYLE TAB (EXPANDED) */}
              {activeTab === 'style' && (
                 <>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card title="语言风格 (Expression Style)">
                         <TextArea rows={4} placeholder="例如：说话带刺，喜欢用反问句，偶尔会脸红结巴..." value={formData.expressionStyle} onChange={e => setFormData({...formData, expressionStyle: e.target.value})} />
                      </Card>
                      <Card title="习惯用语/口癖 (Catchphrases)">
                         <TextArea rows={4} placeholder="例如：'真是笨蛋', '杂鱼~', '哼！' (AI会尝试模仿这些口癖)" value={formData.habitualPhrases} onChange={e => setFormData({...formData, habitualPhrases: e.target.value})} />
                      </Card>
                   </div>
                   
                   {/* Enhanced Action Style Config */}
                   <div className="bg-[#18181b] rounded-3xl p-6 border border-white/5 shadow-sm space-y-4">
                      <div className="flex justify-between items-center">
                          <div>
                              <h3 className="text-sm font-bold text-gray-200">动作描写风格 (Action Style)</h3>
                              <p className="text-xs text-gray-500 mt-1">控制角色如何描述动作、神态及心理活动。</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={(formData.actionStyle as ActionStyleConfig).enabled} onChange={e => updateActionStyle({ enabled: e.target.checked })} />
                              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                      </div>

                      {(formData.actionStyle as ActionStyleConfig).enabled && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up pt-2">
                              <div className="space-y-4">
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-gray-400">叙述视角 (Perspective)</label>
                                      <div className="flex gap-2">
                                          {['first', 'third'].map((p) => (
                                              <button
                                                  type="button"
                                                  key={p}
                                                  onClick={() => updateActionStyle({ narrativePerspective: p as any })}
                                                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                      (formData.actionStyle as ActionStyleConfig).narrativePerspective === p 
                                                      ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                                                      : 'bg-white/5 border-transparent text-gray-500'
                                                  }`}
                                              >
                                                  {p === 'first' ? '第一人称 (我/I)' : '第三人称 (TA/She)'}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-gray-400">心理活动 (Inner Thoughts)</label>
                                      <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                          <span className="text-xs text-gray-300">显式描写心理活动</span>
                                          <input 
                                              type="checkbox" 
                                              className="accent-purple-500 w-4 h-4"
                                              checked={(formData.actionStyle as ActionStyleConfig).includeInnerThoughts}
                                              onChange={e => updateActionStyle({ includeInnerThoughts: e.target.checked })}
                                          />
                                      </div>
                                  </div>
                              </div>

                              <div className="space-y-4">
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-gray-400">描写颗粒度 (Detail Level)</label>
                                      <select 
                                          className="w-full bg-[#27272a] text-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500/50"
                                          value={(formData.actionStyle as ActionStyleConfig).detailLevel}
                                          onChange={e => updateActionStyle({ detailLevel: e.target.value as any })}
                                      >
                                          <option value="low">简洁 (Low) - 仅动作</option>
                                          <option value="medium">适中 (Medium) - 包含神态</option>
                                          <option value="high">细腻 (High) - 环境与五感</option>
                                      </select>
                                  </div>
                                  <div className="space-y-2">
                                      <label className="text-xs font-bold text-gray-400">自定义格式 (Custom Formatting)</label>
                                      <textarea 
                                          rows={2}
                                          className="w-full bg-[#27272a] text-gray-200 rounded-xl px-3 py-2 text-xs outline-none resize-none placeholder-gray-600 no-scrollbar"
                                          placeholder="例如：使用 *动作* 或 (心理)"
                                          value={(formData.actionStyle as ActionStyleConfig).customFormatting}
                                          onChange={e => updateActionStyle({ customFormatting: e.target.value })}
                                      />
                                  </div>
                              </div>
                          </div>
                      )}
                   </div>
                 </>
              )}

              {/* VISUALS TAB */}
              {activeTab === 'visuals' && (
                <>
                  <div className="space-y-6">
                    <Card title="外貌描写 (Visual Prompts)" subtitle="用于 AI 绘画生成的一致性描述">
                       <TextArea rows={4} placeholder="推荐使用英文 Tag，例如：1girl, purple eyes, white hair, maid outfit, hair ribbon, cute face..." value={formData.appearance || ''} onChange={e => setFormData({...formData, appearance: e.target.value})} className="font-mono text-xs text-pink-300" />
                       <p className="text-[10px] text-gray-500">* 此内容将作为 Positive Prompt 自动附加到 ComfyUI 生成请求中。</p>
                    </Card>

                    <div className="bg-gradient-to-br from-[#1c1c1f] to-black rounded-3xl p-6 border border-pink-500/20 shadow-lg relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                          <svg className="w-32 h-32 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9c.83 0 1.5-.67 1.5-1.5S7.83 8 7 8s-1.5.67-1.5 1.5S6.17 11 7 11zm10 0c.83 0 1.5-.67 1.5-1.5S17.83 8 17 8s-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm-5 4c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"/></svg>
                       </div>
                       
                       <div className="flex justify-between items-center mb-6 relative z-10">
                          <div>
                             <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">智能动态立绘 (Smart Motion Avatar)</h3>
                             <p className="text-[10px] text-gray-500 mt-1">使用 ComfyUI (SVD/LivePortrait) 生成的循环视频来模拟 Live2D 效果。</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                             <input type="checkbox" className="sr-only peer" checked={formData.live2dConfig?.enable} onChange={e => updateLive2D({ enable: e.target.checked })} />
                             <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                          </label>
                       </div>

                       {formData.live2dConfig?.enable && (
                          <div className="space-y-6 relative z-10 animate-slide-up">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                   <label className="text-xs font-bold text-gray-400">待机视频 (Idle Video)</label>
                                   <Input placeholder="https://.../idle.mp4 (眨眼/呼吸)" value={formData.live2dConfig?.idleVideoUrl || ''} onChange={e => updateLive2D({ idleVideoUrl: e.target.value })} />
                                   <p className="text-[9px] text-gray-600">安静时播放循环。</p>
                                </div>
                                <div className="space-y-2">
                                   <label className="text-xs font-bold text-gray-400">说话视频 (Talk Video)</label>
                                   <Input placeholder="https://.../talk.mp4 (张嘴/说话)" value={formData.live2dConfig?.talkVideoUrl || ''} onChange={e => updateLive2D({ talkVideoUrl: e.target.value })} />
                                   <p className="text-[9px] text-gray-600">发语音时播放循环。</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-2 gap-6 p-4 bg-black/40 rounded-xl border border-white/5">
                                <div>
                                   <label className="text-xs font-bold text-gray-400 mb-2 block">显示位置 (Position & Scale)</label>
                                   <div className="space-y-3">
                                      <Slider label="缩放 (Scale)" value={formData.live2dConfig?.scale || 1.0} min={0.5} max={2.5} step={0.1} onChange={(e: any) => updateLive2D({ scale: parseFloat(e.target.value) })} />
                                      <Slider label="X 轴偏移" value={formData.live2dConfig?.offsetX || 0} min={-100} max={100} step={5} onChange={(e: any) => updateLive2D({ offsetX: parseInt(e.target.value) })} unit="%" />
                                      <Slider label="Y 轴偏移" value={formData.live2dConfig?.offsetY || 0} min={-100} max={100} step={5} onChange={(e: any) => updateLive2D({ offsetY: parseInt(e.target.value) })} unit="%" />
                                   </div>
                                </div>
                                
                                <div className="space-y-3">
                                   <label className="text-xs font-bold text-gray-400 block">画面融合 (Visual Blending)</label>
                                   <div className="text-[10px] text-gray-500 mb-2">如果是黑色背景视频，请选择 "Screen" 以去背。</div>
                                   <select 
                                      className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-pink-500/50"
                                      value={formData.live2dConfig?.removeBgMode || 'none'}
                                      onChange={e => updateLive2D({ removeBgMode: e.target.value as any })}
                                   >
                                      <option value="none">无 (Normal)</option>
                                      <option value="screen">滤色 (Screen) - 去黑底</option>
                                      <option value="plus-lighter">线性减淡 (Add) - 强力去黑</option>
                                      <option value="multiply">正片叠底 (Multiply) - 去白底</option>
                                   </select>
                                   
                                   {/* Preview Box */}
                                   <div className="mt-4 h-24 rounded-lg bg-gradient-to-br from-purple-900 to-indigo-900 relative overflow-hidden flex items-center justify-center border border-white/10">
                                      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                                      <div className="text-[9px] text-white/50 absolute bottom-1 right-1">预览背景</div>
                                      {formData.live2dConfig?.idleVideoUrl ? (
                                         <video 
                                            src={formData.live2dConfig.idleVideoUrl} 
                                            autoPlay loop muted playsInline
                                            className="h-full w-auto object-contain transition-all"
                                            style={{ 
                                               mixBlendMode: formData.live2dConfig.removeBgMode as any,
                                               transform: `scale(${0.8})` // mini preview
                                            }}
                                         />
                                      ) : <span className="text-[10px] text-gray-500">无预览视频</span>}
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>
                  </div>
                </>
              )}

              {/* AGENT TAB (EXPANDED) */}
              {activeTab === 'agent' && (
                  <div className="space-y-6">
                      <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 rounded-3xl p-6 border border-indigo-500/20 shadow-lg">
                          <div className="flex justify-between items-center mb-4">
                              <div>
                                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                      <span>🤖</span> OpenManus Agent (Beta)
                                  </h3>
                                  <p className="text-xs text-indigo-300 mt-1">赋予角色调用工具和执行复杂任务的能力。</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={formData.agentConfig?.enabled} onChange={e => setFormData({...formData, agentConfig: {...(formData.agentConfig || DEFAULT_AGENT_CONFIG), enabled: e.target.checked}})} />
                                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                              </label>
                          </div>

                          {formData.agentConfig?.enabled && (
                              <div className="space-y-6 animate-slide-up">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold text-indigo-200">角色定位 (Role)</label>
                                          <select className="w-full bg-black/40 border border-indigo-500/30 rounded-xl px-4 py-3 text-sm outline-none text-white" value={formData.agentConfig.role} onChange={e => setFormData({...formData, agentConfig: {...formData.agentConfig!, role: e.target.value as any}})}>
                                              <option value="companion">伴侣 (Companion) - 优先情感</option>
                                              <option value="assistant">助理 (Assistant) - 优先效率</option>
                                              <option value="executor">执行者 (Executor) - 仅执行任务</option>
                                          </select>
                                      </div>
                                      <div className="space-y-2">
                                          <label className="text-xs font-bold text-indigo-200">OpenManus API 地址</label>
                                          <Input placeholder="http://localhost:8000/v1/agent" value={formData.agentConfig.openManusEndpoint || ''} onChange={e => setFormData({...formData, agentConfig: {...formData.agentConfig!, openManusEndpoint: e.target.value}})} />
                                      </div>
                                  </div>

                                  <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-4">
                                      <h4 className="text-xs font-bold text-indigo-300 uppercase">高级执行参数 (Execution)</h4>
                                      
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <Slider 
                                              label="思考预算 (Thinking Budget)" 
                                              value={formData.agentConfig.thinkingBudget || 0} 
                                              min={0} max={32000} step={1024} unit=" tokens"
                                              onChange={(e: any) => setFormData({...formData, agentConfig: {...formData.agentConfig!, thinkingBudget: parseInt(e.target.value)}})} 
                                          />
                                          <Slider 
                                              label="最大循环步数 (Max Steps)" 
                                              value={formData.agentConfig.maxSteps || 5} 
                                              min={1} max={20} step={1} unit=" steps"
                                              onChange={(e: any) => setFormData({...formData, agentConfig: {...formData.agentConfig!, maxSteps: parseInt(e.target.value)}})} 
                                          />
                                      </div>

                                      <div className="flex flex-col gap-3 pt-2">
                                          <div className="flex items-center justify-between">
                                              <span className="text-xs text-gray-300">敏感操作需审批 (Require Approval)</span>
                                              <input 
                                                  type="checkbox" 
                                                  className="accent-indigo-500 w-4 h-4"
                                                  checked={formData.agentConfig.requireApproval ?? true}
                                                  onChange={e => setFormData({...formData, agentConfig: {...formData.agentConfig!, requireApproval: e.target.checked}})}
                                              />
                                          </div>
                                          <div className="flex items-center justify-between">
                                              <span className="text-xs text-gray-300">保留短期工作记忆 (Keep Working Memory)</span>
                                              <input 
                                                  type="checkbox" 
                                                  className="accent-indigo-500 w-4 h-4"
                                                  checked={formData.agentConfig.keepWorkingMemory ?? false}
                                                  onChange={e => setFormData({...formData, agentConfig: {...formData.agentConfig!, keepWorkingMemory: e.target.checked}})}
                                              />
                                          </div>
                                      </div>
                                  </div>

                                  <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                                      <label className="text-xs font-bold text-indigo-200 block mb-2">允许使用的工具 (Allowed Tools)</label>
                                      <div className="flex flex-wrap gap-2">
                                          {['web_search', 'file_reader', 'python_interpreter', 'image_gen', 'calendar'].map(tool => (
                                              <button 
                                                key={tool} 
                                                type="button"
                                                onClick={() => {
                                                    const current = formData.agentConfig?.allowedTools || [];
                                                    const newTools = current.includes(tool) ? current.filter(t => t !== tool) : [...current, tool];
                                                    setFormData({...formData, agentConfig: {...formData.agentConfig!, allowedTools: newTools}});
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${formData.agentConfig?.allowedTools.includes(tool) ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-gray-500'}`}
                                              >
                                                  {tool}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* AUDIO/BEHAVIOR TAB */}
              {activeTab === 'audio' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-pink-600/20 to-purple-600/20 rounded-3xl p-6 border border-pink-500/20">
                     <div className="flex justify-between items-center mb-6">
                        <div>
                           <h3 className="text-lg font-bold text-white">语音与行为</h3>
                        </div>
                        <button type="button" onClick={() => setShowVoiceLib(true)} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-xl text-xs font-bold shadow-lg shadow-pink-900/30 flex items-center gap-2">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                           管理音色库
                        </button>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-400">选择角色音色 (Voice)</label>
                           <div className="relative">
                               <select 
                                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500/50 appearance-none" 
                                   value={formData.voiceId} 
                                   onChange={(e) => setFormData({...formData, voiceId: e.target.value})}
                               >
                                  {voices.map(v => <option key={v.id} value={v.id}>{v.name} [{v.provider}]</option>)}
                               </select>
                               <div className="absolute right-3 top-3 pointer-events-none text-gray-500">▼</div>
                           </div>
                           {/* Quick Preview Button */}
                           <button 
                                type="button"
                                onClick={() => playSample(formData.voiceId)}
                                className="text-[10px] text-pink-400 hover:text-white flex items-center gap-1 mt-1"
                           >
                               🔊 试听当前音色
                           </button>
                        </div>

                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-400">语音回复频次</label>
                           <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-pink-500/50" value={formData.voiceFrequency} onChange={(e) => setFormData({...formData, voiceFrequency: e.target.value as VoiceFrequency})}>
                              <option value="always">每条都语音回复 (Always)</option>
                              <option value="occasionally">偶尔语音 (Occasionally - 40%)</option>
                              <option value="never">仅文字 (Text Only)</option>
                           </select>
                        </div>

                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-400">最大回复条数限制 (Max Reply Bubbles)</label>
                           <div className="flex items-center space-x-3">
                              <input type="range" min="1" max="10" step="1" value={formData.maxReplyCount} onChange={e => setFormData({...formData, maxReplyCount: parseInt(e.target.value)})} className="flex-1 accent-pink-500" />
                              <span className="text-sm font-mono bg-black/40 px-2 py-1 rounded border border-white/10 w-12 text-center">{formData.maxReplyCount}</span>
                           </div>
                        </div>

                        <div className="space-y-2 flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                            <div>
                               <div className="text-xs font-bold text-gray-400">主动回复 (Proactive Chat)</div>
                               <div className="text-[10px] text-gray-500">当你不说话时，TA 会尝试找话题。</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                               <input type="checkbox" className="sr-only peer" checked={formData.proactiveChat} onChange={e => setFormData({...formData, proactiveChat: e.target.checked})} />
                               <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                            </label>
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {/* WORLD INFO TAB (UNCHANGED LOGIC, JUST RE-RENDERED) */}
              {activeTab === 'world' && (
                <div className="space-y-6">
                   <div className="bg-[#18181b] rounded-3xl p-6 border border-white/5">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <h3 className="text-sm font-bold text-gray-200">世界书 (Lorebook)</h3>
                            <p className="text-xs text-gray-500 mt-1">当对话包含关键词时，自动向 AI 注入额外设定。</p>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="bg-[#27272a]/50 p-4 rounded-2xl border border-dashed border-white/10 space-y-3">
                            <div>
                               <label className="text-[10px] font-bold text-gray-400 uppercase">触发关键词 (Keywords)</label>
                               <input className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-sm mt-1 focus:border-pink-500/50 outline-none" placeholder="例如：帝都, 魔法学院 (逗号分隔)" value={newWorldKey} onChange={e => setNewWorldKey(e.target.value)} />
                            </div>
                            <div>
                               <label className="text-[10px] font-bold text-gray-400 uppercase">设定内容 (Entry Content)</label>
                               <textarea className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-sm mt-1 focus:border-pink-500/50 outline-none resize-none" rows={3} placeholder="详细描述该关键词对应的设定..." value={newWorldContent} onChange={e => setNewWorldContent(e.target.value)} />
                            </div>
                            <div className="flex justify-end">
                               <button type="button" onClick={addWorldInfo} className="bg-pink-600 hover:bg-pink-500 px-6 py-2 rounded-xl text-xs font-bold transition-all">添加条目</button>
                            </div>
                         </div>

                         <div className="space-y-2 mt-4">
                            {(formData.worldInfo || []).map((entry, idx) => (
                               <div key={entry.id} className="bg-[#27272a] p-3 rounded-xl border border-white/5 flex gap-3 group">
                                  <div className="flex-1 space-y-1">
                                     <div className="flex flex-wrap gap-1">
                                        {entry.keys.map(k => <span key={k} className="bg-pink-900/30 text-pink-400 text-[10px] px-1.5 py-0.5 rounded border border-pink-500/20">{k}</span>)}
                                     </div>
                                     <p className="text-xs text-gray-300 line-clamp-2">{entry.content}</p>
                                  </div>
                                  <button type="button" onClick={() => setFormData(prev => ({...prev, worldInfo: prev.worldInfo.filter(e => e.id !== entry.id)}))} className="self-center p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7M10 11v6m4-6v6" /></svg>
                                  </button>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* MEMORY TAB */}
              {activeTab === 'memory' && (
                <div className="space-y-6">
                   <div className="bg-[#18181b] rounded-3xl p-6 border border-white/5">
                      <div className="flex justify-between items-start mb-4">
                         <div>
                            <h3 className="text-sm font-bold text-gray-200">长期记忆 (Long-term Memory)</h3>
                            <p className="text-xs text-gray-500 mt-1">手动添加角色的关键经历或重要事实。这些内容将被视为高权重记忆。</p>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex gap-2">
                            <input 
                              className="flex-1 bg-[#09090b] border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-pink-500/50 outline-none" 
                              placeholder="例如：用户在 2023 年救了我一命，我一直心存感激..." 
                              value={newMemory} 
                              onChange={e => setNewMemory(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addMemory()}
                            />
                            <button type="button" onClick={addMemory} className="bg-pink-600 hover:bg-pink-500 px-6 rounded-xl font-bold text-sm">记录</button>
                         </div>

                         <div className="space-y-2 mt-2">
                            {(formData.memories || []).map((mem) => (
                               <div key={mem.id} className="bg-[#27272a] p-4 rounded-xl border border-white/5 flex gap-3 group items-center">
                                  <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
                                  <div className="flex-1 text-sm text-gray-200">{mem.content}</div>
                                  <button type="button" onClick={() => setFormData(prev => ({...prev, memories: prev.memories.filter(m => m.id !== mem.id)}))} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                               </div>
                            ))}
                            {(!formData.memories || formData.memories.length === 0) && (
                               <div className="text-center py-6 text-gray-600 text-xs border border-dashed border-white/5 rounded-xl">暂无记忆记录</div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* ADVANCED TAB */}
              {activeTab === 'advanced' && (
                <>
                   <Card title="情景设定 (Scenario)"><TextArea rows={4} placeholder="例如：在深夜的便利店，外面下着大雨，只有我们两个人..." value={formData.scenario || ''} onChange={e => setFormData({...formData, scenario: e.target.value})} /></Card>
                   <Card title="对话示例 (Examples)"><TextArea rows={6} placeholder="<START>&#10;{{user}}: 你好。&#10;{{char}}: *微笑着* 哎呀，稀客呢。&#10;&#10;（这对定义角色的说话语气非常重要）" value={formData.examples || ''} onChange={e => setFormData({...formData, examples: e.target.value})} className="font-mono text-xs" /></Card>

                   <Card title="独立模型参数">
                      <div className="grid grid-cols-1 gap-8 pt-2">
                         <Slider label="随机性 (Temperature)" value={formData.config.temperature} min={0} max={2} step={0.1} onChange={(e: any) => setFormData({...formData, config: {...formData.config, temperature: parseFloat(e.target.value)}})} />
                         <Slider label="上下文上限 (Context Limit)" value={formData.config.contextLimit} min={2048} max={32768} step={1024} onChange={(e: any) => setFormData({...formData, config: {...formData.config, contextLimit: parseInt(e.target.value)}})} unit=" tokens" />
                      </div>
                   </Card>
                   <Card title="高级功能开关">
                     <div className="space-y-4">
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors">
                            <div>
                                <div className="text-sm font-bold text-gray-200">联网搜索 (Web Search)</div>
                                <div className="text-[10px] text-gray-500">允许 AI 搜索最新网络信息 (Grounding)。仅 Gemini 支持。</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={formData.useSearch} onChange={e => setFormData({...formData, useSearch: e.target.checked})} />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors">
                            <div>
                                <div className="text-sm font-bold text-gray-200">允许视觉感知 (Visual Perception)</div>
                                <div className="text-[10px] text-gray-500">允许该角色访问您的摄像头或屏幕内容。</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={formData.enableVisualPerception} onChange={e => setFormData({...formData, enableVisualPerception: e.target.checked})} />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors">
                            <div>
                                <div className="text-sm font-bold text-gray-200">NSFW 模式</div>
                                <div className="text-[10px] text-gray-500">解除部分安全过滤限制。</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={formData.isNsfw} onChange={e => setFormData({...formData, isNsfw: e.target.checked})} />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                     </div>
                   </Card>
                </>
              )}
           </form>
        </div>

        {/* Footer */}
        <div className="p-6 bg-[#09090b] border-t border-white/5 flex justify-center z-20">
           <button onClick={() => document.getElementById('charForm')?.dispatchEvent(new Event('submit', {cancelable: true, bubbles: true}))} className="w-full max-w-md bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold py-4 rounded-full shadow-[0_4px_20px_rgba(168,85,247,0.4)] transition-all active:scale-95 text-base tracking-wide">保存设定</button>
        </div>

        {/* Integrated Voice Library Overlay */}
        {showVoiceLib && (
          <VoiceLibrary 
            voices={voices}
            onSave={(v) => { onSaveVoice(v); setFormData(p => ({...p, voiceId: v.id})); }}
            onDelete={onDeleteVoice}
            onClose={() => setShowVoiceLib(false)}
          />
        )}

      </div>
    </div>
  );
};

export default CharacterForm;
