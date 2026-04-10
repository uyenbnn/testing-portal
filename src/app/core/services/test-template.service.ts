import { Injectable } from '@angular/core';
import { OptionKey, ParseResult, ReadingPassage, TestQuestion, TestType } from '../../shared/models/test.models';

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

  readonly readingQuestionTemplate = [
    'Passage A: Rainforest Recovery',
    'The school science club studied how rainforest areas recover after being protected.',
    'They found that native plants returned first, then insects, and finally larger animals.',
    '',
    'Question 1: Which organisms returned before larger animals?',
    'A. Native plants and insects',
    'B. Large birds and reptiles',
    'C. Only mammals',
    'D. No organisms returned',
    '',
    'Question 2: What is the main idea of the passage?',
    'A. Rainforests cannot recover once damaged',
    'B. Protected rainforest areas can gradually recover',
    'C. Students should avoid science clubs',
    'D. Larger animals return before plants',
    '',
    'Passage B: Solar Streets',
    'A town installed solar-powered street lights to reduce electricity costs.',
    'The lights stored energy during the day and turned on automatically at night.',
    '',
    'Question 3: Why did the town install the new lights?',
    'A. To make roads narrower',
    'B. To reduce electricity costs',
    'C. To stop daytime traffic',
    'D. To replace public transport'
  ].join('\n');

  readonly readingAnswerTemplate = [
    '1. A',
    '2. B',
    '3. B'
  ].join('\n');

  parse(questionText: string, answerText: string, testType: TestType = 'standard'): ParseResult {
    const errors: ParseResult['errors'] = [];
    const parsedQuestions = testType === 'reading'
      ? this.parseReadingQuestions(questionText, errors)
      : { questions: this.parseStandardQuestions(questionText, errors), passages: [] };
    const answerKey = this.parseAnswerKey(answerText, errors);

    for (const question of parsedQuestions.questions) {
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
      const hasQuestion = parsedQuestions.questions.some((question) => question.number === questionNumber);
      if (!hasQuestion) {
        errors.push({
          scope: 'answer',
          line: 1,
          message: `Answer key references Question ${questionNumber}, but that question was not found.`
        });
      }
    }

    return {
      questions: parsedQuestions.questions,
      passages: parsedQuestions.passages,
      answerKey,
      errors
    };
  }

  getQuestionTemplate(testType: TestType): string {
    return testType === 'reading' ? this.readingQuestionTemplate : this.questionTemplate;
  }

  getAnswerTemplate(testType: TestType): string {
    return testType === 'reading' ? this.readingAnswerTemplate : this.answerTemplate;
  }

  private parseStandardQuestions(text: string, errors: ParseResult['errors']): TestQuestion[] {
    const blocks = text
      .split(/\r?\n\s*\r?\n/g)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);

    const questions: TestQuestion[] = [];
    const seenQuestionNumbers = new Set<number>();

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
      if (seenQuestionNumbers.has(number)) {
        errors.push({
          scope: 'question',
          line: 1,
          message: `Question ${number} is duplicated.`
        });
        continue;
      }

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
      seenQuestionNumbers.add(number);
    }

    return questions.sort((a, b) => a.number - b.number);
  }

  private parseReadingQuestions(
    text: string,
    errors: ParseResult['errors']
  ): { questions: TestQuestion[]; passages: ReadingPassage[] } {
    const normalizedText = text.replace(/\r\n?/g, '\n');
    const lines = normalizedText.split('\n');
    const questions: TestQuestion[] = [];
    const passages: ReadingPassage[] = [];
    const seenQuestionNumbers = new Set<number>();
    const seenPassageIds = new Set<string>();
    let index = 0;

    while (index < lines.length) {
      index = this.skipBlankLines(lines, index);
      if (index >= lines.length) {
        break;
      }

      const passageHeader = lines[index].trim();
      const passageMatch = passageHeader.match(/^Passage\s+([A-Za-z0-9_-]+)\s*:\s*(.+)$/i);
      if (!passageMatch) {
        errors.push({
          scope: 'question',
          line: index + 1,
          message: `Expected a passage header like "Passage A: Title" but found "${passageHeader}".`
        });
        break;
      }

      const passageId = passageMatch[1];
      const passageTitle = passageMatch[2].trim();
      if (seenPassageIds.has(passageId)) {
        errors.push({
          scope: 'question',
          line: index + 1,
          message: `Passage ${passageId} is duplicated.`
        });
      }
      seenPassageIds.add(passageId);
      index += 1;

      const passageLines: string[] = [];
      while (index < lines.length) {
        const currentLine = lines[index].trim();
        if (this.isQuestionHeader(currentLine) || this.isPassageHeader(currentLine)) {
          break;
        }

        passageLines.push(lines[index].replace(/\s+$/, ''));
        index += 1;
      }

      const passageContent = passageLines.join('\n').trim();
      if (passageContent.length === 0) {
        errors.push({
          scope: 'question',
          line: index + 1,
          message: `Passage ${passageId} must include content before its questions.`
        });
      }

      const questionNumbers: number[] = [];

      while (index < lines.length) {
        index = this.skipBlankLines(lines, index);
        if (index >= lines.length) {
          break;
        }

        const currentLine = lines[index].trim();
        if (this.isPassageHeader(currentLine)) {
          break;
        }

        const questionMatch = currentLine.match(/^Question\s+(\d+)\s*:\s*(.+)$/i);
        if (!questionMatch) {
          errors.push({
            scope: 'question',
            line: index + 1,
            message: `Question header is invalid: "${currentLine}"`
          });
          break;
        }

        const questionNumber = Number(questionMatch[1]);
        if (seenQuestionNumbers.has(questionNumber)) {
          errors.push({
            scope: 'question',
            line: index + 1,
            message: `Question ${questionNumber} is duplicated.`
          });
        }

        const optionLines: string[] = [];
        index += 1;

        while (index < lines.length && optionLines.length < 4) {
          const optionLine = lines[index].trim();
          if (optionLine.length === 0) {
            index += 1;
            continue;
          }

          if (this.isQuestionHeader(optionLine) || this.isPassageHeader(optionLine)) {
            break;
          }

          optionLines.push(optionLine);
          index += 1;
        }

        const options = this.parseOptions(optionLines, errors, questionNumber);
        if (options && !seenQuestionNumbers.has(questionNumber)) {
          questions.push({
            number: questionNumber,
            prompt: questionMatch[2].trim(),
            options,
            passageId
          });
          questionNumbers.push(questionNumber);
          seenQuestionNumbers.add(questionNumber);
        }
      }

      if (questionNumbers.length === 0) {
        errors.push({
          scope: 'question',
          line: index + 1,
          message: `Passage ${passageId} must include at least one question.`
        });
      }

      passages.push({
        id: passageId,
        title: passageTitle,
        content: passageContent,
        questionNumbers
      });
    }

    if (passages.length === 0 && text.trim().length > 0) {
      errors.push({
        scope: 'question',
        line: 1,
        message: 'Reading tests must start with a passage header like "Passage A: Title".'
      });
    }

    return {
      questions: questions.sort((left, right) => left.number - right.number),
      passages
    };
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

  private skipBlankLines(lines: string[], index: number): number {
    let nextIndex = index;

    while (nextIndex < lines.length && lines[nextIndex].trim().length === 0) {
      nextIndex += 1;
    }

    return nextIndex;
  }

  private isPassageHeader(line: string): boolean {
    return /^Passage\s+[A-Za-z0-9_-]+\s*:\s*.+$/i.test(line);
  }

  private isQuestionHeader(line: string): boolean {
    return /^Question\s+\d+\s*:\s*.+$/i.test(line);
  }
}
