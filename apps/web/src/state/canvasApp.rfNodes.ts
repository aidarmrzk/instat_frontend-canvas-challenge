import type { Dispatch, SetStateAction } from 'react';
import type { Node } from '@xyflow/react';
import {
  buildIndexes,
  canConnectFromIndexes,
  findChainForGeneratorFromIndexes,
  removeNodeAndEdges,
} from '../domain/graph.js';
import type { GraphData, GenerationView } from '../types.js';
import {
  MAX_PROMPT_LENGTH,
  connectionClassName,
  removeGenerationView,
} from './canvasApp.helpers.js';
import type { UINodeData } from './canvasApp.types.js';

type BuildRfNodesInput = {
  graph: GraphData;
  generationViews: Record<string, GenerationView>;
  activeConnectionSourceId: string | null;
  nodeDimensionsById: Record<string, { width: number; height: number }>;
  mutateGraph: (updater: (current: GraphData) => GraphData) => boolean;
  scheduleSave: () => void;
  setAppError: Dispatch<SetStateAction<string | null>>;
  setGenerationViews: Dispatch<SetStateAction<Record<string, GenerationView>>>;
  runGeneration: (generatorId: string) => Promise<void>;
};

export const buildRfNodesData = ({
  graph,
  generationViews,
  activeConnectionSourceId,
  nodeDimensionsById,
  mutateGraph,
  scheduleSave,
  setAppError,
  setGenerationViews,
  runGeneration,
}: BuildRfNodesInput): Node<UINodeData>[] => {
  const indexes = buildIndexes(graph);

  return graph.nodes.map((node) => {
    const dimensions = nodeDimensionsById[node.id];

    if (node.type === 'prompt') {
      const canReceiveConnection =
        activeConnectionSourceId !== null &&
        canConnectFromIndexes(indexes, activeConnectionSourceId, node.id);
      return {
        id: node.id,
        type: 'promptNode',
        position: node.position,
        className: connectionClassName(activeConnectionSourceId, node.id, canReceiveConnection),
        ...(dimensions ? { measured: { width: dimensions.width, height: dimensions.height } } : {}),
        data: {
          type: 'prompt',
          text: node.data.text,
          onTextChange: (value: string) => {
            const changed = mutateGraph((current) => {
              let updated = false;
              const nodes = current.nodes.map((candidate) => {
                if (candidate.id !== node.id || candidate.type !== 'prompt') return candidate;
                if (value.length > MAX_PROMPT_LENGTH) {
                  setAppError(`Prompt is too long (${MAX_PROMPT_LENGTH} characters max).`);
                  return candidate;
                }
                if (candidate.data.text === value) return candidate;
                updated = true;
                return {
                  ...candidate,
                  data: { text: value },
                };
              });
              return updated ? { ...current, nodes } : current;
            });
            if (changed) scheduleSave();
          },
          onDelete: () => {
            const changed = mutateGraph((current) => removeNodeAndEdges(current, node.id));
            if (changed) scheduleSave();
          },
        },
      };
    }

    if (node.type === 'generator') {
      const chain = findChainForGeneratorFromIndexes(indexes, node.id);
      const resultId = chain?.resultId ?? '';
      const processing = resultId ? generationViews[resultId]?.status === 'processing' : false;
      const canReceiveConnection =
        activeConnectionSourceId !== null &&
        canConnectFromIndexes(indexes, activeConnectionSourceId, node.id);
      return {
        id: node.id,
        type: 'generatorNode',
        position: node.position,
        className: connectionClassName(activeConnectionSourceId, node.id, canReceiveConnection),
        ...(dimensions ? { measured: { width: dimensions.width, height: dimensions.height } } : {}),
        data: {
          type: 'generator',
          label: node.data.label,
          isGenerating: processing,
          onGenerate: () => {
            void runGeneration(node.id);
          },
          onDelete: () => {
            const changed = mutateGraph((current) => removeNodeAndEdges(current, node.id));
            if (changed) scheduleSave();
          },
        },
      };
    }

    const status = generationViews[node.id] ?? {
      status: 'idle',
      imageUrl: null,
      error: null,
    };
    const canReceiveConnection =
      activeConnectionSourceId !== null &&
      canConnectFromIndexes(indexes, activeConnectionSourceId, node.id);

    return {
      id: node.id,
      type: 'resultNode',
      position: node.position,
      className: connectionClassName(activeConnectionSourceId, node.id, canReceiveConnection),
      ...(dimensions ? { measured: { width: dimensions.width, height: dimensions.height } } : {}),
      data: {
        type: 'result',
        label: node.data.label,
        imageUrl: status.imageUrl,
        error: status.error,
        onDelete: () => {
          const changed = mutateGraph((current) => removeNodeAndEdges(current, node.id));
          setGenerationViews((current) => removeGenerationView(current, node.id));
          if (changed) scheduleSave();
        },
      },
    };
  });
};
