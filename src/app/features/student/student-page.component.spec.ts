import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ScoringService } from '../../core/services/scoring.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { StudentPageComponent } from './student-page.component';

describe('StudentPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: TestRepositoryService,
          useValue: {
            findByCode: vi.fn()
          }
        },
        {
          provide: ScoringService,
          useValue: {
            evaluate: vi.fn()
          }
        }
      ]
    }).compileComponents();
  });

  it('renders reading tests in a side-by-side grouped layout', async () => {
    const fixture = TestBed.createComponent(StudentPageComponent);
    fixture.componentInstance.activeTest.set({
      code: '321654',
      title: 'Reading Practice',
      testType: 'reading',
      durationMinutes: 30,
      questions: [
        {
          number: 1,
          prompt: 'What is the best summary?',
          passageId: 'A',
          options: { A: 'Summary A', B: 'Summary B', C: 'Summary C', D: 'Summary D' }
        },
        {
          number: 2,
          prompt: 'Which fact is stated?',
          passageId: 'A',
          options: { A: 'Fact A', B: 'Fact B', C: 'Fact C', D: 'Fact D' }
        }
      ],
      passages: [
        {
          id: 'A',
          title: 'City Gardens',
          content: 'City gardens help neighborhoods grow fresh food.',
          questionNumbers: [1, 2]
        }
      ],
      answerKey: { 1: 'B', 2: 'D' },
      createdAtIso: '2026-04-10T12:30:00.000Z'
    });
    fixture.componentInstance.remainingSeconds.set(1800);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.reading-group')).toBeTruthy();
    expect(element.querySelector('.passage-card')?.textContent).toContain('City Gardens');
    expect(element.textContent).toContain('What is the best summary?');
    expect(element.textContent).toContain('Which fact is stated?');
  });

  it('keeps the standard linear list for standard tests', async () => {
    const fixture = TestBed.createComponent(StudentPageComponent);
    fixture.componentInstance.activeTest.set({
      code: '111222',
      title: 'Math Drill',
      testType: 'standard',
      durationMinutes: 15,
      questions: [
        {
          number: 1,
          prompt: '2 + 3 = ?',
          options: { A: '4', B: '5', C: '6', D: '7' }
        }
      ],
      answerKey: { 1: 'B' },
      createdAtIso: '2026-04-10T12:45:00.000Z'
    });
    fixture.componentInstance.remainingSeconds.set(900);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.reading-group')).toBeNull();
    expect(element.querySelector('.question-list')).toBeTruthy();
    expect(element.textContent).toContain('2 + 3 = ?');
  });
});
