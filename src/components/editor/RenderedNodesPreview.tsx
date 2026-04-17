import NodeRenderer from './NodeRenderer';
import BootstrapContainer from '../layout/BootstrapContainer';

import type { Node } from '../../models';
import type { CSSProperties } from 'react';

type RenderedNodesPreviewProps = {
  title: string;
  subtitle: string;
  nodes: Node[];
  badgeLabel?: string;
  emptyStateLabel?: string;
  disableVisualStyles?: boolean;
  titleStyle?: CSSProperties;
  subtitleStyle?: CSSProperties;
};

export default function RenderedNodesPreview({
  title,
  subtitle,
  nodes,
  badgeLabel = 'Renderer',
  emptyStateLabel = 'No nodes are available for this page.',
  disableVisualStyles = false,
  titleStyle,
  subtitleStyle
}: RenderedNodesPreviewProps) {
  const defaultTitleStyle: CSSProperties = {
    color: 'var(--theme-text-primary, #ffffff)'
  };
  const defaultSubtitleStyle: CSSProperties = {
    color: 'var(--theme-text-muted, #94a3b8)'
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold" style={{ ...defaultTitleStyle, ...titleStyle }}>
            {title}
          </p>
          <p className="text-xs" style={{ ...defaultSubtitleStyle, ...subtitleStyle }}>
            {subtitle}
          </p>
        </div>
        <span className="rounded-full border border-slate-700/80 bg-black/60 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
          {badgeLabel}
        </span>
      </div>
      <div className="mt-4">
        {nodes.length > 0 ? (
          <BootstrapContainer className="space-y-3">
            {nodes.map((node) => (
              <NodeRenderer
                key={node.id}
                node={node}
                interactive={false}
                disableVisualStyles={disableVisualStyles}
              />
            ))}
          </BootstrapContainer>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-sm text-slate-400">
            {emptyStateLabel}
          </div>
        )}
      </div>
    </div>
  );
}
