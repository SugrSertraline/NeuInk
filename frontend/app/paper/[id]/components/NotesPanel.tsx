'use client';

import React, { useState } from 'react';
import type { BlockNote } from '../../../types/paper';
import { StickyNote, X, Plus, Tag, Calendar } from 'lucide-react';

interface NotesPanelProps {
  blockNotes: BlockNote[];
  activeBlockId: string | null;
  onClose: () => void;
  paperId: string;
}

export default function NotesPanel({ 
  blockNotes, 
  activeBlockId, 
  onClose,
  paperId 
}: NotesPanelProps) {
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // 过滤笔记
  const filteredNotes = activeBlockId 
    ? blockNotes.filter(note => note.blockId === activeBlockId)
    : blockNotes;

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    
    // TODO: 调用API添加笔记
    console.log('Adding note:', {
      paperId,
      blockId: activeBlockId,
      content: newNoteContent
    });
    
    setNewNoteContent('');
    setIsAdding(false);
  };

  return (
    <div className="w-96 bg-white overflow-y-auto border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-20 shadow-sm">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-amber-500" />
          <span>笔记</span>
          {filteredNotes.length > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {filteredNotes.length}
            </span>
          )}
        </h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* 笔记列表 */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <StickyNote className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">暂无笔记</p>
            <p className="text-xs mt-2">
              {activeBlockId 
                ? '为此段落添加第一条笔记' 
                : '悬停在内容上查看相关笔记'}
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div 
              key={note.id} 
              className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 hover:shadow-md transition-shadow group"
            >
              <p className="text-sm text-gray-800 leading-relaxed mb-3">
                {note.content}
              </p>
              
              {note.tags && note.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {note.tags.map((tag, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-200 text-amber-800 text-xs rounded-full"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-amber-200">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(note.createdAt).toLocaleDateString('zh-CN', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <button className="opacity-0 group-hover:opacity-100 text-amber-600 hover:text-amber-700 transition-opacity">
                  编辑
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* 添加笔记区域 */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        {isAdding ? (
          <div className="space-y-3">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="记录你的想法..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
              rows={4}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddNote}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewNoteContent('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            添加新笔记
          </button>
        )}
      </div>
    </div>
  );
}
