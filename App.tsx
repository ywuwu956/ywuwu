
import React, { useState, useEffect, useRef } from 'react';
import { Character, AppSettings, VoiceName, VoiceProfile, ModelConfig, UserPersona, CharacterGroup, ThemeConfig, ComfyNodeConfig, Sticker, GenerationPreset, Moment, ActionStyleConfig, AgentConfig } from './types';
import CharacterForm from './components/CharacterForm';
import ChatWindow from './components/ChatWindow';
import LiveAudioOverlay from './components/LiveAudioOverlay';
import VoiceLibrary from './components/VoiceLibrary';
import MomentsFeed from './components/MomentsFeed';
import GroupCreator from './components/GroupCreator';
import { testComfyConnection, fetchComfyResources, fetchOllamaModels } from './services/geminiService';

const APP_VERSION = "ANNIE v1.2.0 (PWA)";

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  temperature: 1.0,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 4096,
  contextLimit: 8192,
  stopSequences: [],
  systemInstruction: ''
};

const INITIAL_VOICE: VoiceProfile = {
  id: 'v-standard',
  name: '系统柔美音',
  provider: 'gemini',
  baseVoice: VoiceName.Kore,
  stylePrompt: '极度温柔、带有轻微羞涩的气息',
  speed: 1.0,
  tags: ['温柔', '默认']
};

const DEFAULT_USER_PERSONA: UserPersona = {
  name: 'User',
  avatar: 'https://ui-avatars.com/api/?name=User&background=random',
  description: '神秘的旅行者。',
  customPrompt: ''
};

const DEFAULT_COMFY_CONFIG: ComfyNodeConfig = {
  workflowType: 'anime',
  checkpoint: 'animagineXLV3_v30.safetensors',
  vae: 'ae.safetensors',
  lora1: 'None',
  lora1_strength: 0.8,
  lora2: 'None',
  lora2_strength: 0.6,
  sampler: 'euler_ancestral',
  scheduler: 'karras',
  steps: 25,
  cfg: 7,
  width: 832,
  height: 1216,
  defaultNegativePrompt: 'low quality, bad anatomy, nsfw, ugly, cropped, worst quality, lowres, glitch, deformed, mutated, disfigured',
  globalPositivePrompt: 'masterpiece, best quality, very aesthetic, highly detailed',
  skipNgrokWarning: true 
};

const DEFAULT_THEME: ThemeConfig = {
  mode: 'dark',
  primaryColor: '#db2777', 
  accentColor: '#9333ea',  
  globalBackground: '',
  chatBackground: '',
  glassOpacity: 0.8,
  bubbleStyle: 'modern'
};

const DEFAULT_STICKERS: Sticker[] = [
  { id: 's1', url: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbW5sZnhkMDZ4Z3l4aHZ4c3Z4eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l4FGpP4lxGGgK5CBW/giphy.gif', tags: ['happy', 'dance'], isDynamic: true },
  { id: 's2', url: 'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Z4eHZ4c3Z4eHZ4c3Z4eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3o7TKr3nzbh5WgCFxe/giphy.gif', tags: ['shock', 'surprised'], isDynamic: true },
  { id: 's3', url: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXZ4eHZ4c3Z4eHZ4c3Z4eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0HlCqV35hdEg2CNy/giphy.gif', tags: ['love', 'kiss'], isDynamic: true },
  { id: 's4', url: 'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExN3Z4eHZ4c3Z4eHZ4c3Z4eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/26BRv0ThflsHCqDrG/giphy.gif', tags: ['angry', 'mad'], isDynamic: true },
];

const INITIAL_SETTINGS: AppSettings = {
  enableComfyUI: true,
  comfyUrl: 'http://127.0.0.1:8190',
  comfyConfig: DEFAULT_COMFY_CONFIG,
  savedCheckpoints: ['animagineXLV3_v30.safetensors', 'ponyDiffusionV6XL.safetensors'],
  savedLoras: ['None', 'detail_slider_v4.safetensors'],
  availableSamplers: ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral'],
  availableSchedulers: ['normal', 'karras', 'exponential', 'sgm_uniform'],
  apiProvider: 'gemini',
  
  providerConfigs: {
      gemini: { apiKey: '', model: 'gemini-2.0-flash-exp' },
      ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'llama3' },
      'openai-compatible': { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o' },
      'tata-core': { baseUrl: 'http://localhost:8000', apiKey: 'tata-local-key', model: 'tata-v1' }
  },

  modelPreset: DEFAULT_MODEL_CONFIG,
  savedGenerationPresets: [],
  useGoogleSearch: true,
  showNsfw: true,
  defaultTTSProvider: 'gemini',
  userPersona: DEFAULT_USER_PERSONA,
  theme: DEFAULT_THEME,
  stickerLibrary: DEFAULT_STICKERS
};

const WORKFLOW_PRESETS = [
    { label: "SD1.5 标准 (512x768)", width: 512, height: 768, steps: 20, cfg: 7, sampler: 'euler_ancestral' },
    { label: "SD1.5 宽画幅 (768x512)", width: 768, height: 512, steps: 20, cfg: 7, sampler: 'euler_ancestral' },
    { label: "SDXL / Pony 竖屏 (832x1216)", width: 832, height: 1216, steps: 25, cfg: 7, sampler: 'euler_ancestral' },
    { label: "SDXL / Pony 方形 (1024x1024)", width: 1024, height: 1024, steps: 28, cfg: 7, sampler: 'dpmpp_2m' },
    { label: "SDXL / Pony 横屏 (1216x832)", width: 1216, height: 832, steps: 25, cfg: 7, sampler: 'euler_ancestral' },
];

const POSITIVE_PROMPT_PRESETS = [
    { label: "通用高质量 (General High Quality)", value: "masterpiece, best quality, very aesthetic, highly detailed" },
    { label: "动漫风格 (Anime Style)", value: "anime style, key visual, vibrant colors, clean lines, high quality" },
    { label: "写实照片 (Realistic Photo)", value: "photorealistic, 8k, raw photo, dslr, soft lighting, film grain" },
    { label: "Pony V6 专用 (Score 9)", value: "score_9, score_8_up, score_7_up, source_anime, simple background" },
];

const App: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [groups, setGroups] = useState<CharacterGroup[]>([]);
  const [voices, setVoices] = useState<VoiceProfile[]>([INITIAL_VOICE]);
  const [moments, setMoments] = useState<Moment[]>([]);
  
  const [selectedSession, setSelectedSession] = useState<{ type: 'char' | 'group', id: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showMoments, setShowMoments] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'connect' | 'model' | 'comfy' | 'user' | 'theme' | 'help'>('connect');

  const [comfyStatus, setComfyStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [comfyErrorMsg, setComfyErrorMsg] = useState<string>("");
  const [comfyErrorType, setComfyErrorType] = useState<string | undefined>(undefined);

  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  
  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  const fileImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // PWA Event Listener
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    try {
        const v = localStorage.getItem('airi_v7_voices');
        if (v) setVoices(JSON.parse(v));
        
        const s = localStorage.getItem('airi_v7_settings');
        if (s) {
           const parsed: any = JSON.parse(s);
           // Robust Deep Merge
           const mergedSettings: AppSettings = {
               ...INITIAL_SETTINGS,
               ...parsed,
               providerConfigs: {
                   gemini: { ...INITIAL_SETTINGS.providerConfigs.gemini, ...((parsed.providerConfigs?.gemini || {}) as any) },
                   ollama: { ...INITIAL_SETTINGS.providerConfigs.ollama, ...((parsed.providerConfigs?.ollama || {}) as any) },
                   'openai-compatible': { ...INITIAL_SETTINGS.providerConfigs['openai-compatible'], ...((parsed.providerConfigs?.['openai-compatible'] || {}) as any) },
                   'tata-core': { ...INITIAL_SETTINGS.providerConfigs['tata-core'], ...((parsed.providerConfigs?.['tata-core'] || {}) as any) },
               },
               modelPreset: { ...DEFAULT_MODEL_CONFIG, ...(parsed.modelPreset || {}) },
               comfyConfig: { ...DEFAULT_COMFY_CONFIG, ...(parsed.comfyConfig || {}) },
               userPersona: { ...DEFAULT_USER_PERSONA, ...(parsed.userPersona || {}) },
               theme: { ...DEFAULT_THEME, ...(parsed.theme || {}) },
               stickerLibrary: parsed.stickerLibrary || DEFAULT_STICKERS,
           };
           setSettings(mergedSettings);
        }

        const c = localStorage.getItem('airi_v7_characters');
        if (c) {
            const parsedChars = JSON.parse(c);
            const migratedChars = parsedChars.map((char: any) => {
                if (typeof char.actionStyle === 'string') {
                    return {
                        ...char,
                        actionStyle: {
                            enabled: true,
                            narrativePerspective: 'third',
                            detailLevel: 'medium',
                            includeInnerThoughts: true,
                            customFormatting: char.actionStyle
                        } as ActionStyleConfig
                    };
                }
                return char;
            });
            setCharacters(migratedChars);
        }
        
        const g = localStorage.getItem('airi_v7_groups');
        if (g) setGroups(JSON.parse(g));
        const m = localStorage.getItem('airi_v7_moments');
        if (m) setMoments(JSON.parse(m));
    } catch (e) {
        console.error("Storage Load Error", e);
        setSettings(INITIAL_SETTINGS);
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    localStorage.setItem('airi_v7_characters', JSON.stringify(characters));
    localStorage.setItem('airi_v7_groups', JSON.stringify(groups));
    localStorage.setItem('airi_v7_voices', JSON.stringify(voices));
    localStorage.setItem('airi_v7_settings', JSON.stringify(settings));
    localStorage.setItem('airi_v7_moments', JSON.stringify(moments));
  }, [characters, groups, voices, settings, moments]);

  const handleInstallApp = () => {
      if (installPrompt) {
          installPrompt.prompt();
          installPrompt.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') {
                  setInstallPrompt(null);
              }
          });
      }
  };

  const handleImportCharacter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const json = JSON.parse(text);
        const data = json.spec === 'chara_card_v2' ? json.data : (json.data || json); 
        const name = data.name || "Imported Character";
        const description = data.description || "";
        const personality = data.personality || "";
        const scenario = data.scenario || "";
        const firstMes = data.first_mes || "Hello.";
        const mesExample = data.mes_example || "";
        const creatorNotes = data.creator_notes || "";
        const avatar = "https://ui-avatars.com/api/?name=" + encodeURIComponent(name) + "&background=random";

        const newChar: Character = {
           id: Math.random().toString(36).substr(2, 9),
           name: name,
           gender: 'female', 
           avatar: avatar,
           description: creatorNotes || description.slice(0, 100), 
           persona: `${description}\n\n${personality}`.trim(),
           appearance: "", 
           scenario: scenario, 
           examples: mesExample,
           greetings: [firstMes],
           expressionStyle: '', 
           habitualPhrases: '', 
           actionStyle: { enabled: true, narrativePerspective: 'third', detailLevel: 'medium', includeInnerThoughts: true, customFormatting: '' },
           voiceId: voices[0].id, 
           voiceFrequency: 'always', 
           maxReplyCount: 1, 
           proactiveChat: false,
           isNsfw: false, 
           model: 'gemini-3-flash-preview',
           config: DEFAULT_MODEL_CONFIG,
           personality: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 },
           relationship: { level: 1, xp: 0, nextLevelXp: 100, status: 'Stranger' },
           memories: [], 
           worldInfo: []
        };
        setCharacters(p => [...p, newChar]);
        alert(`✅ 成功导入角色: ${name}`);
      } catch (err) { 
          console.error(err);
          alert("❌ 导入失败: 文件格式不支持 (请使用 TavernAI/Chub JSON)"); 
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveGroup = (group: CharacterGroup) => { setGroups(prev => [...prev, group]); setIsCreatingGroup(false); };
  const handleDeleteCharacter = (id: string, name: string) => { if (confirm(`确定要删除 "${name}" 吗？`)) { setCharacters(prev => prev.filter(c => c.id !== id)); if (selectedSession?.id === id) setSelectedSession(null); } };
  const handleDeleteGroup = (id: string) => { if(confirm('解散该群组？')) { setGroups(prev => prev.filter(g => g.id !== id)); if (selectedSession?.id === id) setSelectedSession(null); } };
  const handleEditCharacter = (char: Character) => { setEditingCharacter(char); setIsCreating(true); };
  const handleSaveCharacter = (char: Character) => { if (editingCharacter) { setCharacters(prev => prev.map(c => c.id === char.id ? char : c)); } else { setCharacters(prev => [...prev, char]); } setIsCreating(false); setEditingCharacter(null); };
  const handleUpdateCharacter = (updatedChar: Character) => { setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c)); };

  const activeChar = selectedSession?.type === 'char' ? characters.find(c => c.id === selectedSession.id) : null;
  const activeGroup = selectedSession?.type === 'group' ? groups.find(g => g.id === selectedSession.id) : null;

  const downloadComfyScript = () => {
      const script = `@echo off
setlocal
title ANNIE ComfyUI Repair v7
echo ==================================================
echo  ANNIE - Ultimate Repair v7
echo ==================================================
echo.
echo [INFO] Locating Python Environment...
set "PYTHON_PATH=python"
if exist "python_embeded\\python.exe" ( set "PYTHON_PATH=python_embeded\\python.exe" )
echo Python Path: %PYTHON_PATH%

set "MAIN_SCRIPT=main.py"
if exist "ComfyUI\\main.py" ( set "MAIN_SCRIPT=ComfyUI\\main.py" )

echo.
echo [STEP 1] Force Installing CORS Dependencies...
"%PYTHON_PATH%" -m pip install aiohttp_cors -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn
"%PYTHON_PATH%" -m pip install PyExecJS natsort diffusers segment-anything opencv-python piexif soundfile aiohttp requests tqdm pyyaml fake-useragent -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn

echo.
echo [STEP 2] Launching with Aggressive CORS Policy...
echo.
echo  - Port: 8190
echo  - CORS: Allowed (*)
echo  - Listen: 0.0.0.0 (Network Accessible)
echo.
"%PYTHON_PATH%" -s "%MAIN_SCRIPT%" --windows-standalone-build --port 8190 --enable-cors-header "*" --listen 0.0.0.0
pause`;
      const blob = new Blob([script], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "run_annie_comfy_v7.bat";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const checkComfy = async () => {
     setComfyStatus('unknown');
     setComfyErrorMsg("");
     setComfyErrorType(undefined);
     
     let currentUrl = settings.comfyUrl.trim();
     if (!currentUrl.match(/^https?:\/\//)) {
         currentUrl = `http://${currentUrl}`;
         setSettings(s => ({...s, comfyUrl: currentUrl}));
     }

     const result = await testComfyConnection(currentUrl, settings.comfyConfig.skipNgrokWarning);
     if (result.success) {
         setComfyStatus('online');
         refreshComfyLists(currentUrl);
     } else {
         setComfyStatus('offline');
         setComfyErrorMsg(result.message || "未知错误");
         setComfyErrorType(result.errorType);
     }
  };

  const refreshComfyLists = async (url: string) => {
      const resources = await fetchComfyResources(url, settings.comfyConfig.skipNgrokWarning);
      if (resources) {
          setSettings(prev => ({
              ...prev,
              savedCheckpoints: resources.checkpoints,
              savedLoras: ['None', ...resources.loras],
              availableSamplers: resources.samplers,
              availableSchedulers: resources.schedulers
          }));
          alert(`✅ 列表刷新成功！\nFound ${resources.checkpoints.length} Models.`);
      } else {
          alert("⚠️ 连接正常，但获取模型列表失败。可能是 502/404 错误。");
      }
  };

  const applyWorkflowPreset = (preset: any) => {
      setSettings(prev => ({ ...prev, comfyConfig: { ...prev.comfyConfig, width: preset.width, height: preset.height, steps: preset.steps, cfg: preset.cfg, sampler: preset.sampler || prev.comfyConfig.sampler } }));
  };

  const checkOllama = async () => {
      setOllamaStatus('unknown');
      const baseUrl = settings.providerConfigs.ollama.baseUrl || 'http://127.0.0.1:11434';
      const models = await fetchOllamaModels(baseUrl);
      if (models.length > 0) {
          setOllamaStatus('online');
          setOllamaModels(models);
          if (!models.includes(settings.providerConfigs.ollama.model)) updateProviderConfig('ollama', { model: models[0] });
      } else {
          setOllamaStatus('offline');
      }
  };

  const updateProviderConfig = (provider: keyof AppSettings['providerConfigs'], update: any) => {
      setSettings(prev => ({ ...prev, providerConfigs: { ...prev.providerConfigs, [provider]: { ...(prev.providerConfigs[provider] as any), ...update } } }));
  };

  const getCurrentPort = () => { const match = settings.comfyUrl.match(/:(\d+)/); return match ? match[1] : '8190'; };
  const togglePort = () => {
      const current = getCurrentPort();
      const newPort = current === '8190' ? '8188' : '8190';
      let newUrl = settings.comfyUrl.replace(/:(\d+)/, `:${newPort}`);
      if (!newUrl.includes(`:${newPort}`)) newUrl = `http://127.0.0.1:${newPort}`;
      setSettings(s => ({...s, comfyUrl: newUrl}));
  };

  const getThemeStyles = () => {
     const mode = settings.theme.mode || 'dark';
     let baseStyles: any = {};
     if (mode === 'light') baseStyles = { '--bg-primary': '#f4f4f5', '--text-primary': '#18181b', '--text-secondary': '#71717a', '--glass-bg': `rgba(255, 255, 255, ${settings.theme.glassOpacity})`, '--glass-border': 'rgba(0,0,0,0.05)' };
     else if (mode === 'gray') baseStyles = { '--bg-primary': '#18181b', '--text-primary': '#e4e4e7', '--text-secondary': '#a1a1aa', '--glass-bg': `rgba(39, 39, 42, ${settings.theme.glassOpacity})`, '--glass-border': 'rgba(255,255,255,0.08)' };
     else baseStyles = { '--bg-primary': '#050505', '--text-primary': '#e5e5e5', '--text-secondary': '#a3a3a3', '--glass-bg': `rgba(20, 20, 23, ${settings.theme.glassOpacity})`, '--glass-border': 'rgba(255,255,255,0.08)' };
     return { ...baseStyles, '--neon-primary': settings.theme.primaryColor };
  };

  // Safe accessors
  const modelConfig = settings.modelPreset || DEFAULT_MODEL_CONFIG;
  const comfyConfig = settings.comfyConfig || DEFAULT_COMFY_CONFIG;
  const userPersona = settings.userPersona || DEFAULT_USER_PERSONA;

  return (
    <div className="h-[100dvh] w-full flex text-[var(--text-primary)] overflow-hidden font-sans selection:bg-pink-500/30 selection:text-pink-100 transition-colors duration-500" style={{ ...getThemeStyles(), backgroundColor: 'var(--bg-primary)' }}>
      {settings.theme.globalBackground && <div className="fixed inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none transition-opacity duration-1000" style={{ backgroundImage: `url(${settings.theme.globalBackground})` }} />}

      {/* Sidebar */}
      <div className={`w-full md:w-[320px] flex-shrink-0 flex flex-col h-full z-20 transition-all duration-300 bg-[#0c0c0e]/95 backdrop-blur-xl md:bg-transparent safe-pt ${selectedSession ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 md:p-6 pb-2">
            <div className="glass-panel rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-black/20">
              <div className="flex items-center space-x-3">
                 {/* REDESIGNED LOGO */}
                 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.5)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    <svg className="w-6 h-6 text-white drop-shadow-md transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                 </div>
                 <div>
                    <h1 className="text-xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-pink-100 to-purple-200">ANNIE</h1>
                    <p className="text-[10px] text-[var(--text-secondary)] font-mono tracking-widest opacity-70">AI COMPANION</p>
                 </div>
              </div>
              <button onClick={() => setShowSettings(true)} className="p-2 text-gray-400 hover:text-[var(--text-primary)] hover:bg-white/10 rounded-full transition-all active:scale-95">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 no-scrollbar pb-24">
            
            <div onClick={() => setShowMoments(true)} className="flex items-center p-3 rounded-2xl cursor-pointer bg-gradient-to-r from-pink-600/10 to-purple-600/10 border border-pink-500/20 hover:border-pink-500/40 transition-all group">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-105 transition-transform">⭕</div>
                <div className="ml-3 flex-1">
                    <p className="font-bold text-sm text-[var(--text-primary)]">朋友圈 (Moments)</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">查看 {characters.length} 位角色的动态</p>
                </div>
                {moments.length > 0 && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>}
            </div>
            
            {/* DMs / Characters / Agents */}
            <div>
                <div className="px-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                    <span>会话列表 (Chats)</span>
                    <div className="flex gap-2">
                        <button onClick={() => fileImportRef.current?.click()} className="text-[10px] hover:text-white bg-white/5 px-2 py-1 rounded border border-white/10" title="导入角色卡 (JSON)">📥 导入</button>
                        <input type="file" ref={fileImportRef} className="hidden" accept=".json" onChange={handleImportCharacter} />
                        <button onClick={() => { setEditingCharacter(null); setIsCreating(true); }} className="text-lg hover:text-white transition-transform active:scale-90">+</button>
                    </div>
                </div>
                <div className="space-y-2">
                    {characters.map(char => {
                        const isAgent = char.agentConfig?.enabled;
                        return (
                          <div 
                            key={char.id} 
                            onClick={() => setSelectedSession({type: 'char', id: char.id})} 
                            className={`group relative flex items-center p-3 rounded-2xl cursor-pointer transition-all active:scale-98 ${selectedSession?.id === char.id ? 'bg-white/10 border border-white/10 shadow-lg' : 'bg-white/5 border border-transparent hover:bg-white/10'} ${isAgent ? 'border-l-2 border-l-blue-500 bg-blue-900/5' : ''}`}
                          >
                            <div className="relative shrink-0">
                                <img src={char.avatar} className={`w-12 h-12 rounded-xl object-cover ${isAgent ? 'ring-2 ring-blue-500/50' : ''}`} />
                                {char.isNsfw && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0c0c0e]"></div>}
                                {isAgent && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-[#0c0c0e] flex items-center justify-center text-[8px]">🤖</div>}
                            </div>
                            <div className="flex-1 ml-4 overflow-hidden min-w-0 mr-4">
                                <div className="flex items-center gap-1">
                                    <p className={`font-bold text-sm truncate ${isAgent ? 'text-blue-300' : 'text-[var(--text-primary)]'}`}>{char.name}</p>
                                    {isAgent && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 rounded">Agent</span>}
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] truncate">{char.description}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(char.id, char.name); }} className="absolute right-2 p-2 text-gray-500 hover:text-red-500 hover:bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10" title="删除角色"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7M10 11v6m4-6v6M1 7h22M8 7V4a1 1 0 011-1h6a1 1 0 011 1v3" /></svg></button>
                          </div>
                        );
                    })}
                    {characters.length === 0 && <div className="text-center text-xs text-gray-500 py-4">暂无角色，点击 + 创建</div>}
                </div>
            </div>

            {/* Groups */}
            <div>
                <div className="px-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                    <span>群聊 Groups</span>
                    <button onClick={() => setIsCreatingGroup(true)} className="text-lg hover:text-white">+</button>
                </div>
                <div className="space-y-2">
                    {groups.map(group => (
                      <div 
                        key={group.id} 
                        onClick={() => setSelectedSession({type: 'group', id: group.id})} 
                        className={`group relative flex items-center p-3 rounded-2xl cursor-pointer transition-all active:scale-98 ${selectedSession?.id === group.id ? 'bg-white/10 border border-white/10 shadow-lg' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                      >
                        <div className="relative shrink-0">
                           <div className="w-12 h-12 rounded-xl bg-gray-800 grid grid-cols-2 gap-0.5 overflow-hidden">
                               {group.members.slice(0, 4).map(mid => <img key={mid} src={characters.find(c => c.id === mid)?.avatar} className="w-full h-full object-cover" />)}
                           </div>
                        </div>
                        <div className="flex-1 ml-4 overflow-hidden min-w-0 mr-4">
                           <p className="font-bold text-sm truncate text-[var(--text-primary)]">{group.name}</p>
                           <p className="text-[11px] text-[var(--text-secondary)] truncate">{group.members.length} members</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} className="absolute right-2 p-2 text-gray-500 hover:text-red-500 hover:bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7M10 11v6m4-6v6" /></svg></button>
                      </div>
                    ))}
                    {groups.length === 0 && <div className="text-center text-xs text-gray-500 py-4">暂无群聊</div>}
                </div>
            </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative flex flex-col h-full bg-[var(--bg-primary)] z-0 shadow-2xl overflow-hidden">
        {activeChar ? (
          <ChatWindow 
            key={activeChar.id} 
            mode="single" 
            sessionData={activeChar} 
            voiceProfile={voices.find(v => v.id === activeChar.voiceId)} 
            onBack={() => setSelectedSession(null)} 
            onOpenLive={() => setIsLiveOpen(true)} 
            onEdit={() => handleEditCharacter(activeChar)} 
            appSettings={settings} 
            allCharacters={characters} 
            onUpdateSettings={(newSettings) => setSettings(newSettings)} 
            onUpdateCharacter={handleUpdateCharacter} 
          />
        ) : activeGroup ? (
           <ChatWindow key={activeGroup.id} mode="group" sessionData={activeGroup} onBack={() => setSelectedSession(null)} onOpenLive={() => {}} appSettings={settings} allCharacters={characters} onUpdateGroup={(g) => setGroups(prev => prev.map(pg => pg.id === g.id ? g : pg))} onUpdateSettings={(newSettings) => setSettings(newSettings)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50 hidden md:flex">
             <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-[0_0_40px_rgba(236,72,153,0.3)] animate-pulse">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
             </div>
             <h2 className="text-3xl font-black text-white tracking-tight">ANNIE AI</h2>
             <p className="text-sm mt-3 text-gray-400 max-w-xs leading-relaxed">Local First • Privacy Focused • Limitless</p>
             <div className="mt-8 flex gap-4">
                 <button onClick={() => setIsCreating(true)} className="px-8 py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full text-white font-bold hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all active:scale-95">创建角色</button>
             </div>
          </div>
        )}
      </div>

      {/* Settings Overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
          <div className="w-full h-full md:max-w-6xl md:h-[85vh] bg-[#09090b] md:rounded-[2rem] flex flex-col md:flex-row overflow-hidden relative animate-enter safe-pb text-gray-200 shadow-2xl border border-white/5">
            {/* Settings Sidebar */}
            <div className="w-full md:w-64 bg-[#0c0c0e] border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible shrink-0 no-scrollbar z-10">
                <div className="hidden md:block px-4 mb-6 mt-4"><h2 className="text-xl font-black text-white">系统设置</h2></div>
                {[
                    { id: 'connect', icon: '🔌', label: 'API 连接' },
                    { id: 'model', icon: '🧠', label: '模型参数' },
                    { id: 'comfy', icon: '🎨', label: '绘图' },
                    { id: 'user', icon: '👤', label: '用户人设' },
                    { id: 'theme', icon: '✨', label: '主题' },
                    { id: 'help', icon: '📘', label: '安装与帮助' }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setSettingsTab(tab.id as any)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-xs font-bold whitespace-nowrap ${settingsTab === tab.id ? 'bg-pink-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                        <span className="text-lg">{tab.icon}</span><span>{tab.label}</span>
                    </button>
                ))}
                <div className="mt-auto hidden md:block pt-4 border-t border-white/5 px-4"><button onClick={() => setShowSettings(false)} className="flex items-center gap-2 text-xs text-gray-500 hover:text-white"><span>←</span> 返回</button></div>
            </div>
            <button onClick={() => setShowSettings(false)} className="md:hidden absolute top-4 right-4 z-50 p-2 bg-black/50 backdrop-blur rounded-full text-white border border-white/10">✕</button>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-24 md:pb-6 bg-[#09090b] h-full">
                {settingsTab === 'help' && (
                  <div className="space-y-8 max-w-3xl animate-enter">
                     {/* Install Section */}
                     <section>
                        <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                            <span>⬇️</span> 安装指南 (Install)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Windows/Android PWA */}
                            <div className="bg-[#18181b] p-5 rounded-2xl border border-white/5 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-bold text-gray-200 mb-2">Windows / Android</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                                        推荐使用 Chrome 或 Edge 浏览器。点击下方按钮或地址栏右侧的图标，将 ANNIE 安装为原生应用。
                                    </p>
                                </div>
                                <button 
                                    onClick={handleInstallApp}
                                    disabled={!installPrompt}
                                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${installPrompt ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}
                                >
                                    {installPrompt ? '🖥️ 点击安装 (Install PWA)' : '✅ 已安装 / 不支持'}
                                </button>
                            </div>
                            
                            {/* iOS */}
                            <div className="bg-[#18181b] p-5 rounded-2xl border border-white/5">
                                <h4 className="font-bold text-gray-200 mb-2">iOS (iPhone / iPad)</h4>
                                <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
                                    <li>使用 <strong>Safari</strong> 浏览器打开本页。</li>
                                    <li>点击底部中间的 <strong>分享 (Share)</strong> 按钮图标。</li>
                                    <li>向下滑动，找到并点击 <strong>添加到主屏幕 (Add to Home Screen)</strong>。</li>
                                    <li>回到桌面即可全屏运行。</li>
                                </ol>
                            </div>
                        </div>
                     </section>

                     {/* Features Section */}
                     <section>
                        <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                            <span>✨</span> 功能介绍 (Features)
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                                { icon: '💬', title: '沉浸式对话', desc: '支持长短期记忆、世界书、多模态收发。' },
                                { icon: '📞', title: '实时语音', desc: '基于 Gemini Live 的低延迟语音通话。' },
                                { icon: '🎨', title: 'ComfyUI 绘图', desc: '本地连接 ComfyUI，为角色生成自拍。' },
                                { icon: '🦜', title: '声音克隆', desc: '支持 GPT-SoVITS, Fish Speech 等模型克隆音色。' },
                                { icon: '👁️', title: '视觉感知', desc: '让 AI 看见你的摄像头或屏幕内容。' },
                                { icon: '🤖', title: 'Agent 智能体', desc: '联网搜索、使用工具、执行复杂任务。' }
                            ].map((f, i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="text-2xl mb-2">{f.icon}</div>
                                    <div className="font-bold text-sm text-gray-200">{f.title}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">{f.desc}</div>
                                </div>
                            ))}
                        </div>
                     </section>

                     {/* Tutorials / FAQ Section */}
                     <section>
                        <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                            <span>📚</span> 使用教程 (Tutorials)
                        </h3>
                        <div className="space-y-2">
                            <details className="bg-[#18181b] rounded-xl border border-white/5 group">
                                <summary className="p-4 font-bold text-sm cursor-pointer flex justify-between items-center text-gray-300 group-open:text-white">
                                    <span>如何连接本地 ComfyUI 进行绘图？</span>
                                    <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="px-4 pb-4 text-xs text-gray-400 space-y-2 leading-relaxed border-t border-white/5 pt-2">
                                    <p>1. 确保已安装 ComfyUI 及其必要的节点（推荐使用秋叶启动器）。</p>
                                    <p>2. 为了允许网页访问本地服务，启动 ComfyUI 时必须添加跨域参数：<code>--listen 0.0.0.0 --enable-cors-header "*"</code>。</p>
                                    <p>3. 如果您不知道如何添加参数，请在“设置 -> 绘图 -> 无法连接”中下载我们提供的<strong>一键修复脚本 (bat)</strong>，把它放在 ComfyUI 根目录运行即可。</p>
                                    <p>4. 推荐使用 Ngrok 穿透或将浏览器地址改为 localhost 以获得最佳体验。</p>
                                </div>
                            </details>

                            <details className="bg-[#18181b] rounded-xl border border-white/5 group">
                                <summary className="p-4 font-bold text-sm cursor-pointer flex justify-between items-center text-gray-300 group-open:text-white">
                                    <span>如何使用声音克隆 (Clone Voice)？</span>
                                    <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="px-4 pb-4 text-xs text-gray-400 space-y-2 leading-relaxed border-t border-white/5 pt-2">
                                    <p>1. 在角色编辑页面，点击“管理音色库”。</p>
                                    <p>2. 点击“新建配置”，将“推理后端”选择为 <strong>GPT-SoVITS</strong> 或 <strong>Fish Speech</strong> (取决于你本地部署了哪个)。</p>
                                    <p>3. 如果没有本地模型，请点击“本地模型部署”查看 Docker/脚本部署指南。</p>
                                    <p>4. 在“克隆工坊”区域，上传一段 3-10 秒的干声（无背景音乐的人声），并填入这段音频对应的文字内容。</p>
                                    <p>5. 保存配置后，选中该音色即可使用。</p>
                                </div>
                            </details>

                            <details className="bg-[#18181b] rounded-xl border border-white/5 group">
                                <summary className="p-4 font-bold text-sm cursor-pointer flex justify-between items-center text-gray-300 group-open:text-white">
                                    <span>如何开启 NSFW 模式？</span>
                                    <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="px-4 pb-4 text-xs text-gray-400 space-y-2 leading-relaxed border-t border-white/5 pt-2">
                                    <p>1. 编辑任意角色。</p>
                                    <p>2. 切换到顶部的 <strong>高级 (Adv)</strong> 标签页。</p>
                                    <p>3. 在“高级功能开关”区域，找到 <strong>NSFW 模式</strong> 并开启。</p>
                                    <p>注意：这仅是向模型发送解除限制的 Prompt，实际效果取决于底层模型的安全过滤等级。</p>
                                </div>
                            </details>
                            
                            <details className="bg-[#18181b] rounded-xl border border-white/5 group">
                                <summary className="p-4 font-bold text-sm cursor-pointer flex justify-between items-center text-gray-300 group-open:text-white">
                                    <span>数据存储在哪里？安全吗？</span>
                                    <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="px-4 pb-4 text-xs text-gray-400 space-y-2 leading-relaxed border-t border-white/5 pt-2">
                                    <p>ANNIE 是一款<strong>本地优先 (Local First)</strong> 的应用。</p>
                                    <p>所有角色数据、聊天记录、设置信息都存储在您浏览器的 <strong>LocalStorage (本地缓存)</strong> 中。</p>
                                    <p>我们没有后台服务器，不会上传您的聊天数据。API Key 仅在您与服务商通信时使用，直连官方接口。</p>
                                </div>
                            </details>
                        </div>
                     </section>
                     
                     <div className="text-center text-[10px] text-gray-600 pt-8 pb-4">
                         {APP_VERSION} • Built with ❤️ by ANNIE Team
                     </div>
                  </div>
                )}

                {settingsTab === 'comfy' && (
                    <div className="space-y-6 max-w-4xl animate-enter">
                         <div className="flex items-center justify-between">
                            <div><h3 className="text-lg font-bold text-white">ComfyUI 图像生成</h3></div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={settings.enableComfyUI} onChange={e => setSettings(s => ({...s, enableComfyUI: e.target.checked}))} />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                            </label>
                         </div>

                         {settings.enableComfyUI && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Connection Panel */}
                                <div className="bg-[#18181b] p-5 rounded-3xl border border-white/5 space-y-4 md:col-span-2">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-sm text-gray-300 flex items-center gap-2">🔌 连接状态 (Connection)</h4>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${comfyStatus === 'online' ? 'bg-green-500/20 text-green-400' : comfyStatus === 'offline' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>{comfyStatus.toUpperCase()}</span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input value={settings.comfyUrl} onChange={e => setSettings(s => ({...s, comfyUrl: e.target.value}))} className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-500 font-mono" placeholder="http://127.0.0.1:8190" />
                                            <button onClick={togglePort} className="px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-gray-300 hover:text-white hover:bg-white/10">端口切换</button>
                                            <button onClick={checkComfy} className="px-6 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold text-white transition-all shadow-lg">连接</button>
                                        </div>
                                        <p className="text-[10px] text-gray-500 pl-1">推荐使用: <code className="text-gray-300">http://127.0.0.1:8190</code> (TATA) 或 <code className="text-gray-300">8188</code>。请勿使用 0.0.0.0</p>
                                        
                                        {/* Browser Blocking Troubleshooter */}
                                        {comfyStatus === 'offline' && (
                                            <div className={`p-4 rounded-xl space-y-3 mt-4 animate-enter ${comfyErrorType === 'ngrok_interstitial' ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                                                <h4 className={`font-bold text-sm flex items-center gap-2 ${comfyErrorType === 'ngrok_interstitial' ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {comfyErrorType === 'ngrok_interstitial' ? '⚠️ Ngrok 安全拦截 (Action Required)' : '🚫 浏览器拦截诊断 (Connection Error)'}
                                                </h4>
                                                
                                                <div className="text-xs text-gray-300 space-y-2">
                                                    {comfyErrorMsg}
                                                </div>

                                                {/* Advanced Toggle for Header Control */}
                                                <div className="pt-2 mt-2 border-t border-white/10">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-gray-400">Ngrok 兼容模式 (Skip Warning Header)</span>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" checked={settings.comfyConfig.skipNgrokWarning ?? true} onChange={e => setSettings(s => ({...s, comfyConfig: {...s.comfyConfig, skipNgrokWarning: e.target.checked}}))} />
                                                            <div className="w-7 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:bg-green-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-full"></div>
                                                        </label>
                                                    </div>
                                                    <p className="text-[9px] text-gray-500 mt-1">开启可跳过 Ngrok 警告页 (需要服务器支持跨域)。如果遇到 CORS 错误，请尝试关闭此项并手动点击下方授权按钮。</p>
                                                </div>

                                                {comfyErrorType === 'ngrok_interstitial' || !settings.comfyConfig.skipNgrokWarning ? (
                                                    <button 
                                                        onClick={() => window.open(settings.comfyUrl, '_blank')} 
                                                        className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg animate-pulse mt-2"
                                                    >
                                                        👉 手动授权 Ngrok (在新标签页点击 "Visit Site")
                                                    </button>
                                                ) : (
                                                    <div className="grid grid-cols-1 gap-2 pt-2">
                                                        <button onClick={() => setSettings(s => ({...s, comfyUrl: `http://localhost:${getCurrentPort()}`}))} className="flex items-center justify-between px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs transition-all text-blue-200 group">
                                                            <span className="font-bold">方案 A (推荐): 切换为 localhost</span>
                                                            <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded text-white group-hover:scale-105">尝试切换</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="bg-blue-900/10 border border-blue-500/20 p-3 rounded-xl mt-2 flex flex-col gap-2">
                                        <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-blue-300">💡 无法连接？</span></div>
                                        <button onClick={downloadComfyScript} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"><span>📥</span> 下载修复脚本 (v7)</button>
                                    </div>
                                </div>
                                {/* ... Other Comfy UI blocks (Model Selection, Params) ... */}
                                <div className="bg-[#18181b] p-5 rounded-3xl border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-sm text-gray-300">📦 模型选择 (Models)</h4>
                                        <button onClick={() => refreshComfyLists(settings.comfyUrl)} className="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-gray-400 transition-colors">
                                            ↻ 刷新列表
                                        </button>
                                    </div>
                                    
                                    <div>
                                        <label className="text-xs font-bold text-gray-500">主模型 (Checkpoint)</label>
                                        <select 
                                            value={comfyConfig.checkpoint} 
                                            onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, checkpoint: e.target.value}}))}
                                            className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500"
                                        >
                                            {settings.savedCheckpoints.map(ckpt => <option key={ckpt} value={ckpt}>{ckpt}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-white/5">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-bold text-gray-500">LoRA 1</label>
                                            <span className="text-[10px] text-purple-400">{comfyConfig.lora1_strength.toFixed(1)}</span>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <select 
                                                value={comfyConfig.lora1} 
                                                onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, lora1: e.target.value}}))}
                                                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none"
                                            >
                                                {settings.savedLoras.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                            <input type="range" min="0" max="2" step="0.1" value={comfyConfig.lora1_strength} onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, lora1_strength: parseFloat(e.target.value)}}))} className="w-16 accent-purple-500" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-xs font-bold text-gray-500">LoRA 2</label>
                                            <span className="text-[10px] text-purple-400">{comfyConfig.lora2_strength.toFixed(1)}</span>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <select 
                                                value={comfyConfig.lora2} 
                                                onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, lora2: e.target.value}}))}
                                                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none"
                                            >
                                                {settings.savedLoras.map(l => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                            <input type="range" min="0" max="2" step="0.1" value={comfyConfig.lora2_strength} onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, lora2_strength: parseFloat(e.target.value)}}))} className="w-16 accent-purple-500" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#18181b] p-5 rounded-3xl border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-sm text-gray-300">⚙️ 生成参数 (Parameters)</h4>
                                        <select 
                                            className="text-[10px] bg-white/5 border border-white/10 rounded px-2 py-1 outline-none focus:border-purple-500 text-gray-300"
                                            onChange={(e) => {
                                                const preset = WORKFLOW_PRESETS.find(p => p.label === e.target.value);
                                                if (preset) applyWorkflowPreset(preset);
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled>⚡ 快速设置 / 工作流预设</option>
                                            {WORKFLOW_PRESETS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500">Width</label>
                                            <input type="number" value={comfyConfig.width} onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, width: parseInt(e.target.value)}}))} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-center" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500">Height</label>
                                            <input type="number" value={comfyConfig.height} onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, height: parseInt(e.target.value)}}))} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-center" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500">Steps</label>
                                            <input type="number" value={comfyConfig.steps} onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, steps: parseInt(e.target.value)}}))} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-center" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500">CFG</label>
                                            <input type="number" value={comfyConfig.cfg} onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, cfg: parseFloat(e.target.value)}}))} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-center" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500">Sampler</label>
                                            <select value={comfyConfig.sampler} onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, sampler: e.target.value}}))} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs">
                                                {settings.availableSamplers.map(sa => <option key={sa} value={sa}>{sa}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500">Scheduler</label>
                                            <select value={comfyConfig.scheduler} onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, scheduler: e.target.value}}))} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs">
                                                {settings.availableSchedulers.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-[#18181b] p-5 rounded-3xl border border-white/5 space-y-4 md:col-span-2">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-bold text-gray-500">全局正面提示词 (Global Positive Prompt)</label>
                                            <select 
                                                className="text-[10px] bg-white/5 border border-white/10 rounded px-2 py-0.5 outline-none focus:border-purple-500 text-gray-400"
                                                onChange={(e) => setSettings(s => ({...s, comfyConfig: {...comfyConfig, globalPositivePrompt: e.target.value}}))}
                                            >
                                                <option value="">快速填入...</option>
                                                {POSITIVE_PROMPT_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                            </select>
                                        </div>
                                        <textarea 
                                            rows={2}
                                            value={comfyConfig.globalPositivePrompt || ''}
                                            onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, globalPositivePrompt: e.target.value}}))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-purple-500 placeholder-gray-600"
                                            placeholder="masterpiece, best quality, etc... (会自动添加到所有绘图请求的最前面)"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">默认负面提示词 (Default Negative Prompt)</label>
                                        <textarea 
                                            rows={3}
                                            value={comfyConfig.defaultNegativePrompt}
                                            onChange={e => setSettings(s => ({...s, comfyConfig: {...comfyConfig, defaultNegativePrompt: e.target.value}}))}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-purple-500"
                                        />
                                    </div>
                                </div>
                             </div>
                         )}
                    </div>
                )}
                {/* ... other tabs ... */}
                {settingsTab === 'connect' && (
                    <div className="space-y-6 max-w-2xl animate-enter">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-white">API 服务商 (Provider)</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {['gemini', 'ollama', 'openai-compatible', 'tata-core'].map(p => (
                                    <button 
                                        key={p}
                                        onClick={() => setSettings(s => ({...s, apiProvider: p as any}))}
                                        className={`p-3 rounded-xl border text-xs font-bold capitalize transition-all ${settings.apiProvider === p ? 'bg-pink-600/20 border-pink-500 text-pink-300' : 'bg-white/5 border-transparent text-gray-400'}`}
                                    >
                                        {p === 'openai-compatible' ? 'OpenAI / 其他' : p === 'tata-core' ? 'TATA 后端' : p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {settings.apiProvider === 'gemini' && (
                            <div className="bg-[#18181b] p-5 rounded-2xl border border-white/5 space-y-4">
                                <h4 className="font-bold text-sm text-gray-300">Gemini 官方 API</h4>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">API 密钥 (Key)</label>
                                    <input type="password" value={settings.providerConfigs.gemini.apiKey} onChange={e => updateProviderConfig('gemini', {apiKey: e.target.value})} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500" placeholder="AIza..." />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">模型名称 (Model)</label>
                                    <input value={settings.providerConfigs.gemini.model} onChange={e => updateProviderConfig('gemini', {model: e.target.value})} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500" placeholder="gemini-2.0-flash-exp" />
                                </div>
                            </div>
                        )}

                        {/* Other provider settings... */}
                        {settings.apiProvider === 'ollama' && (
                            <div className="bg-[#18181b] p-5 rounded-2xl border border-white/5 space-y-4">
                                <h4 className="font-bold text-sm text-gray-300 flex justify-between items-center">
                                    <span>Ollama 本地服务</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded ${ollamaStatus === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{ollamaStatus}</span>
                                </h4>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">服务地址 (Base URL)</label>
                                    <div className="flex gap-2">
                                        <input value={settings.providerConfigs.ollama.baseUrl} onChange={e => updateProviderConfig('ollama', {baseUrl: e.target.value})} className="flex-1 mt-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500" />
                                        <button onClick={checkOllama} className="mt-1 px-4 bg-white/5 rounded-xl text-xs font-bold hover:bg-white/10 border border-white/10">检测</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">选择模型 (Model)</label>
                                    <select value={settings.providerConfigs.ollama.model} onChange={e => updateProviderConfig('ollama', {model: e.target.value})} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500">
                                        {ollamaModels.length > 0 ? ollamaModels.map(m => <option key={m} value={m}>{m}</option>) : <option value="llama3">llama3</option>}
                                    </select>
                                </div>
                            </div>
                        )}

                        {(settings.apiProvider === 'openai-compatible' || settings.apiProvider === 'tata-core') && (
                             <div className="bg-[#18181b] p-5 rounded-2xl border border-white/5 space-y-4">
                                <h4 className="font-bold text-sm text-gray-300">{settings.apiProvider === 'tata-core' ? 'TATA 核心后端' : 'OpenAI 兼容接口 (如 DeepSeek)'}</h4>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">服务地址 (Base URL)</label>
                                    <input value={settings.providerConfigs[settings.apiProvider].baseUrl} onChange={e => updateProviderConfig(settings.apiProvider as any, {baseUrl: e.target.value})} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500" placeholder="https://api.deepseek.com/v1" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">API 密钥 (Key)</label>
                                    <input type="password" value={settings.providerConfigs[settings.apiProvider].apiKey} onChange={e => updateProviderConfig(settings.apiProvider as any, {apiKey: e.target.value})} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">模型 ID (Model ID)</label>
                                    <input value={settings.providerConfigs[settings.apiProvider].model} onChange={e => updateProviderConfig(settings.apiProvider as any, {model: e.target.value})} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500" placeholder="deepseek-chat" />
                                </div>
                             </div>
                        )}
                    </div>
                )}

                {settingsTab === 'model' && (
                    <div className="space-y-6 max-w-2xl animate-enter">
                         <h3 className="text-lg font-bold text-white">全局模型参数</h3>
                         <div className="bg-[#18181b] p-5 rounded-2xl border border-white/5 space-y-6">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-500">随机性 (Temperature)</label>
                                    <span className="text-xs font-mono text-pink-400">{modelConfig.temperature}</span>
                                </div>
                                <input type="range" min="0" max="2" step="0.1" value={modelConfig.temperature} onChange={e => setSettings(s => ({...s, modelPreset: {...modelConfig, temperature: parseFloat(e.target.value)}}))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-pink-500" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-500">核采样 (Top P)</label>
                                    <span className="text-xs font-mono text-pink-400">{modelConfig.topP}</span>
                                </div>
                                <input type="range" min="0" max="1" step="0.05" value={modelConfig.topP} onChange={e => setSettings(s => ({...s, modelPreset: {...modelConfig, topP: parseFloat(e.target.value)}}))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-pink-500" />
                            </div>
                             <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-500">候选集 (Top K)</label>
                                    <span className="text-xs font-mono text-pink-400">{modelConfig.topK}</span>
                                </div>
                                <input type="range" min="1" max="100" step="1" value={modelConfig.topK} onChange={e => setSettings(s => ({...s, modelPreset: {...modelConfig, topK: parseInt(e.target.value)}}))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-pink-500" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block">全局系统提示词</label>
                                <textarea 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500 h-24 resize-none"
                                    value={modelConfig.systemInstruction || ''}
                                    onChange={e => setSettings(s => ({...s, modelPreset: {...modelConfig, systemInstruction: e.target.value}}))}
                                    placeholder="所有角色都会生效的底层指令..."
                                />
                            </div>
                         </div>
                    </div>
                )}

                {/* User Tab */}
                {settingsTab === 'user' && (
                    <div className="space-y-6 max-w-2xl animate-enter">
                         <h3 className="text-lg font-bold text-white">用户形象</h3>
                         <div className="bg-[#18181b] p-5 rounded-2xl border border-white/5 space-y-4">
                            <div className="flex items-center gap-4">
                                <img src={userPersona.avatar} className="w-16 h-16 rounded-full border-2 border-pink-500/30" />
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500">头像链接 (Avatar URL)</label>
                                    <input value={userPersona.avatar} onChange={e => setSettings(s => ({...s, userPersona: {...userPersona, avatar: e.target.value}}))} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">昵称 (Name)</label>
                                <input value={userPersona.name} onChange={e => setSettings(s => ({...s, userPersona: {...userPersona, name: e.target.value}}))} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">自我描述 (Description)</label>
                                <textarea rows={3} value={userPersona.description} onChange={e => setSettings(s => ({...s, userPersona: {...userPersona, description: e.target.value}}))} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500" placeholder="例如：我是一个喜欢科幻电影的程序员..." />
                            </div>
                         </div>
                    </div>
                )}

                {/* Theme Tab */}
                {settingsTab === 'theme' && (
                    <div className="space-y-6 max-w-2xl animate-enter">
                        <h3 className="text-lg font-bold text-white">界面主题</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {['dark', 'light', 'gray'].map(m => (
                                <button 
                                    key={m}
                                    onClick={() => setSettings(s => ({...s, theme: {...s.theme, mode: m as any}}))}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 capitalize font-bold ${settings.theme.mode === m ? 'border-pink-500 bg-pink-500/10 text-pink-300' : 'border-white/10 bg-white/5 text-gray-400'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full border ${m === 'light' ? 'bg-white border-gray-300' : m === 'gray' ? 'bg-zinc-800 border-zinc-600' : 'bg-black border-white/20'}`}></div>
                                    {m === 'dark' ? '深色模式' : m === 'light' ? '浅色模式' : '极简灰'}
                                </button>
                            ))}
                        </div>
                        
                        <div className="bg-[#18181b] p-5 rounded-2xl border border-white/5 space-y-4">
                             <div>
                                <label className="text-xs font-bold text-gray-500">自定义背景图 (Global Background)</label>
                                <input value={settings.theme.globalBackground} onChange={e => setSettings(s => ({...s, theme: {...s.theme, globalBackground: e.target.value}}))} className="w-full mt-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500" placeholder="https://..." />
                             </div>
                             <div>
                                <label className="text-xs font-bold text-gray-500">磨砂透明度 (Glass Opacity)</label>
                                <input type="range" min="0" max="1" step="0.05" value={settings.theme.glassOpacity} onChange={e => setSettings(s => ({...s, theme: {...s.theme, glassOpacity: parseFloat(e.target.value)}}))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none accent-pink-500 mt-2" />
                             </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
      
      {/* ... Rest of App ... */}
      {isCreating && <CharacterForm initialData={editingCharacter || undefined} voices={voices} onSave={c => handleSaveCharacter(c)} onCancel={() => { setIsCreating(false); setEditingCharacter(null); }} onSaveVoice={(v) => setVoices(prev => [...prev.filter(x => x.id !== v.id), v])} onDeleteVoice={(id) => setVoices(prev => prev.filter(v => v.id !== id))} />}
      {isCreatingGroup && <GroupCreator characters={characters} onSave={handleSaveGroup} onCancel={() => setIsCreatingGroup(false)} />}
      {showMoments && <MomentsFeed moments={moments} characters={characters} settings={settings} onClose={() => setShowMoments(false)} onUpdateMoments={setMoments} />}
      {isLiveOpen && activeChar && <LiveAudioOverlay character={activeChar} voiceProfile={voices.find(v => v.id === activeChar.voiceId)} onClose={() => setIsLiveOpen(false)} />}
    </div>
  );
};

export default App;
