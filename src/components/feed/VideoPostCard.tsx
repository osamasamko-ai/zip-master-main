import type { FeedPost } from './types';

export default function VideoPostCard({ post, onOpen }: { post?: FeedPost; onOpen?: (id: string) => void }) {
  if (!post) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
        <i className="fa-solid fa-circle-play mb-3 text-3xl text-slate-300"></i>
        <p className="text-xs font-black text-slate-400">لا توجد فيديوهات رائجة بعد</p>
      </div>
    );
  }

  return (
    <button
      onClick={() => onOpen?.(post.id)}
      className="group relative block w-full overflow-hidden rounded-lg bg-slate-950 text-right shadow-sm"
    >
      <div className="aspect-video w-full bg-black">
        {post.mediaUrl ? (
          <video src={post.mediaUrl} muted className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-[#1877f2]" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#1877f2] shadow-xl transition group-hover:scale-110">
          <i className="fa-solid fa-play"></i>
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="line-clamp-2 text-sm font-black leading-6 text-white">{post.content}</p>
        <p className="mt-1 text-[11px] font-bold text-white/70">{post.author.name}</p>
      </div>
    </button>
  );
}
