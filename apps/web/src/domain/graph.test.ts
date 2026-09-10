import { describe, expect, it } from 'vitest';
import {
  buildIndexes,
  canConnect,
  canConnectFromIndexes,
  emptyGraph,
  findChainForGenerator,
  findChainForGeneratorFromIndexes,
  removeNodeAndEdges,
  upsertNodePosition,
} from './graph.js';
import type { GraphData } from '../types.js';

const createGraph = (): GraphData => ({
  nodes: [
    { id: 'p1', type: 'prompt', position: { x: 0, y: 0 }, data: { text: 'sunset over sea' } },
    { id: 'g1', type: 'generator', position: { x: 100, y: 0 }, data: { label: 'g1' } },
    { id: 'g2', type: 'generator', position: { x: 100, y: 120 }, data: { label: 'g2' } },
    { id: 'r1', type: 'result', position: { x: 200, y: 0 }, data: { label: 'r1' } },
    { id: 'r2', type: 'result', position: { x: 200, y: 120 }, data: { label: 'r2' } },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
});

describe('graph domain rules', () => {
  it('allows prompt -> generator and generator -> result only', () => {
    const graph = createGraph();

    expect(canConnect(graph, 'p1', 'g1')).toBe(true);
    expect(canConnect(graph, 'g1', 'r1')).toBe(true);

    expect(canConnect(graph, 'g1', 'p1')).toBe(false);
    expect(canConnect(graph, 'r1', 'g1')).toBe(false);
    expect(canConnect(graph, 'p1', 'r1')).toBe(false);
    expect(canConnect(graph, 'p1', 'p1')).toBe(false);
  });

  it('enforces one input for target and one generator output', () => {
    const graph = createGraph();
    graph.edges.push({ id: 'e1', source: 'p1', target: 'g1' });
    graph.edges.push({ id: 'e2', source: 'g1', target: 'r1' });

    expect(canConnect(graph, 'p1', 'g1')).toBe(false);
    expect(canConnect(graph, 'g2', 'r1')).toBe(false);
    expect(canConnect(graph, 'g1', 'r2')).toBe(false);
  });

  it('finds valid generation chain only when complete and prompt is non-empty', () => {
    const graph = createGraph();
    graph.edges.push({ id: 'e1', source: 'p1', target: 'g1' });
    graph.edges.push({ id: 'e2', source: 'g1', target: 'r1' });

    expect(findChainForGenerator(graph, 'g1')).toEqual({
      promptId: 'p1',
      resultId: 'r1',
      promptText: 'sunset over sea',
    });

    graph.nodes = graph.nodes.map((node) => {
      if (node.id !== 'p1' || node.type !== 'prompt') return node;
      return {
        ...node,
        data: { text: '   ' },
      };
    });

    expect(findChainForGenerator(graph, 'g1')).toBeNull();
  });

  it('reuses indexes helpers with identical behavior', () => {
    const graph = createGraph();
    const indexes = buildIndexes(graph);

    expect(canConnectFromIndexes(indexes, 'p1', 'g1')).toBe(canConnect(graph, 'p1', 'g1'));
    expect(findChainForGeneratorFromIndexes(indexes, 'g1')).toBe(
      findChainForGenerator(graph, 'g1'),
    );
  });

  it('removes node and connected edges', () => {
    const graph = createGraph();
    graph.edges.push({ id: 'e1', source: 'p1', target: 'g1' });
    graph.edges.push({ id: 'e2', source: 'g1', target: 'r1' });

    const next = removeNodeAndEdges(graph, 'g1');

    expect(next.nodes.some((node) => node.id === 'g1')).toBe(false);
    expect(next.edges).toHaveLength(0);
  });

  it('keeps reference when position update is a no-op', () => {
    const graph = emptyGraph();
    const withNode: GraphData = {
      ...graph,
      nodes: [{ id: 'p1', type: 'prompt', position: { x: 1, y: 2 }, data: { text: 'x' } }],
    };

    const same = upsertNodePosition(withNode, 'p1', 1, 2);
    const moved = upsertNodePosition(withNode, 'p1', 10, 20);

    expect(same).toBe(withNode);
    expect(moved).not.toBe(withNode);
    expect(moved.nodes[0].position).toEqual({ x: 10, y: 20 });
  });
});
