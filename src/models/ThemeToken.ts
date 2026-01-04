export interface ThemeToken {
  name: string;
  value: string;
  description?: string;
  category: 'color' | 'font' | 'spacing' | 'radius' | 'shadow';
}
