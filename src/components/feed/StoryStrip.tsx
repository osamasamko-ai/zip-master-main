import { useRef, useState } from 'react';
import type { AuthUser } from '../../context/AuthContext';
import type { FeedStory } from './types';

export default function StoryStrip({
  user,
  stories,
  canCreate,
  isPublishing,
  onCreate,
}: {
  user: AuthUser | null;
  stories: FeedStory[];
  canCreate: boolean;
  isPublishing: boolean;
  onCreate: (payload: { text: string; media: File | null }) => void;
}) {
  const [activeStory, setActiveStory] = useState<FeedStory | null>(null);
  const [draftText, setDraftText] = useState('');
  const [draftMedia, setDraftMedia] = useState<File | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userName = user?.name || 'المستخدم';
  const userAvatar = user?.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1877f2&color=ffffff&rounded=true`;

  const publish = () => {
    if (!draftText.trim() && !draftMedia) return;
    onCreate({ text: draftText, media: draftMedia });
    setDraftText('');
    setDraftMedia(null);
    setComposerOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {canCreate && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="relative h-48 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-right shadow-sm transition hover:bg-slate-200"
            >
              <img src={userAvatar} alt="" className="h-32 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-white px-2 pb-3 pt-5">
                <span className="absolute -top-5 right-1/2 flex h-10 w-10 translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-[#1877f2] text-white">
                  <i className="fa-solid fa-plus"></i>
                </span>
                <p className="text-center text-xs font-black text-slate-900">إنشاء قصة</p>
              </div>
            </button>
          )}

          {stories.map((story) => (
            <button
              type="button"
              key={story.id}
              onClick={() => setActiveStory(story)}
              className="relative h-48 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-950 text-right shadow-sm ring-1 ring-slate-200"
            >
              {story.mediaUrl ? (
                story.mediaType === 'video' ? (
                  <video src={story.mediaUrl} muted className="h-full w-full object-cover opacity-90" />
                ) : (
                  <img src={story.mediaUrl} alt="" className="h-full w-full object-cover" />
                )
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#1877f2] to-slate-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />
              <img src={story.author.avatar} alt="" className="absolute right-2 top-2 h-9 w-9 rounded-full border-2 border-[#1877f2] object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2">
                <p className="line-clamp-2 text-xs font-black leading-5 text-white">{story.text || story.author.name}</p>
                <p className="mt-1 truncate text-[10px] font-bold text-white/70">{story.author.name}</p>
              </div>
            </button>
          ))}

          {!canCreate && stories.length === 0 && (
            <div className="flex h-28 min-w-full items-center justify-center rounded-lg bg-slate-50 text-xs font-black text-slate-400">
              لا توجد قصص من المحامين حالياً
            </div>
          )}
        </div>
      </section>

      {composerOpen && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setComposerOpen(false)} className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <i className="fa-solid fa-xmark"></i>
              </button>
              <h2 className="text-base font-black text-slate-900">إنشاء قصة</h2>
            </div>
            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              maxLength={240}
              rows={4}
              placeholder="اكتب تحديثاً سريعاً للعملاء والمتابعين..."
              className="mt-4 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 outline-none focus:border-[#1877f2] focus:bg-white"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">
                <i className="fa-solid fa-photo-film ml-2 text-emerald-500"></i>
                صورة أو فيديو
              </button>
              {draftMedia && (
                <div className="flex min-w-0 flex-1 items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                  <button type="button" onClick={() => setDraftMedia(null)} className="text-red-600">إزالة</button>
                  <span className="truncate">{draftMedia.name}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={publish}
              disabled={isPublishing || (!draftText.trim() && !draftMedia)}
              className="mt-4 w-full rounded-md bg-[#1877f2] px-5 py-3 text-sm font-black text-white transition hover:bg-[#166fe5] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isPublishing ? 'جاري النشر...' : 'نشر القصة'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(event) => setDraftMedia(event.target.files?.[0] || null)}
            />
          </section>
        </div>
      )}

      {activeStory && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/85 p-4">
          <button type="button" onClick={() => setActiveStory(null)} className="absolute left-5 top-5 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <article className="relative aspect-[9/16] max-h-[86vh] w-full max-w-sm overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
            {activeStory.mediaUrl ? (
              activeStory.mediaType === 'video' ? (
                <video src={activeStory.mediaUrl} controls autoPlay className="h-full w-full object-contain" />
              ) : (
                <img src={activeStory.mediaUrl} alt="" className="h-full w-full object-contain" />
              )
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#1877f2] to-slate-950" />
            )}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4">
              <div className="h-1 rounded-full bg-white/80" />
              <div className="mt-3 flex items-center gap-3">
                <img src={activeStory.author.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{activeStory.author.name}</p>
                  <p className="text-[11px] font-bold text-white/70">{activeStory.author.specialty || activeStory.author.roleLabel}</p>
                </div>
              </div>
            </div>
            {activeStory.text && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                <p className="text-center text-lg font-black leading-8 text-white">{activeStory.text}</p>
              </div>
            )}
          </article>
        </div>
      )}
    </>
  );
}
