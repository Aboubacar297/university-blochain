import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { diplomasApi, transactionsApi } from '../api/diplomas';
import { Button } from '../components/Button';
import { Notice } from '../components/Feedback';
import { TextField } from '../components/Field';
import { FileDrop } from '../components/FileDrop';
import { PageHeader } from '../components/PageHeader';
import { Tabs } from '../components/Tabs';
import { TransactionResult } from '../components/TransactionResult';
import { VerificationView } from '../components/VerificationView';
import { config } from '../config';
import { useI18n, type MessageKey } from '../i18n';
import { describeError } from '../lib/errors';
import { UUID_RE } from '../lib/format';
import { looksLikePdf } from '../lib/hash';
import { useFileHash } from '../lib/useFileHash';
import { useSeo } from '../lib/useSeo';
import { isTxId } from '../lib/validators';
import type { TransactionVerification, VerificationResult } from '../types';

type Mode = 'tx' | 'document';

export function Verify() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  useSeo({ title: t('verify.title'), description: t('verify.description'), path: '/verify', noindex: true });

  const initialId = params.get('id') ?? '';
  const initialTx = params.get('tx') ?? '';
  const [mode, setMode] = useState<Mode>(initialId && !initialTx ? 'document' : 'tx');

  // ---------- Vérification par transaction ----------
  const [txInput, setTxInput] = useState(initialTx);
  const [txError, setTxError] = useState<MessageKey>();
  const [txLoading, setTxLoading] = useState(false);
  const [txFailure, setTxFailure] = useState<string>();
  const [txResult, setTxResult] = useState<TransactionVerification | null>(null);

  async function runTx(value: string) {
    const clean = value.trim().toLowerCase();
    setTxFailure(undefined);
    if (!isTxId(clean)) {
      setTxError('verify.err.tx');
      return;
    }
    setTxError(undefined);
    setTxLoading(true);
    try {
      setTxResult(await transactionsApi.verify(clean));
    } catch (err) {
      setTxResult(null);
      setTxFailure(describeError(t, err));
    } finally {
      setTxLoading(false);
    }
  }

  useEffect(() => {
    if (initialTx && isTxId(initialTx)) void runTx(initialTx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Vérification par document ----------
  const [diplomaId, setDiplomaId] = useState(initialId);
  const [file, setFile] = useState<File | null>(null);
  const [idError, setIdError] = useState<MessageKey>();
  const [fileError, setFileError] = useState<MessageKey>();
  const [docFailure, setDocFailure] = useState<string>();
  const [docLoading, setDocLoading] = useState(false);
  const [docResult, setDocResult] = useState<VerificationResult | null>(null);
  const { hash, computing } = useFileHash(file);

  async function chooseFile(f: File) {
    const tooBig = f.size > config.maxPdfMb * 1024 * 1024;
    const notPdf = !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) || !(await looksLikePdf(f));
    if (tooBig || notPdf) {
      setFile(null);
      setFileError(tooBig ? 'issue.err.fileSize' : 'issue.err.filePdf');
      return;
    }
    setFileError(undefined);
    setFile(f);
  }

  async function onSubmitDoc(e: FormEvent) {
    e.preventDefault();
    setDocFailure(undefined);
    const badId = !UUID_RE.test(diplomaId.trim());
    setIdError(badId ? 'verify.err.id' : undefined);
    if (!file) setFileError(fileError ?? 'issue.err.fileRequired');
    if (badId || !file) return;
    setDocLoading(true);
    try {
      setDocResult(await diplomasApi.verify(diplomaId.trim(), file));
    } catch (err) {
      setDocFailure(describeError(t, err));
    } finally {
      setDocLoading(false);
    }
  }

  return (
    <>
      <PageHeader title={t('verify.title')} description={t('verify.description')} />

      <Tabs
        label={t('verify.modes')}
        tabs={[
          { id: 'tx' as Mode, label: t('verify.tab.tx') },
          { id: 'document' as Mode, label: t('verify.tab.document') },
        ]}
        value={mode}
        onChange={setMode}
      >
        {mode === 'tx' ? (
          <div className="stack">
            {txResult ? (
              <>
                <TransactionResult result={txResult} />
                <div className="no-print">
                  <Button
                    variant="link"
                    onClick={() => {
                      setTxResult(null);
                      setTxInput('');
                    }}
                  >
                    {t('verify.tx.another')}
                  </Button>
                </div>
              </>
            ) : (
              <form
                noValidate
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void runTx(txInput);
                }}
              >
                {txFailure && (
                  <Notice tone="danger" title={t('verify.failed')}>
                    {txFailure}
                  </Notice>
                )}
                <TextField
                  id="txId"
                  label={t('verify.tx.label')}
                  hint={t('verify.tx.hint')}
                  required
                  value={txInput}
                  onChange={(e) => {
                    setTxInput(e.target.value);
                    setTxError(undefined);
                  }}
                  error={txError && t(txError)}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={64}
                />
                <div className="actions">
                  <Button type="submit" variant="primary" loading={txLoading}>
                    {txLoading ? t('verify.submitting') : t('verify.tx.submit')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : docResult ? (
          <div className="stack">
            <VerificationView result={docResult} mode="document" />
            <div className="no-print">
              <Button
                variant="link"
                onClick={() => {
                  setDocResult(null);
                  setFile(null);
                  setDiplomaId('');
                }}
              >
                {t('verify.another')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmitDoc} noValidate className="form">
            {docFailure && (
              <Notice tone="danger" title={t('verify.failed')}>
                {docFailure}
              </Notice>
            )}
            <p className="form__note">{t('form.required')}</p>
            <TextField
              id="diplomaId"
              label={t('verify.id')}
              hint={t('verify.id.hint')}
              required
              value={diplomaId}
              onChange={(e) => {
                setDiplomaId(e.target.value);
                setIdError(undefined);
              }}
              error={idError && t(idError)}
              autoComplete="off"
              spellCheck={false}
            />
            <FileDrop
              id="file"
              label={t('verify.file')}
              hint={t('verify.file.hint', { max: config.maxPdfMb })}
              required
              file={file}
              error={fileError && t(fileError, { max: config.maxPdfMb })}
              onSelect={chooseFile}
              onClear={() => setFile(null)}
            />
            {file && (
              <div className="hashbox" aria-live="polite">
                <p className="hashbox__label">{t('field.hash')}</p>
                <p className="hashbox__value is-data">{computing ? t('common.computing') : hash}</p>
              </div>
            )}
            <div className="actions">
              <Button type="submit" variant="primary" loading={docLoading}>
                {docLoading ? t('verify.submitting') : t('verify.submit')}
              </Button>
            </div>
            <p className="form__note spaced">{t('verify.privacy')}</p>
          </form>
        )}
      </Tabs>
    </>
  );
}
