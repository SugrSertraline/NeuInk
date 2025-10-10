'use client';

import MainLayout from '../components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSettingsStore, Theme, DisplayMode, BilingualLayout, SortBy, ViewMode } from '@/app/store/useSettingsStore';
import { useState } from 'react';
import { Save, RotateCcw, Eye, EyeOff } from 'lucide-react';

export default function SettingsPage() {
  const {
    theme,
    fontSize,
    fontFamily,
    lineHeight,
    defaultDisplayMode,
    bilingualLayout,
    apiProvider,
    apiKey,
    apiBaseUrl,
    modelName,
    dataPath,
    defaultSortBy,
    defaultViewMode,
    showAbstract,
    showKeywords,
    showDOI,
    fixedHeader,
    autoScroll,
    highlightAnnotations,
    language,
    setTheme,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setDefaultDisplayMode,
    setBilingualLayout,
    setApiConfig,
    setDataPath,
    setDefaultSortBy,
    setDefaultViewMode,
    setShowAbstract,
    setShowKeywords,
    setShowDOI,
    setFixedHeader,
    setAutoScroll,
    setHighlightAnnotations,
    setLanguage,
  } = useSettingsStore();

  // 本地状态用于表单控制
  const [showApiKey, setShowApiKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [tempApiProvider, setTempApiProvider] = useState(apiProvider);
  const [tempApiBaseUrl, setTempApiBaseUrl] = useState(apiBaseUrl);
  const [tempModelName, setTempModelName] = useState(modelName);
  const [tempDataPath, setTempDataPath] = useState(dataPath);
  const [tempFontSize, setTempFontSize] = useState(fontSize.toString());
  const [tempFontFamily, setTempFontFamily] = useState(fontFamily);
  const [tempLineHeight, setTempLineHeight] = useState(lineHeight.toString());
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

  // 保存外观设置
  const saveAppearanceSettings = () => {
    const newFontSize = parseInt(tempFontSize);
    const newLineHeight = parseFloat(tempLineHeight);
    
    if (!isNaN(newFontSize) && newFontSize > 0 && newFontSize <= 72) {
      setFontSize(newFontSize);
    }
    
    if (!isNaN(newLineHeight) && newLineHeight > 0 && newLineHeight <= 3) {
      setLineHeight(newLineHeight);
    }
    
    setFontFamily(tempFontFamily);
    showSaveMessage('外观设置已保存');
  };

  // 保存数据路径
  const saveDataPath = () => {
    setDataPath(tempDataPath);
    showSaveMessage('数据路径已保存');
  };

  // 显示保存消息
  const showSaveMessage = (message: string) => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  // 重置API配置
  const resetApiConfig = () => {
    setTempApiProvider('');
    setTempApiKey('');
    setTempApiBaseUrl('');
    setTempModelName('');
    showSaveMessage('API配置已重置');
  };

  // 重置外观设置
  const resetAppearanceSettings = () => {
    setTempFontSize('16');
    setTempLineHeight('1.6');
    setTempFontFamily('system-ui, -apple-system, sans-serif');
    showSaveMessage('外观设置已重置');
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">设置</h1>
          <p className="text-sm text-slate-500 mt-2">
            配置应用程序的各项设置，所有设置将自动保存到本地存储
          </p>
        </div>

        {saveMessage && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-md flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saveMessage}
          </div>
        )}

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="appearance">外观</TabsTrigger>
            <TabsTrigger value="api">API配置</TabsTrigger>
            <TabsTrigger value="reading">阅读偏好</TabsTrigger>
            <TabsTrigger value="library">图书馆</TabsTrigger>
            <TabsTrigger value="data">数据管理</TabsTrigger>
          </TabsList>

          {/* 外观设置 */}
          <TabsContent value="appearance" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">主题设置</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="theme-light"
                    checked={theme === 'light'}
                    onCheckedChange={() => setTheme('light')}
                  />
                  <Label htmlFor="theme-light">浅色</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="theme-dark"
                    checked={theme === 'dark'}
                    onCheckedChange={() => setTheme('dark')}
                  />
                  <Label htmlFor="theme-dark">深色</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="theme-auto"
                    checked={theme === 'auto'}
                    onCheckedChange={() => setTheme('auto')}
                  />
                  <Label htmlFor="theme-auto">跟随系统</Label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">字体设置</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="font-size">字体大小</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="font-size"
                      type="number"
                      min="8"
                      max="72"
                      value={tempFontSize}
                      onChange={(e) => setTempFontSize(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-slate-500">px</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="line-height">行高</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="line-height"
                      type="number"
                      min="1"
                      max="3"
                      step="0.1"
                      value={tempLineHeight}
                      onChange={(e) => setTempLineHeight(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-slate-500">倍</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-family">字体系列</Label>
                <Input
                  id="font-family"
                  value={tempFontFamily}
                  onChange={(e) => setTempFontFamily(e.target.value)}
                  placeholder="例如: system-ui, -apple-system, sans-serif"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={saveAppearanceSettings} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  保存外观设置
                </Button>
                <Button variant="outline" onClick={resetAppearanceSettings} className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  重置
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* API配置 */}
          <TabsContent value="api" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">API提供商</h3>
              <Select value={tempApiProvider} onValueChange={setTempApiProvider}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择API提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="azure">Azure OpenAI</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">API密钥</h3>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="输入API密钥"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">API基础URL</h3>
              <Input
                value={tempApiBaseUrl}
                onChange={(e) => setTempApiBaseUrl(e.target.value)}
                placeholder="例如: https://api.openai.com/v1"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">模型名称</h3>
              <Input
                value={tempModelName}
                onChange={(e) => setTempModelName(e.target.value)}
                placeholder="例如: gpt-4, claude-3-sonnet"
              />
            </div>

            <div className="flex space-x-2">
              <Button onClick={saveApiConfig} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                保存API配置
              </Button>
              <Button variant="outline" onClick={resetApiConfig} className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                重置
              </Button>
            </div>
          </TabsContent>

          {/* 阅读偏好 */}
          <TabsContent value="reading" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">默认显示模式</h3>
              <Select value={defaultDisplayMode} onValueChange={(value: DisplayMode) => setDefaultDisplayMode(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择显示模式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">仅英文</SelectItem>
                  <SelectItem value="chinese">仅中文</SelectItem>
                  <SelectItem value="bilingual">双语对照</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">双语布局</h3>
              <Select value={bilingualLayout} onValueChange={(value: BilingualLayout) => setBilingualLayout(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择双语布局" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">垂直布局</SelectItem>
                  <SelectItem value="horizontal">水平布局</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">阅读器设置</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fixed-header"
                    checked={fixedHeader}
                    onCheckedChange={(checked) => setFixedHeader(checked as boolean)}
                  />
                  <Label htmlFor="fixed-header">固定阅读器头部</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-scroll"
                    checked={autoScroll}
                    onCheckedChange={(checked) => setAutoScroll(checked as boolean)}
                  />
                  <Label htmlFor="auto-scroll">自动滚动</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="highlight-annotations"
                    checked={highlightAnnotations}
                    onCheckedChange={(checked) => setHighlightAnnotations(checked as boolean)}
                  />
                  <Label htmlFor="highlight-annotations">高亮注释</Label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">语言偏好</h3>
              <Select value={language} onValueChange={(value: 'zh-CN' | 'en-US' | 'auto') => setLanguage(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                  <SelectItem value="auto">跟随系统</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* 图书馆设置 */}
          <TabsContent value="library" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">默认排序方式</h3>
              <Select value={defaultSortBy} onValueChange={(value: SortBy) => setDefaultSortBy(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="title">按标题</SelectItem>
                  <SelectItem value="date">按日期</SelectItem>
                  <SelectItem value="author">按作者</SelectItem>
                  <SelectItem value="journal">按期刊</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">默认视图模式</h3>
              <Select value={defaultViewMode} onValueChange={(value: ViewMode) => setDefaultViewMode(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择视图模式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">网格视图</SelectItem>
                  <SelectItem value="list">列表视图</SelectItem>
                  <SelectItem value="table">表格视图</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">显示选项</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-abstract"
                    checked={showAbstract}
                    onCheckedChange={(checked) => setShowAbstract(checked as boolean)}
                  />
                  <Label htmlFor="show-abstract">显示摘要</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-keywords"
                    checked={showKeywords}
                    onCheckedChange={(checked) => setShowKeywords(checked as boolean)}
                  />
                  <Label htmlFor="show-keywords">显示关键词</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="show-doi"
                    checked={showDOI}
                    onCheckedChange={(checked) => setShowDOI(checked as boolean)}
                  />
                  <Label htmlFor="show-doi">显示DOI</Label>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 数据管理 */}
          <TabsContent value="data" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">数据存储路径</h3>
              <div className="flex space-x-2">
                <Input
                  value={tempDataPath}
                  onChange={(e) => setTempDataPath(e.target.value)}
                  placeholder="数据存储路径"
                  className="flex-1"
                />
                <Button variant="outline">浏览</Button>
              </div>
              <Button onClick={saveDataPath} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                保存路径
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">数据备份</h3>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  导出数据
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  导入数据
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  备份到云端
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">数据清理</h3>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  清理缓存
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  重置所有设置
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
