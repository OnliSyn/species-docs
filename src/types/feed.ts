export type FeedCardVariant = 'featured' | 'accent' | 'dark' | 'article';

export interface FeedCard {
  id: string;
  variant: FeedCardVariant;
  category?: string;
  title: string;
  body?: string;
  image?: string;
  meta?: {
    author?: string;
    duration?: string;
    followers?: string;
    comments?: string;
  };
  actions?: { label: string; href?: string }[];
}
