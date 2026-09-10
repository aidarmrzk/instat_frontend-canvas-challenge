import { request } from './http.js';
import type {
  Config,
  GenerationData,
  GenerationRequest,
  GraphData,
  RequestMeta,
  SpaceData,
} from '../types.js';

type WithMeta<T> = Promise<{ data: T; meta: RequestMeta }>;

export const api = {
  getConfig: (): WithMeta<Config> => request('/api/config'),
  createSpace: (title: string): WithMeta<SpaceData> =>
    request('/api/spaces', { method: 'POST', body: { title } }),
  getGraph: (spaceId: string, signal?: AbortSignal): WithMeta<GraphData> =>
    request(`/api/spaces/${spaceId}/graph`, { signal }),
  putGraph: (
    spaceId: string,
    graph: GraphData,
    etag: string,
    signal?: AbortSignal,
  ): WithMeta<GraphData> =>
    request(`/api/spaces/${spaceId}/graph`, {
      method: 'PUT',
      signal,
      body: graph,
      headers: { 'if-match': etag },
    }),
  createGeneration: (
    spaceId: string,
    payload: GenerationRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): WithMeta<GenerationData> =>
    request(`/api/spaces/${spaceId}/generations`, {
      method: 'POST',
      body: payload,
      signal,
      headers: { 'idempotency-key': idempotencyKey },
    }),
  getGeneration: (
    spaceId: string,
    generationId: string,
    signal?: AbortSignal,
  ): WithMeta<GenerationData> =>
    request(`/api/spaces/${spaceId}/generations/${generationId}`, { signal }),
  listGenerations: (spaceId: string, signal?: AbortSignal): WithMeta<GenerationData[]> =>
    request(`/api/spaces/${spaceId}/generations`, { signal }),
};
