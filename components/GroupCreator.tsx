
import React, { useState } from 'react';
import { Character, CharacterGroup } from '../types';

interface GroupCreatorProps {
  characters: Character[];
  onSave: (group: CharacterGroup) => void;
  onCancel: () => void;
}

const GroupCreator: React.FC<GroupCreatorProps> = ({ characters, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleSave = () => {
    if (!name.trim() || selectedMembers.length < 2) {
      alert("请输入群名并至少选择2名成员。");
      return;
    }
    const newGroup: CharacterGroup = {
      id: `g-${Date.now()}`,
      name: name,
      avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random',
      members: selectedMembers,
      description: `Group with ${selectedMembers.length} members`,
      scenario: 'Generic group chat'
    };
    onSave(newGroup);
  };

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] animate-enter shadow-2xl">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-xl font-bold text-white">创建新群聊</h3>
          <p className="text-xs text-gray-500 mt-1">选择成员加入群组，开启多人互动。</p>
        </div>
        
        <div className="p-6 space-y-6 flex-1 overflow-y-auto no-scrollbar">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">群名称</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink-500/50"
              placeholder="例如：后宫起火群"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-400 block mb-2">选择成员 ({selectedMembers.length})</label>
            <div className="space-y-2">
              {characters.map(char => (
                <div 
                  key={char.id} 
                  onClick={() => toggleMember(char.id)}
                  className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${selectedMembers.includes(char.id) ? 'bg-pink-600/10 border-pink-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                >
                  <img src={char.avatar} className="w-10 h-10 rounded-full object-cover bg-gray-800" />
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-bold text-white">{char.name}</div>
                    <div className="text-[10px] text-gray-500 line-clamp-1">{char.description}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedMembers.includes(char.id) ? 'bg-pink-500 border-pink-500' : 'border-gray-500'}`}>
                    {selectedMembers.includes(char.id) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 flex gap-3 bg-[#0c0c0e]">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/5 text-gray-400 hover:text-white hover:bg-white/10">取消</button>
          <button onClick={handleSave} className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg">创建群聊</button>
        </div>
      </div>
    </div>
  );
};

export default GroupCreator;
