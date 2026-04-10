import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ScoringService } from '../../core/services/scoring.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { OptionKey, PublishedTest, ReadingPassage, TestQuestion } from '../../shared/models/test.models';

interface PassageQuestionGroup {
  passage: ReadingPassage;
  questions: TestQuestion[];
}

@Component({
  selector: 'app-student-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './student-page.component.html',
  styleUrl: './student-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentPageComponent implements OnDestroy {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly repository = inject(TestRepositoryService);
  private readonly scoringService = inject(ScoringService);

  readonly joinForm = this.fb.group({
    testCode: this.fb.control('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
    name: this.fb.control('', [Validators.required]),
    className: this.fb.control('', [Validators.required])
  });

  readonly activeTest = signal<PublishedTest | null>(null);
  readonly joinError = signal('');
  readonly answers = signal<Record<number, OptionKey>>({});
  readonly remainingSeconds = signal(0);
  readonly result = signal<ReturnType<ScoringService['evaluate']> | null>(null);

  readonly optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
  readonly isReadingTest = computed(() => this.activeTest()?.testType === 'reading');
  readonly readingPassageGroups = computed(() => this.toPassageGroups(this.activeTest()));
  readonly timeLabel = computed(() => {
    const total = this.remainingSeconds();
    const mins = Math.floor(total / 60).toString().padStart(2, '0');
    const secs = (total % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  });

  private timerId: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    this.stopTimer();
  }

  async joinTest(): Promise<void> {
    this.joinError.set('');
    this.result.set(null);

    if (this.joinForm.invalid) {
      this.joinError.set('Please enter a valid 6-digit code, name, and class.');
      return;
    }

    const testCode = this.joinForm.controls.testCode.value;
    const test = await this.repository.findByCode(testCode);

    if (!test) {
      this.joinError.set('Test not found. Ask your teacher to verify the code.');
      return;
    }

    this.activeTest.set(test);
    this.answers.set({});
    this.remainingSeconds.set(test.durationMinutes * 60);
    this.startTimer();
  }

  selectOption(questionNumber: number, option: OptionKey): void {
    this.answers.update((current) => ({
      ...current,
      [questionNumber]: option
    }));
  }

  submit(): void {
    const test = this.activeTest();
    if (!test) {
      return;
    }

    this.stopTimer();

    const student = {
      name: this.joinForm.controls.name.value,
      className: this.joinForm.controls.className.value
    };

    this.result.set(this.scoringService.evaluate(test, this.answers(), student));
    this.activeTest.set(null);
  }

  private startTimer(): void {
    this.stopTimer();

    this.timerId = setInterval(() => {
      this.remainingSeconds.update((seconds) => {
        if (seconds <= 1) {
          this.submit();
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private toPassageGroups(test: PublishedTest | null): PassageQuestionGroup[] {
    if (!test || test.testType !== 'reading' || !test.passages?.length) {
      return [];
    }

    return test.passages.map((passage) => ({
      passage,
      questions: test.questions.filter((question) => question.passageId === passage.id)
    }));
  }
}
