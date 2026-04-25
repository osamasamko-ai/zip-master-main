import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentUploadProps {
    label: string;
    description: string;
    icon: string;
    onUpload: (file: File) => Promise<void>;
    isVerified?: boolean;
    isLoading?: boolean;
    previewUrl?: string;
    acceptedFormats?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
    label,
    description,
    icon,
    onUpload,
    isVerified = false,
    isLoading = false,
    previewUrl,
    acceptedFormats = 'image/*,.pdf'
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    };

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        setUploadProgress(0);

        // Simulate upload progress
        const progressInterval = setInterval(() => {
            setUploadProgress((prev) => Math.min(prev + Math.random() * 30, 90));
        }, 200);

        try {
            await onUpload(file);
            setUploadProgress(100);
        } catch (error) {
            console.error('Upload failed:', error);
            setUploadProgress(0);
        } finally {
            clearInterval(progressInterval);
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
            }, 500);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.currentTarget.files;
        if (files && files.length > 0) {
            handleFileUpload(files[0]);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 transition hover:border-brand-navy/30 hover:bg-white"
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 text-right">
                        <h3 className="text-lg font-black text-brand-dark">{label}</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">{description}</p>
                    </div>
                    <div className="mr-4">
                        {isVerified ? (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                            >
                                <i className="fa-solid fa-circle-check text-xl"></i>
                            </motion.div>
                        ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xl">
                                <i className={`fa-solid ${icon}`}></i>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {previewUrl && !isUploading ? (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="relative overflow-hidden rounded-2xl bg-white"
                        >
                            {previewUrl.endsWith('.pdf') ? (
                                <div className="flex h-48 items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
                                    <div className="text-center">
                                        <i className="fa-solid fa-file-pdf text-5xl text-red-500 mb-3"></i>
                                        <p className="text-sm font-bold text-slate-600">ملف PDF</p>
                                    </div>
                                </div>
                            ) : (
                                <img src={previewUrl} alt="Document preview" className="h-48 w-full object-cover" />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/30 group">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="opacity-0 transition group-hover:opacity-100 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 font-bold text-brand-navy"
                                >
                                    <i className="fa-solid fa-arrow-up-from-bracket"></i>
                                    تغيير الملف
                                </button>
                            </div>
                        </motion.div>
                    ) : isUploading ? (
                        <motion.div
                            key="uploading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-slate-500">{Math.round(uploadProgress)}%</span>
                                <span className="text-sm font-bold text-brand-navy">جاري الرفع...</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-brand-navy to-brand-gold rounded-full"
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${uploadProgress}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                        </motion.div>
                    ) : (
                        <motion.button
                            key="upload"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white py-8 transition hover:border-brand-navy hover:bg-brand-navy/[0.02] active:scale-95 disabled:opacity-50"
                        >
                            <div className="space-y-3">
                                <motion.i
                                    className={`fa-solid ${isDragging ? 'fa-arrow-down' : 'fa-cloud-arrow-up'} text-3xl text-brand-gold block`}
                                    animate={{ y: isDragging ? 10 : 0 }}
                                />
                                <div>
                                    <p className="font-black text-brand-navy">اضغط أو اسحب الملف هنا</p>
                                    <p className="mt-1 text-xs font-bold text-slate-500">PNG, JPG, PDF - حتى 5MB</p>
                                </div>
                            </div>
                        </motion.button>
                    )}
                </AnimatePresence>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptedFormats}
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={isLoading || isUploading}
                />

                {isVerified && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-end gap-2 rounded-xl bg-emerald-50 px-4 py-3"
                    >
                        <span className="text-sm font-bold text-emerald-600">تم التحقق من الملف</span>
                        <i className="fa-solid fa-shield-check text-emerald-600"></i>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
};
