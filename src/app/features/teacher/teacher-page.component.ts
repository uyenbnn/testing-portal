import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { TestCodeService } from '../../core/services/test-code.service';
import { TeacherAuthService } from '../../core/services/teacher-auth.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { TestTemplateService } from '../../core/services/test-template.service';
import { TeacherGender, TeacherProfile } from '../../shared/models/auth.models';
import { ParseError, PublishedTest, ReadingPassage, TestQuestion, TestType } from '../../shared/models/test.models';
import { TeacherTestBuilder } from './components/teacher-test-builder/teacher-test-builder';
import { TeacherTestLibrary } from './components/teacher-test-library/teacher-test-library';
import { CreatedTestItem, PassageQuestionGroup, TeacherTestTypeOption } from './teacher-page.models';

type TeacherPageTab = 'create' | 'created';
type TeacherAuthMode = 'login' | 'signup';
type TeacherAccessState = 'loading' | 'signed-out' | 'pending' | 'approved' | 'rejected' | 'missing-profile';

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
  private readonly teacherAuth = inject(TeacherAuthService);
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

  readonly loginForm = this.fb.group({
    username: this.fb.control('', [Validators.required]),
    password: this.fb.control('', [Validators.required])
  });

  readonly signupForm = this.fb.group({
    firstName: this.fb.control('', [Validators.required, Validators.maxLength(60)]),
    lastName: this.fb.control('', [Validators.required, Validators.maxLength(60)]),
    gender: this.fb.control<TeacherGender>('prefer_not_to_say', [Validators.required]),
    phoneNumber: this.fb.control('', [Validators.required, Validators.pattern(/^[0-9+()\s-]{7,24}$/)]),
    email: this.fb.control('', [Validators.required, Validators.email]),
    username: this.fb.control('', [Validators.required, Validators.minLength(4), Validators.maxLength(64), Validators.pattern(/^\S+$/)]),
    password: this.fb.control('', [Validators.required, Validators.minLength(8)])
  });

  readonly isPublishing = signal(false);
  readonly isAuthenticating = signal(false);
  readonly publishedCode = signal('');
  readonly errors = signal<ParseError[]>([]);
  readonly createdTests = signal<PublishedTest[]>([]);
  readonly isLoadingTests = signal(true);
  readonly listError = signal('');
  readonly deletingCodes = signal<Record<string, boolean>>({});
  readonly selectedTest = signal<CreatedTestItem | null>(null);
  readonly pendingDeleteTest = signal<PublishedTest | null>(null);
  readonly activeTab = signal<TeacherPageTab>('create');
  readonly authMode = signal<TeacherAuthMode>('login');
  readonly authError = signal('');
  readonly authNotice = signal('Create an account, then wait for admin approval before accessing the teacher workspace.');
  readonly hasLoadedApprovedTests = signal(false);

  readonly teacherProfile = this.teacherAuth.currentProfile;
  readonly teacherDisplayName = this.teacherAuth.displayName;
  readonly isTeacherReady = this.teacherAuth.isReady;
  readonly isTeacherProfileLoading = this.teacherAuth.isProfileLoading;
  readonly accessState = computed<TeacherAccessState>(() => {
    if (!this.isTeacherReady() || this.isTeacherProfileLoading()) {
      return 'loading';
    }

    if (!this.teacherAuth.isAuthenticated()) {
      return 'signed-out';
    }

    const profile = this.teacherProfile();
    if (!profile) {
      return 'missing-profile';
    }

    return profile.status;
  });
  readonly teacherStatusLabel = computed(() => this.formatStatusLabel(this.accessState()));
  readonly teacherStatusDescription = computed(() => this.describeAccessState(this.accessState(), this.teacherProfile()));

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

  readonly signupGenderOptions: { value: TeacherGender; label: string }[] = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' }
  ];

  constructor() {
    effect(() => {
      const accessState = this.accessState();

      if (accessState === 'approved') {
        if (!this.hasLoadedApprovedTests()) {
          this.hasLoadedApprovedTests.set(true);
          void this.loadPublishedTests();
        }

        return;
      }

      this.hasLoadedApprovedTests.set(false);
      this.createdTests.set([]);
      this.isLoadingTests.set(false);
      this.listError.set('');
      this.selectedTest.set(null);
      this.pendingDeleteTest.set(null);
      this.deletingCodes.set({});
      this.publishedCode.set('');
    });
  }

  ngOnInit(): void {
    if (this.accessState() === 'approved' && !this.hasLoadedApprovedTests()) {
      this.hasLoadedApprovedTests.set(true);
      void this.loadPublishedTests();
    }
  }

  setAuthMode(mode: TeacherAuthMode): void {
    this.authMode.set(mode);
    this.authError.set('');
  }

  async loginTeacher(): Promise<void> {
    this.authError.set('');
    this.loginForm.markAllAsTouched();

    if (this.loginForm.invalid) {
      this.authError.set('Enter your username and password to continue.');
      return;
    }

    this.isAuthenticating.set(true);

    try {
      await this.teacherAuth.login(
        this.loginForm.controls.username.value,
        this.loginForm.controls.password.value
      );

      this.authNotice.set('Login successful. Your workspace opens automatically once your account is approved.');
      this.loginForm.reset({ username: '', password: '' });
    } catch (error) {
      this.authError.set(this.toAuthErrorMessage(error));
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  async signUpTeacher(): Promise<void> {
    this.authError.set('');
    this.signupForm.markAllAsTouched();

    if (this.signupForm.invalid) {
      this.authError.set(this.getSignupValidationMessage());
      return;
    }

    this.isAuthenticating.set(true);

    try {
      await this.teacherAuth.signUp({
        firstName: this.signupForm.controls.firstName.value,
        lastName: this.signupForm.controls.lastName.value,
        gender: this.signupForm.controls.gender.value,
        phoneNumber: this.signupForm.controls.phoneNumber.value,
        email: this.signupForm.controls.email.value,
        username: this.signupForm.controls.username.value,
        password: this.signupForm.controls.password.value
      });

      this.authNotice.set('Account created. The admin must approve it before you can enter the teacher workspace.');
      this.signupForm.reset({
        firstName: '',
        lastName: '',
        gender: 'prefer_not_to_say',
        phoneNumber: '',
        email: '',
        username: '',
        password: ''
      });
    } catch (error) {
      this.authError.set(this.toAuthErrorMessage(error));
    } finally {
      this.isAuthenticating.set(false);
    }
  }

  async logoutTeacher(): Promise<void> {
    await this.teacherAuth.logout();
    this.authNotice.set('You have been signed out.');
    this.authError.set('');
    this.setAuthMode('login');
  }

  async refreshApprovalStatus(): Promise<void> {
    this.authError.set('');

    try {
      await this.teacherAuth.refreshProfile();
    } catch {
      this.authError.set('Failed to refresh your approval status. Please try again.');
    }
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

  private formatStatusLabel(accessState: TeacherAccessState): string {
    switch (accessState) {
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending Approval';
      case 'rejected':
        return 'Rejected';
      case 'loading':
        return 'Loading';
      case 'missing-profile':
        return 'Account Removed';
      default:
        return 'Not Signed In';
    }
  }

  private describeAccessState(accessState: TeacherAccessState, profile: TeacherProfile | null): string {
    switch (accessState) {
      case 'approved':
        return `${profile?.firstName ?? 'Teacher'}, your account is approved and you can manage tests.`;
      case 'pending':
        return 'Your account is waiting for admin approval. You can sign in again later to check the status.';
      case 'rejected':
        return 'Your request was rejected. Contact the admin if you need a new account reviewed.';
      case 'missing-profile':
        return 'Your account record is no longer available in the system.';
      case 'loading':
        return 'Checking your session and approval status.';
      default:
        return 'Sign in or create a teacher account to access this workspace.';
    }
  }

  private toAuthErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'Authentication failed. Please try again.';
    }

    switch (error.message) {
      case 'USERNAME_TAKEN':
        return 'That username is already in use. Choose a different username.';
      case 'INVALID_CREDENTIALS':
        return 'Incorrect username or password.';
      case 'ACCOUNT_NOT_FOUND':
        return 'This account is no longer available. Please contact the admin.';
      case 'ACCOUNT_REJECTED':
        return 'This account was rejected and cannot access the teacher workspace.';
      default:
        if (error.message.includes('CONFIGURATION_NOT_FOUND') || error.message.includes('auth/configuration-not-found')) {
          return 'Firebase Authentication is not configured for this project. In Firebase Console, enable Authentication and turn on the Email/Password sign-in provider.';
        }

        if (error.message.includes('auth/email-already-in-use')) {
          return 'That email address is already registered.';
        }

        if (error.message.includes('auth/invalid-credential')) {
          return 'Incorrect username or password.';
        }

        if (error.message.includes('auth/weak-password')) {
          return 'Use a stronger password with at least 8 characters.';
        }

        return 'Authentication failed. Please try again.';
    }
  }

  hasSignupFieldError(fieldName: keyof typeof this.signupForm.controls): boolean {
    const control = this.signupForm.controls[fieldName];
    return control.invalid && (control.touched || control.dirty);
  }

  getSignupFieldMessage(fieldName: keyof typeof this.signupForm.controls): string {
    const control = this.signupForm.controls[fieldName];

    if (!control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'This field is required.';
    }

    if (control.errors['email']) {
      return 'Enter a valid email address.';
    }

    if (control.errors['minlength']) {
      const requiredLength = control.errors['minlength']['requiredLength'] as number;
      return `Use at least ${requiredLength} characters.`;
    }

    if (control.errors['maxlength']) {
      const requiredLength = control.errors['maxlength']['requiredLength'] as number;
      return `Use no more than ${requiredLength} characters.`;
    }

    if (control.errors['pattern']) {
      if (fieldName === 'phoneNumber') {
        return 'Use a valid phone number with digits and optional +, space, parentheses, or -.';
      }

      if (fieldName === 'username') {
        return 'Username cannot contain spaces.';
      }
    }

    return 'Enter a valid value.';
  }

  private getSignupValidationMessage(): string {
    const labels: Record<keyof typeof this.signupForm.controls, string> = {
      firstName: 'first name',
      lastName: 'last name',
      gender: 'gender',
      phoneNumber: 'phone number',
      email: 'email',
      username: 'username',
      password: 'password'
    };

    const invalidFields = (Object.keys(this.signupForm.controls) as Array<keyof typeof this.signupForm.controls>)
      .filter((fieldName) => this.signupForm.controls[fieldName].invalid)
      .map((fieldName) => labels[fieldName]);

    if (invalidFields.length === 0) {
      return 'Complete all required fields with valid information before creating the account.';
    }

    return `Please fix these fields: ${invalidFields.join(', ')}.`;
  }
}
