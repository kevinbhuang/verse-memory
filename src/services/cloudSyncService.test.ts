import { describe, expect, it } from 'vitest';
import { decideSyncAction } from './cloudSyncService';

describe('decideSyncAction', () => {
  it('pushes when only local data exists', () => {
    expect(
      decideSyncAction({
        cloudUpdatedAt: null,
        localStamp: '2026-07-29T12:00:00.000Z',
      }),
    ).toBe('push');
  });

  it('pulls when only cloud data exists', () => {
    expect(
      decideSyncAction({
        cloudUpdatedAt: '2026-07-29T12:00:00.000Z',
        localStamp: null,
      }),
    ).toBe('pull');
  });

  it('is a no-op when both sides are empty', () => {
    expect(
      decideSyncAction({ cloudUpdatedAt: null, localStamp: null }),
    ).toBe('noop');
  });

  it('pulls when the cloud copy is newer', () => {
    expect(
      decideSyncAction({
        cloudUpdatedAt: '2026-07-29T13:00:00.000Z',
        localStamp: '2026-07-29T12:00:00.000Z',
      }),
    ).toBe('pull');
  });

  it('pushes when the local copy is newer', () => {
    expect(
      decideSyncAction({
        cloudUpdatedAt: '2026-07-29T12:00:00.000Z',
        localStamp: '2026-07-29T13:00:00.000Z',
      }),
    ).toBe('push');
  });

  it('is a no-op when stamps match', () => {
    expect(
      decideSyncAction({
        cloudUpdatedAt: '2026-07-29T12:00:00.000Z',
        localStamp: '2026-07-29T12:00:00.000Z',
      }),
    ).toBe('noop');
  });
});
