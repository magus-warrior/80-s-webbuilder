import type { ChangeEvent } from 'react';

import type { Asset, Node, NodePropValue } from '../../../models';
import type { NodeInspectorField } from '../nodeSchemas';
import { getNodePropAsString, getNodePropByPath } from '../nodeSchemas';

interface FieldRendererProps {
  node: Node;
  field: NodeInspectorField;
  assets: Asset[];
  isLoadingAssets: boolean;
  isUploadingAsset: boolean;
  assetError: string | null;
  onUploadAsset: (event: ChangeEvent<HTMLInputElement>) => void;
  onAssetSelect: (asset: Asset, key: string) => void;
  onUpdateField: (key: string, value: NodePropValue) => void;
}

const toNumber = (input: string, fallback: number, min?: number, max?: number) => {
  const parsed = Number.parseFloat(input);
  const safeValue = Number.isFinite(parsed) ? parsed : fallback;
  const minBound = typeof min === 'number' ? min : safeValue;
  const maxBound = typeof max === 'number' ? max : safeValue;
  return Math.min(maxBound, Math.max(minBound, safeValue));
};

const fallbackForField = (field: NodeInspectorField): NodePropValue => {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  if (field.type === 'toggle') {
    return false;
  }
  if (field.type === 'number' || field.type === 'range') {
    return field.min ?? 0;
  }
  if (field.type === 'list' || field.type === 'repeater') {
    return [];
  }
  return '';
};

const buildLinkUpdates = (url: string) => {
  const cleaned = url.trim();
  const external = /^https?:\/\//.test(cleaned);
  return {
    href: cleaned,
    target: external ? '_blank' : '',
    rel: external ? 'noopener noreferrer' : ''
  };
};

export default function FieldRenderer({
  node,
  field,
  assets,
  isLoadingAssets,
  isUploadingAsset,
  assetError,
  onUploadAsset,
  onAssetSelect,
  onUpdateField
}: FieldRendererProps) {
  const fieldValue = getNodePropByPath(node, field.key);

  if (field.type === 'textarea' || field.type === 'richtext') {
    return (
      <label className="block">
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{field.label}</span>
        <textarea
          value={getNodePropAsString(node, field.key)}
          onChange={(event) => onUpdateField(field.key, event.target.value)}
          placeholder={field.placeholder}
          rows={field.type === 'richtext' ? 5 : 3}
          className="mt-2 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
        />
      </label>
    );
  }

  if (field.type === 'image') {
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{field.label} URL</span>
          <input
            value={getNodePropAsString(node, field.key)}
            onChange={(event) => onUpdateField(field.key, event.target.value.trim())}
            placeholder={field.placeholder}
            className="mt-2 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
          />
        </label>
        <label className="block">
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">Upload image</span>
          <input
            type="file"
            accept="image/*"
            onChange={onUploadAsset}
            disabled={isUploadingAsset}
            className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-neon-gradient file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950 file:shadow-lg file:neon-glow-soft disabled:opacity-60"
          />
        </label>
        {assetError ? <p className="text-xs text-rose-300">Error: {assetError}</p> : null}
        {isLoadingAssets ? (
          <p className="text-xs text-slate-500">Loading assets...</p>
        ) : assets.length === 0 ? (
          <p className="text-xs text-slate-500">No assets uploaded yet.</p>
        ) : (
          <div className="grid gap-2">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onAssetSelect(asset, field.key)}
                className={`flex items-center gap-3 rounded-lg border px-2 py-2 text-left text-xs transition ${
                  asset.url === getNodePropAsString(node, field.key)
                    ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100'
                    : 'border-slate-800/80 bg-black/60 text-slate-300 hover:border-cyan-400/60'
                }`}
              >
                <img
                  src={asset.url}
                  alt={asset.filename}
                  className="h-10 w-10 rounded-md border border-slate-800 object-cover"
                />
                <span className="truncate">{asset.filename}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'link') {
    const href = getNodePropAsString(node, field.key || 'href');
    const opensInNewTab = getNodePropAsString(node, 'target') === '_blank';
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{field.label}</span>
          <input
            value={href}
            onChange={(event) => {
              const updates = buildLinkUpdates(event.target.value);
              Object.entries(updates).forEach(([key, value]) => onUpdateField(key, value));
            }}
            placeholder={field.placeholder ?? 'https://example.com'}
            className="mt-2 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
          />
        </label>
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
          <input
            type="checkbox"
            checked={opensInNewTab}
            onChange={(event) => {
              onUpdateField('target', event.target.checked ? '_blank' : '');
              onUpdateField('rel', event.target.checked ? 'noopener noreferrer' : '');
            }}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950/80 text-cyan-400 focus:ring-cyan-400"
          />
          Open in new tab
        </label>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="block">
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{field.label}</span>
        <select
          value={getNodePropAsString(node, field.key)}
          onChange={(event) => onUpdateField(field.key, event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value || option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'toggle') {
    const checked = Boolean(fieldValue ?? fallbackForField(field));
    return (
      <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 px-3 py-2 text-xs uppercase tracking-[0.16em] text-slate-400">
        {field.label}
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onUpdateField(field.key, event.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-950/80 text-cyan-400 focus:ring-cyan-400"
        />
      </label>
    );
  }

  if (field.type === 'number' || field.type === 'range') {
    const fallback = Number(field.defaultValue ?? field.min ?? 0);
    const numericValue = toNumber(String(fieldValue ?? fallback), fallback, field.min, field.max);
    return (
      <label className="block">
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{field.label}</span>
        <input
          type={field.type}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={numericValue}
          onChange={(event) =>
            onUpdateField(
              field.key,
              toNumber(event.target.value, fallback, field.min, field.max)
            )
          }
          className="mt-2 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
        />
      </label>
    );
  }

  if (field.type === 'list') {
    const values = Array.isArray(fieldValue) ? fieldValue.map((value) => String(value)) : [];
    return (
      <div className="space-y-2">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{field.label}</p>
        {values.map((value, index) => (
          <div key={`${field.key}-${index}`} className="flex gap-2">
            <input
              value={value}
              onChange={(event) => onUpdateField(`${field.key}.${index}`, event.target.value)}
              className="w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
            />
            <button
              type="button"
              onClick={() => onUpdateField(field.key, values.filter((_, itemIndex) => itemIndex !== index))}
              className="rounded-lg border border-rose-500/60 px-2 text-[0.6rem] uppercase text-rose-200"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onUpdateField(field.key, [...values, `${field.listItemLabel ?? 'Item'} ${values.length + 1}`])}
          className="rounded-lg border border-slate-700/80 px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-slate-300"
        >
          Add {field.listItemLabel ?? 'item'}
        </button>
      </div>
    );
  }

  if (field.type === 'repeater') {
    const rows = Array.isArray(fieldValue) ? fieldValue : [];
    const subFields = field.repeaterFields ?? [];
    return (
      <div className="space-y-3">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{field.label}</p>
        {rows.map((row, rowIndex) => {
          const typedRow = typeof row === 'object' && row !== null ? row : {};
          return (
            <div key={`${field.key}-${rowIndex}`} className="rounded-lg border border-slate-800/80 p-3">
              <p className="mb-2 text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                {(field.listItemLabel ?? 'Item')} {rowIndex + 1}
              </p>
              <div className="space-y-2">
                {subFields.map((subField) => (
                  <label key={`${rowIndex}-${subField.key}`} className="block">
                    <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">{subField.label}</span>
                    <input
                      value={String((typedRow as Record<string, NodePropValue>)[subField.key] ?? subField.defaultValue ?? '')}
                      onChange={(event) =>
                        onUpdateField(
                          `${field.key}.${rowIndex}.${subField.key}`,
                          subField.type === 'number' || subField.type === 'range'
                            ? toNumber(event.target.value, Number(subField.defaultValue ?? 0), subField.min, subField.max)
                            : event.target.value
                        )
                      }
                      placeholder={subField.placeholder}
                      className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onUpdateField(field.key, rows.filter((_, index) => index !== rowIndex))}
                className="mt-2 rounded-lg border border-rose-500/60 px-2 py-1 text-[0.6rem] uppercase text-rose-200"
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const nextItem = (field.repeaterFields ?? []).reduce<Record<string, NodePropValue>>(
              (acc, subField) => {
                acc[subField.key] = subField.defaultValue ?? '';
                return acc;
              },
              {}
            );
            onUpdateField(field.key, [...rows, nextItem]);
          }}
          className="rounded-lg border border-slate-700/80 px-3 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-slate-300"
        >
          Add {field.listItemLabel ?? 'item'}
        </button>
      </div>
    );
  }

  return (
    <label className="block">
      <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">{field.label}</span>
      <input
        value={getNodePropAsString(node, field.key)}
        onChange={(event) => onUpdateField(field.key, event.target.value)}
        placeholder={field.placeholder}
        className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
      />
      {field.helperText ? <span className="mt-1 block text-[0.65rem] text-slate-500">{field.helperText}</span> : null}
    </label>
  );
}
