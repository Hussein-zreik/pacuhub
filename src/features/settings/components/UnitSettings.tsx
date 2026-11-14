/**
 * Unit settings (admins only — also enforced by firestore.rules). Each section
 * saves on its own and writes an activity-log entry.
 */
import { Save } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Alert, Button, Input, SegmentedControl, Select, Textarea } from '@/components/ui';
import { ACCESS_PRESETS } from '@/config/accessPresets';
import { useSettings } from '@/context/SettingsContext';
import { IDLE_MAX_MINUTES, IDLE_MIN_MINUTES, WARNING_OPTIONS, parseDomainList, type AppSettings } from '@/services/settings/model';
import { Field, SettingsSection, StampLine } from './Section';

type Status = { tone: 'success' | 'danger' | 'warning'; text: string } | null;

function useSaver() {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const run = async (fn: () => Promise<void>, ok: string) => {
    setSaving(true);
    setStatus(null);
    try {
      await fn();
      setStatus({ tone: 'success', text: ok });
    } catch {
      setStatus({ tone: 'danger', text: "Couldn't save. You may not have admin access, or the connection dropped." });
    } finally {
      setSaving(false);
    }
  };
  return { saving, status, setStatus, run };
}

function Footer({ saving, onSave, stamp, children }: { saving: boolean; onSave: () => void; stamp: ReactNode; children?: ReactNode }) {
  return (
    <>
      <Button onClick={onSave} loading={saving}>
        {!saving && <Save />} Save
      </Button>
      {children}
      <span className="ml-auto">{stamp}</span>
    </>
  );
}

const IDLE_OPTIONS = [2, 3, 5, 10, 15, 20, 30].filter((m) => m >= IDLE_MIN_MINUTES && m <= IDLE_MAX_MINUTES);

function SignOutSection() {
  const { publicSettings, publicStamp, savePublic } = useSettings();
  const ids = { max: useId(), warn: useId() };
  const [maxMinutes, setMax] = useState(publicSettings.idle.maxMinutes);
  const [warningSeconds, setWarn] = useState(publicSettings.idle.warningSeconds);
  useEffect(() => {
    setMax(publicSettings.idle.maxMinutes);
    setWarn(publicSettings.idle.warningSeconds);
  }, [publicSettings.idle]);
  const s = useSaver();
  return (
    <SettingsSection
      title="Auto sign-out after inactivity"
      description="Protects patient privacy on shared computers. This is the maximum: staff may choose a shorter time for themselves, never longer."
      footer={
        <Footer
          saving={s.saving}
          stamp={<StampLine stamp={publicStamp} />}
          onSave={() =>
            void s.run(
              () => savePublic({ ...publicSettings, idle: { maxMinutes, warningSeconds } }, `Set auto sign-out to ${maxMinutes} min (warning ${warningSeconds} s)`),
              'Saved. Applies to everyone within seconds.',
            )
          }
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sign everyone out after" htmlFor={ids.max}>
          <Select id={ids.max} value={maxMinutes} onChange={(e) => setMax(Number(e.target.value))}>
            {IDLE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Warning shown before sign-out" htmlFor={ids.warn}>
          <Select id={ids.warn} value={warningSeconds} onChange={(e) => setWarn(Number(e.target.value))}>
            {WARNING_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w} seconds
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {s.status && <Alert tone={s.status.tone}>{s.status.text}</Alert>}
    </SettingsSection>
  );
}

function SignUpSection() {
  const { publicSettings, publicStamp, savePublic } = useSettings();
  const domainsId = useId();
  const [enabled, setEnabled] = useState(publicSettings.signup.enabled);
  const [domains, setDomains] = useState(publicSettings.signup.allowedDomains.join(', '));
  useEffect(() => {
    setEnabled(publicSettings.signup.enabled);
    setDomains(publicSettings.signup.allowedDomains.join(', '));
  }, [publicSettings.signup]);
  const s = useSaver();

  const save = () => {
    const parsed = parseDomainList(domains);
    if (parsed.invalid.length) {
      s.setStatus({ tone: 'warning', text: `Not a valid domain: ${parsed.invalid.join(', ')}. Use the form aub.edu.lb` });
      return;
    }
    const summary = `Sign-up ${enabled ? 'on' : 'off'}${parsed.domains.length ? `, limited to ${parsed.domains.join(', ')}` : ', any email domain'}`;
    void s.run(() => savePublic({ ...publicSettings, signup: { enabled, allowedDomains: parsed.domains } }, summary), 'Saved.');
  };

  return (
    <SettingsSection
      title="Sign-up"
      description="Whether new staff can create their own account from the login screen. New accounts always wait for approval in Staff Access."
      footer={<Footer saving={s.saving} onSave={save} stamp={<StampLine stamp={publicStamp} />} />}
    >
      <Field label="Show “Create an account” on the login screen">
        <SegmentedControl
          label="Self sign-up"
          value={enabled ? 'on' : 'off'}
          onChange={(v) => setEnabled(v === 'on')}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
        />
      </Field>
      <Field
        label="Only allow these email domains (optional)"
        htmlFor={domainsId}
        hint="Comma-separated, e.g. aub.edu.lb, aubmc.org.lb. Leave empty to allow any. Applies to new sign-ups only — existing staff are unaffected."
      >
        <Input id={domainsId} value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="aub.edu.lb" spellCheck={false} />
      </Field>
      {!enabled && (
        <Alert tone="info">
          Turning this off hides the button. To block account creation completely, also untick “Enable create (sign-up)” in Firebase →
          Authentication → Settings → User actions.
        </Alert>
      )}
      {s.status && <Alert tone={s.status.tone}>{s.status.text}</Alert>}
    </SettingsSection>
  );
}

function ShiftSection() {
  const { appSettings, appStamp, saveApp } = useSettings();
  const ids = { start: useId(), end: useId() };
  const [dayStart, setStart] = useState(appSettings.shifts.dayStart);
  const [dayEnd, setEnd] = useState(appSettings.shifts.dayEnd);
  useEffect(() => {
    setStart(appSettings.shifts.dayStart);
    setEnd(appSettings.shifts.dayEnd);
  }, [appSettings.shifts]);
  const s = useSaver();
  const save = () => {
    if (!/^\d{2}:\d{2}$/.test(dayStart) || !/^\d{2}:\d{2}$/.test(dayEnd) || dayStart === dayEnd) {
      s.setStatus({ tone: 'warning', text: 'Enter two different times.' });
      return;
    }
    void s.run(() => saveApp({ ...appSettings, shifts: { dayStart, dayEnd } }, `Set shifts: Day ${dayStart}–${dayEnd}, Night ${dayEnd}–${dayStart}`), 'Saved.');
  };
  return (
    <SettingsSection
      title="Shift times"
      description="Used for the Day / Night shift indicator on Home. Night shift runs from the end of the day shift to its start."
      footer={<Footer saving={s.saving} onSave={save} stamp={<StampLine stamp={appStamp} />} />}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Day shift starts" htmlFor={ids.start}>
          <Input id={ids.start} type="time" value={dayStart} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Day shift ends (night starts)" htmlFor={ids.end}>
          <Input id={ids.end} type="time" value={dayEnd} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      {s.status && <Alert tone={s.status.tone}>{s.status.text}</Alert>}
    </SettingsSection>
  );
}

function AnnouncementSection() {
  const { appSettings, appStamp, saveApp } = useSettings();
  const ids = { text: useId(), until: useId() };
  const current = appSettings.announcement;
  const [text, setText] = useState(current?.text ?? '');
  const [tone, setTone] = useState<'info' | 'warning'>(current?.tone ?? 'info');
  const [expiresOn, setExpires] = useState(current?.expiresOn ?? '');
  useEffect(() => {
    setText(appSettings.announcement?.text ?? '');
    setTone(appSettings.announcement?.tone ?? 'info');
    setExpires(appSettings.announcement?.expiresOn ?? '');
  }, [appSettings.announcement]);
  const s = useSaver();

  const publish = () => {
    const t = text.trim();
    if (!t) {
      s.setStatus({ tone: 'warning', text: 'Write the announcement first, or use Remove.' });
      return;
    }
    const announcement: AppSettings['announcement'] = { text: t.slice(0, 280), tone, expiresOn: expiresOn || null };
    void s.run(() => saveApp({ ...appSettings, announcement }, `Published announcement: “${t.slice(0, 80)}”`), 'Published to everyone’s Home page.');
  };
  const remove = () => void s.run(() => saveApp({ ...appSettings, announcement: null }, 'Removed the announcement'), 'Announcement removed.');

  return (
    <SettingsSection
      title="Announcement"
      description="A message every staff member sees at the top of Home."
      footer={
        <>
          <Button onClick={publish} loading={s.saving}>
            {!s.saving && <Save />} Publish
          </Button>
          {current && (
            <Button variant="ghost" onClick={remove} disabled={s.saving}>
              Remove
            </Button>
          )}
          <span className="ml-auto">
            <StampLine stamp={appStamp} />
          </span>
        </>
      }
    >
      <Field label="Message" htmlFor={ids.text} hint={`${text.length} / 280`}>
        <Textarea id={ids.text} value={text} maxLength={280} onChange={(e) => setText(e.target.value)} placeholder="e.g. Fire drill on Tuesday at 10:00." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Style">
          <SegmentedControl
            label="Announcement style"
            value={tone}
            onChange={(v) => setTone(v as 'info' | 'warning')}
            options={[
              { value: 'info', label: 'Information' },
              { value: 'warning', label: 'Important' },
            ]}
          />
        </Field>
        <Field label="Show until (optional)" htmlFor={ids.until} hint="Last day it is shown. Leave empty to show until removed.">
          <Input id={ids.until} type="date" value={expiresOn} onChange={(e) => setExpires(e.target.value)} />
        </Field>
      </div>
      {s.status && <Alert tone={s.status.tone}>{s.status.text}</Alert>}
    </SettingsSection>
  );
}

function TemplateSection() {
  const { appSettings, appStamp, saveApp } = useSettings();
  const id = useId();
  const [template, setTemplate] = useState(appSettings.defaultTemplate);
  useEffect(() => setTemplate(appSettings.defaultTemplate), [appSettings.defaultTemplate]);
  const s = useSaver();
  const label = ACCESS_PRESETS.find((p) => p.id === template)?.label ?? template;
  return (
    <SettingsSection
      title="Default access for new staff"
      description="The template pre-selected when you review a new access request. You can still adjust it per person."
      footer={
        <Footer
          saving={s.saving}
          stamp={<StampLine stamp={appStamp} />}
          onSave={() => void s.run(() => saveApp({ ...appSettings, defaultTemplate: template }, `Default access template set to ${label}`), 'Saved.')}
        />
      }
    >
      <Field label="Template" htmlFor={id}>
        <Select id={id} value={template} onChange={(e) => setTemplate(e.target.value as AppSettings['defaultTemplate'])} className="sm:max-w-xs">
          {ACCESS_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>
      {s.status && <Alert tone={s.status.tone}>{s.status.text}</Alert>}
    </SettingsSection>
  );
}

export function UnitSettings() {
  return (
    <div className="space-y-4">
      <SignOutSection />
      <ShiftSection />
      <AnnouncementSection />
      <SignUpSection />
      <TemplateSection />
    </div>
  );
}
