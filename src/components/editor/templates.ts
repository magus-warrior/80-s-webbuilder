import type { Node } from '../../models';
import { getNodeSchema } from './nodeSchemas';

export type NodeTemplate = Omit<Node, 'id' | 'children'> & {
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

const primaryHero: NodeTemplate = {
  type: 'card',
  name: 'Hero / Centered',
  props: { gap: '14px', padding: '32px' },
  children: [
    { type: 'text', name: 'Eyebrow', props: { content: 'New Collection', color: 'var(--theme-text-muted, #94a3b8)' } },
    { type: 'text', name: 'Headline', props: { content: 'Build high-converting pages faster', fontSize: '34px', fontWeight: '700', margin: '0' } },
    { type: 'text', name: 'Subcopy', props: { content: 'Compose with primitives and publish with confidence.', margin: '0 0 12px 0' } },
    {
      type: 'row',
      name: 'CTA Row',
      props: { gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
      children: [
        { type: 'button', name: 'Primary CTA', props: { label: 'Start for free' } },
        { type: 'text', name: 'Microcopy', props: { content: 'No credit card required', color: 'var(--theme-text-muted, #94a3b8)' } }
      ]
    }
  ]
};

const splitHero: NodeTemplate = {
  type: 'row',
  name: 'Hero / Split',
  props: { gap: '18px', alignItems: 'stretch', flexWrap: 'wrap' },
  children: [
    {
      type: 'column',
      name: 'Hero Copy',
      props: { gap: '12px', justifyContent: 'center' },
      children: [
        { type: 'text', name: 'Headline', props: { content: 'Design pages in layouts, not rigid blocks.', fontSize: '30px', fontWeight: '700' } },
        { type: 'text', name: 'Subcopy', props: { content: 'Rows, columns, cards, and grids compose everything from hero sections to pricing.', color: 'var(--theme-text-muted, #94a3b8)' } },
        { type: 'button', name: 'CTA', props: { label: 'Try split hero' } }
      ]
    },
    {
      type: 'card',
      name: 'Hero Visual',
      props: { padding: '12px' },
      children: [
        { type: 'image', name: 'Preview Image', props: { src: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80', alt: 'Developer workstation' } }
      ]
    }
  ]
};

const featureRow: NodeTemplate = {
  type: 'row',
  name: 'Feature Row',
  props: { gap: '16px', flexWrap: 'wrap' },
  children: [1, 2, 3].map((index) => ({
    type: 'card',
    name: `Feature Card ${index}`,
    props: { gap: '8px' },
    children: [
      { type: 'text', name: `Feature ${index} Title`, props: { content: `Feature ${index}`, fontWeight: '700' } },
      { type: 'text', name: `Feature ${index} Description`, props: { content: 'Describe an outcome and why it matters for your customer.', color: 'var(--theme-text-muted, #94a3b8)' } }
    ]
  }))
};

const galleryStrip: NodeTemplate = {
  type: 'grid',
  name: 'Gallery Strip',
  props: { columns: 4, minColumnWidth: '180px', gap: '12px' },
  children: [
    'photo-1500530855697-b586d89ba3ee',
    'photo-1521737604893-d14cc237f11d',
    'photo-1492724441997-5dc865305da7',
    'photo-1489515217757-5fd1be406fef'
  ].map((imageId, index) => ({
    type: 'image',
    name: `Gallery ${index + 1}`,
    props: {
      src: `https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=900&q=80`,
      alt: `Gallery image ${index + 1}`
    }
  }))
};

const pricingMatrix: NodeTemplate = {
  type: 'grid',
  name: 'Pricing Matrix',
  props: { columns: 3, minColumnWidth: '240px', gap: '16px' },
  children: [
    { name: 'Starter', price: '$29/mo' },
    { name: 'Growth', price: '$79/mo' },
    { name: 'Scale', price: '$149/mo' }
  ].map((tier) => ({
    type: 'card',
    name: `${tier.name} Tier`,
    props: { gap: '10px' },
    children: [
      { type: 'text', name: `${tier.name} Name`, props: { content: tier.name, fontSize: '20px', fontWeight: '700' } },
      { type: 'text', name: `${tier.name} Price`, props: { content: tier.price, color: 'var(--theme-text-muted, #94a3b8)' } },
      { type: 'button', name: `${tier.name} CTA`, props: { label: `Choose ${tier.name}` } }
    ]
  }))
};

export const templatePresets: Record<string, NodeTemplate> = {
  HeroCentered: primaryHero,
  HeroSplit: splitHero,
  FeatureRow: featureRow,
  GalleryStrip: galleryStrip,
  PricingMatrix: pricingMatrix
};

export const blockTemplates = [
  { key: 'HeroCentered', label: 'Hero (Centered)', template: templatePresets.HeroCentered },
  { key: 'HeroSplit', label: 'Hero (Split)', template: templatePresets.HeroSplit },
  { key: 'FeatureRow', label: 'Feature Row', template: templatePresets.FeatureRow },
  { key: 'GalleryStrip', label: 'Gallery Strip', template: templatePresets.GalleryStrip },
  { key: 'PricingMatrix', label: 'Pricing Matrix', template: templatePresets.PricingMatrix }
];
