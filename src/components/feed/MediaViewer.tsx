import { useEffect } from 'react';
import type { FeedPost } from './types';

export default function MediaViewer({ post, onClose }: { post: FeedPost | null; onClose: () => void }) {
  useEffect(() => {
    if (!post) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, post]);

  if (!post?.mediaUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white">
      <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative flex min-h-0 items-center justify-center bg-black">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            aria-label="إغلاق"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
          {post.mediaType === 'video' ? (
            <video src={post.mediaUrl} controls autoPlay preload="metadata" className="max-h-full max-w-full object-contain" />
          ) : (
            <img src={post.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
          )}
        </div>
        <aside className="hidden min-h-0 overflow-y-auto border-r border-white/10 bg-slate-950 p-5 text-right lg:block">
          <div className="flex items-center justify-end gap-3">
            <div>
              <p className="text-sm font-black">{post.author.name}</p>
              <p className="mt-1 text-xs font-bold text-white/55">{post.author.specialty || post.author.roleLabel}</p>
            </div>
            <img src={post.author.avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-white/20" />
          </div>
          <p className="mt-5 whitespace-pre-wrap text-sm font-semibold leading-7 text-white/85">{post.content}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2 text-[11px] font-black">
            <span className="rounded-full bg-white/10 px-3 py-1.5">#{post.category}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{post.likesCount.toLocaleString('ar-IQ')} إعجاب</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">{post.commentsCount} تعليق</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
