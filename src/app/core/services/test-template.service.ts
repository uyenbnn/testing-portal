import { Injectable } from '@angular/core';
import { OptionKey, ParseResult, TestQuestion } from '../../shared/models/test.models';

@Injectable({ providedIn: 'root' })
export class TestTemplateService {
  readonly questionTemplate = [
    'Question 1: What is 2 + 2?',
    'A. 2',
    'B. 3',
    'C. 4',
    'D. 5',
    '',
    'Question 2: Which one is a prime number?',
    'A. 8',
    'B. 9',
    'C. 11',
    'D. 12'
  ].join('\n');

  readonly answerTemplate = [
    '1. C',
    '2. C'
  ].join('\n');

  parse(questionText: string, answerText: string): ParseResult {
    const errors: ParseResult['errors'] = [];
    const questions = this.parseQuestions(questionText, errors);
    const answerKey = this.parseAnswerKey(answerText, errors);

    for (const question of questions) {
      if (!answerKey[question.number]) {
        errors.push({
          scope: 'answer',
          line: 1,
          message: `Missing answer key for Question ${question.number}.`
        });
      }
    }

    for (const key of Object.keys(answerKey)) {
      const questionNumber = Number(key);
      const hasQuestion = questions.some((question) => question.number === questionNumber);
      if (!hasQuestion) {
        errors.push({
          scope: 'answer',
          line: 1,
          message: `Answer key references Question ${questionNumber}, but that question was not found.`
        });
      }
    }

    return {
      questions,
      answerKey,
      errors
    };
  }

  private parseQuestions(text: string, errors: ParseResult['errors']): TestQuestion[] {
    const blocks = text
      .split(/\r?\n\s*\r?\n/g)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);

    const questions: TestQuestion[] = [];

    for (const block of blocks) {
      const lines = block
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length < 5) {
        errors.push({
          scope: 'question',
          line: 1,
          message: 'Each question block must include 1 prompt line and 4 options.'
        });
        continue;
      }

      const headerMatch = lines[0].match(/^Question\s+(\d+)\s*:\s*(.+)$/i);
      if (!headerMatch) {
        errors.push({ scope: 'question', line: 1, message: `Question header is invalid: "${lines[0]}"` });
        continue;
      }

      const number = Number(headerMatch[1]);
      const prompt = headerMatch[2].trim();
      const options = this.parseOptions(lines.slice(1), errors, number);

      if (!options) {
        continue;
      }

      questions.push({
        number,
        prompt,
        options
      });
    }

    return questions.sort((a, b) => a.number - b.number);
  }

  private parseOptions(
    optionLines: string[],
    errors: ParseResult['errors'],
    questionNumber: number
  ): Record<OptionKey, string> | null {
    const optionMap: Partial<Record<OptionKey, string>> = {};

    for (const line of optionLines) {
      const match = line.match(/^([ABCD])\.\s*(.+)$/i);
      if (!match) {
        errors.push({
          scope: 'question',
          line: 1,
          message: `Option format is invalid for Question ${questionNumber}: "${line}". Use A. ..., B. ...`
        });
        return null;
      }

      const optionKey = match[1].toUpperCase() as OptionKey;
      optionMap[optionKey] = match[2].trim();
    }

    if (!optionMap.A || !optionMap.B || !optionMap.C || !optionMap.D) {
      errors.push({
        scope: 'question',
        line: 1,
        message: `Question ${questionNumber} must include options A, B, C, D.`
      });
      return null;
    }

    return optionMap as Record<OptionKey, string>;
  }

  private parseAnswerKey(text: string, errors: ParseResult['errors']): Record<number, OptionKey> {
    const lines = text
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const answerKey: Record<number, OptionKey> = {};

    for (const line of lines) {
      const match = line.match(/^(\d+)\.\s*([ABCD])$/i);
      if (!match) {
        errors.push({
          scope: 'answer',
          line: 1,
          message: `Answer key line is invalid: "${line}". Expected format: 1. A`
        });
        continue;
      }

      const number = Number(match[1]);
      const option = match[2].toUpperCase() as OptionKey;
      answerKey[number] = option;
    }

    return answerKey;
  }
}
