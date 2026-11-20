import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { diplomasApi } from '../api/diplomas';
import { useAuth } from '../auth/AuthProvider';
import { Attestation, Fields } from '../components/Attestation';
import { Button, ButtonLink } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import { Dialog } from '../components/Dialog';
import { ErrorNotice, Loading, Notice } from '../components/Feedback';
import { SelectField, TextArea, TextField } from '../components/Field';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { QrCode } from '../components/QrCode';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { config } from '../config';
import { useI18n } from '../i18n';
import { describeError, isForbidden, isNotFound } from '../lib/errors';
import { shortId, UUID_RE } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useSeo } from '../lib/useSeo';
import type { HistoryEntry, ShareLink } from '../types';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DiplomaDetail() {
  const { id = '' } = useParams();
  const { t, date, dateTime } = useI18n();
  const { hasRole } = useAuth();
  const notify = useToast();

  const staff = hasRole('university', 'ministry');
  const canDownload = hasRole('university', 'ministry', 'student');
  const canShare = hasRole('student') && !staff;
  const validId = UUID_RE.test(id);

  const record = useAsync(() => (validId ? diplomasApi.get(id) : Promise.reject(new ApiError(404, 'invalid'))), [id]);
  const history = useAsync(() => (staff && validId ? diplomasApi.history(id) : Promise.resolve<HistoryEntry[]>([])), [id, staff]);

  useSeo({
    title: record.data ? record.data.degree : t('detail.title'),
    description: t('detail.title'),
    path: `/diplomas/${id}`,
    noindex: true,
  });

  const [downloading, setDownloading] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [revoking, setRevoking] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [ttl, setTtl] = useState('1440');
  const [sharing, setSharing] = useState(false);
  const [link, setLink] = useState<ShareLink | null>(null);
  const [dialogError, setDialogError] = useState<string>();

  async function download() {
    setDownloading(true);
    try {
      saveBlob(await diplomasApi.document(id), `diplome-${shortId(id)}.pdf`);
    } catch (err) {
      notify('error', describeError(t, err));
    } finally {
      setDownloading(false);
    }
  }

  async function downloadCredential() {
    try {
      saveBlob(await diplomasApi.credential(id), `diplome-${shortId(id)}.openbadge.json`);
    } catch (err) {
      notify('error', describeError(t, err));
    }
  }

  async function revoke() {
    if (reason.trim().length < 3) {
      setReasonError(t('revoke.err.reason'));
      return;
    }
    setRevoking(true);
    setDialogError(undefined);
    try {
      await diplomasApi.revoke(id, reason.trim());
      setRevokeOpen(false);
      setReason('');
      notify('success', t('revoke.success'));
      record.reload();
      history.reload();
    } catch (err) {
      setDialogError(describeError(t, err));
    } finally {
      setRevoking(false);
    }
  }

  async function createLink() {
    setSharing(true);
    setDialogError(undefined);
    try {
      setLink(await diplomasApi.share(id, Number(ttl)));
    } catch (err) {
      setDialogError(describeError(t, err));
    } finally {
      setSharing(false);
    }
  }

  function closeShare() {
    setShareOpen(false);
    setLink(null);
    setDialogError(undefined);
  }

  if (record.loading && !record.data) return <Loading />;
  if (record.error !== undefined && !record.data) {
    if (isNotFound(record.error) || isForbidden(record.error)) {
      return (
        <>
          <PageHeader title={t('detail.title')} />
          <Notice tone="warning" title={isNotFound(record.error) ? t('detail.notFound.title') : t('detail.forbidden.title')}>
            {isNotFound(record.error) ? t('detail.notFound.text') : t('detail.forbidden.text')}
          </Notice>
        </>
      );
    }
    return <ErrorNotice error={record.error} onRetry={record.reload} />;
  }
  const d = record.data;
  if (!d) return null;

  const revoked = d.status === 'REVOKED';
  const shareUrl = link ? `${window.location.origin}/v/${link.token}` : '';

  // Une seule action principale par vue : partager pour l'étudiant, télécharger pour l'établissement
  const primary =
    canShare && !revoked ? (
      <Button variant="primary" icon={<Icon name="share" />} onClick={() => setShareOpen(true)}>
        {t('detail.share')}
      </Button>
    ) : staff ? (
      <Button variant="primary" icon={<Icon name="download" />} onClick={download} loading={downloading}>
        {t('detail.download')}
      </Button>
    ) : null;

  return (
    <>
      <PageHeader
        title={d.degree}
        description={d.major || undefined}
        actions={
          <>
            {canDownload && !staff && (
              <Button icon={<Icon name="download" />} onClick={download} loading={downloading}>
                {t('detail.download')}
              </Button>
            )}
            {canDownload && (
              <Button icon={<Icon name="file" />} onClick={downloadCredential}>
                {t('detail.credential')}
              </Button>
            )}
            {primary}
          </>
        }
      />

      <div className="stack">
        <Attestation
          tone={revoked ? 'revoked' : 'valid'}
          status={revoked ? t('detail.status.revoked') : t('detail.status.valid')}
          title={t('detail.record')}
        >
          <div className="preview">
            <Fields
              items={[
                { label: t('field.institution'), value: d.institution },
                { label: t('field.major'), value: d.major || t('common.none') },
                { label: t('field.issueDate'), value: date(d.issueDate) },
                { label: t('field.status'), value: <StatusBadge status={d.status} /> },
                {
                  label: t('field.reference'),
                  value: (
                    <span className="inline-copy">
                      <span className="is-data">{d.diplomaId}</span>
                      <CopyButton value={d.diplomaId} />
                    </span>
                  ),
                },
                {
                  label: t('tx.id'),
                  value: (
                    <span className="inline-copy">
                      <span className="is-data">{d.txId}</span>
                      <CopyButton value={d.txId} />
                    </span>
                  ),
                },
                {
                  label: t('field.hash'),
                  value: (
                    <span className="inline-copy">
                      <span className="is-data">{d.documentHash}</span>
                      <CopyButton value={d.documentHash} />
                    </span>
                  ),
                },
                { label: t('field.studentRef'), value: d.studentRef, data: true },
                { label: t('detail.recordedAt'), value: dateTime(d.createdAt) },
                ...(revoked
                  ? [
                      { label: t('detail.revokedAt'), value: d.revokedAt ? dateTime(d.revokedAt) : t('common.none') },
                      { label: t('detail.revokeReason'), value: d.revokeReason ?? t('common.none') },
                    ]
                  : []),
              ]}
            />
            <QrCode value={`${config.siteUrl}/verify?tx=${d.txId}`} label={t('tx.qr.alt')} />
          </div>
        </Attestation>

        {hasRole('recruiter') && !staff && (
          <Notice tone="info" title={t('detail.recruiter.title')}>
            {t('detail.recruiter.text')} <ButtonLink to={`/verify?id=${d.diplomaId}`}>{t('nav.verify')}</ButtonLink>
          </Notice>
        )}

        {staff && (
          <section aria-labelledby="history-title" className="section">
            <h2 id="history-title">{t('history.title')}</h2>
            {history.loading && !history.data && <Loading />}
            {history.error !== undefined && !history.data && <ErrorNotice error={history.error} onRetry={history.reload} />}
            {history.data && history.data.length > 0 && <HistoryTimeline entries={history.data} />}
          </section>
        )}

        {staff && !revoked && (
          <section className="sensitive" aria-labelledby="sensitive-title">
            <p id="sensitive-title">
              <strong>{t('detail.sensitive.title')}</strong>
            </p>
            <p>{t('detail.sensitive.text')}</p>
            <Button variant="dangerlink" onClick={() => setRevokeOpen(true)}>
              {t('detail.revoke')}
            </Button>
          </section>
        )}
      </div>

      <Dialog
        open={revokeOpen}
        onClose={() => {
          setRevokeOpen(false);
          setDialogError(undefined);
          setReasonError(undefined);
        }}
        title={t('revoke.title')}
        actions={
          <>
            <Button variant="link" onClick={() => setRevokeOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={revoking} onClick={revoke}>
              {t('revoke.confirm')}
            </Button>
          </>
        }
      >
        <p>{t('revoke.text')}</p>
        {dialogError && <Notice tone="danger">{dialogError}</Notice>}
        <TextArea
          id="reason"
          label={t('revoke.reason')}
          hint={t('revoke.reason.hint')}
          required
          rows={4}
          maxLength={500}
          value={reason}
          error={reasonError}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError(undefined);
          }}
        />
      </Dialog>

      <Dialog
        open={shareOpen}
        onClose={closeShare}
        title={t('share.title')}
        actions={
          link ? (
            <Button variant="primary" onClick={closeShare}>
              {t('common.done')}
            </Button>
          ) : (
            <>
              <Button variant="link" onClick={closeShare}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" loading={sharing} onClick={createLink}>
                {t('share.create')}
              </Button>
            </>
          )
        }
      >
        {!link ? (
          <>
            <p>{t('share.text')}</p>
            {dialogError && <Notice tone="danger">{dialogError}</Notice>}
            <SelectField id="ttl" label={t('share.validity')} value={ttl} onChange={(e) => setTtl(e.target.value)}>
              <option value="60">{t('share.ttl.hour')}</option>
              <option value="1440">{t('share.ttl.day')}</option>
              <option value="10080">{t('share.ttl.week')}</option>
            </SelectField>
          </>
        ) : (
          <>
            <p>{t('share.ready', { date: dateTime(link.expiresAt) })}</p>
            <TextField id="share-url" label={t('share.link')} value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
            <CopyButton value={shareUrl} label={t('share.copy')} />
            <p className="field__hint">{t('share.privacy')}</p>
          </>
        )}
      </Dialog>
    </>
  );
}
