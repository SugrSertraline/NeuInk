// backend/src/services/testService.ts

import { EventEmitter } from 'events';

/**
 * 简化的测试服务
 * 用于替代原有的复杂解析服务
 * 仅输出固定测试内容
 */
export class TestService {
  private static instance: TestService;

  private constructor() {}

  static getInstance(): TestService {
    if (!TestService.instance) {
      TestService.instance = new TestService();
    }
    return TestService.instance;
  }

  /**
   * 模拟解析过程，返回固定测试内容
   */
  startTestParsing(paperId: string): EventEmitter {
    const emitter = new EventEmitter();

    // 模拟解析过程
    setTimeout(() => {
      emitter.emit('progress', {
        stage: 'init',
        percentage: 10,
        message: '初始化测试解析...',
      });
    }, 500);

    setTimeout(() => {
      emitter.emit('progress', {
        stage: 'parsing',
        percentage: 50,
        message: '测试解析中...',
      });
    }, 1000);

    setTimeout(() => {
      emitter.emit('progress', {
        stage: 'completed',
        percentage: 100,
        message: '测试解析完成!',
      });

      // 返回固定的测试内容
      emitter.emit('complete', {
        result: {
          paperId,
          metadata: {
            title: '测试论文标题',
            authors: [
              { name: '测试作者1', affiliation: '测试机构1', email: 'author1@test.com' },
              { name: '测试作者2', affiliation: '测试机构2', email: 'author2@test.com' }
            ],
            abstract: {
              en: 'This is a test abstract for demonstration purposes.',
              zh: '这是一个用于演示目的的测试摘要。'
            },
            keywords: ['测试关键词1', '测试关键词2', 'test keyword3'],
            year: 2024,
            publication: '测试期刊',
            doi: '10.1000/test.doi'
          },
          success: true
        },
        paperContent: {
          abstract: {
            en: 'This is a test abstract for demonstration purposes.',
            zh: '这是一个用于演示目的的测试摘要。'
          },
          keywords: ['测试关键词1', '测试关键词2', 'test keyword3'],
          sections: [
            {
              id: 'section-1',
              number: '1',
              title: { en: 'Introduction', zh: '引言' },
              content: [
                {
                  id: 'paragraph-1',
                  type: 'paragraph',
                  content: {
                    en: [
                      { type: 'text', content: 'This is a test paragraph in the introduction section. ' },
                      { type: 'text', content: 'It contains some sample text to demonstrate the structure.' }
                    ],
                    zh: [
                      { type: 'text', content: '这是引言部分的测试段落。' },
                      { type: 'text', content: '它包含一些示例文本来演示结构。' }
                    ]
                  }
                }
              ],
              subsections: []
            },
            {
              id: 'section-2',
              number: '2',
              title: { en: 'Methodology', zh: '方法' },
              content: [
                {
                  id: 'paragraph-2',
                  type: 'paragraph',
                  content: {
                    en: [
                      { type: 'text', content: 'This section describes the test methodology used in this paper.' }
                    ],
                    zh: [
                      { type: 'text', content: '本节描述了本文中使用的测试方法。' }
                    ]
                  }
                }
              ],
              subsections: []
            }
          ],
          references: [
            {
              id: 'ref-1',
              number: 1,
              authors: ['测试作者A', '测试作者B'],
              title: '测试参考文献标题',
              publication: '测试期刊',
              year: 2023,
              doi: '10.1000/test.ref1'
            }
          ],
          blockNotes: [],
          checklistNotes: [],
          attachments: []
        }
      });
    }, 2000);

    return emitter;
  }

  /**
   * 检查任务是否在运行
   */
  isJobRunning(paperId: string): boolean {
    // 简化实现，总是返回 false
    return false;
  }

  /**
   * 终止任务
   */
  terminateParsing(paperId: string): boolean {
    // 简化实现，总是返回 true
    return true;
  }

  /**
   * 清理所有任务
   */
  cleanup() {
    console.log('🧹 清理所有测试任务...');
  }
}

// 导出单例
export const testService = TestService.getInstance();