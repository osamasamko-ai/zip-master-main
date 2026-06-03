import { useState } from 'react';
import apiClient from '../api/client';

export const useDocumentUpload = () => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadDocument = async (file: File, endpoint: string, fallbackError: string, side: 'front' | 'back' = 'front'): Promise<string> => {
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
                    formData.append('side', side);
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

    const uploadNationalId = async (file: File, side: 'front' | 'back' = 'front'): Promise<string> => {
        return uploadDocument(file, '/api/profile/documents/national-id', 'فشل رفع البطاقة الوطنية', side);
    };

    const uploadLawyerLicense = async (file: File, side: 'front' | 'back' = 'front'): Promise<string> => {
        return uploadDocument(file, '/api/profile/documents/lawyer-license', 'فشل رفع بطاقة المحاماة', side);
    };

    return {
        uploadNationalId,
        uploadLawyerLicense,
        uploading,
        error,
    };
};
