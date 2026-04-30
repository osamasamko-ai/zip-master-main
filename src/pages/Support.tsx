import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ActionButton from '../components/ui/ActionButton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client'; // Assuming apiClient has a method for support requests

export default function Support() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: '',
        subject: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.name === 'phone'
            ? e.target.value.replace(/\D/g, '').slice(0, 10)
            : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus('idle');
        setErrorMessage('');

        // Basic validation
        if (!formData.name || !formData.phone || !formData.subject || !formData.message) {
            setErrorMessage('يرجى ملء جميع الحقول المطلوبة.');
            setIsSubmitting(false);
            setSubmitStatus('error');
            return;
        }

        if (!/^[0-9]{10}$/.test(formData.phone)) {
            setErrorMessage('يرجى إدخال رقم جوال عراقي صحيح بدون رمز الدولة.');
            setIsSubmitting(false);
            setSubmitStatus('error');
            return;
        }

        try {
            await apiClient.sendSupportRequest(formData);

            setSubmitStatus('success');
            setFormData({
                name: user?.name || '',
                email: user?.email || '',
                subject: '',
                message: '',
            });
        } catch (error) {
            console.error('Failed to send support request:', error);
            setErrorMessage('فشل إرسال طلب الدعم. يرجى المحاولة مرة أخرى.');
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="app-view p-6 text-right">
            <div className="max-w-2xl mx-auto bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-premium">
                <h2 className="text-2xl font-black text-brand-dark mb-6">تواصل مع الدعم الفني</h2>
                <p className="text-sm font-bold text-slate-500 mb-8">
                    نحن هنا لمساعدتك! يرجى ملء النموذج أدناه وسنقوم بالرد عليك في أقرب وقت ممكن.
                </p>

                <AnimatePresence>
                    {submitStatus === 'success' && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-bold"
                        >
                            <i className="fa-solid fa-circle-check ml-2"></i>
                            تم إرسال طلبك بنجاح! سنقوم بمراجعته والرد عليك قريباً.
                        </motion.div>
                    )}
                    {submitStatus === 'error' && errorMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold"
                        >
                            <i className="fa-solid fa-circle-exclamation ml-2"></i>
                            {errorMessage}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-bold text-slate-700 mb-2">الاسم الكامل</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="اسمك الكامل"
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="phone" className="block text-sm font-bold text-slate-700 mb-2">رقم الجوال</label>
                        <div className="flex items-center gap-3">
                            <span className="inline-flex h-14 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-500">+964</span>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="7701234567"
                                maxLength={10}
                                className="min-w-0 flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="subject" className="block text-sm font-bold text-slate-700 mb-2">الموضوع</label>
                        <input
                            type="text"
                            id="subject"
                            name="subject"
                            value={formData.subject}
                            onChange={handleChange}
                            placeholder="موضوع طلب الدعم"
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right"
                            disabled={isSubmitting}
                        />
                    </div>
                    <div>
                        <label htmlFor="message" className="block text-sm font-bold text-slate-700 mb-2">رسالتك</label>
                        <textarea
                            id="message"
                            name="message"
                            value={formData.message}
                            onChange={handleChange}
                            rows={5}
                            placeholder="اكتب رسالتك هنا..."
                            className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none text-right resize-none"
                            disabled={isSubmitting}
                        ></textarea>
                    </div>
                    <ActionButton type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? 'جاري الإرسال...' : 'إرسال طلب الدعم'}
                    </ActionButton>
                </form>
            </div>
        </div>
    );
}