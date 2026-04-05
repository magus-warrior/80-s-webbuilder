import type { Project } from './models';

export const localSampleProject: Project = {
  id: 'project-local-starter',
  name: 'Local Starter Project',
  description: 'Built-in starter content used when remote sample JSON is unavailable.',
  updatedAt: new Date(0).toISOString(),
  themeTokens: [
    {
      name: 'brand.neon',
      value: '#8b5cf6',
      description: 'Primary accent color',
      category: 'color'
    },
    {
      name: 'surface.card',
      value: '#0b0f1f',
      description: 'Card surface color',
      category: 'color'
    },
    {
      name: 'radius.lg',
      value: '24px',
      description: 'Large corner radius',
      category: 'radius'
    }
  ],
  pages: [
    {
      id: 'page-home',
      title: 'Home',
      path: '/',
      nodes: [
        {
          id: 'node-hero',
          type: 'section',
          name: 'Hero',
          props: {
            backgroundColor: 'var(--theme-surface-card, #0b0f1f)',
            padding: '32px',
            borderRadius: '16px'
          },
          children: [
            {
              id: 'node-hero-title',
              type: 'text',
              name: 'Headline',
              props: {
                content: 'Welcome to your new project',
                fontSize: '28px',
                fontWeight: '600',
                color: '#e2e8f0'
              }
            },
            {
              id: 'node-hero-copy',
              type: 'text',
              name: 'Body',
              props: {
                content: 'Edit this page, save your changes, then publish to view it live.',
                color: '#94a3b8'
              }
            },
            {
              id: 'node-hero-cta',
              type: 'button',
              name: 'CTA',
              props: {
                label: 'Start editing',
                color: '#0f172a'
              }
            }
          ]
        }
      ]
    }
  ]
};
