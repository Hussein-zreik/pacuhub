/**
 * Each person's own preferences. Changes save immediately and follow the
 * person (not the computer) — a shared workstation never keeps them.
 */
import { Check, Loader2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Alert, SegmentedControl, Select } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useAccessibleModules } from '@/core/modules/ModuleRegistryContext';
import { IDLE_MIN_MINUTES, type UserPrefs } from '@/services/settings/model';
import { Field, SettingsSection } from './Section';

const IDLE_CHOICES = [2, 3, 5, 10, 15, 20, 30];

export function PersonalSettings() {
  const { prefs, savePrefs, publicSettings, idle } = useSettings();
  const modules = useAccessibleModules().filter((m) => m.showInNav && m.id !== 'settings');
  const ids = { start: useId(), idle: useId() };
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const update = async (patch: Partial<UserPrefs>) => {
    setStatus('saving');
    try {
      await savePrefs({ ...prefs, ...patch });
      setStatus('saved');
      window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1800);
    } catch {
      setStatus('error');
    }
  };

  const unitMax = publicSettings.idle.maxMinutes;
  const shorter = IDLE_CHOICES.filter((m) => m >= IDLE_MIN_MINUTES && m < unitMax);

  return (
    <div className="space-y-4">
      <div className="flex h-5 items-center justify-end text-xs text-ink-muted" aria-live="polite">
        {status === 'saving' && (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="size-3.5 animate-spin" /> Saving…
          </span>
        )}
        {status === 'saved' && (
          <span className="inline-flex items-center gap-1 text-success-700">
            <Check className="size-3.5" /> Saved
          </span>
        )}
      </div>
      {status === 'error' && <Alert tone="danger">Couldn't save your preference. Check the connection and try again.</Alert>}

      <SettingsSection title="Display" description="How PACU Hub looks for you. Applies on any computer you sign in to.">
        <Field label="Theme" hint="Dark is easier on the eyes on night shifts.">
          <SegmentedControl
            label="Theme"
            value={prefs.theme}
            onChange={(v) => void update({ theme: v as UserPrefs['theme'] })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'Match device' },
            ]}
          />
        </Field>
        <Field label="Text size">
          <SegmentedControl
            label="Text size"
            value={prefs.textSize}
            onChange={(v) => void update({ textSize: v as UserPrefs['textSize'] })}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' },
              { value: 'xlarge', label: 'Extra large' },
            ]}
          />
        </Field>
      </SettingsSection>

      <SettingsSection title="Start page" description="The tab that opens after you sign in.">
        <Field label="Open on" htmlFor={ids.start}>
          <Select id={ids.start} value={prefs.startPage ?? ''} onChange={(e) => void update({ startPage: e.target.value || null })} className="sm:max-w-xs">
            <option value="">Home</option>
            {modules
              .filter((m) => m.id !== 'home')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
          </Select>
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Auto sign-out"
        description={`The unit signs everyone out after ${unitMax} minutes of inactivity. You can choose a shorter time for yourself, but not a longer one.`}
      >
        <Field label="Sign me out after" htmlFor={ids.idle} hint={`Currently: ${idle.minutes} minutes.`}>
          <Select
            id={ids.idle}
            value={prefs.idleMinutes && prefs.idleMinutes < unitMax ? String(prefs.idleMinutes) : ''}
            onChange={(e) => void update({ idleMinutes: e.target.value ? Number(e.target.value) : null })}
            className="sm:max-w-xs"
          >
            <option value="">{unitMax} minutes (unit setting)</option>
            {shorter.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
      </SettingsSection>
    </div>
  );
}
