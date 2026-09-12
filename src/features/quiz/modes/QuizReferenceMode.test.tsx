import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { requireVerse } from '@/data/verses';
import { renderWithProviders } from '@/test/render';
import type { QuizReferenceGrade } from '@/types/quiz';
import { QuizReferenceMode } from './QuizReferenceMode';

const verse = requireVerse('verse-009');

function setup(referenceGrade: QuizReferenceGrade = 'chapter-and-verse') {
  const onComplete = vi.fn();
  const onReferenceGradeChange = vi.fn();
  const view = renderWithProviders(
    <QuizReferenceMode
      verse={verse}
      attemptKey="attempt-1"
      onComplete={onComplete}
      referenceGrade={referenceGrade}
      onReferenceGradeChange={onReferenceGradeChange}
    />,
  );
  return { ...view, onComplete, onReferenceGradeChange };
}

const referenceField = () => screen.getByLabelText(/^reference$/i);
const chapterField = () => screen.getByLabelText(/^book and chapter$/i);

describe('QuizReferenceMode', () => {
  it('defaults to chapter and verse grading', () => {
    setup();

    expect(screen.getByRole('group', { name: /test on/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /chapter and verse/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('accepts the full reference', async () => {
    const { user, onComplete } = setup();

    await user.type(referenceField(), 'Job 42:5-6');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/correct/i);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, accuracy: 1 }),
    );
  });

  it('rejects book and chapter without verse numbers', async () => {
    const { user, onComplete } = setup();

    await user.type(referenceField(), 'Job 42');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/verse numbers/i);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ correct: false, accuracy: 0 }),
    );
  });

  it('rejects a different verse range in the same chapter', async () => {
    const { user, onComplete } = setup();

    await user.type(referenceField(), 'Job 42:8-9');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/verse numbers/i);
    expect(screen.getByRole('status')).toHaveTextContent('Job 42:5-6');
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ correct: false }),
    );
  });

  it('accepts book and chapter only when chapter grading is selected', async () => {
    const { user, onComplete } = setup('chapter');

    await user.type(chapterField(), 'Job 42');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    expect(screen.getByRole('status')).toHaveTextContent(
      /correct book and chapter/i,
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, accuracy: 1 }),
    );
  });

  it('notifies the parent when the grading toggle changes', async () => {
    const { user, onReferenceGradeChange } = setup();

    await user.click(screen.getByRole('button', { name: /chapter only/i }));

    expect(onReferenceGradeChange).toHaveBeenCalledWith('chapter');
  });
});
