import { useState } from 'react';
import apiClient from '../api/client';

export const useDocumentUpload = () => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadNationalId = async (file: File): Promise<string> => {
        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('document', file);

            const response = await fetch('/api/profile/documents/national-id', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('lexigate_token')}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('فشل في تحميل البطاقة الوطنية');
            }

            const data = await response.json();
            return data.fileUrl;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'خطأ في التحميل';
            setError(errorMessage);
            throw err;
        } finally {
            setUploading(false);
        }
    };

    const uploadLawyerLicense = async (file: File): Promise<string> => {
        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('document', file);

            const response = await fetch('/api/profile/documents/lawyer-license', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('lexigate_token')}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('فشل في تحميل بطاقة المحاماة');
            }

            const data = await response.json();
            return data.fileUrl;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'خطأ في التحميل';
            setError(errorMessage);
            throw err;
        } finally {
            setUploading(false);
        }
    };

    return {
        uploadNationalId,
        uploadLawyerLicense,
        uploading,
        error,
    };
};
