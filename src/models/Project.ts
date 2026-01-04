import type { Page } from './Page';
import type { ThemeToken } from './ThemeToken';

export interface Project {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  slug?: string | null;
  publicSlug?: string | null;
  isPublished?: boolean;
  publishedAt?: string | null;
  pages: Page[];
  themeTokens: ThemeToken[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug?: string;
  publicId?: string | null;
  publicSlug?: string | null;
  isPublished?: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
}
