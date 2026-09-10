import { Background, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { useMemo } from 'react';
import { useCanvasApp } from './state/useCanvasApp.js';
import { PromptNode } from './components/nodes/PromptNode.js';
import { GeneratorNode } from './components/nodes/GeneratorNode.js';
import { ResultNode } from './components/nodes/ResultNode.js';

const nodeTypes = {
  promptNode: PromptNode,
  generatorNode: GeneratorNode,
  resultNode: ResultNode,
};

const App = () => {
  const {
    loading,
    appError,
    toastMessage,
    saveStatus,
    saveMessage,
    viewport,
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
    addPromptNode,
    addGeneratorNode,
    addResultNode,
    createStarterChain,
    reloadFromServer,
  } = useCanvasApp();

  const statusClass = useMemo(() => {
    if (saveStatus === 'error' || saveStatus === 'conflict') {
      return 'rounded-xl border border-rose-400 bg-rose-100 px-3 py-2 text-rose-900';
    }
    if (saveStatus === 'saving') {
      return 'rounded-xl border border-sky-400 bg-sky-100 px-3 py-2 text-sky-900';
    }
    if (saveStatus === 'saved') {
      return 'rounded-xl border border-emerald-400 bg-emerald-100 px-3 py-2 text-emerald-900';
    }
    return 'rounded-xl border border-slate-400 bg-slate-100 px-3 py-2 text-slate-900';
  }, [saveStatus]);

  const actionButtonClass =
    'cursor-pointer rounded-xl border border-slate-700 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

  return (
    <ReactFlowProvider>
      <div className="flex min-h-screen flex-col gap-2 bg-linear-to-br from-slate-50 to-sky-100 p-3 text-slate-900">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white/85 p-3.5 backdrop-blur-sm">
          <div className="flex flex-col">
            <h1 className="m-0 text-2xl font-semibold max-[900px]:text-xl">Canvas Generator</h1>
            <p className="mt-1 text-sm text-slate-700">
              Соберите цепочку Текст - Генератор - Результат
            </p>
          </div>
          <div className="flex flex-row flex-wrap gap-2">
            <button className={actionButtonClass} type="button" onClick={addPromptNode}>
              + Текст
            </button>
            <button className={actionButtonClass} type="button" onClick={addGeneratorNode}>
              + Генератор
            </button>
            <button className={actionButtonClass} type="button" onClick={addResultNode}>
              + Результат
            </button>
            <button
              className={actionButtonClass}
              type="button"
              onClick={() => void reloadFromServer()}
            >
              Reload Server Graph
            </button>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Scenario
              <select
                className="rounded-lg border border-slate-700 bg-white px-2.5 py-1.5 text-sm"
                value={scenario}
                onChange={(event) => setScenario(event.target.value as 'success' | 'failure')}
              >
                <option value="success">success</option>
                <option value="failure">failure</option>
              </select>
            </label>
          </div>
        </header>

        <div className={statusClass}>{saveMessage}</div>
        {appError ? (
          <div className="rounded-xl border border-rose-600 bg-rose-100 p-2.5 text-rose-900">
            {appError}
          </div>
        ) : null}

        <main
          className="relative flex-1 overflow-hidden rounded-2xl border border-slate-300 bg-white/70 shadow-sm"
          style={{ height: 'clamp(480px, 72vh, 900px)' }}
        >
          {loading ? (
            <div className="grid h-full place-items-center font-semibold text-slate-900">
              Loading workspace...
            </div>
          ) : (
            <>
              <div className="absolute inset-0">
                <ReactFlow
                  style={{ width: '100%', height: '100%' }}
                  nodes={rfNodes}
                  edges={rfEdges}
                  defaultViewport={viewport}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnectStart={onConnectStart}
                  onConnectEnd={onConnectEnd}
                  isValidConnection={isValidConnection}
                  onConnect={onConnect}
                  onMoveEnd={(_, viewport) => onViewportChange(viewport)}
                >
                  <Background />
                  <Controls />
                </ReactFlow>
              </div>

              {rfNodes.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="pointer-events-auto flex w-[min(560px,calc(100%-24px))] flex-col items-start gap-2.5 rounded-2xl border border-slate-300 bg-white/95 p-4 shadow-sm">
                    <h2 className="text-lg font-semibold">Канвас пуст</h2>
                    <p className="text-sm text-slate-600">
                      Добавьте ноды вручную кнопками сверху или создайте стартовую цепочку.
                    </p>
                    <button
                      className={actionButtonClass}
                      type="button"
                      onClick={createStarterChain}
                    >
                      Создать стартовую цепочку
                    </button>
                  </div>
                </div>
              ) : null}

              {toastMessage ? (
                <div className="pointer-events-none absolute right-4 bottom-4 z-20 max-w-[380px] rounded-xl border border-amber-300 bg-amber-100/95 px-3 py-2 text-sm font-semibold text-amber-900 shadow-sm">
                  {toastMessage}
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>
    </ReactFlowProvider>
  );
};

export default App;
