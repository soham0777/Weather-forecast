import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';

/** Confirmation for destructive or significant actions (withdraw, archive, cancel, ...). */
export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', loading, onConfirm, onCancel,
  children,
}) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} title={title} size="sm" dismissible={!loading}
           footer={(
             <>
               <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
               <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
                 {confirmLabel}
               </Button>
             </>
           )}>
      <div className="flex gap-3">
        {tone === 'danger' && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
            <AlertTriangle className="h-5 w-5 text-rose-600" aria-hidden="true" />
          </div>
        )}
        <div className="space-y-3 text-sm text-slate-600">
          <p>{message}</p>
          {children}
        </div>
      </div>
    </Modal>
  );
}
