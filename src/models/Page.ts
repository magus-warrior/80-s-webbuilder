import type { Node } from './Node';

export interface Page {
  id: string;
  title: string;
  path: string;
  nodes: Node[];
}
