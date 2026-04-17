import type { Node } from '../../models';
import { getNodeSchema } from './nodeSchemas';

export type NodeTemplate = Omit<Node, 'id'> & {
  children?: NodeTemplate[];
};

const createNodeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const buildNodeFromTemplate = (template: NodeTemplate): Node => {
  const schema = getNodeSchema(template.type);
  return {
    id: createNodeId(),
    type: template.type,
    name: template.name || schema?.defaultName || template.type,
    props: {
      ...(schema?.defaultProps ?? {}),
      ...(template.props ?? {})
    },
    children: template.children?.map(buildNodeFromTemplate)
  };
};

export const templatePresets: Record<string, NodeTemplate> = {
  Hero: {
    type: 'section',
    name: 'Hero Section',
    props: {
      backgroundColor: 'var(--theme-surface-card, rgba(15, 23, 42, 0.75))',
      padding: '32px',
      borderRadius: 'var(--theme-radius-lg, 16px)'
    },
    children: [
      {
        type: 'text',
        name: 'Headline',
        props: {
          content: 'Launch your next studio drop',
          fontSize: '28px',
          fontWeight: '600',
          color: 'var(--theme-text-primary, #e2e8f0)',
          margin: '0 0 12px 0'
        }
      },
      {
        type: 'text',
        name: 'Subheading',
        props: {
          content: 'Capture attention with bold layouts and neon accents.',
          color: 'var(--theme-text-muted, #94a3b8)',
          margin: '0 0 20px 0'
        }
      },
      {
        type: 'button',
        name: 'Primary CTA',
        props: {
          label: 'Book a demo',
          color: 'var(--theme-text-on-accent, #0f172a)'
        }
      }
    ]
  },
  Gallery: {
    type: 'container',
    name: 'Gallery Grid',
    props: {
      columns: '3',
      gap: '16px',
      padding: '24px',
      backgroundColor: 'var(--theme-surface-card, rgba(15, 23, 42, 0.75))',
      borderRadius: 'var(--theme-radius-lg, 16px)'
    },
    children: [
      {
        type: 'image',
        name: 'Gallery Image 1',
        props: {
          src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
          alt: 'Studio lighting'
        }
      },
      {
        type: 'image',
        name: 'Gallery Image 2',
        props: {
          src: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80',
          alt: 'Creative workspace'
        }
      },
      {
        type: 'image',
        name: 'Gallery Image 3',
        props: {
          src: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80',
          alt: 'Design details'
        }
      }
    ]
  },
  Pricing: {
    type: 'container',
    name: 'Pricing Tiers',
    props: {
      columns: '3',
      gap: '16px',
      padding: '24px',
      backgroundColor: 'var(--theme-surface-card, rgba(15, 23, 42, 0.75))',
      borderRadius: 'var(--theme-radius-lg, 16px)'
    },
    children: [
      {
        type: 'section',
        name: 'Starter Tier',
        props: {
          backgroundColor: 'var(--theme-surface-elevated, rgba(30, 41, 59, 0.7))',
          padding: '20px',
          borderRadius: 'var(--theme-radius-lg, 16px)'
        },
        children: [
          {
            type: 'text',
            name: 'Starter Title',
            props: {
              content: 'Starter',
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--theme-text-primary, #e2e8f0)',
              margin: '0 0 8px 0'
            }
          },
          {
            type: 'text',
            name: 'Starter Price',
            props: {
              content: '$39 / month',
              color: 'var(--theme-text-muted, #94a3b8)',
              margin: '0 0 16px 0'
            }
          },
          {
            type: 'button',
            name: 'Starter CTA',
            props: {
              label: 'Choose plan',
              color: 'var(--theme-text-on-accent, #0f172a)'
            }
          }
        ]
      },
      {
        type: 'section',
        name: 'Studio Tier',
        props: {
          backgroundColor: 'var(--theme-surface-elevated, rgba(30, 41, 59, 0.7))',
          padding: '20px',
          borderRadius: 'var(--theme-radius-lg, 16px)'
        },
        children: [
          {
            type: 'text',
            name: 'Studio Title',
            props: {
              content: 'Studio',
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--theme-text-primary, #e2e8f0)',
              margin: '0 0 8px 0'
            }
          },
          {
            type: 'text',
            name: 'Studio Price',
            props: {
              content: '$89 / month',
              color: 'var(--theme-text-muted, #94a3b8)',
              margin: '0 0 16px 0'
            }
          },
          {
            type: 'button',
            name: 'Studio CTA',
            props: {
              label: 'Book studio',
              color: 'var(--theme-text-on-accent, #0f172a)'
            }
          }
        ]
      },
      {
        type: 'section',
        name: 'Premium Tier',
        props: {
          backgroundColor: 'var(--theme-surface-elevated, rgba(30, 41, 59, 0.7))',
          padding: '20px',
          borderRadius: 'var(--theme-radius-lg, 16px)'
        },
        children: [
          {
            type: 'text',
            name: 'Premium Title',
            props: {
              content: 'Premium',
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--theme-text-primary, #e2e8f0)',
              margin: '0 0 8px 0'
            }
          },
          {
            type: 'text',
            name: 'Premium Price',
            props: {
              content: '$149 / month',
              color: 'var(--theme-text-muted, #94a3b8)',
              margin: '0 0 16px 0'
            }
          },
          {
            type: 'button',
            name: 'Premium CTA',
            props: {
              label: 'Go premium',
              color: 'var(--theme-text-on-accent, #0f172a)'
            }
          }
        ]
      }
    ]
  },
  Testimonials: {
    type: 'container',
    name: 'Testimonials',
    props: {
      columns: '2',
      gap: '16px',
      padding: '24px',
      backgroundColor: 'var(--theme-surface-card, rgba(15, 23, 42, 0.75))',
      borderRadius: 'var(--theme-radius-lg, 16px)'
    },
    children: [
      {
        type: 'section',
        name: 'Testimonial One',
        props: {
          backgroundColor: 'var(--theme-surface-elevated, rgba(30, 41, 59, 0.7))',
          padding: '18px',
          borderRadius: 'var(--theme-radius-lg, 16px)'
        },
        children: [
          {
            type: 'text',
            name: 'Quote One',
            props: {
              content: '“Our studio’s output doubled in a single quarter.”',
              color: 'var(--theme-text-primary, #e2e8f0)',
              margin: '0 0 12px 0'
            }
          },
          {
            type: 'text',
            name: 'Attribution One',
            props: {
              content: '— Nova Creative, Director',
              color: 'var(--theme-text-muted, #94a3b8)'
            }
          }
        ]
      },
      {
        type: 'section',
        name: 'Testimonial Two',
        props: {
          backgroundColor: 'var(--theme-surface-elevated, rgba(30, 41, 59, 0.7))',
          padding: '18px',
          borderRadius: 'var(--theme-radius-lg, 16px)'
        },
        children: [
          {
            type: 'text',
            name: 'Quote Two',
            props: {
              content: '“The templates feel like a bespoke creative suite.”',
              color: 'var(--theme-text-primary, #e2e8f0)',
              margin: '0 0 12px 0'
            }
          },
          {
            type: 'text',
            name: 'Attribution Two',
            props: {
              content: '— Atelier West, Founder',
              color: 'var(--theme-text-muted, #94a3b8)'
            }
          }
        ]
      }
    ]
  },
  FAQ: {
    type: 'container',
    name: 'FAQ',
    props: {
      columns: '1',
      gap: '12px',
      padding: '24px',
      backgroundColor: 'var(--theme-surface-card, rgba(15, 23, 42, 0.75))',
      borderRadius: 'var(--theme-radius-lg, 16px)'
    },
    children: [
      {
        type: 'text',
        name: 'FAQ Heading',
        props: {
          content: 'Frequently asked questions',
          fontSize: '22px',
          fontWeight: '600',
          color: 'var(--theme-text-primary, #e2e8f0)',
          margin: '0 0 6px 0'
        }
      },
      {
        type: 'text',
        name: 'FAQ Intro',
        props: {
          content: 'Keep it short and answer the top objections before checkout.',
          color: 'var(--theme-text-muted, #94a3b8)',
          margin: '0 0 12px 0'
        }
      },
      {
        type: 'section',
        name: 'FAQ Item 1',
        props: {
          padding: '14px',
          borderRadius: 'var(--theme-radius-lg, 16px)',
          backgroundColor: 'var(--theme-surface-elevated, rgba(30, 41, 59, 0.7))'
        },
        children: [
          {
            type: 'text',
            name: 'Question 1',
            props: {
              content: 'How quickly can I launch?',
              fontWeight: '600',
              color: 'var(--theme-text-primary, #e2e8f0)',
              margin: '0 0 8px 0'
            }
          },
          {
            type: 'text',
            name: 'Answer 1',
            props: {
              content: 'Most creators publish their first page the same day.',
              color: 'var(--theme-text-muted, #94a3b8)'
            }
          }
        ]
      },
      {
        type: 'section',
        name: 'FAQ Item 2',
        props: {
          padding: '14px',
          borderRadius: 'var(--theme-radius-lg, 16px)',
          backgroundColor: 'var(--theme-surface-elevated, rgba(30, 41, 59, 0.7))'
        },
        children: [
          {
            type: 'text',
            name: 'Question 2',
            props: {
              content: 'Can I connect social links?',
              fontWeight: '600',
              color: 'var(--theme-text-primary, #e2e8f0)',
              margin: '0 0 8px 0'
            }
          },
          {
            type: 'text',
            name: 'Answer 2',
            props: {
              content: 'Yes. Any text, button, or image block can point to a URL.',
              color: 'var(--theme-text-muted, #94a3b8)'
            }
          }
        ]
      }
    ]
  },
  Contact: {
    type: 'section',
    name: 'Contact Block',
    props: {
      padding: '24px',
      backgroundColor: 'var(--theme-surface-card, rgba(15, 23, 42, 0.75))',
      borderRadius: 'var(--theme-radius-lg, 16px)'
    },
    children: [
      {
        type: 'text',
        name: 'Contact Heading',
        props: {
          content: 'Ready to work together?',
          fontSize: '22px',
          fontWeight: '600',
          color: 'var(--theme-text-primary, #e2e8f0)',
          margin: '0 0 10px 0'
        }
      },
      {
        type: 'button',
        name: 'Contact CTA',
        props: {
          label: 'Message us',
          href: 'mailto:hello@example.com',
          target: '_blank',
          rel: 'noopener noreferrer',
          color: 'var(--theme-text-on-accent, #0f172a)'
        }
      }
    ]
  }
};

export const blockTemplates = [
  { key: 'Hero', label: 'Hero', template: templatePresets.Hero },
  { key: 'Gallery', label: 'Gallery', template: templatePresets.Gallery },
  { key: 'Pricing', label: 'Pricing', template: templatePresets.Pricing },
  { key: 'Testimonials', label: 'Testimonials', template: templatePresets.Testimonials },
  { key: 'FAQ', label: 'FAQ', template: templatePresets.FAQ },
  { key: 'Contact', label: 'Contact', template: templatePresets.Contact }
];
