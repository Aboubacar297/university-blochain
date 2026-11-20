import { useRef, useState, type DragEvent } from 'react';
import { useI18n } from '../i18n';
import { formatBytes } from '../lib/format';
import { Button } from './Button';
import { Icon } from './Icon';

interface FileDropProps {
  id: string;
  label: string;
  hint?: string;
  file: File | null;
  error?: string;
  required?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}

export function FileDrop({ id, label, hint, file, error, required, onSelect, onClear }: FileDropProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelect(dropped);
  }

  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <span className="field__label" id={`${id}-label`}>
        {label}
        {required && <span className="field__req" aria-hidden="true"> *</span>}
      </span>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}

      {file ? (
        <div className="filechip">
          <Icon name="file" size={22} />
          <div className="filechip__meta">
            <span className="filechip__name">{file.name}</span>
            <span className="filechip__size">{formatBytes(file.size)}</span>
          </div>
          <Button variant="quiet" onClick={() => { onClear(); inputRef.current?.focus(); }} icon={<Icon name="x" size={16} />}>
            {t('file.remove')}
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <Icon name="upload" size={24} />
          <span className="dropzone__title">{t('file.drop')}</span>
          <span className="dropzone__sub">{t('file.browse')}</span>
        </label>
      )}

      <input
        ref={inputRef}
        id={id}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) onSelect(picked);
          e.target.value = '';
        }}
      />

      {error && (
        <p id={errorId} className="field__error">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
