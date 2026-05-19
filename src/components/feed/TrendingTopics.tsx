export default function TrendingTopics({ topics }: { topics: string[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
      {topics.map((topic) => (
        <span key={topic} className="min-w-fit rounded-full bg-brand-gold/15 px-3 py-2 text-[11px] font-black text-brand-dark">
          #{topic}
        </span>
      ))}
    </div>
  );
}
