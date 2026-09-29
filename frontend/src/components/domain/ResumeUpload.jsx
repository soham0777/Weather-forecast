import { useRef, useState } from 'react';
import { Eye, FileText, Upload } from 'lucide-react';
import Button from '../ui/Button';
import { Alert } from '../ui/States';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage, openPdf } from '../../services/api';
import { studentService } from '../../services/endpoints';
import { MAX_RESUME_BYTES } from '../../utils/constants';
import { formatBytes, formatDateTime } from '../../utils/format';

/** Upload / replace / view the student's resume (PDF only, max 5 MB — enforced again by the server). */
export default function ResumeUpload({ resume, onUploaded }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  const choose = () => inputRef.current?.click();

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
      setError('Only PDF files are allowed. Please choose a .pdf file.');
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError(`This file is ${formatBytes(file.size)}. The maximum allowed size is 5 MB.`);
      return;
    }
    setProgress(0);
    try {
      const profile = await studentService.uploadResume(file, (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)));
      toast.success('Resume uploaded successfully.');
      onUploaded?.(profile);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProgress(null);
    }
  };

  const view = async () => {
    try {
      await openPdf('/students/me/resume');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-3">
      {resume?.uploaded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-8 w-8 shrink-0 text-rose-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{resume.fileName || 'resume.pdf'}</p>
              <p className="text-xs text-slate-500">Uploaded {formatDateTime(resume.uploadedAt)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Eye} onClick={view}>View</Button>
            <Button variant="secondary" size="sm" icon={Upload} onClick={choose} loading={progress !== null}>Replace</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-8 text-center">
          <FileText className="h-10 w-10 text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-900">No resume uploaded yet</p>
          <p className="text-xs text-slate-500">A resume is required before you can apply for internships.</p>
          <Button className="mt-4" icon={Upload} onClick={choose} loading={progress !== null}>Upload resume (PDF)</Button>
        </div>
      )}
      {progress !== null && <p className="text-xs text-slate-500" aria-live="polite">Uploading… {progress}%</p>}
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-xs text-slate-500">PDF only · maximum 5 MB. Uploading a new file replaces your current resume;
        applications you already submitted keep the resume you sent with them.</p>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile}
             aria-label="Choose resume PDF file" />
    </div>
  );
}
