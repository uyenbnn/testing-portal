import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { TestCodeService } from '../../core/services/test-code.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { TestTemplateService } from '../../core/services/test-template.service';
import { ParseError, PublishedTest, ReadingPassage, TestQuestion, TestType } from '../../shared/models/test.models';
import { TeacherTestBuilder } from './components/teacher-test-builder/teacher-test-builder';
import { TeacherTestLibrary } from './components/teacher-test-library/teacher-test-library';
import { CreatedTestItem, PassageQuestionGroup, TeacherTestTypeOption } from './teacher-page.models';

type TeacherPageTab = 'create' | 'created';

@Component({
  selector: 'app-teacher-page',
  imports: [ReactiveFormsModule, RouterLink, TeacherTestBuilder, TeacherTestLibrary],
  templateUrl: './teacher-page.component.html',
  styleUrl: './teacher-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeDialogs()'
  }
})
export class TeacherPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly templateService = inject(TestTemplateService);
  private readonly codeService = inject(TestCodeService);
  private readonly repository = inject(TestRepositoryService);

  readonly form = this.fb.group({
    title: this.fb.control('', [Validators.required]),
    testType: this.fb.control<TestType>('standard', [Validators.required]),
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
  readonly selectedTest = signal<CreatedTestItem | null>(null);
  readonly pendingDeleteTest = signal<PublishedTest | null>(null);
  readonly activeTab = signal<TeacherPageTab>('create');

  readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  readonly parseResult = computed(() => {
    const formValue = this.formValue();
    return this.templateService.parse(
      formValue.questionText ?? '',
      formValue.answerText ?? '',
      formValue.testType ?? 'standard'
    );
  });

  readonly selectedTestType = computed(() => this.formValue().testType ?? 'standard');
  readonly questionErrors = computed(() => this.parseResult().errors.filter((error) => error.scope === 'question'));
  readonly answerErrors = computed(() => this.parseResult().errors.filter((error) => error.scope === 'answer'));

  readonly previewQuestionCount = computed(() => this.parseResult().questions.length);
  readonly previewPassageCount = computed(() => this.parseResult().passages.length);
  readonly previewAnswerCount = computed(() => Object.keys(this.parseResult().answerKey).length);
  readonly selectedTestPassageGroups = computed(() => {
    const test = this.selectedTest();
    return test ? this.toPassageGroups(test) : [];
  });
  readonly createdTestItems = computed<CreatedTestItem[]>(() =>
    this.createdTests().map((test) => ({
      ...test,
      questionCount: test.questions.length,
      passageCount: test.passages?.length ?? 0,
      createdAtLabel: this.formatCreatedAt(test.createdAtIso),
      testTypeLabel: this.formatTestType(test.testType)
    }))
  );

  readonly testTypes: TeacherTestTypeOption[] = [
    { value: 'standard', label: 'Standard MCQ' },
    { value: 'reading', label: 'Reading' }
  ];

  readonly tabs: { id: TeacherPageTab; label: string }[] = [
    { id: 'create', label: 'Create Test' },
    { id: 'created', label: 'Created Tests' }
  ];

  ngOnInit(): void {
    void this.loadPublishedTests();
  }

  setActiveTab(tab: TeacherPageTab): void {
    if (this.activeTab() === tab) {
      return;
    }

    this.closeDialogs();
    this.activeTab.set(tab);
  }

  useQuestionTemplate(): void {
    const testType = this.form.controls.testType.value;
    this.form.controls.questionText.setValue(this.templateService.getQuestionTemplate(testType));

    if (this.form.controls.title.value.trim().length === 0) {
      this.form.controls.title.setValue(testType === 'reading' ? 'Sample Reading Test' : 'Sample Test');
    }
  }

  useAnswerTemplate(): void {
    const testType = this.form.controls.testType.value;
    this.form.controls.answerText.setValue(this.templateService.getAnswerTemplate(testType));

    if (this.form.controls.title.value.trim().length === 0) {
      this.form.controls.title.setValue(testType === 'reading' ? 'Sample Reading Test' : 'Sample Test');
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
      const payload: PublishedTest = {
        code,
        title: this.form.controls.title.value,
        testType: this.form.controls.testType.value,
        durationMinutes: this.form.controls.durationMinutes.value,
        questions: parsed.questions,
        answerKey: parsed.answerKey,
        createdAtIso: new Date().toISOString()
      };

      if (payload.testType === 'reading') {
        payload.passages = parsed.passages;
      }

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

  openTestDetails(test: CreatedTestItem): void {
    this.selectedTest.set(test);
  }

  closeSelectedTest(): void {
    this.selectedTest.set(null);
  }

  requestDeleteTest(test: PublishedTest): void {
    this.pendingDeleteTest.set(test);
  }

  cancelDeleteRequest(): void {
    this.pendingDeleteTest.set(null);
  }

  closeDialogs(): void {
    if (this.pendingDeleteTest()) {
      this.cancelDeleteRequest();
      return;
    }

    this.closeSelectedTest();
  }

  async deleteTest(test: PublishedTest): Promise<void> {
    this.listError.set('');
    this.setDeleting(test.code, true);

    try {
      await this.repository.deleteTest(test.code);
      this.createdTests.update((tests) => tests.filter((current) => current.code !== test.code));
      this.cancelDeleteRequest();

      if (this.selectedTest()?.code === test.code) {
        this.closeSelectedTest();
      }

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

  private formatTestType(testType: TestType): string {
    return testType === 'reading' ? 'Reading' : 'Standard MCQ';
  }

  private toPassageGroups(test: PublishedTest): PassageQuestionGroup[] {
    if (test.testType !== 'reading' || !test.passages?.length) {
      return [];
    }

    return test.passages.map((passage) => ({
      passage,
      questions: test.questions.filter((question) => question.passageId === passage.id)
    }));
  }
}
