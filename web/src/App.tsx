import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './routes/LoginPage';
import SignupPage from './routes/SignupPage';
import ProjectPickerPage from './routes/ProjectPickerPage';
import LocalEditorPage from './routes/LocalEditorPage';
import CloudEditorPage from './routes/CloudEditorPage';

// Logged-out (or never-logged-in) users go straight into the local-mode
// editor — no forced login wall. Logged-in users land on their project
// picker instead. `ready` gates this on whether the one-time silent-refresh
// check (see AuthContext) has resolved, so a returning logged-in user isn't
// flashed the local editor before their session is restored.
function Home() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? <ProjectPickerPage /> : <LocalEditorPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/project/:id" element={<CloudEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
