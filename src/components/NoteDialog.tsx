import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';

export function NoteDialog({
  open,
  reference,
  initialNote,
  onSave,
  onClose,
}: {
  open: boolean;
  reference: string;
  initialNote: string;
  onSave: (note: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (open) setNote(initialNote);
  }, [open, initialNote]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Note on ${reference}`}
      description="Private to you. Notes never change the Scripture text."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              void onSave(note);
            }}
          >
            Save note
          </Button>
        </>
      }
    >
      <TextArea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What keeps tripping you up? Cross references, context, phrasing to watch."
        aria-label={`Note on ${reference}`}
        autoFocus
      />
    </Dialog>
  );
}
