import NodeRenderer from './NodeRenderer';

import type { Node } from '../../models';

type RenderedNodesPreviewProps = {
  title: string;
  subtitle: string;
  nodes: Node[];
  badgeLabel?: string;
  emptyStateLabel?: string;
  disableVisualStyles?: boolean;
};

export default function RenderedNodesPreview({
  title,
  subtitle,
  nodes,
  badgeLabel = 'Renderer',
  emptyStateLabel = 'No nodes are available for this page.',
  disableVisualStyles = false
}: RenderedNodesPreviewProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full border border-slate-700/80 bg-black/60 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
          {badgeLabel}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {nodes.length > 0 ? (
          nodes.map((node) => (
            <NodeRenderer
              key={node.id}
              node={node}
              interactive={false}
              disableVisualStyles={disableVisualStyles}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-sm text-slate-400">
            {emptyStateLabel}
          </div>
        )}
      </div>
    </div>
  );
}
