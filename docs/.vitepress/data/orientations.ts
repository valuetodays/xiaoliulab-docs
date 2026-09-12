export interface OrientationDefinition {
  code: string;
  name: string;
  color: string;
  description: string;
}

export const orientations: OrientationDefinition[] = [
  {
    code: 'boundary',
    name: '边界',
    color: '#409EFF',
    description: '遇到复杂系统，先想清楚谁和谁应该分开，以及各自负责什么。',
  },
  {
    code: 'preserve-truth',
    name: '留真',
    color: '#67C23A',
    description: '保留当时真实发生的事实，不用后来形成的解释重写历史。',
  },
  {
    code: 'reproducible',
    name: '复现',
    color: '#E6A23C',
    description: '一次成功不是证据，能够重复验证，结论才更可靠。',
  },
  {
    code: 'explicit',
    name: '显式',
    color: '#9B59B6',
    description: '重要状态、规则和风险尽量明确表达，不依赖隐含默认和人的记忆。',
  },
  {
    code: 'restraint',
    name: '克制',
    color: '#909399',
    description: '没有充分理由时不强行动作，不为了使用资源而制造动作。',
  },
  {
    code: 'evolution',
    name: '演进',
    color: '#00A6A6',
    description: '接受当前结论并非最终答案，在保留历史的基础上持续修正和演进。',
  },
  {
    code: 'falsification',
    name: '反证',
    color: '#F56C6C',
    description: '方案形成后，不只验证它为什么成立，也主动寻找能够推翻它的反例、极端场景和隐藏假设。',
  },
];

const orientationByCode = new Map(
  orientations.map((orientation) => [orientation.code, orientation]),
);

export function getOrientation(code: string): OrientationDefinition | undefined {
  return orientationByCode.get(code);
}
