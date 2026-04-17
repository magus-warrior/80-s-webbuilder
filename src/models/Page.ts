import type { PageComponentInstance } from './Component';
import type { Node } from './Node';

export interface Page {
  id: string;
  title: string;
  path: string;
  nodes: Node[];
  componentInstances?: PageComponentInstance[];
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: string;
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
}
