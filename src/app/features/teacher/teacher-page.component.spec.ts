import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { TestCodeService } from '../../core/services/test-code.service';
import { TeacherAuthService } from '../../core/services/teacher-auth.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { TestTemplateService } from '../../core/services/test-template.service';
import { TeacherProfile } from '../../shared/models/auth.models';
import { PublishedTest } from '../../shared/models/test.models';
import { FormArray } from '@angular/forms';
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
      createdAtIso: '2026-04-10T09:15:00.000Z',
      creator: {
        uid: 'teacher-1',
        username: 'demo.teacher',
        displayName: 'Demo Teacher'
      }
    },
    {
      code: '654321',
      title: 'Reading Drill',
      testType: 'reading',
      durationMinutes: 30,
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
      createdAtIso: '2026-04-11T08:00:00.000Z',
      creator: {
        uid: 'teacher-1',
        username: 'demo.teacher',
        displayName: 'Demo Teacher'
      }
    }
  ];

  let repository: {
    listPublishedTests: ReturnType<typeof vi.fn>;
    listPublishedTestsByCreator: ReturnType<typeof vi.fn>;
    deleteTest: ReturnType<typeof vi.fn>;
    isCodeTaken: ReturnType<typeof vi.fn>;
    publishTest: ReturnType<typeof vi.fn>;
  };
  let teacherProfile: TeacherProfile;

  beforeEach(async () => {
    repository = {
      listPublishedTests: vi.fn().mockResolvedValue(publishedTests),
      listPublishedTestsByCreator: vi.fn().mockResolvedValue(publishedTests),
      deleteTest: vi.fn().mockResolvedValue(undefined),
      isCodeTaken: vi.fn().mockResolvedValue(false),
      publishTest: vi.fn().mockResolvedValue(undefined)
    };
    teacherProfile = {
      uid: 'teacher-1',
      firstName: 'Demo',
      lastName: 'Teacher',
      gender: 'prefer_not_to_say',
      phoneNumber: '0900000000',
      email: 'teacher@example.com',
      username: 'demo.teacher',
      normalizedUsername: 'demo.teacher',
      status: 'approved',
      createdAtIso: '2026-04-10T09:00:00.000Z',
      approvedAtIso: '2026-04-10T10:00:00.000Z'
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
          provide: TeacherAuthService,
          useValue: {
            currentProfile: signal(teacherProfile),
            displayName: signal('Demo Teacher'),
            isReady: signal(true),
            isProfileLoading: signal(false),
            isAuthenticated: signal(true),
            login: vi.fn(),
            signUp: vi.fn(),
            logout: vi.fn(),
            refreshProfile: vi.fn()
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

  async function openCreatedTestsTab(fixture: ReturnType<typeof TestBed.createComponent<TeacherPageComponent>>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const createdTab = fixture.nativeElement.querySelector('#created-tab') as HTMLButtonElement;
    createdTab.click();
    fixture.detectChanges();
  }

  it('renders published tests after loading', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    await openCreatedTestsTab(fixture);

    const element = fixture.nativeElement as HTMLElement;

    expect(repository.listPublishedTestsByCreator).toHaveBeenCalledWith('teacher-1');
    expect(element.textContent).toContain('Midterm Review');
    expect(element.textContent).toContain('123456');
    expect(element.textContent).toContain('Standard MCQ');
    expect(element.textContent).toContain('45 phút');
  });

  it('deletes a selected test after confirmation', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    await openCreatedTestsTab(fixture);

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

    await openCreatedTestsTab(fixture);

    const openButton = fixture.nativeElement.querySelector('[aria-label="Open details for test 123456"]') as HTMLButtonElement;
    openButton.click();

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="dialog"]')).toBeTruthy();
    expect(element.textContent).toContain('Test Details');
    expect(element.textContent).toContain('Capital of France?');
    expect(element.textContent).toContain('Đáp án đúng: B');
  });

  it('filters the created tests list by live search', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    await openCreatedTestsTab(fixture);

    const element = fixture.nativeElement as HTMLElement;
    const searchInput = element.querySelector('input[type="search"]') as HTMLInputElement;

    searchInput.value = 'reading';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(element.textContent).toContain('Reading Drill');
    expect(element.textContent).not.toContain('Midterm Review');
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
      numQuestions: null,
      numPassages: null,
      questionsTable: [],
      readingPassages: [],
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
      createdAtIso: expect.any(String),
      creator: {
        uid: 'teacher-1',
        username: 'demo.teacher',
        displayName: 'Demo Teacher'
      }
    });
  });

  it('publishes a standard test without a passages field', async () => {
    const templateService = TestBed.inject(TestTemplateService) as unknown as {
      parse: ReturnType<typeof vi.fn>;
    };
    templateService.parse.mockReturnValue({
      questions: [
        {
          number: 1,
          prompt: 'What is 2 + 2?',
          options: { A: '2', B: '3', C: '4', D: '5' }
        }
      ],
      passages: [],
      answerKey: { 1: 'C' },
      errors: []
    });

    const fixture = TestBed.createComponent(TeacherPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.form.setValue({
      title: 'Standard Practice',
      testType: 'standard',
      durationMinutes: 30,
      numQuestions: null,
      numPassages: null,
      questionsTable: [],
      readingPassages: [],
      questionText: 'Question 1: What is 2 + 2?',
      answerText: '1. C'
    });

    await component.publishTest();

    const publishedPayload = repository.publishTest.mock.calls.at(-1)?.[0];
    expect(publishedPayload).toEqual({
      code: '654321',
      title: 'Standard Practice',
      testType: 'standard',
      durationMinutes: 30,
      questions: [
        {
          number: 1,
          prompt: 'What is 2 + 2?',
          options: { A: '2', B: '3', C: '4', D: '5' }
        }
      ],
      answerKey: { 1: 'C' },
      createdAtIso: expect.any(String),
      creator: {
        uid: 'teacher-1',
        username: 'demo.teacher',
        displayName: 'Demo Teacher'
      }
    });
    expect(publishedPayload).not.toHaveProperty('passages');
  });

  it('shows a styled delete confirmation popup before removing a test', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    await openCreatedTestsTab(fixture);

    const deleteButton = fixture.nativeElement.querySelector('[aria-label="Delete test 123456"]') as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.confirm-card')).toBeTruthy();
    expect(element.textContent).toContain('Xóa bài kiểm tra này?');
    expect(element.textContent).toContain('Học sinh sẽ không thể làm bài kiểm tra này.');
    expect(repository.deleteTest).not.toHaveBeenCalled();
  });

  it('shows the create tab by default and switches to created tests on demand', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Tạo bài kiểm tra');
    expect(element.textContent).not.toContain('Midterm Review');

    const createdTab = element.querySelector('#created-tab') as HTMLButtonElement;
    createdTab.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Các bài kiểm tra đã tạo');
    expect(element.textContent).toContain('Midterm Review');
  });

  it('generates MCQ table rows when numQuestions is set for standard type', () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.form.controls.numQuestions.setValue(3);
    fixture.detectChanges();

    const questionsTable = component.form.get('questionsTable') as FormArray;
    expect(questionsTable?.length).toBe(3);

    for (let i = 0; i < 3; i++) {
      const row = questionsTable?.at(i);
      expect(row?.get('questionNumber')?.value).toBe(i + 1);
      expect(row?.get('question')?.value).toBe('');
      expect(row?.get('answerA')?.value).toBe('');
      expect(row?.get('answerB')?.value).toBe('');
      expect(row?.get('answerC')?.value).toBe('');
      expect(row?.get('answerD')?.value).toBe('');
      expect(row?.get('correctAnswer')?.value).toBeNull();
    }
  });

  it('publishes a standard test with table input', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.form.controls.title.setValue('Table Mode Test');
    component.form.controls.testType.setValue('standard');
    component.form.controls.durationMinutes.setValue(30);
    component.form.controls.numQuestions.setValue(2);

    // Fill table rows
    component.regenerateMcqTableRows(2, 'standard');
    const questionsTable = component.form.get('questionsTable') as FormArray;

    const row0 = questionsTable.at(0);
    row0.patchValue({
      question: 'What is 2 + 2?',
      answerA: '2',
      answerB: '3',
      answerC: '4',
      answerD: '5',
      correctAnswer: 'C'
    });

    const row1 = questionsTable.at(1);
    row1.patchValue({
      question: 'What is 5 + 3?',
      answerA: '6',
      answerB: '8',
      answerC: '9',
      answerD: '10',
      correctAnswer: 'B'
    });

    await component.publishTest();

    const publishedPayload = repository.publishTest.mock.calls.at(-1)?.[0];
    expect(publishedPayload.title).toBe('Table Mode Test');
    expect(publishedPayload.testType).toBe('standard');
    expect(publishedPayload.questions).toHaveLength(2);
    expect(publishedPayload.questions[0].prompt).toBe('What is 2 + 2?');
    expect(publishedPayload.answerKey).toEqual({ 1: 'C', 2: 'B' });
  });

  it('shows validation error when table row is incomplete for table mode', async () => {
    const fixture = TestBed.createComponent(TeacherPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.form.controls.title.setValue('Test');
    component.form.controls.numQuestions.setValue(1);
    fixture.detectChanges();

    // Leave row incomplete - no answer selected
    component.regenerateMcqTableRows(1, 'standard');
    const questionsTable = component.form.get('questionsTable') as FormArray;
    const row = questionsTable.at(0);
    row.patchValue({
      question: 'What is 2 + 2?',
      answerA: '2',
      answerB: '3',
      answerC: '4',
      answerD: '5',
      correctAnswer: null
    });

    await component.publishTest();

    const errors = component.errors();
    expect(errors.some((e) => e.message.includes('Correct answer'))).toBe(true);
  });

  it('maintains template mode for reading type (regression test)', async () => {
    const templateService = TestBed.inject(TestTemplateService) as unknown as {
      parse: ReturnType<typeof vi.fn>;
    };
    templateService.parse.mockReturnValue({
      questions: [
        {
          number: 1,
          prompt: 'What is here?',
          passageId: 'A',
          options: { A: 'A', B: 'B', C: 'C', D: 'D' }
        }
      ],
      passages: [
        {
          id: 'A',
          title: 'Test',
          content: 'Content',
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
    component.form.controls.title.setValue('Reading Test');
    component.form.controls.testType.setValue('reading');
    component.form.controls.durationMinutes.setValue(45);
    component.form.controls.questionText.setValue('Passage A: Test');
    component.form.controls.answerText.setValue('1. A');

    await component.publishTest();

    expect(repository.publishTest).toHaveBeenCalled();
    const publishedPayload = repository.publishTest.mock.calls.at(-1)?.[0];
    expect(publishedPayload.testType).toBe('reading');
    expect(publishedPayload.passages).toBeDefined();
  });
});