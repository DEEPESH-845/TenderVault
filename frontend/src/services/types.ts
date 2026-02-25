export interface Tender {
    tenderId: string;
    title: string;
    description: string;
    deadline: string;
    createdBy: string;
    status: 'OPEN' | 'CLOSED' | 'ARCHIVED';
    createdAt: string;
    updatedAt: string;
}

export interface Bid {
    tenderId: string;
    bidderId: string;
    s3Key: string;
    currentVersionId?: string;
    fileName: string;
    fileSize: number;
    submittedAt: string;
    updatedAt: string;
    status: 'PENDING' | 'SUBMITTED' | 'DISQUALIFIED';
}

export interface AuditEvent {
    auditId: string;
    timestamp: string;
    userId: string;
    userRole: string;
    action: string;
    tenderId?: string;
    fileKey?: string;
    versionId?: string;
    ipAddress: string;
    userAgent?: string;
    result: 'SUCCESS' | 'DENIED' | 'ERROR';
    metadata?: Record<string, string>;
}

export interface PresignedUrlResponse {
    uploadUrl: string;
    s3Key: string;
    expiresIn: number;
}

export interface DownloadUrlResponse {
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    versionId: string;
    expiresIn: number;
}

export interface BidVersion {
    versionId: string;
    lastModified: string;
    size: number;
    isLatest: boolean;
    key?: string;
}

export interface ApiError {
    error: string;
    message: string;
    requestId: string;
    timestamp: string;
    fields?: Array<{ field: string; message: string }>;
}

export interface TenderLockedError extends ApiError {
    error: 'TENDER_LOCKED';
    unlocksAt: string;
    secondsRemaining: number;
}

export interface PaginatedResponse<T> {
    events?: T[];
    tenders?: T[];
    bids?: T[];
    versions?: T[];
    count: number;
    nextToken?: string;
}

export interface UserInfo {
    userId: string;
    email: string;
    groups: string[];
    role: 'tv-admin' | 'tv-bidder' | 'tv-evaluator';
}
