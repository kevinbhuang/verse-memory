import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider } from '@/hooks/useAuth';
import { SettingsProvider } from '@/hooks/useSettings';
import { ToastProvider } from '@/components/ui/Toast';
import { LibraryPage } from '@/pages/LibraryPage';
import { FlashCardsPage } from '@/pages/FlashCardsPage';
import { VerseDetailPage } from '@/pages/VerseDetailPage';
import { PracticePage } from '@/pages/PracticePage';
import { QuizPage } from '@/pages/QuizPage';
import { QuizSessionPage } from '@/pages/QuizSessionPage';
import { ReviewSessionPage } from '@/pages/ReviewSessionPage';
import { PrintPage } from '@/pages/PrintPage';
import { ProgressChartPage } from '@/pages/ProgressChartPage';
import { FriendProgressChartPage } from '@/pages/FriendProgressChartPage';
import { MorePage } from '@/pages/MorePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/flashcards" replace />} />
                <Route path="/practice" element={<PracticePage />} />
                <Route path="/flashcards" element={<FlashCardsPage />} />
                <Route path="/quiz" element={<QuizPage />} />
                <Route path="/quiz/session" element={<QuizSessionPage />} />
                <Route path="/verses" element={<LibraryPage />} />
                <Route path="/verses/:verseId" element={<VerseDetailPage />} />
                <Route path="/progress-chart" element={<ProgressChartPage />} />
                <Route
                  path="/friends/:friendUid/progress-chart"
                  element={<FriendProgressChartPage />}
                />
                <Route path="/review/session" element={<ReviewSessionPage />} />
                <Route path="/print" element={<PrintPage />} />
                <Route path="/more" element={<MorePage />} />
                <Route path="/learn" element={<Navigate to="/practice" replace />} />
                <Route path="/review" element={<Navigate to="/practice" replace />} />
                <Route
                  path="/progress"
                  element={<Navigate to="/progress-chart" replace />}
                />
                <Route path="/settings" element={<Navigate to="/more" replace />} />
                <Route
                  path="/index.html"
                  element={<Navigate to="/flashcards" replace />}
                />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
