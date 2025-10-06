// library/utils/paperHelpers.tsx

import { Badge } from '@/components/ui/badge';
import type { ReadingStatus, Priority, ArticleType, SciQuartile, CasQuartile, CcfRank } from '@neuink/shared';

/**
 * 获取阅读状态徽章
 */
export function getStatusBadge(status?: ReadingStatus) {
  switch (status) {
    case 'unread':
      return <Badge variant="outline" className="text-xs">未读</Badge>;
    case 'reading':
      return <Badge className="text-xs bg-blue-50 text-blue-700">阅读中</Badge>;
    case 'finished':
      return <Badge className="text-xs bg-green-50 text-green-700">已完成</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">未读</Badge>;
  }
}

/**
 * 获取优先级徽章
 */
export function getPriorityBadge(priority?: Priority) {
  switch (priority) {
    case 'high':
      return <Badge className="text-xs bg-red-50 text-red-700">高优先级</Badge>;
    case 'medium':
      return <Badge className="text-xs bg-yellow-50 text-yellow-700">中优先级</Badge>;
    case 'low':
      return <Badge className="text-xs bg-slate-50 text-slate-700">低优先级</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">未设置</Badge>;
  }
}

/**
 * 获取文章类型徽章
 */
export function getArticleTypeBadge(type?: ArticleType) {
  switch (type) {
    case 'journal':
      return <Badge className="text-xs bg-blue-50 text-blue-700">期刊</Badge>;
    case 'conference':
      return <Badge className="text-xs bg-purple-50 text-purple-700">会议</Badge>;
    case 'preprint':
      return <Badge className="text-xs bg-orange-50 text-orange-700">预印本</Badge>;
    case 'book':
      return <Badge className="text-xs bg-green-50 text-green-700">书籍</Badge>;
    case 'thesis':
      return <Badge className="text-xs bg-pink-50 text-pink-700">论文</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">未知</Badge>;
  }
}

/**
 * 获取分区颜色
 */
export function getQuartileColor(quartile?: SciQuartile | CasQuartile | CcfRank): string {
  if (!quartile || quartile === '无') return 'bg-slate-50 text-slate-700';
  
  if (quartile === 'Q1' || quartile === '1区' || quartile === 'A') {
    return 'bg-red-50 text-red-700';
  }
  if (quartile === 'Q2' || quartile === '2区' || quartile === 'B') {
    return 'bg-orange-50 text-orange-700';
  }
  if (quartile === 'Q3' || quartile === '3区' || quartile === 'C') {
    return 'bg-yellow-50 text-yellow-700';
  }
  if (quartile === 'Q4' || quartile === '4区') {
    return 'bg-green-50 text-green-700';
  }
  
  return 'bg-slate-50 text-slate-700';
}

/**
 * 表格列配置
 */
export const TABLE_COLUMNS = [
  { key: 'title', label: '标题', defaultVisible: true, width: 'min-w-[300px]' },
  { key: 'authors', label: '作者', defaultVisible: true, width: 'min-w-[200px]' },
  { key: 'year', label: '年份', defaultVisible: true, width: 'w-24' },
  { key: 'publication', label: '期刊/会议', defaultVisible: true, width: 'min-w-[200px]' },
  { key: 'articleType', label: '类型', defaultVisible: false, width: 'w-28' },
  { key: 'quartile', label: '分区', defaultVisible: true, width: 'w-32' },
  { key: 'impactFactor', label: '影响因子', defaultVisible: true, width: 'w-24' },
  { key: 'status', label: '状态', defaultVisible: true, width: 'w-28' },
  { key: 'priority', label: '优先级', defaultVisible: false, width: 'w-28' },
  { key: 'progress', label: '进度', defaultVisible: false, width: 'w-24' },
  { key: 'rating', label: '评分', defaultVisible: true, width: 'w-20' },
  { key: 'readingTime', label: '阅读时长', defaultVisible: false, width: 'w-24' },
  { key: 'actions', label: '操作', defaultVisible: true, width: 'w-16' },
];