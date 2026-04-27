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
  readonly resultSaveError = signal('');
  readonly answers = signal<Record<number, OptionKey>>({});
  readonly remainingSeconds = signal(0);
  readonly result = signal<ReturnType<ScoringService['evaluate']> | null>(null);

  readonly optionKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
  readonly hasReadingSection = computed(() => (this.activeTest()?.passages?.length ?? 0) > 0);
  readonly readingPassageGroups = computed(() => this.toPassageGroups(this.activeTest()));
  readonly standaloneQuestions = computed(() => (this.activeTest()?.questions ?? []).filter((question) => !question.passageId));
  readonly timeLabel = computed(() => {
    const total = this.remainingSeconds();
    const mins = Math.floor(total / 60).toString().padStart(2, '0');
    const secs = (total % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  });

  private timerId: ReturnType<typeof setInterval> | null = null;
  private isSubmitting = false;
  private hasSubmitted = false;

  ngOnDestroy(): void {
    this.stopTimer();
  }

  async joinTest(): Promise<void> {
    this.joinError.set('');
    this.resultSaveError.set('');
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
    this.hasSubmitted = false;
    this.isSubmitting = false;
    this.startTimer();
  }

  selectOption(questionNumber: number, option: OptionKey): void {
    this.answers.update((current) => ({
      ...current,
      [questionNumber]: option
    }));
  }

  async submit(): Promise<void> {
    const test = this.activeTest();
    if (!test || this.isSubmitting || this.hasSubmitted) {
      return;
    }

    this.isSubmitting = true;
    this.resultSaveError.set('');
    this.stopTimer();

    const student = {
      name: this.joinForm.controls.name.value,
      className: this.joinForm.controls.className.value
    };

    const summary = this.scoringService.evaluate(test, this.answers(), student);
    this.result.set(summary);
    this.activeTest.set(null);
    this.hasSubmitted = true;

    try {
      await this.repository.saveStudentResult(summary, this.answers(), new Date().toISOString());
    } catch {
      this.resultSaveError.set('Không thể lưu kết quả lên hệ thống. Vui lòng thông báo cho giáo viên của bạn.');
    } finally {
      this.isSubmitting = false;
    }
  }

  private startTimer(): void {
    this.stopTimer();

    this.timerId = setInterval(() => {
      this.remainingSeconds.update((seconds) => {
        if (seconds <= 1) {
          void this.submit();
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
    if (!test || !test.passages?.length) {
      return [];
    }

    return test.passages.map((passage) => ({
      passage,
      questions: test.questions.filter((question) => question.passageId === passage.id)
    }));
  }
}
