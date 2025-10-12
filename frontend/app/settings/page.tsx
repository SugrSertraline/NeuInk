'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SetStateAction, useState } from 'react';
import { Save, Eye, EyeOff, Check } from 'lucide-react';

// 模拟 store - 实际使用时替换为真实的 useSettingsStore
const useSettingsStore = () => {
  const [state, setState] = useState({
    theme: 'light',
    apiProvider: 'openai',
    apiKey: '',
    apiBaseUrl: 'https://api.openai.com/v1',
    modelName: 'gpt-4',
    defaultDisplayMode: 'bilingual',
    fixedHeader: true,
    defaultViewMode: 'grid',
  });

  return {
    ...state,
    setTheme: (theme: any) => setState(s => ({ ...s, theme })),
    setApiConfig: (config: { provider: any; apiKey: any; baseUrl: any; model: any; }) => setState(s => ({ 
      ...s, 
      apiProvider: config.provider,
      apiKey: config.apiKey,
      apiBaseUrl: config.baseUrl,
      modelName: config.model 
    })),
    setDefaultDisplayMode: (mode: any) => setState(s => ({ ...s, defaultDisplayMode: mode })),
    setFixedHeader: (fixed: any) => setState(s => ({ ...s, fixedHeader: fixed })),
    setDefaultViewMode: (mode: any) => setState(s => ({ ...s, defaultViewMode: mode })),
  };
};

export default function SettingsPage() {
  const {
    theme,
    apiProvider,
    apiKey,
    apiBaseUrl,
    modelName,
    defaultDisplayMode,
    fixedHeader,
    defaultViewMode,
    setTheme,
    setApiConfig,
    setDefaultDisplayMode,
    setFixedHeader,
    setDefaultViewMode,
  } = useSettingsStore();

  // 本地状态
  const [showApiKey, setShowApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempApiProvider, setTempApiProvider] = useState(apiProvider);
  const [tempApiBaseUrl, setTempApiBaseUrl] = useState(apiBaseUrl);
  const [tempModelName, setTempModelName] = useState(modelName);
  const [saveMessage, setSaveMessage] = useState('');

  // 保存API配置
  const saveApiConfig = () => {
    setApiConfig({
      provider: tempApiProvider,
      apiKey: tempApiKey,
      baseUrl: tempApiBaseUrl,
      model: tempModelName,
    });
    showSaveMessage('API配置已保存');
  };

  // 显示保存消息
  const showSaveMessage = (message: SetStateAction<string>) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">设置</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            配置应用程序的各项设置，所有设置将自动保存到本地存储
          </p>
        </div>

        {saveMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <Check className="w-5 h-5" />
            <span className="font-medium">{saveMessage}</span>
          </div>
        )}

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm">
            <TabsTrigger value="appearance" className="rounded-md">外观</TabsTrigger>
            <TabsTrigger value="api" className="rounded-md">API配置</TabsTrigger>
            <TabsTrigger value="reading" className="rounded-md">阅读与展示</TabsTrigger>
          </TabsList>

          {/* 外观设置 */}
          <TabsContent value="appearance" className="mt-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">主题设置</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'light', label: '浅色', icon: '☀️' },
                      { value: 'dark', label: '深色', icon: '🌙' },
                      { value: 'auto', label: '跟随系统', icon: '🖥️' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setTheme(option.value)}
                        className={`relative p-2.5 rounded-md border transition-all ${
                          theme === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="text-xl mb-1">{option.icon}</div>
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {option.label}
                        </div>
                        {theme === option.value && (
                          <div className="absolute top-1.5 right-1.5">
                            <Check className="w-3.5 h-3.5 text-blue-500" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* API配置 */}
          <TabsContent value="api" className="mt-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">API服务配置</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="api-provider" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        API服务提供商
                      </Label>
                      <Select value={tempApiProvider} onValueChange={setTempApiProvider}>
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="选择API提供商" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                          <SelectItem value="azure">Azure OpenAI</SelectItem>
                          <SelectItem value="deepseek">DeepSeek</SelectItem>
                          <SelectItem value="custom">自定义</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model-name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        模型名称
                      </Label>
                      <Input
                        id="model-name"
                        value={tempModelName}
                        onChange={(e) => setTempModelName(e.target.value)}
                        placeholder="例如: gpt-4, claude-3-sonnet"
                        className="h-9"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        根据选择的服务商填写对应的模型名称
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api-url" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        模型 URL
                      </Label>
                      <Input
                        id="api-url"
                        value={tempApiBaseUrl}
                        onChange={(e) => setTempApiBaseUrl(e.target.value)}
                        placeholder="例如: https://api.openai.com/v1"
                        className="h-9"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        API的基础URL地址，通常以 /v1 结尾
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api-token" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        API Token (密钥)
                      </Label>
                      <div className="relative">
                        <Input
                          id="api-token"
                          type={showApiKey ? "text" : "password"}
                          value={tempApiKey}
                          onChange={(e) => setTempApiKey(e.target.value)}
                          placeholder="输入您的API密钥"
                          className="h-9 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-9 px-3"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        您的API密钥将安全保存在本地，不会上传到服务器
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button 
                    onClick={saveApiConfig} 
                    className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm"
                  >
                    <Save className="w-3.5 h-3.5 mr-2" />
                    保存API配置
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 阅读与展示设置 */}
          <TabsContent value="reading" className="mt-6">
            <div className="space-y-4">
              {/* 阅读偏好 */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">阅读偏好</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      默认显示模式
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'english', label: '仅英文', desc: '只显示原文' },
                        { value: 'bilingual', label: '双语对照', desc: '中英对照显示' }
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setDefaultDisplayMode(option.value)}
                          className={`relative p-3 rounded-md border text-left transition-all ${
                            defaultDisplayMode === option.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-0.5">
                            {option.label}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {option.desc}
                          </div>
                          {defaultDisplayMode === option.value && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="fixed-header"
                        checked={fixedHeader}
                        onCheckedChange={(checked) => setFixedHeader(checked)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label 
                          htmlFor="fixed-header" 
                          className="text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer"
                        >
                          固定阅读器头部
                        </Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          滚动页面时保持头部工具栏可见
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 论文库展示 */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">论文库展示</h3>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    默认展示方式
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'grid', label: '卡片视图', icon: '📇', desc: '紧凑的卡片布局' },
                      { value: 'table', label: '表格视图', icon: '📊', desc: '详细的表格展示' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setDefaultViewMode(option.value)}
                        className={`relative p-3 rounded-md border text-left transition-all ${
                          defaultViewMode === option.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="text-lg mb-1">{option.icon}</div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-0.5">
                          {option.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {option.desc}
                        </div>
                        {defaultViewMode === option.value && (
                          <div className="absolute top-2 right-2">
                            <Check className="w-3.5 h-3.5 text-blue-500" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}