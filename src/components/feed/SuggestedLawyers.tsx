import type { SuggestedLawyer } from './types';

export default function SuggestedLawyers({ lawyers, onFollow }: { lawyers: SuggestedLawyer[]; onFollow: (id: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:hidden">
      {lawyers.slice(0, 2).map((lawyer) => (
        <div key={lawyer.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <button onClick={() => onFollow(lawyer.id)} className="rounded-md bg-[#1877f2] px-3 py-2 text-[11px] font-black text-white">
            متابعة
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-black text-slate-900">{lawyer.name}</p>
              <p className="text-[10px] font-bold text-slate-400">{lawyer.lawyerProfile?.specialty || lawyer.specialty || 'محامٍ موثق'}</p>
            </div>
            <img src={lawyer.avatar || lawyer.lawyerProfile?.avatar || lawyer.img || 'https://i.pravatar.cc/150'} alt="" className="h-10 w-10 rounded-full object-cover" />
          </div>
        </div>
      ))}
    </div>
  );
}
