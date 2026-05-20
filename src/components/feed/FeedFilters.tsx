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
    <div className="sticky top-[4.5rem] z-30 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
      <div className="flex min-w-max gap-1">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onChange(filter.id)}
            className={`group inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-black transition-all duration-200 ${activeFilter === filter.id
              ? 'bg-[#1877f2] text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
          >
            <i className={`fa-solid ${filter.icon} ${activeFilter === filter.id ? 'text-white' : 'text-slate-300 group-hover:text-[#1877f2]'}`}></i>
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
