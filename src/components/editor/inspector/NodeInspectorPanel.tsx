import { useMemo, useState, type ChangeEvent } from 'react';

import type {
  Asset,
  ComponentFamily,
  ComponentVariant,
  Node,
  NodePropValue
} from '../../../models';
import type { NodeSchema } from '../nodeSchemas';
import type { ComponentOverrideField } from '../componentInstances';
import FieldRenderer from './FieldRenderer';
import InspectorSection from './InspectorSection';

const universalStyleFields: NodeSchema['inspectorFields'] = [
  { key: 'color', label: 'Text color', type: 'text', placeholder: '#e2e8f0', basic: true },
  { key: 'backgroundColor', label: 'Background color', type: 'text', placeholder: '#0f172a', basic: true },
  { key: 'background', label: 'Background (advanced)', type: 'text', placeholder: 'linear-gradient(...)', basic: false },
  { key: 'borderColor', label: 'Border color', type: 'text', placeholder: '#334155', basic: false },
  { key: 'borderWidth', label: 'Border width', type: 'text', placeholder: '1px', basic: false },
  {
    key: 'borderStyle',
    label: 'Border style',
    type: 'select',
    basic: false,
    options: [
      { label: 'Solid', value: 'solid' },
      { label: 'Dashed', value: 'dashed' },
      { label: 'Dotted', value: 'dotted' },
      { label: 'None', value: 'none' }
    ]
  },
  { key: 'fontSize', label: 'Font size', type: 'text', placeholder: '16px', basic: false },
  { key: 'fontWeight', label: 'Font weight', type: 'text', placeholder: '600', basic: false },
  {
    key: 'textAlign',
    label: 'Text align',
    type: 'select',
    basic: false,
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
      { label: 'Justify', value: 'justify' }
    ]
  },
  { key: 'padding', label: 'Padding', type: 'text', placeholder: '12px', basic: false },
  { key: 'margin', label: 'Margin', type: 'text', placeholder: '0', basic: false },
  { key: 'borderRadius', label: 'Border radius', type: 'text', placeholder: '12px', basic: false },
  { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05, defaultValue: 1, basic: false }
];

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
  selectedComponentFamily: ComponentFamily | null;
  selectedComponentVariant: ComponentVariant | null;
  componentOverrideFields: ComponentOverrideField[];
  onSaveAsComponent: () => void;
  onUpdateComponentInstance: (nodeId: string, updates: Record<string, NodePropValue>) => void;
  onUpdateComponentOverride: (nodeId: string, key: string, value: NodePropValue) => void;
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
  onUpdateNodeProp,
  selectedComponentFamily,
  selectedComponentVariant,
  componentOverrideFields,
  onSaveAsComponent,
  onUpdateComponentInstance,
  onUpdateComponentOverride
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

  const selectedInstance = selectedNode.metadata?.componentInstance as
    | { familyId?: string; variantId?: string; overrides?: Record<string, NodePropValue> }
    | undefined;
  const isComponentInstance = selectedNode.type === 'component-instance';

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
        <button
          type="button"
          onClick={onSaveAsComponent}
          className="mt-2 w-full rounded-lg border border-cyan-700/70 bg-cyan-950/30 px-3 py-2 text-left text-xs uppercase tracking-[0.18em] text-cyan-200 transition hover:border-cyan-400/80"
        >
          Save as component
        </button>
      </div>

      {isComponentInstance ? (
        <InspectorSection
          title="Component Instance"
          isOpen
          onToggle={() => undefined}
        >
          <div className="mt-3 space-y-3">
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
              Source: {selectedComponentFamily?.name ?? 'Unknown'} /{' '}
              {selectedComponentVariant?.name ?? 'Unknown'}
            </p>
            <label className="block space-y-1 text-xs uppercase tracking-[0.18em] text-slate-500">
              Variant
              <select
                value={selectedInstance?.variantId ?? ''}
                onChange={(event) =>
                  onUpdateComponentInstance(selectedNode.id, { variantId: event.target.value })
                }
                className="w-full rounded-md border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs text-slate-100"
              >
                {(selectedComponentFamily?.variants ?? []).map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-2">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                Overrides ({componentOverrideFields.length})
              </p>
              {componentOverrideFields.map((field) => {
                const current = selectedInstance?.overrides?.[field.key] ?? field.sourceValue;
                return (
                  <label key={field.key} className="block space-y-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-400">
                      {field.label} · {field.category}
                    </span>
                    <input
                      type="text"
                      value={String(current ?? '')}
                      onChange={(event) =>
                        onUpdateComponentOverride(selectedNode.id, field.key, event.target.value)
                      }
                      className="w-full rounded-md border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs text-slate-100"
                    />
                  </label>
                );
              })}
              {componentOverrideFields.length === 0 ? (
                <p className="text-xs text-slate-500">No overridable fields for this component.</p>
              ) : null}
            </div>
          </div>
        </InspectorSection>
      ) : null}

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
            <p className="text-xs text-slate-500">
              {isComponentInstance
                ? 'Edit overrides in the Component Instance section.'
                : 'No inspector fields for this node type.'}
            </p>
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
      <InspectorSection title="Styles" isOpen onToggle={() => undefined}>
        <div className="mt-3 space-y-3">
          {universalStyleFields
            .filter((field) => (isAdvanced ? true : field.basic !== false))
            .map((field) => (
              <FieldRenderer
                key={`style-${field.key}`}
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
            ))}
        </div>
      </InspectorSection>
    </div>
  );
}
