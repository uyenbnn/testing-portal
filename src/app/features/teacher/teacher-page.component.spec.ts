import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { TestCodeService } from '../../core/services/test-code.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { TestTemplateService } from '../../core/services/test-template.service';
import { PublishedTest } from '../../shared/models/test.models';
import { TeacherPageComponent } from './teacher-page.component';

describe('TeacherPageComponent', () => {
  const publishedTests: PublishedTest[] = [
    {
      code: '123456',
      title: 'Midterm Review',
      testType: 'standard',
      durationMinutes: 45,
      questions: [
        {
          number: 1,
          prompt: 'Capital of France?',
          options: { A: 'Rome', B: 'Paris', C: 'Madrid', D: 'Berlin' }
        }
      ],
      answerKey: { 1: 'B' },
      createdAtIso: '2026-04-10T09:15:00.000Z'
    }
  ];

  let repository: {
    listPublishedTests: ReturnType<typeof vi.fn>;
    deleteTest: ReturnType<typeof vi.fn>;
    isCodeTaken: ReturnType<typeof vi.fn>;
    publishTest: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repository = {
      listPublishedTests: vi.fn().mockResolvedValue(publishedTests),
      deleteTest: vi.fn().mockResolvedValue(undefined),
      isCodeTaken: vi.fn().mockResolvedValue(false),
      publishTest: vi.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [TeacherPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: TestRepositoryService,
          useValue: repository
        },
        {
          provide: TestCodeService,
          useValue: {
            generateUniqueCode: vi.fn().mockResolvedValue('654321')
          }
        },
        {
          provide: TestTemplateService,
          useValue: {
            questionTemplate: 'Question 1: Sample',
            answerTemplate: '1. A',
            readingQuestionTemplate: 'Passage A: Sample\nBody\n\nQuestion 1: Sample\nA. One\nB. Two\nC. Three\nD. Four',
            readingAnswerTemplate: '1. A',
            getQuestionTemplate: vi.fn().mockReturnValue('Question 1: Sample'),
            getAnswerTemplate: vi.fn().mockReturnValue('1. A'),
            parse: vi.fn().mockReturnValue({
              questions: [],
              passages: [],
              answerKey: {},
              errors: []
            })
          }
        }
      ]
    }).compileComponents();
  });

  it('renders published tests after loading', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(repository.listPublishedTests).toHaveBeenCalled();
    expect(element.textContent).toContain('Midterm Review');
    expect(element.textContent).toContain('123456');
    expect(element.textContent).toContain('Standard MCQ');
    expect(element.textContent).toContain('45 min');
  });

  it('deletes a selected test after confirmation', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('[aria-label="Delete test 123456"]') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const confirmButton = fixture.nativeElement.querySelector('.confirm-actions .danger') as HTMLButtonElement;
    confirmButton.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(repository.deleteTest).toHaveBeenCalledWith('123456');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Midterm Review');
    expect(fixture.nativeElement.querySelector('.confirm-card')).toBeNull();
  });

  it('opens a popup detail view for a selected test', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const openButton = fixture.nativeElement.querySelector('[aria-label="Open details for test 123456"]') as HTMLButtonElement;
    openButton.click();

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="dialog"]')).toBeTruthy();
    expect(element.textContent).toContain('Test Details');
    expect(element.textContent).toContain('Capital of France?');
    expect(element.textContent).toContain('Correct answer: B');
  });

  it('publishes a reading test with passages in the payload', async () => {
    const templateService = TestBed.inject(TestTemplateService) as unknown as {
      parse: ReturnType<typeof vi.fn>;
    };
    templateService.parse.mockReturnValue({
      questions: [
        {
          number: 1,
          prompt: 'What is the best title?',
          passageId: 'A',
          options: { A: 'Birds', B: 'Trees', C: 'Rivers', D: 'Clouds' }
        }
      ],
      passages: [
        {
          id: 'A',
          title: 'Forest Notes',
          content: 'A short reading passage.',
          questionNumbers: [1]
        }
      ],
      answerKey: { 1: 'A' },
      errors: []
    });

    const fixture = TestBed.createComponent(TeacherPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.form.setValue({
      title: 'Reading Practice',
      testType: 'reading',
      durationMinutes: 40,
      questionText: 'Passage A: Forest Notes',
      answerText: '1. A'
    });

    await component.publishTest();

    expect(repository.publishTest).toHaveBeenCalledWith({
      code: '654321',
      title: 'Reading Practice',
      testType: 'reading',
      durationMinutes: 40,
      questions: [
        {
          number: 1,
          prompt: 'What is the best title?',
          passageId: 'A',
          options: { A: 'Birds', B: 'Trees', C: 'Rivers', D: 'Clouds' }
        }
      ],
      passages: [
        {
          id: 'A',
          title: 'Forest Notes',
          content: 'A short reading passage.',
          questionNumbers: [1]
        }
      ],
      answerKey: { 1: 'A' },
      createdAtIso: expect.any(String)
    });
  });

  it('shows a styled delete confirmation popup before removing a test', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const deleteButton = fixture.nativeElement.querySelector('[aria-label="Delete test 123456"]') as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.confirm-card')).toBeTruthy();
    expect(element.textContent).toContain('Delete this test?');
    expect(element.textContent).toContain('Students will no longer be able to join it.');
    expect(repository.deleteTest).not.toHaveBeenCalled();
  });
});