export default function TrendingTopics({ topics }: { topics: string[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
      {topics.map((topic) => (
        <span key={topic} className="min-w-fit rounded-full bg-[#e7f3ff] px-3 py-2 text-[11px] font-black text-[#1877f2]">
          #{topic}
        </span>
      ))}
    </div>
  );
}
