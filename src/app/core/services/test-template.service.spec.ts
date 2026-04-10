import { TestBed } from '@angular/core/testing';
import { TestTemplateService } from './test-template.service';

describe('TestTemplateService', () => {
  let service: TestTemplateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestTemplateService]
    });

    service = TestBed.inject(TestTemplateService);
  });

  it('parses the standard MCQ template', () => {
    const result = service.parse(
      [
        'Question 1: What is 2 + 2?',
        'A. 3',
        'B. 4',
        'C. 5',
        'D. 6'
      ].join('\n'),
      '1. B',
      'standard'
    );

    expect(result.errors).toEqual([]);
    expect(result.passages).toEqual([]);
    expect(result.questions).toEqual([
      {
        number: 1,
        prompt: 'What is 2 + 2?',
        options: { A: '3', B: '4', C: '5', D: '6' }
      }
    ]);
    expect(result.answerKey).toEqual({ 1: 'B' });
  });

  it('parses reading tests with multiple passages', () => {
    const result = service.parse(
      [
        'Passage A: Rainforest Recovery',
        'Protected forests often recover in stages.',
        'Plants return first, followed by insects and birds.',
        '',
        'Question 1: Which organisms return first?',
        'A. Plants',
        'B. Insects',
        'C. Birds',
        'D. Mammals',
        '',
        'Passage B: Solar Streets',
        'A town installed solar lights to reduce energy costs.',
        '',
        'Question 2: Why were the lights installed?',
        'A. To widen roads',
        'B. To reduce costs',
        'C. To increase traffic',
        'D. To cool the streets'
      ].join('\n'),
      [
        '1. A',
        '2. B'
      ].join('\n'),
      'reading'
    );

    expect(result.errors).toEqual([]);
    expect(result.passages).toEqual([
      {
        id: 'A',
        title: 'Rainforest Recovery',
        content: 'Protected forests often recover in stages.\nPlants return first, followed by insects and birds.',
        questionNumbers: [1]
      },
      {
        id: 'B',
        title: 'Solar Streets',
        content: 'A town installed solar lights to reduce energy costs.',
        questionNumbers: [2]
      }
    ]);
    expect(result.questions).toEqual([
      {
        number: 1,
        prompt: 'Which organisms return first?',
        passageId: 'A',
        options: { A: 'Plants', B: 'Insects', C: 'Birds', D: 'Mammals' }
      },
      {
        number: 2,
        prompt: 'Why were the lights installed?',
        passageId: 'B',
        options: { A: 'To widen roads', B: 'To reduce costs', C: 'To increase traffic', D: 'To cool the streets' }
      }
    ]);
    expect(result.answerKey).toEqual({ 1: 'A', 2: 'B' });
  });

  it('reports missing reading passage headers', () => {
    const result = service.parse(
      [
        'Question 1: Missing passage',
        'A. One',
        'B. Two',
        'C. Three',
        'D. Four'
      ].join('\n'),
      '1. A',
      'reading'
    );

    expect(result.questions).toEqual([]);
    expect(result.passages).toEqual([]);
    expect(result.errors.some((error) => error.message.includes('Reading tests must start with a passage header'))).toBe(true);
  });
});
