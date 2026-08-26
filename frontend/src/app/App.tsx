import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../features/admin/AdminLayout.tsx';
import { AdminPlaceholder } from '../features/admin/AdminPlaceholder.tsx';
import { AdminOverview } from '../features/admin/AdminOverview.tsx';
import { AdminUsers } from '../features/admin/AdminUsers.tsx';
import { AdminAudit } from '../features/admin/AdminAudit.tsx';
import { AdminAdmins } from '../features/admin/AdminAdmins.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../contracts/errors.ts';
import { useSession } from '../features/auth/sessionStore.ts';
import { applyLanguage, applyTheme, usePreferences } from '../shared/stores/preferencesStore.ts';
import { AppShell } from '../features/layout/AppShell.tsx';
import { SignInPage } from '../features/auth/SignInPage.tsx';
import { RegisterPage } from '../features/auth/RegisterPage.tsx';
import { GeneratePage } from '../features/generate/GeneratePage.tsx';
import { HistoryPage } from '../features/history/HistoryPage.tsx';
import { AccountPage } from '../features/account/AccountPage.tsx';
import { RequireAnonymous, RequireAuth } from './guards.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry(failureCount, error) {
        // Nothing is gained by retrying a refusal — only a flaky connection.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

export function App() {
  const bootstrap = useSession((state) => state.bootstrap);
  const theme = usePreferences((state) => state.theme);
  const language = usePreferences((state) => state.language);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route
              path="/signin"
              element={
                <RequireAnonymous>
                  <SignInPage />
                </RequireAnonymous>
              }
            />
            <Route
              path="/register"
              element={
                <RequireAnonymous>
                  <RegisterPage />
                </RequireAnonymous>
              }
            />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route path="/generate" element={<GeneratePage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:id" element={<HistoryPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="activity" element={<AdminPlaceholder title="Activity" />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="admins" element={<AdminAdmins />} />
            </Route>
            <Route path="*" element={<Navigate to="/generate" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
