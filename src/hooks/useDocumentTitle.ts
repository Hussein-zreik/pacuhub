import { useEffect } from 'react';
import { APP } from '@/config/app';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP.name}` : APP.name;
  }, [title]);
}
