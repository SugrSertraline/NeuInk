// frontend/app/papers/[id]/components/editor/RichTextEditor.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { InlineContent, Reference, Section, BlockContent, FigureBlock, TableBlock, MathBlock } from '../../../../types/paper';
import InlineRenderer from '../InlineRenderer';
import { 
  Bold, Italic, Underline, Strikethrough, Code, 
  Link as LinkIcon, Calculator, FileText, 
  Image, Table as TableIcon, Sigma, Hash, StickyNote,
  Eye, EyeOff, X, Search
} from 'lucide-react';
import { API_BASE, toAbsoluteUrl } from '../../../../lib/api';
import katex from 'katex';

interface RichTextEditorProps {
  value: InlineContent[];
  onChange: (value: InlineContent[]) => void;
  references?: Reference[];
  allSections?: Section[];
  placeholder?: string;
  label?: string;
}

interface ToolButton {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  action?: () => void;
  shortcut?: string;
  type?: 'divider';
}

type ReferenceType = 'citation' | 'figure' | 'table' | 'equation' | 'section' | 'footnote';

interface ReferenceItem {
  id: string;
  type: ReferenceType;
  displayText: string;
  number?: number | string;
  data?: any; // 存储原始数据用于预览
}

export default function RichTextEditor({
  value,
  onChange,
  references = [],
  allSections = [],
  placeholder = '输入内容...',
  label
}: RichTextEditorProps) {
  const [text, setText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showRefPicker, setShowRefPicker] = useState(false);
  const [refPickerType, setRefPickerType] = useState<ReferenceType>('citation');
  const [refSearchQuery, setRefSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(inlineToText(value));
  }, [value]);

  const handleChange = (newText: string) => {
    setText(newText);
    const parsed = textToInline(newText);
    onChange(parsed);
  };

  // 提取所有可引用的元素（包含完整数据用于预览）
  const availableReferences = useMemo(() => {
    const items: ReferenceItem[] = [];
    
    // 文献引用
    references.forEach(ref => {
      items.push({
        id: ref.id,
        type: 'citation',
        displayText: `[${ref.number || ref.id}] ${ref.authors[0]}${ref.authors.length > 1 ? ' et al.' : ''} (${ref.year})`,
        number: ref.number,
        data: ref
      });
    });
    
    // 递归提取块元素
    const extractBlocks = (sections: Section[]) => {
      sections.forEach(section => {
        // 章节引用
        items.push({
          id: section.id,
          type: 'section',
          displayText: `${section.number ? section.number + ' ' : ''}${section.title.en || section.title.zh || section.id}`,
          number: section.number,
          data: section
        });
        
        section.content.forEach(block => {
          if (block.type === 'figure') {
            const fig = block as FigureBlock;
            items.push({
              id: block.id,
              type: 'figure',
              displayText: `Figure ${fig.number || '?'}`,
              number: fig.number,
              data: fig
            });
          } else if (block.type === 'table') {
            const tbl = block as TableBlock;
            items.push({
              id: block.id,
              type: 'table',
              displayText: `Table ${tbl.number || '?'}`,
              number: tbl.number,
              data: tbl
            });
          } else if (block.type === 'math' && block.label) {
            const eq = block as MathBlock;
            items.push({
              id: block.id,
              type: 'equation',
              displayText: `Equation ${eq.number || eq.label}`,
              number: eq.number,
              data: eq
            });
          }
        });
        
        if (section.subsections) {
          extractBlocks(section.subsections);
        }
      });
    };
    
    extractBlocks(allSections);
    
    return items;
  }, [references, allSections]);

  const filteredReferences = useMemo(() => {
    return availableReferences
      .filter(item => item.type === refPickerType)
      .filter(item => 
        refSearchQuery === '' || 
        item.displayText.toLowerCase().includes(refSearchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(refSearchQuery.toLowerCase())
      );
  }, [availableReferences, refPickerType, refSearchQuery]);

  const insertSyntax = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    
    const newText = 
      text.substring(0, start) + 
      before + selectedText + after + 
      text.substring(end);
    
    handleChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const openRefPicker = (type: ReferenceType) => {
    setRefPickerType(type);
    setRefSearchQuery('');
    setShowRefPicker(true);
  };

  const insertReference = (item: ReferenceItem) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    let refText = '';
    switch (item.type) {
      case 'citation':
        refText = `[cite:${item.id}]`;
        break;
      case 'figure':
        refText = `[fig:${item.id}|${item.displayText}]`;
        break;
      case 'table':
        refText = `[tbl:${item.id}|${item.displayText}]`;
        break;
      case 'equation':
        refText = `[eq:${item.id}|${item.displayText}]`;
        break;
      case 'section':
        refText = `[sec:${item.id}|${item.displayText}]`;
        break;
    }
    
    const newText = 
      text.substring(0, start) + 
      refText + 
      text.substring(end);
    
    handleChange(newText);
    setShowRefPicker(false);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + refText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertFootnote = () => {
    const content = prompt('输入脚注内容：');
    if (!content) return;
    
    const num = prompt('脚注序号（可选）：') || '1';
    insertSyntax(`[^${content}|${num}]`);
  };

  const tools: ToolButton[] = [
    { icon: Bold, label: '粗体', action: () => insertSyntax('**', '**'), shortcut: 'Ctrl+B' },
    { icon: Italic, label: '斜体', action: () => insertSyntax('*', '*'), shortcut: 'Ctrl+I' },
    { icon: Underline, label: '下划线', action: () => insertSyntax('__', '__'), shortcut: 'Ctrl+U' },
    { icon: Strikethrough, label: '删除线', action: () => insertSyntax('~~', '~~') },
    { icon: Code, label: '行内代码', action: () => insertSyntax('`', '`') },
    { type: 'divider' },
    { icon: LinkIcon, label: '链接', action: () => insertSyntax('[', '](url)') },
    { icon: Calculator, label: '行内公式', action: () => insertSyntax('[$', '$]') },
    { type: 'divider' },
    { icon: FileText, label: '文献引用', action: () => openRefPicker('citation') },
    { icon: Image, label: '图片引用', action: () => openRefPicker('figure') },
    { icon: TableIcon, label: '表格引用', action: () => openRefPicker('table') },
    { icon: Sigma, label: '公式引用', action: () => openRefPicker('equation') },
    { icon: Hash, label: '章节引用', action: () => openRefPicker('section') },
    { icon: StickyNote, label: '脚注', action: insertFootnote },
  ];

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      
      {/* 工具栏 */}
      <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-300 rounded-t-lg flex-wrap">
        {tools.map((tool, i) => 
          tool.type === 'divider' ? (
            <div key={i} className="w-px h-6 bg-gray-300 mx-1" />
          ) : tool.icon ? (
            <button
              key={i}
              type="button"
              onClick={tool.action}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
            >
              <tool.icon className="w-4 h-4 text-gray-600" />
            </button>
          ) : null
        )}
        
        <div className="flex-1" />
        
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={`p-1.5 rounded transition-colors ${
            showPreview ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'
          }`}
          title={showPreview ? '隐藏预览' : '显示预览'}
        >
          {showPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      {/* 编辑区 */}
      <div className={`grid ${showPreview ? 'grid-cols-2 gap-4' : 'grid-cols-1'}`}>
        <div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-40 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey) {
                if (e.key === 'b') {
                  e.preventDefault();
                  insertSyntax('**', '**');
                } else if (e.key === 'i') {
                  e.preventDefault();
                  insertSyntax('*', '*');
                } else if (e.key === 'u') {
                  e.preventDefault();
                  insertSyntax('__', '__');
                }
              }
            }}
          />
          
          <details className="mt-2 text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">语法帮助</summary>
            <div className="mt-2 space-y-1 pl-2">
              <div><code>**粗体**</code> <code>*斜体*</code> <code>__下划线__</code> <code>~~删除线~~</code> <code>`代码`</code></div>
              <div><code>[链接](url)</code> <code>[$公式$]</code></div>
              <div><code>[cite:id]</code> <code>[fig:id|文本]</code> <code>[tbl:id|文本]</code></div>
              <div><code>[eq:id|文本]</code> <code>[sec:id|文本]</code> <code>[^内容|序号]</code></div>
            </div>
          </details>
        </div>

        {showPreview && (
          <div className="border border-gray-300 rounded-lg p-3 bg-white min-h-[10rem] overflow-auto">
            <div className="text-xs text-gray-400 mb-2">预览：</div>
            <div className="text-gray-700 leading-relaxed">
              <InlineRenderer 
                nodes={textToInline(text)}
                references={references}
                allSections={allSections}
              />
            </div>
          </div>
        )}
      </div>

      {/* 引用选择器模态框 */}
      {showRefPicker && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md flex items-center justify-center z-50" onClick={() => setShowRefPicker(false)}>          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                选择{refPickerType === 'citation' ? '文献' : 
                     refPickerType === 'figure' ? '图片' :
                     refPickerType === 'table' ? '表格' :
                     refPickerType === 'equation' ? '公式' : '章节'}
              </h3>
              <button onClick={() => setShowRefPicker(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={refSearchQuery}
                  onChange={(e) => setRefSearchQuery(e.target.value)}
                  placeholder="搜索..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {filteredReferences.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  没有找到可引用的内容
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReferences.map(item => (
                    <ReferencePreviewCard
                      key={item.id}
                      item={item}
                      onClick={() => insertReference(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 引用预览卡片组件
function ReferencePreviewCard({ item, onClick }: { item: ReferenceItem; onClick: () => void }) {
  const mathRef = useRef<HTMLDivElement>(null);

  // 渲染公式
  useEffect(() => {
    if (item.type === 'equation' && mathRef.current && item.data?.latex) {
      try {
        katex.render(item.data.latex, mathRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        console.error('KaTeX render error:', e);
      }
    }
  }, [item]);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
    >
      {/* 文献引用 */}
      {item.type === 'citation' && item.data && (
        <div>
          <div className="font-medium text-gray-900 mb-1">{item.displayText}</div>
          <div className="text-sm text-gray-700 italic mb-1">"{item.data.title}"</div>
          <div className="text-xs text-gray-500">
            {item.data.publication && <span>{item.data.publication}</span>}
            {item.data.doi && <span className="ml-2">DOI: {item.data.doi}</span>}
          </div>
        </div>
      )}

      {/* 图片引用 */}
      {item.type === 'figure' && item.data && (
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <img
              src={toAbsoluteUrl(item.data.src)}
              alt={item.data.alt || ''}
              className="w-24 h-24 object-cover rounded border border-gray-300"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImage%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 mb-1">{item.displayText}</div>
            {item.data.caption?.en && (
              <div className="text-sm text-gray-600 line-clamp-2">
                <InlineRenderer nodes={item.data.caption.en} />
              </div>
            )}
            <div className="text-xs text-gray-500 mt-1">ID: {item.id}</div>
          </div>
        </div>
      )}

      {/* 表格引用 */}
      {item.type === 'table' && item.data && (
        <div>
          <div className="font-medium text-gray-900 mb-2">{item.displayText}</div>
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full text-xs border-collapse">
              {item.data.headers && (
                <thead>
                  <tr className="bg-gray-100">
                    {item.data.headers.slice(0, 4).map((header: string, i: number) => (
                      <th key={i} className="px-2 py-1 text-left font-semibold border border-gray-300">
                        {header}
                      </th>
                    ))}
                    {item.data.headers.length > 4 && (
                      <th className="px-2 py-1 text-center border border-gray-300">...</th>
                    )}
                  </tr>
                </thead>
              )}
              <tbody>
                {item.data.rows.slice(0, 3).map((row: string[], i: number) => (
                  <tr key={i} className="border-b border-gray-300">
                    {row.slice(0, 4).map((cell: string, j: number) => (
                      <td key={j} className="px-2 py-1 border border-gray-300 truncate max-w-[100px]">
                        {cell}
                      </td>
                    ))}
                    {row.length > 4 && (
                      <td className="px-2 py-1 text-center border border-gray-300">...</td>
                    )}
                  </tr>
                ))}
                {item.data.rows.length > 3 && (
                  <tr>
                    <td colSpan={Math.min(item.data.headers?.length || item.data.rows[0]?.length || 1, 5)} className="px-2 py-1 text-center text-gray-400 italic text-xs">
                      ...共 {item.data.rows.length} 行
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {item.data.caption?.en && (
            <div className="text-xs text-gray-600">
              <InlineRenderer nodes={item.data.caption.en} />
            </div>
          )}
        </div>
      )}

      {/* 公式引用 */}
      {item.type === 'equation' && item.data && (
        <div>
          <div className="font-medium text-gray-900 mb-2">{item.displayText}</div>
          <div 
            ref={mathRef}
            className="bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto text-center"
          />
          {item.data.label && (
            <div className="text-xs text-gray-500 mt-1">Label: {item.data.label}</div>
          )}
        </div>
      )}

      {/* 章节引用 */}
      {item.type === 'section' && item.data && (
        <div>
          <div className="font-medium text-gray-900 mb-1">{item.displayText}</div>
          <div className="text-xs text-gray-500">
            章节 ID: {item.id}
            {item.data.content?.length && (
              <span className="ml-2">• {item.data.content.length} 个块元素</span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

// ============= 转换函数 =============

function inlineToText(nodes: InlineContent[]): string {
  if (!nodes || nodes.length === 0) return '';
  
  return nodes.map(node => {
    switch (node.type) {
      case 'text': {
        let text = node.content;
        if (node.style?.bold) text = `**${text}**`;
        if (node.style?.italic) text = `*${text}*`;
        if (node.style?.underline) text = `__${text}__`;
        if (node.style?.strikethrough) text = `~~${text}~~`;
        if (node.style?.code) text = `\`${text}\``;
        return text;
      }
      case 'link':
        return `[${inlineToText(node.children)}](${node.url})`;
      case 'inline-math':
        return `[$${node.latex}$]`;
      case 'citation':
        return `[cite:${node.referenceIds.join(',')}]`;
      case 'figure-ref':
        return `[fig:${node.figureId}|${node.displayText}]`;
      case 'table-ref':
        return `[tbl:${node.tableId}|${node.displayText}]`;
      case 'equation-ref':
        return `[eq:${node.equationId}|${node.displayText}]`;
      case 'section-ref':
        return `[sec:${node.sectionId}|${node.displayText}]`;
      case 'footnote':
        return `[^${node.content}|${node.displayText}]`;
      default:
        return '';
    }
  }).join('');
}

function textToInline(text: string): InlineContent[] {
  if (!text) return [];
  
  const result: InlineContent[] = [];
  let i = 0;
  
  while (i < text.length) {
    // 链接
    const linkMatch = text.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      result.push({
        type: 'link',
        url: linkMatch[2],
        children: textToInline(linkMatch[1])
      });
      i += linkMatch[0].length;
      continue;
    }
    
    // 行内公式
    const mathMatch = text.slice(i).match(/^\[\$(.+?)\$\]/);
    if (mathMatch) {
      result.push({
        type: 'inline-math',
        latex: mathMatch[1]
      });
      i += mathMatch[0].length;
      continue;
    }
    
    // 文献引用
    const citeMatch = text.slice(i).match(/^\[cite:([^\]]+)\]/);
    if (citeMatch) {
      const refIds = citeMatch[1].split(',').map(s => s.trim());
      result.push({
        type: 'citation',
        referenceIds: refIds,
        displayText: refIds.join(',')
      });
      i += citeMatch[0].length;
      continue;
    }
    
    // 图片引用
    const figMatch = text.slice(i).match(/^\[fig:([^|\]]+)\|([^\]]+)\]/);
    if (figMatch) {
      result.push({
        type: 'figure-ref',
        figureId: figMatch[1],
        displayText: figMatch[2]
      });
      i += figMatch[0].length;
      continue;
    }
    
    // 表格引用
    const tblMatch = text.slice(i).match(/^\[tbl:([^|\]]+)\|([^\]]+)\]/);
    if (tblMatch) {
      result.push({
        type: 'table-ref',
        tableId: tblMatch[1],
        displayText: tblMatch[2]
      });
      i += tblMatch[0].length;
      continue;
    }
    
    // 公式引用
    const eqMatch = text.slice(i).match(/^\[eq:([^|\]]+)\|([^\]]+)\]/);
    if (eqMatch) {
      result.push({
        type: 'equation-ref',
        equationId: eqMatch[1],
        displayText: eqMatch[2]
      });
      i += eqMatch[0].length;
      continue;
    }
    
    // 章节引用
    const secMatch = text.slice(i).match(/^\[sec:([^|\]]+)\|([^\]]+)\]/);
    if (secMatch) {
      result.push({
        type: 'section-ref',
        sectionId: secMatch[1],
        displayText: secMatch[2]
      });
      i += secMatch[0].length;
      continue;
    }
    
    // 脚注
    const fnMatch = text.slice(i).match(/^\[\^([^|]+)\|([^\]]+)\]/);
    if (fnMatch) {
      result.push({
        type: 'footnote',
        id: `fn_${Date.now()}_${Math.random()}`,
        content: fnMatch[1],
        displayText: fnMatch[2]
      });
      i += fnMatch[0].length;
      continue;
    }
    
    // 样式文本（简化逻辑）
    let consumed = false;
    
    // 粗体
    if (text.slice(i).startsWith('**')) {
      const match = text.slice(i).match(/^\*\*(.+?)\*\*/);
      if (match) {
        result.push({
          type: 'text',
          content: match[1],
          style: { bold: true }
        });
        i += match[0].length;
        consumed = true;
      }
    }
    
    if (!consumed && text[i] === '*') {
      const match = text.slice(i).match(/^\*(.+?)\*/);
      if (match) {
        result.push({
          type: 'text',
          content: match[1],
          style: { italic: true }
        });
        i += match[0].length;
        consumed = true;
      }
    }
    
    if (!consumed && text.slice(i).startsWith('__')) {
      const match = text.slice(i).match(/^__(.+?)__/);
      if (match) {
        result.push({
          type: 'text',
          content: match[1],
          style: { underline: true }
        });
        i += match[0].length;
        consumed = true;
      }
    }
    
    if (!consumed && text.slice(i).startsWith('~~')) {
      const match = text.slice(i).match(/^~~(.+?)~~/);
      if (match) {
        result.push({
          type: 'text',
          content: match[1],
          style: { strikethrough: true }
        });
        i += match[0].length;
        consumed = true;
      }
    }
    
    if (!consumed && text[i] === '`') {
      const match = text.slice(i).match(/^`(.+?)`/);
      if (match) {
        result.push({
          type: 'text',
          content: match[1],
          style: { code: true }
        });
        i += match[0].length;
        consumed = true;
      }
    }
    
    // 普通文本
    if (!consumed) {
      const nextSpecial = text.slice(i).search(/[\[*_~`]/);
      const content = nextSpecial === -1 ? text.slice(i) : text.slice(i, i + nextSpecial);
      
      if (content) {
        result.push({
          type: 'text',
          content
        });
        i += content.length;
      } else {
        i++;
      }
    }
  }
  
  return result;
}