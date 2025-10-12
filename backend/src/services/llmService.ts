import OpenAI from 'openai';

export class LLMService {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey
    });
  }

  // 识别论文整体结构
  async identifyPaperStructure(fullText: string): Promise<{
    titleEnd: number;
    abstractStart: number;
    abstractEnd: number;
    contentStart: number;
    referencesStart: number;
  }> {
    const systemPrompt = `你是论文结构分析专家。分析论文文本，精确识别各部分的位置。

识别规则：
1. 标题区域：从开头到作者、单位信息结束
2. 摘要区域：查找"Abstract"关键词，到摘要段落结束
3. 正文开始：通常是"1. Introduction"或"Introduction"
4. 参考文献开始：查找"References"、"REFERENCES"、"Bibliography"

请以 JSON 格式返回结果：
{
  "titleEnd": 标题区域结束的字符索引,
  "abstractStart": 摘要开始位置,
  "abstractEnd": 摘要结束位置,
  "contentStart": 正文开始位置,
  "referencesStart": 参考文献开始位置
}

如果某部分找不到，返回-1。`;

    const userPrompt = `分析以下论文前5000字符，识别结构位置：\n\n${fullText.substring(0, 5000)}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('LLM返回内容为空');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('识别论文结构失败:', error);
      return {
        titleEnd: -1,
        abstractStart: -1,
        abstractEnd: -1,
        contentStart: 0,
        referencesStart: -1
      };
    }
  }

  // 解析正文页面
  async parsePage(pageText: string, pageNumber: number, previousContext?: string): Promise<any> {
    const systemPrompt = this.getMainContentPrompt();

    const userPrompt = `这是PDF的第${pageNumber}页内容：

${previousContext ? `上一页末尾内容（用于上下文连接）：\n${previousContext}\n\n` : ''}当前页内容：
${pageText}

解析要求：
1. 提取所有正文段落和章节标题
2. 识别并转换所有行内公式（包括单个变量）为inline-math格式
3. 删除方括号引用标记（如[1]、[2-5]等），但保留作为正文的作者名
4. 将图表题注及描述转换为文字段落，添加占位提示
5. ID格式：block-p${pageNumber}-001, block-p${pageNumber}-002...

请以 JSON 格式返回解析结果。`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('LLM返回内容为空');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('LLM解析失败:', error);
      throw error;
    }
  }

  // 正文解析的核心Prompt
  private getMainContentPrompt(): string {
    return `你是专业的学术论文解析专家。你的任务是精确提取论文正文内容，并进行结构化处理，最后以 JSON 格式返回。

# 提取内容清单

## 需要提取的内容：
- 章节标题（Introduction, Methods, Results, Discussion, Conclusion等）
- 所有正文段落（保持完整性和准确性）
- 所有行内公式（包括单个变量名）转换为inline-math类型
- 独立的块级公式
- 正文中的列表（有序/无序）
- 引用块（如果有）
- 作为正文一部分的作者名（如 "Smith et al. proposed..."）

## 需要忽略的内容：
- 页眉、页脚、页码
- 论文标题、作者信息、单位、邮箱（在标题页）
- 摘要（Abstract）和关键词（单独处理）
- 版权声明、会议信息、DOI
- 方括号内的引用标记：[1]、[2-5]、[1,3,5]等
- 参考文献列表（References部分，单独处理）

## 特殊处理：
- 图表题注转换为纯文字段落

---

# 行内公式识别规则

需要转换为inline-math的所有情况：

1. 单个变量和参数
   - 所有数学变量：x, y, z, i, j, k, n, m, t
   - 参数：a, b, c, w, θ, α, β, λ
   - 向量/矩阵：v, W, X, A
   示例："variable x" → "variable " + inline-math("$x$")

2. 带下标的变量
   - x₁, x₂, xᵢ, aₙ, θₜ, W₁, Wₒᵤₜ
   示例："x₁" → inline-math("$x_1$")

3. 带上标的变量
   - x², x³, aⁿ, W^T, W^(-1)
   示例："x²" → inline-math("$x^2$")

4. 希腊字母（所有）
   - α, β, γ, δ, ε, ζ, η, θ, λ, μ, ν, ξ, π, ρ, σ, τ, φ, χ, ψ, ω
   - Γ, Δ, Θ, Λ, Ξ, Π, Σ, Φ, Ψ, Ω
   示例："α" → inline-math("$\\alpha$")

5. 数学运算和表达式
   - 简单运算：x + y, a - b, n * m, a / b
   - 带等号：accuracy = 95%, loss = 0.5, y = ax + b
   - 不等式：x > 0, n ≤ 100, a ≥ b
   示例："accuracy = 95%" → inline-math("$\\text{accuracy} = 95\\%$")

6. 函数和运算符
   - 三角函数：sin(x), cos(θ), tan(α)
   - 对数：log(n), ln(x), log₂(n)
   - 指数：exp(x), e^x
   - 求和/乘积：Σᵢxᵢ, Πᵢaᵢ
   示例："sin(x)" → inline-math("$\\sin(x)$")

7. 数学符号
   - 运算符：±, ×, ÷, ≠, ≈, ≡
   - 集合：∈, ∉, ⊂, ⊃, ∪, ∩, ∅
   - 微积分：∂, ∇, ∫, ∑, ∏, ∆
   - 逻辑：∀, ∃, ∧, ∨, ¬, →, ⇒
   示例："x ∈ R" → inline-math("$x \\in \\mathbb{R}$")

8. 复杂公式
   - 物理公式：E = mc², F = ma, v = at
   - 概率：P(X|Y), P(A∩B), E[X]
   - 范数：||x||₂, ||W||_F
   - 算法复杂度：O(n), O(n log n), Θ(n²)
   示例："O(n log n)" → inline-math("$O(n \\log n)$")

## 不需要转换的情况：
1. 纯数字（不带变量）：95%, 0.001, 100, 1000
2. 纯英文单词（无数学含义）：model, accuracy, training, loss
3. 单位（不带变量）：100 meters, 50 kg, 30°C

---

# 图表题注处理规则

重要：不使用figure或table组件，转换为普通文字段落！

识别模式：
- Figure X / Fig. X / Figure X: / Fig X.
- Table X / Tab. X / Table X: / Tab X.
- Equation X / Eq. X / Equation (X)

处理方式：将图表信息转换为一个普通的paragraph块

示例1：图片题注处理
原文：Figure 1: The architecture of the proposed model. The model consists of three main components.

转换为：
{
  "id": "block-p3-002",
  "type": "paragraph",
  "content": {
    "en": [
      {
        "type": "text",
        "content": "[图片位置 - 需用户上传] Figure 1: The architecture of the proposed model. The model consists of three main components."
      }
    ]
  }
}

示例2：表格题注处理
原文：Table 2: Performance comparison of different methods.

转换为：
{
  "id": "block-p5-003",
  "type": "paragraph",
  "content": {
    "en": [
      {
        "type": "text",
        "content": "[表格位置 - 需用户填写] Table 2: Performance comparison of different methods."
      }
    ]
  }
}

处理规则：
1. 在原始题注文字前添加"[图片位置 - 需用户上传]"或"[表格位置 - 需用户填写]"
2. 保留题注编号和所有描述文字
3. 作为普通paragraph块
4. 如果描述中有变量或公式，正常转换为inline-math

---

# 引用标记处理规则

需要删除的引用标记：
- 方括号数字：[1], [2], [1-3], [1,2,5], [10-15]
- 上标数字：¹, ², ³, ⁴⁵

需要保留的内容：
- 作为正文的作者名：Smith et al., Jones and Brown
- 年份（如果不在方括号内）：in 2020

处理示例：
示例1：原文："Recent work [1,2,3] has shown that x > 0."
处理后："Recent work has shown that " + inline-math("$x > 0$") + "."

示例2：原文："Smith et al. [15] proposed a new method where α = 0.1."
处理后："Smith et al. proposed a new method where " + inline-math("$\\alpha = 0.1$") + "."

---

# 输出格式规范（JSON）

1. 段落（paragraph）
{
  "id": "block-p1-001",
  "type": "paragraph",
  "content": {
    "en": [
      { "type": "text", "content": "We train the model with " },
      { "type": "inline-math", "latex": "$n = 1000$" },
      { "type": "text", "content": " samples." }
    ]
  }
}

2. 章节标题（heading）
{
  "id": "block-p1-002",
  "type": "heading",
  "level": 1,
  "content": {
    "en": [{ "type": "text", "content": "3 Methodology" }]
  }
}

3. 块级公式（math）
{
  "id": "block-p2-005",
  "type": "math",
  "latex": "$$\\mathcal{L} = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)$$"
}

4. 列表（list）
{
  "id": "block-p3-001",
  "type": "unordered-list",
  "items": [
    {
      "content": {
        "en": [
          { "type": "text", "content": "Item text with " },
          { "type": "inline-math", "latex": "$d = 512$" }
        ]
      }
    }
  ]
}

---

# 最终返回的 JSON 格式

{
  "blocks": [],
  "pageType": "content",
  "isPageStart": true,
  "isPageEnd": true,
  "lastBlockContinues": false
}

---

# 关键注意事项

1. 行内公式的识别要非常严格：遇到任何数学变量、希腊字母、数学表达式都要转换
2. 不要遗漏任何正文内容：除了引用标记，其他所有文字都要保留
3. 图表处理为纯文字：用paragraph + 提示前缀
4. LaTeX格式要正确：注意转义字符、希腊字母、下标、上标
5. 保持语义完整：删除引用标记后，确保句子通顺
6. ID唯一性：格式为 "block-p{页码}-{序号}"
7. 必须返回有效的 JSON 格式数据`;
  }

  // 提取摘要和关键词
  async extractAbstractAndKeywords(text: string): Promise<{
    abstract: { en?: string; zh?: string };
    keywords: string[];
  }> {
    const systemPrompt = `你是学术论文摘要提取专家。从论文文本中精确提取摘要和关键词，并以 JSON 格式返回。

提取规则：

1. 摘要（Abstract）：
   - 查找"Abstract"标记
   - 提取从"Abstract"下一行开始，到下一个章节标题之前的所有文字
   - 摘要通常是1-3个完整段落
   - 不包含"Abstract"标题本身
   - 删除所有引用标记如[1]、[2-5]等
   - 保留所有数学变量和公式原样（不需要转换为LaTeX）

2. 关键词（Keywords）：
   - 查找"Keywords"、"Index Terms"、"Key words"等标记
   - 提取逗号或分号分隔的词汇列表
   - 通常3-8个关键词
   - 去除多余空格，保持原始大小写

返回 JSON 格式：
{
  "abstract": {
    "en": "完整的英文摘要段落，保留数学符号"
  },
  "keywords": ["Deep Learning", "Neural Networks", "Attention Mechanism"]
}

如果找不到摘要或关键词，对应字段返回空字符串或空数组。`;

    const userPrompt = `请从以下文本中提取摘要和关键词，以 JSON 格式返回：\n\n${text}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('LLM返回内容为空');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('提取摘要失败:', error);
      return {
        abstract: { en: '' },
        keywords: []
      };
    }
  }

  // 提取参考文献
  async extractReferences(text: string): Promise<any[]> {
    const systemPrompt = `你是参考文献解析专家。从参考文献列表中提取所有引用的详细信息，解析为结构化的 JSON 数据。

识别规则：
1. 每条引用通常以编号开始：[1]、1.、(1)等
2. 标准格式包含：作者、标题、出版物、年份、页码、DOI等
3. 支持多种引用格式：IEEE、APA、MLA、Chicago、ACM等

解析策略：
- 作者识别：通常在最前面
- 标题识别：通常用引号包围或为斜体
- 期刊/会议名：通常在标题后
- 年份识别：4位数字
- DOI识别：以"doi:"、"DOI:"、"https://doi.org/"开头
- 页码识别：格式如 "pp. 123-145"

提取字段说明：
- authors: 作者列表，数组格式
- title: 论文/书籍完整标题
- publication: 期刊名、会议名或出版社
- year: 出版年份（数字）
- doi: DOI标识符
- url: 完整URL链接
- pages: 页码范围
- volume: 卷号
- issue: 期号

返回 JSON 格式：
{
  "references": [
    {
      "id": "ref-1",
      "number": 1,
      "authors": ["Vaswani, A.", "Shazeer, N."],
      "title": "Attention is all you need",
      "publication": "NeurIPS",
      "year": 2017,
      "pages": "5998-6008"
    }
  ]
}

注意事项：
1. 尽可能完整地提取所有字段
2. 作者名保持原格式
3. 如果某字段找不到，设为 null 或省略
4. 保持引用编号的连续性
5. 返回标准 JSON 格式`;

    const userPrompt = `请从以下参考文献列表中提取所有引用的结构化信息，以 JSON 格式返回：\n\n${text}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('LLM返回内容为空');
      }

      const result = JSON.parse(content);
      return result.references || [];
    } catch (error) {
      console.error('提取参考文献失败:', error);
      return [];
    }
  }
}