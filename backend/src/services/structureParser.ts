import { randomUUID } from 'crypto';

export class StructureParser {
  mergePages(pagesData: any[]): any {
    const allBlocks: any[] = [];
    let previousBlock: any = null;
    const usedIds = new Set<string>(); // 🆕 追踪已使用的ID

    for (let i = 0; i < pagesData.length; i++) {
      const pageData = pagesData[i];
      const pageBlocks = pageData.blocks || [];

      for (let j = 0; j < pageBlocks.length; j++) {
        const block = pageBlocks[j];
        
        // 🆕 确保ID唯一
        if (!block.id || usedIds.has(block.id)) {
          block.id = this.generateUniqueBlockId(block.type, usedIds);
        }
        usedIds.add(block.id);
        
        // 🆕 规范化内容结构
        block.content = this.normalizeContent(block.content);
        if (block.caption) {
          block.caption = this.normalizeContent(block.caption);
        }
        if (block.description) {
          block.description = this.normalizeContent(block.description);
        }
        
        // 🆕 规范化列表结构
        if (block.type === 'ordered-list' || block.type === 'unordered-list') {
          block.items = this.normalizeListItems(block);
        }

        if (previousBlock && 
            this.shouldMergeBlocks(previousBlock, block, pageData.lastBlockContinues)) {
          previousBlock = this.mergeBlocks(previousBlock, block);
        } else {
          if (previousBlock) {
            allBlocks.push(previousBlock);
          }
          previousBlock = block;
        }
      }

      if (!pageData.isPageEnd && previousBlock) {
        continue;
      } else if (previousBlock) {
        allBlocks.push(previousBlock);
        previousBlock = null;
      }
    }

    if (previousBlock) {
      allBlocks.push(previousBlock);
    }

    return this.organizeBlocks(allBlocks);
  }

  private shouldMergeBlocks(block1: any, block2: any, continuesFlag: boolean): boolean {
    if (block1.type !== 'paragraph' || block2.type !== 'paragraph') {
      return false;
    }

    if (!continuesFlag) {
      return false;
    }

    return true;
  }

  private mergeBlocks(block1: any, block2: any): any {
    return {
      ...block1,
      content: {
        en: [...(block1.content?.en || []), ...(block2.content?.en || [])],
        zh: [...(block1.content?.zh || []), ...(block2.content?.zh || [])]
      }
    };
  }

  // 🆕 规范化content结构：将字符串数组转为对象数组
  private normalizeContent(content: any): any {
    if (!content) return { en: [], zh: [] };
    
    const normalize = (arr: any[]): any[] => {
      if (!Array.isArray(arr)) return [];
      
      return arr.map(item => {
        // 如果是字符串，转换为TextNode对象
        if (typeof item === 'string') {
          return { type: 'text', content: item };
        }
        
        // 如果是对象但没有type字段，添加type
        if (typeof item === 'object' && item !== null && !item.type) {
          if ('content' in item) {
            return { type: 'text', ...item };
          }
          // 其他情况，转为文本
          return { type: 'text', content: String(item) };
        }
        
        // 已经是正确格式的对象
        return item;
      });
    };
    
    return {
      en: normalize(content.en || []),
      zh: normalize(content.zh || [])
    };
  }
  
  // 🆕 规范化列表items：将content转为items格式
  private normalizeListItems(block: any): any[] {
    // 如果已经有items字段，规范化它
    if (block.items && Array.isArray(block.items)) {
      return block.items.map((item: any) => ({
        content: this.normalizeContent(item.content)
      }));
    }
    
    // 如果有content字段而没有items，转换结构
    if (block.content) {
      const normalized = this.normalizeContent(block.content);
      const en = normalized.en || [];
      const zh = normalized.zh || [];
      
      // 如果content是单个项目，转为items数组
      if (en.length > 0 || zh.length > 0) {
        return [{
          content: {
            en: en,
            zh: zh
          }
        }];
      }
    }
    
    return [];
  }

  // 🆕 生成唯一ID
  private generateUniqueBlockId(type: string, usedIds: Set<string>): string {
    let id: string;
    let counter = 0;
    do {
      const uuid = randomUUID().substring(0, 8);
      id = counter === 0 ? `${type}-${uuid}` : `${type}-${uuid}-${counter}`;
      counter++;
    } while (usedIds.has(id) && counter < 1000); // 防止无限循环
    return id;
  }

  private organizeBlocks(blocks: any[]): any {
    const sections: any[] = [];
    let currentSection: any = null;
    const sectionStack: any[] = [];

    for (const block of blocks) {
      if (!block.id) {
        block.id = this.generateUniqueBlockId(block.type, new Set());
      }

      if (block.type === 'heading') {
        const section: any = {
          id: block.id,
          number: block.number,
          title: {
            en: this.extractTextFromInline(block.content?.en),
            zh: this.extractTextFromInline(block.content?.zh)
          },
          content: [],
          subsections: []
        };

        const level = block.level || 1;

        if (level === 1) {
          sections.push(section);
          currentSection = section;
          sectionStack.length = 0;
          sectionStack.push(section);
        } else {
          while (sectionStack.length >= level) {
            sectionStack.pop();
          }

          const parentSection = sectionStack[sectionStack.length - 1];
          if (parentSection) {
            parentSection.subsections = parentSection.subsections || [];
            parentSection.subsections.push(section);
            sectionStack.push(section);
            currentSection = section;
          }
        }
      } else {
        if (currentSection) {
          currentSection.content.push(block);
        } else {
          if (sections.length === 0) {
            currentSection = {
              id: this.generateUniqueBlockId('section', new Set()),
              title: { en: 'Content', zh: '内容' },
              content: [],
              subsections: []
            };
            sections.push(currentSection);
            sectionStack.push(currentSection);
          }
          sections[0].content.push(block);
        }
      }
    }

    return sections;
  }

  private extractTextFromInline(inlineContent?: any[]): string {
    if (!inlineContent || !Array.isArray(inlineContent)) {
      return '';
    }

    return inlineContent
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }
        if (item.type === 'text') {
          return item.content || '';
        } else if (item.type === 'link' && item.children) {
          return this.extractTextFromInline(item.children);
        } else if (item.displayText) {
          return item.displayText;
        }
        return '';
      })
      .join('');
  }

  normalizeReferences(references: any[]): any[] {
    return references.map((ref, index) => ({
      id: ref.id || `ref-${index + 1}`,
      number: ref.number || index + 1,
      authors: ref.authors || [],
      title: ref.title || '',
      publication: ref.publication,
      year: ref.year,
      doi: ref.doi,
      url: ref.url,
      pages: ref.pages,
      volume: ref.volume,
      issue: ref.issue
    }));
  }

  validateAndFix(paperContent: any): any {
    if (!paperContent.sections || !Array.isArray(paperContent.sections)) {
      paperContent.sections = [];
    }

    if (!paperContent.references || !Array.isArray(paperContent.references)) {
      paperContent.references = [];
    }

    if (!paperContent.blockNotes || !Array.isArray(paperContent.blockNotes)) {
      paperContent.blockNotes = [];
    }

    if (!paperContent.checklistNotes || !Array.isArray(paperContent.checklistNotes)) {
      paperContent.checklistNotes = [];
    }

    paperContent.sections = paperContent.sections.map((section: any) => 
      this.validateSection(section)
    );

    return paperContent;
  }

  private validateSection(section: any): any {
    if (!section.id) {
      section.id = this.generateUniqueBlockId('section', new Set());
    }

    if (!section.title) {
      section.title = { en: 'Untitled', zh: '无标题' };
    }

    if (!section.content || !Array.isArray(section.content)) {
      section.content = [];
    }

    // 🆕 规范化所有block的content
    section.content = section.content.map((block: any) => {
      block.content = this.normalizeContent(block.content);
      if (block.caption) {
        block.caption = this.normalizeContent(block.caption);
      }
      if (block.description) {
        block.description = this.normalizeContent(block.description);
      }
      
      // 🆕 规范化列表
      if (block.type === 'ordered-list' || block.type === 'unordered-list') {
        block.items = this.normalizeListItems(block);
      }
      
      return block;
    });

    if (!section.subsections) {
      section.subsections = [];
    }

    section.subsections = section.subsections.map((sub: any) => 
      this.validateSection(sub)
    );

    return section;
  }
}