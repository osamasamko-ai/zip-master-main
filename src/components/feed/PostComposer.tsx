import { useState } from 'react';
import type { AuthUser } from '../../context/AuthContext';

const categories = ['معلومة قانونية', 'أحوال شخصية', 'عقارات', 'تجاري', 'عمل', 'مرور', 'فيديو توعوي'];

export default function PostComposer({
  user,
  canCreate,
  isPublishing,
  onPublish,
}: {
  user: AuthUser | null;
  canCreate: boolean;
  isPublishing: boolean;
  onPublish: (payload: { content: string; category: string; media: File | null }) => void;
}) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [media, setMedia] = useState<File | null>(null);

  const publish = () => {
    if (!content.trim() && !media) return;
    onPublish({ content, category, media });
    setContent('');
    setMedia(null);
    setCategory(categories[0]);
  };

  if (!canCreate) {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-navy/5 text-brand-navy">
            <i className="fa-solid fa-eye"></i>
          </div>
          <div>
            <p className="text-sm font-black text-brand-dark">تابع، علّق، واحفظ المحتوى المهم</p>
            <p className="mt-1 text-xs font-bold text-slate-500">النشر متاح فقط للمحامين الموثقين وإدارة المنصة.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="sticky top-[8.6rem] z-20 rounded-[2rem] border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        <img src={user?.img || 'https://i.pravatar.cc/150'} alt="" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-slate-200" />
        <div>
          <p className="text-sm font-black text-brand-dark">{user?.name}</p>
          <p className="text-[11px] font-bold text-slate-400">{user?.role === 'admin' ? 'إدارة المنصة' : 'محامٍ موثق'}</p>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="شارك رأياً قانونياً، ملخص حكم، أو فيديو توعوي..."
        className="w-full resize-none rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold leading-7 text-slate-700 outline-none transition focus:border-brand-navy focus:bg-white"
      />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none"
        >
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {media && (
          <div className="flex min-w-0 flex-1 items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
            <button onClick={() => setMedia(null)} className="text-red-600">إزالة</button>
            <span className="truncate">{media.name}</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 transition hover:border-brand-navy hover:text-brand-navy">
          <i className="fa-solid fa-photo-film"></i>
          صورة أو فيديو
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(event) => setMedia(event.target.files?.[0] || null)}
          />
        </label>
        <button
          onClick={publish}
          disabled={isPublishing || (!content.trim() && !media)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-navy px-5 py-3 text-sm font-black text-white shadow-lg shadow-brand-navy/15 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className="fa-solid fa-paper-plane"></i>
          {isPublishing ? 'جاري النشر...' : 'نشر في المجتمع'}
        </button>
      </div>
    </section>
  );
}
