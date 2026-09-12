import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import {
  createQuizSessionFromPassages,
  getQuizSession,
} from '@/services/quizService';
import { QuizRunner } from './QuizRunner';

describe('QuizRunner reference grading', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps chapter-only grading for later questions after a toggle', async () => {
    const session = createQuizSessionFromPassages(
      [
        { id: 'custom-a', reference: 'Job 42:5-6', text: 'I had heard of you' },
        { id: 'custom-b', reference: 'John 3:16', text: 'For God so loved the world' },
      ],
      'reference',
      'Test quiz',
      { shuffle: false },
    );
    expect(session).not.toBeNull();

    const { user } = renderWithProviders(<QuizRunner quizId={session!.id} />);

    expect(
      screen.getByRole('button', { name: /chapter and verse/i }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /chapter only/i }));
    expect(
      screen.getByRole('button', { name: /chapter only/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(getQuizSession(session!.id)?.referenceGrade).toBe('chapter');

    await user.type(screen.getByLabelText(/book and chapter/i), 'Job 42');
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /correct book and chapter/i,
    );

    await user.click(screen.getByRole('button', { name: /next question/i }));

    expect(
      screen.getByRole('button', { name: /chapter only/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText(/book and chapter/i), 'John 3');
    await user.click(screen.getByRole('button', { name: /^check$/i }));
    expect(screen.getByRole('status')).toHaveTextContent(
      /correct book and chapter/i,
    );
    expect(getQuizSession(session!.id)?.referenceGrade).toBe('chapter');
  });
});
