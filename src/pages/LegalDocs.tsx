import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';

export interface LawSource {
  id: string;
  title: string;
  law: string;
  article: string;
  category: string;
  summary: string;
  source: string;
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
  userName: string;
}

type LegalTab = 'explore' | 'categories' | 'workspace';

const tabs: Array<{
  id: LegalTab;
  label: string;
  icon: string;
  description: string;
}> = [
    { id: 'explore', label: 'الاستكشاف', icon: 'fa-compass', description: 'بحث كثيف وسريع داخل القاعدة القانونية' },
    { id: 'categories', label: 'الفئات', icon: 'fa-table-cells-large', description: 'تصفح منظم حسب المجال القانوني' },
    { id: 'workspace', label: 'مساحة العمل', icon: 'fa-bookmark', description: 'المحفوظات والمراجع الأخيرة' }
  ];

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <>{text}</>;
  const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedHighlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-brand-gold/30 text-brand-dark px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const filterExploreDocs = (docs: LawSource[], exploreQuery: string, exploreCategoryFilter: string) => {
  const normalizedQuery = exploreQuery.trim().toLowerCase();

  return docs.filter((doc) => {
    const matchesCategory = exploreCategoryFilter === 'all' || doc.category === exploreCategoryFilter;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      doc.title.toLowerCase().includes(normalizedQuery) ||
      doc.law.toLowerCase().includes(normalizedQuery) ||
      doc.summary.toLowerCase().includes(normalizedQuery) ||
      doc.article.toLowerCase().includes(normalizedQuery) ||
      doc.category.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
};

export const filterCategoryDocs = (docs: LawSource[], categorySearchQuery: string, selectedCategory: string) => {
  const normalizedQuery = categorySearchQuery.trim().toLowerCase();

  return docs.filter((doc) => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      doc.title.toLowerCase().includes(normalizedQuery) ||
      doc.law.toLowerCase().includes(normalizedQuery) ||
      doc.summary.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
};

export const filterWorkspaceDocs = (docs: LawSource[], workspaceQuery: string, pinnedDocIds: string[], recentDocIds: string[]) => {
  const normalizedQuery = workspaceQuery.trim().toLowerCase();
  const pinnedDocs = docs.filter((doc) => pinnedDocIds.includes(doc.id));
  const recentDocs = recentDocIds.map((id) => docs.find((doc) => doc.id === id)).filter(Boolean) as LawSource[];
  const merged = [...pinnedDocs, ...recentDocs.filter((doc) => !pinnedDocIds.includes(doc.id))];

  return merged.filter((doc) => {
    if (!normalizedQuery) return true;
    return (
      doc.title.toLowerCase().includes(normalizedQuery) ||
      doc.law.toLowerCase().includes(normalizedQuery) ||
      doc.summary.toLowerCase().includes(normalizedQuery) ||
      doc.category.toLowerCase().includes(normalizedQuery)
    );
  });
};

export default function LegalDocs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [docs, setDocs] = useState<LawSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const [activeTab, setActiveTab] = useState<LegalTab>('explore');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isFullView, setIsFullView] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pinnedDocIds, setPinnedDocIds] = useState<string[]>([]);
  const [recentDocIds, setRecentDocIds] = useState<string[]>([]);

  const [docComments, setDocComments] = useState<Record<string, Comment[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = window.localStorage.getItem('lexigate-legal-doc-comments');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [commentInput, setCommentInput] = useState('');

  const [exploreQuery, setExploreQuery] = useState('');
  const [exploreCategoryFilter, setExploreCategoryFilter] = useState('all');
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/legal/docs');
        if (!res.ok) throw new Error('فشل في جلب البيانات');
        const data = await res.json();
        setDocs(data);
        setSelectedDocId(data[0]?.id ?? null);
      } catch {
        setError('حدث خطأ أثناء تحميل قاعدة القوانين. حاول إعادة التحميل.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('lexigate-legal-doc-comments', JSON.stringify(docComments));
  }, [docComments]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    docs.forEach((doc) => categorySet.add(doc.category));
    return ['all', ...Array.from(categorySet)];
  }, [docs]);

  const categoryStats = useMemo(
    () =>
      categories
        .filter((category) => category !== 'all')
        .map((category) => ({
          category,
          count: docs.filter((doc) => doc.category === category).length
        }))
        .sort((left, right) => right.count - left.count),
    [categories, docs]
  );

  const exploreDocs = useMemo(() => {
    return filterExploreDocs(docs, exploreQuery, exploreCategoryFilter);
  }, [docs, exploreQuery, exploreCategoryFilter]);

  const categoryDocs = useMemo(() => {
    return filterCategoryDocs(docs, categorySearchQuery, selectedCategory);
  }, [docs, selectedCategory, categorySearchQuery]);

  const pinnedDocs = useMemo(
    () => docs.filter((doc) => pinnedDocIds.includes(doc.id)),
    [docs, pinnedDocIds]
  );

  const recentDocs = useMemo(
    () => recentDocIds.map((id) => docs.find((doc) => doc.id === id)).filter(Boolean) as LawSource[],
    [docs, recentDocIds]
  );

  const workspaceDocs = useMemo(() => {
    return filterWorkspaceDocs(docs, workspaceQuery, pinnedDocIds, recentDocIds);
  }, [docs, pinnedDocIds, recentDocIds, workspaceQuery]);

  const selectedDoc =
    docs.find((doc) => doc.id === selectedDocId) ??
    exploreDocs[0] ??
    categoryDocs[0] ??
    workspaceDocs[0] ??
    docs[0] ??
    null;

  const selectDoc = (docId: string) => {
    setSelectedDocId(docId);
    setRecentDocIds((prev) => [docId, ...prev.filter((id) => id !== docId)].slice(0, 8));
  };

  const togglePinnedDoc = (docId: string) => {
    const isPinned = pinnedDocIds.includes(docId);
    setPinnedDocIds((prev) => (isPinned ? prev.filter((id) => id !== docId) : [docId, ...prev]));
    showToast(isPinned ? 'تمت الإزالة من المحفوظات' : 'تم الحفظ في المحفوظات', 'info');
  };

  const handleAddComment = () => {
    if (!selectedDoc || !commentInput.trim() || !user) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      userId: user.id,
      text: commentInput.trim(),
      timestamp: new Date().toLocaleString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      userName: user.name || 'أنت',
    };

    setDocComments(prev => ({
      ...prev,
      [selectedDoc.id]: [...(prev[selectedDoc.id] || []), newComment]
    }));
    setCommentInput('');
  };

  const handleDeleteComment = (docId: string, commentId: string) => {
    setDocComments(prev => ({
      ...prev,
      [docId]: prev[docId].filter(c => c.id !== commentId)
    }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (activeTab === 'workspace') setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const newLocalDocs: LawSource[] = files.map(file => ({
        id: `local-${Date.now()}-${file.name}`,
        title: file.name,
        law: 'وثيقة مرفوعة من الجهاز',
        article: 'N/A',
        category: 'مساحة العمل',
        summary: `ملف محلي مرفوع بحجم ${(file.size / 1024 / 1024).toFixed(2)} MB. يمكنك التعليق عليه هنا.`,
        source: '#'
      }));

      setDocs(prev => [...newLocalDocs, ...prev]);
      // Auto-pin uploaded docs to ensure they stay in workspace
      setPinnedDocIds(prev => [...newLocalDocs.map(d => d.id), ...prev]);
      showToast(`تم رفع ${files.length} ملفات بنجاح إلى مساحة العمل`);
    }
  };

  const DocSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="w-full h-32 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
      ))}
    </div>
  );

  const totalArticles = docs.length;
  const totalCategories = categories.length - 1;

  const copyCitation = (doc: LawSource) => {
    const citation = `${doc.title}، ${doc.law}، المادة ${doc.article}`;
    navigator.clipboard.writeText(citation);
    showToast('تم نسخ الاقتباس القانوني');
  };

  const consultAI = (doc: LawSource) => {
    const query = `أحتاج شرحاً قانونياً معمقاً للمادة ${doc.article} من ${doc.law} بخصوص "${doc.title}". ما هي تطبيقاتها العملية؟`;
    navigate('/aichat', { state: { initialQuery: query } });
  };

  const handleExportPdf = async () => {
    if (!selectedDoc) return;

    setIsExportingPdf(true);

    const element = document.createElement('div');
    element.style.padding = '20mm';
    element.style.fontFamily = 'Arial, sans-serif';
    element.style.direction = 'rtl';
    element.style.textAlign = 'right';
    element.style.lineHeight = '1.6';

    element.innerHTML = `
      <h1 style="font-size: 28px; font-weight: bold; color: #1B365D; margin-bottom: 10px;">${selectedDoc.title}</h1>
      <p style="font-size: 16px; color: #4A5568; margin-bottom: 20px;">${selectedDoc.law} • المادة ${selectedDoc.article} (${selectedDoc.category})</p>
      <hr style="border: none; border-top: 1px solid #E2E8F0; margin-bottom: 20px;">
      <h2 style="font-size: 20px; font-weight: bold; color: #1B365D; margin-bottom: 10px;">ملخص المادة</h2>
      <p style="font-size: 15px; color: #4A5568; margin-bottom: 20px;">${selectedDoc.summary}</p>
      <p style="font-size: 13px; color: #718096;">المصدر: <a href="${selectedDoc.source}" style="color: #C5A059; text-decoration: none;">${selectedDoc.source}</a></p>
    `;

    const opt = {
      margin: 10,
      filename: `${selectedDoc.title.replace(/\s/g, '_')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, logging: true, dpi: 192, letterRendering: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
    };

    try {
      await html2pdf().from(element).set(opt).save();
      showToast('تم تصدير الوثيقة كـ PDF بنجاح', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('فشل تصدير الوثيقة كـ PDF', 'info');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getActiveSearchQuery = () => {
    if (activeTab === 'explore') return exploreQuery;
    if (activeTab === 'categories') return categorySearchQuery;
    return workspaceQuery;
  };

  const clearActiveFilters = () => {
    if (activeTab === 'explore') {
      setExploreQuery('');
      setExploreCategoryFilter('all');
      return;
    }
    if (activeTab === 'categories') {
      setCategorySearchQuery('');
      setSelectedCategory('all');
      return;
    }
    setWorkspaceQuery('');
  };

  const activeQuery = getActiveSearchQuery();
  const currentResultCount =
    activeTab === 'explore'
      ? exploreDocs.length
      : activeTab === 'categories'
        ? categoryDocs.length
        : workspaceDocs.length;
  const activeCategoryLabel =
    activeTab === 'explore'
      ? exploreCategoryFilter
      : activeTab === 'categories'
        ? selectedCategory
        : 'workspace';
  const selectedDocComments = selectedDoc ? docComments[selectedDoc.id] || [] : [];

  const renderDocList = (items: LawSource[], emptyMessage: string) => {
    const query = getActiveSearchQuery();
    return (
      <motion.div layout className="space-y-2">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-10 text-center"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-white text-slate-300 shadow-sm">
                <i className="fa-solid fa-magnifying-glass text-xl"></i>
              </div>
              <p className="text-sm font-bold text-slate-500">{emptyMessage}</p>
            </motion.div>
          ) : (
            items.map((doc) => (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group"
              >
                <button
                  type="button"
                  onClick={() => selectDoc(doc.id)}
                  className={`w-full rounded-lg border p-4 text-right transition-all duration-200 ${selectedDoc?.id === doc.id ? 'border-brand-navy bg-brand-navy/[0.03] shadow-sm ring-2 ring-brand-navy/5' : 'border-slate-200 bg-white hover:border-brand-navy/30 hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                        <span className="rounded-md bg-brand-gold/10 px-2 py-1 text-[9px] font-black text-brand-dark">{doc.category}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">المادة {doc.article}</span>
                        {pinnedDocIds.includes(doc.id) && (
                          <span className="rounded-md bg-brand-navy/10 px-2 py-1 text-[9px] font-black text-brand-navy">محفوظ</span>
                        )}
                      </div>
                      <h3 className="line-clamp-2 text-sm font-black leading-6 text-brand-dark transition-colors group-hover:text-brand-navy">
                        <HighlightText text={doc.title} highlight={query} />
                      </h3>
                      <p className="mt-1 truncate text-[11px] font-bold text-slate-400">{doc.law}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500">
                        <HighlightText text={doc.summary} highlight={query} />
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePinnedDoc(doc.id); }}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${pinnedDocIds.includes(doc.id) ? 'bg-brand-navy text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:bg-white hover:text-brand-navy'}`}
                        title={pinnedDocIds.includes(doc.id) ? 'إزالة من المحفوظات' : 'حفظ المرجع'}
                      >
                        <i className="fa-solid fa-bookmark text-xs"></i>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyCitation(doc); }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition-all hover:bg-white hover:text-brand-navy"
                        title="نسخ الاقتباس"
                      >
                        <i className="fa-solid fa-quote-right text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="app-view fade-in min-h-[calc(100vh-140px)] space-y-4 text-right">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-dark">
              <i className="fa-solid fa-gavel text-brand-gold"></i>
              Legal Research
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight text-brand-dark md:text-3xl">قاعدة القوانين العراقية</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              ابحث، صفّي النتائج، احفظ المراجع، وافتح قراءة مركزة للمادة القانونية.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black text-slate-400">المواد</p>
              <p className="mt-1 text-xl font-black text-brand-dark">{totalArticles.toLocaleString('ar-IQ')}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black text-slate-400">الفئات</p>
              <p className="mt-1 text-xl font-black text-brand-dark">{totalCategories.toLocaleString('ar-IQ')}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black text-slate-400">النتائج</p>
              <p className="mt-1 text-xl font-black text-brand-navy">{currentResultCount.toLocaleString('ar-IQ')}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black text-slate-400">محفوظة</p>
              <p className="mt-1 text-xl font-black text-brand-navy">{pinnedDocIds.length.toLocaleString('ar-IQ')}</p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.95fr]">
          <DocSkeleton /> <DocSkeleton />
        </div>
      ) : error ? (
        <EmptyState
          icon="triangle-exclamation"
          title="تعذر تحميل القاعدة القانونية"
          description={error}
          action={<ActionButton variant="secondary" onClick={() => window.location.reload()}>إعادة المحاولة</ActionButton>}
        />
      ) : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">نطاق البحث الحالي</p>
                <p className="mt-1 text-sm font-black text-brand-dark">
                  {activeTab === 'explore' ? 'الاستكشاف' : activeTab === 'categories' ? 'الفئات' : 'مساحة العمل'} • {activeCategoryLabel === 'all' ? 'كل التصنيفات' : activeCategoryLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeQuery.trim() && <span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-500">بحث: {activeQuery.trim()}</span>}
                <span className="rounded-full bg-brand-navy/5 px-3 py-2 text-[10px] font-black text-brand-navy">{currentResultCount.toLocaleString('ar-IQ')} نتيجة</span>
                <button type="button" onClick={clearActiveFilters} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-500 transition hover:border-brand-navy hover:text-brand-navy">مسح النطاق</button>
              </div>
            </div>
          </section>
          <section className="sticky top-[72px] z-20 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur-md transition-all duration-300">
            <div
              role="tablist"
              aria-label="Legal docs sections"
              className="grid grid-cols-1 gap-2 md:grid-cols-3"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`legal-tab-${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`legal-panel-${tab.id}`}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative rounded-lg px-4 py-3 text-right transition-all ${activeTab === tab.id ? 'text-white' : 'text-gray-700 hover:text-brand-dark'}`}
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeLegalTab"
                      className="absolute inset-0 z-0 rounded-lg bg-brand-navy shadow-sm"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <div className="flex items-start gap-3">
                    <div className={`relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${activeTab === tab.id ? 'bg-white/10 text-white' : 'bg-slate-50 text-brand-navy group-hover:bg-brand-navy/5 group-hover:text-brand-navy'}`}>
                      <i className={`fa-solid ${tab.icon} transition-transform group-hover:scale-110`}></i>
                    </div>
                    <div className="min-w-0">
                      <p className="relative z-10 text-sm font-bold">{tab.label}</p>
                      <p className={`relative z-10 mt-1 text-[11px] leading-relaxed ${activeTab === tab.id ? 'text-white/70' : 'text-gray-500'}`}>{tab.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section
            id={`legal-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`legal-tab-${activeTab}`}
            className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-5">
              {activeTab === 'explore' && (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-xl font-black text-brand-dark">استكشاف القاعدة القانونية</h3>
                      <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest">Global Law Search</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
                      <div className="relative min-w-[280px]">
                        <input
                          type="text"
                          value={exploreQuery}
                          onChange={(event) => setExploreQuery(event.target.value)}
                          placeholder="ابحث في العناوين أو المواد..."
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-11 pr-5 text-sm font-bold text-slate-700 outline-none transition-all focus:border-brand-navy focus:bg-white"
                        />
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      </div>
                      <select
                        value={exploreCategoryFilter}
                        onChange={(event) => setExploreCategoryFilter(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-navy lg:w-48"
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category === 'all' ? 'كل التصنيفات' : category}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setExploreCategoryFilter(category)}
                        className={`shrink-0 rounded-lg px-4 py-2 text-xs font-black transition ${exploreCategoryFilter === category ? 'bg-brand-navy text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy hover:bg-white hover:text-brand-navy'}`}
                      >
                        {category === 'all' ? 'كل التصنيفات' : category}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6">{renderDocList(exploreDocs, 'لم يتم العثور على مواد قانونية مطابقة للبحث الحالي.')}</div>
                </div>
              )}

              {activeTab === 'categories' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-xl font-black text-brand-dark">خريطة الفئات القانونية</h3>
                        <p className="mt-1 text-sm font-bold text-slate-400">تصفح القاعدة القانونية حسب التخصص والنوع.</p>
                      </div>
                      <div className="relative min-w-[280px]">
                        <input
                          type="text"
                          value={categorySearchQuery}
                          onChange={(event) => setCategorySearchQuery(event.target.value)}
                          placeholder="ابحث داخل الفئة أو العنوان..."
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-bold outline-none transition-all focus:border-brand-navy"
                        />
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        className={`group relative rounded-lg border p-4 text-right transition-all ${selectedCategory === 'all' ? 'border-brand-navy bg-brand-navy text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy/30 hover:bg-white'}`}
                      >
                        <p className="relative z-10 text-sm font-black">كل الفئات</p>
                        <p className={`relative z-10 mt-2 text-[10px] font-bold ${selectedCategory === 'all' ? 'text-white/60' : 'text-slate-400'}`}>{totalArticles} مادة</p>
                      </button>
                      {categoryStats.map((item) => (
                        <motion.button
                          key={item.category}
                          type="button"
                          onClick={() => setSelectedCategory(item.category)}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -4 }}
                          className={`group relative rounded-lg border p-4 text-right transition-all ${selectedCategory === item.category ? 'border-brand-navy bg-brand-navy text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy/30 hover:bg-white'}`}
                        >
                          <p className="relative z-10 text-sm font-black">{item.category}</p>
                          <p className={`relative z-10 mt-2 text-[10px] font-bold ${selectedCategory === item.category ? 'text-white/60' : 'text-slate-400'}`}>{item.count} مادة</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    {renderDocList(categoryDocs, 'لا توجد مواد ضمن هذه الفئة حالياً.')}
                  </section>
                </div>
              )}

              {activeTab === 'workspace' && (
                <div className="space-y-5">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative">
                      {/* Drag & Drop Overlay */}
                      <AnimatePresence>
                        {isDragging && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[30] flex flex-col items-center justify-center rounded-lg border-4 border-dashed border-brand-gold bg-brand-navy/90 text-white backdrop-blur-sm"
                          >
                            <i className="fa-solid fa-cloud-arrow-up text-4xl mb-4 text-brand-gold"></i>
                            <p className="text-lg font-black">أفلت الملفات هنا لإضافتها للمرجعية</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div>
                        <h3 className="text-xl font-black text-brand-dark">مساحة المراجع الشخصية</h3>
                        <p className="mt-1 text-sm font-bold text-slate-400">احتفظ بالمواد الأكثر استخداماً والعودة السريعة إلى آخر ما قرأته.</p>
                      </div>
                      <div className="relative min-w-[280px]">
                        <input
                          type="text"
                          value={workspaceQuery}
                          onChange={(event) => setWorkspaceQuery(event.target.value)}
                          placeholder="ابحث في محفوظاتك..."
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-11 pr-5 text-sm font-bold outline-none focus:border-brand-navy focus:bg-white"
                        />
                        <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">المواد المثبّتة</p>
                        <p className="mt-2 text-3xl font-black text-brand-navy">{pinnedDocs.length}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">سجل القراءة الأخير</p>
                        <p className="mt-2 text-3xl font-black text-brand-dark">{recentDocs.length}</p>
                      </div>
                    </div>
                  </div>
                  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    {renderDocList(workspaceDocs, 'لا توجد مراجع محفوظة أو حديثة تطابق البحث الحالي.')}
                  </section>
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <div className="sticky top-36 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                {!selectedDoc ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">
                    اختر مادة قانونية من القائمة لعرض التفاصيل هنا.
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedDoc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className="rounded-md bg-brand-gold/10 px-2.5 py-1 text-[10px] font-black text-brand-dark">{selectedDoc.category}</span>
                          {pinnedDocIds.includes(selectedDoc.id) && (
                            <span className="rounded-md bg-brand-navy/10 px-2.5 py-1 text-[10px] font-black text-brand-navy">مرجع محفوظ</span>
                          )}
                        </div>
                        <div className="flex justify-between items-start">
                          <div className="max-w-[80%]">
                            <h3 className="text-2xl font-black leading-tight text-brand-dark">{selectedDoc.title}</h3>
                            <p className="mt-2 text-sm font-bold text-slate-500">{selectedDoc.law} • المادة {selectedDoc.article}</p>
                          </div>
                          <button onClick={() => setIsFullView(true)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition-all hover:bg-slate-50 hover:text-brand-navy" title="تكبير العرض">
                            <i className="fa-solid fa-expand"></i>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => togglePinnedDoc(selectedDoc.id)}
                            className={`flex-1 rounded-lg px-4 py-3 text-xs font-black transition-all ${pinnedDocIds.includes(selectedDoc.id) ? 'bg-brand-navy text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            <i className="fa-solid fa-bookmark ml-2"></i>
                            {pinnedDocIds.includes(selectedDoc.id) ? 'محفوظة' : 'حفظ المرجع'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-2 text-sm">
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500">
                          <i className="fa-solid fa-scale-balanced ml-1.5 opacity-50"></i>
                          {selectedDoc.law}
                        </span>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500">
                          <i className="fa-solid fa-hashtag ml-1.5 opacity-50"></i>
                          المادة {selectedDoc.article}
                        </span>
                      </div>

                      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <i className="fa-solid fa-file-invoice text-brand-gold text-xs"></i>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ملخص المادة</p>
                        </div>
                        <p className="text-sm font-bold leading-7 text-slate-600 text-justify">{selectedDoc.summary}</p>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <ActionButton
                          onClick={() => window.open(selectedDoc.source, '_blank', 'noreferrer')}
                          variant="primary"
                          className="w-full"
                        >
                          عرض المصدر
                        </ActionButton>
                        <div className="grid grid-cols-3 gap-2">
                          <ActionButton
                            type="button"
                            onClick={handleExportPdf}
                            disabled={isExportingPdf}
                            variant="secondary"
                            size="sm"
                            className="w-full"
                          >
                            {isExportingPdf ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-pdf"></i>}
                            PDF
                          </ActionButton>
                          <ActionButton
                            type="button"
                            onClick={() => { setActiveTab('workspace'); togglePinnedDoc(selectedDoc.id); }}
                            variant="secondary"
                            size="sm"
                            className="w-full"
                          >
                            حفظ
                          </ActionButton>
                          <ActionButton
                            type="button"
                            onClick={() => consultAI(selectedDoc)}
                            variant="ghost"
                            size="sm"
                            className="w-full border-brand-gold/20 bg-brand-gold/10 text-brand-dark hover:bg-brand-gold/20"
                          >
                            استشارة AI
                          </ActionButton>
                        </div>
                      </div>

                      {/* Comments Section */}
                      <div className="mt-8 border-t border-gray-100 pt-6">
                        <h4 className="text-base font-black text-brand-dark mb-4 flex items-center gap-2">
                          <i className="fa-solid fa-notes text-brand-navy text-xs"></i>
                          ملاحظاتي الخاصة
                        </h4>

                        <div className="mb-4 max-h-48 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                          {selectedDocComments.length === 0 ? (
                            <p className="text-xs font-bold text-slate-400 italic text-center py-4">لم تضف أي ملاحظات على هذه المادة بعد.</p>
                          ) : (
                            selectedDocComments.map(comment => (
                              <div key={comment.id} className="group/comment relative rounded-lg border border-slate-200 bg-slate-50 p-4 text-right">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[9px] font-black text-brand-navy uppercase tracking-widest">{comment.userName}</span>
                                  <span className="text-[9px] font-bold text-slate-400">{comment.timestamp}</span>
                                </div>
                                <p className="text-xs font-bold text-slate-600 leading-relaxed mt-2">{comment.text}</p>

                                {(isAdmin || comment.userId === user?.id) && (
                                  <button
                                    onClick={() => handleDeleteComment(selectedDoc.id, comment.id)}
                                    className="absolute left-3 top-3 opacity-0 group-hover/comment:opacity-100 transition-opacity text-red-300 hover:text-red-500"
                                  >
                                    <i className="fa-solid fa-trash-can text-[9px]"></i>
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        <div className="relative">
                          <textarea
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            placeholder="اكتب ملاحظة مهنية هنا..."
                            className="min-h-[90px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-4 text-right text-xs font-bold text-slate-700 outline-none transition-all focus:border-brand-navy focus:bg-white"
                          />
                          <ActionButton
                            onClick={handleAddComment}
                            disabled={!commentInput.trim()}
                            variant="primary"
                            size="sm"
                            className="absolute left-3 bottom-3 text-[10px]"
                          >
                            حفظ
                          </ActionButton>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-black text-brand-dark">أدوات الوصول السريع</h3>
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('explore')}
                    className="group flex w-full items-center justify-between rounded-lg bg-slate-50 p-3 text-right transition hover:bg-brand-navy hover:text-white"
                  >
                    <span className="text-xs font-black">البحث الشامل</span>
                    <i className="fa-solid fa-search text-xs opacity-40 group-hover:opacity-100"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('categories')}
                    className="group flex w-full items-center justify-between rounded-lg bg-slate-50 p-3 text-right transition hover:bg-brand-navy hover:text-white"
                  >
                    <span className="text-xs font-black">التصنيفات القانونية</span>
                    <i className="fa-solid fa-table-cells text-xs opacity-40 group-hover:opacity-100"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('workspace')}
                    className="group flex w-full items-center justify-between rounded-lg bg-slate-50 p-3 text-right transition hover:bg-brand-navy hover:text-white"
                  >
                    <span className="text-xs font-black">المواد المحفوظة</span>
                    <i className="fa-solid fa-bookmark text-xs opacity-40 group-hover:opacity-100"></i>
                  </button>
                </div>
              </div>
            </aside>
          </section>
        </>
      )}

      {/* Full Reading View */}
      <AnimatePresence>
        {isFullView && selectedDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] flex items-center justify-center bg-brand-dark/70 p-4 backdrop-blur-md md:p-8"
          >
            <button
              type="button"
              onClick={() => setIsFullView(false)}
              className="absolute inset-0"
              aria-label="إغلاق عرض القراءة"
            />
            <motion.article
              initial={{ y: 24, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 24, scale: 0.98, opacity: 0 }}
              className="relative z-[221] flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            >
              <header className="border-b border-slate-100 bg-slate-50/70 p-5 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setIsFullView(false)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm transition hover:text-red-500"
                  >
                    <i className="fa-solid fa-times"></i>
                  </button>
                  <div className="min-w-0 text-right">
                    <div className="mb-3 flex flex-wrap justify-end gap-2">
                      <span className="rounded-md bg-brand-gold/10 px-2.5 py-1 text-[10px] font-black text-brand-dark">{selectedDoc.category}</span>
                      <span className="rounded-md bg-brand-navy/10 px-2.5 py-1 text-[10px] font-black text-brand-navy">المادة {selectedDoc.article}</span>
                    </div>
                    <h2 className="text-2xl font-black leading-tight text-brand-dark md:text-3xl">{selectedDoc.title}</h2>
                    <p className="mt-2 text-sm font-bold text-slate-500">{selectedDoc.law}</p>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar md:p-8">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ملخص المادة</p>
                  <p className="mt-4 text-base font-bold leading-9 text-slate-700">{selectedDoc.summary}</p>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black text-slate-400">القانون</p>
                    <p className="mt-1 text-sm font-black text-brand-dark">{selectedDoc.law}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black text-slate-400">التصنيف</p>
                    <p className="mt-1 text-sm font-black text-brand-dark">{selectedDoc.category}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black text-slate-400">الملاحظات</p>
                    <p className="mt-1 text-sm font-black text-brand-dark">{selectedDocComments.length.toLocaleString('ar-IQ')}</p>
                  </div>
                </div>
              </div>

              <footer className="border-t border-slate-100 bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ActionButton type="button" onClick={() => copyCitation(selectedDoc)} variant="secondary" className="flex-1">
                    <i className="fa-solid fa-quote-right"></i>
                    نسخ الاقتباس
                  </ActionButton>
                  <ActionButton type="button" onClick={handleExportPdf} disabled={isExportingPdf} variant="ghost" className="flex-1">
                    {isExportingPdf ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-file-pdf"></i>}
                    تصدير PDF
                  </ActionButton>
                  <ActionButton type="button" onClick={() => consultAI(selectedDoc)} variant="primary" className="flex-1">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                    استشارة AI
                  </ActionButton>
                </div>
              </footer>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Feedback System */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 50, opacity: 0, x: '50%' }}
            animate={{ y: 0, opacity: 1, x: '50%' }}
            exit={{ y: 20, opacity: 0, x: '50%' }}
            className="fixed bottom-10 right-1/2 z-[200] -translate-x-1/2"
          >
            <div className={`flex items-center gap-3 rounded-2xl px-6 py-4 text-white shadow-2xl ${toast.type === 'success' ? 'bg-brand-dark' : 'bg-brand-navy'}`}>
              <i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check text-brand-gold' : 'fa-info-circle text-blue-300'}`}></i>
              <p className="text-sm font-bold">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* NotificationToast is now rendered globally by NotificationProvider */}
      {/* NotificationToast is now rendered globally by NotificationProvider, removed local toast */}
    </div>
  );
}
