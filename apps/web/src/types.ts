export type GraphNode =
  | {
      id: string;
      type: 'prompt';
      position: { x: number; y: number };
      data: { text: string };
    }
  | {
      id: string;
      type: 'generator';
      position: { x: number; y: number };
      data: { label: string };
    }
  | {
      id: string;
      type: 'result';
      position: { x: number; y: number };
      data: { label: string };
    };

export type GraphData = {
  nodes: GraphNode[];
  edges: Array<{ id: string; source: string; target: string }>;
  viewport: { x: number; y: number; zoom: number };
};

export type SpaceData = {
  id: string;
  title: string;
  createdAt: string;
  links: Record<string, { href: string; method: 'GET' | 'POST' | 'PUT' }>;
};

export type GenerationRequest = {
  nodeId: string;
  graphETag: string;
  scenario: 'success' | 'failure';
};

export type GenerationData = {
  id: string;
  spaceId: string;
  nodeId: string;
  resultNodeId: string;
  prompt: string;
  graphETag: string;
  scenario: 'success' | 'failure';
  status: 'processing' | 'succeeded' | 'failed';
  createdAt: string;
  imageUrl: string | null;
  failureCode: string | null;
  links: Record<string, { href: string; method: 'GET' | 'POST' | 'PUT' }>;
};

export type Config = {
  debounceMs: number;
  pollIntervalMs: number;
  generationDelayMs: number;
  maxNodes: number;
  maxEdges: number;
  nodeTypes: string[];
  links: Record<string, { href: string; method: 'GET' | 'POST' | 'PUT' }>;
};

export type NodeData = GraphNode;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export type GenerationView = {
  status: 'idle' | 'processing' | 'succeeded' | 'failed';
  imageUrl: string | null;
  error: string | null;
  run: number;
};

export type GraphIndexes = {
  nodeTypeById: Record<string, NodeData['type']>;
  promptTextById: Record<string, string>;
  incomingByTarget: Record<string, string[]>;
  outgoingBySource: Record<string, string[]>;
};

export type ChainLookup = {
  promptId: string;
  resultId: string;
  promptText: string;
};

export type ApiConfig = {
  debounceMs: number;
  pollIntervalMs: number;
};

export type RequestMeta = {
  etag: string | null;
  location: string | null;
  retryAfterMs: number | null;
};
