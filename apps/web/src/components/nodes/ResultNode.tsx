import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

type ResultNodeData = {
  type: 'result';
  label: string;
  imageUrl: string | null;
  error: string | null;
  onDelete: () => void;
};

const ResultNodeComponent = ({ data }: NodeProps) => {
  const value = data as ResultNodeData;
  return (
    <div className="flex w-[260px] flex-col gap-2 rounded-xl border border-emerald-500 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <strong>{value.label}</strong>
        <button
          className="nodrag nopan cursor-pointer rounded-lg border border-slate-700 bg-white px-2 py-1 text-sm font-semibold transition hover:bg-slate-50"
          onClick={value.onDelete}
          aria-label="Удалить ноду результата"
          type="button"
        >
          x
        </button>
      </div>
      {value.imageUrl ? (
        <img
          className="w-full rounded-lg border border-slate-300"
          src={value.imageUrl}
          alt="Сгенерированный результат"
        />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-400 px-2.5 py-2.5 text-center text-sm text-slate-500">
          Изображение пока не сгенерировано
        </div>
      )}
      {value.error ? (
        <div className="text-xs font-semibold text-rose-700">{value.error}</div>
      ) : null}
      <Handle type="target" position={Position.Left} />
    </div>
  );
};

export const ResultNode = memo(ResultNodeComponent);
