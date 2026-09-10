import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { api } from '../api/client.js';
import { findChainForGenerator } from '../domain/graph.js';
import type { GenerationData, GenerationRequest, GenerationView, GraphData } from '../types.js';
import { setGenerationView, toAbsoluteImageUrl, wait } from './canvasApp.helpers.js';
import { runTask, withRetry } from './taskUtils.js';

type GenerationViewState = Dispatch<SetStateAction<Record<string, GenerationView>>>;
type PollGenerationRefs = {
  runByResultRef: MutableRefObject<Record<string, number>>;
};

type RunGenerationRefs = PollGenerationRefs & {
  inFlightGenerationByGeneratorRef: MutableRefObject<Record<string, boolean>>;
};
type GenerationState = {
  setGenerationViews: GenerationViewState;
  setAppError: Dispatch<SetStateAction<string | null>>;
};

export const syncGenerationFromResponse = (
  setGenerationViews: GenerationViewState,
  generation: GenerationData,
  run: number,
): void => {
  const resultNodeId = generation.resultNodeId;
  if (generation.status === 'succeeded') {
    setGenerationViews((current) =>
      setGenerationView(current, resultNodeId, {
        status: 'succeeded',
        imageUrl: toAbsoluteImageUrl(generation.imageUrl),
        error: null,
        run,
      }),
    );
    return;
  }

  if (generation.status === 'failed') {
    setGenerationViews((current) =>
      setGenerationView(current, resultNodeId, {
        status: 'failed',
        imageUrl: null,
        error: generation.failureCode ?? 'Generation failed.',
        run,
      }),
    );
    return;
  }

  setGenerationViews((current) =>
    setGenerationView(current, resultNodeId, {
      status: 'processing',
      imageUrl: null,
      error: null,
      run,
    }),
  );
};

type PollGenerationTaskInput = {
  sid: string;
  generation: GenerationData;
  run: number;
  retryAfterMs: number | null;
  pollIntervalMs: number;
  refs: PollGenerationRefs;
  abortSignal: AbortSignal;
  setGenerationViews: GenerationViewState;
};

export const pollGenerationTask = async ({
  sid,
  generation,
  run,
  retryAfterMs,
  pollIntervalMs,
  refs,
  abortSignal,
  setGenerationViews,
}: PollGenerationTaskInput): Promise<void> => {
  const { runByResultRef } = refs;
  let current = generation;
  let waitMs = retryAfterMs ?? pollIntervalMs;

  while (current.status === 'processing') {
    await wait(waitMs);
    if (abortSignal.aborted) return;

    const refreshed = await api.getGeneration(sid, current.id, abortSignal);
    current = refreshed.data;
    waitMs = refreshed.meta.retryAfterMs ?? pollIntervalMs;

    const currentRun = runByResultRef.current[current.resultNodeId] ?? 0;
    if (currentRun !== run) return;

    syncGenerationFromResponse(setGenerationViews, current, run);
  }
};

type RunGenerationTaskInput = {
  generatorId: string;
  spaceId: string;
  scenario: 'success' | 'failure';
  getGraphETag: () => string;
  latestGraph: GraphData;
  pollIntervalMs: number;
  abortSignal: AbortSignal;
  refs: RunGenerationRefs;
  state: GenerationState;
  flushPendingSave: () => Promise<boolean>;
};

export const runGenerationTask = async ({
  generatorId,
  spaceId,
  scenario,
  getGraphETag,
  latestGraph,
  pollIntervalMs,
  abortSignal,
  refs,
  state,
  flushPendingSave,
}: RunGenerationTaskInput): Promise<void> => {
  const { runByResultRef, inFlightGenerationByGeneratorRef } = refs;
  const { setGenerationViews, setAppError } = state;

  if (!spaceId) return;

  if (inFlightGenerationByGeneratorRef.current[generatorId]) return;

  const chain = findChainForGenerator(latestGraph, generatorId);
  if (!chain) {
    setAppError('Incomplete chain. Connect prompt -> generator -> result and fill prompt text.');
    return;
  }

  inFlightGenerationByGeneratorRef.current[generatorId] = true;
  let run = 0;

  const outcome = await runTask(async () => {
    const ready = await flushPendingSave();
    if (!ready) return;

    const graphETag = getGraphETag();
    if (!graphETag) return;

    run = (runByResultRef.current[chain.resultId] ?? 0) + 1;
    runByResultRef.current[chain.resultId] = run;
    setGenerationViews((current) =>
      setGenerationView(current, chain.resultId, {
        status: 'processing',
        imageUrl: null,
        error: null,
        run,
      }),
    );

    const idempotencyKey = crypto.randomUUID();
    const payload: GenerationRequest = {
      nodeId: generatorId,
      graphETag,
      scenario,
    };

    const generationResponse = await withRetry(
      () => api.createGeneration(spaceId, payload, idempotencyKey, abortSignal),
      { attempts: 2, initialDelayMs: 120 },
    );

    const latestRun = runByResultRef.current[generationResponse.data.resultNodeId] ?? 0;
    if (latestRun !== run) return;

    syncGenerationFromResponse(setGenerationViews, generationResponse.data, run);
    await pollGenerationTask({
      sid: spaceId,
      generation: generationResponse.data,
      run,
      retryAfterMs: generationResponse.meta.retryAfterMs,
      pollIntervalMs,
      refs,
      abortSignal,
      setGenerationViews,
    });
  });

  if (outcome.status === 'error') {
    if (run <= 0) {
      setAppError(outcome.error.message);
    } else {
      const latestRun = runByResultRef.current[chain.resultId] ?? 0;
      if (latestRun === run) {
        setGenerationViews((current) =>
          setGenerationView(current, chain.resultId, {
            status: 'failed',
            imageUrl: null,
            error: outcome.error.message,
            run,
          }),
        );
      }
    }
  }

  delete inFlightGenerationByGeneratorRef.current[generatorId];
};
