import { Injectable, signal } from '@angular/core';
import { getApps, initializeApp } from 'firebase/app';
import { Database, get, getDatabase, ref, set } from 'firebase/database';
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

    const nextMap = new Map(this.tests());
    nextMap.set(test.code, test);
    this.tests.set(nextMap);
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

    const nextMap = new Map(this.tests());
    nextMap.set(parsed.code, parsed);
    this.tests.set(nextMap);
    return parsed;
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
