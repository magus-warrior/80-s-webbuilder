import { useEffect, useMemo, useState } from 'react';

const swatches = [
  '#0f172a',
  '#1e293b',
  '#38bdf8',
  '#818cf8',
  '#f472b6',
  '#f97316',
  '#facc15',
  '#4ade80',
  '#ffffff'
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const toHex = (value: number) => value.toString(16).padStart(2, '0');

const normalizeHex = (hex: string) => {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    return `#${normalized
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`;
  }
  if (normalized.length === 6 || normalized.length === 8) {
    return `#${normalized.slice(0, 6)}`;
  }
  return '#ffffff';
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex).replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
};

const parseHexColor = (value: string) => {
  const normalized = value.replace('#', '').trim();
  if (normalized.length === 6) {
    return { hex: `#${normalized}`, alpha: 100 };
  }
  if (normalized.length === 8) {
    const alpha = Number.parseInt(normalized.slice(6, 8), 16);
    return {
      hex: `#${normalized.slice(0, 6)}`,
      alpha: Math.round((alpha / 255) * 100)
    };
  }
  return null;
};

const parseRgbColor = (value: string) => {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }
  const parts = match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  const r = clamp(Number.parseFloat(parts[0]), 0, 255);
  const g = clamp(Number.parseFloat(parts[1]), 0, 255);
  const b = clamp(Number.parseFloat(parts[2]), 0, 255);
  const a = parts[3] ? clamp(Number.parseFloat(parts[3]), 0, 1) : 1;
  return {
    hex: `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`,
    alpha: Math.round(a * 100)
  };
};

const parseCssColor = (value: string) => {
  if (!value) {
    return null;
  }
  if (value.startsWith('#')) {
    return parseHexColor(value);
  }
  if (value.toLowerCase().startsWith('rgb')) {
    return parseRgbColor(value);
  }
  return null;
};

const buildColorValue = (hex: string, alpha: number) => {
  const safeAlpha = clamp(alpha, 0, 100);
  if (safeAlpha >= 100) {
    return normalizeHex(hex);
  }
  const { r, g, b } = hexToRgb(hex);
  const alphaValue = (safeAlpha / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `rgba(${r}, ${g}, ${b}, ${alphaValue})`;
};

const splitGradientArgs = (value: string) => {
  const args: string[] = [];
  let buffer = '';
  let depth = 0;

  for (const char of value) {
    if (char === '(') {
      depth += 1;
    }
    if (char === ')') {
      depth = Math.max(depth - 1, 0);
    }
    if (char === ',' && depth === 0) {
      args.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += char;
  }

  if (buffer.trim()) {
    args.push(buffer.trim());
  }

  return args;
};

const parseGradient = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('linear-gradient(') || !trimmed.endsWith(')')) {
    return null;
  }
  const inside = trimmed.slice(trimmed.indexOf('(') + 1, -1);
  const args = splitGradientArgs(inside);
  if (args.length < 2) {
    return null;
  }
  let angle = 90;
  let startIndex = 0;
  const angleMatch = args[0].match(/(-?\d+(?:\.\d+)?)deg/i);
  if (angleMatch) {
    angle = Number.parseFloat(angleMatch[1]);
    startIndex = 1;
  }
  const startColor = args[startIndex] ?? '#ffffff';
  const endColor = args[startIndex + 1] ?? '#000000';
  return { angle, startColor, endColor };
};

type ColorControlProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string | null;
};

export default function ColorControl({ label, value, onChange, description }: ColorControlProps) {
  const initialGradient = useMemo(() => parseGradient(value), [value]);
  const initialColor = useMemo(() => parseCssColor(value), [value]);
  const [isGradient, setIsGradient] = useState(Boolean(initialGradient));
  const [solidHex, setSolidHex] = useState(initialColor?.hex ?? '#f8fafc');
  const [solidAlpha, setSolidAlpha] = useState(initialColor?.alpha ?? 100);
  const [startHex, setStartHex] = useState(
    parseCssColor(initialGradient?.startColor ?? '')?.hex ?? solidHex
  );
  const [startAlpha, setStartAlpha] = useState(
    parseCssColor(initialGradient?.startColor ?? '')?.alpha ?? solidAlpha
  );
  const [endHex, setEndHex] = useState(
    parseCssColor(initialGradient?.endColor ?? '')?.hex ?? '#0f172a'
  );
  const [endAlpha, setEndAlpha] = useState(
    parseCssColor(initialGradient?.endColor ?? '')?.alpha ?? solidAlpha
  );
  const [angle, setAngle] = useState(initialGradient?.angle ?? 90);

  useEffect(() => {
    const gradient = parseGradient(value);
    if (gradient) {
      const parsedStart = parseCssColor(gradient.startColor);
      const parsedEnd = parseCssColor(gradient.endColor);
      setIsGradient(true);
      setAngle(gradient.angle);
      setStartHex(parsedStart?.hex ?? '#f8fafc');
      setStartAlpha(parsedStart?.alpha ?? 100);
      setEndHex(parsedEnd?.hex ?? '#0f172a');
      setEndAlpha(parsedEnd?.alpha ?? 100);
      return;
    }
    const parsed = parseCssColor(value);
    if (parsed) {
      setIsGradient(false);
      setSolidHex(parsed.hex);
      setSolidAlpha(parsed.alpha);
      setStartHex(parsed.hex);
      setStartAlpha(parsed.alpha);
    }
  }, [value]);

  const handleSolidChange = (nextHex = solidHex, nextAlpha = solidAlpha) => {
    setSolidHex(nextHex);
    setSolidAlpha(nextAlpha);
    onChange(buildColorValue(nextHex, nextAlpha));
  };

  const handleGradientChange = (
    nextStartHex = startHex,
    nextStartAlpha = startAlpha,
    nextEndHex = endHex,
    nextEndAlpha = endAlpha,
    nextAngle = angle
  ) => {
    setStartHex(nextStartHex);
    setStartAlpha(nextStartAlpha);
    setEndHex(nextEndHex);
    setEndAlpha(nextEndAlpha);
    setAngle(nextAngle);
    const start = buildColorValue(nextStartHex, nextStartAlpha);
    const end = buildColorValue(nextEndHex, nextEndAlpha);
    onChange(`linear-gradient(${nextAngle}deg, ${start}, ${end})`);
  };

  const handleModeToggle = (nextGradient: boolean) => {
    setIsGradient(nextGradient);
    if (nextGradient) {
      handleGradientChange(solidHex, solidAlpha, endHex, endAlpha, angle);
    } else {
      handleSolidChange(startHex, startAlpha);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
          {label}
        </span>
        <label className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
          <input
            type="checkbox"
            checked={isGradient}
            onChange={(event) => handleModeToggle(event.target.checked)}
            className="h-4 w-4 accent-cyan-400"
          />
          Gradient
        </label>
      </div>

      {!isGradient ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={normalizeHex(solidHex)}
              onChange={(event) => handleSolidChange(event.target.value, solidAlpha)}
              className="h-10 w-12 rounded-lg border border-slate-700/80 bg-slate-950/80"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Alpha</span>
                <span>{solidAlpha}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={solidAlpha}
                onChange={(event) => handleSolidChange(solidHex, Number(event.target.value))}
                className="mt-1 w-full accent-cyan-400"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {swatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => handleSolidChange(swatch, solidAlpha)}
                className="h-6 w-6 rounded-full border border-slate-700/70"
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                Start
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={normalizeHex(startHex)}
                  onChange={(event) =>
                    handleGradientChange(event.target.value, startAlpha, endHex, endAlpha, angle)
                  }
                  className="h-10 w-12 rounded-lg border border-slate-700/80 bg-slate-950/80"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Alpha</span>
                    <span>{startAlpha}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={startAlpha}
                    onChange={(event) =>
                      handleGradientChange(
                        startHex,
                        Number(event.target.value),
                        endHex,
                        endAlpha,
                        angle
                      )
                    }
                    className="mt-1 w-full accent-cyan-400"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                End
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={normalizeHex(endHex)}
                  onChange={(event) =>
                    handleGradientChange(startHex, startAlpha, event.target.value, endAlpha, angle)
                  }
                  className="h-10 w-12 rounded-lg border border-slate-700/80 bg-slate-950/80"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Alpha</span>
                    <span>{endAlpha}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={endAlpha}
                    onChange={(event) =>
                      handleGradientChange(
                        startHex,
                        startAlpha,
                        endHex,
                        Number(event.target.value),
                        angle
                      )
                    }
                    className="mt-1 w-full accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Angle</span>
              <span>{angle}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              value={angle}
              onChange={(event) =>
                handleGradientChange(startHex, startAlpha, endHex, endAlpha, Number(event.target.value))
              }
              className="mt-1 w-full accent-cyan-400"
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-800/80 bg-slate-950/80 p-3 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Value</span>
          <span className="truncate pl-2 text-[0.65rem] text-slate-300">
            {value || '—'}
          </span>
        </div>
        {description ? (
          <p className="mt-2 text-[0.65rem] text-slate-500">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
