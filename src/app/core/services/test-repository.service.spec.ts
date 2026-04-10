import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  getMock: vi.fn(),
  getAppsMock: vi.fn(() => []),
  initializeAppMock: vi.fn(() => ({ name: 'app' })),
  getDatabaseMock: vi.fn(() => ({ name: 'database' })),
  refMock: vi.fn((_database: unknown, path?: string) => ({ path })),
  setMock: vi.fn(),
  removeMock: vi.fn()
}));

vi.mock('firebase/app', () => ({
  getApps: firebaseMocks.getAppsMock,
  initializeApp: firebaseMocks.initializeAppMock
}));

vi.mock('firebase/database', () => ({
  get: firebaseMocks.getMock,
  getDatabase: firebaseMocks.getDatabaseMock,
  ref: firebaseMocks.refMock,
  set: firebaseMocks.setMock,
  remove: firebaseMocks.removeMock
}));

import { TestRepositoryService } from './test-repository.service';

describe('TestRepositoryService', () => {
  let service: TestRepositoryService;

  beforeEach(() => {
    firebaseMocks.getMock.mockReset();
    firebaseMocks.getAppsMock.mockReset();
    firebaseMocks.initializeAppMock.mockReset();
    firebaseMocks.getDatabaseMock.mockReset();
    firebaseMocks.refMock.mockReset();
    firebaseMocks.setMock.mockReset();
    firebaseMocks.removeMock.mockReset();

    firebaseMocks.getAppsMock.mockReturnValue([]);
    firebaseMocks.initializeAppMock.mockReturnValue({ name: 'app' });
    firebaseMocks.getDatabaseMock.mockReturnValue({ name: 'database' });
    firebaseMocks.refMock.mockImplementation((_database: unknown, path?: string) => ({ path }));
    firebaseMocks.setMock.mockResolvedValue(undefined);
    firebaseMocks.removeMock.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [TestRepositoryService]
    });

    service = TestBed.inject(TestRepositoryService);
  });

  it('lists valid published tests and drops malformed entries', async () => {
    firebaseMocks.getMock.mockResolvedValue({
      exists: () => true,
      val: () => ({
        '111111': {
          code: '111111',
          title: 'Algebra Quiz',
          durationMinutes: 25,
          questions: [
            {
              number: 1,
              prompt: '2 + 2 = ?',
              options: { A: '3', B: '4', C: '5', D: '6' }
            }
          ],
          answerKey: { 1: 'B' },
          createdAtIso: '2026-04-10T09:00:00.000Z'
        },
        '222222': {
          code: '999999',
          title: 'Broken Test',
          durationMinutes: 10,
          questions: [],
          answerKey: {},
          createdAtIso: '2026-04-10T08:00:00.000Z'
        }
      })
    } as never);

    const tests = await service.listPublishedTests();

    expect(firebaseMocks.refMock).toHaveBeenCalledWith({ name: 'database' }, 'tests');
    expect(tests).toEqual([
      {
        code: '111111',
        title: 'Algebra Quiz',
        durationMinutes: 25,
        questions: [
          {
            number: 1,
            prompt: '2 + 2 = ?',
            options: { A: '3', B: '4', C: '5', D: '6' }
          }
        ],
        answerKey: { 1: 'B' },
        createdAtIso: '2026-04-10T09:00:00.000Z'
      }
    ]);
  });

  it('removes deleted tests from the cache', async () => {
    await service.publishTest({
      code: '333333',
      title: 'Physics',
      durationMinutes: 30,
      questions: [
        {
          number: 1,
          prompt: 'Speed unit?',
          options: { A: 'm/s', B: 'kg', C: 'L', D: 'mol' }
        }
      ],
      answerKey: { 1: 'A' },
      createdAtIso: '2026-04-10T10:00:00.000Z'
    });

    firebaseMocks.getMock.mockResolvedValue({
      exists: () => false,
      val: () => null
    } as never);

    await service.deleteTest('333333');
    const found = await service.findByCode('333333');

    expect(firebaseMocks.removeMock).toHaveBeenCalledWith({ path: 'tests/333333' });
    expect(found).toBeNull();
    expect(firebaseMocks.getMock).toHaveBeenCalledWith({ path: 'tests/333333' });
  });
});
