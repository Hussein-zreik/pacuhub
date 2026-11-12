/** Developer-facing screen when required configuration is missing. */
import { Settings2 } from 'lucide-react';
import { FullPageMessage } from '@/components/feedback/FullPageMessage';

export function SetupRequiredPage({ issues }: { issues: string[] }) {
  return (
    <FullPageMessage icon={Settings2} title="Configuration required">
      <p>PACU Hub can't start until the following is configured:</p>
      <ul className="space-y-2 rounded-lg bg-canvas p-4 text-left text-xs">
        {issues.map((issue) => (
          <li key={issue} className="font-mono">
            {issue}
          </li>
        ))}
      </ul>
      <p className="text-xs">
        Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>, fill in the
        values, and restart the dev server.
      </p>
    </FullPageMessage>
  );
}
