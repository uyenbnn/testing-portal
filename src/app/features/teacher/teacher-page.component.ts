import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { TestCodeService } from '../../core/services/test-code.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { TestTemplateService } from '../../core/services/test-template.service';
import { ParseError, PublishedTest } from '../../shared/models/test.models';

interface CreatedTestItem extends PublishedTest {
  questionCount: number;
  createdAtLabel: string;
}

@Component({
  selector: 'app-teacher-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './teacher-page.component.html',
  styleUrl: './teacher-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeacherPageComponent implements OnInit {
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
  readonly createdTests = signal<PublishedTest[]>([]);
  readonly isLoadingTests = signal(true);
  readonly listError = signal('');
  readonly deletingCodes = signal<Record<string, boolean>>({});

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
  readonly createdTestItems = computed<CreatedTestItem[]>(() =>
    this.createdTests().map((test) => ({
      ...test,
      questionCount: test.questions.length,
      createdAtLabel: this.formatCreatedAt(test.createdAtIso)
    }))
  );

  ngOnInit(): void {
    void this.loadPublishedTests();
  }

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
      this.createdTests.update((tests) => this.sortTests([payload, ...tests.filter((test) => test.code !== code)]));
    } catch {
      this.errors.set([{ scope: 'general', line: 1, message: 'Failed to publish test. Please try again.' }]);
    } finally {
      this.isPublishing.set(false);
    }
  }

  isDeleting(code: string): boolean {
    return this.deletingCodes()[code] ?? false;
  }

  async deleteTest(test: PublishedTest): Promise<void> {
    const confirmed = window.confirm(`Delete test "${test.title}" (${test.code})? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    this.listError.set('');
    this.setDeleting(test.code, true);

    try {
      await this.repository.deleteTest(test.code);
      this.createdTests.update((tests) => tests.filter((current) => current.code !== test.code));

      if (this.publishedCode() === test.code) {
        this.publishedCode.set('');
      }
    } catch {
      this.listError.set('Failed to delete the selected test. Please try again.');
    } finally {
      this.setDeleting(test.code, false);
    }
  }

  private async loadPublishedTests(): Promise<void> {
    this.isLoadingTests.set(true);
    this.listError.set('');

    try {
      const tests = await this.repository.listPublishedTests();
      this.createdTests.set(this.sortTests(tests));
    } catch {
      this.listError.set('Failed to load created tests. Please refresh and try again.');
    } finally {
      this.isLoadingTests.set(false);
    }
  }

  private setDeleting(code: string, isDeleting: boolean): void {
    this.deletingCodes.update((current) => {
      const next = { ...current };

      if (isDeleting) {
        next[code] = true;
      } else {
        delete next[code];
      }

      return next;
    });
  }

  private sortTests(tests: PublishedTest[]): PublishedTest[] {
    return [...tests].sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
  }

  private formatCreatedAt(createdAtIso: string): string {
    const createdAt = new Date(createdAtIso);
    if (Number.isNaN(createdAt.getTime())) {
      return 'Unknown date';
    }

    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(createdAt);
  }
}
