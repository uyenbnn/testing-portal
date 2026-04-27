import { Injectable, signal } from '@angular/core';
import { getApps, initializeApp } from 'firebase/app';
import { Database, get, getDatabase, push, ref, remove, set } from 'firebase/database';
import { environment } from '../../../environments/environment';
import {
  OptionKey,
  PublishedTest,
  ReadingPassage,
  ResultSummary,
  StudentTestResultRecord,
  StoredQuestionResult,
  TestCreatorInfo,
  TestQuestion,
  TestType
} from '../../shared/models/test.models';

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

  async saveStudentResult(summary: ResultSummary, answers: Record<number, OptionKey>, submittedAtIso: string): Promise<void> {
    const resultRef = push(ref(this.database, `results/${summary.testCode}`));
    const id = resultRef.key;
    if (!id) {
      throw new Error('Failed to allocate result id.');
    }

    const payload: StudentTestResultRecord = {
      id,
      testCode: summary.testCode,
      studentName: summary.student.name,
      studentClassName: summary.student.className,
      totalQuestions: summary.totalQuestions,
      correctAnswers: summary.correctAnswers,
      percentage: summary.percentage,
      submittedAtIso,
      answers,
      details: summary.details.map((detail) => ({
        questionNumber: detail.questionNumber,
        selected: detail.selected ?? 'N/A',
        correct: detail.correct,
        isCorrect: detail.isCorrect
      }))
    };

    await set(resultRef, payload);
  }

  async listStudentResultsByTestCode(testCode: string): Promise<StudentTestResultRecord[]> {
    const snapshot = await get(ref(this.database, `results/${testCode}`));
    if (!snapshot.exists()) {
      return [];
    }

    return this.toStudentResultRecords(snapshot.val(), testCode)
      .sort((left, right) => right.submittedAtIso.localeCompare(left.submittedAtIso));
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
    if ((testType === 'reading' || testType === 'mixed') && passages === null) {
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

    if (testType === 'reading') {
      return typeof candidate.passageId === 'string';
    }

    if (testType === 'mixed') {
      return typeof candidate.passageId === 'undefined' || typeof candidate.passageId === 'string';
    }

    return true;
  }

  private isAnswerKey(answerKey: unknown): answerKey is Record<number, OptionKey> {
    if (!answerKey || typeof answerKey !== 'object') {
      return false;
    }

    return Object.values(answerKey).every((option) => option === 'A' || option === 'B' || option === 'C' || option === 'D');
  }

  private normalizeTestType(testType: PublishedTest['testType'] | undefined): TestType {
    if (testType === 'reading' || testType === 'mixed') {
      return testType;
    }

    return 'standard';
  }

  private normalizePassages(
    candidatePassages: PublishedTest['passages'] | undefined,
    questions: TestQuestion[],
    testType: TestType
  ): ReadingPassage[] | null {
    if (testType === 'standard') {
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
    if (questions.some((question) => question.passageId && !passageIds.has(question.passageId))) {
      return null;
    }

    if (testType === 'reading' && questions.some((question) => !question.passageId)) {
      return null;
    }

    if (testType === 'mixed') {
      const hasStandaloneQuestion = questions.some((question) => !question.passageId);
      const hasReadingQuestion = questions.some((question) => !!question.passageId);

      if (!hasStandaloneQuestion || !hasReadingQuestion) {
        return null;
      }
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

  private toStudentResultRecords(value: unknown, expectedTestCode: string): StudentTestResultRecord[] {
    if (!value || typeof value !== 'object') {
      return [];
    }

    return Object.values(value).flatMap((candidate) => {
      const parsed = this.toStudentResultRecord(candidate, expectedTestCode);
      return parsed ? [parsed] : [];
    });
  }

  private toStudentResultRecord(value: unknown, expectedTestCode: string): StudentTestResultRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<StudentTestResultRecord>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.testCode !== 'string' ||
      candidate.testCode !== expectedTestCode ||
      typeof candidate.studentName !== 'string' ||
      typeof candidate.studentClassName !== 'string' ||
      typeof candidate.totalQuestions !== 'number' ||
      typeof candidate.correctAnswers !== 'number' ||
      typeof candidate.percentage !== 'number' ||
      typeof candidate.submittedAtIso !== 'string' ||
      !this.isAnswerKey(candidate.answers) ||
      !Array.isArray(candidate.details)
    ) {
      return null;
    }

    const details = candidate.details.filter((detail) => this.isStoredQuestionResult(detail));
    if (details.length !== candidate.details.length) {
      return null;
    }

    return {
      id: candidate.id,
      testCode: candidate.testCode,
      studentName: candidate.studentName,
      studentClassName: candidate.studentClassName,
      totalQuestions: candidate.totalQuestions,
      correctAnswers: candidate.correctAnswers,
      percentage: candidate.percentage,
      submittedAtIso: candidate.submittedAtIso,
      answers: candidate.answers,
      details
    };
  }

  private isStoredQuestionResult(value: unknown): value is StoredQuestionResult {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<StoredQuestionResult>;
    return (
      typeof candidate.questionNumber === 'number' &&
      (candidate.selected === 'A' || candidate.selected === 'B' || candidate.selected === 'C' || candidate.selected === 'D' || candidate.selected === 'N/A') &&
      (candidate.correct === 'A' || candidate.correct === 'B' || candidate.correct === 'C' || candidate.correct === 'D') &&
      typeof candidate.isCorrect === 'boolean'
    );
  }
}
