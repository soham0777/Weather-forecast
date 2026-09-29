import { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { FormField, Select, Textarea } from '../ui/FormField';
import { Alert } from '../ui/States';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage } from '../../services/api';
import { interviewService } from '../../services/endpoints';
import { INTERVIEW_RESULTS, STATUS_META } from '../../utils/constants';

export default function InterviewResultModal({ open, onClose, onSaved, interview }) {
  const toast = useToast();
  const [result, setResult] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!result) {
      setError('Please choose a result.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await interviewService.recordResult(interview.id, { result, comments: comments.trim() || null });
      toast.success('Interview result recorded.');
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record interview result" size="sm"
           description="This marks the interview as completed. Update the application status separately."
           footer={(
             <>
               <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
               <Button onClick={submit} loading={saving}>Save result</Button>
             </>
           )}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <FormField label="Result" required>
          {(p) => (
            <Select {...p} value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">Select result</option>
              {INTERVIEW_RESULTS.map((r) => <option key={r} value={r}>{STATUS_META[r].label}</option>)}
            </Select>
          )}
        </FormField>
        <FormField label="Comments / feedback for the student">
          {(p) => <Textarea {...p} rows={3} maxLength={1000} value={comments} onChange={(e) => setComments(e.target.value)} />}
        </FormField>
      </div>
    </Modal>
  );
}
