import { useState } from 'react';
import apiClient from '../api/client';

export const useDocumentUpload = () => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadDocument = async (file: File, endpoint: string, fallbackError: string): Promise<string> => {
        setUploading(true);
        setError(null);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    ...(apiClient.getToken() ? { Authorization: `Bearer ${apiClient.getToken()}` } : {}),
                },
                body: (() => {
                    const formData = new FormData();
                    formData.append('document', file);
                    return formData;
                })(),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error || fallbackError);
            }

            const data = await response.json();
            return data.fileUrl;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'خطأ في رفع الملف';
            setError(errorMessage);
            throw err;
        } finally {
            setUploading(false);
        }
    };

    const uploadNationalId = async (file: File): Promise<string> => {
        return uploadDocument(file, '/api/profile/documents/national-id', 'فشل رفع البطاقة الوطنية');
    };

    const uploadLawyerLicense = async (file: File): Promise<string> => {
        return uploadDocument(file, '/api/profile/documents/lawyer-license', 'فشل رفع بطاقة المحاماة');
    };

    return {
        uploadNationalId,
        uploadLawyerLicense,
        uploading,
        error,
    };
};
