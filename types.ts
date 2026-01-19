
export enum VoiceName {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export type TTSProvider = 'gemini' | 'gpt-sovits' | 'fish-speech' | 'chat-tts' | 'openai-compatible' | 'custom-json';
export type VoiceFrequency = 'always' | 'occasionally' | 'never';

export interface VoiceProfile {
  id: string;
  name: string;
  provider: TTSProvider;
  baseVoice: VoiceName;
  stylePrompt: string;
  apiUrl?: string;
  apiKey?: string;
  speed?: number;
  sampleAudio?: string; 
  sampleText?: string;  
  modelId?: string; 
  voiceId?: string; 
  customMethod?: 'GET' | 'POST';
  customBody?: string; 
  tags?: string[];
}

export interface ModelConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  contextLimit: number;
  stopSequences: string[];
  systemInstruction: string;
  // TATA Specific
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface PersonalityConfig {
  openness: number;      
  conscientiousness: number; 
  extraversion: number;  
  agreeableness: number; 
  neuroticism: number;   
}

export interface RelationshipState {
  level: number;       
  xp: number;          
  nextLevelXp: number; 
  status: string;
  balance?: number; 
}

export interface MemoryEntry {
  id: string;
  content: string;     
  importance: number;  
  createdAt: number;
}

export interface WorldInfoEntry {
  id: string;
  keys: string[];      
  content: string;     
  enabled: boolean;
  insertionStrategy?: 'prepend' | 'append';
}

export interface Sticker {
  id: string;
  url: string;
  tags: string[]; 
  isDynamic: boolean; 
}

export interface Live2DConfig {
  enable: boolean;
  idleVideoUrl: string;   
  talkVideoUrl: string;   
  scale: number;          
  offsetX: number;        
  offsetY: number;        
  removeBgMode: 'none' | 'screen' | 'multiply' | 'plus-lighter'; 
}

export interface ActionStyleConfig {
  enabled: boolean;
  narrativePerspective: 'first' | 'third' | 'none'; // 我/TA
  detailLevel: 'low' | 'medium' | 'high'; // 简洁/适中/细腻
  includeInnerThoughts: boolean; // 是否包含心理活动
  customFormatting: string; // 自定义格式，例如 *action*
}

export interface AgentConfig {
  enabled: boolean;
  role: 'companion' | 'assistant' | 'executor';
  allowedTools: string[]; 
  openManusEndpoint?: string;
  // Expanded Settings
  thinkingBudget: number; // 思考 token 预算
  maxSteps: number; // 最大循环步数
  requireApproval: boolean; // 敏感操作是否需要用户确认
  keepWorkingMemory: boolean; // 是否保留短期思考缓存
}

export interface Character {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'non-binary' | 'other';
  avatar: string;
  description: string; 
  persona: string;
  appearance: string; 
  scenario: string;
  examples: string;
  greetings: string[];
  
  expressionStyle: string; 
  habitualPhrases: string; 
  
  // Updated Action Style
  actionStyle: ActionStyleConfig | string; // Compatibility union type
  
  voiceId: string;
  voiceFrequency: VoiceFrequency; 
  maxReplyCount: number; 
  proactiveChat: boolean; 
  useSearch?: boolean; 
  enableVisualPerception?: boolean; 
  
  isNsfw: boolean;
  model: string;
  config: ModelConfig; 
  personality: PersonalityConfig;
  relationship: RelationshipState;
  memories: MemoryEntry[]; 
  worldInfo: WorldInfoEntry[];
  
  backgroundImage?: string; 
  live2dConfig?: Live2DConfig; 
  sprites?: Record<string, string>; 
  chatSummary?: string; 
  
  // TATA Agent
  agentConfig?: AgentConfig;
  
  motionAvatarUrl?: string; 
}

export interface CharacterGroup {
  id: string;
  name: string;
  avatar: string;
  members: string[]; 
  description: string;
  scenario: string;
}

export interface UserPersona {
  name: string;
  avatar: string;
  description: string; 
  customPrompt: string; 
}

export interface ComfyNodeConfig {
  workflowType: 'anime' | 'realistic' | 'standard' | 'custom'; 
  checkpoint: string; 
  vae: string;
  lora1: string;
  lora1_strength: number;
  lora2: string;
  lora2_strength: number;
  sampler: string;
  scheduler: string; 
  steps: number;
  cfg: number;
  width: number;
  height: number;
  defaultNegativePrompt: string;
  globalPositivePrompt?: string; 
  customWorkflowJson?: string; 
  skipNgrokWarning?: boolean; 
}

export interface GenerationPreset {
  id: string;
  name: string;
  modelId: string; 
  config: ModelConfig; 
}

export interface ThemeConfig {
  mode: 'dark' | 'light' | 'gray'; 
  primaryColor: string; 
  accentColor: string;  
  globalBackground: string; 
  chatBackground: string; 
  glassOpacity: number;
  bubbleStyle: 'modern' | 'retro' | 'glass';
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AppSettings {
  enableComfyUI: boolean; 
  comfyUrl: string;
  comfyConfig: ComfyNodeConfig;
  savedCheckpoints: string[]; 
  savedLoras: string[];       
  availableSamplers: string[]; 
  availableSchedulers: string[]; 
  
  // TATA Core Providers
  apiProvider: 'gemini' | 'openai-compatible' | 'ollama' | 'tata-core';
  
  providerConfigs: {
    gemini: { apiKey: string; model: string };
    ollama: { baseUrl: string; model: string };
    'openai-compatible': { baseUrl: string; apiKey: string; model: string };
    'tata-core': { baseUrl: string; apiKey: string; model: string };
  };
  
  modelPreset: ModelConfig; 
  savedGenerationPresets: GenerationPreset[]; 
  
  useGoogleSearch: boolean;
  showNsfw: boolean;
  defaultTTSProvider: TTSProvider;
  
  userPersona: UserPersona; 
  theme: ThemeConfig;
  stickerLibrary: Sticker[];
}

export interface Attachment {
  id: string;
  type: 'image' | 'audio' | 'file' | 'sticker';
  base64: string;
  mimeType: string;
  name?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  senderId?: string; 
  senderName?: string;
  content: string; 
  timestamp: number;
  type: 'text' | 'image' | 'voice' | 'file' | 'sticker' | 'transaction' | 'system';
  imageUrl?: string; 
  audioData?: string; 
  audioDuration?: number; 
  fileData?: string; 
  fileName?: string;
  mimeType?: string;
  emotion?: string;
  isEdited?: boolean;
  transactionAmount?: number;
  sources?: { title: string; uri: string }[]; 
  activeLore?: string[]; 
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: number;
}

export interface Moment {
  id: string;
  characterId: string;
  content: string;
  imagePrompts?: string[];
  imageUrls?: string[];
  timestamp: number;
  likes: string[]; // List of user IDs who liked
  comments: Comment[];
}
