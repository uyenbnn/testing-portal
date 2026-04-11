import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreatedTestItem } from '../../teacher-page.models';

import { TeacherTestLibrary } from './teacher-test-library';

describe('TeacherTestLibrary', () => {
  const createdTestItems: CreatedTestItem[] = [
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
      },
      questionCount: 1,
      passageCount: 0,
      createdAtLabel: 'Apr 10, 2026, 9:15 AM',
      testTypeLabel: 'Standard MCQ',
      creatorNameLabel: 'Demo Teacher',
      creatorUsernameLabel: '@demo.teacher'
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
        uid: 'teacher-2',
        username: 'reading.coach',
        displayName: 'Another Instructor'
      },
      questionCount: 1,
      passageCount: 1,
      createdAtLabel: 'Apr 11, 2026, 8:00 AM',
      testTypeLabel: 'Reading',
      creatorNameLabel: 'Another Instructor',
      creatorUsernameLabel: '@reading.coach'
    }
  ];

  let component: TeacherTestLibrary;
  let fixture: ComponentFixture<TeacherTestLibrary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherTestLibrary],
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherTestLibrary);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('createdTestItems', createdTestItems);
    fixture.componentRef.setInput('isLoadingTests', false);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders live filter controls when tests are available', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('input[type="search"]')).toBeTruthy();
    expect(element.querySelector('select')).toBeTruthy();
    expect(element.textContent).toContain('2 bài kiểm tra');
  });

  it('filters tests by title or code as the user types', () => {
    const element = fixture.nativeElement as HTMLElement;
    const searchInput = element.querySelector('input[type="search"]') as HTMLInputElement;

    searchInput.value = '654321';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(element.textContent).toContain('Reading Drill');
    expect(element.textContent).not.toContain('Midterm Review');
    expect(element.textContent).toContain('1/2 bài kiểm tra phù hợp');
  });

  it('matches creator fields only when showCreator is enabled', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const searchInput = element.querySelector('input[type="search"]') as HTMLInputElement;

    searchInput.value = 'another instructor';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(element.textContent).toContain('Không có bài kiểm tra nào khớp với bộ lọc hiện tại.');

    fixture.componentRef.setInput('showCreator', true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.textContent).toContain('Reading Drill');
    expect(element.textContent).not.toContain('Midterm Review');
  });

  it('filters tests by selected type', () => {
    const element = fixture.nativeElement as HTMLElement;
    const typeSelect = element.querySelector('select') as HTMLSelectElement;

    typeSelect.value = 'reading';
    typeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(element.textContent).toContain('Reading Drill');
    expect(element.textContent).not.toContain('Midterm Review');
  });

  it('clears all filters and restores the full list', () => {
    const element = fixture.nativeElement as HTMLElement;
    const searchInput = element.querySelector('input[type="search"]') as HTMLInputElement;
    const typeSelect = element.querySelector('select') as HTMLSelectElement;
    const clearButton = element.querySelector('.filter-clear') as HTMLButtonElement;

    searchInput.value = 'reading';
    searchInput.dispatchEvent(new Event('input'));
    typeSelect.value = 'reading';
    typeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    clearButton.click();
    fixture.detectChanges();

    expect(searchInput.value).toBe('');
    expect(typeSelect.value).toBe('all');
    expect(element.textContent).toContain('Midterm Review');
    expect(element.textContent).toContain('Reading Drill');
  });
});
