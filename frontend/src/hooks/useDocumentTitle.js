import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · CIMS` : 'CIMS — College Internship Management System';
  }, [title]);
}
