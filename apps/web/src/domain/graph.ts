import type { GraphData, GraphIndexes, ChainLookup, NodeData } from '../types.js';

type NodeType = NodeData['type'];

export const emptyGraph = (): GraphData => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
});

export const buildIndexes = (graph: GraphData): GraphIndexes => {
  const nodeTypeById: Record<string, NodeType> = {};
  const promptTextById: Record<string, string> = {};
  for (const node of graph.nodes) {
    nodeTypeById[node.id] = node.type;
    if (node.type === 'prompt') promptTextById[node.id] = node.data.text;
  }

  const incomingByTarget: Record<string, string[]> = {};
  const outgoingBySource: Record<string, string[]> = {};
  for (const edge of graph.edges) {
    const incoming = incomingByTarget[edge.target];
    if (incoming) incoming.push(edge.source);
    else incomingByTarget[edge.target] = [edge.source];

    const outgoing = outgoingBySource[edge.source];
    if (outgoing) outgoing.push(edge.target);
    else outgoingBySource[edge.source] = [edge.target];
  }

  return { nodeTypeById, promptTextById, incomingByTarget, outgoingBySource };
};

export const canConnect = (graph: GraphData, sourceId: string, targetId: string): boolean => {
  if (sourceId === targetId) return false;
  const indexes = buildIndexes(graph);
  return canConnectFromIndexes(indexes, sourceId, targetId);
};

export const canConnectFromIndexes = (
  indexes: GraphIndexes,
  sourceId: string,
  targetId: string,
): boolean => {
  if (sourceId === targetId) return false;
  const sourceType = indexes.nodeTypeById[sourceId];
  const targetType = indexes.nodeTypeById[targetId];
  if (!sourceType || !targetType) return false;

  if (sourceType === 'prompt' && targetType === 'generator') {
    const incoming = indexes.incomingByTarget[targetId] ?? [];
    return incoming.length === 0;
  }

  if (sourceType === 'generator' && targetType === 'result') {
    const incoming = indexes.incomingByTarget[targetId] ?? [];
    const outgoing = indexes.outgoingBySource[sourceId] ?? [];
    return incoming.length === 0 && outgoing.length === 0;
  }

  return false;
};

export const findChainForGenerator = (
  graph: GraphData,
  generatorId: string,
): ChainLookup | null => {
  const indexes = buildIndexes(graph);
  return findChainForGeneratorFromIndexes(indexes, generatorId);
};

export const findChainForGeneratorFromIndexes = (
  indexes: GraphIndexes,
  generatorId: string,
): ChainLookup | null => {
  if (indexes.nodeTypeById[generatorId] !== 'generator') return null;

  const promptCandidates = indexes.incomingByTarget[generatorId] ?? [];
  const resultCandidates = indexes.outgoingBySource[generatorId] ?? [];
  if (promptCandidates.length !== 1 || resultCandidates.length !== 1) return null;

  const promptId = promptCandidates[0];
  const resultId = resultCandidates[0];
  if (indexes.nodeTypeById[promptId] !== 'prompt') return null;
  if (indexes.nodeTypeById[resultId] !== 'result') return null;

  const promptText = indexes.promptTextById[promptId] ?? '';
  if (!promptText.trim()) return null;

  return { promptId, resultId, promptText };
};

export const removeNodeAndEdges = (graph: GraphData, nodeId: string): GraphData => {
  const nodes = graph.nodes.filter((node) => node.id !== nodeId);
  const edges = graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
  if (nodes.length === graph.nodes.length && edges.length === graph.edges.length) return graph;
  return { ...graph, nodes, edges };
};

export const upsertNodePosition = (
  graph: GraphData,
  id: string,
  x: number,
  y: number,
): GraphData => {
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    if (node.id !== id) return node;
    if (node.position.x === x && node.position.y === y) return node;
    changed = true;
    return {
      ...node,
      position: { x, y },
    };
  });
  return changed ? { ...graph, nodes } : graph;
};
