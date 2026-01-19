
import React, { useState } from 'react';
import { Character, Moment, AppSettings, Comment } from '../types';
import { generateSocialPost, generateImageViaComfy } from '../services/geminiService';

interface MomentsFeedProps {
  moments: Moment[];
  characters: Character[];
  settings: AppSettings;
  onClose: () => void;
  onUpdateMoments: (moments: Moment[]) => void;
}

const MomentsFeed: React.FC<MomentsFeedProps> = ({ moments, characters, settings, onClose, onUpdateMoments }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const handleRefresh = async () => {
    if (characters.length === 0) return;
    setIsRefreshing(true);
    
    // Pick a random character
    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    
    try {
        const postData = await generateSocialPost(randomChar, settings);
        if (postData) {
            let imageUrl: string | undefined;
            if (settings.enableComfyUI && postData.imagePrompt) {
                imageUrl = await generateImageViaComfy(postData.imagePrompt, randomChar, settings) || undefined;
            } else {
                // Fallback placeholder or just text
                // imageUrl = `https://picsum.photos/seed/${Date.now()}/400/300`; 
            }

            const newMoment: Moment = {
                id: `m-${Date.now()}`,
                characterId: randomChar.id,
                content: postData.text,
                imagePrompts: postData.imagePrompt ? [postData.imagePrompt] : [],
                imageUrls: imageUrl ? [imageUrl] : [],
                timestamp: Date.now(),
                likes: [],
                comments: []
            };
            onUpdateMoments([newMoment, ...moments]);
        }
    } catch (e) {
        console.error("Failed to generate moment", e);
    } finally {
        setIsRefreshing(false);
    }
  };

  const toggleLike = (momentId: string) => {
      const updated = moments.map(m => {
          if (m.id === momentId) {
              const hasLiked = m.likes.includes('user');
              return {
                  ...m,
                  likes: hasLiked ? m.likes.filter(id => id !== 'user') : [...m.likes, 'user']
              };
          }
          return m;
      });
      onUpdateMoments(updated);
  };

  const handleComment = (momentId: string) => {
      if (!commentText.trim()) return;
      const newComment: Comment = {
          id: `c-${Date.now()}`,
          userId: 'user',
          userName: settings.userPersona.name,
          userAvatar: settings.userPersona.avatar,
          content: commentText,
          timestamp: Date.now()
      };
      
      const updated = moments.map(m => {
          if (m.id === momentId) {
              return { ...m, comments: [...m.comments, newComment] };
          }
          return m;
      });
      onUpdateMoments(updated);
      setCommentText('');
      setActiveCommentId(null);
  };

  const formatTime = (ts: number) => {
      const diff = Date.now() - ts;
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff/60000)}分钟前`;
      if (diff < 86400000) return `${Math.floor(diff/3600000)}小时前`;
      return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="absolute inset-0 bg-[#0c0c0e] z-50 flex flex-col animate-enter">
        {/* Header */}
        <div className="px-4 py-4 border-b border-white/10 flex justify-between items-center bg-[#0c0c0e]/90 backdrop-blur z-10 sticky top-0 safe-pt">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⭕</span> 朋友圈 (Moments)
            </h2>
            <div className="flex gap-2">
                <button 
                    onClick={handleRefresh} 
                    disabled={isRefreshing}
                    className="p-2 bg-pink-600/20 text-pink-400 rounded-full hover:bg-pink-600/40 transition-colors disabled:opacity-50"
                >
                    {isRefreshing ? <span className="animate-spin block">↻</span> : '📷 探索'}
                </button>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full bg-white/5">✕</button>
            </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-6 pb-24 safe-pb">
            {/* Header Banner */}
            <div className="relative h-48 rounded-2xl overflow-hidden mb-6 group">
                <img src={settings.theme.globalBackground || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 right-0 p-4 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent w-full justify-end">
                    <span className="font-bold text-white shadow-black drop-shadow-md">{settings.userPersona.name}</span>
                    <img src={settings.userPersona.avatar} className="w-16 h-16 rounded-xl border-2 border-white shadow-lg object-cover" />
                </div>
            </div>

            {moments.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <div className="text-4xl mb-4">📭</div>
                    <p>暂无动态</p>
                    <button onClick={handleRefresh} className="mt-4 text-pink-400 text-sm hover:underline">点击生成第一条动态</button>
                </div>
            ) : (
                moments.map(moment => {
                    const char = characters.find(c => c.id === moment.characterId);
                    if (!char) return null;
                    const hasLiked = moment.likes.includes('user');

                    return (
                        <div key={moment.id} className="flex gap-4 border-b border-white/5 pb-6 animate-slide-up">
                            <img src={char.avatar} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-800" />
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-blue-400 text-sm mb-1">{char.name}</div>
                                <p className="text-gray-200 text-sm whitespace-pre-wrap mb-2 leading-relaxed">{moment.content}</p>
                                
                                {/* Images Grid */}
                                {moment.imageUrls && moment.imageUrls.length > 0 && (
                                    <div className={`grid gap-1 mb-2 ${moment.imageUrls.length === 1 ? 'grid-cols-1 max-w-[200px]' : 'grid-cols-3'}`}>
                                        {moment.imageUrls.map((url, idx) => (
                                            <div key={idx} className="aspect-square bg-gray-800 overflow-hidden rounded cursor-pointer" onClick={() => window.open(url)}>
                                                <img src={url} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                                    <span>{formatTime(moment.timestamp)}</span>
                                    <div className="flex gap-4">
                                        <button onClick={() => toggleLike(moment.id)} className={`flex items-center gap-1 transition-colors ${hasLiked ? 'text-pink-500' : 'hover:text-gray-300'}`}>
                                            {hasLiked ? '❤️' : '🤍'} {moment.likes.length > 0 && moment.likes.length}
                                        </button>
                                        <button onClick={() => setActiveCommentId(activeCommentId === moment.id ? null : moment.id)} className="hover:text-gray-300">💬</button>
                                    </div>
                                </div>

                                {/* Comments Area */}
                                <div className="mt-3 bg-[#1c1c1f] rounded p-2 text-xs">
                                    {moment.likes.length > 0 && (
                                        <div className="border-b border-white/5 pb-1 mb-1 text-blue-400 font-bold">
                                            ❤️ {hasLiked ? 'You' : ''} {moment.likes.length > (hasLiked ? 1 : 0) ? `and ${moment.likes.length - (hasLiked ? 1 : 0)} others` : ''}
                                        </div>
                                    )}
                                    {moment.comments.map(c => (
                                        <div key={c.id} className="py-0.5">
                                            <span className="text-blue-400 font-bold">{c.userName}:</span> <span className="text-gray-300">{c.content}</span>
                                        </div>
                                    ))}
                                    
                                    {activeCommentId === moment.id && (
                                        <div className="mt-2 flex gap-2 animate-enter">
                                            <input 
                                                autoFocus
                                                className="flex-1 bg-black/50 border border-white/10 rounded px-2 py-1 outline-none text-white placeholder-gray-600"
                                                placeholder="评论..."
                                                value={commentText}
                                                onChange={e => setCommentText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleComment(moment.id)}
                                            />
                                            <button onClick={() => handleComment(moment.id)} className="bg-blue-600/20 text-blue-400 px-3 rounded hover:bg-blue-600/40">发送</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    </div>
  );
};

export default MomentsFeed;
