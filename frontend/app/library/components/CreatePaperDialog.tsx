'use client';

import React from 'react';
import { X, FileText, Loader2, Sparkles, Plus, File, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Author } from '@/app/types/paper';
import { apiPost } from '@/app/lib/api';

interface CreatePaperDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (paperId?: string) => void;
}

export default function CreatePaperDialog({
  open,
  onClose,
  onSuccess
}: CreatePaperDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // 手动输入模式的状态
  const [title, setTitle] = React.useState('');
  const [shortTitle, setShortTitle] = React.useState('');
  const [authors, setAuthors] = React.useState<Author[]>([]);
  const [publication, setPublication] = React.useState('');
  const [year, setYear] = React.useState('');
  const [doi, setDoi] = React.useState('');
  const [articleType, setArticleType] = React.useState('journal');
  const [sciQuartile, setSciQuartile] = React.useState('无');
  const [casQuartile, setCasQuartile] = React.useState('无');
  const [ccfRank, setCcfRank] = React.useState('无');
  const [impactFactor, setImpactFactor] = React.useState('');
  const [priority, setPriority] = React.useState('medium');
  const [remarks, setRemarks] = React.useState('');
  const [tagInput, setTagInput] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  

  React.useEffect(() => {
    if (open) {
      resetForm();
      setError(null);
    }
  }, [open]);

  const resetForm = () => {
    setTitle('');
    setShortTitle('');
    setAuthors([]);
    setPublication('');
    setYear('');
    setDoi('');
    setArticleType('journal');
    setSciQuartile('无');
    setCasQuartile('无');
    setCcfRank('无');
    setImpactFactor('');
    setPriority('medium');
    setRemarks('');
    setTagInput('');
    setTags([]);
  };

  const addAuthor = () => {
    setAuthors([...authors, { name: '' }]);
  };

  const removeAuthor = (index: number) => {
    setAuthors(authors.filter((_, i) => i !== index));
  };

  const updateAuthor = (index: number, field: keyof Author, value: string) => {
    const newAuthors = [...authors];
    newAuthors[index] = { ...newAuthors[index], [field]: value };
    setAuthors(newAuthors);
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };


  const handleSubmit = async () => {
    if (!title || title.trim() === '') {
      setError('请填写论文标题');
      return;
    }

    // 检查是否有空白作者
    if (authors.length > 0 && authors.some(a => !a.name.trim())) {
      setError('请填写所有作者的姓名或删除空白作者');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 过滤出有效作者
      const validAuthors = authors.filter(a => a.name.trim());
      
      const payload: any = {
        title: title.trim(),
      };
      
      if (shortTitle.trim()) payload.shortTitle = shortTitle.trim();
      if (validAuthors.length > 0) payload.authors = JSON.stringify(validAuthors);
      if (publication.trim()) payload.publication = publication.trim();
      if (year) payload.year = year;
      if (doi.trim()) payload.doi = doi.trim();
      if (articleType) payload.articleType = articleType;
      if (sciQuartile !== '无') payload.sciQuartile = sciQuartile;
      if (casQuartile !== '无') payload.casQuartile = casQuartile;
      if (ccfRank !== '无') payload.ccfRank = ccfRank;
      if (impactFactor) payload.impactFactor = impactFactor;
      if (tags.length > 0) payload.tags = JSON.stringify(tags);
      if (priority) payload.priority = priority;
      if (remarks.trim()) payload.remarks = remarks.trim();

      const result = await apiPost<any>('/api/papers', payload);
      const paperId = result?.id;
      
      resetForm();
      onSuccess(paperId);
      onClose();
    } catch (err: any) {
      console.error('创建论文失败:', err);
      setError(err.message || '创建论文失败，请检查后端服务是否正常运行');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-5 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">创建新论文</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            disabled={loading}
            className="hover:bg-white/50 dark:hover:bg-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>


        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 rounded-r-lg text-sm flex items-start gap-3 mb-6">
              <span className="text-red-500 text-xl">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-6">
              {/* 基本信息 */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b pb-3">
                  <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
                  <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-200">基本信息</h3>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="title" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      论文标题 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="请输入论文完整标题"
                      className="h-11 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="shortTitle" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      简称
                    </Label>
                    <Input
                      id="shortTitle"
                      value={shortTitle}
                      onChange={(e) => setShortTitle(e.target.value)}
                      placeholder="论文简称（可选）"
                      className="h-11 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* 作者列表 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        作者信息
                      </Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={addAuthor}
                        className="h-8 px-3 text-xs hover:bg-blue-50 dark:hover:bg-slate-700"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        添加作者
                      </Button>
                    </div>
                    
                    {authors.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">暂无作者</p>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={addAuthor}
                          className="hover:bg-blue-50 dark:hover:bg-slate-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          添加第一位作者
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {authors.map((author, index) => (
                          <div key={index} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                作者 {index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAuthor(index)}
                                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 block">
                                  姓名 <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  value={author.name}
                                  onChange={(e) => updateAuthor(index, 'name', e.target.value)}
                                  placeholder="如：张三"
                                  className="h-9 text-sm dark:bg-slate-800"
                                />
                              </div>
                              
                              <div>
                                <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 block">
                                  单位
                                </Label>
                                <Input
                                  value={author.affiliation || ''}
                                  onChange={(e) => updateAuthor(index, 'affiliation', e.target.value)}
                                  placeholder="如：北京大学"
                                  className="h-9 text-sm dark:bg-slate-800"
                                />
                              </div>
                              
                              <div>
                                <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 block">
                                  邮箱
                                </Label>
                                <Input
                                  value={author.email || ''}
                                  onChange={(e) => updateAuthor(index, 'email', e.target.value)}
                                  placeholder="如：zhang@example.com"
                                  className="h-9 text-sm dark:bg-slate-800"
                                  type="email"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label htmlFor="publication" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        发表期刊/会议
                      </Label>
                      <Input
                        id="publication"
                        value={publication}
                        onChange={(e) => setPublication(e.target.value)}
                        placeholder="如：Nature"
                        className="h-11 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <Label htmlFor="year" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        发表年份
                      </Label>
                      <Input
                        id="year"
                        type="number"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="2024"
                        className="h-11 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                        min="1900"
                        max="2100"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="doi" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      DOI
                    </Label>
                    <Input
                      id="doi"
                      value={doi}
                      onChange={(e) => setDoi(e.target.value)}
                      placeholder="10.1234/example.doi"
                      className="h-11 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* 分类信息 */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b pb-3">
                  <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                  <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-200">分类信息</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <Label htmlFor="articleType" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      文章类型
                    </Label>
                    <Select value={articleType} onValueChange={setArticleType}>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="journal">期刊</SelectItem>
                        <SelectItem value="conference">会议</SelectItem>
                        <SelectItem value="preprint">预印本</SelectItem>
                        <SelectItem value="book">书籍</SelectItem>
                        <SelectItem value="thesis">论文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      阅读优先级
                    </Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="high">🔴 高</SelectItem>
                        <SelectItem value="medium">🟡 中</SelectItem>
                        <SelectItem value="low">🟢 低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="impactFactor" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      影响因子
                    </Label>
                    <Input
                      id="impactFactor"
                      type="number"
                      step="0.01"
                      value={impactFactor}
                      onChange={(e) => setImpactFactor(e.target.value)}
                      placeholder="如：15.23"
                      className="h-11 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sciQuartile" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      SCI 分区
                    </Label>
                    <Select value={sciQuartile} onValueChange={setSciQuartile}>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="选择分区" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="无">无</SelectItem>
                        <SelectItem value="Q1">Q1</SelectItem>
                        <SelectItem value="Q2">Q2</SelectItem>
                        <SelectItem value="Q3">Q3</SelectItem>
                        <SelectItem value="Q4">Q4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="casQuartile" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      中科院分区
                    </Label>
                    <Select value={casQuartile} onValueChange={setCasQuartile}>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="选择分区" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="无">无</SelectItem>
                        <SelectItem value="1区">1区</SelectItem>
                        <SelectItem value="2区">2区</SelectItem>
                        <SelectItem value="3区">3区</SelectItem>
                        <SelectItem value="4区">4区</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="ccfRank" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      CCF 分级
                    </Label>
                    <Select value={ccfRank} onValueChange={setCcfRank}>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="选择分级" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="无">无</SelectItem>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="B">B</SelectItem>
                        <SelectItem value="C">C</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 标签和备注 */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b pb-3">
                  <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                  <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-200">标签和备注</h3>
                </div>
                
                <div>
                  <Label htmlFor="tags" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    标签
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="输入标签后按回车添加"
                      className="h-11 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={addTag}
                      className="h-11 px-4 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tags.map(tag => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className="gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 border-0"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="remarks" className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    备注
                  </Label>
                  <Textarea
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="添加一些备注信息..."
                    className="dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20 min-h-[100px] resize-none"
                    rows={4}
                  />
                </div>
              </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t dark:bg-slate-800">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose} 
            disabled={loading}
            className="h-11 px-6 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="h-11 px-6 min-w-[140px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                创建论文
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}