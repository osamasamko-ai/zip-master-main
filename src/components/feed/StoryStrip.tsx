import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../../context/AuthContext';
import type { FeedStory } from './types';

type StoryGroup = {
  authorId: string;
  author: FeedStory['author'];
  stories: FeedStory[];
  coverStory: FeedStory;
  hasUnseen: boolean;
  isArchived: boolean;
};

function groupStoriesByAuthor(stories: FeedStory[]) {
  const groups = new Map<string, FeedStory[]>();

  stories.forEach((story) => {
    const current = groups.get(story.author.id) || [];
    current.push(story);
    groups.set(story.author.id, current);
  });

  return Array.from(groups.entries()).map(([authorId, groupStories]) => {
    const sortedStories = [...groupStories].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      authorId,
      author: sortedStories[0].author,
      stories: sortedStories,
      coverStory: sortedStories[0],
      hasUnseen: sortedStories.some((story) => !story.seenByMe && !story.isArchived),
      isArchived: sortedStories.every((story) => story.isArchived),
    };
  });
}

export default function StoryStrip({
  user,
  stories,
  canCreate,
  isPublishing,
  onCreate,
  onView,
}: {
  user: AuthUser | null;
  stories: FeedStory[];
  canCreate: boolean;
  isPublishing: boolean;
  onCreate: (payload: { text: string; media: File | null }) => void;
  onView: (storyId: string) => void;
}) {
  const navigate = useNavigate();
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'new' | 'seen' | 'archive'>('new');
  const [draftText, setDraftText] = useState('');
  const [draftMedia, setDraftMedia] = useState<File | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userName = user?.name || 'المستخدم';
  const userAvatar = user?.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1877f2&color=ffffff&rounded=true`;
  const activeStories = useMemo(() => stories.filter((story) => !story.isArchived), [stories]);
  const archiveStories = useMemo(() => stories.filter((story) => story.isArchived), [stories]);
  const groupedActiveStories = useMemo(() => groupStoriesByAuthor(activeStories), [activeStories]);
  const archiveGroups = useMemo(() => groupStoriesByAuthor(archiveStories), [archiveStories]);
  const newGroups = useMemo(() => groupedActiveStories.filter((group) => group.hasUnseen), [groupedActiveStories]);
  const seenGroups = useMemo(() => groupedActiveStories.filter((group) => !group.hasUnseen), [groupedActiveStories]);
  const visibleGroups = activeTab === 'archive' ? archiveGroups : activeTab === 'seen' ? seenGroups : newGroups;
  const activeStory = activeStoryGroup?.stories[activeStoryIndex] || null;
  const tabItems = [
    { id: 'new' as const, label: 'جديد', count: newGroups.length },
    { id: 'seen' as const, label: 'شوهد', count: seenGroups.length },
    { id: 'archive' as const, label: 'الأرشيف', count: archiveGroups.length },
  ];

  const publish = () => {
    if (!draftText.trim() && !draftMedia) return;
    onCreate({ text: draftText, media: draftMedia });
    setDraftText('');
    setDraftMedia(null);
    setComposerOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const markStorySeen = (story: FeedStory) => {
    if (story.seenByMe || story.isArchived) return;

    setActiveStoryGroup((current) => {
      if (!current) return current;
      return {
        ...current,
        hasUnseen: current.stories.some((item) => item.id !== story.id && !item.seenByMe && !item.isArchived),
        stories: current.stories.map((item) =>
          item.id === story.id
            ? { ...item, seenByMe: true, viewedAt: item.viewedAt || new Date().toISOString() }
            : item
        ),
      };
    });
    onView(story.id);
  };

  const openGroup = (group: StoryGroup) => {
    const firstUnseenIndex = group.stories.findIndex((story) => !story.seenByMe && !story.isArchived);
    const nextIndex = firstUnseenIndex >= 0 ? firstUnseenIndex : 0;
    const selectedStory = group.stories[nextIndex];
    setActiveStoryGroup({
      ...group,
      hasUnseen: group.stories.some((story) => story.id !== selectedStory.id && !story.seenByMe && !story.isArchived),
      stories: group.stories.map((story) =>
        story.id === selectedStory.id
          ? { ...story, seenByMe: true, viewedAt: story.viewedAt || new Date().toISOString() }
          : story
      ),
    });
    setActiveStoryIndex(nextIndex);
    setStoryProgress(0);
    if (!selectedStory.seenByMe && !selectedStory.isArchived) onView(selectedStory.id);
  };

  const goToStory = (direction: 1 | -1) => {
    if (!activeStoryGroup) return;

    const nextIndex = activeStoryIndex + direction;
    if (nextIndex < 0) return;
    if (nextIndex >= activeStoryGroup.stories.length) {
      setActiveStoryGroup(null);
      setActiveStoryIndex(0);
      setStoryProgress(0);
      return;
    }

    setActiveStoryIndex(nextIndex);
    setStoryProgress(0);
    markStorySeen(activeStoryGroup.stories[nextIndex]);
  };

  useEffect(() => {
    setStoryProgress(0);
  }, [activeStoryIndex]);

  useEffect(() => {
    if (!activeStory) return undefined;

    const duration = activeStory.mediaType === 'video' ? 12000 : 6000;
    const tickMs = 80;
    const increment = (tickMs / duration) * 100;
    const timer = window.setInterval(() => {
      setStoryProgress((current) => {
        const next = current + increment;
        if (next >= 100) {
          window.clearInterval(timer);
          window.setTimeout(() => goToStory(1), 0);
          return 100;
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [activeStory, activeStoryGroup, activeStoryIndex]);

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f3ff] text-[#1877f2]">
              <i className="fa-solid fa-clock-rotate-left text-xs"></i>
            </span>
            <div>
              <h2 className="text-sm font-black text-slate-900">قصص المحامين</h2>
            </div>
          </div>
          <div className="flex w-full rounded-full bg-slate-100 p-1 sm:w-auto sm:shrink-0">
            {tabItems.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition sm:flex-none ${activeTab === tab.id ? 'bg-white text-[#1877f2] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${activeTab === tab.id ? 'bg-[#e7f3ff] text-[#1877f2]' : 'bg-white text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {canCreate && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="relative h-40 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-right shadow-sm transition hover:bg-slate-200"
            >
              <img src={userAvatar} alt="" loading="lazy" decoding="async" className="h-24 w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-white px-2 pb-2 pt-4">
                <span className="absolute -top-4 right-1/2 flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-[#1877f2] text-white">
                  <i className="fa-solid fa-plus text-xs"></i>
                </span>
                <p className="text-center text-[11px] font-black text-slate-900">إنشاء قصة</p>
              </div>
            </button>
          )}

          {visibleGroups.map((group) => (
            <button
              type="button"
              key={`${activeTab}-${group.authorId}`}
              onClick={() => openGroup(group)}
              className={`relative h-40 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-950 text-right shadow-sm transition hover:-translate-y-0.5 ${group.isArchived ? 'opacity-75 ring-1 ring-slate-200' : group.hasUnseen ? 'ring-[3px] ring-[#1877f2]' : 'ring-2 ring-slate-300'}`}
            >
              {group.coverStory.mediaUrl ? (
                group.coverStory.mediaType === 'video' ? (
                  <video src={group.coverStory.mediaUrl} muted preload="none" className="h-full w-full object-cover opacity-90" />
                ) : (
                  <img src={group.coverStory.mediaUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                )
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#1877f2] to-slate-900" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />
              <img
                src={group.author.avatar}
                alt=""
                loading="lazy"
                decoding="async"
                className={`absolute right-2 top-2 h-8 w-8 rounded-full border-2 object-cover cursor-pointer ${group.hasUnseen ? 'border-[#1877f2]' : 'border-slate-300'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${group.author.id}`);
                }}
              />
              {group.stories.length > 1 && (
                <span className="absolute right-2 top-11 rounded-full bg-black/55 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
                  {group.stories.length} قصص
                </span>
              )}
              {group.hasUnseen && !group.isArchived && (
                <span className="absolute left-2 top-2 rounded-full bg-[#1877f2] px-2 py-1 text-[9px] font-black text-white shadow-sm">جديد</span>
              )}
              {group.isArchived && (
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[9px] font-black text-white backdrop-blur">أرشيف</span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-2">
                <p className="line-clamp-2 text-[11px] font-black leading-5 text-white">{group.coverStory.text || group.author.name}</p>
                <p className="mt-1 truncate text-[10px] font-bold text-white/70">{group.author.name}</p>
              </div>
            </button>
          ))}

          {visibleGroups.length === 0 && (
            <div className="flex h-28 min-w-full items-center justify-center rounded-lg bg-slate-50 text-xs font-black text-slate-400">
              {activeTab === 'archive' ? 'لا توجد قصص مؤرشفة حالياً' : activeTab === 'seen' ? 'لم تشاهد أي قصة بعد' : 'لا توجد قصص جديدة من المحامين حالياً'}
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
          <button
            type="button"
            onClick={() => {
              setActiveStoryGroup(null);
              setActiveStoryIndex(0);
              setStoryProgress(0);
            }}
            className="absolute left-5 top-5 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
          <article className="relative aspect-[9/16] max-h-[86vh] w-full max-w-sm overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
            {activeStoryGroup && activeStoryGroup.stories.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goToStory(-1)}
                  disabled={activeStoryIndex === 0}
                  className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-30"
                  title="القصة السابقة"
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
                <button
                  type="button"
                  onClick={() => goToStory(1)}
                  className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50"
                  title="القصة التالية"
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
              </>
            )}
            {activeStory.mediaUrl ? (
              activeStory.mediaType === 'video' ? (
                <video src={activeStory.mediaUrl} controls autoPlay preload="metadata" className="h-full w-full object-contain" />
              ) : (
                <img src={activeStory.mediaUrl} alt="" loading="eager" decoding="async" className="h-full w-full object-contain" />
              )
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-[#1877f2] to-slate-950" />
            )}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4">
              <div className="flex gap-1.5">
                {activeStoryGroup?.stories.map((story, index) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => {
                      setActiveStoryIndex(index);
                      setStoryProgress(0);
                      markStorySeen(story);
                    }}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"
                    title={`القصة ${index + 1}`}
                  >
                    <span
                      className="block h-full rounded-full bg-white transition-[width]"
                      style={{
                        width:
                          index < activeStoryIndex
                            ? '100%'
                            : index === activeStoryIndex
                              ? `${storyProgress}%`
                              : '0%',
                      }}
                    />
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={activeStory.author.avatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={`h-10 w-10 rounded-full border-2 object-cover cursor-pointer ${activeStory.seenByMe || activeStory.isArchived ? 'border-white/60' : 'border-[#1877f2]'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${activeStory.author.id}`);
                  }}
                />
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
