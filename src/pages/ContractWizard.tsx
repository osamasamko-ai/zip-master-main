import React, { useState } from 'react';
import ActionButton from '../components/ui/ActionButton';
import apiClient from '../api/client'; // Assuming apiClient is available
import html2pdf from 'html2pdf.js'; // For PDF generation

export default function ContractWizard() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        sellerName: '',
        sellerEmail: '',
        buyerName: '',
        buyerEmail: '',
        carModel: '', // نوع وموديل السيارة
        vinNumber: '', // رقم الشاصي
        price: '', // السعر المتفق عليه
    });
    const [generatedContractText, setGeneratedContractText] = useState('');
    const [isLoadingContract, setIsLoadingContract] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isSavingToWallet, setIsSavingToWallet] = useState(false);
    const [contractError, setContractError] = useState('');
    const [sellerSignature, setSellerSignature] = useState('');
    const [buyerSignature, setBuyerSignature] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [emailErrors, setEmailErrors] = useState({ seller: '', buyer: '' });
    const [isPaying, setIsPaying] = useState(false);
    const [isPaid, setIsPaid] = useState(false);

    const totalSteps = 6; // Increased for payment step

    const nextStep = () => setStep(prev => prev + 1);
    const prevStep = () => setStep(prev => prev - 1);

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleGenerateContract = async () => {
        setIsLoadingContract(true);
        setContractError('');
        setGeneratedContractText('');

        try {
            // Simulate API call to AI for contract generation
            // In a real scenario, this would be an actual API call to your backend
            // which then uses a generative AI model (like Gemini)
            // to create the contract text based on formData and Iraqi law dataset.
            const response = await apiClient.generateCarContract(formData);

            setGeneratedContractText(response.contractText);
            nextStep(); // Move to the next step (Contract Review)
        } catch (error: any) {
            console.error('Error generating contract:', error);
            setContractError(error.message || 'حدث خطأ أثناء توليد العقد. يرجى المحاولة مرة أخرى.');
        } finally {
            setIsLoadingContract(false);
        }
    };

    const handleZainCashPayment = async () => {
        setIsPaying(true);
        try {
            // Simulate Zain Cash payment process
            await apiClient.processZainCashPayment(25000, 'srv-5');
            setIsPaid(true);
            nextStep();
        } catch (error: any) {
            setContractError('فشل الدفع عبر زين كاش. يرجى التأكد من رصيدك والمحاولة مرة أخرى.');
        } finally {
            setIsPaying(false);
        }
    };

    const handleFinalizeAndEmail = async () => {
        setIsSendingEmail(true);
        setIsSavingToWallet(true);
        setContractError('');
        try {
            const payload = {
                ...formData,
                contractText: generatedContractText,
                sellerSignature,
                buyerSignature,
            };

            // تنفيذ الإرسال والأرشفة في وقت واحد
            await Promise.all([
                apiClient.emailCarContract(payload),
                apiClient.saveContractToWallet(payload)
            ]);

            nextStep();
        } catch (error: any) {
            console.error('Error in finalization:', error);
            setContractError('تم توقيع العقد، لكن حدث خطأ في الأرشفة أو الإرسال. يمكنك تحميله يدوياً.');
            nextStep(); // ننتقل للخطوة الأخيرة حتى لو فشل الإيميل ليتمكن من التحميل
        } finally {
            setIsSendingEmail(false);
            setIsSavingToWallet(false);
        }
    };

    const handleDownloadPdf = () => {
        if (!generatedContractText) return;

        const element = document.createElement('div');
        element.style.padding = '20mm';
        element.style.fontFamily = 'Arial, sans-serif';
        element.style.direction = 'rtl';
        element.style.textAlign = 'right';
        element.style.lineHeight = '1.6';

        element.innerHTML = `
            <h1 style="font-size: 28px; font-weight: bold; color: #1B365D; margin-bottom: 10px; text-align: center;">عقد بيع وشراء مركبة</h1>
            <p style="font-size: 16px; color: #4A5568; margin-bottom: 20px; text-align: right;">${generatedContractText.replace(/\n/g, '<br>')}</p>
            <p style="font-size: 13px; color: #718096; margin-top: 30px; text-align: center;">تم التوقيع إلكترونياً والموافقة على الشروط أعلاه.</p>
        `;

        const opt = {
            margin: 10,
            filename: `عقد_بيع_مركبة_${formData.sellerName}_${formData.buyerName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, logging: true, dpi: 192, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        };

        html2pdf().from(element).set(opt).save();
    };

    return (
        <div className="app-view p-6 text-right">
            <div className="max-w-2xl mx-auto bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-premium">
                <h2 className="text-2xl font-black text-brand-dark mb-6">إنشاء عقد بيع سيارة ذكي</h2>

                <div className="flex justify-between mb-8 flex-row-reverse">
                    {Array.from({ length: totalSteps }).map((_, index) => (
                        <div key={index} className={`h-2 flex-1 mx-1 rounded-full ${step >= (index + 1) ? 'bg-brand-navy' : 'bg-slate-100'}`} />
                    ))}
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-700 border-b pb-2">بيانات البائع والمشتري</h3>
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-500 mr-2">معلومات البائع</p>
                                <input
                                    placeholder="اسم البائع الكامل"
                                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                                    onChange={e => setFormData({ ...formData, sellerName: e.target.value })}
                                    value={formData.sellerName}
                                />
                                <input
                                    type="email"
                                    placeholder="البريد الإلكتروني للبائع"
                                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                                    onChange={e => setFormData({ ...formData, sellerEmail: e.target.value })}
                                    onBlur={() => {
                                        const isValid = validateEmail(formData.sellerEmail);
                                        setEmailErrors(prev => ({
                                            ...prev,
                                            seller: isValid || !formData.sellerEmail ? '' : 'صيغة البريد الإلكتروني غير صحيحة'
                                        }));
                                    }}
                                    value={formData.sellerEmail}
                                />
                                {emailErrors.seller && <p className="text-rose-500 text-[10px] font-bold mr-2">{emailErrors.seller}</p>}
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-500 mr-2">معلومات المشتري</p>
                                <input
                                    placeholder="اسم المشتري الكامل"
                                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                                    onChange={e => setFormData({ ...formData, buyerName: e.target.value })}
                                    value={formData.buyerName}
                                />
                                <input
                                    type="email"
                                    placeholder="البريد الإلكتروني للمشتري"
                                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                                    onChange={e => setFormData({ ...formData, buyerEmail: e.target.value })}
                                    onBlur={() => {
                                        const isValid = validateEmail(formData.buyerEmail);
                                        setEmailErrors(prev => ({
                                            ...prev,
                                            buyer: isValid || !formData.buyerEmail ? '' : 'صيغة البريد الإلكتروني غير صحيحة'
                                        }));
                                    }}
                                    value={formData.buyerEmail}
                                />
                                {emailErrors.buyer && <p className="text-rose-500 text-[10px] font-bold mr-2">{emailErrors.buyer}</p>}
                            </div>
                        </div>
                        <ActionButton onClick={nextStep} variant="primary" className="w-full" disabled={!formData.sellerEmail || !formData.buyerEmail || !!emailErrors.seller || !!emailErrors.buyer}>التالي</ActionButton>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-700">بيانات المركبة والثمن</h3>
                        <input
                            placeholder="نوع وموديل السيارة"
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                            onChange={e => setFormData({ ...formData, carModel: e.target.value })}
                            value={formData.carModel}
                        />
                        <input
                            placeholder="رقم الشاصي"
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                            onChange={e => setFormData({ ...formData, vinNumber: e.target.value })}
                            value={formData.vinNumber}
                        />
                        <input
                            placeholder="السعر المتفق عليه (بالدينار العراقي)"
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                            value={formData.price}
                        />
                        <div className="flex gap-3">
                            <ActionButton onClick={prevStep} variant="secondary" className="flex-1">رجوع</ActionButton>
                            <ActionButton onClick={handleGenerateContract} variant="primary" className="flex-[2]" disabled={isLoadingContract || !formData.carModel || !formData.vinNumber || !formData.price}>
                                {isLoadingContract ? 'جاري التوليد...' : 'توليد العقد'}
                            </ActionButton>
                        </div>
                        {contractError && <p className="text-red-500 text-sm mt-2">{contractError}</p>}
                    </div>
                )}

                {step === 3 && ( // خطوة مراجعة النص المولد من AI
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-700">مراجعة مسودة العقد</h3>
                        {generatedContractText ? (
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                                {generatedContractText}
                            </div>
                        ) : (
                            <div className="p-10 bg-red-50 rounded-3xl text-red-600 text-center">
                                <i className="fa-solid fa-triangle-exclamation text-5xl mb-4"></i>
                                <p className="font-black">لم يتم توليد العقد!</p>
                                <p className="text-sm">يرجى العودة للخطوة السابقة والمحاولة مرة أخرى.</p>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <ActionButton onClick={prevStep} variant="secondary" className="flex-1">رجوع</ActionButton>
                            <ActionButton onClick={nextStep} variant="primary" className="flex-[2]" disabled={!generatedContractText}>الموافقة والتوقيع</ActionButton>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-700">التوقيع الإلكتروني</h3>
                        <div className="space-y-6 p-4 rounded-2xl border border-slate-200 bg-slate-50">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">توقيع البائع (اسم البائع الكامل)</label>
                                <input
                                    type="text"
                                    placeholder={formData.sellerName}
                                    value={sellerSignature}
                                    onChange={e => setSellerSignature(e.target.value)}
                                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none text-right font-signature"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">توقيع المشتري (اسم المشتري الكامل)</label>
                                <input
                                    type="text"
                                    placeholder={formData.buyerName}
                                    value={buyerSignature}
                                    onChange={e => setBuyerSignature(e.target.value)}
                                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 outline-none text-right font-signature"
                                />
                            </div>
                            <label className="flex items-center justify-end gap-2 cursor-pointer">
                                <span className="text-sm font-bold text-slate-700">أوافق على شروط العقد وأقر بصحة التوقيع الإلكتروني</span>
                                <input
                                    type="checkbox"
                                    checked={agreedToTerms}
                                    onChange={e => setAgreedToTerms(e.target.checked)}
                                    className="h-5 w-5 rounded accent-brand-navy"
                                />
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <ActionButton onClick={prevStep} variant="secondary" className="flex-1">رجوع</ActionButton>
                            <ActionButton onClick={handleFinalizeAndEmail} variant="primary" className="flex-[2]" disabled={!sellerSignature || !buyerSignature || !agreedToTerms || isSendingEmail || isSavingToWallet}>
                                {isSendingEmail || isSavingToWallet ? 'جاري الأرشفة والإرسال...' : 'تأكيد، حفظ وأرشفة'}
                            </ActionButton>
                        </div>
                        {contractError && <p className="text-amber-600 text-xs mt-2 text-center font-bold">{contractError}</p>}
                    </div>
                )}

                {step === 6 && (
                    <div className="text-center space-y-4">
                        <div className="p-10 bg-emerald-50 rounded-3xl text-emerald-600">
                            <i className="fa-solid fa-file-circle-check text-5xl mb-4"></i>
                            <p className="font-black">تم توقيع العقد وأرشفته بنجاح!</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 justify-center mb-4">
                            <i className="fa-solid fa-wallet text-brand-gold"></i>
                            <p className="text-xs font-bold text-slate-600">تمت إضافة نسخة رسمية إلى "محفظة المستندات" الخاصة بك.</p>
                        </div>
                        <p className="text-sm text-slate-500">العقد متاح الآن في ملفك الشخصي أو للتحميل المباشر كـ PDF.</p>
                        <div className="flex gap-3 justify-center">
                            <ActionButton onClick={handleDownloadPdf} variant="primary">تحميل العقد (PDF)</ActionButton>
                            <ActionButton onClick={() => setStep(1)} variant="secondary">إنشاء عقد جديد</ActionButton>
                        </div>
                    </div>
                )}
            </div>
            {/* Add a custom font for signatures if needed, e.g., via a <style> tag or global CSS */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@400;700&display=swap');
                .font-signature {
                    font-family: 'Amatic SC', cursive; /* Example: use a signature-like font */
                    font-size: 2rem;
                    line-height: 1;
                    padding-top: 0.5rem;
                    padding-bottom: 0.5rem;
                }
            `}</style>
        </div>
    );
}