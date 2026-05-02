import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from '../components/ui/ActionButton';

// Re-using the SignaturePad component logic for consistency
const SignatureArea = ({ onSave, placeholder }: { onSave: (data: string) => void, placeholder: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const getPos = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    };

    const startDrawing = (e: any) => {
        setIsDrawing(true);
        const pos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
            ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1B365D';
        }
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) { ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) onSave(canvas.toDataURL());
    };

    return (
        <div className="relative w-full h-48 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden cursor-crosshair">
            <canvas ref={canvasRef} width={800} height={300} className="w-full h-full touch-none"
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-30">
                <i className="fa-solid fa-pen-nib text-3xl mb-2"></i>
                <p className="text-xs font-bold">وقع هنا: {placeholder}</p>
            </div>
        </div>
    );
};

export default function ExternalSignature() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const role = searchParams.get('role');

    const [draftData, setDraftData] = useState<any>(null);
    const [signature, setSignature] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDraft = async () => {
            try {
                const res = await fetch(`/api/legal/draft-contract/${id}`);
                const json = await res.json();
                if (json.data) setDraftData(json.data);
                else setError('تعذر العثور على العقد المذكور.');
            } catch (err) { setError('فشل الاتصال بالخادم.'); }
        };
        fetchDraft();
    }, [id]);

    const handleSign = async () => {
        if (!signature) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/legal/sign-draft-contract/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signature, name: draftData.buyerName, role })
            });
            if (res.ok) setIsDone(true);
            else setError('فشل إرسال التوقيع.');
        } catch (err) { setError('خطأ في الشبكة.'); }
        finally { setIsSubmitting(false); }
    };

    if (error) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-right">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-md w-full border border-red-100">
                <i className="fa-solid fa-circle-exclamation text-red-500 text-4xl mb-4"></i>
                <h2 className="text-xl font-black text-brand-dark mb-2">عذراً، حدث خطأ</h2>
                <p className="text-sm text-slate-500 font-bold">{error}</p>
            </div>
        </div>
    );

    if (isDone) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-right">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center border border-emerald-100">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                    <i className="fa-solid fa-check-double"></i>
                </div>
                <h2 className="text-2xl font-black text-brand-dark mb-4">تم التوقيع بنجاح!</h2>
                <p className="text-sm text-slate-500 font-bold leading-relaxed mb-8">
                    شكراً لك {draftData?.buyerName}. تم إبلاغ الطرف الأول بتوقيعك، وسيتم معالجة العقد وأرشفته رسمياً الآن. يمكنك إغلاق هذه الصفحة.
                </p>
                <p className="text-[10px] font-black text-brand-navy uppercase tracking-widest">منصة القسطاس الرقمية</p>
            </motion.div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 py-10 px-4 text-right" dir="rtl">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-2xl bg-brand-navy text-brand-gold flex items-center justify-center text-xl shadow-sm">
                            <i className="fa-solid fa-file-signature"></i>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-brand-dark">مراجعة وتوقيع العقد</h1>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">طلب من: {draftData?.sellerName}</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-6">
                        <p className="text-xs font-bold text-amber-800 leading-relaxed">
                            يرجى قراءة بنود العقد أدناه بعناية. توقيعك في أسفل الصفحة يعتبر موافقة قانونية ملزمة على كافة الشروط المذكورة.
                        </p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100 max-h-96 overflow-y-auto custom-scrollbar shadow-inner">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 font-medium">
                            {draftData?.contractText || 'جاري تحميل نص العقد...'}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">توقيع الطرف الثاني (المشتري)</span>
                            <h3 className="text-sm font-black text-brand-dark">ارسم توقيعك بالأسفل</h3>
                        </div>

                        <SignatureArea
                            placeholder={draftData?.buyerName || ''}
                            onSave={setSignature}
                        />

                        <div className="flex flex-col gap-3 pt-6">
                            <ActionButton
                                onClick={handleSign}
                                variant="primary"
                                className="w-full py-4 shadow-lg shadow-brand-navy/20"
                                disabled={!signature || isSubmitting}
                            >
                                {isSubmitting ? <i className="fa-solid fa-spinner fa-spin ml-2"></i> : <i className="fa-solid fa-check-circle ml-2"></i>}
                                {isSubmitting ? 'جاري إرسال التوقيع...' : 'اعتماد التوقيع وإرسال العقد'}
                            </ActionButton>
                            <p className="text-center text-[10px] font-bold text-slate-400">
                                يتم تسجيل بيانات المتصفح والوقت لضمان أمان العملية القانونية.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
}