import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { describeError } from '../lib/errors';
import { Button } from './Button';
import { Icon } from './Icon';

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'danger';
const TONE_ICON = { info: 'info', success: 'check', warning: 'alert', danger: 'alert' } as const;

export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={TONE_ICON[tone]} size={20} />
      <div>
        {title && <p className="notice__title">{title}</p>}
        {children && <div className="notice__text">{children}</div>}
      </div>
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="stack">
      <Notice tone="danger" title={t('error.title')}>
        {describeError(t, error)}
      </Notice>
      {onRetry && (
        <div>
          <Button icon={<Icon name="refresh" />} onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2 className="empty__title">{title}</h2>
      {children && <p className="empty__text">{children}</p>}
      {action}
    </div>
  );
}
