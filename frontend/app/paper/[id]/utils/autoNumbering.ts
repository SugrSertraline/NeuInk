// frontend/app/papers/[id]/utils/autoNumbering.ts

import type { PaperContent, Section, BlockContent, Reference} from "@/app/types/paper";

/**
 * 自动计算所有编号
 */
export function calculateAllNumbers(content: PaperContent): PaperContent {
  const newContent = JSON.parse(JSON.stringify(content)) as PaperContent;
  
  // 1. 计算章节编号
  calculateSectionNumbers(newContent.sections);
  
  // 2. 收集所有块元素并编号
  const allBlocks = collectAllBlocks(newContent.sections);
  calculateFigureNumbers(allBlocks);
  calculateTableNumbers(allBlocks);
  calculateMathNumbers(allBlocks);
  
  // 3. 计算参考文献编号
  calculateReferenceNumbers(newContent.references);
  
  return newContent;
}

/**
 * 递归计算章节编号（1, 1.1, 1.1.1 格式）
 */
function calculateSectionNumbers(sections: Section[], prefix: string = ''): void {
  sections.forEach((section, index) => {
    const number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
    section.number = number;
    
    if (section.subsections && section.subsections.length > 0) {
      calculateSectionNumbers(section.subsections, number);
    }
  });
}

/**
 * 收集所有块元素（递归遍历 sections）
 */
function collectAllBlocks(sections: Section[]): BlockContent[] {
  const blocks: BlockContent[] = [];
  
  function traverse(secs: Section[]) {
    secs.forEach(section => {
      blocks.push(...section.content);
      if (section.subsections) {
        traverse(section.subsections);
      }
    });
  }
  
  traverse(sections);
  return blocks;
}

/**
 * 计算图片编号（全局连续）
 */
function calculateFigureNumbers(blocks: BlockContent[]): void {
  let figureCount = 0;
  blocks.forEach(block => {
    if (block.type === 'figure') {
      figureCount++;
      block.number = figureCount;
    }
  });
}

/**
 * 计算表格编号（全局连续）
 */
function calculateTableNumbers(blocks: BlockContent[]): void {
  let tableCount = 0;
  blocks.forEach(block => {
    if (block.type === 'table') {
      tableCount++;
      block.number = tableCount;
    }
  });
}

/**
 * 计算公式编号（仅编号有 label 的公式）
 */
function calculateMathNumbers(blocks: BlockContent[]): void {
  let mathCount = 0;
  blocks.forEach(block => {
    if (block.type === 'math' && block.label) {
      mathCount++;
      block.number = mathCount;
    }
  });
}

/**
 * 计算参考文献编号
 */
function calculateReferenceNumbers(references: Reference[]): void {
  references.forEach((ref, index) => {
    ref.number = index + 1;
  });
}