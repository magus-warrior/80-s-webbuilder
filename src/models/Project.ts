import type { ComponentFamily } from './Component';
import type { Page } from './Page';
import type { ThemeToken } from './ThemeToken';

export interface ProjectAnalyticsSummary {
  pageViews: number;
  formSubmissions: number;
  pollVotes: number;
}

export interface ProjectAnalyticsNodeStats {
  nodeId: string;
  type?: string;
  name?: string;
  views: number;
  submissions: number;
  votes: number;
}

export interface ProjectAnalytics {
  summary: ProjectAnalyticsSummary;
  byNode: ProjectAnalyticsNodeStats[];
  updatedAt?: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  slug?: string | null;
  publicSlug?: string | null;
  publicPageId?: string | null;
  isPublished?: boolean;
  publishedAt?: string | null;
  analytics?: ProjectAnalytics;
  pages: Page[];
  themeTokens: ThemeToken[];
  componentFamilies?: ComponentFamily[];
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
