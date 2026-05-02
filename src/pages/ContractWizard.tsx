import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ActionButton from '../components/ui/ActionButton';
import apiClient from '../api/client';
import html2pdf from 'html2pdf.js';
import { motion, AnimatePresence } from 'framer-motion';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CONTRACT_TEMPLATES = [
    {
        id: 'used_car',
        label: 'عقد بيع سيارة مستعملة',
        description: 'لبيع وشراء السيارات المستعملة مع بنود الضمان والفحص.',
        icon: 'fa-solid fa-car-rear',
        initialFormData: {
            carModel: 'سيارة مستعملة - [الموديل]',
            customClauses: 'يقر المشتري بأنه عاين المركبة معاينة نافية للجهالة وقبلها بحالتها الراهنة.',
        },
        initialSelectedClauses: ['engine_warranty', 'traffic_test'],
        previewText: `عقد بيع وشراء مركبة مستعملة

هذا القالب مخصص لعمليات بيع السيارات المستعملة بين الأفراد. يتضمن بنوداً قانونية تحمي الطرفين من خلال:
- إقرار المشتري بمعاينة المركبة.
- تحديد مسؤولية الغرامات السابقة.
- إمكانية إضافة ضمانات للمحرك والجير.
- الالتزام بنقل الملكية في دائرة المرور.

ملاحظة: سيتم توليد النص القانوني الكامل بعد إدخال بيانات الأطراف والمركبة.`
    },
    {
        id: 'new_car',
        label: 'عقد بيع سيارة جديدة',
        description: 'لبيع السيارات الجديدة من الوكالات أو المعارض مع بنود التسليم.',
        icon: 'fa-solid fa-car-side',
        initialFormData: {
            carModel: 'سيارة جديدة - [الموديل]',
            customClauses: 'يقر البائع بأن المركبة لم تستخدم من قبل وهي بحالة المصنع.',
        },
        initialSelectedClauses: [],
        previewText: `عقد بيع وشراء مركبة جديدة

هذا القالب مخصص للسيارات التي لم يسبق تسجيلها أو السيارات بحالة المصنع:
- يركز على خلو المركبة من العيوب الاستخدامية.
- يتضمن إقرارات البائع بجاهزية المستندات الجمركية.
- يسهل إجراءات التسليم والضمان المصنعي.`
    },
    {
        id: 'scrap_car',
        label: 'عقد بيع سيارة خردة',
        description: 'لبيع السيارات التالفة أو التي لا تصلح للاستخدام على الطريق.',
        icon: 'fa-solid fa-car-burst',
        initialFormData: { carModel: 'سيارة خردة - [الموديل]', customClauses: 'يقر المشتري بأن المركبة مباعة كخردة ولا تصلح للاستخدام على الطريق، ويتحمل مسؤولية نقلها وتصريفها.' },
        initialSelectedClauses: [],
        previewText: `عقد بيع مركبة (سكراب/خردة)

هذا القالب مخصص للمركبات غير الصالحة للسير:
- إخلاء مسؤولية البائع من حالة المحرك أو الهيكل.
- إقرار المشتري بأن البيع لغرض التفصيص أو السكراب.
- بنود واضحة حول عدم أحقية المطالبة بالتعويض بعد الاستلام.`
    },
];

const SignaturePad = ({ onSave, value, placeholder, onClear }: { onSave: (data: string) => void, value: string, placeholder: string, onClear: () => void }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, []);

    useEffect(() => {
        if (!value) clearCanvas();
    }, [value, clearCanvas]);

    const getPos = (e: React.MouseEvent | React.TouchEvent | any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const pos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#1B365D';
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            onSave(canvas.toDataURL());
        }
    };

    return (
        <div className="relative w-full h-40 bg-white rounded-2xl border border-slate-200 overflow-hidden cursor-crosshair shadow-inner group/sig">
            <canvas
                ref={canvasRef}
                width={1000}
                height={250}
                className="w-full h-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            {!value && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                    <i className="fa-solid fa-signature text-4xl mb-2 text-slate-200"></i>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">وقع هنا: {placeholder}</p>
                </div>
            )}
            {value && (
                <>
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 animate-in fade-in zoom-in duration-300">
                        <i className="fa-solid fa-circle-check text-emerald-500 text-[10px]"></i>
                        <span className="text-[9px] font-black text-emerald-600 uppercase">تم التوقيع</span>
                    </div>
                    <button
                        onClick={(e) => { e.preventDefault(); onClear(); }}
                        className="absolute bottom-2 left-2 h-9 w-9 rounded-xl bg-white/90 text-rose-500 shadow-lg border border-slate-100 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover/sig:opacity-100 active:scale-90"
                        title="مسح التوقيع"
                    >
                        <i className="fa-solid fa-eraser"></i>
                    </button>
                </>
            )}
        </div>
    );
};

export default function ContractWizard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(0); // Start at step 0 for template selection
    const [formData, setFormData] = useState({
        sellerName: '',
        sellerPhone: '',
        buyerName: '',
        buyerPhone: '',
        carModel: '', // نوع وموديل السيارة
        vinNumber: '', // رقم الشاصي
        price: '', // السعر المتفق عليه
        currency: 'IQD', // العملة المحددة
        customClauses: '', // بنود مخصصة إضافية
        reminderDuration: 24, // مدة التذكير الافتراضية
    });
    const [selectedClauses, setSelectedClauses] = useState<string[]>([]);
    const [previewFontSize, setPreviewFontSize] = useState(14);
    const optionalClausesOptions = [
        { id: 'engine_warranty', label: 'ضمان المحرك والجير (3 أيام)' },
        { id: 'traffic_test', label: 'شرط اجتياز فحص المرور' },
        { id: 'previous_fines', label: 'تحمل البائع للغرامات السابقة' },
        { id: 'transfer_period', label: 'الالتزام بالتحويل خلال 10 أيام' },
    ];

    const [generatedContractText, setGeneratedContractText] = useState('');
    const [isLoadingContract, setIsLoadingContract] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [isSavingToWallet, setIsSavingToWallet] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isDraftSaved, setIsDraftSaved] = useState(false);
    const [isRequestingReview, setIsRequestingReview] = useState(false);
    const [isReviewRequested, setIsReviewRequested] = useState(false);
    const [promoCodeInput, setPromoCodeInput] = useState('');
    const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [isApplyingPromo, setIsApplyingPromo] = useState(false);
    const [availableLawyers, setAvailableLawyers] = useState<any[]>([]);
    const [userCustomTemplates, setUserCustomTemplates] = useState<any[]>([]);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [customTemplateSearch, setCustomTemplateSearch] = useState('');
    const [isNamingTemplate, setIsNamingTemplate] = useState(false);
    const [templateToPreview, setTemplateToPreview] = useState<{ name: string; text: string } | null>(null);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [selectedLawyerId, setSelectedLawyerId] = useState('');
    const [contractError, setContractError] = useState('');
    const [sellerSignature, setSellerSignature] = useState('');
    const [buyerSignature, setBuyerSignature] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [phoneErrors, setPhoneErrors] = useState({ seller: '', buyer: '' });
    const [vinError, setVinError] = useState('');
    const [isPaying, setIsPaying] = useState(false);
    const [isPaid, setIsPaid] = useState(false);

    const totalSteps = 7; // Increased for template selection step

    // --- Missing logic for custom templates ---
    const filteredCustomTemplates = useMemo(() => {
        return userCustomTemplates.filter(t =>
            t.name.toLowerCase().includes(customTemplateSearch.toLowerCase())
        );
    }, [userCustomTemplates, customTemplateSearch]);

    const handleDeleteTemplate = async (index: number) => {
        try {
            const res = await apiClient.deleteContractTemplate(index);
            setUserCustomTemplates(res.data || []);
        } catch (err) {
            console.error('Failed to delete template', err);
        }
    };

    const handleSaveAsTemplate = async () => {
        if (!generatedContractText) return;
        const name = window.prompt('أدخل اسماً للقالب الجديد:');
        if (!name) return;
        setIsSavingTemplate(true);
        try {
            const res = await apiClient.saveContractTemplate({ name, text: generatedContractText });
            setUserCustomTemplates(res.data || []);
            setContractError('تم حفظ القالب بنجاح');
            setTimeout(() => setContractError(''), 3000);
        } catch (err) {
            console.error('Failed to save template', err);
        } finally {
            setIsSavingTemplate(false);
        }
    };

    // --- Client-side Contract Generator (Fallback) ---
    const generateContractTextLocally = useCallback(() => {
        const { sellerName, sellerPhone, buyerName, buyerPhone, carModel, vinNumber, price, currency, customClauses } = formData;
        const dateStr = new Date().toLocaleDateString('ar-IQ');
        const clauseMap: Record<string, string> = {
            'engine_warranty': 'يضمن البائع سلامة المحرك والجير لمدة 3 أيام من تاريخ الاستلام، وفي حال ظهور خلل فني جوهري يحق للمشتري إعادة المركبة.',
            'traffic_test': 'يعتبر هذا البيع معلقاً على شرط اجتياز المركبة للفحص الفني في دائرة المرور المختصة.',
            'previous_fines': 'يتحمل الطرف الأول (البائع) كافة الغرامات المرورية والديون الحكومية المترتبة على المركبة حتى تاريخ توقيع هذا العقد.',
            'transfer_period': 'يلتزم البائع بالحضور أمام دائرة المرور لغرض تحويل ملكية المركبة باسم المشتري خلال مدة لا تتجاوز 10 أيام من تاريخه.',
        };

        let additionalConditions = '';
        if (selectedClauses.length > 0) {
            additionalConditions = '\n\nشروط إضافية متفق عليها:\n' + selectedClauses
                .map((id, index) => `${index + 6}. ${clauseMap[id] || id}`)
                .join('\n');
        }
        if (customClauses) additionalConditions += `\n\nبند مضاف من الأطراف:\n- ${customClauses}`;

        return `عقد بيع وشراء مركبة\n\nأنه في يوم ${dateStr}، تم الاتفاق والتراضي بين كل من:\n\nالطرف الأول (البائع): السيد/ة ${sellerName} (رقم الهاتف: +964${sellerPhone})\nالطرف الثاني (المشتري): السيد/ة ${buyerName} (رقم الهاتف: +964${buyerPhone})\n\nباع الطرف الأول للطرف الثاني المركبة الموصوفة أدناه:\n- نوع المركبة وموديلها: ${carModel}\n- رقم الشاصي (VIN): ${vinNumber}\n\nالثمن: تم هذا البيع نظير ثمن إجمالي قدره ${price} ${currency === 'USD' ? 'دولار أمريكي' : 'دينار عراقي'}.\n\nشروط العقد:\n1. يقر الطرف الأول (البائع) بأن المركبة المباعة خالية من أي ديون أو حجوزات قانونية حتى تاريخ هذا العقد.\n2. يقر الطرف الثاني (المشتري) بأنه قد عاين المركبة معاينة تامة وقبل شراءها بحالتها الراهنة.\n3. يتعهد الطرف الأول بتسليم المركبة وكافة وثائقها القانونية للطرف الثاني فور استلام الثمن المذكور.\n4. تنتقل كافة المسؤوليات القانونية والمخالفات المترتبة على المركبة إلى عهدة الطرف الثاني من لحظة استلامه لها.\n5. يخضع هذا العقد لأحكام القوانين العراقية النافذة.${additionalConditions}\n\nالتوقيعات:\nتوقيع الطرف الأول (البائع): ............................\nتوقيع الطرف الثاني (المشتري): ............................`;
    }, [formData, selectedClauses]);

    const stepTitles = ['اختيار القالب', 'بيانات الأطراف', 'تفاصيل المركبة', 'مراجعة العقد', 'الدفع', 'التوقيع', 'الانتهاء'];
    const stepDescriptions: Record<number, string> = {
        0: 'اختر نوع العقد الذي ترغب بإنشائه أو ابدأ من الصفر.',
        1: 'أدخل أسماء الأطراف وأرقام الجوال العراقية بدون رمز الدولة.',
        2: 'أدخل تفاصيل السيارة والسعر المتفق عليه بدقة.',
        3: 'راجع مسودة العقد وتأكد من جميع البنود.',
        4: 'أكمل الدفع ليتم حفظ العقد رسمياً.',
        5: 'أضف توقيعك الإلكتروني ووافق على الشروط.',
        6: 'تم! يمكنك تحميل العقد أو إنشاء عقد جديد.',
    };

    const stepIcons: Record<number, string> = {
        0: 'fa-layer-group',
        1: 'fa-users-between-lines',
        2: 'fa-car-side',
        3: 'fa-file-signature',
        4: 'fa-credit-card',
        5: 'fa-pen-fancy',
        6: 'fa-circle-check',
    };

    const validatePhone = (phone: string) => {
        return /^[0-9]{10}$/.test(phone);
    };

    const validateVin = (vin: string) => {
        return vin.length === 17;
    };

    const nextStep = () => setStep(prev => prev + 1);
    const prevStep = () => setStep(prev => prev - 1);

    // جلب قائمة المحامين عند حفظ المسودة
    useEffect(() => {
        if (isDraftSaved) {
            const loadLawyers = async () => {
                try {
                    const res = await apiClient.getLawyers();
                    setAvailableLawyers(res.data || []);
                } catch (err) {
                    console.error('Failed to load lawyers', err);
                }
            };
            loadLawyers();
        }
    }, [isDraftSaved]);

    const fetchCustomTemplates = useCallback(async () => {
        try {
            const res = await apiClient.getContractTemplates();
            setUserCustomTemplates(res.data || []);
        } catch (err) {
            console.error('Failed to fetch custom templates', err);
        }
    }, []);

    // Local storage keys for draft saving
    const DRAFT_FORM_DATA_KEY = 'contractWizardFormDataDraft';
    const DRAFT_STEP_KEY = 'contractWizardStepDraft';

    // Effect to load saved draft on component mount
    useEffect(() => {
        const savedFormData = localStorage.getItem(DRAFT_FORM_DATA_KEY);
        const savedStep = localStorage.getItem(DRAFT_STEP_KEY);

        fetchCustomTemplates();

        if (savedFormData) {
            const parsedData = JSON.parse(savedFormData);
            setFormData(parsedData);
            // Restore selectedClauses if present in draft
            if (parsedData.selectedClauses) {
                setSelectedClauses(parsedData.selectedClauses);
            }
        }
        if (savedStep) {
            const loadedStep = parseInt(savedStep, 10);
            // If a draft exists and it's not step 0, jump to the loaded step.
            // Otherwise, if no draft or draft is at step 0, keep step at 0 to show template selection.
            if (loadedStep > 0 && savedFormData) {
                setStep(loadedStep);
            } else {
                setStep(0); // Always start with template selection if no valid draft to jump to
            }
        } else {
            setStep(0); // If no saved step, start at template selection
        }
        // If there's a draft, give a subtle hint
        if (savedFormData || savedStep) {
            setContractError('تم تحميل مسودة عقد سابقة. يمكنك المتابعة أو البدء من جديد.');
            setTimeout(() => setContractError(''), 5000); // Clear hint after 5 seconds
        }
    }, []);

    // Effect to save draft whenever formData or step changes
    useEffect(() => {
        // Include selectedClauses in the saved draft
        const dataToSave = { ...formData, selectedClauses };
        localStorage.setItem(DRAFT_FORM_DATA_KEY, JSON.stringify(dataToSave));

        localStorage.setItem(DRAFT_STEP_KEY, step.toString());
    }, [formData, step]);

    // Function to clear the draft
    const clearDraft = useCallback(() => {
        localStorage.removeItem(DRAFT_FORM_DATA_KEY);
        localStorage.removeItem(DRAFT_STEP_KEY);
    }, []);

    // تنبيه عند الدخول إذا كان الرصيد أقل من 5,000
    useEffect(() => {
        if (user && user.accountBalance < 5000 && step === 1) {
            setContractError('تنبيه: رصيدك الحالي أقل من 5,000 د.ع. يرجى شحن الرصيد لتتمكن من إصدار العقود المدفوعة.');
            setTimeout(() => setContractError(''), 8000);
        }
    }, [user?.accountBalance, step]);

    const handleTemplateSelect = (templateId: string | null) => {
        if (templateId) {
            const template = CONTRACT_TEMPLATES.find(t => t.id === templateId);
            if (template) {
                setFormData(prev => ({ ...prev, ...template.initialFormData }));
                setSelectedClauses(template.initialSelectedClauses);
            }
        } else {
            // Start from scratch, clear any pre-filled data that might be there
            setFormData(prev => ({ ...prev, carModel: '', customClauses: '' }));
            setSelectedClauses([]);
        }
        setStep(1); // Move to the first actual form step
    };



    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step]);

    const handleGenerateContract = async () => {
        setIsLoadingContract(true);
        setContractError('');
        setGeneratedContractText('');

        try {
            // Request standard contract template from server
            const response = await apiClient.generateCarContract({ ...formData, optionalClauses: selectedClauses });
            setGeneratedContractText(response.data.data.contractText);
            nextStep(); // Move to the next step (Contract Review)
        } catch (error: any) {
            console.warn('Server generation failed, falling back to local template...', error);

            // "Go around it" by generating locally if AI or server fails
            const localText = generateContractTextLocally();
            if (localText) {
                setGeneratedContractText(localText);
                setContractError('تم استخدام القالب المحلي لضمان استمرارية العمل. يرجى مراجعة البنود بعناية.');
                setTimeout(() => setContractError(''), 5000);
                nextStep();
            } else {
                setContractError('تعذر توليد العقد حالياً. يرجى التأكد من ملء جميع البيانات.');
            }
        } finally {
            setIsLoadingContract(false);
        }
    };

    const handleWalletPayment = async () => {
        setIsPaying(true);
        try {
            const finalAmount = 25000 - discountAmount;
            await apiClient.payFromWallet(finalAmount, 'إنشاء عقد مركبة ذكي', appliedPromoCode || undefined);
            setIsPaid(true);
            nextStep();
        } catch (error: any) {
            setContractError(error.response?.data?.error || 'رصيد المحفظة غير كافٍ. يرجى شحن الرصيد أولاً.');
        } finally {
            setIsPaying(false);
        }
    };

    const handleApplyPromoCode = async () => {
        if (!promoCodeInput.trim()) return;
        setIsApplyingPromo(true);
        setContractError('');
        try {
            const response = await apiClient.applyPromoCode(promoCodeInput.trim());
            setDiscountAmount(response.data.data.discountAmount);
            setAppliedPromoCode(promoCodeInput.trim());
            setContractError(response.data.data.message); // عرض رسالة النجاح كخطأ مؤقت
            setTimeout(() => setContractError(''), 5000);
        } catch (error: any) {
            setDiscountAmount(0);
            setAppliedPromoCode(null);
            setContractError(error.response?.data?.error || 'فشل تطبيق كود الخصم.');
        } finally {
            setIsApplyingPromo(false);
        }
    };

    const handleFinalizeAndNotify = async () => {
        setIsSendingWhatsApp(true);
        setIsSavingToWallet(true);
        setContractError('');

        try {
            // 1. توليد الـ PDF كـ Blob
            const element = document.createElement('div');
            element.innerHTML = `<h1>عقد بيع مركبة</h1><p>${generatedContractText.replace(/\n/g, '<br>')}</p>`;
            const worker = html2pdf().from(element).set({ margin: 10, filename: 'contract.pdf' });
            const pdfBlob = await worker.output('blob');

            // 2. رفع الملف للخادم للحصول على URL للـ Twilio Media
            const uploadRes = await apiClient.uploadContractPdf(pdfBlob);
            const pdfUrl = uploadRes.data.url;

            const payload = {
                ...formData,
                pdfUrl: pdfUrl,
                sellerSignature,
                buyerSignature,
            };

            await Promise.all([
                apiClient.whatsappCarContract(payload),
                apiClient.saveContractToWallet(payload),
                apiClient.scheduleContractReminder({
                    contractId: `CTR-${Date.now()}`,
                    phone: formData.buyerPhone,
                    name: formData.buyerName,
                    hours: formData.reminderDuration
                })
            ]);

            nextStep();
        } catch (error: any) {
            console.error('Error in finalization:', error.response?.data?.error || error.message);
            setContractError(error.response?.data?.error || 'تم توقيع العقد، لكن حدث خطأ في الأرشفة أو الإرسال. يمكنك تحميله يدوياً.');
            nextStep(); // ننتقل للخطوة الأخيرة حتى لو فشل الإيميل ليتمكن من التحميل
        } finally {
            setIsSendingWhatsApp(false);
            setIsSavingToWallet(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!generatedContractText) return;
        setIsSavingDraft(true);
        setContractError('');
        try {
            await apiClient.saveDraftContract({
                ...formData,
                contractText: generatedContractText,
            });
            setIsDraftSaved(true);
            setStep(6); // الانتقال مباشرة للخطوة النهائية كمسودة
        } catch (error: any) {
            console.error('Error saving draft:', error.response?.data?.error || error.message);
            setContractError('فشل حفظ المسودة. يرجى المحاولة مرة أخرى.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    const handleRequestReview = async () => {
        if (!selectedLawyerId) {
            setContractError('يرجى اختيار محامٍ للمراجعة.');
            return;
        }
        setIsRequestingReview(true);
        setContractError('');
        try {
            await apiClient.requestContractReview({
                lawyerId: selectedLawyerId,
                notes: `طلب مراجعة عقد بيع سيارة (${formData.carModel})`,
                payFromWallet: true // تفعيل الخصم لمراجعة المحامي
            });
            setIsReviewRequested(true);
        } catch (error: any) {
            console.error('Error requesting review:', error);
            setContractError('فشل إرسال طلب المراجعة. يرجى المحاولة لاحقاً.');
        } finally {
            setIsRequestingReview(false);
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
            <div style="display: flex; justify-content: space-between; margin-top: 40px; direction: rtl;">
                <div style="text-align: center; width: 45%;">
                    <p style="font-weight: bold; margin-bottom: 10px;">توقيع البائع:</p>
                    <img src="${sellerSignature}" style="max-w-full h-auto border-b border-slate-200 pb-2" />
                    <p style="font-size: 12px; color: #666;">${formData.sellerName}</p>
                </div>
                <div style="text-align: center; width: 45%;">
                    <p style="font-weight: bold; margin-bottom: 10px;">توقيع المشتري:</p>
                    <img src="${buyerSignature}" style="max-w-full h-auto border-b border-slate-200 pb-2" />
                    <p style="font-size: 12px; color: #666;">${formData.buyerName}</p>
                </div>
            </div>
            <p style="font-size: 11px; color: #999; margin-top: 40px; text-align: center;">تم التوقيع إلكترونياً والموافقة على الشروط أعلاه عبر منصة القسطاس.</p>
        `;

        const opt = {
            margin: 10,
            filename: `عقد_بيع_مركبة_${formData.sellerName}_${formData.buyerName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, logging: true, dpi: 192, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        };

        html2pdf().from(element).set(opt).save();
        clearDraft(); // Clear draft after successful download/finalization
    };

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(generatedContractText);
        setContractError('تم نسخ النص إلى الحافظة');
        setTimeout(() => setContractError(''), 3000);
    };

    return (
        <div className="app-view fade-in space-y-8 pb-12 text-center">
            {/* Premium Header Banner */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.03] p-8 shadow-premium">
                <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl"></div>
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-center lg:text-right">
                        <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Professional Contract Engine</p>
                        <h2 className="mt-3 text-3xl font-black text-brand-dark">منشئ العقود الذكي</h2>
                        <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-500">
                            أداة احترافية لتوليد عقود بيع السيارات بضمانات قانونية، توقيع إلكتروني ملزم، وتوثيق فوري في محفظتك الرقمية.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm min-w-[140px] text-center mx-auto lg:mx-0">
                            <p className="text-[11px] font-black uppercase text-slate-400">الخطوات</p>
                            <p className="mt-1 text-2xl font-black text-brand-navy">{step} / {totalSteps}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Centered Medal Layout Card */}
            <div className="max-w-3xl mx-auto bg-white rounded-[2.5rem] border border-slate-200 p-8 md:p-12 shadow-premium relative">
                <h2 className="text-2xl font-black text-brand-dark mb-8 flex items-center justify-center gap-3">
                    <i className="fa-solid fa-file-signature text-brand-gold"></i>
                    إصدار عقد مركبة جديد
                </h2>

                {step === 0 ? (
                    <motion.div
                        key="step0"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        <h3 className="font-black text-slate-700 text-sm border-r-4 border-brand-gold pr-3 mb-4 text-center">اختر نوع العقد</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {CONTRACT_TEMPLATES.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => handleTemplateSelect(template.id)}
                                    className="relative p-6 rounded-[2rem] border border-slate-200 bg-slate-50 hover:border-brand-navy hover:bg-white transition-all shadow-sm hover:shadow-md text-center flex flex-col items-center justify-center group/card"
                                >
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setTemplateToPreview({ name: template.label, text: (template as any).previewText || template.description });
                                        }}
                                        className="absolute top-4 left-4 h-8 w-8 rounded-full bg-white text-slate-400 opacity-0 group-hover/card:opacity-100 hover:text-brand-navy hover:shadow-md transition-all flex items-center justify-center z-10"
                                        title="معاينة النص"
                                    >
                                        <i className="fa-solid fa-eye text-xs"></i>
                                    </div>
                                    <i className={`text-4xl text-brand-navy mb-4 ${template.icon}`}></i>
                                    <p className="text-sm font-black text-brand-dark">{template.label}</p>
                                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">{template.description}</p>
                                    <span className="mt-4 px-4 py-2 rounded-xl bg-brand-navy text-white text-[10px] font-black shadow-lg shadow-brand-navy/20">اختيار</span>
                                </button>
                            ))}
                        </div>

                        {userCustomTemplates.length > 0 && (
                            <div className="mt-8 pt-8 border-t border-slate-100">
                                <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                    <h3 className="font-black text-slate-700 text-sm border-r-4 border-brand-navy pr-3 text-right">قوالبي الخاصة المحفوظة</h3>
                                    <div className="relative w-full md:w-72">
                                        <input
                                            type="text"
                                            placeholder="ابحث في قوالبك..."
                                            value={customTemplateSearch}
                                            onChange={(e) => setCustomTemplateSearch(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold focus:border-brand-navy outline-none text-right transition-all"
                                        />
                                        <i className="fa-solid fa-search absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                        {customTemplateSearch && (
                                            <button onClick={() => setCustomTemplateSearch('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                                                <i className="fa-solid fa-circle-xmark text-[10px]"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                                    {filteredCustomTemplates.map((template, index) => (
                                        <div
                                            key={index}
                                            className="p-5 rounded-[2rem] border border-slate-200 bg-white hover:border-brand-navy transition-all shadow-sm flex flex-col group"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleDeleteTemplate(index)}
                                                        className="h-8 w-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors flex items-center justify-center shadow-sm"
                                                        title="حذف القالب"
                                                    >
                                                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => setTemplateToPreview({ name: template.name, text: template.text })}
                                                        className="h-8 w-8 rounded-lg bg-slate-50 text-slate-400 hover:text-brand-navy hover:bg-white transition-all flex items-center justify-center shadow-sm"
                                                        title="معاينة"
                                                    >
                                                        <i className="fa-solid fa-eye text-[10px]"></i>
                                                    </button>
                                                </div>
                                                <div className="h-10 w-10 rounded-xl bg-brand-navy/5 text-brand-navy flex items-center justify-center">
                                                    <i className="fa-solid fa-file-invoice"></i>
                                                </div>
                                            </div>
                                            <p className="text-sm font-black text-brand-dark mb-2">{template.name}</p>
                                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed mb-4">
                                                {template.text.substring(0, 120)}...
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setGeneratedContractText(template.text);
                                                    setStep(3);
                                                }}
                                                className="w-full py-2.5 rounded-xl bg-brand-navy text-white text-[11px] font-black shadow-lg shadow-brand-navy/20 active:scale-95 transition-all"
                                            >
                                                استخدام هذا القالب
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {userCustomTemplates.length > 0 && filteredCustomTemplates.length === 0 && (
                            <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                                <p className="text-sm font-bold">لم يتم العثور على قوالب تطابق "{customTemplateSearch}"</p>
                            </div>
                        )}

                        {/* Template Preview Modal */}
                        <AnimatePresence>
                            {templateToPreview && (
                                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-dark/40 backdrop-blur-sm px-4">
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0.9, opacity: 0 }}
                                        className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl text-right flex flex-col max-h-[80vh]"
                                    >
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl font-black text-brand-dark">معاينة القالب: {templateToPreview.name}</h3>
                                            <button onClick={() => setTemplateToPreview(null)} className="text-slate-400 hover:text-red-500 transition">
                                                <i className="fa-solid fa-times text-xl"></i>
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto bg-slate-50 rounded-2xl p-6 mb-8 text-sm leading-relaxed text-slate-600 font-medium whitespace-pre-wrap custom-scrollbar text-right">
                                            {templateToPreview.text}
                                        </div>
                                        <div className="flex justify-center">
                                            <ActionButton onClick={() => setTemplateToPreview(null)} variant="secondary" className="px-12">
                                                إغلاق المعاينة
                                            </ActionButton>
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>

                        <ActionButton
                            onClick={() => handleTemplateSelect(null)}
                            variant="secondary"
                            className="w-full mt-6 py-4"
                        >
                            البدء من الصفر
                        </ActionButton>
                    </motion.div>
                ) : (
                    <div className="mb-10">
                        <div className="flex justify-between items-center mb-8 relative">
                            <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 -z-0"></div>
                            {Array.from({ length: totalSteps }).map((_, index) => {
                                const sNum = index; // Use index directly as stepTitles is 0-indexed
                                const isActive = step === sNum;
                                const isCompleted = step > sNum;
                                return (
                                    <div key={index} className={`relative z-10 flex flex-col items-center ${isActive ? 'scale-105' : ''} transition-transform`}>
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 border-4 border-white shadow-sm ${isActive ? 'bg-brand-navy text-white scale-110' :
                                            isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                                            }`}>
                                            {isCompleted ? <i className="fa-solid fa-check text-xs"></i> : <i className={`fa-solid ${stepIcons[sNum]} text-xs`}></i>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5 text-right flex items-start gap-4"
                        >
                            <div className="h-10 w-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-brand-gold shrink-0">
                                <i className="fa-solid fa-lightbulb"></i>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-brand-dark">{stepTitles[step]}</p>
                                <p className="text-xs font-bold text-slate-500 mt-1 leading-relaxed">{stepDescriptions[step]}</p>
                            </div>
                        </motion.div>
                    </div>
                )}

                {step > 0 && (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {step === 1 && (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="font-black text-slate-700 text-sm flex items-center justify-center gap-2 border-r-4 border-brand-gold pr-3">بيانات البائع</h3>
                                        <input
                                            placeholder="اسم البائع الكامل"
                                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right font-bold text-slate-700 focus:bg-white focus:border-brand-navy transition-all"
                                            onChange={e => setFormData({ ...formData, sellerName: e.target.value })}
                                            value={formData.sellerName}
                                        />
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex h-14 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-400">+964</span>
                                            <input
                                                type="tel"
                                                placeholder="7700000000"
                                                maxLength={10}
                                                className={`min-w-0 flex-1 p-4 bg-slate-50 rounded-2xl border outline-none text-right font-bold text-slate-700 focus:bg-white transition-all ${phoneErrors.seller ? 'border-rose-300' : 'border-slate-200 focus:border-brand-navy'}`}
                                                onChange={e => setFormData({ ...formData, sellerPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                                onBlur={() => {
                                                    const isValid = validatePhone(formData.sellerPhone);
                                                    setPhoneErrors(prev => ({
                                                        ...prev,
                                                        seller: isValid || !formData.sellerPhone ? '' : 'يرجى إدخال رقم جوال عراقي صحيح'
                                                    }));
                                                }}
                                                value={formData.sellerPhone}
                                            />
                                        </div>
                                        {phoneErrors.seller && <p className="text-rose-500 text-[10px] font-black mr-2 animate-pulse">{phoneErrors.seller}</p>}
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <h3 className="font-black text-slate-700 text-sm flex items-center justify-center gap-2 border-r-4 border-brand-navy pr-3">بيانات المشتري</h3>
                                        <input
                                            placeholder="اسم المشتري الكامل"
                                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right font-bold text-slate-700 focus:bg-white focus:border-brand-navy transition-all"
                                            onChange={e => setFormData({ ...formData, buyerName: e.target.value })}
                                            value={formData.buyerName}
                                        />
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex h-14 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-400">+964</span>
                                            <input
                                                type="tel"
                                                placeholder="7800000000"
                                                maxLength={10}
                                                className={`min-w-0 flex-1 p-4 bg-slate-50 rounded-2xl border outline-none text-right font-bold text-slate-700 focus:bg-white transition-all ${phoneErrors.buyer ? 'border-rose-300' : 'border-slate-200 focus:border-brand-navy'}`}
                                                onChange={e => setFormData({ ...formData, buyerPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                                onBlur={() => {
                                                    const isValid = validatePhone(formData.buyerPhone);
                                                    setPhoneErrors(prev => ({
                                                        ...prev,
                                                        buyer: isValid || !formData.buyerPhone ? '' : 'يرجى إدخال رقم جوال عراقي صحيح'
                                                    }));
                                                }}
                                                value={formData.buyerPhone}
                                            />
                                        </div>
                                        {phoneErrors.buyer && <p className="text-rose-500 text-[10px] font-black mr-2 animate-pulse">{phoneErrors.buyer}</p>}
                                    </div>

                                    <ActionButton
                                        onClick={nextStep}
                                        variant="primary"
                                        className="w-full mt-6 py-4"
                                        disabled={!formData.sellerName || !formData.buyerName || !formData.sellerPhone || !formData.buyerPhone || !!phoneErrors.seller || !!phoneErrors.buyer}
                                    >
                                        التالي: تفاصيل السيارة
                                    </ActionButton>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-700 text-sm border-r-4 border-brand-gold pr-3 mb-4 text-center">بيانات المركبة والثمن</h3>
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <input
                                                placeholder="نوع وموديل السيارة"
                                                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right font-bold focus:bg-white focus:border-brand-navy transition-all"
                                                onChange={e => setFormData({ ...formData, carModel: e.target.value })}
                                                value={formData.carModel}
                                            />
                                            <i className="fa-solid fa-car absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                                        </div>
                                        <div className="relative">
                                            <input
                                                placeholder="رقم الشاصي"
                                                className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right font-mono font-bold focus:bg-white focus:border-brand-navy transition-all"
                                                maxLength={17}
                                                onChange={e => {
                                                    const val = e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
                                                    setFormData({ ...formData, vinNumber: val });
                                                    if (val.length > 0 && val.length < 17) setVinError('رقم الشاصي يجب أن يكون 17 حرفاً');
                                                    else setVinError('');
                                                }}
                                                value={formData.vinNumber}
                                            />
                                            <i className="fa-solid fa-hashtag absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                                        </div>
                                        {vinError && <p className="text-rose-500 text-[10px] font-black mr-2">{vinError}</p>}

                                        <div className="space-y-3">
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, currency: 'IQD' })}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition ${formData.currency === 'IQD' ? 'bg-brand-navy text-white border-brand-navy shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                                >
                                                    دينار عراقي (د.ع)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, currency: 'USD' })}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition ${formData.currency === 'USD' ? 'bg-brand-navy text-white border-brand-navy shadow-md' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                                >
                                                    دولار أمريكي ($)
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    placeholder="السعر المتفق عليه"
                                                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right font-black text-brand-navy focus:bg-white focus:border-brand-navy transition-all"
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/,/g, '');
                                                        if (/^\d*$/.test(val)) {
                                                            const formatted = val.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                            setFormData({ ...formData, price: formatted });
                                                        }
                                                    }}
                                                    value={formData.price}
                                                />
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                                                    {formData.currency === 'IQD' ? 'د.ع' : '$'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 mt-6 pt-4 border-t border-slate-100">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-right">إضافة بنود اختيارية</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {optionalClausesOptions.map(clause => (
                                                <label key={clause.id} className={`flex items-center justify-end gap-2 p-3 rounded-xl border transition-all cursor-pointer ${selectedClauses.includes(clause.id) ? 'border-brand-navy bg-brand-navy/[0.03]' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                                    <span className={`text-[10px] font-black ${selectedClauses.includes(clause.id) ? 'text-brand-navy' : 'text-slate-500'}`}>{clause.label}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedClauses.includes(clause.id)}
                                                        onChange={() => {
                                                            setSelectedClauses(prev =>
                                                                prev.includes(clause.id)
                                                                    ? prev.filter(id => id !== clause.id)
                                                                    : [...prev, clause.id]
                                                            );
                                                        }}
                                                        className="h-4 w-4 rounded accent-brand-navy"
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3 mt-4">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-right">شروط مخصصة إضافية</h4>
                                        <textarea
                                            value={formData.customClauses}
                                            onChange={e => setFormData({ ...formData, customClauses: e.target.value })}
                                            placeholder="اكتب أي شروط خاصة أو اتفاقات إضافية بين البائع والمشتري هنا..."
                                            className="w-full h-28 p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right text-xs font-bold focus:bg-white focus:border-brand-navy transition-all resize-none shadow-inner"
                                        />
                                        <p className="text-[10px] text-slate-400 font-bold text-right pr-2">هذا النص سيظهر في نهاية بنود العقد.</p>
                                    </div>
                                    <div className="flex gap-3 mt-6">
                                        <ActionButton onClick={prevStep} variant="secondary" className="flex-1">رجوع</ActionButton>
                                        <ActionButton onClick={handleGenerateContract} variant="primary" className="flex-[2] py-4" disabled={isLoadingContract || !formData.carModel || formData.vinNumber.length !== 17 || !formData.price}>
                                            {isLoadingContract ? <><i className="fa-solid fa-spinner fa-spin ml-2"></i> جاري التحضير...</> : 'إصدار مسودة العقد'}
                                        </ActionButton>
                                    </div>
                                    {contractError && <p className="text-red-500 text-xs font-bold mt-2 text-center">{contractError}</p>}
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-black text-slate-700 text-sm">مراجعة مسودة العقد</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1 items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                                                <button onClick={() => setPreviewFontSize(p => Math.min(p + 2, 32))} className="h-7 w-7 rounded-lg bg-white text-brand-navy hover:bg-brand-navy hover:text-white transition shadow-sm flex items-center justify-center" title="تكبير الخط"><i className="fa-solid fa-plus text-[10px]"></i></button>
                                                <button onClick={() => setPreviewFontSize(p => Math.max(p - 2, 10))} className="h-7 w-7 rounded-lg bg-white text-brand-navy hover:bg-brand-navy hover:text-white transition shadow-sm flex items-center justify-center" title="تصغير الخط"><i className="fa-solid fa-minus text-[10px]"></i></button>
                                                <span className="px-2 text-[9px] font-black text-slate-400 uppercase tracking-tighter">حجم الخط</span>
                                            </div>
                                            <div className="flex gap-1 items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                                                <button onClick={handleCopyToClipboard} className="h-7 px-2 rounded-lg bg-white text-brand-navy hover:bg-brand-navy hover:text-white transition shadow-sm flex items-center justify-center gap-1 text-[9px] font-black"><i className="fa-regular fa-copy"></i> نسخ النص</button>
                                            </div>
                                            <StatusBadge tone="success">مسودة جاهزة</StatusBadge>
                                        </div>
                                    </div>
                                    {generatedContractText ? (
                                        <div className="space-y-4">
                                            <div className="relative group">
                                                <textarea
                                                    value={generatedContractText}
                                                    onChange={(e) => setGeneratedContractText(e.target.value)}
                                                    style={{ fontSize: `${previewFontSize}px` }}
                                                    className="w-full h-96 p-6 bg-slate-50 rounded-[2rem] border border-slate-200 leading-relaxed text-slate-700 outline-none focus:bg-white focus:border-brand-navy transition-all custom-scrollbar font-medium shadow-inner resize-none text-right"
                                                    placeholder="نص العقد..."
                                                />
                                                <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    <span className="bg-brand-navy text-white text-[9px] font-black px-2 py-1 rounded-full shadow-sm">
                                                        <i className="fa-solid fa-pen-to-square ml-1"></i> العقد قابل للتعديل يدوياً
                                                    </span>
                                                </div>
                                            </div>

                                            {(sellerSignature || buyerSignature) && (
                                                <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-center gap-4">
                                                    {sellerSignature && (
                                                        <div className="w-full sm:w-1/2 p-2">
                                                            <p className="font-bold text-brand-dark mb-2">توقيع البائع:</p>
                                                            <img src={sellerSignature} alt="Seller Signature" className="max-w-full h-auto mx-auto border-b border-slate-200 pb-2" />
                                                            <p className="text-xs text-slate-500 mt-1">{formData.sellerName}</p>
                                                        </div>
                                                    )}
                                                    {buyerSignature && (
                                                        <div className="w-full sm:w-1/2 p-2">
                                                            <p className="font-bold text-brand-dark mb-2">توقيع المشتري:</p>
                                                            <img src={buyerSignature} alt="Buyer Signature" className="max-w-full h-auto mx-auto border-b border-slate-200 pb-2" />
                                                            <p className="text-xs text-slate-500 mt-1">{formData.buyerName}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-10 bg-red-50 rounded-[2rem] text-red-600 text-center border border-red-100">
                                            <i className="fa-solid fa-triangle-exclamation text-5xl mb-4 opacity-50"></i>
                                            <p className="font-black text-lg">فشل توليد النص</p>
                                            <p className="text-sm font-bold opacity-70 mt-1">يرجى العودة والتحقق من البيانات المدخلة.</p>
                                        </div>
                                    )}
                                    <div className="flex gap-3 pt-4">
                                        <ActionButton onClick={prevStep} variant="secondary" className="flex-1">تعديل</ActionButton>
                                        <ActionButton
                                            onClick={handleSaveAsTemplate}
                                            variant="secondary"
                                            className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-100"
                                            disabled={isSavingTemplate || !generatedContractText}
                                        >
                                            {isSavingTemplate ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bookmark ml-1"></i>}
                                            {isSavingTemplate ? 'جاري الحفظ...' : 'حفظ كقالب'}
                                        </ActionButton>
                                        <ActionButton
                                            onClick={handleSaveDraft}
                                            variant="secondary"
                                            className="flex-1 border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-white"
                                            disabled={isSavingDraft || !generatedContractText}
                                        >
                                            {isSavingDraft ? 'جاري الحفظ...' : 'حفظ كمسودة للمراجعة'}
                                        </ActionButton>
                                        <ActionButton onClick={nextStep} variant="primary" className="flex-[1.2] py-4 shadow-lg shadow-brand-navy/20" disabled={!generatedContractText}>الموافقة والدفع</ActionButton>
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-6">
                                    <div className="text-center space-y-3">
                                        <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto text-red-500 text-3xl shadow-sm border border-red-100">
                                            <i className="fa-solid fa-mobile-screen-button"></i>
                                        </div>
                                        <h3 className="text-xl font-black text-brand-dark">تأكيد الدفع الرقمي</h3>
                                        <p className="text-sm font-bold text-slate-500">سيتم توليد العقد وأرشفته فور إتمام العملية.</p>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200 space-y-4">
                                        <div className="flex justify-between items-center flex-row-reverse border-b border-slate-200 pb-3">
                                            <span className="text-xs font-black text-slate-400">الخدمة:</span>
                                            <span className="text-sm font-black text-brand-dark">عقد سيارة ذكي</span>
                                        </div>
                                        <div className="flex justify-between items-center flex-row-reverse">
                                            <span className="text-xs font-black text-slate-400">المبلغ المستحق:</span>
                                            <span className="text-2xl font-black text-emerald-600">{(25000 - discountAmount).toLocaleString()} <span className="text-xs text-slate-400">د.ع</span></span>
                                        </div>
                                        <div className="flex justify-between items-center flex-row-reverse pt-2 border-t border-slate-100">
                                            <span className="text-xs font-black text-slate-400">رصيدك الحالي:</span>
                                            <span className="text-sm font-black text-brand-navy">{(user?.accountBalance || 0).toLocaleString()} د.ع</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200 space-y-4">
                                        <div className="flex justify-between items-center flex-row-reverse">
                                            <span className="text-xs font-black text-slate-400">كود الخصم:</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="أدخل الكود"
                                                    value={promoCodeInput}
                                                    onChange={(e) => setPromoCodeInput(e.target.value)}
                                                    className="w-32 p-2 bg-white rounded-lg border border-slate-200 outline-none text-right text-sm font-bold"
                                                    disabled={isApplyingPromo || discountAmount > 0}
                                                />
                                                <ActionButton
                                                    onClick={handleApplyPromoCode}
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={isApplyingPromo || !promoCodeInput.trim() || discountAmount > 0}
                                                >
                                                    {isApplyingPromo ? 'جاري التطبيق...' : 'تطبيق'}
                                                </ActionButton>
                                            </div>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="flex justify-between items-center flex-row-reverse pt-2 border-t border-slate-100">
                                                <span className="text-xs font-black text-emerald-600">الخصم المطبق:</span>
                                                <span className="text-sm font-black text-emerald-600">{discountAmount.toLocaleString()} د.ع</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3">
                                        <ActionButton onClick={prevStep} variant="secondary" className="flex-1" disabled={isPaying}>رجوع</ActionButton>
                                        {(user?.accountBalance || 0) < 25000 ? (
                                            <button
                                                onClick={() => navigate('/billing')}
                                                className="flex-[2] bg-brand-gold text-brand-dark rounded-2xl py-4 font-black flex items-center justify-center gap-3 hover:bg-yellow-500 transition-all shadow-xl shadow-brand-gold/20 active:scale-95"
                                            >
                                                <i className="fa-solid fa-circle-plus"></i>
                                                شحن الرصيد للمتابعة
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleWalletPayment} // سيتم تمرير promoCode من خلال formData
                                                disabled={isPaying}
                                                className="flex-[2] bg-brand-navy text-white rounded-2xl py-4 font-black flex items-center justify-center gap-3 hover:bg-brand-dark transition-all shadow-xl shadow-brand-navy/20 active:scale-95 disabled:opacity-50"
                                            >
                                                {isPaying ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-vault"></i>}
                                                {isPaying ? 'جاري المعالجة...' : 'تأكيد الدفع من المحفظة'}
                                            </button>
                                        )}
                                    </div>
                                    {(user?.accountBalance || 0) < 25000 && (
                                        <p className="text-rose-500 text-[10px] font-black text-center animate-pulse">رصيدك غير كافٍ لإتمام العملية. يرجى الشحن أولاً.</p>
                                    )}
                                    {contractError && <p className="text-rose-500 text-xs font-black mt-2 text-center animate-pulse">{contractError}</p>}
                                </div>
                            )}

                            {step === 5 && (
                                <div className="space-y-6">
                                    <h3 className="font-black text-slate-700 text-sm border-r-4 border-brand-navy pr-3">التوقيع الإلكتروني والمصادقة</h3>
                                    <div className="space-y-6 p-6 rounded-[2rem] border border-slate-200 bg-slate-50/50 shadow-inner">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                {sellerSignature && (
                                                    <button
                                                        onClick={() => setSellerSignature('')}
                                                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 transition flex items-center gap-1"
                                                    >
                                                        <i className="fa-solid fa-rotate-left"></i> مسح وإعادة البدء
                                                    </button>
                                                )}
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mr-auto">توقيع البائع</label>
                                            </div>
                                            <SignaturePad
                                                placeholder={formData.sellerName}
                                                value={sellerSignature}
                                                onSave={setSellerSignature}
                                                onClear={() => setSellerSignature('')}
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                {buyerSignature && (
                                                    <button
                                                        onClick={() => setBuyerSignature('')}
                                                        className="text-[9px] font-black text-rose-500 hover:text-rose-600 transition flex items-center gap-1"
                                                    >
                                                        <i className="fa-solid fa-rotate-left"></i> مسح وإعادة البدء
                                                    </button>
                                                )}
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mr-auto">توقيع المشتري</label>
                                            </div>
                                            <SignaturePad
                                                placeholder={formData.buyerName}
                                                value={buyerSignature}
                                                onSave={setBuyerSignature}
                                                onClear={() => setBuyerSignature('')}
                                            />
                                        </div>
                                        <label className="flex items-start justify-end gap-3 cursor-pointer group bg-white p-4 rounded-2xl border border-slate-100">
                                            <div className="text-right">
                                                <p className="text-xs font-black text-brand-dark group-hover:text-brand-navy transition-colors">أقر بصحة البيانات المذكورة</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1">الموافقة على شروط العقد والتوقيع الإلكتروني الملزم قانونياً.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={agreedToTerms}
                                                onChange={e => setAgreedToTerms(e.target.checked)}
                                                className="h-5 w-5 rounded-lg accent-brand-navy mt-1"
                                            />
                                        </label>

                                        <div className="space-y-3 pt-4 border-t border-slate-100">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">تنبيه التذكير التلقائي (WhatsApp)</label>
                                            <div className="flex gap-2">
                                                {[12, 24, 48, 72].map(hours => (
                                                    <button
                                                        key={hours}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, reminderDuration: hours })}
                                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition ${formData.reminderDuration === hours ? 'bg-brand-navy text-white border-brand-navy shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                                    >
                                                        {hours === 24 ? 'يوم واحد' : hours === 48 ? 'يومين' : `${hours} ساعة`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <ActionButton onClick={prevStep} variant="secondary" className="flex-1">رجوع</ActionButton>
                                        <ActionButton onClick={handleFinalizeAndNotify} variant="primary" className="flex-[2] py-4 shadow-lg shadow-brand-navy/20" disabled={!sellerSignature || !buyerSignature || !agreedToTerms || isSendingWhatsApp || isSavingToWallet}>
                                            {isSendingWhatsApp || isSavingToWallet ? <><i className="fa-solid fa-spinner fa-spin ml-2"></i> جاري الإرسال والأرشفة...</> : 'تأكيد وإرسال عبر WhatsApp'}
                                        </ActionButton>
                                    </div>
                                    {contractError && <p className="text-amber-600 text-[11px] mt-2 text-center font-black">{contractError}</p>}
                                </div>
                            )}

                            {step === 6 && (
                                <div className="text-center space-y-6 py-4 relative">
                                    <div className="relative">
                                        <div className={`w-24 h-24 ${isDraftSaved ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'} rounded-[2.5rem] flex items-center justify-center mx-auto text-4xl shadow-sm border`}>
                                            <i className={`fa-solid ${isDraftSaved ? 'fa-file-pen' : 'fa-file-circle-check'}`}></i>
                                        </div>
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className={`absolute -top-2 -right-1/3 translate-x-1/2 w-48 h-48 ${isDraftSaved ? 'bg-amber-500/5' : 'bg-emerald-500/5'} rounded-full -z-10 blur-2xl`}
                                        ></motion.div>

                                        {!isDraftSaved && (
                                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                                {[...Array(12)].map((_, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ y: 0, x: 0, opacity: 1, scale: 1 }}
                                                        animate={{
                                                            y: [-20, -100],
                                                            x: [0, (i % 2 === 0 ? 50 : -50)],
                                                            opacity: 0,
                                                            scale: 0.5
                                                        }}
                                                        transition={{ duration: 1, delay: i * 0.1, repeat: Infinity, repeatDelay: 3 }}
                                                        className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-emerald-400"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-brand-dark">
                                            {isDraftSaved ? 'تم حفظ المسودة بنجاح!' : 'تم التوقيع والأرشفة بنجاح!'}
                                        </h3>
                                        <p className="text-sm font-bold text-slate-500 px-10 leading-relaxed">
                                            {isDraftSaved
                                                ? isReviewRequested
                                                    ? 'تم إرسال طلب المراجعة للمحامي بنجاح. ستصلك رسالة WhatsApp فور اكتمال التدقيق.'
                                                    : 'تم حفظ العقد كمسودة في محفظتك. يمكنك الآن طلب مراجعة قانونية من محامٍ قبل إرساله للمشتري.'
                                                : 'تم إرسال نسخة من العقد عبر WhatsApp للأطراف المعنية وتمت أرشفة الوثيقة في محفظتك القانونية.'}
                                        </p>
                                    </div>

                                    {isDraftSaved && !isReviewRequested && (
                                        <div className="px-8 space-y-4">
                                            <div className="text-right">
                                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">اختر محامياً للمراجعة</label>
                                                <div className="grid gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                                                    {availableLawyers.map(lawyer => (
                                                        <button
                                                            key={lawyer.id}
                                                            onClick={() => setSelectedLawyerId(lawyer.id)}
                                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedLawyerId === lawyer.id ? 'border-brand-navy bg-brand-navy/5' : 'border-slate-100 hover:border-brand-gold'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <img src={lawyer.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm" alt="" />
                                                                <div className="text-right">
                                                                    <p className="text-xs font-black text-brand-dark">{lawyer.name}</p>
                                                                    <p className="text-[10px] text-slate-400 font-bold">{lawyer.specialty}</p>
                                                                </div>
                                                            </div>
                                                            {selectedLawyerId === lawyer.id && <i className="fa-solid fa-circle-check text-brand-navy"></i>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleRequestReview}
                                                disabled={isRequestingReview || !selectedLawyerId}
                                                className="w-full py-4 bg-brand-gold text-brand-dark rounded-2xl font-black text-sm shadow-lg shadow-brand-gold/20 hover:bg-yellow-500 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                                            >
                                                {isRequestingReview ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-user-shield"></i>}
                                                إرسال للمراجعة القانونية
                                            </button>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center gap-4 text-right max-w-sm mx-auto">
                                        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-brand-gold shrink-0">
                                            <i className="fa-solid fa-vault text-xl"></i>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-brand-navy">محفظة المستندات</p>
                                            <p className="text-[10px] font-bold text-slate-500 mt-1">العقد متاح الآن في ملفك الشخصي للتحميل في أي وقت.</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                                        <ActionButton onClick={handleDownloadPdf} variant="primary" className="flex-1 py-4 shadow-lg shadow-brand-navy/20">
                                            <i className="fa-solid fa-file-pdf ml-2"></i>
                                            تحميل العقد (PDF)
                                        </ActionButton>
                                        <ActionButton
                                            onClick={() => {
                                                setStep(1);
                                                clearDraft();
                                                setIsDraftSaved(false);
                                                setFormData({ sellerName: '', sellerPhone: '', buyerName: '', buyerPhone: '', carModel: '', vinNumber: '', price: '', reminderDuration: 24 });
                                            }}
                                            variant="secondary"
                                            className="flex-1 py-4"
                                        >
                                            <i className="fa-solid fa-plus ml-2"></i>
                                            إنشاء عقد جديد
                                        </ActionButton>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@400;700&display=swap');
                .font-signature {
                    font-family: 'Amatic SC', cursive; /* Example: use a signature-like font */
                    font-size: 2rem;
                    line-height: 1;
                    color: #1B365D;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
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