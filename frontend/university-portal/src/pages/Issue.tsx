import { useEffect, useRef, useState, type FormEvent } from 'react';
import { diplomasApi } from '../api/diplomas';
import { Attestation, Fields } from '../components/Attestation';
import { Button, ButtonLink } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import { Notice } from '../components/Feedback';
import { TextField } from '../components/Field';
import { FileDrop } from '../components/FileDrop';
import { PageHeader } from '../components/PageHeader';
import { QrCode } from '../components/QrCode';
import { useToast } from '../components/Toast';
import { config } from '../config';
import { useI18n, type MessageKey } from '../i18n';
import { describeError } from '../lib/errors';
import { looksLikePdf } from '../lib/hash';
import { useFileHash } from '../lib/useFileHash';
import { useSeo } from '../lib/useSeo';
import {
  normalizeIne,
  todayIso,
  validateBirthDate,
  validateDegree,
  validateEmail,
  validateFullName,
  validateIne,
  validateIssueDate,
  validateYear,
} from '../lib/validators';
import type { Diploma } from '../types';

const DEGREES = ['Licence', 'Licence professionnelle', 'Master', 'Master spécialisé', "Diplôme d'ingénieur", 'Doctorat'];
type Field = 'fullName' | 'birthDate' | 'studentId' | 'email' | 'degree' | 'year' | 'issueDate' | 'file';
type Errors = Partial<Record<Field, MessageKey>>;
const ANCHORS: Record<Field, string> = {
  fullName: 'fullName',
  birthDate: 'birthDate',
  studentId: 'studentId',
  email: 'email',
  degree: 'degree',
  year: 'year',
  issueDate: 'issueDate',
  file: 'file',
};

export function Issue() {
  const { t, date } = useI18n();
  const notify = useToast();
  useSeo({ title: t('issue.title'), description: t('issue.description'), path: '/issue', noindex: true });

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [degree, setDegree] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string[]>();
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Diploma | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryTick, setSummaryTick] = useState(0);
  const { hash, computing } = useFileHash(file);

  useEffect(() => {
    if (summaryTick > 0) summaryRef.current?.focus();
  }, [summaryTick]);

  async function chooseFile(f: File) {
    const tooBig = f.size > config.maxPdfMb * 1024 * 1024;
    const notPdf = !(f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) || !(await looksLikePdf(f));
    if (tooBig || notPdf) {
      setFile(null);
      setErrors((e) => ({ ...e, file: tooBig ? 'issue.err.fileSize' : 'issue.err.filePdf' }));
      return;
    }
    setErrors((e) => ({ ...e, file: undefined }));
    setFile(f);
  }

  function validate(): Errors {
    const next: Errors = {};
    const checks: Array<[Field, MessageKey | null]> = [
      ['fullName', validateFullName(fullName)],
      ['birthDate', validateBirthDate(birthDate)],
      ['studentId', validateIne(studentId)],
      ['email', validateEmail(email)],
      ['degree', validateDegree(degree)],
      ['year', validateYear(year)],
      ['issueDate', validateIssueDate(issueDate)],
    ];
    for (const [field, check] of checks) if (check) next[field] = check;
    if (!file) next.file = errors.file ?? 'issue.err.fileRequired';
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(undefined);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !file) {
      setSummaryTick((n) => n + 1);
      return;
    }
    setSubmitting(true);
    try {
      const diploma = await diplomasApi.create({
        studentId: normalizeIne(studentId),
        fullName: fullName.trim(),
        birthDate,
        email: email.trim().toLowerCase(),
        year: Number(year),
        institution: config.institution,
        degree: degree.trim(),
        major: major.trim(),
        issueDate,
        file,
      });
      setCreated(diploma);
      notify('success', t('issue.success.toast'));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError([describeError(t, err)]);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setFullName('');
    setBirthDate('');
    setStudentId('');
    setEmail('');
    setDegree('');
    setMajor('');
    setYear('');
    setIssueDate('');
    setFile(null);
    setErrors({});
    setSubmitError(undefined);
    setCreated(null);
  }

  if (created) {
    return (
      <>
        <PageHeader title={t('issue.title')} />
        <div className="stack">
          <Attestation tone="valid" status={t('issue.success.status')} title={created.degree}>
            <p className="attestation__lead">{t('issue.success.text')}</p>
            <div className="preview">
              <Fields
                items={[
                  { label: t('field.major'), value: created.major || t('common.none') },
                  { label: t('field.institution'), value: created.institution },
                  { label: t('field.issueDate'), value: date(created.issueDate) },
                  {
                    label: t('field.reference'),
                    value: (
                      <span className="inline-copy">
                        <span className="is-data">{created.diplomaId}</span>
                        <CopyButton value={created.diplomaId} />
                      </span>
                    ),
                  },
                  {
                    label: t('tx.id'),
                    value: (
                      <span className="inline-copy">
                        <span className="is-data">{created.txId}</span>
                        <CopyButton value={created.txId} />
                      </span>
                    ),
                  },
                  { label: t('field.hash'), value: created.documentHash, data: true },
                ]}
              />
              <QrCode value={`${config.siteUrl}/verify?tx=${created.txId}`} label={t('tx.qr.alt')} />
            </div>
          </Attestation>
          <div className="actions">
            <ButtonLink variant="primary" to={`/diplomas/${created.diplomaId}`}>
              {t('issue.success.open')}
            </ButtonLink>
            <Button variant="link" onClick={reset}>
              {t('issue.success.another')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  const errorEntries = Object.entries(errors).filter(([, v]) => v) as Array<[Field, MessageKey]>;

  return (
    <>
      <PageHeader title={t('issue.title')} description={t('issue.description')} />

      <form onSubmit={onSubmit} noValidate className="form form--wide">
        <div ref={summaryRef} tabIndex={-1} role={errorEntries.length > 0 ? 'alert' : undefined} className="error-summary-wrap">
          {errorEntries.length > 0 && (
            <div className="error-summary">
              <p className="error-summary__title">{t('form.errorSummary')}</p>
              <ul>
                {errorEntries.map(([field, key]) => (
                  <li key={field}>
                    <a href={`#${ANCHORS[field]}`}>{t(key, { max: config.maxPdfMb })}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {submitError && (
          <Notice tone="danger" title={t('issue.failed')}>
            {submitError[0]}
          </Notice>
        )}

        <p className="form__note">{t('form.required')}</p>

        <fieldset className="form__group">
          <legend>{t('issue.group.student')}</legend>
          <div className="form__row">
            <TextField
              id="fullName"
              label={t('access.fullName')}
              required
              autoComplete="off"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName && t(errors.fullName)}
              maxLength={120}
            />
            <TextField
              id="birthDate"
              type="date"
              label={t('access.birthDate')}
              required
              max={todayIso()}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              error={errors.birthDate && t(errors.birthDate)}
            />
          </div>
          <div className="form__row">
            <TextField
              id="studentId"
              label={t('issue.studentId')}
              hint={t('issue.studentId.hint')}
              required
              autoComplete="off"
              spellCheck={false}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.toUpperCase())}
              error={errors.studentId && t(errors.studentId)}
              maxLength={12}
            />
            <TextField
              id="email"
              type="email"
              label={t('access.email')}
              hint={t('issue.email.hint')}
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email && t(errors.email)}
              maxLength={254}
            />
          </div>
        </fieldset>

        <fieldset className="form__group">
          <legend>{t('issue.group.diploma')}</legend>
          <TextField id="institution" label={t('field.institution')} value={config.institution} readOnly />
          <div className="form__row">
            <TextField
              id="degree"
              label={t('issue.degree')}
              required
              list="degree-options"
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              error={errors.degree && t(errors.degree)}
              maxLength={200}
            />
            <datalist id="degree-options">
              {DEGREES.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <TextField id="major" label={t('issue.major')} value={major} onChange={(e) => setMajor(e.target.value)} maxLength={200} />
          </div>
          <div className="form__row">
            <TextField
              id="year"
              label={t('access.year')}
              hint={t('issue.year.hint')}
              required
              inputMode="numeric"
              autoComplete="off"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              error={errors.year && t(errors.year)}
              maxLength={4}
            />
            <TextField
              id="issueDate"
              type="date"
              label={t('issue.issueDate')}
              required
              max={todayIso()}
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              error={errors.issueDate && t(errors.issueDate)}
            />
          </div>
          <p className="field__hint">{t('issue.uniqueId.hint')}</p>
        </fieldset>

        <fieldset className="form__group">
          <legend>{t('issue.group.document')}</legend>
          <FileDrop
            id="file"
            label={t('issue.file')}
            hint={t('issue.file.hint', { max: config.maxPdfMb })}
            required
            file={file}
            error={errors.file && t(errors.file, { max: config.maxPdfMb })}
            onSelect={chooseFile}
            onClear={() => setFile(null)}
          />
          {file && (
            <div className="hashbox" aria-live="polite">
              <p className="hashbox__label">{t('field.hash')}</p>
              <p className="hashbox__value is-data">{computing ? t('common.computing') : hash}</p>
              <p className="hashbox__note">{t('issue.hash.note')}</p>
            </div>
          )}
        </fieldset>

        <div className="actions">
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? t('issue.submitting') : t('issue.submit')}
          </Button>
        </div>
      </form>
    </>
  );
}
