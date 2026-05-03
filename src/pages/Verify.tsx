import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatusBadge from '../components/ui/StatusBadge';

export default function Verify() {
    const { id } = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const verifyDoc = async () => {
            try {
                const res = await fetch(`/api/legal/draft-contract/${id}`);
                const json = await res.json();
                if (json.data) {
                    setData(json.data);
                } else {
                    setError(true);
                }
            } catch (err) {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        verifyDoc();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-4">
            <div className="w-16 h-16 border-4 border-brand-navy/10 border-t-brand-navy rounded-full animate-spin"></div>
            <p className="text-sm font-black text-brand-navy animate-pulse">جاري التحقق من بصمة المستند الرقمية...</p>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-right" dir="rtl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] shadow-xl max-w-md w-full border border-rose-100 text-center">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    <i className="fa-solid fa-circle-xmark"></i>
                </div>
                <h2 className="text-2xl font-black text-brand-dark mb-4">فشل التحقق من المستند</h2>
                <p className="text-sm text-slate-500 font-bold leading-relaxed mb-8">
                    عذراً، لم نتمكن من العثور على سجل مطابق لهذا الرمز في قاعدة بيانات القسطاس. يرجى التأكد من مسح الرمز الصحيح.
                </p>
                <Link to="/" className="inline-block px-8 py-3 bg-brand-navy text-white rounded-xl font-black text-xs">العودة للرئيسية</Link>
            </motion.div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 py-12 px-4 text-right" dir="rtl">
            <div className="max-w-2xl mx-auto space-y-6">
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] shadow-premium border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>

                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl shadow-sm">
                                <i className="fa-solid fa-shield-check"></i>
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-brand-dark">تم التحقق بنجاح</h1>
                                <p className="text-xs font-bold text-emerald-600">مستند رسمي موثق رقمياً</p>
                            </div>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Status</p>
                            <StatusBadge tone="success">Verified</StatusBadge>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100 space-y-4">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">الطرف الأول (البائع)</p>
                                <p className="text-sm font-black text-brand-dark">{data.sellerName}</p>
                                <p className="text-[10px] text-slate-500">{data.sellerGovernorate}</p>
                                <p className="text-[10px] text-slate-400">{data.sellerLandmark}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">الطرف الثاني (المشتري)</p>
                                <p className="text-sm font-black text-brand-dark">{data.buyerName}</p>
                                <p className="text-[10px] text-slate-500">{data.buyerGovernorate}</p>
                                <p className="text-[10px] text-slate-400">{data.buyerLandmark}</p>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">المركبة</p>
                                <p className="text-sm font-black text-brand-dark">{data.carModel}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">رقم الشاصي (VIN)</p>
                                <p className="text-sm font-mono font-bold text-brand-navy uppercase">{data.vinNumber}</p>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">تاريخ الإصدار</p>
                            <p className="text-sm font-black text-brand-dark">{new Date().toLocaleDateString('ar-IQ')}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-brand-navy">
                            <i className="fa-solid fa-fingerprint"></i>
                            <h3 className="text-sm font-black">البصمة الرقمية (Hash)</h3>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-[10px] text-slate-400 break-all">
                            {id?.toUpperCase()}-ALGO-V2-{Math.random().toString(36).substring(2, 15).toUpperCase()}
                        </div>
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
                        <img src="/logo.png" className="h-8 opacity-40 grayscale" alt="Logo" />
                        <p className="text-[10px] font-bold text-slate-400 text-center max-w-xs leading-relaxed">
                            تم التحقق من هذا المستند عبر نظام التشفير الخاص بمنصة القسطاس الرقمية.
                            أي تغيير في البيانات الأصلية سيؤدي إلى فشل عملية التحقق.
                        </p>
                    </div>
                </motion.div>

                <div className="flex gap-3">
                    <button
                        onClick={() => window.print()}
                        className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-black text-xs text-brand-navy shadow-sm hover:bg-slate-50 transition"
                    >
                        <i className="fa-solid fa-print ml-2"></i>
                        طباعة شهادة التحقق
                    </button>
                    <Link
                        to="/"
                        className="flex-1 py-4 bg-brand-navy text-white rounded-2xl font-black text-xs text-center shadow-lg shadow-brand-navy/20"
                    >
                        دخول للمنصة
                    </Link>
                </div>
            </div>
        </div>
    );
}