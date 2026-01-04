import type { CSSProperties } from 'react';

import type { Node } from '../../models';

type NodeRendererProps = {
  node: Node;
};

const stylePropHandlers: Record<
  string,
  (value: string, style: CSSProperties) => void
> = {
  color: (value, style) => {
    style.color = value;
  },
  background: (value, style) => {
    style.background = value;
  },
  backgroundColor: (value, style) => {
    style.backgroundColor = value;
  },
  fontSize: (value, style) => {
    style.fontSize = value;
  },
  fontWeight: (value, style) => {
    style.fontWeight = value;
  },
  textAlign: (value, style) => {
    style.textAlign = value as CSSProperties['textAlign'];
  },
  padding: (value, style) => {
    style.padding = value;
  },
  margin: (value, style) => {
    style.margin = value;
  },
  borderRadius: (value, style) => {
    style.borderRadius = value;
  },
  gap: (value, style) => {
    style.gap = value;
  },
  width: (value, style) => {
    style.width = value;
  },
  height: (value, style) => {
    style.height = value;
  },
  display: (value, style) => {
    style.display = value as CSSProperties['display'];
  },
  justifyContent: (value, style) => {
    style.justifyContent = value as CSSProperties['justifyContent'];
  },
  alignItems: (value, style) => {
    style.alignItems = value as CSSProperties['alignItems'];
  },
  gridTemplateColumns: (value, style) => {
    style.gridTemplateColumns = value;
  }
};

const resolveNodeStyles = (node: Node): CSSProperties => {
  const style: CSSProperties = {};
  const props = node.props ?? {};

  Object.entries(props).forEach(([key, value]) => {
    const handler = stylePropHandlers[key];
    if (handler) {
      handler(value, style);
    }
  });

  if (node.type === 'container' && props.columns) {
    const columnCount = Number.parseInt(props.columns, 10);
    if (!Number.isNaN(columnCount) && columnCount > 0) {
      style.display = style.display ?? 'grid';
      style.gridTemplateColumns =
        style.gridTemplateColumns ?? `repeat(${columnCount}, minmax(0, 1fr))`;
      style.gap = style.gap ?? '1rem';
    }
  }

  return style;
};

const renderChildren = (node: Node) =>
  node.children?.map((child) => <NodeRenderer key={child.id} node={child} />) ?? null;

const renderTextNode = (node: Node) => (
  <p style={resolveNodeStyles(node)} className="text-sm text-slate-100">
    {node.props?.content ?? node.name}
  </p>
);

const renderImageNode = (node: Node) => {
  const src = node.props?.src;
  const alt = node.props?.alt ?? node.name;
  const style = resolveNodeStyles(node);

  if (!src) {
    return (
      <div
        style={style}
        className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 text-xs uppercase tracking-[0.2em] text-slate-400"
      >
        Missing image source
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      className="h-auto w-full rounded-2xl border border-slate-800 object-cover shadow-lg shadow-slate-900/40"
    />
  );
};

const renderContainerNode = (node: Node) => (
  <div style={resolveNodeStyles(node)} className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
    {renderChildren(node)}
  </div>
);

const nodeRenderers: Partial<Record<Node['type'], (node: Node) => JSX.Element>> = {
  text: renderTextNode,
  image: renderImageNode,
  container: renderContainerNode
};

export default function NodeRenderer({ node }: NodeRendererProps) {
  const renderer = nodeRenderers[node.type];

  if (renderer) {
    return renderer(node);
  }

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4" style={resolveNodeStyles(node)}>
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{node.type}</div>
      <p className="mt-2 text-sm text-slate-200">{node.name}</p>
      {renderChildren(node)}
    </div>
  );
}
