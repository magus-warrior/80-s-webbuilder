import { useMemo } from 'react';

import type { Node } from '../../models';
import { useEditorStore } from '../../store/editorStore';
import NodeRenderer from './NodeRenderer';
import { useTheme } from './ThemeProvider';

const findNodeById = (nodes: Node[], nodeId: string | null): Node | null => {
  if (!nodeId) {
    return null;
  }

  const stack = [...nodes];

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current) {
      continue;
    }
    if (current.id === nodeId) {
      return current;
    }
    if (current.children) {
      stack.unshift(...current.children);
    }
  }

  return null;
};

const styleFields = [
  { label: 'Text color', key: 'color', placeholder: '#f8fafc' },
  { label: 'Background', key: 'backgroundColor', placeholder: '#0f172a' },
  { label: 'Font size', key: 'fontSize', placeholder: '16px' },
  { label: 'Padding', key: 'padding', placeholder: '12px 16px' }
];

export default function EditorLayout() {
  const nodes = useEditorStore((state) => state.nodes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const updateNodeProps = useEditorStore((state) => state.updateNodeProps);
  const { tokens, updateTokenValue, cssVariables } = useTheme();

  const selectedNode = useMemo(
    () => findNodeById(nodes, selectedNodeId),
    [nodes, selectedNodeId]
  );
  const textKey = selectedNode?.type === 'button' ? 'label' : 'content';
  const textValue = selectedNode?.props?.[textKey] ?? '';
  const handleResetStyles = () => {
    if (!selectedNode) {
      return;
    }
    const resetPayload = Object.fromEntries(styleFields.map((field) => [field.key, '']));
    updateNodeProps(selectedNode.id, resetPayload);
  };

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-900/70">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">Editor Workspace</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Drag, drop, and refine</h2>
        </div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live Preview
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)_minmax(240px,0.9fr)]">
        <aside className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-200">Blocks</h3>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[0.65rem] text-slate-300">
              12 items
            </span>
          </div>
          <div className="space-y-3">
            {['Hero', 'Gallery', 'Pricing', 'Testimonials'].map((block) => (
              <button
                key={block}
                className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-fuchsia-400/60 hover:text-white"
              >
                <span>{block}</span>
                <span className="text-xs text-slate-400">+ add</span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
            Tip: Drag blocks onto the canvas to compose your page.
          </div>
        </aside>

        <div className="flex h-full flex-col gap-4 rounded-2xl border border-fuchsia-500/30 bg-slate-900/80 p-5 shadow-lg shadow-fuchsia-500/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-200">Canvas</h3>
            <div className="flex gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-1">Desktop</span>
              <span className="rounded-full border border-slate-700 px-2 py-1">100%</span>
            </div>
          </div>
          <div
            className="flex-1 rounded-2xl border border-dashed border-fuchsia-400/60 bg-slate-950/80 p-6"
            style={cssVariables}
          >
            {nodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-300">
                <p className="text-sm">Drop components here to start building.</p>
                <button className="rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                  Add section
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {nodes.map((node) => (
                  <NodeRenderer key={node.id} node={node} />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-200">
              Inspector
            </h3>
            <span className="text-xs text-slate-400">
              {selectedNode ? selectedNode.name : 'No selection'}
            </span>
          </div>
          {selectedNode ? (
            <div className="space-y-4 text-sm text-slate-200">
              {(selectedNode.type === 'text' || selectedNode.type === 'button') && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Text</p>
                  <label className="mt-3 block text-xs uppercase tracking-[0.2em] text-slate-500">
                    Content
                  </label>
                  <input
                    value={textValue}
                    onChange={(event) =>
                      updateNodeProps(selectedNode.id, {
                        [textKey]: event.target.value
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-400 focus:outline-none"
                    placeholder="Edit text"
                  />
              </div>
            )}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Style</p>
                <div className="mt-3 space-y-3">
                  {styleFields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                        {field.label}
                      </span>
                      <input
                        value={selectedNode.props?.[field.key] ?? ''}
                        onChange={(event) =>
                          updateNodeProps(selectedNode.id, {
                            [field.key]: event.target.value
                          })
                        }
                        placeholder={field.placeholder}
                        className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-400 focus:outline-none"
                      />
                    </label>
                    ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Theme</p>
                <div className="mt-3 space-y-3">
                  {tokens.length > 0 ? (
                    tokens.map((token) => (
                      <label key={token.name} className="block">
                        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                          {token.name}
                        </span>
                        <input
                          value={token.value}
                          onChange={(event) => updateTokenValue(token.name, event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-400 focus:outline-none"
                          placeholder={token.description ?? 'Theme token value'}
                        />
                        {token.description ? (
                          <span className="mt-2 block text-[0.65rem] text-slate-500">
                            {token.description}
                          </span>
                        ) : null}
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No theme tokens loaded yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 p-4 text-xs uppercase tracking-[0.2em] text-slate-400">
              Select a node on the canvas to edit its text and styles.
            </div>
          )}
          <button
            className="mt-auto rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-fuchsia-400/60 hover:text-white"
            onClick={handleResetStyles}
            type="button"
            disabled={!selectedNodeId}
          >
            Reset styles
          </button>
        </aside>
      </div>
    </section>
  );
}
