import { useRef, useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayName = user?.name || 'المستخدم';
  const avatar = user?.img || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1877f2&color=ffffff&rounded=true`;
  const canPublish = Boolean(content.trim() || media) && !isPublishing;

  const publish = () => {
    if (!content.trim() && !media) return;
    onPublish({ content, category, media });
    setContent('');
    setMedia(null);
    setCategory(categories[0]);
    setIsExpanded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!canCreate) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e7f3ff] text-[#1877f2]">
            <i className="fa-solid fa-eye"></i>
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">تابع، علّق، واحفظ المحتوى المهم</p>
            <p className="mt-1 text-xs font-bold text-slate-500">النشر متاح فقط للمحامين الموثقين وإدارة المنصة.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200" />
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-3 text-right text-sm font-bold text-slate-500 transition hover:bg-slate-200"
        >
          بماذا تفكر، {displayName.split(' ')[0]}؟
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1 border-t border-slate-100 pt-3">
        <button type="button" onClick={() => setIsExpanded(true)} className="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100">
          <i className="fa-solid fa-video text-red-500"></i>
          فيديو مباشر
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100">
          <i className="fa-solid fa-images text-emerald-500"></i>
          صورة/فيديو
        </button>
        <button type="button" onClick={() => setIsExpanded(true)} className="flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-100">
          <i className="fa-solid fa-face-smile text-amber-400"></i>
          شعور
        </button>
      </div>

      {(isExpanded || media) && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900">{displayName}</p>
              <p className="text-[11px] font-bold text-slate-500">{user?.role === 'admin' ? 'إدارة المنصة' : 'محامٍ موثق'} · عام</p>
            </div>
          </div>
          <textarea
            autoFocus
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={`بماذا تفكر، ${displayName.split(' ')[0]}؟`}
            className="w-full resize-none border-0 bg-white px-1 py-2 text-base font-semibold leading-8 text-slate-800 outline-none placeholder:text-slate-400"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 outline-none focus:border-[#1877f2]"
            >
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {media && (
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setMedia(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-600"
                >
                  إزالة
                </button>
                <span className="truncate">{media.name}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50"
            >
              <i className="fa-solid fa-photo-film text-emerald-500"></i>
              إضافة صورة أو فيديو
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={!canPublish}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1877f2] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#166fe5] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <i className="fa-solid fa-paper-plane"></i>
              {isPublishing ? 'جاري النشر...' : 'نشر'}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(event) => {
          setMedia(event.target.files?.[0] || null);
          setIsExpanded(true);
        }}
      />
    </section>
  );
}
