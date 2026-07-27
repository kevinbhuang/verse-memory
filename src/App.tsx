import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { SettingsProvider } from '@/hooks/useSettings';
import { ToastProvider } from '@/components/ui/Toast';
import { DashboardPage } from '@/pages/DashboardPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { VerseDetailPage } from '@/pages/VerseDetailPage';
import { ReviewSetupPage } from '@/pages/ReviewSetupPage';
import { ReviewSessionPage } from '@/pages/ReviewSessionPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/verses" element={<LibraryPage />} />
              <Route path="/verses/:verseId" element={<VerseDetailPage />} />
              <Route path="/review" element={<ReviewSetupPage />} />
              <Route path="/review/session" element={<ReviewSessionPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/index.html" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SettingsProvider>
  );
}
