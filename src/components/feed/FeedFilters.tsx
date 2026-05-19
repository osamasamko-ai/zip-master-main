import type { FeedFilter } from './types';

const filters: Array<{ id: FeedFilter; label: string; icon: string }> = [
  { id: 'all', label: 'الكل', icon: 'fa-layer-group' },
  { id: 'videos', label: 'فيديوهات', icon: 'fa-circle-play' },
  { id: 'articles', label: 'مقالات قانونية', icon: 'fa-newspaper' },
  { id: 'admins', label: 'إعلانات الإدارة', icon: 'fa-bullhorn' },
  { id: 'popular', label: 'الأكثر تفاعلاً', icon: 'fa-fire' },
];

export default function FeedFilters({
  activeFilter,
  onChange,
}: {
  activeFilter: FeedFilter;
  onChange: (filter: FeedFilter) => void;
}) {
  return (
    <div className="sticky top-[4.5rem] z-30 -mx-1 overflow-x-auto rounded-[1.7rem] border border-slate-200 bg-white/90 p-1 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
      <div className="flex min-w-max gap-1">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onChange(filter.id)}
            className={`group inline-flex items-center gap-2 rounded-[1.35rem] px-4 py-3 text-xs font-black transition-all duration-200 ${activeFilter === filter.id
              ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/20'
              : 'text-slate-500 hover:bg-slate-50 hover:text-brand-navy'
              }`}
          >
            <i className={`fa-solid ${filter.icon} ${activeFilter === filter.id ? 'text-brand-gold' : 'text-slate-300 group-hover:text-brand-navy'}`}></i>
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
