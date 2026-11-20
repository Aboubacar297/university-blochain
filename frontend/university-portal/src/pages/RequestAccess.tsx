import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { accessApi } from '../api/diplomas';
import { useAuth } from '../auth/AuthProvider';
import { Attestation, Fields } from '../components/Attestation';
import { Button } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import { Notice } from '../components/Feedback';
import { TextField } from '../components/Field';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { Turnstile } from '../components/Turnstile';
import { useI18n, type MessageKey } from '../i18n';
import { describeError } from '../lib/errors';
import { useSeo } from '../lib/useSeo';
import {
  normalizeIne,
  todayIso,
  validateBirthDate,
  validateDegree,
  validateEmail,
  validateFullName,
  validateIne,
  validateYear,
} from '../lib/validators';
import type { AccessGrant } from '../types';

const DEGREES = ['Licence', 'Licence professionnelle', 'Master', 'Master spécialisé', "Diplôme d'ingénieur", 'Doctorat'];
type Field = 'fullName' | 'birthDate' | 'ine' | 'email' | 'degree' | 'year' | 'turnstile';
type Errors = Partial<Record<Field, MessageKey>>;
const ANCHORS: Record<Field, string> = {
  fullName: 'fullName',
  birthDate: 'birthDate',
  ine: 'ine',
  email: 'email',
  degree: 'degree',
  year: 'year',
  turnstile: 'turnstile-zone',
};

export function RequestAccess() {
  const { t, date } = useI18n();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const regenerate = params.get('mode') === 'regenerate';

  useSeo({
    title: regenerate ? t('access.regenerate.title') : t('access.title'),
    description: t('seo.access.description'),
    path: '/request-access',
  });

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [ine, setIne] = useState('');
  const [email, setEmail] = useState('');
  const [degree, setDegree] = useState('');
  const [year, setYear] = useState('');
  const [website, setWebsite] = useState(''); // champ piège
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string[]>();
  const [grant, setGrant] = useState<AccessGrant | null>(null);
  const [revealed, setRevealed] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryTick, setSummaryTick] = useState(0);

  useEffect(() => {
    if (summaryTick > 0) summaryRef.current?.focus();
  }, [summaryTick]);

  function validate(): Errors {
    const next: Errors = {};
    const checks: Array<[Field, MessageKey | null]> = [
      ['fullName', validateFullName(fullName)],
      ['birthDate', validateBirthDate(birthDate)],
      ['ine', validateIne(ine)],
      ['email', validateEmail(email)],
      ['degree', validateDegree(degree)],
      ['year', validateYear(year)],
    ];
    for (const [field, check] of checks) if (check) next[field] = check;
    if (!token) next.turnstile = 'val.turnstile.required';
    return next;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(undefined);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !token) {
      setSummaryTick((n) => n + 1);
      return;
    }
    setSubmitting(true);
    try {
      const result = await accessApi.request({
        fullName: fullName.trim(),
        birthDate,
        ine: normalizeIne(ine),
        email: email.trim().toLowerCase(),
        degree: degree.trim(),
        year: Number(year),
        turnstileToken: token,
        website,
      });
      setGrant(result);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const details = err instanceof ApiError && err.status === 400 && err.details?.length ? err.details : [describeError(t, err)];
      setSubmitError(details);
      setResetKey((k) => k + 1); // un jeton Turnstile est à usage unique
    } finally {
      setSubmitting(false);
    }
  }

  if (grant) {
    return (
      <>
        <PageHeader title={regenerate ? t('access.regenerate.title') : t('access.title')} />
        <div className="stack">
          <Attestation tone="valid" status={t('access.success.status')} title={t('access.success.title')}>
            <p className="attestation__lead">{grant.mode === 'created' ? t('access.success.created') : t('access.success.regenerated')}</p>
            <Fields
              items={[
                { label: t('access.success.username'), value: <span className="is-data">{grant.username}</span> },
                {
                  label: t('access.success.password'),
                  value: (
                    <span className="inline-copy">
                      <span className="is-data" aria-live="polite">
                        {revealed ? grant.temporaryPassword : '•'.repeat(grant.temporaryPassword.length)}
                      </span>
                      <Button
                        variant="link"
                        className="btn--small"
                        icon={<Icon name={revealed ? 'eyeoff' : 'eye'} size={16} />}
                        onClick={() => setRevealed((v) => !v)}
                      >
                        {revealed ? t('access.success.hide') : t('access.success.show')}
                      </Button>
                      <CopyButton value={grant.temporaryPassword} label={t('access.success.copy')} />
                    </span>
                  ),
                },
                { label: t('access.success.expires'), value: date(grant.expiresAt) },
              ]}
            />
          </Attestation>
          <Notice tone="warning" title={t('access.success.once.title')}>
            {t('access.success.once.text')}
          </Notice>
          <div className="actions">
            <Button variant="primary" onClick={() => login('/')}>
              {t('auth.login')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  const errorEntries = Object.entries(errors).filter(([, v]) => v) as Array<[Field, MessageKey]>;

  return (
    <>
      <PageHeader
        title={regenerate ? t('access.regenerate.title') : t('access.title')}
        description={regenerate ? t('access.regenerate.description') : t('access.description')}
      />

      <form onSubmit={onSubmit} noValidate className="form" autoComplete="on">
        <div ref={summaryRef} tabIndex={-1} role={errorEntries.length > 0 ? 'alert' : undefined} className="error-summary-wrap">
          {errorEntries.length > 0 && (
            <div className="error-summary">
              <p className="error-summary__title">{t('form.errorSummary')}</p>
              <ul>
                {errorEntries.map(([field, key]) => (
                  <li key={field}>
                    <a href={`#${ANCHORS[field]}`}>{t(key)}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {submitError && (
          <Notice tone="danger" title={t('access.failed')}>
            {submitError.length === 1 ? (
              submitError[0]
            ) : (
              <ul>
                {submitError.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </Notice>
        )}

        <p className="form__note">{t('form.required')}</p>

        <div className="form__row">
          <TextField
            id="fullName"
            label={t('access.fullName')}
            required
            autoComplete="name"
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
            autoComplete="bday"
            max={todayIso()}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            error={errors.birthDate && t(errors.birthDate)}
          />
        </div>
        <TextField
          id="ine"
          label={t('access.ine')}
          hint={t('access.ine.hint')}
          required
          autoComplete="off"
          spellCheck={false}
          value={ine}
          onChange={(e) => setIne(e.target.value.toUpperCase())}
          error={errors.ine && t(errors.ine)}
          maxLength={12}
        />
        <TextField
          id="email"
          type="email"
          label={t('access.email')}
          hint={t('access.email.hint')}
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email && t(errors.email)}
          maxLength={254}
        />
        <div className="form__row">
          <TextField
            id="degree"
            label={t('access.degree')}
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
          <TextField
            id="year"
            label={t('access.year')}
            required
            inputMode="numeric"
            autoComplete="off"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            error={errors.year && t(errors.year)}
            maxLength={4}
          />
        </div>

        {/* Champ piège (honeypot) : invisible et inaccessible pour les humains */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="website">{t('access.honeypot')}</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <div id="turnstile-zone">
          <Turnstile onToken={setToken} resetKey={resetKey} />
          {errors.turnstile && (
            <p className="field__error">
              <Icon name="alert" size={16} />
              <span>{t(errors.turnstile)}</span>
            </p>
          )}
        </div>

        <div className="actions">
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? t('access.submitting') : t('access.submit')}
          </Button>
        </div>
        <p className="form__note spaced">
          {t('access.privacy')} <Link to="/privacy">{t('footer.privacy')}</Link>
        </p>
      </form>
    </>
  );
}
