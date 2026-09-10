import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

type PromptNodeData = {
  type: 'prompt';
  text: string;
  onTextChange: (value: string) => void;
  onDelete: () => void;
};

const PromptNodeComponent = ({ data }: NodeProps) => {
  const value = data as PromptNodeData;
  return (
    <div className="flex w-[260px] flex-col gap-2 rounded-xl border border-slate-700 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <strong>Текст</strong>
        <button
          className="nodrag nopan cursor-pointer rounded-lg border border-slate-700 bg-white px-2 py-1 text-sm font-semibold transition hover:bg-slate-50"
          onClick={value.onDelete}
          aria-label="Удалить текстовую ноду"
          type="button"
        >
          x
        </button>
      </div>
      <label className="text-xs text-slate-700">Описание</label>
      <textarea
        className="node-textarea nodrag nopan w-full resize-y rounded-lg border border-slate-400 px-2 py-2 text-sm"
        value={value.text}
        onChange={(event) => value.onTextChange(event.target.value)}
        rows={5}
        placeholder="Опишите изображение"
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

export const PromptNode = memo(PromptNodeComponent);
