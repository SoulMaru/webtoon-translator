export type Work = {
  slug: string;
  title: string;
  description: string;
  mediaFile: string;
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait' | 'square';
  tags: string[];
  createdAt: string;
};

export type WorkList = {
  items: Work[];
  total: number;
  limit: number;
  offset: number;
};

export type Site = {
  title: string;
  tagline: string;
  intro: string;
};
