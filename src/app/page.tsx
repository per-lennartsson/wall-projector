'use client';

import { useAuth } from '@/hooks/useAuth';
import LocalEditorPage from '@/components/LocalEditorPage';
import ProjectPickerPage from '@/components/ProjectPickerPage';

// Logged-out (or never-logged-in) users go straight into the local-mode
// editor — no forced login wall. Logged-in users land on their project
// picker instead. `ready` gates this on whether the session check has
// resolved, so a returning logged-in user isn't flashed the local editor
// before their session is restored.
export default function HomePage() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? <ProjectPickerPage /> : <LocalEditorPage />;
}
