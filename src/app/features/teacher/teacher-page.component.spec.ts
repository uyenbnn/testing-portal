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
            parse: vi.fn().mockReturnValue({
              questions: [],
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
    expect(element.textContent).toContain('45 min');
  });

  it('deletes a selected test after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(TeacherPageComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('[aria-label="Delete test 123456"]') as HTMLButtonElement;
    button.click();

    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalledWith('Delete test "Midterm Review" (123456)? This cannot be undone.');
    expect(repository.deleteTest).toHaveBeenCalledWith('123456');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Midterm Review');

    confirmSpy.mockRestore();
  });
});