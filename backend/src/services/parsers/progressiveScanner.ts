import { randomUUID } from 'crypto';

/** 行对象 */
export interface Line {
  num: number;   // 0-based
  raw: string;   // 原始文本（不含行尾换行）
}

/** 文本预处理 */
export function normalizeMarkdown(input: string): string {
  if (!input) return '';
  let s = input.replace(/\r\n?/g, '\n');
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  return s;
}

/** 切行 */
export function toLines(input: string): Line[] {
  const norm = normalizeMarkdown(input);
  const arr = norm.split('\n');
  return arr.map((raw, i) => ({ num: i, raw }));
}

/** 常用判定 */
export const isBlank = (s: string) => /^\s*$/.test(s);
export const endsWithSentencePunct = (s: string) => /[.!?。！？；;：:][)"'\]]*$/.test(s.trim());
export const endsWithHyphenWordBreak = (s: string) => /[A-Za-z]\-$/.test(s.trim());

/** 估算token数量（粗略：每4个字符约1个token） */
export const estimateTokens = (s: string): number => Math.ceil((s || '').length / 4);

/** 是否看起来会开启新块（粗判） */
export const startsWithNewBlockLike = (s: string) => {
  const t = s.trim();
  return (
    /^#{1,6}\s+/.test(t) ||                         // 标题
    /^>/.test(t) ||                                  // 引用
    /^(```|~~~)/.test(t) ||                          // 代码围栏
    /^\s*([-*+•])\s+/.test(t) ||                     // 无序列表
    /^\s*((\d+|[ivxIVX]+|[A-Za-z])[.)])\s+/.test(t) || // 有序列表
    /^\s*\|.*\|\s*$/.test(t) ||                      // 表格
    /^\s*!\[.*\]\(.*\)/.test(t) ||                   // 图片
    /^\s*---\s*$/.test(t) ||                         // 分隔线
    /^\s*\$\$\s*$/.test(t) ||                        // $$ 数学
    /^\s*\\\[/.test(t) ||                            // \[ 数学
    /^\s*\\begin\{(equation|align|gather)\}/.test(t) // LaTeX 环境
  );
};

/** 游标式逐行扫描器（增强版） */
export class LineScanner {
  private lines: Line[];
  private i = 0;
  
  constructor(input: string | Line[]) {
    this.lines = Array.isArray(input) ? input.slice() : toLines(input);
  }
  
  eof() { return this.i >= this.lines.length; }
  idx() { return this.i; }
  total() { return this.lines.length; }
  
  peek(offset = 0): Line | null {
    const k = this.i + offset;
    return (k >= 0 && k < this.lines.length) ? this.lines[k] : null;
  }
  
  next(): Line | null {
    if (this.eof()) return null;
    return this.lines[this.i++];
  }
  
  back(steps = 1) { 
    this.i = Math.max(0, this.i - steps); 
  }
  
  current(): Line | null { 
    return (this.i === 0 || this.eof()) ? null : this.lines[this.i - 1]; 
  }
  
  remainingText() {
    const rem: string[] = [];
    for (let k = this.i; k < this.lines.length; k++) rem.push(this.lines[k].raw);
    return rem.join('\n');
  }

  /**
   * 【新增】智能合并多行：如果当前行token过少，则向下合并
   * @param minTokens 最小token数阈值
   * @param maxLines 最多合并行数
   * @returns 合并后的文本
   */
  peekMergedLines(minTokens: number = 15, maxLines: number = 10): string {
    if (this.eof()) return '';
    
    const lines: string[] = [];
    let totalTokens = 0;
    let offset = 0;
    
    while (offset < maxLines && !this.eof() && this.peek(offset)) {
      const line = this.peek(offset)!;
      const lineText = line.raw.trim();
      
      // 如果遇到明显的新块起始，停止合并
      if (offset > 0 && startsWithNewBlockLike(lineText)) {
        break;
      }
      
      // 空行：如果已有内容则停止，否则跳过
      if (isBlank(lineText)) {
        if (lines.length > 0) break;
        offset++;
        continue;
      }
      
      lines.push(lineText);
      totalTokens += estimateTokens(lineText);
      offset++;
      
      // 达到最小token数后检查：如果下一行是标题/新块，则停止
      if (totalTokens >= minTokens) {
        const nextLine = this.peek(offset);
        if (!nextLine || startsWithNewBlockLike(nextLine.raw.trim())) {
          break;
        }
      }
    }
    
    return lines.join(' ');
  }

  /**
   * 【新增】消费合并的多行（与peekMergedLines配套使用）
   */
  consumeMergedLines(mergedText: string): void {
    let consumedTokens = 0;
    const targetTokens = estimateTokens(mergedText);
    
    while (!this.eof() && consumedTokens < targetTokens) {
      const line = this.peek();
      if (!line) break;
      
      consumedTokens += estimateTokens(line.raw);
      this.next();
      
      // 如果已消费足够的token，退出
      if (consumedTokens >= targetTokens * 0.9) break;
    }
  }
}

/** 句子感知重排（行内拼接 + 连字符断词） */
export function reflowParagraphLines(rawLines: string[], carryIn = ''): { text: string; carryOut: string } {
  const lines = rawLines.slice();
  const parts: string[] = [];
  let buf = carryIn ? carryIn : '';

  const pushBuf = () => {
    const t = buf.trim();
    if (t) parts.push(t);
    buf = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i] || '';
    const next = i + 1 < lines.length ? lines[i + 1] : '';

    // 连字符断词
    if (endsWithHyphenWordBreak(cur) && next && !startsWithNewBlockLike(next)) {
      lines[i + 1] = cur.replace(/-\s*$/, '') + next.trimStart();
      continue;
    }

    const trimmed = cur.trimEnd();
    if (!endsWithSentencePunct(trimmed) && next && !startsWithNewBlockLike(next)) {
      buf += (buf ? ' ' : '') + trimmed;
    } else {
      buf += (buf ? ' ' : '') + trimmed;
      pushBuf();
    }
  }

  let carryOut = '';
  if (buf && !endsWithSentencePunct(buf)) {
    carryOut = buf.trim();
    buf = '';
  } else {
    pushBuf();
  }
  return { text: parts.join('\n'), carryOut };
}

/** 简易唯一 ID */
export const uid = (prefix = '') => (prefix ? `${prefix}-${randomUUID()}` : randomUUID());