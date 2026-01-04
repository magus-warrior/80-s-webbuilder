export interface Node {
  id: string;
  type: 'section' | 'text' | 'button' | 'image' | 'container';
  name: string;
  props?: Record<string, string>;
  children?: Node[];
}
