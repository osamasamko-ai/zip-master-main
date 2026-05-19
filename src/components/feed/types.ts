export type FeedFilter = 'all' | 'videos' | 'articles' | 'admins' | 'popular';

export type FeedPost = {
  id: string;
  content: string;
  category: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  status: string;
  pinned: boolean;
  featured: boolean;
  shareCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    role: 'lawyer' | 'admin';
    roleLabel: string;
    avatar: string;
    specialty?: string;
  };
  likesCount: number;
  savesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  readingTime: number;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      role: string;
      avatar: string;
    };
  }>;
};

export type SuggestedLawyer = {
  id: string;
  name: string;
  specialty?: string;
  img?: string;
  lawyerProfile?: {
    avatar?: string;
    specialty?: string;
  };
};
