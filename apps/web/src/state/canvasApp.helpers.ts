import type { NodeData, GenerationView } from '../types.js';

export const SPACE_ID_KEY = 'canvas-space-id';
export const MAX_PROMPT_LENGTH = 2000;

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const toAbsoluteImageUrl = (value: string | null): string | null => {
  if (!value) return null;
  if (!value.startsWith('/')) return value;
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4001';
  return `${base}${value}`;
};

export const defaultsByNodeType: Record<NodeData['type'], { x: number; y: number }> = {
  prompt: { x: 80, y: 80 },
  generator: { x: 380, y: 80 },
  result: { x: 680, y: 80 },
};

export const setGenerationView = (
  views: Record<string, GenerationView>,
  resultNodeId: string,
  patch: Partial<GenerationView> & { run: number },
): Record<string, GenerationView> => {
  const current = views[resultNodeId] ?? {
    status: 'idle',
    imageUrl: null,
    error: null,
    run: 0,
  };

  return {
    ...views,
    [resultNodeId]: {
      status: patch.status ?? current.status,
      imageUrl: patch.imageUrl === undefined ? current.imageUrl : patch.imageUrl,
      error: patch.error === undefined ? current.error : patch.error,
      run: patch.run,
    },
  };
};

export const removeGenerationView = (
  views: Record<string, GenerationView>,
  nodeId: string,
): Record<string, GenerationView> => {
  if (!views[nodeId]) return views;
  const copy = { ...views };
  delete copy[nodeId];
  return copy;
};

export const connectionClassName = (
  activeConnectionSourceId: string | null,
  nodeId: string,
  canReceiveConnection: boolean,
): string => {
  if (activeConnectionSourceId === null) return '';
  if (activeConnectionSourceId === nodeId) return 'connection-source';
  return canReceiveConnection ? 'connection-allowed' : 'connection-blocked';
};
