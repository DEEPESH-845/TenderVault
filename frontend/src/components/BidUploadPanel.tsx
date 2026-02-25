import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { generateUploadUrl, uploadFileToS3, getErrorMessage } from '../services/api';
import { useGSAP } from '../hooks/useGSAP';

interface BidUploadPanelProps {
  tenderId: string;
  onUploadComplete: () => void;
  existingBid?: { fileName: string; status: string; updatedAt: string } | null;
}

export default function BidUploadPanel({ tenderId, onUploadComplete, existingBid }: BidUploadPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  // Subtle scale animation on drag enter
  useGSAP(() => {
    // Animation setup is handled inline via drag state
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);
    setSuccess(false);

    try {
      // 1. Get pre-signed URL
      const { uploadUrl } = await generateUploadUrl(tenderId, {
        fileName: file.name,
        contentType: 'application/pdf',
        fileSize: file.size,
      });

      // 2. Upload directly to S3
      await uploadFileToS3(uploadUrl, file, setProgress);

      // 3. Success
      setSuccess(true);
      setProgress(100);

      // 4. Notify parent to refresh
      setTimeout(() => onUploadComplete(), 2000);
    } catch (err: any) {
      if (err?.response?.status === 423) {
        setError('The submission deadline has passed. You can no longer submit bids.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setUploading(false);
    }
  }, [tenderId, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 52428800, // 50MB
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="space-y-4">
      {/* Existing submission info */}
      {existingBid && (
        <div className="flex items-center gap-3 p-3 bg-vault-50 dark:bg-vault-500/10 rounded-xl border border-vault-100 dark:border-vault-500/20">
          <svg className="w-5 h-5 text-vault-600 dark:text-vault-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm">
            <span className="font-semibold text-vault-700 dark:text-vault-400">Current submission:</span>{' '}
            <span className="text-gray-600 dark:text-slate-300">{existingBid.fileName}</span>
            <span className="text-gray-400 dark:text-slate-500 ml-2">({existingBid.status})</span>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div
        ref={dropzoneRef}
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-vault-400 bg-vault-50 dark:bg-vault-500/10 scale-[1.02]'
            : isDragReject
              ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
              : uploading
                ? 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 cursor-not-allowed'
                : 'border-gray-200 dark:border-slate-700 hover:border-vault-300 dark:hover:border-vault-500/40 hover:bg-vault-50/50 dark:hover:bg-vault-500/5'
        }`}
      >
        <input {...getInputProps()} />

        {success ? (
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path className="checkmark-draw" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Bid uploaded successfully!</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Your submission is being processed...</p>
          </div>
        ) : uploading ? (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto animate-spin">
              <svg className="text-vault-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Uploading... {progress}%</p>
            <div className="w-full max-w-xs mx-auto bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-vault-500 to-vault-600 rounded-full transition-all duration-300 progress-shimmer"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-vault-100 dark:group-hover:bg-vault-500/10 transition-colors">
              <svg className="w-6 h-6 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
              {isDragActive ? 'Drop your PDF here' : 'Drag & drop your bid PDF, or click to browse'}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500">PDF files only, up to 50MB</p>
            {existingBid && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2">
                ⚠ Uploading will create a new version (amendment)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-100 dark:border-red-500/20 animate-fade-in">
          <svg className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
