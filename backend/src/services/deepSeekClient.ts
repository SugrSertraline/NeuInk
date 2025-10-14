// backend/src/services/deepSeekClient.ts

import axios from 'axios';

/**
 * DeepSeek API 客户端配置
 */
export interface DeepSeekConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * DeepSeek API 响应格式
 */
interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * DeepSeek API 客户端
 * 兼容 OpenAI Chat Completions API 格式
 */
export class DeepSeekClient {
  private config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = config;
  }

  /**
   * 调用 DeepSeek Chat Completions API
   */
  async chat(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    try {
      const requestData = {
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
        frequency_penalty: 0,
        presence_penalty: 0,
        response_format: {
          type: 'text'
        },
        stream: false
      };

      const response = await axios.post<DeepSeekResponse>(
        `${this.config.baseURL}/chat/completions`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          timeout: 60000 // 60秒超时
        }
      );

      const content = response.data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('DeepSeek API 返回内容为空');
      }

      return content;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('DeepSeek API 调用失败:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        throw new Error(`DeepSeek API 错误: ${error.response?.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * 解析 JSON 响应（自动清理 markdown 代码块）
   */
  parseJsonResponse<T = any>(response: string): T {
    try {
      // 移除可能的 markdown 代码块标记
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('JSON 解析失败，原始响应:', response);
      throw new Error(`无法解析 AI 返回的 JSON 数据: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}

/**
 * 创建 DeepSeek 客户端实例
 */
export function createDeepSeekClient(): DeepSeekClient {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY 环境变量');
  }

  const config: DeepSeekConfig = {
    baseURL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
    apiKey: apiKey,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    maxTokens: parseInt(process.env.DEEPSEEK_MAX_TOKENS || '4096'),
    temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE || '0.1')
  };

  return new DeepSeekClient(config);
}