import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { api } from '../api/client.js';
import type { GraphData, SaveStatus } from '../types.js';
import { runTask } from './taskUtils.js';

type SaveRefs = {
  etagRef: MutableRefObject<string>;
  latestGraphRef: MutableRefObject<GraphData>;
  conflictRef: MutableRefObject<boolean>;
  revisionRef: MutableRefObject<number>;
  savedRevisionRef: MutableRefObject<number>;
  queuedSaveRef: MutableRefObject<boolean>;
  inFlightSaveRef: MutableRefObject<Promise<boolean> | null>;
};

type SaveState = {
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>;
  setSaveMessage: Dispatch<SetStateAction<string>>;
  setAppError: Dispatch<SetStateAction<string | null>>;
  setEtag: Dispatch<SetStateAction<string>>;
};

type SaveGraphNowTaskInput = {
  spaceId: string;
  refs: SaveRefs;
  state: SaveState;
  abortSignal: AbortSignal;
  runNextSave: () => void;
};

export const saveGraphNowTask = async ({
  spaceId,
  refs,
  state,
  abortSignal,
  runNextSave,
}: SaveGraphNowTaskInput): Promise<boolean> => {
  const {
    etagRef,
    latestGraphRef,
    conflictRef,
    revisionRef,
    savedRevisionRef,
    queuedSaveRef,
    inFlightSaveRef,
  } = refs;
  const { setSaveStatus, setSaveMessage, setAppError, setEtag } = state;

  if (!spaceId || !etagRef.current) return false;
  if (conflictRef.current) return false;

  if (revisionRef.current <= savedRevisionRef.current) {
    return true;
  }

  if (inFlightSaveRef.current) {
    queuedSaveRef.current = true;
    return inFlightSaveRef.current;
  }

  const targetRevision = revisionRef.current;
  const snapshot = latestGraphRef.current;

  setSaveStatus('saving');
  setSaveMessage('Saving changes...');

  const task = (async (): Promise<boolean> => {
    const outcome = await runTask(() =>
      api.putGraph(spaceId, snapshot, etagRef.current, abortSignal),
    );

    if (outcome.status === 'success') {
      const response = outcome.data;
      const nextETag = response.meta.etag;
      if (nextETag) {
        etagRef.current = nextETag;
        setEtag(nextETag);
      }
      savedRevisionRef.current = Math.max(savedRevisionRef.current, targetRevision);
      setSaveStatus('saved');
      setSaveMessage('All changes saved.');
      setAppError(null);
      return true;
    }

    if (outcome.status === 'aborted') return false;

    if (outcome.error.status === 412) {
      conflictRef.current = true;
      setSaveStatus('conflict');
      setSaveMessage('Version conflict. Reload server graph to continue.');
      setAppError(null);
      return false;
    }

    setSaveStatus('error');
    setSaveMessage(outcome.error.message);
    setAppError(null);
    return false;
  })().finally(() => {
    inFlightSaveRef.current = null;
    if (queuedSaveRef.current) {
      queuedSaveRef.current = false;
      runNextSave();
    }
  });

  inFlightSaveRef.current = task;
  return task;
};
