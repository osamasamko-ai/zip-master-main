import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../../context/AuthContext';
import type { FeedPost } from './types';
import LazyVideo from './LazyVideo';
import MediaViewer from './MediaViewer';

const formatDate = (value: string) => new Intl.DateTimeFormat('ar-IQ', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

export default function PostCard({
  post,
  user,
  onLike,
  onSave,
  onShare,
  onComment,
  onEdit,
  onDelete,
  onHide,
  onPin,
  onFeature,
  onFollow,
  onConsult,
}: {
  post: FeedPost;
  user: AuthUser | null;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onShare: (id: string) => void;
  onComment: (id: string, content: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onHide: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onFeature: (id: string, featured: boolean) => void;
  onFollow: (lawyerId: string) => void;
  onConsult: (post: FeedPost) => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const isLong = post.content.length > 280;
  const visibleText = expanded || !isLong ? post.content : `${post.content.slice(0, 280)}...`;
  const canManage = user?.role === 'admin' || user?.id === post.author.id;
  const canEdit = user?.id === post.author.id;
  const handleDoubleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, video')) {
      return;
    }

    event.preventDefault();
    window.getSelection()?.removeAllRanges();
  };

  return (
    <>
    <article
      id={post.id}
      onDoubleClick={handleDoubleClick}
      style={{ touchAction: 'manipulation' }}
      className={`group overflow-hidden rounded-lg border bg-white shadow-sm transition duration-200 ${post.pinned ? 'border-[#1877f2]/30 ring-1 ring-[#1877f2]/10' : 'border-slate-200'}`}
    >
      {(post.pinned || post.author.role === 'admin') && (
        <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-slate-600">
          <span className="text-xs font-black">{post.pinned ? 'منشور مثبت' : 'إعلان رسمي'}</span>
          <i className={`fa-solid ${post.pinned ? 'fa-thumbtack' : 'fa-bullhorn'} text-[#1877f2]`}></i>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative cursor-pointer" onClick={() => navigate(`/profile/${post.author.id}`)}>
              <img src={post.author.avatar} alt="" loading="lazy" decoding="async" className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200" />
              <span className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1877f2] text-[9px] text-white ring-2 ring-white">
                <i className="fa-solid fa-check"></i>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-black text-slate-900">{post.author.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${post.author.role === 'admin' ? 'bg-[#e7f3ff] text-[#1877f2]' : 'bg-slate-100 text-slate-600'}`}>
                  {post.author.role === 'admin' ? 'إدارة' : 'محامي'}
                </span>
                {post.featured && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">مميز</span>}
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-500">{post.author.specialty || post.author.roleLabel} · {formatDate(post.createdAt)} · <i className="fa-solid fa-earth-americas"></i></p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {post.author.role === 'lawyer' && post.author.id !== user?.id && (
              <>
                <button onClick={() => onConsult(post)} className="rounded-md bg-brand-navy px-3 py-2 text-[11px] font-black text-white transition hover:bg-brand-dark">
                  استشارة
                </button>
                <button onClick={() => onFollow(post.author.id)} className="rounded-md bg-[#e7f3ff] px-3 py-2 text-[11px] font-black text-[#1877f2] transition hover:bg-[#dbeafe]">
                  متابعة
                </button>
              </>
            )}
            {canManage && (
              <div className="flex gap-1">
                {canEdit && <button onClick={() => setEditing(true)} className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"><i className="fa-solid fa-pen text-xs"></i></button>}
                {user?.role === 'admin' && (
                  <>
                    <button onClick={() => onPin(post.id, !post.pinned)} className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"><i className="fa-solid fa-thumbtack text-xs"></i></button>
                    <button onClick={() => onFeature(post.id, !post.featured)} className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"><i className="fa-solid fa-star text-xs"></i></button>
                    <button onClick={() => onHide(post.id)} className="h-9 w-9 rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"><i className="fa-solid fa-eye-slash text-xs"></i></button>
                  </>
                )}
                <button onClick={() => onDelete(post.id)} className="h-9 w-9 rounded-full bg-red-50 text-red-700 transition hover:bg-red-100"><i className="fa-solid fa-trash-can text-xs"></i></button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#e7f3ff] px-3 py-1 text-[11px] font-black text-[#1877f2]">#{post.category}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">{post.readingTime} دقيقة قراءة</span>
        </div>

        <div className="mt-4">
          {editing ? (
            <div className="space-y-3">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} className="w-full rounded-md border border-slate-200 px-4 py-3 text-sm font-bold leading-7 outline-none focus:border-[#1877f2]" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="rounded-md bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">إلغاء</button>
                <button onClick={() => { onEdit(post.id, draft); setEditing(false); }} className="rounded-md bg-[#1877f2] px-4 py-2 text-xs font-black text-white">حفظ</button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[15px] font-semibold leading-8 text-slate-800">
              {visibleText}
              {isLong && (
                <button onClick={() => setExpanded((value) => !value)} className="mr-2 text-xs font-black text-[#1877f2] underline-offset-4 hover:underline">
                  {expanded ? 'عرض أقل' : 'قراءة المزيد'}
                </button>
              )}
            </p>
          )}
        </div>

        {post.mediaUrl && (
          <div className="-mx-4 mt-4 overflow-hidden border-y border-slate-100 bg-slate-100">
            {post.mediaType === 'video' ? (
              <div onClick={() => setViewerOpen(true)} className="relative aspect-square max-h-[680px] w-full cursor-pointer bg-black sm:aspect-[4/3]">
                <LazyVideo src={post.mediaUrl} className="bg-black object-contain" paused={viewerOpen} />
                <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur">
                  <i className="fa-solid fa-play ml-1 text-brand-gold"></i>
                  متابعة المشاهدة
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setViewerOpen(true)} className="flex aspect-square max-h-[680px] w-full items-center justify-center bg-slate-100 sm:aspect-[4/3]">
                <img src={post.mediaUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1877f2] text-[10px] text-white">
              <i className="fa-solid fa-thumbs-up"></i>
            </span>
            {post.likesCount.toLocaleString('ar-IQ')}
          </span>
          <span>{post.commentsCount} تعليق · {post.shareCount} مشاركة · {post.savesCount} حفظ</span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 border-y border-slate-100 py-1.5">
          <ActionButton active={post.likedByMe} icon="fa-thumbs-up" label="إعجاب" onClick={() => onLike(post.id)} />
          <ActionButton icon="fa-comment" label="تعليق" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()} />
          <ActionButton icon="fa-share-nodes" label="مشاركة" onClick={() => onShare(post.id)} />
          <ActionButton active={post.savedByMe} icon="fa-bookmark" label="حفظ" onClick={() => onSave(post.id)} />
        </div>

        <div className="mt-4 space-y-3">
          {post.comments.slice(-3).map((item) => (
            <div key={item.id} className="flex gap-2">
              <img src={item.author.avatar} alt="" loading="lazy" decoding="async" className="h-8 w-8 rounded-full object-cover" />
              <div className="rounded-2xl bg-slate-100 px-3 py-2">
                <p className="text-xs font-black text-slate-900">{item.author.name}</p>
                <p className="mt-0.5 text-xs font-bold leading-6 text-slate-700">{item.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <img src={user?.img || 'https://i.pravatar.cc/150'} alt="" loading="lazy" decoding="async" className="h-9 w-9 rounded-full object-cover" />
            <input
              id={`comment-${post.id}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && comment.trim()) {
                  onComment(post.id, comment);
                  setComment('');
                }
              }}
              placeholder="اكتب تعليقاً مهنياً..."
              className="min-w-0 flex-1 rounded-full border border-transparent bg-slate-100 px-4 py-3 text-xs font-bold outline-none focus:border-[#1877f2] focus:bg-white"
            />
            <button onClick={() => { if (comment.trim()) { onComment(post.id, comment); setComment(''); } }} className="h-10 w-10 shrink-0 rounded-full bg-[#1877f2] text-xs font-black text-white transition hover:bg-[#166fe5]">
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </article>
    <MediaViewer post={viewerOpen ? post : null} onClose={() => setViewerOpen(false)} />
    </>
  );
}

function ActionButton({ active, icon, label, onClick }: { active?: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-md px-2 py-2.5 text-xs font-black transition sm:px-3 ${active ? 'bg-[#e7f3ff] text-[#1877f2]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
      <i className={`fa-solid ${icon} ml-2`}></i>
      {label}
    </button>
  );
}
