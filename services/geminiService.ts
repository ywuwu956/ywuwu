
import { GoogleGenAI, Modality, LiveServerMessage, LiveSession, Content, Part, Type } from "@google/genai";
import { Character, AppSettings, VoiceProfile, VoiceName, Message, Attachment, WorldInfoEntry, ActionStyleConfig } from "../types";

// --- Audio Utils ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const decodeAudioData = async (
  base64: string,
  ctx: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> => {
  try {
      if (!base64 || base64.length < 50) {
          throw new Error("Received empty or invalid audio data.");
      }
      
      if (base64.trim().startsWith('PCFET0NUW')) { 
          throw new Error("Server returned HTML. Check your port settings.");
      }

      const bytes = decode(base64);
      const dataInt16 = new Int16Array(bytes.buffer);
      const numChannels = 1;
      const frameCount = dataInt16.length / numChannels;
      const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
      }
      return buffer;
  } catch (e) {
      console.error("Audio Decode Error", e);
      throw e;
  }
};

export const createPcmBlob = (data: Float32Array): { data: string; mimeType: string } => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};

export const pingServer = async (url: string): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000);
        await fetch(url, { method: 'GET', signal: controller.signal }).catch(() => {});
        clearTimeout(id);
        return true; 
    } catch (e) {
        return false;
    }
};

export const startLiveSession = async (
  systemInstruction: string,
  voiceName: VoiceName,
  callbacks: {
    onAudio: (base64: string) => void;
    onTranscription: (text: string, isUser: boolean) => void;
    onInterrupted: () => void;
  }
): Promise<LiveSession> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: () => console.log('Live session connected'),
      onmessage: async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) callbacks.onAudio(base64Audio);
        if (message.serverContent?.outputTranscription?.text) callbacks.onTranscription(message.serverContent.outputTranscription.text, false);
        if (message.serverContent?.inputTranscription?.text) callbacks.onTranscription(message.serverContent.inputTranscription.text, true);
        if (message.serverContent?.interrupted) callbacks.onInterrupted();
      },
      onclose: () => console.log('Live session closed'),
      onerror: (e) => console.error('Live session error', e)
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
      systemInstruction: systemInstruction,
      inputAudioTranscription: {},
      outputAudioTranscription: {}
    },
  });
};

export interface AudioResult {
    type: 'base64' | 'url';
    data: string;
}

export const generateSpeech = async (text: string, voiceProfile: VoiceProfile): Promise<AudioResult | undefined> => {
   const cleanText = text.replace(/\*.*?\*/g, '').replace(/\(.*?\)/g, '').trim(); 
   if (!cleanText) return undefined;

   // 1. Gemini Native
   if (voiceProfile.provider === 'gemini') {
       const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
       const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: cleanText }] }],
            config: {
               responseModalities: [Modality.AUDIO],
               speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceProfile.baseVoice } } },
            },
        });
        const b64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return b64 ? { type: 'base64', data: b64 } : undefined;
   }

   // Prepare Headers
   const headers: Record<string, string> = { 'Content-Type': 'application/json' };
   if (voiceProfile.apiKey) {
       headers['Authorization'] = `Bearer ${voiceProfile.apiKey}`;
   }

   let method = 'POST';
   let body: any = {};

   // 2. Protocol Specific Logic
   if (voiceProfile.provider === 'gpt-sovits') {
       body = {
            text: cleanText,
            text_lang: 'zh',
            ref_audio_path: voiceProfile.sampleAudio || '', 
            prompt_lang: 'zh',
            prompt_text: voiceProfile.sampleText || '',
            speed_factor: voiceProfile.speed || 1.0,
            media_type: "wav",
            streaming_mode: false
       };
   } 
   else if (voiceProfile.provider === 'fish-speech') {
       // Fish Speech Generic API Structure
       body = {
           text: cleanText,
           reference_audio: voiceProfile.sampleAudio ? voiceProfile.sampleAudio.replace(/^data:audio\/.*?;base64,/, '') : undefined,
           reference_text: voiceProfile.sampleText || undefined,
           format: "wav"
       };
   }
   else if (voiceProfile.provider === 'chat-tts') {
       // ChatTTS WebUI API Structure
       body = {
           text: cleanText,
           voice: voiceProfile.sampleAudio ? voiceProfile.sampleAudio.replace(/^data:audio\/.*?;base64,/, '') : undefined,
           prompt: '[speed_5]',
           temperature: 0.3
       };
   }
   else if (voiceProfile.provider === 'openai-compatible') {
       body = {
            input: cleanText,
            model: voiceProfile.modelId || 'tts-1',
            voice: voiceProfile.voiceId || 'alloy'
       };
   }
   else if (voiceProfile.provider === 'custom-json') {
       method = voiceProfile.customMethod || 'POST';
       if (voiceProfile.customBody) {
           try {
               const rawAudio = (voiceProfile.sampleAudio || '').replace(/^data:audio\/.*?;base64,/, '');
               let jsonStr = voiceProfile.customBody
                   .replace(/{text}/g, cleanText.replace(/"/g, '\\"'))
                   .replace(/{audio}/g, rawAudio)
                   .replace(/{ref_text}/g, (voiceProfile.sampleText || '').replace(/"/g, '\\"'));
                   
               body = JSON.parse(jsonStr);
           } catch (e) {
               console.error("Custom JSON Parse Error", e);
               body = { text: cleanText };
           }
       }
   }

   const resp = await fetch(voiceProfile.apiUrl!, {
       method: method,
       headers: headers,
       body: method === 'POST' ? JSON.stringify(body) : undefined
   });

   if (!resp.ok) throw new Error(`API Error ${resp.status}: ${resp.statusText}`);

   const blob = await resp.blob();
   const b64 = await new Promise<string>((resolve) => {
       const reader = new FileReader();
       reader.onloadend = () => resolve((reader.result as string).split(',')[1]); 
       reader.readAsDataURL(blob);
   });
   return { type: 'base64', data: b64 };
};

// --- OLLAMA Service ---

export const fetchOllamaModels = async (baseUrl: string): Promise<string[]> => {
    try {
        const res = await fetch(`${baseUrl}/api/tags`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.models.map((m: any) => m.name);
    } catch (e) {
        console.warn("Failed to fetch Ollama models", e);
        return [];
    }
};

const getOllamaResponse = async (
    baseUrl: string,
    model: string,
    messages: any[],
    options: any
): Promise<string> => {
    const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature,
                top_p: options.topP,
                top_k: options.topK,
                stop: options.stopSequences
            }
        })
    });
    if (!res.ok) throw new Error(`Ollama API Error: ${res.statusText}`);
    const data = await res.json();
    return data.message?.content || "";
};

// --- Context Managers ---

const getActiveWorldInfo = (text: string, worldInfo: WorldInfoEntry[]): string[] => {
    if (!worldInfo || worldInfo.length === 0) return [];
    const activeEntries: string[] = [];
    const lowerText = text.toLowerCase();
    
    worldInfo.forEach(entry => {
        if (!entry.enabled) return;
        if (entry.keys.some(k => lowerText.includes(k.toLowerCase()))) {
            activeEntries.push(entry.content);
        }
    });
    return activeEntries;
};

// --- LLM Chat Logic ---

export const getAiResponse = async (
  input: string,
  char: Character,
  settings: AppSettings,
  attachments: Attachment[],
  history: Message[],
  isGroup: boolean = false
): Promise<{ text: string; emotion: string; sources?: { title: string; uri: string }[], activeLore?: string[] }> => {
  // ... (Same as before) ...
  let systemPrompt = settings.modelPreset.systemInstruction + "\n";
  systemPrompt += `[USER INFO]\nName: ${settings.userPersona.name}\nDescription: ${settings.userPersona.description}\nNote: ${settings.userPersona.customPrompt}\n\n`;

  if (isGroup) {
      systemPrompt += `You are in a group chat. Your name is ${char.name}.\n`;
  } else {
      systemPrompt += `You are ${char.name}.\n`;
  }
  systemPrompt += `Description: ${char.description}\nPersona: ${char.persona}\nScenario: ${char.scenario}\n`;
  systemPrompt += `Expression Style: ${char.expressionStyle}\n`;
  
  // --- ACTION STYLE PARSING ---
  if (typeof char.actionStyle === 'string') {
      systemPrompt += `Action Style: ${char.actionStyle}\n`;
  } else {
      const style = char.actionStyle as ActionStyleConfig;
      if (style.enabled) {
          systemPrompt += `[ACTION & NARRATION GUIDELINES]\n`;
          systemPrompt += `- Perspective: ${style.narrativePerspective === 'first' ? 'First person (I, me)' : 'Third person (She, He)'}\n`;
          systemPrompt += `- Detail Level: ${style.detailLevel} (Higher level means more environmental and sensory details)\n`;
          if (style.includeInnerThoughts) systemPrompt += `- MUST include inner thoughts/psychological descriptions, e.g., (thinking: ...)\n`;
          if (style.customFormatting) systemPrompt += `- Formatting Rules: ${style.customFormatting}\n`;
      }
  }

  if (char.memories && char.memories.length > 0) {
      systemPrompt += `\n[LONG-TERM MEMORY]\nThe following are important memories you have with ${settings.userPersona.name}:\n`;
      char.memories.forEach(m => {
          systemPrompt += `- ${m.content} (Importance: ${m.importance})\n`;
      });
  }

  const activeLore = getActiveWorldInfo(input, char.worldInfo);
  if (activeLore.length > 0) {
      systemPrompt += `\n[WORLD KNOWLEDGE / LOREBOOK]\nRelevant information triggered by context:\n`;
      activeLore.forEach(content => {
          systemPrompt += `> ${content}\n`;
      });
  }
  
  if (char.agentConfig?.enabled) {
      systemPrompt += `\n[AGENT MODE ACTIVE]\n`;
      systemPrompt += `Role: ${char.agentConfig.role}\n`;
      systemPrompt += `Available tools: ${char.agentConfig.allowedTools.join(', ')}\n`;
      systemPrompt += `Thinking Budget: ${char.agentConfig.thinkingBudget || 0} tokens (Use appropriately)\n`;
      if (char.agentConfig.requireApproval) systemPrompt += `CRITICAL: You MUST ask for user approval before performing irreversible actions.\n`;
      systemPrompt += `If you need to perform an action, format it as: [ACTION: tool_name args]`;
  }

  const provider = settings.apiProvider;

  if (provider === 'gemini') {
      const config = settings.providerConfigs['gemini'];
      const apiKey = config.apiKey || process.env.API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const tools = [];
      if (char.useSearch && settings.useGoogleSearch) tools.push({ googleSearch: {} });

      const contents: Content[] = [];
      history.forEach(msg => {
         if (msg.type === 'system') return;
         const role = msg.role === 'user' ? 'user' : 'model';
         const parts: Part[] = [];
         parts.push({ text: msg.content });
         contents.push({ role, parts });
      });
      
      const currentParts: Part[] = [];
      attachments.forEach(att => {
          if (att.type === 'image') {
              const b64 = att.base64.split(',')[1];
              currentParts.push({ inlineData: { mimeType: att.mimeType, data: b64 } });
          }
      });
      currentParts.push({ text: input });
      contents.push({ role: 'user', parts: currentParts });

      const resp = await ai.models.generateContent({
          model: char.model || config.model || 'gemini-3-flash-preview',
          contents: contents,
          config: {
              systemInstruction: systemPrompt,
              temperature: char.config.temperature,
              topP: char.config.topP,
              topK: char.config.topK,
              maxOutputTokens: char.config.maxOutputTokens,
              tools: tools.length > 0 ? tools : undefined
          }
      });
      const text = resp.text || "...";
      return { text, emotion: 'neutral', activeLore };
  } 
  else if (provider === 'ollama') {
      const config = settings.providerConfigs['ollama'];
      const messages = [
          { role: 'system', content: systemPrompt },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: input }
      ];
      const text = await getOllamaResponse(config.baseUrl || 'http://127.0.0.1:11434', config.model || 'llama3', messages, char.config);
      return { text, emotion: 'neutral', activeLore };
  }
  else {
      const config = settings.providerConfigs[provider];
      const messages = [
          { role: 'system', content: systemPrompt },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: input }
      ];
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
          body: JSON.stringify({ model: config.model, messages: messages })
      });
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || "";
      return { text, emotion: 'neutral', activeLore };
  }
};

export const generateSocialPost = async (
    char: Character,
    settings: AppSettings
): Promise<{ text: string, imagePrompt?: string } | null> => {
    // ... (Same) ...
    const provider = settings.apiProvider;
    if (provider !== 'gemini') return null;

    const config = settings.providerConfigs['gemini'];
    const apiKey = config.apiKey || process.env.API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are ${char.name}.
    Persona: ${char.persona}
    
    Task: Write a short social media post (like a Tweet or WeChat Moment) about your current mood, activity, or thought.
    It should be casual and fit your personality.
    Also provide a short visual description for an image to accompany this post.
    
    Return JSON format: { "content": "post text...", "imagePrompt": "visual description..." }`;

    try {
        const resp = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        content: { type: Type.STRING },
                        imagePrompt: { type: Type.STRING }
                    }
                }
            }
        });
        const jsonText = resp.text;
        if(jsonText) return JSON.parse(jsonText);
        return null;
    } catch (e) {
        console.error("Failed to generate social post", e);
        return null;
    }
};

const normalizeUrl = (url: string): string => {
    let targetUrl = url.trim().replace(/\/$/, '');
    if (!targetUrl.match(/^https?:\/\//)) {
        targetUrl = `http://${targetUrl}`;
    }
    return targetUrl;
};

// TOGGLEABLE HEADERS
const getComfyHeaders = (skipNgrokWarning: boolean = false) => {
    const headers: Record<string, string> = {};
    if (skipNgrokWarning) {
        headers['ngrok-skip-browser-warning'] = 'true';
    }
    return headers;
};

export const testComfyConnection = async (url: string, skipNgrokWarning: boolean = false): Promise<{ success: boolean; message?: string; errorType?: string }> => {
    const targetUrl = normalizeUrl(url);

    if (targetUrl.includes('//0.0.0.0')) {
            return { 
            success: false, 
            message: "❌ 地址错误: 请使用 http://127.0.0.1:8190" 
        };
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
         return { 
            success: false, 
            message: "⚠️ 浏览器安全限制: 请使用 Live Server 启动本网页" 
        };
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && targetUrl.startsWith('http:')) {
        return { 
            success: false, 
            message: "⚠️ 混合内容错误: HTTPS 网页无法连接 HTTP 本地服务。请使用 Ngrok HTTPS 链接。" 
        };
    }

    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000);
        
        let res = await fetch(`${targetUrl}/system_stats`, { 
            signal: controller.signal,
            cache: 'no-store',
            headers: getComfyHeaders(skipNgrokWarning)
        }).catch(() => null);

        if (!res || !res.ok) {
             res = await fetch(`${targetUrl}/`, { 
                signal: controller.signal,
                cache: 'no-store',
                headers: getComfyHeaders(skipNgrokWarning)
            }).catch(() => null);
        }

        clearTimeout(id);
        
        if (res && res.ok) {
             const contentType = res.headers.get("content-type");
             // Detection of Ngrok Warning Page (Status 200 but HTML content)
             if (contentType && contentType.includes("text/html")) {
                 return { 
                     success: false, 
                     message: "⚠️ Ngrok 访问拦截 (Auth Required)\n检测到 Ngrok 警告页。",
                     errorType: 'ngrok_interstitial' 
                 };
             }
             return { success: true };
        }
        
        if (res && res.status === 502) {
             return { success: false, message: "🛑 502 Bad Gateway\nNgrok 已连接，但找不到本地 ComfyUI 服务。\n请检查端口号 (8190 或 8188) 是否正确。" };
        }
        
        return { success: false, message: `HTTP Error: ${res ? res.status : 'Network Error'}` };

    } catch (e: any) {
        console.warn("Comfy Connection Failed", e);
        let msg = e.message || "Unknown Error";
        
        if (e.name === 'AbortError') {
            msg = "⏱️ 连接超时";
        } else if (msg.includes('Failed to fetch')) {
             msg = `🚫 网络错误 (Network Error)\n`;
             if (skipNgrokWarning) {
                 msg += "可能原因：服务器未配置 CORS 白名单，拒绝了自定义 Header。\n请关闭 'Ngrok 兼容模式' 再试。";
             } else {
                 msg += "可能原因：CORS 跨域拦截 或 服务未启动。\n若使用 TATA 脚本，请尝试开启 'Ngrok 兼容模式'。";
             }
        }
        
        return { success: false, message: msg };
    }
};

export const fetchComfyResources = async (url: string, skipNgrokWarning: boolean = false) => {
    const targetUrl = normalizeUrl(url);
    try {
        const res = await fetch(`${targetUrl}/object_info`, { 
            credentials: 'omit',
            headers: getComfyHeaders(skipNgrokWarning)
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const text = await res.text();
        if (text.trim().startsWith('<')) {
            console.error("Received HTML instead of JSON. Likely Ngrok warning.");
            return null;
        }
        
        try {
            const objectInfo = JSON.parse(text);
            const checkpoints = objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
            const loras = objectInfo.LoraLoader?.input?.required?.lora_name?.[0] || [];
            const samplers = objectInfo.KSampler?.input?.required?.sampler_name?.[0] || [];
            const schedulers = objectInfo.KSampler?.input?.required?.scheduler?.[0] || [];
            return { checkpoints, loras, samplers, schedulers };
        } catch (jsonErr) {
            console.error("JSON Parse Error:", jsonErr);
            return null;
        }
    } catch (e) {
        console.error("Failed to fetch Comfy resources", e);
        return null;
    }
};

export const generateImageViaComfy = async (
    prompt: string, 
    char: Character, 
    settings: AppSettings
): Promise<string | null> => {
    const url = normalizeUrl(settings.comfyUrl);
    const skipWarning = settings.comfyConfig.skipNgrokWarning;
    const clientId = Math.random().toString(36).substring(7);
    
    const globalPos = settings.comfyConfig.globalPositivePrompt ? `${settings.comfyConfig.globalPositivePrompt}, ` : '';
    const positive = `${globalPos}${prompt}, ${char.appearance || ''}`;
    const negative = settings.comfyConfig.defaultNegativePrompt || "low quality, bad anatomy, nsfw, ugly";
    
    const seed = Math.floor(Math.random() * 1000000000);
    const workflow: any = {};

    workflow["3"] = { class_type: "KSampler", inputs: { cfg: settings.comfyConfig.cfg, denoise: 1, model: ["4", 0], latent_image: ["5", 0], negative: ["7", 0], positive: ["6", 0], sampler_name: settings.comfyConfig.sampler, scheduler: settings.comfyConfig.scheduler, seed, steps: settings.comfyConfig.steps } };
    workflow["4"] = { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: settings.comfyConfig.checkpoint } };
    workflow["5"] = { class_type: "EmptyLatentImage", inputs: { batch_size: 1, height: settings.comfyConfig.height, width: settings.comfyConfig.width } };
    workflow["6"] = { class_type: "CLIPTextEncode", inputs: { clip: ["4", 1], text: positive } };
    workflow["7"] = { class_type: "CLIPTextEncode", inputs: { clip: ["4", 1], text: negative } };
    workflow["8"] = { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } };
    workflow["9"] = { class_type: "SaveImage", inputs: { filename_prefix: "Annie_Gen", images: ["8", 0] } };

    let currentModelNode = ["4", 0];
    let currentClipNode = ["4", 1];

    if (settings.comfyConfig.lora1 && settings.comfyConfig.lora1 !== 'None') {
        workflow["10"] = { 
            class_type: "LoraLoader", 
            inputs: { 
                lora_name: settings.comfyConfig.lora1, 
                strength_model: settings.comfyConfig.lora1_strength, 
                strength_clip: 1, 
                model: currentModelNode, 
                clip: currentClipNode 
            } 
        };
        currentModelNode = ["10", 0];
        currentClipNode = ["10", 1];
    }

    if (settings.comfyConfig.lora2 && settings.comfyConfig.lora2 !== 'None') {
        workflow["11"] = { 
            class_type: "LoraLoader", 
            inputs: { 
                lora_name: settings.comfyConfig.lora2, 
                strength_model: settings.comfyConfig.lora2_strength, 
                strength_clip: 1, 
                model: currentModelNode, 
                clip: currentClipNode 
            } 
        };
        currentModelNode = ["11", 0];
        currentClipNode = ["11", 1];
    }

    workflow["3"].inputs.model = currentModelNode;
    workflow["6"].inputs.clip = currentClipNode;
    workflow["7"].inputs.clip = currentClipNode;

    try {
        const res = await fetch(`${url}/prompt`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getComfyHeaders(skipWarning)
            },
            body: JSON.stringify({ prompt: workflow, client_id: clientId })
        });
        
        if (!res.ok) {
            console.error(`ComfyUI Error (${res.status}):`, await res.text());
            return null;
        }

        const text = await res.text();
        if (text.trim().startsWith('<')) {
             console.error("Received HTML from ComfyUI Prompt. Ngrok warning.");
             return null;
        }
        
        const promptData = JSON.parse(text);
        const promptId = promptData.prompt_id;
        let isDone = false;
        let filename = '';
        await new Promise(r => setTimeout(r, 1000)); 
        let attempts = 0;
        
        while (!isDone && attempts < 60) {
            await new Promise(r => setTimeout(r, 2000));
            const historyRes = await fetch(`${url}/history/${promptId}`, {
                headers: getComfyHeaders(skipWarning)
            });
            const historyText = await historyRes.text();
            if (historyText.trim().startsWith('<')) continue;
            
            const history = JSON.parse(historyText);
            
            if (history[promptId]) {
                const outputs = history[promptId].outputs;
                for (const key in outputs) {
                    if (outputs[key].images && outputs[key].images.length > 0) {
                        filename = outputs[key].images[0].filename;
                        isDone = true;
                        break;
                    }
                }
            }
            attempts++;
        }
        if (filename) return `${url}/view?filename=${filename}`;
    } catch (e) {
        console.error("Comfy Gen Error", e);
    }
    return null;
};
