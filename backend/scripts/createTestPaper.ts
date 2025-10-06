// backend/scripts/createTestPaper.ts

import { initDatabase } from '../src/utils/database.js';
import { initFileSystem, savePaperJSON } from '../src/utils/fileSystem.js';
import { Paper } from '../src/models/Paper.js';
import { v4 as uuidv4 } from 'uuid';

async function createTestPaper() {
  console.log('开始创建测试论文...\n');

  // 初始化
  await initDatabase();
  await initFileSystem();

  const paperId = `paper-${uuidv4()}`;
  const now = new Date().toISOString();

  // 1) 创建数据库记录（全部用 camelCase；不要给可选字段传 null）
  const paperRecord = {
    id: paperId,
    title: 'Attention Is All You Need',
    shortTitle: 'Transformer',
    authors: JSON.stringify([
      { name: 'Ashish Vaswani', affiliation: 'Google Brain' },
      { name: 'Noam Shazeer', affiliation: 'Google Brain' },
      { name: 'Niki Parmar', affiliation: 'Google Research' }
    ]),
    publication: 'NeurIPS',
    year: 2017,
    date: '2017-12-04',
    doi: '10.48550/arXiv.1706.03762',
    articleType: 'conference',
    // sciQuartile: 省略
    // casQuartile: 省略
    ccfRank: 'A',
    // impactFactor: 省略
    tags: JSON.stringify(['深度学习', 'Transformer', '注意力机制', 'NLP']),
    readingStatus: 'unread',
    priority: 'high',
    rating: 5,
    remarks: '这是深度学习领域的里程碑论文，提出了Transformer架构。',
    readingPosition: 0,
    totalReadingTime: 0,
    // lastReadTime: 省略
    isFinished: false,
  };

  try {
    await Paper.create(paperRecord);
    console.log('✅ 数据库记录创建成功');
  } catch (e) {
    console.error('❌ 数据库写入失败:', e);
    process.exit(1);
  }

  // 2) 创建 JSON 文件内容（metadata 也统一 camelCase，使用 remarks）
  const paperContent = {
    metadata: {
      id: paperId,
      title: 'Attention Is All You Need',
      shortTitle: 'Transformer',
      authors: [
        { name: 'Ashish Vaswani', affiliation: 'Google Brain' },
        { name: 'Noam Shazeer', affiliation: 'Google Brain' },
        { name: 'Niki Parmar', affiliation: 'Google Research' }
      ],
      publication: 'NeurIPS',
      year: 2017,
      date: '2017-12-04',
      doi: '10.48550/arXiv.1706.03762',
      articleType: 'conference',
      ccfRank: 'A',
      abstract: {
        en: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.',
        zh: '当前主流的序列转换模型基于复杂的循环神经网络或卷积神经网络。性能最好的模型还通过注意力机制连接编码器和解码器。我们提出了一种新的简单网络架构——Transformer，它完全基于注意力机制。'
      },
      keywords: ['深度学习', 'Transformer', '注意力机制', 'NLP'],
      tags: ['深度学习', 'Transformer', '注意力机制', 'NLP'],
      readingStatus: 'unread',
      priority: 'high',
      rating: 5,
      remarks: '这是深度学习领域的里程碑论文，提出了Transformer架构。',
      createdAt: now,
      updatedAt: now
    },
    sections: [
      {
        id: 'section-1',
        number: '1',
        title: { en: 'Introduction', zh: '引言' },
        content: [
          {
            id: 'block-p1',
            type: 'paragraph',
            content: {
              en: [
                { type: 'text', content: 'Recurrent neural networks, long short-term memory ' },
                { type: 'citation', referenceIds: ['ref-1', 'ref-2'], displayText: '[1, 2]' },
                { type: 'text', content: ' and gated recurrent ' },
                { type: 'citation', referenceIds: ['ref-3'], displayText: '[3]' },
                { type: 'text', content: ' neural networks in particular, have been firmly established as state of the art approaches in sequence modeling and transduction problems.' }
              ],
              zh: [
                { type: 'text', content: '循环神经网络，特别是长短期记忆网络 ' },
                { type: 'citation', referenceIds: ['ref-1', 'ref-2'], displayText: '[1, 2]' },
                { type: 'text', content: ' 和门控循环神经网络 ' },
                { type: 'citation', referenceIds: ['ref-3'], displayText: '[3]' },
                { type: 'text', content: '，已经被牢固地确立为序列建模和转换问题的最先进方法。' }
              ]
            }
          },
          {
            id: 'block-p2',
            type: 'paragraph',
            content: {
              en: [
                { type: 'text', content: 'The Transformer model architecture is shown in ' },
                { type: 'figure-ref', figureId: 'block-fig-1', displayText: 'Figure 1' },
                { type: 'text', content: '.' }
              ],
              zh: [
                { type: 'text', content: 'Transformer模型架构如' },
                { type: 'figure-ref', figureId: 'block-fig-1', displayText: '图1' },
                { type: 'text', content: '所示。' }
              ]
            }
          }
        ]
      },
      {
        id: 'section-2',
        number: '2',
        title: { en: 'Model Architecture', zh: '模型架构' },
        content: [
          {
            id: 'block-fig-1',
            type: 'figure',
            number: 1,
            src: '/placeholder-transformer-architecture.png',
            alt: 'Transformer Architecture',
            caption: {
              en: [{ type: 'text', content: 'The Transformer model architecture' }],
              zh: [{ type: 'text', content: 'Transformer模型架构' }]
            },
            description: {
              en: [{ type: 'text', content: 'The encoder is on the left and the decoder is on the right.' }],
              zh: [{ type: 'text', content: '编码器在左侧，解码器在右侧。' }]
            },
            width: '80%'
          },
          {
            id: 'block-p3',
            type: 'paragraph',
            content: {
              en: [
                { type: 'text', content: 'Most competitive neural sequence transduction models have an encoder-decoder structure ' },
                { type: 'citation', referenceIds: ['ref-4', 'ref-5'], displayText: '[4, 5]' },
                { type: 'text', content: '. The encoder maps an input sequence to a sequence of continuous representations.' }
              ]
            }
          },
          {
            id: 'block-math-1',
            type: 'math',
            latex: '\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V',
            label: '(1)',
            number: 1
          }
        ]
      }
    ],
    references: [
      { id: 'ref-1', number: 1, authors: ['Sepp Hochreiter', 'Jürgen Schmidhuber'], title: 'Long Short-Term Memory', publication: 'Neural Computation', year: 1997, volume: '9', issue: '8', pages: '1735-1780' },
      { id: 'ref-2', number: 2, authors: ['Kyunghyun Cho', 'et al.'], title: 'Learning Phrase Representations using RNN Encoder-Decoder', publication: 'EMNLP', year: 2014 },
      { id: 'ref-3', number: 3, authors: ['Junyoung Chung', 'et al.'], title: 'Empirical Evaluation of Gated Recurrent Neural Networks', year: 2014 },
      { id: 'ref-4', number: 4, authors: ['Ilya Sutskever', 'Oriol Vinyals', 'Quoc V. Le'], title: 'Sequence to Sequence Learning with Neural Networks', publication: 'NIPS', year: 2014 },
      { id: 'ref-5', number: 5, authors: ['Dzmitry Bahdanau', 'Kyunghyun Cho', 'Yoshua Bengio'], title: 'Neural Machine Translation by Jointly Learning to Align and Translate', publication: 'ICLR', year: 2015 }
    ],
    blockNotes: [],
    checklistNotes: []
  };

  await savePaperJSON(paperId, paperContent);
  console.log('✅ JSON文件创建成功');

  console.log(`\n✨ 测试论文创建完成！`);
  console.log(`📝 论文ID: ${paperId}`);
  console.log(`📄 标题: ${paperRecord.title}`);
  console.log(`\n可以通过以下API访问:`);
  console.log(`   GET  http://localhost:3001/api/papers/${paperId}`);
  console.log(`   GET  http://localhost:3001/api/papers/${paperId}/content`);
}

// 运行脚本
createTestPaper()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 创建失败:', error);
    process.exit(1);
  });
