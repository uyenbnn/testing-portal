import { Injectable, signal } from '@angular/core';
import { getApps, initializeApp } from 'firebase/app';
import { Database, get, getDatabase, ref, remove, set } from 'firebase/database';
import { environment } from '../../../environments/environment';
import { OptionKey, PublishedTest, TestQuestion } from '../../shared/models/test.models';

@Injectable({ providedIn: 'root' })
export class TestRepositoryService {
  private readonly database: Database;
  private readonly tests = signal(new Map<string, PublishedTest>());

  constructor() {
    const app = getApps()[0] ?? initializeApp(environment.firebase);
    this.database = getDatabase(app);
  }

  async isCodeTaken(code: string): Promise<boolean> {
    if (this.tests().has(code)) {
      return true;
    }

    const snapshot = await get(ref(this.database, `tests/${code}`));
    return snapshot.exists();
  }

  async publishTest(test: PublishedTest): Promise<void> {
    await set(ref(this.database, `tests/${test.code}`), test);
    this.cacheTest(test);
  }

  async listPublishedTests(): Promise<PublishedTest[]> {
    const snapshot = await get(ref(this.database, 'tests'));
    if (!snapshot.exists()) {
      this.replaceCache([]);
      return [];
    }

    const tests = this.toPublishedTests(snapshot.val());
    this.replaceCache(tests);
    return tests;
  }

  async deleteTest(code: string): Promise<void> {
    await remove(ref(this.database, `tests/${code}`));
    this.removeCachedTest(code);
  }

  async findByCode(code: string): Promise<PublishedTest | null> {
    const test = this.tests().get(code);
    if (test) {
      return test;
    }

    const snapshot = await get(ref(this.database, `tests/${code}`));
    if (!snapshot.exists()) {
      return null;
    }

    const parsed = this.toPublishedTest(snapshot.val(), code);
    if (!parsed) {
      return null;
    }

    this.cacheTest(parsed);
    return parsed;
  }

  private toPublishedTests(value: unknown): PublishedTest[] {
    if (!value || typeof value !== 'object') {
      return [];
    }

    return Object.entries(value).flatMap(([code, candidate]) => {
      const parsed = this.toPublishedTest(candidate, code);
      return parsed ? [parsed] : [];
    });
  }

  private replaceCache(tests: PublishedTest[]): void {
    this.tests.set(new Map(tests.map((test) => [test.code, test])));
  }

  private cacheTest(test: PublishedTest): void {
    const nextMap = new Map(this.tests());
    nextMap.set(test.code, test);
    this.tests.set(nextMap);
  }

  private removeCachedTest(code: string): void {
    const nextMap = new Map(this.tests());
    nextMap.delete(code);
    this.tests.set(nextMap);
  }

  private toPublishedTest(value: unknown, expectedCode: string): PublishedTest | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<PublishedTest>;
    if (
      typeof candidate.code !== 'string' ||
      candidate.code !== expectedCode ||
      typeof candidate.title !== 'string' ||
      typeof candidate.durationMinutes !== 'number' ||
      !Array.isArray(candidate.questions) ||
      !this.isAnswerKey(candidate.answerKey) ||
      typeof candidate.createdAtIso !== 'string'
    ) {
      return null;
    }

    const questions = candidate.questions.filter((question) => this.isQuestion(question));
    if (questions.length !== candidate.questions.length) {
      return null;
    }

    return {
      code: candidate.code,
      title: candidate.title,
      durationMinutes: candidate.durationMinutes,
      questions,
      answerKey: candidate.answerKey,
      createdAtIso: candidate.createdAtIso
    };
  }

  private isQuestion(question: unknown): question is TestQuestion {
    if (!question || typeof question !== 'object') {
      return false;
    }

    const candidate = question as Partial<TestQuestion>;
    return (
      typeof candidate.number === 'number' &&
      typeof candidate.prompt === 'string' &&
      !!candidate.options &&
      typeof candidate.options.A === 'string' &&
      typeof candidate.options.B === 'string' &&
      typeof candidate.options.C === 'string' &&
      typeof candidate.options.D === 'string'
    );
  }

  private isAnswerKey(answerKey: unknown): answerKey is Record<number, OptionKey> {
    if (!answerKey || typeof answerKey !== 'object') {
      return false;
    }

    return Object.values(answerKey).every((option) => option === 'A' || option === 'B' || option === 'C' || option === 'D');
  }
}
