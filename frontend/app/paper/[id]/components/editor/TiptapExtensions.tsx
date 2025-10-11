// frontend/app/papers/[id]/components/editor/TiptapExtensions.tsx

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';

// ============= 文献引用扩展 =============
export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      referenceIds: {
        default: [],
        parseHTML: element => element.getAttribute('data-reference-ids')?.split(',') || [],
        renderHTML: attributes => ({
          'data-reference-ids': attributes.referenceIds.join(','),
        }),
      },
      displayText: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="citation"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-type': 'citation',
      class: 'inline-block px-1.5 py-0.5 mx-0.5 bg-green-100 text-green-800 rounded-md text-xs font-medium cursor-pointer hover:bg-green-200',
      contenteditable: 'false',
    }), `[${HTMLAttributes['data-reference-ids']}]`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationComponent);
  },
});

function CitationComponent({ node }: any) {
  return (
    <NodeViewWrapper as="span" className="inline-block px-1.5 py-0.5 mx-0.5 bg-green-100 text-green-800 rounded-md text-xs font-medium cursor-pointer hover:bg-green-200">
      [{node.attrs.referenceIds.join(',')}]
    </NodeViewWrapper>
  );
}

// ============= 图片引用扩展 =============
export const FigureRef = Node.create({
  name: 'figureRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      figureId: { default: '' },
      displayText: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="figure-ref"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-type': 'figure-ref',
      class: 'inline-block px-1.5 py-0.5 mx-0.5 bg-purple-100 text-purple-800 rounded-md text-xs font-medium cursor-pointer hover:bg-purple-200',
      contenteditable: 'false',
    }), HTMLAttributes.displayText];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureRefComponent);
  },
});

function FigureRefComponent({ node }: any) {
  return (
    <NodeViewWrapper as="span" className="inline-block px-1.5 py-0.5 mx-0.5 bg-purple-100 text-purple-800 rounded-md text-xs font-medium cursor-pointer hover:bg-purple-200">
      {node.attrs.displayText}
    </NodeViewWrapper>
  );
}

// ============= 表格引用扩展 =============
export const TableRef = Node.create({
  name: 'tableRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tableId: { default: '' },
      displayText: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="table-ref"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-type': 'table-ref',
      class: 'inline-block px-1.5 py-0.5 mx-0.5 bg-orange-100 text-orange-800 rounded-md text-xs font-medium cursor-pointer hover:bg-orange-200',
      contenteditable: 'false',
    }), HTMLAttributes.displayText];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableRefComponent);
  },
});

function TableRefComponent({ node }: any) {
  return (
    <NodeViewWrapper as="span" className="inline-block px-1.5 py-0.5 mx-0.5 bg-orange-100 text-orange-800 rounded-md text-xs font-medium cursor-pointer hover:bg-orange-200">
      {node.attrs.displayText}
    </NodeViewWrapper>
  );
}

// ============= 公式引用扩展 =============
export const EquationRef = Node.create({
  name: 'equationRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      equationId: { default: '' },
      displayText: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="equation-ref"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-type': 'equation-ref',
      class: 'inline-block px-1.5 py-0.5 mx-0.5 bg-indigo-100 text-indigo-800 rounded-md text-xs font-medium cursor-pointer hover:bg-indigo-200',
      contenteditable: 'false',
    }), HTMLAttributes.displayText];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EquationRefComponent);
  },
});

function EquationRefComponent({ node }: any) {
  return (
    <NodeViewWrapper as="span" className="inline-block px-1.5 py-0.5 mx-0.5 bg-indigo-100 text-indigo-800 rounded-md text-xs font-medium cursor-pointer hover:bg-indigo-200">
      {node.attrs.displayText}
    </NodeViewWrapper>
  );
}

// ============= 章节引用扩展 =============
export const SectionRef = Node.create({
  name: 'sectionRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      sectionId: { default: '' },
      displayText: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="section-ref"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-type': 'section-ref',
      class: 'inline-block px-1.5 py-0.5 mx-0.5 bg-teal-100 text-teal-800 rounded-md text-xs font-medium cursor-pointer hover:bg-teal-200',
      contenteditable: 'false',
    }), HTMLAttributes.displayText];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionRefComponent);
  },
});

function SectionRefComponent({ node }: any) {
  return (
    <NodeViewWrapper as="span" className="inline-block px-1.5 py-0.5 mx-0.5 bg-teal-100 text-teal-800 rounded-md text-xs font-medium cursor-pointer hover:bg-teal-200">
      {node.attrs.displayText}
    </NodeViewWrapper>
  );
}

// ============= 脚注扩展 =============
export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: '' },
      content: { default: '' },
      displayText: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="footnote"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-type': 'footnote',
      class: 'inline-block px-1 py-0.5 mx-0.5 bg-gray-200 text-gray-800 rounded text-xs font-medium cursor-pointer hover:bg-gray-300',
      contenteditable: 'false',
    }), `[${HTMLAttributes.displayText}]`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FootnoteComponent);
  },
});

function FootnoteComponent({ node }: any) {
  return (
    <NodeViewWrapper 
      as="span" 
      className="inline-block px-1 py-0.5 mx-0.5 bg-gray-200 text-gray-800 rounded text-xs font-medium cursor-pointer hover:bg-gray-300"
      title={node.attrs.content}
    >
      [{node.attrs.displayText}]
    </NodeViewWrapper>
  );
}

// ============= 行内公式扩展 =============
export const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-math"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      'data-type': 'inline-math',
      class: 'inline-block px-2 py-0.5 mx-0.5 bg-blue-50 text-blue-700 rounded font-mono text-sm border border-blue-200',
      contenteditable: 'false',
    }), `$${HTMLAttributes.latex}$`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathComponent);
  },
});

function InlineMathComponent({ node }: any) {
  return (
    <NodeViewWrapper as="span" className="inline-block px-2 py-0.5 mx-0.5 bg-blue-50 text-blue-700 rounded font-mono text-sm border border-blue-200">
      ${node.attrs.latex}$
    </NodeViewWrapper>
  );
}