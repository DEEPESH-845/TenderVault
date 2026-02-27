import axios, { AxiosError } from 'axios';
import { getAccessToken, signOut } from './auth';
import type {
    Tender,
    Bid,
    AuditEvent,
    PresignedUrlResponse,
    DownloadUrlResponse,
    BidVersion,
    TenderLockedError,
    PaginatedResponse,
} from './types';

// Create axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor — attach Bearer token
api.interceptors.request.use(async (config) => {
    try {
        const token = await getAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
    } catch {
        // Token retrieval failed — let the request proceed, server will reject
    }
    return config;
});

// Response interceptor — handle common errors
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Unauthorized — force sign out
            await signOut();
            window.location.href = import.meta.env.BASE_URL || '/';
        }
        return Promise.reject(error);
    }
);

// ===== Tender Endpoints =====

export async function createTender(body: {
    title: string;
    description: string;
    deadline: string;
}): Promise<Tender> {
    const { data } = await api.post<Tender>('/tenders', body);
    return data;
}

export async function listTenders(): Promise<Tender[]> {
    const { data } = await api.get<{ tenders: Tender[]; count: number }>('/tenders');
    return data.tenders;
}

export async function getTender(tenderId: string): Promise<Tender> {
    const { data } = await api.get<Tender>(`/tenders/${tenderId}`);
    return data;
}

export async function deleteTender(tenderId: string): Promise<void> {
    await api.delete(`/tenders/${tenderId}`);
}

export async function updateTender(
    tenderId: string,
    body: {
        title?: string;
        description?: string;
        deadline?: string;
        status?: 'OPEN' | 'CLOSED' | 'ARCHIVED';
    }
): Promise<Tender> {
    const { data } = await api.put<Tender>(`/tenders/${tenderId}`, body);
    return data;
}

// ===== Bid Endpoints =====

export async function generateUploadUrl(
    tenderId: string,
    body: { fileName: string; contentType: string; fileSize: number }
): Promise<PresignedUrlResponse> {
    const { data } = await api.post<PresignedUrlResponse>(
        `/tenders/${tenderId}/bids/upload-url`,
        body
    );
    return data;
}

export async function uploadFileToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void
): Promise<void> {
    await axios.put(uploadUrl, file, {
        headers: {
            'Content-Type': 'application/pdf',
            'x-amz-server-side-encryption': 'AES256',
        },
        onUploadProgress: (event) => {
            if (event.total && onProgress) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        },
    });
}

export async function listBids(tenderId: string): Promise<Bid[]> {
    const { data } = await api.get<{ bids: Bid[]; count: number }>(
        `/tenders/${tenderId}/bids`
    );
    return data.bids;
}

export async function generateDownloadUrl(
    tenderId: string,
    bidderId: string
): Promise<DownloadUrlResponse> {
    const { data } = await api.get<DownloadUrlResponse>(
        `/tenders/${tenderId}/bids/${bidderId}/download-url`
    );
    return data;
}

export async function updateBidStatus(
    tenderId: string,
    bidderId: string,
    bidStatus: 'UNDER_REVIEW' | 'SHORTLISTED' | 'DISQUALIFIED' | 'AWARDED'
): Promise<Bid> {
    const { data } = await api.patch<Bid>(
        `/tenders/${tenderId}/bids/${bidderId}/status`,
        { bidStatus }
    );
    return data;
}

export async function scoreBid(
    tenderId: string,
    bidderId: string,
    score: number,
    notes?: string
): Promise<Bid> {
    const { data } = await api.put<Bid>(
        `/tenders/${tenderId}/bids/${bidderId}/score`,
        { score, notes }
    );
    return data;
}

// ===== Version Endpoints =====

export async function listVersions(
    tenderId: string,
    bidderId: string
): Promise<BidVersion[]> {
    const { data } = await api.get<{ versions: BidVersion[] }>(
        `/tenders/${tenderId}/bids/${bidderId}/versions`
    );
    return data.versions;
}

export async function restoreVersion(
    tenderId: string,
    bidderId: string,
    versionId: string
): Promise<{ message: string; newVersionId: string; restoredFrom: string }> {
    const { data } = await api.post(
        `/tenders/${tenderId}/bids/${bidderId}/restore`,
        { versionId }
    );
    return data;
}

// ===== Audit Log Endpoints =====

export async function listAuditLogs(params?: {
    userId?: string;
    tenderId?: string;
    action?: string;
    limit?: number;
    nextToken?: string;
}): Promise<PaginatedResponse<AuditEvent>> {
    const { data } = await api.get<PaginatedResponse<AuditEvent>>('/audit-logs', {
        params,
    });
    return data;
}

// ===== Error Helpers =====

export function isTenderLockedError(error: unknown): error is AxiosError<TenderLockedError> {
    return (
        axios.isAxiosError(error) &&
        error.response?.status === 423 &&
        error.response?.data?.error === 'TENDER_LOCKED'
    );
}

export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
        return error.response.data.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred';
}
