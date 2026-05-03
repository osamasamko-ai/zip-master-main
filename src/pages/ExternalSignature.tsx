import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from '../components/ui/ActionButton';
import html2pdf from 'html2pdf.js';
import apiClient from '../api/client';

// Re-using the SignaturePad component logic for consistency
const SignatureArea = ({ onSave, placeholder, nameValue }: { onSave: (data: string) => void, placeholder: string, nameValue: string }) => {
    const [mode, setMode] = useState<'draw' | 'type'>('draw');
    const [color, setColor] = useState('#1B365D');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const typedCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);

    // Drawing logic
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
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.strokeStyle = color;
            setHasSigned(true);
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
        if (canvas) {
            onSave(canvas.toDataURL());
        }
    };

    const handleTypeSignature = () => {
        const canvas = typedCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "italic 60px 'Amatic SC', cursive";
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nameValue || placeholder, canvas.width / 2, canvas.height / 2);

        onSave(canvas.toDataURL());
        setHasSigned(true);
    };

    useEffect(() => {
        if (mode === 'type') {
            handleTypeSignature();
        }
    }, [mode, color, nameValue]);

    const clearAll = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        onSave('');
        setHasSigned(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <div className="flex gap-2 p-1 bg-white rounded-xl shadow-sm border border-slate-100">
                    <button onClick={() => setColor('#1B365D')} className={`w-8 h-8 rounded-lg transition-all ${color === '#1B365D' ? 'ring-2 ring-brand-gold scale-90' : 'opacity-60'}`} style={{ backgroundColor: '#1B365D' }} title="أزرق ملكي" />
                    <button onClick={() => setColor('#000000')} className={`w-8 h-8 rounded-lg transition-all ${color === '#000000' ? 'ring-2 ring-brand-gold scale-90' : 'opacity-60'}`} style={{ backgroundColor: '#000000' }} title="أسود" />
                </div>

                <div className="flex gap-1.5 bg-slate-200/50 p-1 rounded-xl">
                    <button
                        onClick={() => { setMode('type'); clearAll(); }}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'type' ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        توقيع مطبوع
                    </button>
                    <button
                        onClick={() => { setMode('draw'); clearAll(); }}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'draw' ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        توقيع يدوي
                    </button>
                </div>
            </div>

            <div className="relative w-full h-48 bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-inner group/sig">
                {mode === 'draw' ? (
                    <canvas ref={canvasRef} width={1000} height={350} className="w-full h-full touch-none cursor-crosshair"
                        onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/20">
                        <canvas ref={typedCanvasRef} width={1000} height={350} className="hidden" />
                        <p className="font-signature text-5xl md:text-6xl select-none transition-all duration-300 transform scale-in-center" style={{ color }}>
                            {nameValue || placeholder}
                        </p>
                        <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">معاينة حية للتوقيع المعتمد</p>
                    </div>
                )}

                {!hasSigned && mode === 'draw' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                        <i className="fa-solid fa-signature text-5xl mb-2"></i>
                        <p className="text-xs font-bold uppercase tracking-widest">وقع هنا باللمس أو الماوس</p>
                    </div>
                )}

                {hasSigned && (
                    <button
                        onClick={(e) => { e.preventDefault(); clearAll(); }}
                        className="absolute bottom-3 left-3 h-10 w-10 rounded-xl bg-white/90 text-rose-500 shadow-lg border border-slate-100 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover/sig:opacity-100"
                        title="مسح التوقيع"
                    >
                        <i className="fa-solid fa-eraser"></i>
                    </button>
                )}
            </div>
        </div>
    );
};

const SelfieCapture = ({ onCapture, value }: { onCapture: (img: string) => void, value: string | null }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            setStream(s);
            if (videoRef.current) videoRef.current.srcObject = s;
            setIsCameraActive(true);
        } catch (err) {
            alert('فشل الوصول للكاميرا. يرجى التأكد من منح الصلاحيات للمتصفح.');
        }
    };

    const stopCamera = () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsCameraActive(false);
    };

    const takePhoto = () => {
        const canvas = document.createElement('canvas');
        if (videoRef.current) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.scale(-1, 1); // Mirror for selfie
                ctx.drawImage(videoRef.current, -canvas.width, 0);
                onCapture(canvas.toDataURL('image/jpeg', 0.7));
            }
            stopCamera();
        }
    };

    return (
        <div className="space-y-4">
            {!value && !isCameraActive && (
                <button onClick={startCamera} className="w-full py-4 border-2 border-dashed border-brand-navy/30 rounded-3xl text-brand-navy font-black text-xs hover:bg-brand-navy/5 transition flex items-center justify-center gap-2 group">
                    <i className="fa-solid fa-camera group-hover:scale-110 transition-transform"></i>
                    التقاط صورة سيلفي للتحقق من الشخصية
                </button>
            )}

            {isCameraActive && (
                <div className="relative rounded-[2.5rem] overflow-hidden bg-black aspect-square max-w-[280px] mx-auto shadow-2xl border-4 border-white">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                        <button onClick={stopCamera} className="h-10 w-10 rounded-full bg-white/20 text-white backdrop-blur-md flex items-center justify-center hover:bg-white/40 transition"><i className="fa-solid fa-times"></i></button>
                        <button onClick={takePhoto} className="h-14 w-14 rounded-full bg-white text-brand-navy shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"><i className="fa-solid fa-camera text-2xl"></i></button>
                    </div>
                </div>
            )}

            {value && (
                <div className="relative max-w-[240px] mx-auto group">
                    <img src={value} className="w-full rounded-3xl shadow-xl border-4 border-white" alt="Selfie" />
                    <button onClick={() => onCapture('')} className="absolute top-2 left-2 h-9 w-9 rounded-xl bg-white/90 text-rose-500 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-lg flex items-center gap-2 whitespace-nowrap">
                        <i className="fa-solid fa-check-double"></i>
                        تم التحقق بالصورة
                    </div>
                </div>
            )}
        </div>
    );
};



export default function ExternalSignature() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const role = searchParams.get('role');

    const [draftData, setDraftData] = useState<any>(null);
    const [signature, setSignature] = useState('');
    const [selfie, setSelfie] = useState<string | null>(null);
    const [finalPdfUrl, setFinalPdfUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState(false);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                },
                () => setLocationError(true)
            );
        }
    }, []);

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
        setError('');

        try {
            // 1. بناء هيكل العقد للـ PDF (يتضمن التواقيع والصورة)
            const element = document.createElement('div');
            element.style.padding = '20mm';
            element.style.fontFamily = 'Arial, sans-serif';
            element.style.direction = 'rtl';
            element.style.textAlign = 'right';
            element.style.lineHeight = '1.6';
            element.style.position = 'relative';
            element.style.overflow = 'hidden';

            element.innerHTML = `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; font-weight: 900; color: #1B365D; opacity: 0.04; white-space: nowrap; pointer-events: none; z-index: 0; user-select: none;">
                    منصة القسطاس الرقمية
                </div>
                <h1 style="position: relative; z-index: 1; font-size: 26px; font-weight: bold; color: #1B365D; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #f1f5f9; pb: 15px;">عقد بيع وشراء مركبة رقمي</h1>
                <div style="position: relative; z-index: 1; font-size: 14px; color: #334155; margin-bottom: 30px; text-align: justify; white-space: pre-wrap;">
                    ${draftData.contractText}
                </div>
                <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; margin-top: 40px; direction: rtl;">
                    <div style="text-align: center; width: 45%;">
                        <p style="font-weight: bold; font-size: 13px; margin-bottom: 10px; color: #1e293b;">توقيع الطرف الأول (البائع):</p>
                        ${draftData.sellerSignature ? `<img src="${draftData.sellerSignature}" style="max-width: 140px; height: auto; border-bottom: 1px solid #e2e8f0;" />` : '<div style="height: 50px; border-bottom: 1px solid #eee;"></div>'}
                        <p style="font-size: 11px; color: #64748b; margin-top: 5px;">${draftData.sellerName || 'غير محدد'}</p>
                        <p style="font-size: 9px; color: #94a3b8;">${draftData.sellerAddress}</p>
                    </div>
                    <div style="text-align: center; width: 45%;">
                        <p style="font-weight: bold; font-size: 13px; margin-bottom: 10px; color: #1e293b;">توقيع الطرف الثاني (المشتري):</p>
                        <img src="${signature}" style="max-width: 140px; height: auto; border-bottom: 1px solid #e2e8f0;" />
                        <p style="font-size: 11px; color: #64748b; margin-top: 5px;">${draftData.buyerName}</p>
                        <p style="font-size: 9px; color: #94a3b8;">${draftData.buyerAddress}</p>
                    </div> 
                </div>
                ${selfie ? `
                <div style="position: relative; z-index: 1; margin-top: 30px; text-align: center; border: 1px solid #f1f5f9; padding: 15px; border-radius: 15px; background-color: #f8fafc;">
                    <p style="font-size: 9px; font-weight: bold; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase;">صورة التحقق الرقمي</p>
                    <img src="${selfie}" style="width: 100px; height: 100px; border-radius: 50px; object-fit: cover; border: 3px solid white;" />
                </div>
                ` : ''}

                <div style="position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 30px; border: 1px solid #f1f5f9; padding: 12px; border-radius: 15px; background: #fff; direction: rtl;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.origin + '/verify/' + id)}" style="width: 70px; height: 70px;" />
                    <div style="text-align: right;">
                        <p style="font-size: 10px; font-weight: bold; color: #1B365D; margin: 0;">نظام التحقق الرقمي (Digital Verification)</p>
                        <p style="font-size: 9px; color: #64748b; margin: 4px 0 0 0;">هذا المستند موثق رقمياً. يمكن التحقق من سلامة البيانات عبر مسح رمز QR أعلاه.</p>
                        <div style="margin-top: 6px; display: flex; gap: 10px;">
                            <span style="font-size: 8px; color: #94a3b8; font-family: monospace;">HASH: ${id?.substring(0, 16).toUpperCase()}</span>
                            <span style="font-size: 8px; color: #94a3b8; font-family: monospace;">VER: 2.0.2</span>
                        </div>
                    </div>
                </div>

                <div style="position: relative; z-index: 1; margin-top: 40px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                    <p style="font-size: 9px; color: #94a3b8;">تم إصدار وتوقيع هذا المستند إلكترونياً عبر منصة القسطاس.</p>
                    <p style="font-size: 8px; color: #cbd5e1; font-family: monospace;">Draft ID: ${id} | IP Verified | Time: ${new Date().toLocaleString('ar-IQ')}</p>
                </div>
            `;

            const opt = {
                margin: 10,
                filename: `final_contract_${id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // 2. توليد الـ PDF كـ Blob ورفعه للخادم
            const pdfBlob = await html2pdf().from(element).set(opt).output('blob');
            const uploadRes = await apiClient.uploadContractPdf(pdfBlob);
            const pdfUrl = uploadRes.data.url;

            // 3. إرسال بيانات التوقيع مع رابط الملف النهائي
            const res = await fetch(`/api/legal/sign-draft-contract/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signature,
                    selfie,
                    name: draftData.buyerName,
                    role,
                    location,
                    pdfUrl
                })
            });

            if (res.ok) {
                setFinalPdfUrl(pdfUrl);
                setIsDone(true);
            }
            else setError('فشل إرسال التوقيع.');
        } catch (err) { setError('خطأ في الشبكة.'); }
        finally { setIsSubmitting(false); }
    };

    const handleSendEmail = async () => {
        if (!email || !finalPdfUrl) return;
        setIsSendingEmail(true);
        try {
            const res = await fetch('/api/legal/email-contract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, pdfUrl: finalPdfUrl, name: data.buyerName })
            });
            if (res.ok) {
                setEmailSent(true);
                setTimeout(() => setEmailSent(false), 5000);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSendingEmail(false);
        }
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
                {finalPdfUrl && (
                    <div className="mb-8">
                        <ActionButton onClick={() => window.open(finalPdfUrl, '_blank')} variant="primary" className="w-full py-4 shadow-lg shadow-brand-navy/20">
                            <i className="fa-solid fa-file-pdf ml-2"></i>
                            تحميل نسختك من العقد (PDF)
                        </ActionButton>
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-100 text-right">
                    <p className="text-xs font-black text-brand-dark mb-4">إرسال نسخة إلى بريدك الإلكتروني</p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSendEmail}
                            disabled={isSendingEmail || !email || emailSent}
                            className={`px-6 rounded-xl font-black text-xs transition-all ${emailSent ? 'bg-emerald-500 text-white' : 'bg-brand-navy text-white hover:bg-brand-dark disabled:opacity-50'}`}
                        >
                            {isSendingEmail ? (
                                <i className="fa-solid fa-spinner fa-spin"></i>
                            ) : emailSent ? (
                                <i className="fa-solid fa-check"></i>
                            ) : (
                                'إرسال'
                            )}
                        </button>
                        <input
                            type="email"
                            placeholder="example@mail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            dir="ltr"
                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-brand-navy focus:bg-white transition-all"
                        />
                    </div>
                    {emailSent && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-bold text-emerald-600 mt-2 mr-1">
                            تم إرسال الرابط بنجاح! يرجى تفقد صندوق الوارد.
                        </motion.p>
                    )}
                </div>

                <p className="text-[10px] font-black text-brand-navy uppercase tracking-widest">منصة القسطاس الرقمية</p>
            </motion.div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-100 py-10 px-4 text-right" dir="rtl">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-14 w-14 rounded-3xl bg-brand-navy text-brand-gold flex items-center justify-center text-2xl shadow-lg">
                            <i className="fa-solid fa-file-signature"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-brand-dark">مراجعة وتوقيع العقد الرقمي</h1>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-tighter">طلب من: {draftData?.sellerName}</p>
                        </div>
                    </div>

                    <div className="bg-brand-navy/5 border border-brand-navy/10 p-5 rounded-3xl mb-8 flex items-start gap-4">
                        <i className="fa-solid fa-circle-info text-brand-navy mt-1"></i>
                        <p className="text-xs font-bold text-brand-navy/80 leading-relaxed">
                            يرجى قراءة بنود العقد أدناه بعناية. توقيعك في أسفل الصفحة يعتبر موافقة قانونية ملزمة على كافة الشروط المذكورة.
                        </p>
                    </div>

                    {/* Paper Mode Contract Display */}
                    <div className="bg-white shadow-2xl mx-auto w-full max-w-[210mm] border border-slate-200 relative overflow-hidden mb-12 p-8 md:p-16">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 -rotate-45 translate-x-16 -translate-y-16 border-b border-brand-gold/10"></div>

                        <header className="mb-12 text-center border-b-2 border-slate-100 pb-10">
                            <h2 className="text-3xl font-black text-brand-dark">عقد بيع وشراء مركبة</h2>
                            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.3em]">Official Legal Document</p>
                        </header>

                        <div className="whitespace-pre-wrap text-[16px] leading-[1.8] text-slate-800 font-serif text-justify">
                            {draftData?.contractText || 'جاري تحميل تفاصيل العقد...'}
                        </div>

                        <div className="mt-24 flex justify-between items-end">
                            <div className="w-40 h-40 rounded-full border-4 border-dashed border-brand-navy/5 flex items-center justify-center text-[11px] font-black text-brand-navy/10 -rotate-12 select-none">
                                ختم المنصة الرقمي
                            </div>
                            <div className="text-left">
                                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Document Hash</p>
                                <p className="text-[8px] font-mono text-slate-300">LXG-{id?.substring(0, 12)}</p>
                            </div>
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
                            nameValue={draftData?.buyerName || ''}
                        />

                        <div className="mt-8 pt-8 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إثبات الشخصية (سيلفي)</span>
                                <h3 className="text-sm font-black text-brand-dark">التقط صورة للوجه</h3>
                            </div>
                            <SelfieCapture onCapture={setSelfie} value={selfie} />
                        </div>

                        {/* Geolocation Map Section */}
                        <div className="mt-12 pt-8 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-4 text-emerald-600">
                                <i className="fa-solid fa-shield-halved"></i>
                                <h4 className="text-xs font-black uppercase tracking-widest">توثيق الموقع الجغرافي للموثوقية القانونية</h4>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden h-40 relative">
                                {location ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.01},${location.lat - 0.01},${location.lng + 0.01},${location.lat + 0.01}&layer=mapnik&marker=${location.lat},${location.lng}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                                        <i className={`fa-solid ${locationError ? 'fa-location-dot-slash' : 'fa-location-crosshairs fa-spin'} text-2xl mb-2`}></i>
                                        <p className="text-[10px] font-bold leading-relaxed">{locationError ? 'يرجى تفعيل صلاحية الوصول للموقع لزيادة قوة العقد القانونية.' : 'جاري تحديد موقع التوقيع لتوثيقه...'}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-6">
                            <ActionButton
                                onClick={handleSign}
                                variant="primary"
                                className="w-full py-4 shadow-lg shadow-brand-navy/20"
                                disabled={!signature || !selfie || isSubmitting}
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
                @import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@400;700&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Arabic:wght@400;700&display=swap');
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .font-serif {
                    font-family: 'Noto Serif Arabic', serif;
                }
                .font-signature {
                    font-family: 'Amatic SC', cursive;
                    line-height: 1;
                }
                .scale-in-center { animation: scale-in-center 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both; }
                @keyframes scale-in-center { 0% { transform: scale(0); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
}