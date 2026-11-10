export interface CorePrincipleDefinition {
  code: string;
  name: string;
  color: string;
  description: string;
  // 按该思想详情页展示内容的变化单独维护，不跟随关联文章的正文修改。
  lastUpdated: string;
}

export const corePrinciples: CorePrincipleDefinition[] = [
  {
    code: 'boundary',
    lastUpdated: '2026-11-10T12:43:38+08:00',
    name: '边界',
    color: '#409EFF',
    description: '遇到复杂系统，先想清楚谁和谁应该分开，以及各自负责什么。',
  },
  {
    code: 'preserve-truth',
    lastUpdated: '2026-11-10T12:43:38+08:00',
    name: '留真',
    color: '#67C23A',
    description: '保留当时真实发生的事实，不用后来形成的解释重写历史。',
  },
  {
    code: 'reproducible',
    lastUpdated: '2026-11-10T12:43:38+08:00',
    name: '复现',
    color: '#E6A23C',
    description: '一次成功不是证据，能够重复验证，结论才更可靠。',
  },
  {
    code: 'explicit',
    lastUpdated: '2026-11-10T12:43:38+08:00',
    name: '显式',
    color: '#9B59B6',
    description: '重要状态、规则和风险尽量明确表达，不依赖隐含默认和人的记忆。',
  },
  {
    code: 'restraint',
    lastUpdated: '2026-11-10T12:43:38+08:00',
    name: '克制',
    color: '#909399',
    description: '没有充分理由时不强行动作，不为了使用资源而制造动作。',
  },
  {
    code: 'evolution',
    lastUpdated: '2026-11-10T12:43:38+08:00',
    name: '演进',
    color: '#00A6A6',
    description: '接受当前结论并非最终答案，在保留历史的基础上持续修正和演进。',
  },
  {
    code: 'falsification',
    lastUpdated: '2026-11-10T12:43:38+08:00',
    name: '反证',
    color: '#F56C6C',
    description: '方案形成后，不只验证它为什么成立，也主动寻找能够推翻它的反例、极端场景和隐藏假设。',
  },
];

const corePrincipleByCode = new Map(
  corePrinciples.map((corePrinciple) => [corePrinciple.code, corePrinciple]),
);

export function getCorePrinciple(code: string): CorePrincipleDefinition | undefined {
  return corePrincipleByCode.get(code);
}

export function getCorePrincipleLastUpdated(corePrinciple: CorePrincipleDefinition): number {
  const timestamp = Date.parse(corePrinciple.lastUpdated);

  if (
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(corePrinciple.lastUpdated)
    || !Number.isFinite(timestamp)
  ) {
    throw new Error('[core-principles] Invalid lastUpdated for ' + corePrinciple.code);
  }

  return timestamp;
}
