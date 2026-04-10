export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface TestQuestion {
  number: number;
  prompt: string;
  options: Record<OptionKey, string>;
}

export interface PublishedTest {
  code: string;
  title: string;
  durationMinutes: number;
  questions: TestQuestion[];
  answerKey: Record<number, OptionKey>;
  createdAtIso: string;
}

export interface StudentProfile {
  name: string;
  className: string;
}

export interface QuestionResult {
  questionNumber: number;
  selected: OptionKey | null;
  correct: OptionKey;
  isCorrect: boolean;
}

export interface ResultSummary {
  student: StudentProfile;
  testCode: string;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  details: QuestionResult[];
}

export interface ParseError {
  scope: 'question' | 'answer' | 'general';
  line: number;
  message: string;
}

export interface ParseResult {
  questions: TestQuestion[];
  answerKey: Record<number, OptionKey>;
  errors: ParseError[];
}
