import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Button, Card, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This page doesn't exist or may have moved."
        action={
          <Link to="/">
            <Button>Back to Home</Button>
          </Link>
        }
      />
    </Card>
  );
}
