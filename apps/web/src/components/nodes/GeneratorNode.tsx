import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

type GeneratorNodeData = {
  type: 'generator';
  label: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onDelete: () => void;
};

const GeneratorNodeComponent = ({ data }: NodeProps) => {
  const value = data as GeneratorNodeData;
  return (
    <div className="flex w-[260px] flex-col gap-2 rounded-xl border border-sky-500 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <strong>{value.label}</strong>
        <button
          className="nodrag nopan cursor-pointer rounded-lg border border-slate-700 bg-white px-2 py-1 text-sm font-semibold transition hover:bg-slate-50"
          onClick={value.onDelete}
          aria-label="Удалить ноду генератора"
          type="button"
        >
          x
        </button>
      </div>
      <button
        className="generate-button nodrag nopan cursor-pointer rounded-lg border border-sky-500 bg-sky-100 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
        type="button"
        onClick={value.onGenerate}
        disabled={value.isGenerating}
      >
        {value.isGenerating ? 'Генерация...' : 'Сгенерировать'}
      </button>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

export const GeneratorNode = memo(GeneratorNodeComponent);
