import type { FeedPost, SuggestedLawyer } from './types';
import VideoPostCard from './VideoPostCard';

export default function FeedSidebar({
  posts,
  suggestedLawyers,
  onFollow,
  onOpenPost,
}: {
  posts: FeedPost[];
  suggestedLawyers: SuggestedLawyer[];
  onFollow: (id: string) => void;
  onOpenPost: (id: string) => void;
}) {
  const trendingTopics = Array.from(new Set(posts.map((post) => post.category).filter(Boolean))).slice(0, 8);
  const videos = posts.filter((post) => post.mediaType === 'video').slice(0, 3);
  const announcements = posts.filter((post) => post.author.role === 'admin').slice(0, 3);

  return (
    <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
      <Panel title="المواضيع الرائجة" icon="fa-hashtag">
        <div className="flex flex-wrap gap-2">
          {(trendingTopics.length ? trendingTopics : ['أحوال شخصية', 'عقارات', 'عقود', 'عمل']).map((topic) => (
            <span key={topic} className="rounded-full bg-brand-gold/15 px-3 py-1.5 text-[11px] font-black text-brand-dark">
              #{topic}
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="محامون مقترحون" icon="fa-user-plus">
        <div className="space-y-3">
          {suggestedLawyers.slice(0, 4).map((lawyer) => (
            <div key={lawyer.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
              <button onClick={() => onFollow(lawyer.id)} className="rounded-xl bg-white px-3 py-2 text-[11px] font-black text-brand-navy shadow-sm transition hover:bg-brand-navy hover:text-white">
                متابعة
              </button>
              <div className="flex min-w-0 items-center gap-3">
                <div className="min-w-0 text-right">
                  <p className="truncate text-xs font-black text-brand-dark">{lawyer.name}</p>
                  <p className="truncate text-[10px] font-bold text-slate-400">{lawyer.lawyerProfile?.specialty || lawyer.specialty || 'محامٍ موثق'}</p>
                </div>
                <img src={lawyer.lawyerProfile?.avatar || lawyer.img || 'https://i.pravatar.cc/150'} alt="" className="h-10 w-10 rounded-xl object-cover" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="فيديوهات شائعة" icon="fa-circle-play">
        <div className="space-y-3">
          <VideoPostCard post={videos[0]} onOpen={onOpenPost} />
          {videos.slice(1).map((video) => (
            <button key={video.id} onClick={() => onOpenPost(video.id)} className="line-clamp-2 w-full rounded-2xl bg-slate-50 p-3 text-right text-xs font-black leading-6 text-slate-600 transition hover:bg-brand-navy hover:text-white">
              {video.content}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="آخر إعلانات الإدارة" icon="fa-bullhorn">
        <div className="space-y-2">
          {announcements.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-400">لا توجد إعلانات حديثة.</p>
          ) : announcements.map((post) => (
            <button key={post.id} onClick={() => onOpenPost(post.id)} className="w-full rounded-2xl border border-brand-gold/20 bg-brand-gold/10 p-3 text-right transition hover:bg-brand-gold/20">
              <p className="line-clamp-2 text-xs font-black leading-6 text-brand-dark">{post.content}</p>
            </button>
          ))}
        </div>
      </Panel>
    </aside>
  );
}

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-black text-brand-dark">{title}</h3>
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-navy/5 text-brand-navy">
          <i className={`fa-solid ${icon} text-xs`}></i>
        </span>
      </div>
      {children}
    </section>
  );
}
