'use client';

import React, { useEffect, useRef } from 'react';
import type { BlockContent, Section } from '../../../types/paper';
import InlineRenderer from './InlineRenderer';
import type { Reference } from '../../../types/paper';
import katex from 'katex';
import { API_BASE, toAbsoluteUrl } from '../../../lib/api';

interface BlockRendererProps {
  block: BlockContent;
  lang: 'en' | 'zh';
  isActive?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  references?: Reference[];
  onCitationClick?: (refIds: string[]) => void;
  searchQuery?: string;
  allSections?: Section[];
  contentRef?: React.RefObject<HTMLDivElement | null>;
}

function BlockMath({ math }: { math: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && math) {
      try {
        katex.render(math, ref.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        console.error('KaTeX block render error:', e);
        if (ref.current) {
          ref.current.textContent = `$$${math}$$`;
        }
      }
    }
  }, [math]);

  return <div ref={ref} className="text-center" />;
}

export default function BlockRenderer({
  block,
  lang,
  isActive = false,
  onMouseEnter,
  onMouseLeave,
  references = [],
  onCitationClick,
  searchQuery = '',
  allSections = [],
  contentRef 
}: BlockRendererProps) {
  const baseClass = `transition-all duration-200 rounded-lg ${
    isActive ? 'bg-blue-50 ring-2 ring-blue-200 shadow-sm' : ''
  }`;

  const renderContent = () => {
    switch (block.type) {
        case 'heading': {
            const headingSizes = {
              1: 'text-3xl',
              2: 'text-2xl',
              3: 'text-xl',
              4: 'text-lg',
              5: 'text-base',
              6: 'text-sm'
            } as const;
            
            const commonProps = {
              className: `${headingSizes[block.level]} font-bold text-gray-900 mb-2`,
              children: (
                <>
                  {block.number && <span className="text-blue-600 mr-2">{block.number}</span>}
                  <InlineRenderer 
                    nodes={block.content?.[lang]} 
                    references={references}
                    onCitationClick={onCitationClick}
                    searchQuery={searchQuery}
                    allSections={allSections}
                    contentRef={contentRef}
                  />
                </>
              )
            };
            switch (block.level) {
              case 1: return <h1 {...commonProps} />;
              case 2: return <h2 {...commonProps} />;
              case 3: return <h3 {...commonProps} />;
              case 4: return <h4 {...commonProps} />;
              case 5: return <h5 {...commonProps} />;
              case 6: return <h6 {...commonProps} />;
              default: return <h2 {...commonProps} />;
            }
          }
          
      
      case 'paragraph': {
        const alignClass = {
          left: 'text-left',
          center: 'text-center',
          right: 'text-right',
          justify: 'text-justify'
        }[block.align || 'left'];
        
        return (
          <p className={`text-gray-700 leading-relaxed ${alignClass}`}>
            <InlineRenderer 
              nodes={block.content?.[lang]} 
              references={references}
              onCitationClick={onCitationClick}
              searchQuery={searchQuery}
              allSections={allSections}
              contentRef={contentRef} 
            />
          </p>
        );
      }
      
      case 'math': {
        return (
          <div className="my-4">
            <div className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 py-4 px-4 relative">
              <BlockMath math={block.latex || ''} />
              {block.number && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  ({block.number})
                </div>
              )}
            </div>
          </div>
        );
      }
      
      case 'figure': {
        return (
          <figure className="my-6">
            {/* ✅ 添加条件判断 */}
            {block.src ? (
              <img 
                src={toAbsoluteUrl(block.src)}
                alt={block.alt || ''} 
                className="max-w-2xl mx-auto rounded-lg shadow-md border border-gray-200"
                style={{ 
                  width: block.width || 'auto',
                  height: block.height || 'auto'
                }}
              />
            ) : (
              <div className="max-w-2xl mx-auto bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <svg className="w-16 h-16 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-400 text-sm">图片未上传</p>
              </div>
            )}
            
            {/* Caption 保持不变 */}
            <figcaption className="text-sm text-gray-600 mt-3 text-center px-4">
              {block.number && (
                <span className="font-semibold text-gray-800">Figure {block.number}. </span>
              )}
              <InlineRenderer 
                nodes={block.caption?.[lang]} 
                references={references}
                onCitationClick={onCitationClick}
                allSections={allSections}
                contentRef={contentRef}
              />
            </figcaption>
            
            {block.description?.[lang] && (
              <div className="text-xs text-gray-500 mt-2 text-center px-4">
                <InlineRenderer 
                  nodes={block.description[lang]} 
                  allSections={allSections}
                  contentRef={contentRef}
                />
              </div>
            )}
          </figure>
        );
      }
      
      
      case 'table': {
        return (
          <div className="my-6 overflow-x-auto">
            {block.caption?.[lang] && (
              <div className="text-sm text-gray-600 mb-2 text-center font-medium">
                {block.number && (
                  <span className="font-semibold text-gray-800">Table {block.number}. </span>
                )}
                <InlineRenderer 
                  nodes={block.caption[lang]} 
                  allSections={allSections}
                  contentRef={contentRef}
                />
              </div>
            )}
            <table className="min-w-full border-collapse border border-gray-300 mx-auto shadow-sm">
              {block.headers && (
                <thead className="bg-gray-100">
                  <tr>
                    {block.headers.map((h, i) => (
                      <th 
                        key={i} 
                        className="border border-gray-300 px-3 py-2 font-semibold text-gray-900 text-sm"
                        style={{ textAlign: block.align?.[i] || 'left' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="hover:bg-gray-50 transition-colors">
                    {row.map((cell, c) => (
                      <td 
                        key={c} 
                        className="border border-gray-300 px-3 py-2 text-gray-700 text-sm"
                        style={{ textAlign: block.align?.[c] || 'left' }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {block.description?.[lang] && (
              <div className="text-xs text-gray-500 mt-2 text-center">
                <InlineRenderer 
                  nodes={block.description[lang]} 
                  allSections={allSections}
                  contentRef={contentRef}
                />
              </div>
            )}
          </div>
        );
      }
      
      case 'code': {
        return (
          <div className="my-4">
            {block.caption?.[lang] && (
              <div className="text-xs text-gray-500 mb-2">
                <InlineRenderer 
                  nodes={block.caption[lang]} 
                  allSections={allSections}
                  contentRef={contentRef}
                />
              </div>
            )}
            <pre className="p-4 rounded-lg bg-gray-900 text-gray-100 overflow-auto text-sm relative shadow-md">
              {block.language && (
                <div className="absolute top-3 right-3 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                  {block.language}
                </div>
              )}
              <code className={block.showLineNumbers ? 'block' : ''}>
                {block.code}
              </code>
            </pre>
          </div>
        );
      }
      
      case 'ordered-list': {
        return (
          <ol start={block.start ?? 1} className="list-decimal pl-6 my-3 space-y-1.5">
            {block.items.map((item, i) => (
              <li key={i} className="text-gray-700 leading-relaxed">
                <InlineRenderer 
                  nodes={item.content?.[lang]} 
                  references={references}
                  onCitationClick={onCitationClick}
                  searchQuery={searchQuery}
                  allSections={allSections}
                  contentRef={contentRef} 
                />
              </li>
            ))}
          </ol>
        );
      }
      
      case 'unordered-list': {
        return (
          <ul className="list-disc pl-6 my-3 space-y-1.5">
            {block.items.map((item, i) => (
              <li key={i} className="text-gray-700 leading-relaxed">
                <InlineRenderer 
                  nodes={item.content?.[lang]} 
                  references={references}
                  onCitationClick={onCitationClick}
                  searchQuery={searchQuery}
                  allSections={allSections}
                  contentRef={contentRef} 
                />
              </li>
            ))}
          </ul>
        );
      }
      
      case 'quote': {
        return (
          <blockquote className="border-l-4 border-blue-500 pl-4 py-2 italic my-4 text-gray-600 bg-blue-50 rounded-r-lg">
            <InlineRenderer 
              nodes={block.content?.[lang]} 
              references={references}
              onCitationClick={onCitationClick}
              allSections={allSections}
              contentRef={contentRef}
            />
            {block.author && (
              <div className="text-right text-sm text-gray-500 mt-2 not-italic font-medium">
                — {block.author}
              </div>
            )}
          </blockquote>
        );
      }
      
      case 'divider': {
        return <hr className="my-6 border-t-2 border-gray-300" />;
      }
      
      default:
        return null;
    }
  };

  return (
    <div
      id={block.id}
      className={`${baseClass} p-2 mb-3`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {renderContent()}
    </div>
  );
}