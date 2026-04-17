import { useMemo, useState, type ChangeEvent } from 'react';

import type { Asset, Node, NodePropValue } from '../../../models';
import type { NodeSchema } from '../nodeSchemas';
import FieldRenderer from './FieldRenderer';
import InspectorSection from './InspectorSection';

interface NodeInspectorPanelProps {
  selectedNode: Node | null;
  selectedSchema: NodeSchema | null;
  assets: Asset[];
  isLoadingAssets: boolean;
  isUploadingAsset: boolean;
  assetError: string | null;
  onUploadAsset: (event: ChangeEvent<HTMLInputElement>) => void;
  onRenameNode: (node: Node) => void;
  onUpdateNodeProp: (nodeId: string, key: string, value: NodePropValue) => void;
}

export default function NodeInspectorPanel({
  selectedNode,
  selectedSchema,
  assets,
  isLoadingAssets,
  isUploadingAsset,
  assetError,
  onUploadAsset,
  onRenameNode,
  onUpdateNodeProp
}: NodeInspectorPanelProps) {
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isAdvanced, setIsAdvanced] = useState(false);

  const fields = selectedSchema?.inspectorFields ?? [];
  const visibleFields = useMemo(
    () => fields.filter((field) => (isAdvanced ? true : field.basic !== false)),
    [fields, isAdvanced]
  );

  if (!selectedNode) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 p-4 text-xs uppercase tracking-[0.2em] text-slate-400">
        Select a node on the canvas to edit its fields.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
        <button
          type="button"
          onClick={() => onRenameNode(selectedNode)}
          className="w-full rounded-lg border border-slate-800/90 bg-slate-950/70 px-3 py-2 text-left text-xs uppercase tracking-[0.18em] text-slate-300 transition hover:border-cyan-400/60 hover:text-slate-100"
        >
          Rename layer
        </button>
      </div>

      <InspectorSection
        title="Properties"
        isOpen={isPropertiesOpen}
        onToggle={() => setIsPropertiesOpen((prev) => !prev)}
      >
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">Simple mode</p>
          <button
            type="button"
            onClick={() => setIsAdvanced((prev) => !prev)}
            className="rounded-full border border-slate-700/80 px-2 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-slate-400 transition hover:border-cyan-400/60 hover:text-slate-200"
          >
            {isAdvanced ? 'Simple fields' : 'Advanced fields'}
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {visibleFields.length === 0 ? (
            <p className="text-xs text-slate-500">No inspector fields for this node type.</p>
          ) : (
            visibleFields.map((field) => (
              <FieldRenderer
                key={field.key}
                node={selectedNode}
                field={field}
                assets={assets}
                isLoadingAssets={isLoadingAssets}
                isUploadingAsset={isUploadingAsset}
                assetError={assetError}
                onUploadAsset={onUploadAsset}
                onAssetSelect={(asset, key) => {
                  onUpdateNodeProp(selectedNode.id, key, asset.url);
                  onUpdateNodeProp(selectedNode.id, 'alt', asset.filename);
                }}
                onUpdateField={(key, value) => onUpdateNodeProp(selectedNode.id, key, value)}
              />
            ))
          )}
        </div>
      </InspectorSection>
    </div>
  );
}
