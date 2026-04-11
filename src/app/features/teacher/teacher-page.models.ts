import { PublishedTest, ReadingPassage, TestQuestion, TestType } from '../../shared/models/test.models';

export interface CreatedTestItem extends PublishedTest {
  questionCount: number;
  passageCount: number;
  createdAtLabel: string;
  testTypeLabel: string;
}

export interface PassageQuestionGroup {
  passage: ReadingPassage;
  questions: TestQuestion[];
}

export interface TeacherTestTypeOption {
  value: TestType;
  label: string;
}