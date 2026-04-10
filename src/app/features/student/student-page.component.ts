import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ScoringService } from '../../core/services/scoring.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { OptionKey, PublishedTest } from '../../shared/models/test.models';

@Component({
  selector: 'app-student-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="page">
      <header class="header">
        <a routerLink="/" class="back-link">Back</a>
        <h1>Student Workspace</h1>
      </header>

      @if (!activeTest()) {
        <section class="card join-card">
          <h2>Join a Test</h2>
          <form [formGroup]="joinForm" (ngSubmit)="joinTest()">
            <label for="testCode">Test code</label>
            <input id="testCode" formControlName="testCode" maxlength="6" />

            <label for="studentName">Name</label>
            <input id="studentName" formControlName="name" />

            <label for="className">Class</label>
            <input id="className" formControlName="className" />

            <button class="primary" type="submit">Start Test</button>
          </form>
          @if (joinError()) {
            <p class="error">{{ joinError() }}</p>
          }
        </section>
      } @else {
        <section class="card test-card">
          <h2>{{ activeTest()?.title }}</h2>
          <p class="timer" [class.warning]="remainingSeconds() <= 60">Time left: {{ timeLabel() }}</p>

          <div class="question-list">
            @for (question of activeTest()!.questions; track question.number) {
              <article class="question-card">
                <h3>Question {{ question.number }}</h3>
                <p>{{ question.prompt }}</p>
                <div class="options">
                  @for (option of optionKeys; track option) {
                    <button
                      type="button"
                      class="option-btn"
                      [class.selected]="answers()[question.number] === option"
                      (click)="selectOption(question.number, option)">
                      {{ option }}. {{ question.options[option] }}
                    </button>
                  }
                </div>
              </article>
            }
          </div>

          <button type="button" class="primary" (click)="submit()">Submit</button>
        </section>
      }

      @if (result()) {
        <section class="card result-card" aria-live="polite">
          <h2>Result</h2>
          <p><strong>{{ result()!.student.name }}</strong> ({{ result()!.student.className }})</p>
          <p>Score: {{ result()!.correctAnswers }}/{{ result()!.totalQuestions }} ({{ result()!.percentage }}%)</p>
        </section>
      }
    </main>
  `,
  styles: `
    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
      display: grid;
      gap: 1rem;
    }

    .back-link {
      color: #0b6978;
      font-weight: 700;
      text-decoration: none;
    }

    .header h1 {
      margin: 0.4rem 0 0;
      color: #113840;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 1rem;
    }

    form {
      display: grid;
      gap: 0.65rem;
    }

    label {
      font-weight: 700;
      color: #143840;
    }

    input {
      border: 1px solid #b7cfd4;
      border-radius: 10px;
      padding: 0.62rem;
      font: inherit;
    }

    .primary {
      border: 0;
      border-radius: 10px;
      padding: 0.6rem 0.85rem;
      font-weight: 700;
      cursor: pointer;
      color: #fff;
      background: #0f6a76;
      width: fit-content;
      margin-top: 0.4rem;
    }

    .error {
      color: #8f1d1d;
      margin-bottom: 0;
    }

    .timer {
      font-weight: 700;
      color: #184550;
    }

    .timer.warning {
      color: #9a2c0f;
    }

    .question-list {
      display: grid;
      gap: 0.8rem;
      margin: 1rem 0;
    }

    .question-card {
      border: 1px solid #c8d8dc;
      border-radius: 10px;
      padding: 0.7rem;
    }

    .question-card h3,
    .question-card p {
      margin-top: 0;
    }

    .options {
      display: grid;
      gap: 0.4rem;
    }

    .option-btn {
      text-align: left;
      border: 1px solid #bbd3d8;
      border-radius: 10px;
      background: #fff;
      padding: 0.58rem;
      cursor: pointer;
    }

    .option-btn.selected {
      border-color: #0f6a76;
      background: #e6f3f6;
    }
  `,
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
}
