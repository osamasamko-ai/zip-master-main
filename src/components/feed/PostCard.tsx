import { useMemo, useState } from 'react';
import type { AuthUser } from '../../context/AuthContext';
import type { FeedPost } from './types';

const formatDate = (value: string) => new Intl.DateTimeFormat('ar-IQ', {
  dateStyle: 'medium',
  timeStyle: 'short',
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
}) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const isLong = post.content.length > 280;
  const visibleText = expanded || !isLong ? post.content : `${post.content.slice(0, 280)}...`;
  const canManage = user?.role === 'admin' || user?.id === post.author.id;
  const canEdit = user?.id === post.author.id;

  const relatedLabel = useMemo(() => {
    if (post.mediaType === 'video') return 'تابع الفيديوهات المشابهة';
    if (post.author.role === 'admin') return 'إعلان مرتبط من الإدارة';
    return `مواضيع مشابهة في ${post.category}`;
  }, [post.author.role, post.category, post.mediaType]);

  return (
    <article id={post.id} className={`group overflow-hidden rounded-[2rem] border bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-900/8 ${post.pinned ? 'border-brand-gold/50 ring-2 ring-brand-gold/10' : 'border-slate-200'}`}>
      {(post.pinned || post.author.role === 'admin') && (
        <div className="flex items-center justify-between bg-gradient-to-l from-brand-navy to-[#233f68] px-5 py-3 text-white">
          <span className="text-xs font-black">{post.pinned ? 'منشور مثبت' : 'إعلان رسمي'}</span>
          <i className={`fa-solid ${post.pinned ? 'fa-thumbtack' : 'fa-bullhorn'} text-brand-gold`}></i>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <img src={post.author.avatar} alt="" className="h-13 w-13 rounded-2xl object-cover ring-1 ring-slate-200" />
              <span className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white ring-2 ring-white">
                <i className="fa-solid fa-check"></i>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-black text-brand-dark">{post.author.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${post.author.role === 'admin' ? 'bg-brand-gold/20 text-brand-dark' : 'bg-brand-navy/5 text-brand-navy'}`}>
                  {post.author.role === 'admin' ? 'إدارة' : 'محامي'}
                </span>
                {post.featured && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">مميز</span>}
              </div>
              <p className="mt-1 text-[11px] font-bold text-slate-400">{post.author.specialty || post.author.roleLabel} · {formatDate(post.createdAt)}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {post.author.role === 'lawyer' && post.author.id !== user?.id && (
              <button onClick={() => onFollow(post.author.id)} className="rounded-xl bg-brand-navy/5 px-3 py-2 text-[11px] font-black text-brand-navy transition hover:bg-brand-navy hover:text-white">
                متابعة
              </button>
            )}
            {canManage && (
              <div className="flex gap-1">
                {canEdit && <button onClick={() => setEditing(true)} className="h-9 w-9 rounded-xl bg-slate-50 text-slate-500 transition hover:bg-brand-navy hover:text-white"><i className="fa-solid fa-pen text-xs"></i></button>}
                {user?.role === 'admin' && (
                  <>
                    <button onClick={() => onPin(post.id, !post.pinned)} className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 transition hover:bg-amber-100"><i className="fa-solid fa-thumbtack text-xs"></i></button>
                    <button onClick={() => onFeature(post.id, !post.featured)} className="h-9 w-9 rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"><i className="fa-solid fa-star text-xs"></i></button>
                    <button onClick={() => onHide(post.id)} className="h-9 w-9 rounded-xl bg-slate-50 text-slate-500 transition hover:bg-slate-100"><i className="fa-solid fa-eye-slash text-xs"></i></button>
                  </>
                )}
                <button onClick={() => onDelete(post.id)} className="h-9 w-9 rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100"><i className="fa-solid fa-trash-can text-xs"></i></button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-gold/15 px-3 py-1.5 text-[11px] font-black text-brand-dark">{post.category}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-500">{post.readingTime} دقيقة قراءة</span>
        </div>

        <div className="mt-4">
          {editing ? (
            <div className="space-y-3">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold leading-7 outline-none focus:border-brand-navy" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">إلغاء</button>
                <button onClick={() => { onEdit(post.id, draft); setEditing(false); }} className="rounded-xl bg-brand-navy px-4 py-2 text-xs font-black text-white">حفظ</button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm font-bold leading-8 text-slate-700">
              {visibleText}
              {isLong && (
                <button onClick={() => setExpanded((value) => !value)} className="mr-2 text-xs font-black text-brand-navy underline-offset-4 hover:underline">
                  {expanded ? 'عرض أقل' : 'قراءة المزيد'}
                </button>
              )}
            </p>
          )}
        </div>

        {post.mediaUrl && (
          <div className="relative mt-5 overflow-hidden rounded-[1.6rem] border border-slate-100 bg-slate-950">
            {post.mediaType === 'video' ? (
              <>
                <video src={post.mediaUrl} controls poster="" className="max-h-[560px] w-full bg-black object-contain" />
                <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur">
                  <i className="fa-solid fa-play ml-1 text-brand-gold"></i>
                  متابعة المشاهدة
                </div>
              </>
            ) : (
              <img src={post.mediaUrl} alt="" className="max-h-[560px] w-full object-cover transition duration-500 group-hover:scale-[1.01]" />
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold text-slate-400">
          <span>{post.likesCount} إعجاب · {post.commentsCount} تعليق · {post.shareCount} مشاركة · {post.savesCount} حفظ</span>
          <span>{relatedLabel}</span>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 border-y border-slate-100 py-3">
          <ActionButton active={post.likedByMe} icon="fa-thumbs-up" label="إعجاب" onClick={() => onLike(post.id)} />
          <ActionButton icon="fa-comment" label="تعليق" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()} />
          <ActionButton icon="fa-share-nodes" label="مشاركة" onClick={() => onShare(post.id)} />
          <ActionButton active={post.savedByMe} icon="fa-bookmark" label="حفظ" onClick={() => onSave(post.id)} />
        </div>

        <div className="mt-4 space-y-3">
          {post.comments.slice(-3).map((item) => (
            <div key={item.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
              <img src={item.author.avatar} alt="" className="h-9 w-9 rounded-xl object-cover" />
              <div>
                <p className="text-xs font-black text-brand-dark">{item.author.name}</p>
                <p className="mt-1 text-xs font-bold leading-6 text-slate-600">{item.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
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
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold outline-none focus:border-brand-navy focus:bg-white"
            />
            <button onClick={() => { if (comment.trim()) { onComment(post.id, comment); setComment(''); } }} className="rounded-2xl bg-brand-navy px-4 py-3 text-xs font-black text-white">
              إرسال
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ActionButton({ active, icon, label, onClick }: { active?: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-2xl px-3 py-2 text-xs font-black transition ${active ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/15' : 'text-slate-500 hover:bg-slate-50 hover:text-brand-navy'}`}>
      <i className={`fa-solid ${icon} ml-2`}></i>
      {label}
    </button>
  );
}
