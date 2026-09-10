import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { api } from '../api/client.js';
import type { GenerationView, GraphData, SaveStatus } from '../types.js';
import { SPACE_ID_KEY, toAbsoluteImageUrl } from './canvasApp.helpers.js';
import { pollGenerationTask, syncGenerationFromResponse } from './canvasApp.generation.js';
import { runTask } from './taskUtils.js';
import type { TaskOutcome } from './taskUtils.js';

type LoadRefs = {
  latestGraphRef: MutableRefObject<GraphData>;
  etagRef: MutableRefObject<string>;
  pollIntervalRef: MutableRefObject<number>;
  debounceMsRef: MutableRefObject<number>;
  maxNodesRef: MutableRefObject<number>;
  maxEdgesRef: MutableRefObject<number>;
  runByResultRef: MutableRefObject<Record<string, number>>;
};

type LoadState = {
  setLoading: Dispatch<SetStateAction<boolean>>;
  setAppError: Dispatch<SetStateAction<string | null>>;
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>;
  setSaveMessage: Dispatch<SetStateAction<string>>;
  setSpaceId: Dispatch<SetStateAction<string>>;
  setGraph: Dispatch<SetStateAction<GraphData>>;
  setEtag: Dispatch<SetStateAction<string>>;
  setGenerationViews: Dispatch<SetStateAction<Record<string, GenerationView>>>;
};

type LoadCanvasWorkspaceTaskInput = {
  abortSignal: AbortSignal;
  refs: LoadRefs;
  state: LoadState;
};

const createAndPersistSpace = async (): Promise<string> => {
  const created = await api.createSpace(`Canvas ${new Date().toISOString().slice(0, 19)}`);
  const sid = created.data.id;
  localStorage.setItem(SPACE_ID_KEY, sid);
  return sid;
};

const resolveSpaceId = async (abortSignal: AbortSignal): Promise<TaskOutcome<string>> => {
  const existing = localStorage.getItem(SPACE_ID_KEY);
  if (!existing) {
    return runTask(createAndPersistSpace);
  }

  const existingCheck = await runTask(() => api.getGraph(existing, abortSignal));
  if (existingCheck.status === 'success') return { status: 'success', data: existing };
  if (existingCheck.status === 'aborted') return existingCheck;

  const shouldRecreate = existingCheck.error.status === 400 || existingCheck.error.status === 404;
  if (!shouldRecreate) return existingCheck;

  localStorage.removeItem(SPACE_ID_KEY);
  return runTask(createAndPersistSpace);
};

const applyLoadError = (
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>,
  setSaveMessage: Dispatch<SetStateAction<string>>,
  setAppError: Dispatch<SetStateAction<string | null>>,
  message: string,
): void => {
  setSaveStatus('error');
  setSaveMessage('Unable to load workspace.');
  setAppError(message);
};

const readLoadData = <T>(
  outcome: TaskOutcome<T>,
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>,
  setSaveMessage: Dispatch<SetStateAction<string>>,
  setAppError: Dispatch<SetStateAction<string | null>>,
): T | null => {
  if (outcome.status === 'success') return outcome.data;
  if (outcome.status === 'aborted') return null;
  applyLoadError(setSaveStatus, setSaveMessage, setAppError, outcome.error.message);
  return null;
};

export const loadCanvasWorkspaceTask = async ({
  abortSignal,
  refs,
  state,
}: LoadCanvasWorkspaceTaskInput): Promise<void> => {
  const {
    latestGraphRef,
    etagRef,
    pollIntervalRef,
    debounceMsRef,
    maxNodesRef,
    maxEdgesRef,
    runByResultRef,
  } = refs;
  const {
    setLoading,
    setAppError,
    setSaveStatus,
    setSaveMessage,
    setSpaceId,
    setGraph,
    setEtag,
    setGenerationViews,
  } = state;

  try {
    const configResponse = readLoadData(
      await runTask(() => api.getConfig()),
      setSaveStatus,
      setSaveMessage,
      setAppError,
    );
    if (!configResponse) return;

    debounceMsRef.current = configResponse.data.debounceMs;
    pollIntervalRef.current = configResponse.data.pollIntervalMs;
    maxNodesRef.current = configResponse.data.maxNodes;
    maxEdgesRef.current = configResponse.data.maxEdges;

    const sid = readLoadData(
      await resolveSpaceId(abortSignal),
      setSaveStatus,
      setSaveMessage,
      setAppError,
    );
    if (!sid) return;

    const graphResponse = readLoadData(
      await runTask(() => api.getGraph(sid, abortSignal)),
      setSaveStatus,
      setSaveMessage,
      setAppError,
    );
    if (!graphResponse) return;

    setSpaceId(sid);
    setGraph(graphResponse.data);
    latestGraphRef.current = graphResponse.data;
    const nextETag = graphResponse.meta.etag ?? '';
    setEtag(nextETag);
    etagRef.current = nextETag;
    setSaveStatus('saved');
    setSaveMessage('All changes saved.');

    const generationResponse = readLoadData(
      await runTask(() => api.listGenerations(sid, abortSignal)),
      setSaveStatus,
      setSaveMessage,
      setAppError,
    );
    if (!generationResponse) return;

    const initialViews: Record<string, GenerationView> = {};

    for (const generation of generationResponse.data) {
      const resultNodeId = generation.resultNodeId;
      if (initialViews[resultNodeId]) continue;
      const run = (runByResultRef.current[resultNodeId] ?? 0) + 1;
      runByResultRef.current[resultNodeId] = run;
      syncGenerationFromResponse(setGenerationViews, generation, run);

      if (generation.status === 'processing') {
        initialViews[resultNodeId] = {
          status: 'processing',
          imageUrl: null,
          error: null,
          run,
        };
        void pollGenerationTask({
          sid,
          generation,
          run,
          retryAfterMs: null,
          pollIntervalMs: pollIntervalRef.current,
          refs: { runByResultRef },
          abortSignal,
          setGenerationViews,
        });
      } else {
        initialViews[resultNodeId] = {
          status: generation.status,
          imageUrl: toAbsoluteImageUrl(generation.imageUrl),
          error: generation.failureCode,
          run,
        };
      }
    }

    setGenerationViews(initialViews);
  } finally {
    setLoading(false);
  }
};
