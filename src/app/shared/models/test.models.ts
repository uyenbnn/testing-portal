export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type TestType = 'standard' | 'reading' | 'mixed';

export interface ReadingPassage {
  id: string;
  title: string;
  content: string;
  questionNumbers: number[];
}

export interface TestQuestion {
  number: number;
  prompt: string;
  options: Record<OptionKey, string>;
  passageId?: string;
}

export interface TestCreatorInfo {
  uid: string;
  username: string;
  displayName: string;
}

export interface PublishedTest {
  code: string;
  title: string;
  testType: TestType;
  durationMinutes: number;
  questions: TestQuestion[];
  passages?: ReadingPassage[];
  answerKey: Record<number, OptionKey>;
  createdAtIso: string;
  creator: TestCreatorInfo | null;
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

export interface StoredQuestionResult {
  questionNumber: number;
  selected: OptionKey | 'N/A';
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

export interface StudentTestResultRecord {
  id: string;
  testCode: string;
  studentName: string;
  studentClassName: string;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  submittedAtIso: string;
  answers: Record<number, OptionKey>;
  details: StoredQuestionResult[];
}

export interface ParseError {
  scope: 'question' | 'answer' | 'general';
  line: number;
  message: string;
}

export interface ParseResult {
  questions: TestQuestion[];
  passages: ReadingPassage[];
  answerKey: Record<number, OptionKey>;
  errors: ParseError[];
}
