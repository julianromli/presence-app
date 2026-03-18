'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type WorkspaceHubDialogMode = 'create' | 'join' | null;

type WorkspaceHubDialogProps = {
  mode: WorkspaceHubDialogMode;
  open: boolean;
  pendingAction: 'none' | 'switch' | 'create' | 'join';
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => Promise<boolean>;
};

const COPY_BY_MODE = {
  create: {
    title: 'Buat workspace baru',
    description:
      'Masukkan nama workspace yang ingin Anda tambahkan. Anda akan langsung berpindah ke workspace baru ini.',
    placeholder: 'Contoh: Presence Ops',
    actionLabel: 'Buat workspace baru',
  },
  join: {
    title: 'Gabung workspace',
    description:
      'Masukkan invitation code dari workspace tujuan. Jika berhasil, workspace akan langsung menjadi aktif.',
    placeholder: 'Contoh: TEAM-7K4M-ABSENIN',
    actionLabel: 'Gabung workspace',
  },
} as const;

export function WorkspaceHubDialog({
  mode,
  open,
  pendingAction,
  onOpenChange,
  onSubmit,
}: WorkspaceHubDialogProps) {
  const [value, setValue] = useState('');

  if (!mode) {
    return null;
  }

  const copy = COPY_BY_MODE[mode];
  const isSubmitting = pendingAction === mode;
  const trimmedValue = mode === 'join' ? value.trim().toUpperCase() : value.trim();
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setValue('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog key={mode} open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogPanel>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                try {
                  const succeeded = await onSubmit(trimmedValue);
                  if (succeeded) {
                    handleOpenChange(false);
                  }
                } catch {
                  // The provider is responsible for surfacing the notice.
                }
              })();
            }}
          >
            <Input
              autoFocus
              value={value}
              onChange={(event) =>
                setValue(
                  mode === 'join'
                    ? event.target.value.toUpperCase()
                    : event.target.value,
                )
              }
              placeholder={copy.placeholder}
            />

            <DialogFooter>
              <Button
                type="submit"
                disabled={trimmedValue.length < 3}
                isLoading={isSubmitting}
                loadingText={copy.actionLabel}
              >
                {copy.actionLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
