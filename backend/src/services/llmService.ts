import OpenAI from 'openai';

export class LLMService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey
    });
  }

  async identifyPaperStructure(fullText: string): Promise<{
    titleEnd: number;
    abstractStart: number;
    abstractEnd: number;
    contentStart: number;
    referencesStart: number;
  }> {
    const systemPrompt = `你是论文结构分析专家。分析论文文本，精确识别各部分的位置。

识别规则（按优先级顺序）：

1. 标题区域（Title Area）：
   - 从文档开头到作者信息、单位信息结束
   - 通常包含：论文标题、作者列表、单位、邮箱、会议/期刊信息
   - 结束标志：出现 Abstract 或第一个章节标题

2. 摘要区域（Abstract）：
   - 开始标志：独立一行的 "Abstract"（可能全大写）
   - 结束标志：出现 "Keywords"、"1. Introduction" 或 "Introduction"
   - 注意：摘要内容通常是1-3个段落

3. 正文开始（Content Start）：
   - 首选标志：
     * "1. Introduction" 或 "1 Introduction"
     * "I. INTRODUCTION"（IEEE格式）
     * "Introduction"（独立成行，作为章节标题）
   - 正文一定在摘要之后开始

4. 参考文献开始（References Start）**【重要 - 必须精确识别】**：
   - 识别模式（按优先级）：
     a) 独立一行的 "References"（可能全大写：REFERENCES）
     b) 独立一行的 "Bibliography"
     c) 独立一行的 "参考文献"
   - 特征验证：
     * References标题后紧跟编号列表（[1]、1.、(1)等）
     * 内容格式符合引用格式（作者名、年份、标题）
   - 定位策略：
     * 搜索文本后30%区域（通常在论文末尾）
     * 确保找到的是章节标题而非正文中的引用
     * 记录"References"标题行的起始字符索引
   
   **关键**：参考文献起始位置必须准确，因为该位置之后的内容都不应被识别为正文

识别流程：
1. 先定位 Abstract 和 References（这两个是最明确的界标）
2. 再确定 Title 区域（Abstract 之前）
3. 最后确定 Content 开始（Abstract 之后，References 之前）

返回 JSON 格式：
{
  "titleEnd": 数字,
  "abstractStart": 数字,
  "abstractEnd": 数字,
  "contentStart": 数字,
  "referencesStart": 数字
}

如果某部分找不到，返回-1。
注意：referencesStart 极其重要，必须尽全力准确定位！`;

    const userPrompt = `分析以下论文，识别结构位置。
特别注意：必须准确找到 References 章节的起始位置！

论文文本：
${fullText.substring(0, 8000)}

${fullText.length > 8000 ? `\n\n...（中间内容省略）...\n\n论文末尾部分：\n${fullText.substring(fullText.length - 3000)}` : ''}`;

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

  async parsePage(
    pageText: string, 
    pageNumber: number, 
    previousContext?: string,
    isInReferences?: boolean,
    referencesStart?: number,
    pageStartCharIndex?: number
  ): Promise<any> {
    // 预处理：检查是否在参考文献区域
    if (isInReferences || (referencesStart && pageStartCharIndex && pageStartCharIndex >= referencesStart)) {
      return {
        blocks: [],
        pageType: 'references',
        isPageStart: true,
        isPageEnd: true,
        lastBlockContinues: false,
        skipReason: 'Page is in references section'
      };
    }

    const systemPrompt = this.getMainContentPrompt();

    const userPrompt = `这是PDF的第${pageNumber}页内容。

${previousContext ? `【上一页末尾内容】（用于段落连接）：
${previousContext}

` : ''}【当前页完整内容】：
${pageText}

【解析任务】：
按照系统提示中的规则，完整解析这一页的内容。

【特别提醒】：
1. 仔细识别有序列表和无序列表（检查换行模式）
2. 仔细识别行间公式（独立成行的公式）
3. 完全跳过图表题注，不要输出
4. 如果遇到 "References" 标题，说明参考文献开始了，停止解析后续内容

请返回标准 JSON 格式的解析结果。`;

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

  private getMainContentPrompt(): string {
    return `你是专业的学术论文解析专家。你的任务是精确提取论文正文内容，进行结构化处理，并翻译成中文。

════════════════════════════════════════
📋 第一部分：内容提取清单
════════════════════════════════════════

✅ 需要提取的内容：
├─ 章节标题（Introduction, Methods, Results, Discussion, Conclusion等）
├─ 所有正文段落（完整、准确）
├─ 行内公式（文本中的公式）
├─ 行间公式（独立成行的公式）
├─ 有序列表（编号列表）
├─ 无序列表（符号列表）
└─ 正文中的作者名（如 "Smith et al. proposed..."）

❌ 需要完全跳过的内容（不要输出到结果中）：
├─ 页眉、页脚、页码
├─ 论文标题、作者信息、单位信息（标题页部分）
├─ 摘要（Abstract）和关键词（单独处理）
├─ 版权声明、会议信息、DOI
├─ 方括号引用标记：[1]、[2-5]、[1,3,5]等（删除但不影响句子）
├─ **图表题注**（Figure X:、Table X:、Fig. X: 等独立题注）
├─ 图片和表格本身的内容
└─ 参考文献列表（References 部分及之后的所有内容）

════════════════════════════════════════
🎯 第二部分：列表识别规则（重点强化）
════════════════════════════════════════

【核心识别标准】：通过换行判断！

一、有序列表识别模式

✅ 模式1：阿拉伯数字 + 点号 + 空格
识别特征：
- 每一项独立成行
- 格式：1. xxx\n2. xxx\n3. xxx
- 编号连续：1, 2, 3...

示例A（应识别为列表）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. The quadratic computation of self-attention.

2. The memory bottleneck in stacking layers.

3. The speed plunge in predicting long outputs.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 3个items的ordered-list

示例B（应识别为列表，带多句话）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. First advantage: fast computation. This reduces 
   the overall complexity significantly.

2. Second advantage: low memory usage. The model
   requires only O(L) memory.

3. Third advantage: high accuracy on benchmarks.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 3个items的ordered-list（每项可多句话）

✅ 模式2：罗马数字编号
- i. xxx\nii. xxx\niii. xxx
- I. xxx\nII. xxx\nIII. xxx

✅ 模式3：字母编号
- a) xxx\nb) xxx\nc) xxx
- (a) xxx\n(b) xxx\n(c) xxx

❌ 反例（不是列表，是普通段落）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The model has three advantages: 1. fast, 2. efficient, 3. accurate.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 编号在同一行，这是普通paragraph

二、无序列表识别模式

✅ 识别特征：
- 每一项独立成行
- 符号：•、-、*、◦ 等
- 格式：• xxx\n• xxx\n• xxx

示例（应识别为列表）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• High performance on benchmark datasets
• Low computational complexity
• Easy to implement and train
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 3个items的unordered-list

三、识别检查清单（逐步验证）

第1步：检查是否有编号/符号
├─ 有阿拉伯数字编号（1. 2. 3.）？
├─ 有罗马数字编号（i. ii. iii.）？
├─ 有字母编号（a) b) c)）？
└─ 有列表符号（• - *）？

第2步：检查换行模式
├─ 每个编号/符号后是否有换行？
├─ 是否有多个这样的换行编号？
└─ 编号是否连续？

第3步：做出判断
├─ 如果有换行 + 连续编号 → 列表
└─ 如果编号在同一行 → 普通段落

════════════════════════════════════════
∑ 第三部分：行间公式识别规则（重点强化）
════════════════════════════════════════

【核心识别标准】：独立成行 + 前后有换行！

一、行间公式（Display Math）特征

✅ 必须同时满足：
1. 公式独立占据一行或多行
2. 前面有换行（不在句子中间）
3. 后面有换行（不在句子中间）
4. 通常有公式编号（如 (1)、(2)），但不是必须
5. 视觉上与正文段落明显分离

二、识别示例

示例A（标准行间公式）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The loss function is defined as:

    L = -Σ yi log(ŷi)    (1)

where yi is the true label.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 公式独立成行，应识别为type: "math"

输出格式：
{
  "id": "block-p3-005",
  "type": "math",
  "latex": "L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)"
}

示例B（复杂多行公式）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
We formulate the attention mechanism as:

    Attention(Q, K, V) = softmax(QK^T / √d_k)V

This allows the model to focus on relevant parts.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 应识别为type: "math"

示例C（带编号的行间公式）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                    
    y = Wx + b           (2)
    
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 应识别为type: "math"
→ 编号(2)可以包含在latex中，或者忽略

三、行内公式（Inline Math）特征

✅ 特征：
- 在正文句子内部
- 与文字在同一行
- 通常较短
- 没有公式编号

示例（行内公式）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The accuracy is 95% when n = 1000 samples.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ "n = 1000" 是行内公式

输出格式（在paragraph的content中）：
{
  "type": "paragraph",
  "content": {
    "en": [
      {"type": "text", "content": "The accuracy is 95% when "},
      {"type": "inline-math", "latex": "n = 1000"},
      {"type": "text", "content": " samples."}
    ]
  }
}

四、识别检查清单

第1步：检查位置
├─ 公式是否独立占据整行？
├─ 公式前面是否有换行？
└─ 公式后面是否有换行？

第2步：检查上下文
├─ 公式前后是否是完整的句子？
└─ 还是公式在句子中间？

第3步：做出判断
├─ 如果独立成行 + 前后换行 → 行间公式（type: "math"）
└─ 如果在句子中 → 行内公式（type: "inline-math"）

五、常见需要识别的数学元素

行内公式元素：
├─ 变量：x, y, z, n, m, i, j, k
├─ 希腊字母：α, β, γ, δ, θ, λ, σ, φ, ω
├─ 带下标：x₁, x₂, xᵢ, W_out
├─ 带上标：x², W^T, e^x
├─ 简单运算：x + y, a * b, x / y
├─ 函数：sin(x), log(n), exp(x)
├─ 关系符号：x > 0, x ≤ 100, x ∈ R
└─ 复杂表达式：O(n²), P(X|Y), ||x||₂

行间公式元素：
├─ 求和公式：Σ, ∑
├─ 积分公式：∫
├─ 矩阵和向量运算
├─ 多行对齐的等式
├─ 分式和根式
└─ 复杂的数学推导

════════════════════════════════════════
🚫 第四部分：图表题注处理（完全跳过）
════════════════════════════════════════

【重要】图表题注应该完全跳过，不要输出到结果中！

一、题注识别模式

✅ 独立题注特征（需要跳过）：
1. 独立成行
2. 前后有明显换行
3. 格式：Figure X: / Fig. X: / Table X:
4. 在视觉上与正文分离

识别模式：
├─ Figure \d+: .+
├─ Fig\. \d+: .+  
├─ Table \d+: .+
├─ 图 \d+[：:] .+
└─ 表 \d+[：:] .+

示例（需要跳过）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Figure 1: The architecture of the neural network.

Table 2: Performance comparison on benchmark datasets.

Fig. 3: Visualization of attention weights across layers.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 这些都是独立题注，全部跳过，不输出

二、正文引用（需要保留）

❌ 不是题注特征（需要保留为正文）：
- 在段落句子中间或末尾
- 与前后文字连续
- 通常用括号或小写形式
- 是完整句子的一部分

示例（保留为正文）：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
As shown in Figure 1, the model consists of three layers.

The results (see Table 2) demonstrate improvement.

Figure 3 shows the attention distribution clearly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ 这些是正文的一部分，保留

三、处理流程

遇到"Figure"或"Table"时：
1. 检查是否独立成行
2. 检查前后是否有正常文字
3. 如果是独立题注 → 完全跳过，继续处理下一个内容
4. 如果是正文引用 → 保留在paragraph中

════════════════════════════════════════
📖 第五部分：引用标记处理规则
════════════════════════════════════════

一、需要删除的引用标记

删除规则：
├─ 方括号数字：[1], [2], [10], [100]
├─ 方括号范围：[1-3], [5-10], [20-25]
├─ 方括号列表：[1,2,3], [1,3,5], [2,4,6,8]
├─ 上标数字：¹, ², ³, ⁴, ⁵
└─ 混合格式：[1, 3-5, 7]

处理示例：
原文："Recent work [1,2,3] has shown that x > 0."
处理后："Recent work has shown that x > 0."

原文："Smith et al.¹ proposed a new method."
处理后："Smith et al. proposed a new method."

二、需要保留的内容

保留规则：
├─ 作者名：Smith et al., Jones and Brown
├─ 年份：in 2020, (2019)
├─ 正文中的数字：[3] layers（如果是正文描述）
└─ 数组表示：array[i]（编程相关）

三、删除后的文本清理

注意事项：
├─ 删除引用标记后，检查是否有多余空格
├─ 确保句子仍然通顺
├─ 保持标点符号的正确性
└─ 不要产生双空格

════════════════════════════════════════
🌏 第六部分：中文翻译规则
════════════════════════════════════════

【关键】所有英文内容必须翻译成中文！

一、翻译要求

质量标准：
├─ 准确性：保持学术术语的准确性
├─ 流畅性：符合中文表达习惯
├─ 专业性：使用规范的学术用语
├─ 完整性：所有英文都要翻译
└─ 一致性：术语翻译保持一致

二、术语对照表

基础术语：
├─ accuracy → 准确率
├─ loss function → 损失函数
├─ neural network → 神经网络
├─ attention mechanism → 注意力机制
├─ training → 训练
├─ evaluation → 评估
├─ dataset → 数据集
├─ model → 模型
├─ performance → 性能
├─ transformer → Transformer（保持英文）
├─ embedding → 嵌入
├─ layer → 层
├─ parameter → 参数
└─ optimization → 优化

方法论术语：
├─ self-attention → 自注意力
├─ multi-head attention → 多头注意力
├─ feed-forward → 前馈
├─ backpropagation → 反向传播
├─ gradient descent → 梯度下降
├─ learning rate → 学习率
├─ batch size → 批次大小
└─ epoch → 轮次

三、数学公式的翻译

规则：
├─ 公式本身不翻译（保持LaTeX）
├─ 公式前后的说明文字要翻译
├─ 变量定义要翻译
└─ 变量符号保持不变

示例：
EN: "where x is the input vector"
ZH: "其中 x 是输入向量"

四、章节标题翻译

标题对照：
├─ Abstract → 摘要
├─ Introduction → 引言
├─ Related Work → 相关工作
├─ Methodology → 方法论
├─ Method → 方法
├─ Approach → 方法
├─ Experiments → 实验
├─ Results → 结果
├─ Discussion → 讨论
├─ Conclusion → 结论
├─ Future Work → 未来工作
└─ References → 参考文献

════════════════════════════════════════
📦 第七部分：输出格式规范
════════════════════════════════════════

一、普通段落（paragraph）

{
  "id": "block-p1-001",
  "type": "paragraph",
  "content": {
    "en": [
      {"type": "text", "content": "We train the model with "},
      {"type": "inline-math", "latex": "n = 1000"},
      {"type": "text", "content": " samples."}
    ],
    "zh": [
      {"type": "text", "content": "我们使用 "},
      {"type": "inline-math", "latex": "n = 1000"},
      {"type": "text", "content": " 个样本训练模型。"}
    ]
  }
}

二、章节标题（heading）

{
  "id": "block-p1-002",
  "type": "heading",
  "level": 1,
  "content": {
    "en": [{"type": "text", "content": "3 Methodology"}],
    "zh": [{"type": "text", "content": "3 方法论"}]
  }
}

level说明：
├─ 1: 主标题（Introduction, Methods等）
├─ 2: 二级标题（3.1 Model Architecture）
└─ 3: 三级标题（3.1.1 Attention Layer）

三、行间公式（math）

{
  "id": "block-p2-005",
  "type": "math",
  "latex": "\\mathcal{L} = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)"
}

注意：
├─ 不需要美元符号
├─ 不需要翻译
├─ 保持LaTeX格式
└─ 注意转义字符（\\而不是\）

四、有序列表（ordered-list）

{
  "id": "block-p3-001",
  "type": "ordered-list",
  "items": [
    {
      "content": {
        "en": [
          {"type": "text", "content": "First item with "},
          {"type": "inline-math", "latex": "O(n^2)"},
          {"type": "text", "content": " complexity."}
        ],
        "zh": [
          {"type": "text", "content": "第一项，复杂度为 "},
          {"type": "inline-math", "latex": "O(n^2)"},
          {"type": "text", "content": "。"}
        ]
      }
    },
    {
      "content": {
        "en": [{"type": "text", "content": "Second item about memory usage."}],
        "zh": [{"type": "text", "content": "第二项关于内存使用。"}]
      }
    }
  ]
}

五、无序列表（unordered-list）

{
  "id": "block-p3-002",
  "type": "unordered-list",
  "items": [
    {
      "content": {
        "en": [{"type": "text", "content": "High accuracy on benchmarks"}],
        "zh": [{"type": "text", "content": "在基准测试上的高准确率"}]
      }
    }
  ]
}

════════════════════════════════════════
✅ 第八部分：解析流程检查清单
════════════════════════════════════════

第1步：初步扫描
├─ 检查是否有"References"标题
├─ 如果有，标记位置，该位置之后的内容全部跳过
└─ 确定需要处理的文本范围

第2步：内容识别
├─ 识别章节标题（独立成行，通常有编号）
├─ 识别普通段落
├─ 识别列表（检查换行 + 编号模式）
├─ 识别行间公式（独立成行 + 前后换行）
└─ 在段落中识别行内公式

第3步：内容过滤
├─ 跳过所有独立的图表题注
├─ 删除所有引用标记[1]、[2-5]等
├─ 保留正文中的图表引用
└─ 清理多余空格

第4步：翻译处理
├─ 翻译所有文本内容
├─ 保持数学公式不变
├─ 确保术语翻译一致
└─ 检查zh和en结构对应

第5步：格式输出
├─ 生成唯一ID（block-p{页码}-{序号}）
├─ 确定正确的type
├─ 构建content结构
└─ 验证JSON格式

════════════════════════════════════════
⚠️ 第九部分：特别注意事项
════════════════════════════════════════

务必做到：
✓ 列表识别：必须检查换行模式，不要误判
✓ 行间公式：独立成行 + 前后换行才是行间公式
✓ 题注跳过：独立的图表题注完全不输出
✓ 参考文献：遇到References章节立即停止
✓ 引用删除：[1]、[2-5]等全部删除
✓ 完整翻译：所有英文内容必须翻译
✓ 结构对应：en和zh的content结构必须一致
✓ ID唯一：block-p{页码}-{序号}格式
✓ LaTeX准确：注意转义、希腊字母、特殊符号

绝对不要：
✗ 不要把正文中的"Figure 1 shows"当作题注
✗ 不要把同行的编号识别为列表
✗ 不要把行内公式识别为行间公式
✗ 不要输出图表题注
✗ 不要处理参考文献内容
✗ 不要遗漏中文翻译
✗ 不要在行间公式外加美元符号
✗ 不要破坏句子的完整性

════════════════════════════════════════
📤 第十部分：最终返回格式
════════════════════════════════════════

{
  "blocks": [
    // 所有解析的块，按顺序排列
  ],
  "pageType": "content",  // 或 "references"
  "isPageStart": true,
  "isPageEnd": true,
  "lastBlockContinues": false
}

完成解析后，请自我检查：
1. ✓ 是否所有列表都正确识别了？
2. ✓ 是否所有行间公式都识别了？
3. ✓ 是否跳过了所有图表题注？
4. ✓ 是否删除了所有引用标记？
5. ✓ 是否完整翻译了所有内容？
6. ✓ 是否en和zh结构一致？
7. ✓ 是否在遇到References后停止了？

════════════════════════════════════════`;
  }

  async extractAbstractAndKeywords(text: string): Promise<{
    abstract: { en?: string; zh?: string };
    keywords: string[];
  }> {
    const systemPrompt = `你是学术论文摘要提取专家。从论文文本中精确提取摘要和关键词，并翻译成中文，以 JSON 格式返回。

提取规则：

1. 摘要（Abstract）：
   - 查找"Abstract"标记（可能是ABSTRACT全大写）
   - 提取从"Abstract"下一行开始，到下一个章节标题之前的所有文字
   - 摘要通常是1-3个完整段落
   - 不包含"Abstract"标题本身
   - 删除所有引用标记如[1]、[2-5]等
   - 保留所有数学变量和公式原样（不需要转换为LaTeX）
   - 将英文摘要翻译成中文（准确、流畅、专业）

2. 关键词（Keywords）：
   - 查找"Keywords"、"Index Terms"、"Key words"等标记
   - 提取逗号或分号分隔的词汇列表
   - 通常3-8个关键词
   - 去除多余空格，保持原始大小写
   - 每个关键词首字母通常大写

返回 JSON 格式：
{
  "abstract": {
    "en": "完整的英文摘要，多段落用两个换行分隔，删除了引用标记",
    "zh": "完整的中文摘要翻译，保持段落结构"
  },
  "keywords": ["Deep Learning", "Neural Networks", "Attention Mechanism"]
}

如果找不到摘要或关键词，对应字段返回空字符串或空数组。`;

    const userPrompt = `请从以下文本中提取摘要和关键词，并将摘要翻译成中文，以 JSON 格式返回：

${text}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 3000,
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
        abstract: { en: '', zh: '' },
        keywords: []
      };
    }
  }

  async extractReferences(text: string): Promise<any[]> {
    const systemPrompt = `你是参考文献解析专家。从参考文献列表中提取所有引用的详细信息，解析为结构化的 JSON 数据。

识别规则：

1. 参考文献格式识别：
   - 编号格式：[1]、1.、(1)、[1.]等
   - 每条引用通常独立成行或以编号开始
   - 编号通常是连续的数字

2. 字段提取规则：

   【作者（authors）】：
   - 位置：通常在引用的最前面
   - 格式：姓, 名首字母. 或 姓 名首字母
   - 多个作者用逗号或"and"分隔
   - 示例：["Vaswani, A.", "Shazeer, N.", "Parmar, N."]

   【标题（title）】：
   - 位置：通常在作者之后
   - 格式：可能用引号包围，或为斜体
   - 完整提取，保持原标题
   - 示例："Attention is all you need"

   【出版物（publication）】：
   - 期刊名、会议名或出版社
   - 可能包含缩写（NeurIPS, ICML, arXiv等）
   - 示例："Advances in Neural Information Processing Systems"

   【年份（year）】：
   - 4位数字
   - 通常在出版物之后或括号中
   - 返回数字类型
   - 示例：2017

   【DOI】：
   - 以"doi:"、"DOI:"、"https://doi.org/"开头
   - 格式：10.xxxx/xxxxx
   - 示例："10.1109/CVPR.2016.90"

   【URL】：
   - 完整的网址
   - 通常以http://或https://开头
   - 示例："https://arxiv.org/abs/1706.03762"

   【页码（pages）】：
   - 格式：pp. 123-145 或 pages 123-145
   - 提取数字范围
   - 示例："5998-6008"

   【卷号（volume）】：
   - 通常在期刊名之后
   - 格式：vol. X 或 Volume X
   - 示例："30"

   【期号（issue）】：
   - 通常在卷号之后
   - 格式：no. X 或 (X)
   - 示例："4"

3. 支持的引用格式：
   - IEEE：[1] A. Author, "Title," Journal, vol. X, no. Y, pp. Z-Z, Year.
   - ACM：[1] Author, A. Year. Title. In Conference (pp. Z-Z).
   - APA：Author, A. (Year). Title. Journal, Volume(Issue), pages.
   - 其他常见学术格式

返回 JSON 格式：
{
  "references": [
    {
      "id": "ref-1",
      "number": 1,
      "authors": ["Vaswani, A.", "Shazeer, N."],
      "title": "Attention is all you need",
      "publication": "Advances in Neural Information Processing Systems",
      "year": 2017,
      "pages": "5998-6008",
      "volume": null,
      "issue": null,
      "doi": null,
      "url": null
    }
  ]
}

注意事项：
1. 尽可能完整地提取所有字段
2. 作者名保持原格式（不要修改）
3. 如果某字段找不到，设为 null
4. 保持引用编号的连续性
5. year必须是数字类型
6. number必须是数字类型
7. 返回标准 JSON 格式，确保所有引号正确`;

    const userPrompt = `请从以下参考文献列表中提取所有引用的结构化信息。

参考文献列表：
${text}

返回包含所有引用的JSON数据。`;

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