import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ActionButton from '../components/ui/ActionButton';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-[85vh] flex items-center justify-center p-6 text-right" dir="rtl">
            <div className="max-w-2xl w-full text-center space-y-12">
                {/* Visual 404 Header */}
                <div className="relative inline-block">
                    <motion.h1
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10rem] md:text-[14rem] font-black leading-none text-brand-navy opacity-[0.03] select-none"
                    >
                        404
                    </motion.h1>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-[2.5rem] flex items-center justify-center text-4xl md:text-5xl text-brand-gold shadow-premium border border-slate-100 mb-4"
                        >
                            <i className="fa-solid fa-gavel"></i>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="bg-brand-navy text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-navy/20"
                        >
                            Error: Out of Jurisdiction
                        </motion.div>
                    </div>
                </div>

                {/* Message Content */}
                <div className="space-y-4">
                    <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="text-3xl font-black text-brand-dark"
                    >
                        عذراً، الصفحة التي تبحث عنها غير موجودة
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="text-slate-500 font-bold max-w-md mx-auto leading-7"
                    >
                        يبدو أنك سلكت مساراً قانونياً غير صحيح. قد يكون الرابط قد انتهت صلاحيته أو تم نقله إلى قسم آخر في المنصة.
                    </motion.p>
                </div>

                {/* Smart UX Suggestions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right"
                >
                    {[
                        { title: 'قضاياي وملفاتي', desc: 'الوصول إلى وثائقك ومعاملاتك الحالية', icon: 'fa-folder-tree', link: '/cases', color: 'text-brand-navy', bg: 'bg-brand-navy/5' },
                        { title: 'المستشار الذكي', desc: 'احصل على إجابات قانونية فورية', icon: 'fa-wand-magic-sparkles', link: '/aichat', color: 'text-brand-gold', bg: 'bg-brand-gold/5' },
                        { title: 'مركز الرسائل', desc: 'تواصل مباشرة مع المحامين والخبراء', icon: 'fa-comments', link: '/messages', color: 'text-blue-500', bg: 'bg-blue-50' },
                        { title: 'الدعم الفني', desc: 'هل تحتاج مساعدة في الوصول لشيء ما؟', icon: 'fa-headset', link: '/support', color: 'text-rose-500', bg: 'bg-rose-50' }
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => navigate(item.link)}
                            className="p-5 rounded-[2rem] border border-slate-200 bg-white hover:border-brand-navy hover:shadow-xl transition-all cursor-pointer group flex flex-row-reverse items-center gap-4"
                        >
                            <div className={`w-12 h-12 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center text-xl group-hover:scale-110 transition-transform`}>
                                <i className={`fa-solid ${item.icon}`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-brand-dark group-hover:text-brand-navy transition-colors">{item.title}</p>
                                <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Main Actions */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                >
                    <ActionButton onClick={() => navigate('/')} variant="primary" className="min-w-[220px] py-4 shadow-lg shadow-brand-navy/20">
                        العودة للرئيسية
                    </ActionButton>
                    <button
                        onClick={() => window.history.back()}
                        className="px-8 py-4 rounded-2xl text-sm font-black text-slate-400 hover:text-brand-navy hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                        الرجوع للخلف
                    </button>
                </motion.div>
            </div>
            <style>{`
        .shadow-premium { box-shadow: 0 20px 50px rgba(27, 54, 93, 0.08); }
      `}</style>
        </div>
    );
}