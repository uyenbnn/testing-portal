import { Injectable } from '@angular/core';
import { OptionKey, PublishedTest, ResultSummary, StudentProfile } from '../../shared/models/test.models';

@Injectable({ providedIn: 'root' })
export class ScoringService {
  evaluate(test: PublishedTest, answers: Record<number, OptionKey>, student: StudentProfile): ResultSummary {
    const details = test.questions.map((question) => {
      const selected = answers[question.number] ?? null;
      const correct = test.answerKey[question.number];
      return {
        questionNumber: question.number,
        selected,
        correct,
        isCorrect: selected === correct
      };
    });

    const correctAnswers = details.filter((detail) => detail.isCorrect).length;

    return {
      student,
      testCode: test.code,
      totalQuestions: test.questions.length,
      correctAnswers,
      percentage: test.questions.length === 0 ? 0 : Math.round((correctAnswers / test.questions.length) * 100),
      details
    };
  }
}
