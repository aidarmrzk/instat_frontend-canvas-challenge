import type {
  Connection,
  Edge,
  Node,
  OnConnectEnd,
  OnConnectStart,
  OnEdgesChange,
  OnNodesChange,
  Viewport,
} from '@xyflow/react';
import type { SaveStatus } from '../types.js';

export type PromptNodeUI = {
  type: 'prompt';
  text: string;
  onTextChange: (value: string) => void;
  onDelete: () => void;
};

export type GeneratorNodeUI = {
  type: 'generator';
  label: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onDelete: () => void;
};

export type ResultNodeUI = {
  type: 'result';
  label: string;
  imageUrl: string | null;
  error: string | null;
  onDelete: () => void;
};

export type UINodeData = PromptNodeUI | GeneratorNodeUI | ResultNodeUI;

export type UseCanvasState = {
  loading: boolean;
  appError: string | null;
  toastMessage: string | null;
  saveStatus: SaveStatus;
  saveMessage: string;
  viewport: Viewport;
  scenario: 'success' | 'failure';
  setScenario: (value: 'success' | 'failure') => void;
  rfNodes: Node<UINodeData>[];
  rfEdges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnectStart: OnConnectStart;
  onConnectEnd: OnConnectEnd;
  isValidConnection: (connection: Connection | Edge) => boolean;
  onConnect: (connection: Connection) => void;
  onViewportChange: (viewport: Viewport) => void;
  addPromptNode: () => void;
  addGeneratorNode: () => void;
  addResultNode: () => void;
  createStarterChain: () => void;
  reloadFromServer: () => Promise<void>;
};
