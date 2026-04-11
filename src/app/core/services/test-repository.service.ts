import { Injectable, signal } from '@angular/core';
import { getApps, initializeApp } from 'firebase/app';
import { Database, get, getDatabase, ref, remove, set } from 'firebase/database';
import { environment } from '../../../environments/environment';
import { OptionKey, PublishedTest, ReadingPassage, TestCreatorInfo, TestQuestion, TestType } from '../../shared/models/test.models';

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

  async listPublishedTestsByCreator(creatorUid: string): Promise<PublishedTest[]> {
    const tests = await this.listPublishedTests();
    return tests.filter((test) => test.creator?.uid === creatorUid);
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
    const testType = this.normalizeTestType(candidate.testType);
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

    const questions = candidate.questions.filter((question) => this.isQuestion(question, testType));
    if (questions.length !== candidate.questions.length) {
      return null;
    }

    const passages = this.normalizePassages(candidate.passages, questions, testType);
    if (testType === 'reading' && passages === null) {
      return null;
    }

    return {
      code: candidate.code,
      title: candidate.title,
      testType,
      durationMinutes: candidate.durationMinutes,
      questions,
      passages: passages ?? undefined,
      answerKey: candidate.answerKey,
      createdAtIso: candidate.createdAtIso,
      creator: this.normalizeCreator(candidate.creator)
    };
  }

  private normalizeCreator(creator: PublishedTest['creator'] | undefined): TestCreatorInfo | null {
    if (!creator || typeof creator !== 'object') {
      return null;
    }

    const candidate = creator as Partial<TestCreatorInfo>;
    if (
      typeof candidate.uid !== 'string' ||
      typeof candidate.username !== 'string' ||
      typeof candidate.displayName !== 'string'
    ) {
      return null;
    }

    return {
      uid: candidate.uid,
      username: candidate.username,
      displayName: candidate.displayName
    };
  }

  private isQuestion(question: unknown, testType: TestType): question is TestQuestion {
    if (!question || typeof question !== 'object') {
      return false;
    }

    const candidate = question as Partial<TestQuestion>;
    const hasBaseShape = (
      typeof candidate.number === 'number' &&
      typeof candidate.prompt === 'string' &&
      !!candidate.options &&
      typeof candidate.options.A === 'string' &&
      typeof candidate.options.B === 'string' &&
      typeof candidate.options.C === 'string' &&
      typeof candidate.options.D === 'string'
    );

    if (!hasBaseShape) {
      return false;
    }

    return testType === 'reading' ? typeof candidate.passageId === 'string' : true;
  }

  private isAnswerKey(answerKey: unknown): answerKey is Record<number, OptionKey> {
    if (!answerKey || typeof answerKey !== 'object') {
      return false;
    }

    return Object.values(answerKey).every((option) => option === 'A' || option === 'B' || option === 'C' || option === 'D');
  }

  private normalizeTestType(testType: PublishedTest['testType'] | undefined): TestType {
    return testType === 'reading' ? 'reading' : 'standard';
  }

  private normalizePassages(
    candidatePassages: PublishedTest['passages'] | undefined,
    questions: TestQuestion[],
    testType: TestType
  ): ReadingPassage[] | null {
    if (testType !== 'reading') {
      return undefined as never;
    }

    if (!Array.isArray(candidatePassages) || candidatePassages.length === 0) {
      return null;
    }

    const passages = candidatePassages.filter((passage) => this.isPassage(passage));
    if (passages.length !== candidatePassages.length) {
      return null;
    }

    const passageIds = new Set(passages.map((passage) => passage.id));
    if (questions.some((question) => !question.passageId || !passageIds.has(question.passageId))) {
      return null;
    }

    return passages.map((passage) => ({
      id: passage.id,
      title: passage.title,
      content: passage.content,
      questionNumbers: questions
        .filter((question) => question.passageId === passage.id)
        .map((question) => question.number)
    }));
  }

  private isPassage(passage: unknown): passage is ReadingPassage {
    if (!passage || typeof passage !== 'object') {
      return false;
    }

    const candidate = passage as Partial<ReadingPassage>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.title === 'string' &&
      typeof candidate.content === 'string' &&
      Array.isArray(candidate.questionNumbers) &&
      candidate.questionNumbers.every((number) => typeof number === 'number')
    );
  }
}
