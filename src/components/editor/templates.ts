import type { Node } from '../../models';

export type NodeTemplate = Omit<Node, 'id'> & {
  children?: NodeTemplate[];
};

const createNodeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const buildNodeFromTemplate = (template: NodeTemplate): Node => ({
  id: createNodeId(),
  type: template.type,
  name: template.name,
  props: template.props,
  children: template.children?.map(buildNodeFromTemplate)
});

export const templatePresets: Record<string, NodeTemplate> = {
  Hero: {
    type: 'section',
    name: 'Hero Section',
    props: {
      backgroundColor: '#0f172a',
      padding: '32px',
      borderRadius: '24px'
    },
    children: [
      {
        type: 'text',
        name: 'Headline',
        props: {
          content: 'Launch your next studio drop',
          fontSize: '28px',
          fontWeight: '600',
          color: '#f8fafc',
          margin: '0 0 12px 0'
        }
      },
      {
        type: 'text',
        name: 'Subheading',
        props: {
          content: 'Capture attention with bold layouts and neon accents.',
          color: '#94a3b8',
          margin: '0 0 20px 0'
        }
      },
      {
        type: 'button',
        name: 'Primary CTA',
        props: {
          label: 'Book a demo'
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
      backgroundColor: '#0b1120',
      borderRadius: '24px'
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
      backgroundColor: '#0b1120',
      borderRadius: '24px'
    },
    children: [
      {
        type: 'section',
        name: 'Starter Tier',
        props: {
          backgroundColor: '#111827',
          padding: '20px',
          borderRadius: '20px'
        },
        children: [
          {
            type: 'text',
            name: 'Starter Title',
            props: {
              content: 'Starter',
              fontSize: '18px',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }
          },
          {
            type: 'text',
            name: 'Starter Price',
            props: {
              content: '$39 / month',
              color: '#94a3b8',
              margin: '0 0 16px 0'
            }
          },
          {
            type: 'button',
            name: 'Starter CTA',
            props: {
              label: 'Choose plan'
            }
          }
        ]
      },
      {
        type: 'section',
        name: 'Studio Tier',
        props: {
          backgroundColor: '#111827',
          padding: '20px',
          borderRadius: '20px'
        },
        children: [
          {
            type: 'text',
            name: 'Studio Title',
            props: {
              content: 'Studio',
              fontSize: '18px',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }
          },
          {
            type: 'text',
            name: 'Studio Price',
            props: {
              content: '$89 / month',
              color: '#94a3b8',
              margin: '0 0 16px 0'
            }
          },
          {
            type: 'button',
            name: 'Studio CTA',
            props: {
              label: 'Book studio'
            }
          }
        ]
      },
      {
        type: 'section',
        name: 'Premium Tier',
        props: {
          backgroundColor: '#111827',
          padding: '20px',
          borderRadius: '20px'
        },
        children: [
          {
            type: 'text',
            name: 'Premium Title',
            props: {
              content: 'Premium',
              fontSize: '18px',
              fontWeight: '600',
              margin: '0 0 8px 0'
            }
          },
          {
            type: 'text',
            name: 'Premium Price',
            props: {
              content: '$149 / month',
              color: '#94a3b8',
              margin: '0 0 16px 0'
            }
          },
          {
            type: 'button',
            name: 'Premium CTA',
            props: {
              label: 'Go premium'
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
      backgroundColor: '#0b1120',
      borderRadius: '24px'
    },
    children: [
      {
        type: 'section',
        name: 'Testimonial One',
        props: {
          backgroundColor: '#111827',
          padding: '18px',
          borderRadius: '18px'
        },
        children: [
          {
            type: 'text',
            name: 'Quote One',
            props: {
              content: '“Our studio’s output doubled in a single quarter.”',
              margin: '0 0 12px 0'
            }
          },
          {
            type: 'text',
            name: 'Attribution One',
            props: {
              content: '— Nova Creative, Director',
              color: '#94a3b8'
            }
          }
        ]
      },
      {
        type: 'section',
        name: 'Testimonial Two',
        props: {
          backgroundColor: '#111827',
          padding: '18px',
          borderRadius: '18px'
        },
        children: [
          {
            type: 'text',
            name: 'Quote Two',
            props: {
              content: '“The templates feel like a bespoke creative suite.”',
              margin: '0 0 12px 0'
            }
          },
          {
            type: 'text',
            name: 'Attribution Two',
            props: {
              content: '— Atelier West, Founder',
              color: '#94a3b8'
            }
          }
        ]
      }
    ]
  }
};

export const blockTemplates = [
  { key: 'Hero', label: 'Hero', template: templatePresets.Hero },
  { key: 'Gallery', label: 'Gallery', template: templatePresets.Gallery },
  { key: 'Pricing', label: 'Pricing', template: templatePresets.Pricing },
  { key: 'Testimonials', label: 'Testimonials', template: templatePresets.Testimonials }
];
