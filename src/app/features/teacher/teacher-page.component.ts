import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { TestCodeService } from '../../core/services/test-code.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { TestTemplateService } from '../../core/services/test-template.service';
import { ParseError } from '../../shared/models/test.models';

@Component({
  selector: 'app-teacher-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="page">
      <header class="header">
        <a routerLink="/" class="back-link">Back</a>
        <h1>Teacher Workspace</h1>
      </header>

      <section class="layout">
        <form class="card" [formGroup]="form" (ngSubmit)="publishTest()">
          <h2>Create a Test</h2>

          <label for="title">Test title</label>
          <input id="title" type="text" formControlName="title" />

          <label for="durationMinutes">Duration (minutes)</label>
          <input id="durationMinutes" type="number" min="1" formControlName="durationMinutes" />

          <div class="template-head">
            <h3>Question template (paste plain text)</h3>
            <button type="button" class="ghost" (click)="useQuestionTemplate()">Use sample</button>
          </div>
          <textarea rows="12" formControlName="questionText"></textarea>
          @if (questionErrors().length > 0) {
            <ul class="field-error-list" aria-live="polite">
              @for (error of questionErrors(); track error.message) {
                <li>{{ error.message }}</li>
              }
            </ul>
          }

          <div class="template-head">
            <h3>Answer key template (paste plain text)</h3>
            <button type="button" class="ghost" (click)="useAnswerTemplate()">Use sample</button>
          </div>
          <textarea rows="6" formControlName="answerText"></textarea>
          @if (answerErrors().length > 0) {
            <ul class="field-error-list" aria-live="polite">
              @for (error of answerErrors(); track error.message) {
                <li>{{ error.message }}</li>
              }
            </ul>
          }

          <button class="primary" type="submit" [disabled]="isPublishing()">
            {{ isPublishing() ? 'Publishing...' : 'Publish test' }}
          </button>

          @if (publishedCode()) {
            <p class="success">Published. Test code: <strong>{{ publishedCode() }}</strong></p>
          }

          @if (errors().length > 0) {
            <ul class="error-list" aria-live="polite">
              @for (error of errors(); track error.message) {
                <li>{{ error.message }}</li>
              }
            </ul>
          }
        </form>

        <aside class="card">
          <h2>Validation Preview</h2>
          <p>Detected Questions: {{ previewQuestionCount() }}</p>
          <p>Detected Answer Keys: {{ previewAnswerCount() }}</p>
          <p class="hint">Format: Question N: ... + A./B./C./D. options, and answer lines like 1. A</p>
        </aside>
      </section>
    </main>
  `,
  styles: `
    .page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
      display: grid;
      gap: 1rem;
    }

    .header h1 {
      margin: 0.4rem 0 0;
      color: #113840;
    }

    .back-link {
      color: #0b6978;
      font-weight: 700;
      text-decoration: none;
    }

    .layout {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1rem;
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

    label,
    h3 {
      font-weight: 700;
      color: #143840;
      margin: 0;
      font-size: 0.95rem;
    }

    input,
    textarea {
      border: 1px solid #b7cfd4;
      border-radius: 10px;
      padding: 0.64rem;
      font: inherit;
    }

    .template-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-top: 0.35rem;
    }

    .primary,
    .ghost {
      border: 0;
      border-radius: 10px;
      padding: 0.6rem 0.85rem;
      font-weight: 700;
      cursor: pointer;
    }

    .primary {
      color: #fff;
      background: #0f6a76;
      margin-top: 0.25rem;
      width: fit-content;
    }

    .ghost {
      color: #0f6a76;
      background: #e7f4f5;
    }

    .success {
      color: #0f5f2b;
      margin: 0;
      font-weight: 600;
    }

    .error-list {
      margin: 0;
      padding-left: 1.2rem;
      color: #8f1d1d;
    }

    .field-error-list {
      margin: 0;
      padding-left: 1.2rem;
      color: #b61c1c;
      font-size: 0.88rem;
      line-height: 1.35;
    }

    .hint {
      color: #3b555f;
    }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeacherPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly templateService = inject(TestTemplateService);
  private readonly codeService = inject(TestCodeService);
  private readonly repository = inject(TestRepositoryService);

  readonly form = this.fb.group({
    title: this.fb.control('', [Validators.required]),
    durationMinutes: this.fb.control(30, [Validators.required, Validators.min(1)]),
    questionText: this.fb.control('', [Validators.required]),
    answerText: this.fb.control('', [Validators.required])
  });

  readonly isPublishing = signal(false);
  readonly publishedCode = signal('');
  readonly errors = signal<ParseError[]>([]);

  readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  readonly parseResult = computed(() => {
    const formValue = this.formValue();
    return this.templateService.parse(formValue.questionText ?? '', formValue.answerText ?? '');
  });

  readonly questionErrors = computed(() => this.parseResult().errors.filter((error) => error.scope === 'question'));
  readonly answerErrors = computed(() => this.parseResult().errors.filter((error) => error.scope === 'answer'));

  readonly previewQuestionCount = computed(() => this.parseResult().questions.length);
  readonly previewAnswerCount = computed(() => Object.keys(this.parseResult().answerKey).length);

  useQuestionTemplate(): void {
    this.form.controls.questionText.setValue(this.templateService.questionTemplate);

    if (this.form.controls.title.value.trim().length === 0) {
      this.form.controls.title.setValue('Sample Test');
    }
  }

  useAnswerTemplate(): void {
    this.form.controls.answerText.setValue(this.templateService.answerTemplate);

    if (this.form.controls.title.value.trim().length === 0) {
      this.form.controls.title.setValue('Sample Test');
    }
  }

  async publishTest(): Promise<void> {
    this.publishedCode.set('');
    this.errors.set([]);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      const missingFields: string[] = [];

      if (this.form.controls.title.invalid) {
        missingFields.push('test title');
      }

      if (this.form.controls.questionText.invalid) {
        missingFields.push('question template');
      }

      if (this.form.controls.answerText.invalid) {
        missingFields.push('answer key template');
      }

      const message = missingFields.length > 0
        ? `Please fill all required fields: ${missingFields.join(', ')}.`
        : 'Please fill all required fields.';

      this.errors.set([{ scope: 'general', line: 1, message }]);
      return;
    }

    const parsed = this.parseResult();
    if (parsed.errors.length > 0 || parsed.questions.length === 0) {
      this.errors.set(
        parsed.errors.length > 0 ? parsed.errors : [{ scope: 'general', line: 1, message: 'No questions detected.' }]
      );
      return;
    }

    this.isPublishing.set(true);

    try {
      const code = await this.codeService.generateUniqueCode((candidate) => this.repository.isCodeTaken(candidate));
      const payload = {
        code,
        title: this.form.controls.title.value,
        durationMinutes: this.form.controls.durationMinutes.value,
        questions: parsed.questions,
        answerKey: parsed.answerKey,
        createdAtIso: new Date().toISOString()
      };

      await this.repository.publishTest(payload);
      this.publishedCode.set(code);
    } catch {
      this.errors.set([{ scope: 'general', line: 1, message: 'Failed to publish test. Please try again.' }]);
    } finally {
      this.isPublishing.set(false);
    }
  }
}
