import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Connection,
  Edge,
  OnConnectEnd,
  OnConnectStart,
  NodeChange,
  OnEdgesChange,
  OnNodesChange,
  Viewport,
} from '@xyflow/react';
import { api } from '../api/client.js';
import {
  buildIndexes,
  canConnect,
  canConnectFromIndexes,
  emptyGraph,
  removeNodeAndEdges,
  upsertNodePosition,
} from '../domain/graph.js';
import { newId } from '../shared/ids.js';
import type { GenerationView, GraphData, NodeData, SaveStatus } from '../types.js';
import { defaultsByNodeType, removeGenerationView } from './canvasApp.helpers.js';
import { runGenerationTask } from './canvasApp.generation.js';
import { loadCanvasWorkspaceTask } from './canvasApp.load.js';
import { buildRfNodesData } from './canvasApp.rfNodes.js';
import { saveGraphNowTask } from './canvasApp.save.js';
import type { UseCanvasState } from './canvasApp.types.js';
import { runTask } from './taskUtils.js';

export const useCanvasApp = (): UseCanvasState => {
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState('Loading workspace...');
  const [spaceId, setSpaceId] = useState('');
  const [etag, setEtag] = useState('');
  const [graph, setGraph] = useState<GraphData>(emptyGraph);
  const [activeConnectionSourceId, setActiveConnectionSourceId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<'success' | 'failure'>('success');
  const [generationViews, setGenerationViews] = useState<Record<string, GenerationView>>({});

  const latestGraphRef = useRef(graph);
  const etagRef = useRef('');
  const pollIntervalRef = useRef(1500);
  const debounceMsRef = useRef(500);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const conflictRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const inFlightSaveRef = useRef<Promise<boolean> | null>(null);
  const inFlightGenerationByGeneratorRef = useRef<Record<string, boolean>>({});
  const timerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const runByResultRef = useRef<Record<string, number>>({});
  const abortControllerRef = useRef(new AbortController());
  const nodeDimensionsRef = useRef<Record<string, { width: number; height: number }>>({});
  const latestIndexesRef = useRef(buildIndexes(graph));
  const maxNodesRef = useRef(20);
  const maxEdgesRef = useRef(20);

  useEffect(() => {
    latestGraphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    etagRef.current = etag;
  }, [etag]);

  useEffect(() => {
    latestIndexesRef.current = buildIndexes(graph);
  }, [graph]);

  const clearSaveTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  const mutateGraph = useCallback((updater: (current: GraphData) => GraphData): boolean => {
    let changed = false;
    setGraph((current: GraphData) => {
      const next = updater(current);
      if (next === current) return current;
      changed = true;
      revisionRef.current += 1;
      return next;
    });
    return changed;
  }, []);

  const saveGraphNow = useCallback(async (): Promise<boolean> => {
    return saveGraphNowTask({
      spaceId,
      refs: {
        etagRef,
        latestGraphRef,
        conflictRef,
        revisionRef,
        savedRevisionRef,
        queuedSaveRef,
        inFlightSaveRef,
      },
      state: {
        setSaveStatus,
        setSaveMessage,
        setAppError,
        setEtag,
      },
      abortSignal: abortControllerRef.current.signal,
      runNextSave: () => {
        void saveGraphNow();
      },
    });
  }, [spaceId]);

  const scheduleSave = useCallback(() => {
    clearSaveTimer();
    if (!conflictRef.current) {
      setSaveStatus('idle');
      setSaveMessage('Unsaved changes.');
    }
    timerRef.current = window.setTimeout(() => {
      void saveGraphNow();
    }, debounceMsRef.current);
  }, [clearSaveTimer, saveGraphNow]);

  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    clearSaveTimer();
    return saveGraphNow();
  }, [clearSaveTimer, saveGraphNow]);

  const runGeneration = useCallback(
    async (generatorId: string) =>
      runGenerationTask({
        generatorId,
        spaceId,
        scenario,
        getGraphETag: () => etagRef.current,
        latestGraph: latestGraphRef.current,
        pollIntervalMs: pollIntervalRef.current,
        abortSignal: abortControllerRef.current.signal,
        refs: { runByResultRef, inFlightGenerationByGeneratorRef },
        state: { setGenerationViews, setAppError },
        flushPendingSave,
      }),
    [flushPendingSave, scenario, spaceId],
  );

  const reloadFromServer = useCallback(async () => {
    if (!spaceId) return;
    const outcome = await runTask(() => api.getGraph(spaceId, abortControllerRef.current.signal));
    if (outcome.status === 'aborted') return;
    if (outcome.status === 'error') {
      setAppError(outcome.error.message);
      return;
    }

    const response = outcome.data;
    setGraph(response.data);
    latestGraphRef.current = response.data;
    const nextETag = response.meta.etag ?? '';
    setEtag(nextETag);
    etagRef.current = nextETag;
    savedRevisionRef.current = revisionRef.current;
    conflictRef.current = false;
    setSaveStatus('saved');
    setSaveMessage('Server graph loaded.');
    setAppError(null);
  }, [spaceId]);

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    void loadCanvasWorkspaceTask({
      abortSignal: controller.signal,
      refs: {
        latestGraphRef,
        etagRef,
        pollIntervalRef,
        debounceMsRef,
        maxNodesRef,
        maxEdgesRef,
        runByResultRef,
      },
      state: {
        setLoading,
        setAppError,
        setSaveStatus,
        setSaveMessage,
        setSpaceId,
        setGraph,
        setEtag,
        setGenerationViews,
      },
    });

    return () => {
      clearSaveTimer();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      controller.abort();
    };
  }, [clearSaveTimer]);

  const onNodesChange = useCallback<OnNodesChange>(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions) {
          nodeDimensionsRef.current[change.id] = {
            width: change.dimensions.width,
            height: change.dimensions.height,
          };
        }
      }

      const changed = mutateGraph((current) => {
        let next = current;
        for (const change of changes) {
          if (change.type === 'position' && change.position) {
            next = upsertNodePosition(next, change.id, change.position.x, change.position.y);
            continue;
          }
          if (change.type === 'remove') {
            next = removeNodeAndEdges(next, change.id);
            delete nodeDimensionsRef.current[change.id];
            setGenerationViews((existing) => removeGenerationView(existing, change.id));
          }
        }
        return next;
      });
      if (changed) scheduleSave();
    },
    [mutateGraph, scheduleSave],
  );

  const onEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      const changed = mutateGraph((current) => {
        let next = current;
        for (const change of changes) {
          if (change.type !== 'remove') continue;
          const edges = next.edges.filter((edge) => edge.id !== change.id);
          if (edges.length !== next.edges.length) {
            next = { ...next, edges };
          }
        }
        return next;
      });
      if (changed) scheduleSave();
    },
    [mutateGraph, scheduleSave],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const changed = mutateGraph((current) => {
        if (current.edges.length >= maxEdgesRef.current) {
          showToast(`Достигнут лимит связей: ${maxEdgesRef.current}. Удалите лишнюю связь.`);
          return current;
        }
        if (!canConnect(current, connection.source as string, connection.target as string)) {
          showToast('Допустимо: Текст -> Генератор и Генератор -> Результат.');
          return current;
        }

        return {
          ...current,
          edges: [
            ...current.edges,
            {
              id: newId(),
              source: connection.source,
              target: connection.target,
            },
          ],
        };
      });
      if (changed) scheduleSave();
    },
    [mutateGraph, scheduleSave, showToast],
  );

  const onConnectStart = useCallback<OnConnectStart>((_event, params) => {
    setActiveConnectionSourceId(params.nodeId ?? null);
  }, []);

  const onConnectEnd = useCallback<OnConnectEnd>(() => {
    setActiveConnectionSourceId(null);
  }, []);

  const isValidConnection = useCallback((connection: Connection | Edge): boolean => {
    if (!connection.source || !connection.target) return false;
    const current = latestGraphRef.current;
    if (current.edges.length >= maxEdgesRef.current) return false;
    return canConnectFromIndexes(latestIndexesRef.current, connection.source, connection.target);
  }, []);

  const onViewportChange = useCallback(
    (viewport: Viewport) => {
      const changed = mutateGraph((current) => {
        if (
          current.viewport.x === viewport.x &&
          current.viewport.y === viewport.y &&
          current.viewport.zoom === viewport.zoom
        ) {
          return current;
        }
        return {
          ...current,
          viewport,
        };
      });
      if (changed) scheduleSave();
    },
    [mutateGraph, scheduleSave],
  );

  const addNode = useCallback(
    (type: NodeData['type']) => {
      const changed = mutateGraph((current) => {
        if (current.nodes.length >= maxNodesRef.current) {
          setAppError(`Node limit reached (${maxNodesRef.current}).`);
          return current;
        }
        const base = defaultsByNodeType[type];
        const offset = current.nodes.length * 24;

        const node: NodeData =
          type === 'prompt'
            ? {
                id: newId(),
                type: 'prompt',
                position: { x: base.x + offset, y: base.y + offset },
                data: { text: '' },
              }
            : {
                id: newId(),
                type,
                position: { x: base.x + offset, y: base.y + offset },
                data: { label: type === 'generator' ? 'Генератор' : 'Результат' },
              };

        return {
          ...current,
          nodes: [...current.nodes, node],
        };
      });
      if (changed) scheduleSave();
    },
    [mutateGraph, scheduleSave],
  );

  const createStarterChain = useCallback(() => {
    const changed = mutateGraph((current) => {
      if (current.nodes.length + 3 > maxNodesRef.current) {
        setAppError(`Not enough node slots for starter chain (${maxNodesRef.current} max).`);
        return current;
      }
      if (current.edges.length + 2 > maxEdgesRef.current) {
        setAppError(`Not enough edge slots for starter chain (${maxEdgesRef.current} max).`);
        return current;
      }
      if (current.nodes.length > 0 || current.edges.length > 0) return current;

      const promptId = newId();
      const generatorId = newId();
      const resultId = newId();

      return {
        ...current,
        nodes: [
          {
            id: promptId,
            type: 'prompt',
            position: { x: 80, y: 120 },
            data: { text: '' },
          },
          {
            id: generatorId,
            type: 'generator',
            position: { x: 380, y: 120 },
            data: { label: 'Генератор' },
          },
          {
            id: resultId,
            type: 'result',
            position: { x: 680, y: 120 },
            data: { label: 'Результат' },
          },
        ],
        edges: [
          { id: newId(), source: promptId, target: generatorId },
          { id: newId(), source: generatorId, target: resultId },
        ],
      };
    });

    if (changed) scheduleSave();
  }, [mutateGraph, scheduleSave]);

  const rfNodes = useMemo(
    () =>
      buildRfNodesData({
        graph,
        generationViews,
        activeConnectionSourceId,
        nodeDimensionsById: nodeDimensionsRef.current,
        mutateGraph,
        scheduleSave,
        setAppError,
        setGenerationViews,
        runGeneration,
      }),
    [activeConnectionSourceId, generationViews, graph, mutateGraph, runGeneration, scheduleSave],
  );

  const rfEdges = useMemo<Edge[]>(() => {
    return graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
    }));
  }, [graph.edges]);

  return {
    loading,
    appError,
    toastMessage,
    saveStatus,
    saveMessage,
    viewport: graph.viewport,
    scenario,
    setScenario,
    rfNodes,
    rfEdges,
    onNodesChange,
    onEdgesChange,
    onConnectStart,
    onConnectEnd,
    isValidConnection,
    onConnect,
    onViewportChange,
    addPromptNode: () => addNode('prompt'),
    addGeneratorNode: () => addNode('generator'),
    addResultNode: () => addNode('result'),
    createStarterChain,
    reloadFromServer,
  };
};
