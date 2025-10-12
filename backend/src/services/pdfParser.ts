import fs from 'fs/promises';

export interface PDFPage {
  pageNumber: number;
  text: string;
  hasImages: boolean;
  hasTables: boolean;
}

export class PDFParser {
  private async loadPdfParse() {
    try {
      const pdfParse = require('pdf-parse');
      return pdfParse;
    } catch (error) {
      const pdfParse = await import('pdf-parse');
      return pdfParse.default;
    }
  }

  async extractPages(filePath: string): Promise<PDFPage[]> {
    const dataBuffer = await fs.readFile(filePath);
    
    try {
      const pdf = await this.loadPdfParse();
      const data = await pdf(dataBuffer);
      
      const fullText = data.text;
      const numPages = data.numpages;
      
      console.log(`📄 PDF总页数: ${numPages}`);
      
      const pages: PDFPage[] = [];
      
      // 🔧 策略1: 尝试按换页符分割
      const formFeedPages = fullText.split('\f').filter((t: string) => t.trim());
      
      if (formFeedPages.length >= numPages * 0.8 && formFeedPages.length <= numPages * 1.2) {
        // 换页符分割成功（允许±20%误差）
        console.log('✓ 使用换页符分割页面');
        formFeedPages.slice(0, numPages).forEach((text: string, index: number) => {
          pages.push({
            pageNumber: index + 1,
            text: text.trim(),
            hasImages: this.detectImages(text),
            hasTables: this.detectTables(text)
          });
        });
        
        // 如果页数不足，补充空页
        while (pages.length < numPages) {
          pages.push({
            pageNumber: pages.length + 1,
            text: '',
            hasImages: false,
            hasTables: false
          });
        }
        
        console.log(`✓ 成功提取 ${pages.length} 页`);
        return pages;
      }
      
      // 🔧 策略2: 按字符数平均分配
      console.log('⚠ 换页符分割失败，使用字符数平均分配');
      const totalChars = fullText.length;
      const charsPerPage = Math.ceil(totalChars / numPages);
      
      let startIndex = 0;
      for (let i = 0; i < numPages; i++) {
        let endIndex = Math.min(startIndex + charsPerPage, totalChars);
        
        // 🔧 尝试在段落边界分割（查找最近的换行符）
        if (endIndex < totalChars) {
          const searchRange = Math.min(200, charsPerPage * 0.2); // 搜索范围
          const searchText = fullText.substring(
            Math.max(0, endIndex - searchRange),
            Math.min(totalChars, endIndex + searchRange)
          );
          
          const relativeIndex = searchRange;
          const nextNewline = searchText.indexOf('\n', relativeIndex);
          
          if (nextNewline !== -1) {
            endIndex = endIndex - searchRange + nextNewline + 1;
          }
        }
        
        const pageText = fullText.substring(startIndex, endIndex).trim();
        
        if (pageText) {
          pages.push({
            pageNumber: i + 1,
            text: pageText,
            hasImages: this.detectImages(pageText),
            hasTables: this.detectTables(pageText)
          });
        }
        
        startIndex = endIndex;
      }
      
      // 确保页数正确
      while (pages.length < numPages) {
        pages.push({
          pageNumber: pages.length + 1,
          text: '',
          hasImages: false,
          hasTables: false
        });
      }
      
      console.log(`✓ 成功提取 ${pages.length} 页`);
      return pages.slice(0, numPages);
      
    } catch (error) {
      throw new Error(`PDF解析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private detectImages(text: string): boolean {
    const patterns = [
      /Figure\s+\d+/i,
      /Fig\.\s*\d+/i,
      /图\s*\d+/,
      /插图\s*\d+/
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  private detectTables(text: string): boolean {
    const patterns = [
      /Table\s+\d+/i,
      /Tab\.\s*\d+/i,
      /表\s*\d+/,
      /表格\s*\d+/
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  async extractFrontMatter(filePath: string, maxPages: number = 3): Promise<string> {
    const pages = await this.extractPages(filePath);
    return pages
      .slice(0, Math.min(maxPages, pages.length))
      .map(p => p.text)
      .join('\n\n');
  }

  async extractReferences(filePath: string): Promise<string> {
    const dataBuffer = await fs.readFile(filePath);
    
    try {
      const pdf = await this.loadPdfParse();
      const data = await pdf(dataBuffer);
      const fullText = data.text;
      
      const patterns = [
        /References\s*\n/i,
        /REFERENCES\s*\n/i,
        /Bibliography\s*\n/i,
        /参考文献\s*\n/,
        /引用文献\s*\n/
      ];
      
      for (const pattern of patterns) {
        const match = fullText.match(pattern);
        if (match && match.index !== undefined) {
          return fullText.substring(match.index);
        }
      }
      
      return '';
    } catch (error) {
      throw new Error(`参考文献提取失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}