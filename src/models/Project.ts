import type { Page } from './Page';
import type { ThemeToken } from './ThemeToken';

export interface Project {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  pages: Page[];
  themeTokens: ThemeToken[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug?: string;
  publicId?: string | null;
  updatedAt?: string;
}
