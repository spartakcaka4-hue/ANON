import { useEffect, useRef } from 'react';

export function ConfirmDialog({ open, title, body, confirmLabel, dangerous = false, onCancel, onConfirm }: {
  open: boolean; title: string; body: string; confirmLabel: string; dangerous?: boolean;
  onCancel(): void; onConfirm(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <dialog ref={dialog} onCancel={onCancel} className="confirm-dialog">
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="dialog-actions">
        <button className="button button--secondary" onClick={onCancel}>Cancel</button>
        <button className={dangerous ? 'button button--danger' : 'button'} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
