import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface Source {
  title: string;
  law: string;
  article: string;
  summary: string;
  source: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
  tone?: string;
}

const SUGGESTED_PROMPTS = [
  "ما هي عقوبة التزوير في القانون العراقي؟",
  "كيفية تأسيس شركة محدودة في بغداد؟",
  "حقوق المستأجر في العقارات التجارية",
  "إجراءات تسجيل العلامة التجارية"
];

export default function AIChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tone, setTone] = useState<'formal' | 'simple' | 'friendly'>('formal');
  const [activeSources, setActiveSources] = useState<Source[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle initial query from dashboard/cases
  useEffect(() => {
    const state = location.state as { initialQuery?: string };
    if (state?.initialQuery) {
      handleSend(state.initialQuery);
    }
  }, [location.state]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/legal/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          tone,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
        tone: tone,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col bg-slate-50 overflow-hidden rounded-[2.5rem] border border-slate-200 shadow-premium text-right">
      {/* Chat Header */}
      <header className="z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="group h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-brand-navy/5 hover:text-brand-navy transition-all"
          >
            <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المساعد الذكي</span>
              <i className="fa-solid fa-chevron-left text-[8px] text-slate-300"></i>
              <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest">جلسة استشارية</span>
            </div>
            <h2 className="text-lg font-black text-brand-dark flex items-center gap-2">
              القسطاس الرقمي
              {isLoading ? (
                <span className="text-[10px] font-bold text-brand-navy bg-brand-navy/5 px-2 py-0.5 rounded-md animate-pulse">جاري التحليل...</span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> متصل
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 shadow-inner">
            {[
              { id: 'formal', label: 'رسمي', icon: 'fa-gavel' },
              { id: 'simple', label: 'بسيط', icon: 'fa-lightbulb' },
              { id: 'friendly', label: 'ودي', icon: 'fa-handshake' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id as any)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-black transition-all ${tone === t.id ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-brand-dark'}`}
              >
                <i className={`fa-solid ${t.icon} text-[10px]`}></i>
                {t.label}
              </button>
            ))}
          </div>
          <div className="h-8 w-px bg-slate-100 mx-1"></div>
          <div className="flex items-center gap-2">
            <button
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-brand-navy hover:shadow-md transition-all"
              title="مشاركة المحادثة"
            >
              <i className="fa-solid fa-share-nodes"></i>
            </button>
            <button
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-brand-navy hover:shadow-md transition-all"
              title="تنزيل كـ PDF"
            >
              <i className="fa-solid fa-file-pdf"></i>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <main className="flex flex-1 flex-col overflow-hidden bg-white/50 backdrop-blur-sm relative">
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-md mx-auto">
                <div className="w-20 h-20 bg-brand-navy/5 rounded-[2rem] flex items-center justify-center text-brand-navy text-3xl">
                  <i className="fa-solid fa-robot animate-bounce"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-brand-dark">كيف يمكنني مساعدتك قانونياً اليوم؟</h3>
                  <p className="text-sm text-slate-500 mt-2 font-bold leading-relaxed">اسأل عن أي مادة قانونية عراقية، أو اطلب تلخيصاً لقضيتك الحالية.</p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full">
                  {SUGGESTED_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => handleSend(p)}
                      className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-brand-gold hover:shadow-md transition text-sm font-bold text-slate-600"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center text-sm shadow-sm ${msg.role === 'user' ? 'bg-brand-navy text-white' : 'bg-brand-gold text-brand-dark'}`}>
                  <i className={`fa-solid ${msg.role === 'user' ? 'fa-user' : 'fa-gavel'}`}></i>
                </div>
                <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'text-left' : 'text-right'}`}>
                  <div className={`p-5 rounded-[2rem] shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-brand-navy text-white rounded-tl-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tr-none'}`}>
                    <div className="prose prose-slate prose-sm max-w-none prose-headings:font-black prose-headings:text-brand-dark">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => setActiveSources(msg.sources!)}
                          className="text-[10px] font-black bg-slate-50 text-brand-navy px-3 py-1.5 rounded-lg border border-slate-100 hover:bg-brand-navy hover:text-white transition"
                        >
                          <i className="fa-solid fa-book-bookmark ml-1"></i>
                          عرض {msg.sources.length} مراجع قانونية
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase px-2">{msg.timestamp.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-2xl bg-brand-gold/20 text-brand-gold flex items-center justify-center shadow-sm">
                  <i className="fa-solid fa-brain fa-pulse"></i>
                </div>
                <div className="bg-white border border-slate-100 p-5 rounded-[2rem] rounded-tr-none shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-brand-gold rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white border-t border-slate-100">
            <div className="max-w-4xl mx-auto relative">
              <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-[2rem] p-2 focus-within:bg-white focus-within:border-brand-navy focus-within:ring-4 focus-within:ring-brand-navy/5 transition-all">
                <button className="h-12 w-12 flex items-center justify-center rounded-2xl text-slate-400 hover:text-brand-navy transition">
                  <i className="fa-solid fa-paperclip text-lg"></i>
                </button>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="اسأل المساعد القانوني عن القوانين، العقود، أو الإجراءات..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 py-3.5 resize-none max-h-40 min-h-[52px] text-right"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="h-12 w-12 bg-brand-navy text-white rounded-2xl shadow-lg shadow-brand-navy/20 hover:bg-brand-dark transition disabled:opacity-30 flex items-center justify-center"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </div>
              <p className="mt-3 text-center text-[10px] font-bold text-slate-400">الذكاء الاصطناعي قد يخطئ، يرجى مراجعة المراجع القانونية المرفقة دائماً.</p>
            </div>
          </div>
        </main>

        {/* Context Sidebar (Sources) */}
        <AnimatePresence>
          {activeSources && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-slate-100 bg-white flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <button
                  onClick={() => setActiveSources(null)}
                  className="text-slate-400 hover:text-red-500 transition"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
                <h3 className="text-sm font-black text-brand-dark">المراجع القانونية المعتمدة</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {activeSources.map((s, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-brand-gold transition-colors group">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-white px-2 py-1 rounded-lg text-[9px] font-black text-brand-navy border border-slate-100">مرجع [{i + 1}]</span>
                      <div className="text-right">
                        <h4 className="text-xs font-black text-brand-dark group-hover:text-brand-navy transition-colors">{s.title}</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">{s.law} • مادة {s.article}</p>
                      </div>
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed text-right line-clamp-4">{s.summary}</p>
                    <a
                      href={s.source}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block text-center py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-brand-navy hover:bg-brand-navy hover:text-white transition"
                    >
                      فتح المصدر الرسمي
                    </a>
                  </div>
                ))}
              </div>
              <div className="p-6 bg-brand-gold/5 border-t border-brand-gold/10">
                <p className="text-[10px] font-bold text-brand-dark leading-relaxed text-center">
                  يتم استرجاع هذه النصوص آلياً من قاعدة البيانات الرسمية للقوانين العراقية.
                </p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      {/* NotificationToast is now rendered globally by NotificationProvider */}

      <style>{`
        .grad-ai {
          background: linear-gradient(135deg, #1B365D 0%, #0d2a59 100%);
        }
        .prose pre {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          padding: 1rem;
          direction: ltr;
        }
        .prose code {
          color: #1e293b;
          background: #f1f5f9;
          padding: 0.2rem 0.4rem;
          border-radius: 0.4rem;
          font-family: monospace;
        }
        .prose ul, .prose ol {
          padding-right: 1.5rem;
          padding-left: 0;
        }
        .prose li {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
