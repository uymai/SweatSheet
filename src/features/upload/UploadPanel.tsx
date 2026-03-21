import type { ChangeEvent } from 'react';
import { SectionCard } from '../../components/SectionCard';

interface UploadPanelProps {
  fileName: string | null;
  isBusy: boolean;
  canReprocess: boolean;
  statusMessage: string;
  onSelectFile: (file: File | null) => void;
  onReprocess: () => void;
}

export function UploadPanel({
  fileName,
  isBusy,
  canReprocess,
  statusMessage,
  onSelectFile,
  onReprocess,
}: UploadPanelProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSelectFile(event.target.files?.[0] ?? null);
  };

  return (
    <SectionCard
      title="Peloton CSV Upload"
      subtitle="All parsing and analytics happen in your browser. Nothing leaves your device."
      actions={
        <button className="button button--secondary" disabled={!canReprocess || isBusy} onClick={onReprocess}>
          Reprocess Data
        </button>
      }
    >
      <div className="upload-panel">
        <label className="button button--primary file-picker">
          <input accept=".csv" type="file" onChange={handleFileChange} />
          <span>{isBusy ? 'Processing…' : 'Choose CSV File'}</span>
        </label>
        <div className="upload-panel__meta">
          <strong>{fileName ?? 'No file selected'}</strong>
          <span>{statusMessage}</span>
        </div>
      </div>
    </SectionCard>
  );
}
