import type { ThemeToken } from '../../models';

export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  tokens: ThemeToken[];
};

export const themePresets: ThemePreset[] = [
  {
    id: 'neo-noir',
    name: 'Neo Noir',
    description: 'High-contrast noir palette with neon accents.',
    tokens: [
      {
        name: 'Text Primary',
        value: '#e2e8f0',
        description: 'Primary text color',
        category: 'color'
      },
      {
        name: 'Text Muted',
        value: '#94a3b8',
        description: 'Muted text color',
        category: 'color'
      },
      {
        name: 'Text On Accent',
        value: '#0f172a',
        description: 'Text on bright surfaces',
        category: 'color'
      },
      {
        name: 'Surface Card',
        value: 'rgba(15, 23, 42, 0.75)',
        description: 'Card surface',
        category: 'color'
      },
      {
        name: 'Surface Elevated',
        value: 'rgba(30, 41, 59, 0.7)',
        description: 'Elevated surface',
        category: 'color'
      },
      {
        name: 'Accent Primary',
        value: '#22d3ee',
        description: 'Primary accent',
        category: 'color'
      },
      {
        name: 'Radius Lg',
        value: '16px',
        description: 'Large radius',
        category: 'radius'
      },
      {
        name: 'Radius Md',
        value: '12px',
        description: 'Medium radius',
        category: 'radius'
      },
      {
        name: 'Spacing Md',
        value: '16px',
        description: 'Standard spacing',
        category: 'spacing'
      },
      {
        name: 'Font Body',
        value: 'Inter, system-ui, sans-serif',
        description: 'Body font stack',
        category: 'font'
      }
    ]
  },
  {
    id: 'sunset-wave',
    name: 'Sunset Wave',
    description: 'Warm gradients with luminous highlights.',
    tokens: [
      {
        name: 'Text Primary',
        value: '#f8fafc',
        description: 'Primary text color',
        category: 'color'
      },
      {
        name: 'Text Muted',
        value: '#fbbf24',
        description: 'Muted text color',
        category: 'color'
      },
      {
        name: 'Text On Accent',
        value: '#1e1b4b',
        description: 'Text on bright surfaces',
        category: 'color'
      },
      {
        name: 'Surface Card',
        value: 'rgba(30, 27, 75, 0.75)',
        description: 'Card surface',
        category: 'color'
      },
      {
        name: 'Surface Elevated',
        value: 'rgba(49, 46, 129, 0.7)',
        description: 'Elevated surface',
        category: 'color'
      },
      {
        name: 'Accent Primary',
        value: '#f97316',
        description: 'Primary accent',
        category: 'color'
      },
      {
        name: 'Radius Lg',
        value: '18px',
        description: 'Large radius',
        category: 'radius'
      },
      {
        name: 'Radius Md',
        value: '12px',
        description: 'Medium radius',
        category: 'radius'
      },
      {
        name: 'Spacing Md',
        value: '18px',
        description: 'Standard spacing',
        category: 'spacing'
      },
      {
        name: 'Font Body',
        value: '"Space Grotesk", system-ui, sans-serif',
        description: 'Body font stack',
        category: 'font'
      }
    ]
  },
  {
    id: 'studio-light',
    name: 'Studio Light',
    description: 'Soft neutrals with crisp highlights.',
    tokens: [
      {
        name: 'Text Primary',
        value: '#111827',
        description: 'Primary text color',
        category: 'color'
      },
      {
        name: 'Text Muted',
        value: '#6b7280',
        description: 'Muted text color',
        category: 'color'
      },
      {
        name: 'Text On Accent',
        value: '#0f172a',
        description: 'Text on bright surfaces',
        category: 'color'
      },
      {
        name: 'Surface Card',
        value: 'rgba(248, 250, 252, 0.9)',
        description: 'Card surface',
        category: 'color'
      },
      {
        name: 'Surface Elevated',
        value: 'rgba(226, 232, 240, 0.8)',
        description: 'Elevated surface',
        category: 'color'
      },
      {
        name: 'Accent Primary',
        value: '#0ea5e9',
        description: 'Primary accent',
        category: 'color'
      },
      {
        name: 'Radius Lg',
        value: '14px',
        description: 'Large radius',
        category: 'radius'
      },
      {
        name: 'Radius Md',
        value: '10px',
        description: 'Medium radius',
        category: 'radius'
      },
      {
        name: 'Spacing Md',
        value: '14px',
        description: 'Standard spacing',
        category: 'spacing'
      },
      {
        name: 'Font Body',
        value: '"IBM Plex Sans", system-ui, sans-serif',
        description: 'Body font stack',
        category: 'font'
      }
    ]
  }
];
