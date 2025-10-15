// ===== elementDetectors-fixed.ts =====
import { LineScanner, isBlank, reflowParagraphLines, startsWithNewBlockLike } from './progressiveScanner';
import { BlockContent } from '../../types/paper';

/** ==== InlineContent 基础结构（与前端对齐） ==== */
type TextNode = { type: 'text'; content: string; style?: Record<string, any> };
type LinkNode = { type: 'link'; url: string; children: Array<TextNode | LinkNode>; title?: string };
type InlineMathNode = { type: 'inline-math'; latex: string };
export type InlineContent = TextNode | LinkNode | InlineMathNode;

/** 
 * 🔧 FIX #3: 确保行内公式的 latex 属性不包含 $ 符号
 * 把纯文本拆成 InlineContent[]：文本/链接/行内$...$ 
 */
export function toInline(s?: string): InlineContent[] {
  if (!s) return [];
  const out: InlineContent[] = [];
  let rest = s;

  const linkRe = /\[([^\]]+)\]\((\S+?)(?:\s+"(.*?)")?\)/;   // [text](url "title")
  const mathRe = /\$([^$]+)\$/;                            // $...$

  while (rest.length) {
    const linkM = rest.match(linkRe);
    const mathM = rest.match(mathRe);

    // 找到最近的一个 token
    let pick: 'link' | 'math' | null = null;
    let idx = Infinity;
    if (linkM && linkM.index! < idx) { idx = linkM.index!; pick = 'link'; }
    if (mathM && mathM.index! < idx) { idx = mathM.index!; pick = 'math'; }

    if (pick === null) {
      if (rest) out.push({ type: 'text', content: rest });
      break;
    }

    // 先推入前面的普通文本
    if (idx > 0) out.push({ type: 'text', content: rest.slice(0, idx) });
    rest = rest.slice(idx);

    if (pick === 'link') {
      const m = rest.match(linkRe)!;
      const [full, text, url, title] = m;
      out.push({ type: 'link', url, title, children: [{ type: 'text', content: text }] });
      rest = rest.slice(full.length);
    } else {
      // 🔧 FIX: 这里 m[1] 已经是去掉 $ 的内容了
      const m = rest.match(mathRe)!;
      const [full, latexWithoutDollar] = m;
      
      // 确保没有 $ 符号
      let cleanLatex = latexWithoutDollar.trim();
      if (cleanLatex.startsWith('$')) cleanLatex = cleanLatex.slice(1);
      if (cleanLatex.endsWith('$')) cleanLatex = cleanLatex.slice(0, -1);
      
      out.push({ type: 'inline-math', latex: cleanLatex.trim() });
      rest = rest.slice(full.length);
    }
  }
  return out;
}

/** ===== 标题检测（Markdown # 与编号标题） ===== */
function detectMarkdownHeading(s: string): { level: number; title: string } | null {
  const m = /^\s*(#{1,6})\s+(.+?)\s*$/.exec(s);
  if (!m) return null;
  return { level: m[1].length, title: stripNumbering(m[2].trim()) };
}

function detectNumberedHeading(s: string): { level: number; title: string } | null {
  const t = s.trim();
  let m = /^((?:\d+\.)+\d*|\d+)\s+(.+)$/.exec(t);
  if (m) {
    const depth = (m[1].match(/\./g)?.length || 0) + 1;
    return { level: Math.min(6, depth), title: stripNumbering(m[2].trim()) };
  }
  m = /^([IVXivx]+|[A-Za-z])[.)]\s+(.+)$/.exec(t);
  if (m) return { level: 1, title: stripNumbering(m[2].trim()) };
  return null;
}

export const stripNumbering = (title: string) =>
  title
    .replace(/^[\d\.\s]+/, '')
    .replace(/^[IVXivx]+[.)\s]+/, '')
    .replace(/^[A-Za-z][.)\s]+/, '')
    .replace(/^[\(\[\{]\d+[\)\]\}]\s*/, '')
    .trim();

export function parseHeading(scanner: LineScanner): BlockContent | null {
  const ln = scanner.peek();
  if (!ln) return null;
  let h = detectMarkdownHeading(ln.raw) || detectNumberedHeading(ln.raw);
  if (!h) return null;
  scanner.next(); // consume
  return {
    id: '',
    type: 'heading',
    level: (h.level as any),
    number: undefined,
    content: { en: toInline(h.title), zh: [] }
  } as any;
}

/** ===== 代码块 ===== */
export function parseCodeBlock(scanner: LineScanner): BlockContent | null {
  const first = scanner.peek();
  if (!first) return null;
  const fence = /^(\s*)(```|~~~)(\w+)?\s*$/.exec(first.raw);
  if (!fence) return null;
  scanner.next();
  const lang = fence[3] || '';
  const lines: string[] = [];
  while (!scanner.eof()) {
    const ln = scanner.next()!;
    if (new RegExp(`^${fence[1]}(${fence[2]})\\s*$`).test(ln.raw)) break;
    lines.push(ln.raw);
  }
  return {
    id: '',
    type: 'code',
    language: lang || undefined,
    code: lines.join('\n')
  } as any;
}

/** 
 * 🔧 FIX #4: 改进表格解析，确保格式符合 TableBlock 接口
 * ===== 表格（pipe table） ===== 
 */
export function parseTable(scanner: LineScanner): BlockContent | null {
  const start = scanner.peek();
  if (!start) return null;
  if (!/^\s*\|.*\|\s*$/.test(start.raw)) return null;

  const buf: string[] = [];
  buf.push(scanner.next()!.raw);

  const second = scanner.peek();
  if (!second || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(second.raw)) {
    scanner.back();
    return null;
  }
  buf.push(scanner.next()!.raw);

  while (!scanner.eof()) {
    const ln = scanner.peek()!;
    if (!/^\s*\|.*\|\s*$/.test(ln.raw)) break;
    buf.push(scanner.next()!.raw);
  }

  // 解析行
  const rows = buf.map(r => 
    r.trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(s => s.trim())
  );
  
  const headers = rows[0];
  
  // 解析对齐方式
  const aligns = rows[1].map(x => {
    const trimmed = x.trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
    if (trimmed.endsWith(':')) return 'right';
    return 'left';
  });
  
  const body = rows.slice(2);

  // 🔧 返回符合 TableBlock 接口的格式
  return {
    id: '',
    type: 'table',
    number: undefined,
    caption: { en: [], zh: [] },
    description: undefined,
    headers,
    rows: body,
    align: aligns as any
  } as any;
}

/** ===== 图片 ===== */
export function parseImage(scanner: LineScanner): BlockContent | null {
  const first = scanner.peek();
  if (!first) return null;
  const m = /^\s*!\[(.*?)\]\((\S+?)(?:\s+"(.*?)")?\)\s*$/.exec(first.raw);
  if (!m) return null;
  scanner.next();
  const alt = m[1] || '';
  const src = m[2] || '';
  const title = m[3] || '';

  let captionEn = title;
  const look = scanner.peek();
  if (look && /^\s*(Figure|Fig\.?)\s*\d*[:.\s-]+/i.test(look.raw)) {
    captionEn = look.raw.replace(/^\s*(Figure|Fig\.?)\s*\d*[:.\s-]+\s*/i, '').trim();
    scanner.next();
  }

  return {
    id: '',
    type: 'figure',
    src,
    alt: alt || undefined,
    number: undefined,
    caption: { en: toInline(captionEn), zh: [] },
    description: undefined,
    width: undefined,
    height: undefined,
    uploadedFilename: undefined
  } as any;
}

/** ===== 引用块 ===== */
export function parseBlockquote(scanner: LineScanner): BlockContent | null {
  const first = scanner.peek();
  if (!first || !/^\s*>/.test(first.raw)) return null;
  const lines: string[] = [];
  while (!scanner.eof()) {
    const ln = scanner.peek()!;
    if (!/^\s*>/.test(ln.raw)) break;
    lines.push(ln.raw.replace(/^\s*>\s?/, ''));
    scanner.next();
  }
  const { text } = reflowParagraphLines(lines);
  return {
    id: '',
    type: 'quote',
    content: { en: toInline(text), zh: [] },
    author: undefined
  } as any;
}

/** ===== 分隔线 ===== */
export function parseDivider(scanner: LineScanner): BlockContent | null {
  const first = scanner.peek();
  if (!first) return null;
  if (!/^\s*([-*_]\s*){3,}\s*$/.test(first.raw)) return null;
  scanner.next();
  return { id: '', type: 'divider' } as any;
}

/** ===== 行间数学公式 ===== */
export function parseBlockMath(scanner: LineScanner): BlockContent | null {
  const first = scanner.peek();
  if (!first) return null;
  
  // $$ ... $$
  if (/^\s*\$\$\s*$/.test(first.raw)) {
    scanner.next();
    const buf: string[] = [];
    while (!scanner.eof()) {
      const ln = scanner.next()!;
      if (/^\s*\$\$\s*$/.test(ln.raw)) break;
      buf.push(ln.raw);
    }
    return { 
      id: '', 
      type: 'math', 
      latex: buf.join('\n'),
      label: undefined,
      number: undefined
    } as any;
  }
  
  // \[ ... \]
  if (/^\s*\\\[\s*$/.test(first.raw)) {
    scanner.next();
    const buf: string[] = [];
    while (!scanner.eof()) {
      const ln = scanner.next()!;
      if (/^\s*\\\]\s*$/.test(ln.raw)) break;
      buf.push(ln.raw);
    }
    return { 
      id: '', 
      type: 'math', 
      latex: buf.join('\n'),
      label: undefined,
      number: undefined
    } as any;
  }
  
  // \begin{equation} ... \end{equation}
  if (/^\s*\\begin\{(equation|align|gather)\}/.test(first.raw)) {
    const env = first.raw.match(/\\begin\{(\w+)\}/)![1];
    scanner.next();
    const buf: string[] = [`\\begin{${env}}`];
    while (!scanner.eof()) {
      const ln = scanner.next()!;
      buf.push(ln.raw);
      if (new RegExp(`\\\\end\\{${env}\\}`).test(ln.raw)) break;
    }
    return { 
      id: '', 
      type: 'math', 
      latex: buf.join('\n'),
      label: undefined,
      number: undefined
    } as any;
  }
  
  return null;
}

/** ===== 列表（ordered/unordered + 层级） ===== */
export function parseList(scanner: LineScanner): BlockContent | null {
  const first = scanner.peek();
  if (!first) return null;

  const isUnordered = (s: string) => /^\s*([-*+•])\s+/.test(s);
  const isOrdered = (s: string) => /^\s*((\d+|[ivxIVX]+|[A-Za-z])[.)])\s+/.test(s);
  if (!isUnordered(first.raw) && !isOrdered(first.raw)) return null;

  type Item = { level: number; en: string };
  const items: Item[] = [];
  const stackIndent: number[] = [];
  const baseIndent = (s: string) => (s.match(/^\s*/)![0].length);

  while (!scanner.eof()) {
    const ln = scanner.peek()!;
    if (isBlank(ln.raw)) { scanner.next(); continue; }
    const unordered = isUnordered(ln.raw);
    const ordered = isOrdered(ln.raw);
    if (!unordered && !ordered) break;

    const indent = baseIndent(ln.raw);
    const text = ln.raw.replace(/^\s*([-*+•]|\d+|[ivxIVX]+|[A-Za-z])[.)]?\s+/, '');
    scanner.next();

    const multi: string[] = [text];
    while (!scanner.eof()) {
      const look = scanner.peek()!;
      if (isBlank(look.raw)) { multi.push(''); scanner.next(); continue; }
      if (startsWithNewBlockLike(look.raw)) break;
      const lookIndent = baseIndent(look.raw);
      if (lookIndent <= indent) break;
      if (isUnordered(look.raw) || isOrdered(look.raw)) break;
      multi.push(look.raw.trim());
      scanner.next();
    }

    while (stackIndent.length && indent < stackIndent[stackIndent.length - 1]) stackIndent.pop();
    if (!stackIndent.length || indent > stackIndent[stackIndent.length - 1]) stackIndent.push(indent);
    const level = stackIndent.length;

    const { text: en } = reflowParagraphLines(multi);
    items.push({ level, en });
  }

  const orderedType = isOrdered(first.raw);
  if (orderedType) {
    return {
      id: '',
      type: 'ordered-list',
      items: items.map(it => ({ content: { en: toInline(it.en), zh: [] } })),
      start: undefined
    } as any;
  } else {
    return {
      id: '',
      type: 'unordered-list',
      items: items.map(it => ({ content: { en: toInline(it.en), zh: [] } }))
    } as any;
  }
}

/** ===== 段落 ===== */
export function parseParagraph(scanner: LineScanner, carry: { value: string }): BlockContent | null {
  const ln = scanner.peek();
  if (!ln || isBlank(ln.raw) || startsWithNewBlockLike(ln.raw)) return null;

  const buf: string[] = [];
  while (!scanner.eof()) {
    const cur = scanner.peek()!;
    if (isBlank(cur.raw)) { scanner.next(); buf.push(''); continue; }
    if (startsWithNewBlockLike(cur.raw)) break;
    buf.push(cur.raw);
    scanner.next();
  }
  const { text, carryOut } = reflowParagraphLines(buf, carry.value);
  carry.value = carryOut;
  if (!text.trim()) return null;
  return {
    id: '',
    type: 'paragraph',
    content: { en: toInline(text), zh: [] },
    align: 'left'
  } as any;
}