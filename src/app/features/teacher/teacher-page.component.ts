import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { TestCodeService } from '../../core/services/test-code.service';
import { TeacherAuthService } from '../../core/services/teacher-auth.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { TestTemplateService } from '../../core/services/test-template.service';
import { TeacherGender, TeacherProfile } from '../../shared/models/auth.models';
import { ParseError, PublishedTest, ReadingPassage, StudentTestResultRecord, TestQuestion, TestType, OptionKey } from '../../shared/models/test.models';
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
    numQuestions: this.fb.control<number | null>(null),
    numPassages: this.fb.control<number | null>(null),
    questionsTable: this.fb.array<any>([]),
    readingPassages: this.fb.array<any>([]),
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
  readonly selectedTestResults = signal<StudentTestResultRecord[]>([]);
  readonly isLoadingSelectedTestResults = signal(false);
  readonly selectedTestResultsError = signal('');
  readonly pendingDeleteTest = signal<PublishedTest | null>(null);
  readonly activeTab = signal<TeacherPageTab>('create');
  readonly authMode = signal<TeacherAuthMode>('login');
  readonly authError = signal('');
  readonly authNotice = signal('Tạo tài khoản giáo viên hoặc đăng nhập để tạo bài kiểm tra.'); // "Create a teacher account or log in to publish tests."
  readonly hasLoadedApprovedTests = signal(false);
  readonly MCQ_ANSWER_OPTIONS: OptionKey[] = ['A', 'B', 'C', 'D'];

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
    const isTableMode = this.isTableMode();

    if (isTableMode) {
      return this.buildParseResultFromTableRows();
    }

    return this.templateService.parse(
      formValue.questionText ?? '',
      formValue.answerText ?? '',
      formValue.testType ?? 'standard'
    );
  });

  readonly selectedTestType = computed(() => this.formValue().testType ?? 'standard');
  readonly questionErrors = computed(() => this.parseResult().errors.filter((error) => error.scope === 'question'));
  readonly answerErrors = computed(() => this.parseResult().errors.filter((error) => error.scope === 'answer'));

  readonly isTableMode = computed(() => {
    const testType = this.selectedTestType();
    const numQuestions = this.formValue().numQuestions ?? 0;
    const numPassages = this.formValue().numPassages ?? 0;

    if (testType === 'reading') {
      return numPassages > 0;
    }

    if (testType === 'mixed') {
      return numQuestions > 0 && numPassages > 0;
    }

    return numQuestions > 0;
  });
  readonly questionsTableFormArray = computed(() => this.form.get('questionsTable') as FormArray);
  readonly readingPassagesFormArray = computed(() => this.form.get('readingPassages') as FormArray);
  readonly numQuestionsValue = computed(() => this.formValue().numQuestions ?? 0);
  readonly numPassagesValue = computed(() => this.formValue().numPassages ?? 0);
  readonly readingPassageOptions = computed(() =>
    this.readingPassagesFormArray().controls.map((_, index) => ({
      value: `P${index + 1}`,
      label: `Đoạn ${index + 1}`
    }))
  );

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
      testTypeLabel: this.formatTestType(test.testType),
      creatorNameLabel: this.formatCreatorName(test),
      creatorUsernameLabel: this.formatCreatorUsername(test)
    }))
  );

  readonly testTypes: TeacherTestTypeOption[] = [
    { value: 'standard', label: 'MCQ Tiêu chuẩn' },
    { value: 'reading', label: 'Đọc hiểu' },
    { value: 'mixed', label: 'Kết hợp MCQ + Đọc hiểu' }
  ];

  readonly tabs: { id: TeacherPageTab; label: string }[] = [
    { id: 'create', label: 'Tạo bài kiểm tra' },
    { id: 'created', label: 'Bài kiểm tra đã tạo' }
  ];

  readonly signupGenderOptions: { value: TeacherGender; label: string }[] = [
    { value: 'female', label: 'Nữ' },
    { value: 'male', label: 'Nam' },
    { value: 'other', label: 'Khác' },
    { value: 'prefer_not_to_say', label: 'Không muốn tiết lộ' }
  ];

  constructor() {
    effect(() => {
      const testType = this.selectedTestType();
      const numQuestions = this.numQuestionsValue();
      const numPassages = this.numPassagesValue();
      const readingPassages = this.formValue().readingPassages ?? [];

      if (testType === 'standard' && numQuestions > 0 && numQuestions <= 100) {
        this.regenerateMcqTableRows(numQuestions, 'standard');
        this.readingPassagesFormArray().clear();
      } else if (testType === 'reading' && numPassages > 0 && numPassages <= 50) {
        // Track per-passage row values so question table regenerates when questionCount changes.
        void readingPassages;
        this.regenerateReadingPassageRows(numPassages);
        this.regenerateQuestionsBySections();
      } else if (testType === 'mixed' && numQuestions > 0 && numQuestions <= 100 && numPassages > 0 && numPassages <= 50) {
        void readingPassages;
        this.regenerateReadingPassageRows(numPassages);
        this.regenerateQuestionsBySections(numQuestions);
      } else {
        this.questionsTableFormArray().clear();
        this.readingPassagesFormArray().clear();
      }
    });

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
      this.selectedTestResults.set([]);
      this.selectedTestResultsError.set('');
      this.isLoadingSelectedTestResults.set(false);
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
      this.authError.set('Vui lòng nhập tên người dùng và mật khẩu để tiếp tục.');
      return;
    }

    this.isAuthenticating.set(true);

    try {
      await this.teacherAuth.login(
        this.loginForm.controls.username.value,
        this.loginForm.controls.password.value
      );

      this.authNotice.set('Đăng nhập thành công. Không gian làm việc của bạn sẽ mở tự động khi tài khoản của bạn được phê duyệt.');
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

      this.authNotice.set('Tài khoản đã được tạo. Quản trị viên phải phê duyệt trước khi bạn có thể vào không gian làm việc của giáo viên.');
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
    this.authNotice.set('Bạn đã đăng xuất.');
    this.authError.set('');
    this.setAuthMode('login');
  }

  async refreshApprovalStatus(): Promise<void> {
    this.authError.set('');

    try {
      await this.teacherAuth.refreshProfile();
    } catch {
      this.authError.set('Không thể làm mới trạng thái phê duyệt của bạn. Vui lòng thử lại.');
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

    const isTableMode = this.isTableMode();
    const testType = this.form.controls.testType.value;

    // Validate title and duration always
    if (!this.form.controls.title.value || !this.form.controls.title.value.trim()) {
      this.errors.set([{ scope: 'general', line: 1, message: 'Vui lòng nhập tiêu đề bài kiểm tra.' }]);
      return;
    }

    if (testType !== 'standard' && testType !== 'reading' && testType !== 'mixed') {
      this.errors.set([{ scope: 'general', line: 1, message: 'Loại bài kiểm tra không hợp lệ.' }]);
      return;
    }

    // Validate based on input mode
    if (isTableMode) {
      if ((this.numQuestionsValue() ?? 0) <= 0 && (testType === 'standard' || testType === 'mixed')) {
        this.errors.set([{ scope: 'general', line: 1, message: testType === 'mixed' ? 'Vui lòng nhập số lượng câu hỏi MCQ độc lập.' : 'Vui lòng nhập số lượng câu hỏi.' }]);
        return;
      }

      if ((testType === 'reading' || testType === 'mixed') && (this.numPassagesValue() ?? 0) <= 0) {
        this.errors.set([{ scope: 'general', line: 1, message: 'Vui lòng nhập số lượng đoạn văn.' }]);
        return;
      }
    } else {
      // Template mode validation
      if (!this.form.controls.questionText.value || !this.form.controls.questionText.value.trim()) {
        this.errors.set([{ scope: 'general', line: 1, message: 'Vui lòng nhập mẫu câu hỏi.' }]);
        return;
      }

      if (!this.form.controls.answerText.value || !this.form.controls.answerText.value.trim()) {
        this.errors.set([{ scope: 'general', line: 1, message: 'Vui lòng nhập mẫu đáp án.' }]);
        return;
      }
    }

    const parsed = this.parseResult();
    if (parsed.errors.length > 0 || parsed.questions.length === 0) {
      this.errors.set(
        parsed.errors.length > 0 ? parsed.errors : [{ scope: 'general', line: 1, message: 'Không phát hiện câu hỏi.' }]
      );
      return;
    }

    this.isPublishing.set(true);

    try {
      const code = await this.codeService.generateUniqueCode((candidate) => this.repository.isCodeTaken(candidate));
      const teacherProfile = this.teacherProfile();

      if (!teacherProfile) {
        this.errors.set([{ scope: 'general', line: 1, message: 'Phiên của bạn thiếu chi tiết hồ sơ. Vui lòng đăng nhập lại.' }]);
        return;
      }

      const payload: PublishedTest = {
        code,
        title: this.form.controls.title.value,
        testType: testType,
        durationMinutes: this.form.controls.durationMinutes.value,
        questions: parsed.questions,
        answerKey: parsed.answerKey,
        createdAtIso: new Date().toISOString(),
        creator: {
          uid: teacherProfile.uid,
          username: teacherProfile.username,
          displayName: `${teacherProfile.firstName} ${teacherProfile.lastName}`.trim()
        }
      };

      if (payload.testType === 'reading' || payload.testType === 'mixed') {
        payload.passages = parsed.passages;
      }

      await this.repository.publishTest(payload);
      this.publishedCode.set(code);
      this.createdTests.update((tests) => this.sortTests([payload, ...tests.filter((test) => test.code !== code)]));
    } catch (error) {
      const message = error instanceof Error && error.message.trim().length > 0
        ? `Failed to publish test: ${error.message}`
        : 'Failed to publish test. Please try again.';
      this.errors.set([{ scope: 'general', line: 1, message }]);
    } finally {
      this.isPublishing.set(false);
    }
  }

  isDeleting(code: string): boolean {
    return this.deletingCodes()[code] ?? false;
  }

  openTestDetails(test: CreatedTestItem): void {
    this.selectedTest.set(test);
    void this.loadSelectedTestResults(test.code);
  }

  closeSelectedTest(): void {
    this.selectedTest.set(null);
    this.selectedTestResults.set([]);
    this.selectedTestResultsError.set('');
    this.isLoadingSelectedTestResults.set(false);
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
      this.listError.set('Không thể xóa bài kiểm tra đã chọn. Vui lòng thử lại.');
    } finally {
      this.setDeleting(test.code, false);
    }
  }

  private async loadPublishedTests(): Promise<void> {
    this.isLoadingTests.set(true);
    this.listError.set('');

    try {
      const teacherProfile = this.teacherProfile();
      if (!teacherProfile) {
        this.createdTests.set([]);
        this.listError.set('Không thể tải hồ sơ giáo viên của bạn. Vui lòng đăng xuất và đăng nhập lại.');
        return;
      }

      const tests = await this.repository.listPublishedTestsByCreator(teacherProfile.uid);
      this.createdTests.set(this.sortTests(tests));
    } catch {
      this.listError.set('Không thể tải các bài kiểm tra đã tạo. Vui lòng làm mới và thử lại  .');
    } finally {
      this.isLoadingTests.set(false);
    }
  }

  private async loadSelectedTestResults(testCode: string): Promise<void> {
    this.selectedTestResultsError.set('');
    this.isLoadingSelectedTestResults.set(true);

    try {
      const results = await this.repository.listStudentResultsByTestCode(testCode);
      if (this.selectedTest()?.code !== testCode) {
        return;
      }

      this.selectedTestResults.set(results);
    } catch {
      if (this.selectedTest()?.code !== testCode) {
        return;
      }

      this.selectedTestResults.set([]);
      this.selectedTestResultsError.set('Không thể tải kết quả học sinh cho bài kiểm tra này. Vui lòng thử lại.');
    } finally {
      if (this.selectedTest()?.code === testCode) {
        this.isLoadingSelectedTestResults.set(false);
      }
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
    switch (testType) {
      case 'reading':
        return 'Reading';
      case 'mixed':
        return 'Mixed MCQ + Reading';
      default:
        return 'Standard MCQ';
    }
  }

  private formatCreatorName(test: PublishedTest): string {
    return test.creator?.displayName || 'Unknown creator';
  }

  private formatCreatorUsername(test: PublishedTest): string {
    return test.creator?.username ? `@${test.creator.username}` : 'Unknown username';
  }

  private toPassageGroups(test: PublishedTest): PassageQuestionGroup[] {
    if (!test.passages?.length) {
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
        return 'Xin chào!';
      case 'pending':
        return 'Đang chờ phê duyệt';
      case 'rejected':
        return 'Bị từ chối';
      case 'loading':
        return 'Đang tải';
      case 'missing-profile':
        return 'Tài khoản đã bị xóa';
      default:
        return 'Chưa đăng nhập';
    }
  }

  private describeAccessState(accessState: TeacherAccessState, profile: TeacherProfile | null): string {
    switch (accessState) {
      case 'approved':
        return `${profile?.firstName ?? 'Teacher'}, hãy tạo và quản lý bài kiểm tra ở đây nhé.`;
      case 'pending':
        return 'Tài khoản của bạn đang chờ phê duyệt từ quản trị viên. Bạn có thể đăng nhập lại sau để kiểm tra trạng thái.';
      case 'rejected':
        return 'Yêu cầu của bạn đã bị từ chối. Liên hệ với quản trị viên nếu bạn cần xem xét lại tài khoản mới.';
      case 'missing-profile':
        return 'Hồ sơ tài khoản của bạn không còn có sẵn trong hệ thống.';
      case 'loading':
        return 'Đang kiểm tra phiên và trạng thái phê duyệt của bạn.';
      default:
        return 'Đăng nhập hoặc tạo tài khoản giáo viên để truy cập không gian làm việc này.';
    }
  }

  private toAuthErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'Xác thực thất bại. Vui lòng thử lại.';
    }

    switch (error.message) {
      case 'USERNAME_TAKEN':
        return 'Tên người dùng này đã được sử dụng. Vui lòng chọn tên khác.';
      case 'INVALID_CREDENTIALS':
        return 'Tên người dùng hoặc mật khẩu không đúng.';
      case 'ACCOUNT_NOT_FOUND':
        return 'Tài khoản này không còn tồn tại. Vui lòng liên hệ với quản trị viên.';
      case 'ACCOUNT_REJECTED':
        return 'Tài khoản này đã bị từ chối và không thể truy cập không gian làm việc của giáo viên.';
      default:
        if (error.message.includes('CONFIGURATION_NOT_FOUND') || error.message.includes('auth/configuration-not-found')) {
          return 'Firebase Authentication chưa được cấu hình cho dự án này. Trong Firebase Console, bật Authentication và bật nhà cung cấp đăng nhập Email/Password.';
        }

        if (error.message.includes('auth/email-already-in-use')) {
          return 'Địa chỉ email này đã được đăng ký. Vui lòng sử dụng địa chỉ email khác.';
        }

        if (error.message.includes('auth/invalid-credential')) {
          return 'Tên người dùng hoặc mật khẩu không đúng.';
        }

        if (error.message.includes('auth/weak-password')) {
          return 'Sử dụng mật khẩu mạnh hơn với ít nhất 8 ký tự.';
        }

        return 'Xác thực thất bại. Vui lòng thử lại.';
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
      return 'Trường này là bắt buộc.';
    }

    if (control.errors['email']) {
      return 'Nhập địa chỉ email hợp lệ.';
    }

    if (control.errors['minlength']) {
      const requiredLength = control.errors['minlength']['requiredLength'] as number;
      return `Sử dụng ít nhất ${requiredLength} ký tự.`;
    }

    if (control.errors['maxlength']) {
      const requiredLength = control.errors['maxlength']['requiredLength'] as number;
      return `Sử dụng không quá ${requiredLength} ký tự.`;
    }

    if (control.errors['pattern']) {
      if (fieldName === 'phoneNumber') {
        return 'Sử dụng số điện thoại hợp lệ với các chữ số và tùy chọn +, khoảng trắng, dấu ngoặc hoặc -.';
      }

      if (fieldName === 'username') {
        return 'Tên người dùng không được chứa khoảng trắng.';
      }
    }

    return 'Nhập giá trị hợp lệ.';
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
      return 'Vui lòng điền vào tất cả các trường hợp lệ để tạo tài khoản giáo viên.';
    }

    return `Vui lòng sửa các trường sau: ${invalidFields.join(', ')}.`;
  }

  regenerateMcqTableRows(count: number, testType: TestType): void {
    const formArray = this.questionsTableFormArray();
    const targetCount = Math.max(0, Math.min(count, 100)); // Clamp between 0-100

    // Remove excess rows
    while (formArray.length > targetCount) {
      formArray.removeAt(formArray.length - 1);
    }

    // Add new rows
    while (formArray.length < targetCount) {
      const rowIndex = formArray.length + 1;
      formArray.push(
        this.fb.group({
          questionNumber: this.fb.control(rowIndex),
          question: this.fb.control('', [Validators.required]),
          answerA: this.fb.control('', [Validators.required]),
          answerB: this.fb.control('', [Validators.required]),
          answerC: this.fb.control('', [Validators.required]),
          answerD: this.fb.control('', [Validators.required]),
	          passageId: this.fb.control<string | null>(testType === 'reading' ? 'P1' : null),
          correctAnswer: this.fb.control<OptionKey | null>(null, [Validators.required])
        })
      );
    }
  }

  regenerateReadingPassageRows(count: number): void {
    const formArray = this.readingPassagesFormArray();
    const targetCount = Math.max(0, Math.min(count, 50));

    while (formArray.length > targetCount) {
      formArray.removeAt(formArray.length - 1);
    }

    while (formArray.length < targetCount) {
      const rowIndex = formArray.length + 1;
      formArray.push(
        this.fb.group({
          passageId: this.fb.control(`P${rowIndex}`),
          title: this.fb.control('', [Validators.required]),
          content: this.fb.control('', [Validators.required]),
          questionCount: this.fb.control<number | null>(1, [Validators.required, Validators.min(1), Validators.max(100)])
        })
      );
    }
  }

  regenerateQuestionsBySections(standaloneQuestionCount = 0): void {
    const questionsArray = this.questionsTableFormArray();
    const passagesArray = this.readingPassagesFormArray();

    const targetPassageIds: Array<string | null> = Array.from({ length: standaloneQuestionCount }, () => null);
    for (let i = 0; i < passagesArray.length; i++) {
      const passage = passagesArray.at(i)?.getRawValue();
      const passageId = `P${i + 1}`;
      const questionCount = Math.max(0, Math.min(Number(passage?.questionCount ?? 0), 100));
      for (let j = 0; j < questionCount; j++) {
        targetPassageIds.push(passageId);
      }
    }

    const currentPassageIds = questionsArray.controls.map((control) => (control.get('passageId')?.value ?? null) as string | null);
    const isSameLayout =
      currentPassageIds.length === targetPassageIds.length
      && currentPassageIds.every((value, index) => value === targetPassageIds[index]);

    if (isSameLayout) {
      return;
    }

    questionsArray.clear();

    let questionNumber = 1;
    for (let i = 0; i < standaloneQuestionCount; i++) {
      questionsArray.push(
        this.fb.group({
          questionNumber: this.fb.control(questionNumber),
          question: this.fb.control('', [Validators.required]),
          answerA: this.fb.control('', [Validators.required]),
          answerB: this.fb.control('', [Validators.required]),
          answerC: this.fb.control('', [Validators.required]),
          answerD: this.fb.control('', [Validators.required]),
          passageId: this.fb.control<string | null>(null),
          correctAnswer: this.fb.control<OptionKey | null>(null, [Validators.required])
        })
      );
      questionNumber += 1;
    }

    for (let i = 0; i < passagesArray.length; i++) {
      const passage = passagesArray.at(i)?.getRawValue();
      const passageId = `P${i + 1}`;
      const questionCount = Math.max(0, Math.min(Number(passage?.questionCount ?? 0), 100));

      for (let j = 0; j < questionCount; j++) {
        questionsArray.push(
          this.fb.group({
            questionNumber: this.fb.control(questionNumber),
            question: this.fb.control('', [Validators.required]),
            answerA: this.fb.control('', [Validators.required]),
            answerB: this.fb.control('', [Validators.required]),
            answerC: this.fb.control('', [Validators.required]),
            answerD: this.fb.control('', [Validators.required]),
            passageId: this.fb.control<string | null>(passageId),
            correctAnswer: this.fb.control<OptionKey | null>(null, [Validators.required])
          })
        );
        questionNumber += 1;
      }
    }
  }

  private buildParseResultFromTableRows(): { questions: TestQuestion[]; passages: ReadingPassage[]; answerKey: Record<number, OptionKey>; errors: ParseError[] } {
    const testType = this.selectedTestType();
    const formArray = this.questionsTableFormArray();
    const readingPassagesArray = this.readingPassagesFormArray();
    const questions: TestQuestion[] = [];
    const passages: ReadingPassage[] = [];
    const answerKey: Record<number, OptionKey> = {};
    const errors: ParseError[] = [];
    const passageQuestionMap: Record<string, number[]> = {};

    if (testType === 'reading' || testType === 'mixed') {
      for (let i = 0; i < readingPassagesArray.length; i++) {
        const row = readingPassagesArray.at(i);
        const rowValue = row?.getRawValue() || {};
        const passageId = `P${i + 1}`;

        if (!rowValue.title || !rowValue.title.trim()) {
          errors.push({
            scope: 'question',
            line: i + 1,
            message: `Passage ${i + 1}: Title is required.`
          });
        }

        if (!rowValue.content || !rowValue.content.trim()) {
          errors.push({
            scope: 'question',
            line: i + 1,
            message: `Passage ${i + 1}: Content is required.`
          });
        }

        if (!rowValue.questionCount || Number(rowValue.questionCount) <= 0) {
          errors.push({
            scope: 'question',
            line: i + 1,
            message: `Passage ${i + 1}: Question count must be greater than 0.`
          });
        }

        passages.push({
          id: passageId,
          title: rowValue.title?.trim() ?? '',
          content: rowValue.content?.trim() ?? '',
          questionNumbers: []
        });
        passageQuestionMap[passageId] = [];
      }
    }

    for (let i = 0; i < formArray.length; i++) {
      const row = formArray.at(i);
      const rowValue = row?.getRawValue() || {};
      const questionNumber = i + 1;

      // Validate required fields
      if (!rowValue.question || !rowValue.question.trim()) {
        errors.push({
          scope: 'question',
          line: questionNumber,
          message: `Question ${questionNumber}: Question text is required.`
        });
        continue;
      }

      if (!rowValue.answerA || !rowValue.answerA.trim()) {
        errors.push({
          scope: 'answer',
          line: questionNumber,
          message: `Question ${questionNumber}: Answer A is required.`
        });
      }

      if (!rowValue.answerB || !rowValue.answerB.trim()) {
        errors.push({
          scope: 'answer',
          line: questionNumber,
          message: `Question ${questionNumber}: Answer B is required.`
        });
      }

      if (!rowValue.answerC || !rowValue.answerC.trim()) {
        errors.push({
          scope: 'answer',
          line: questionNumber,
          message: `Question ${questionNumber}: Answer C is required.`
        });
      }

      if (!rowValue.answerD || !rowValue.answerD.trim()) {
        errors.push({
          scope: 'answer',
          line: questionNumber,
          message: `Question ${questionNumber}: Answer D is required.`
        });
      }

      if (!rowValue.correctAnswer) {
        errors.push({
          scope: 'answer',
          line: questionNumber,
          message: `Question ${questionNumber}: Correct answer selection is required.`
        });
      }

      if (testType === 'reading' && !rowValue.passageId) {
        errors.push({
          scope: 'question',
          line: questionNumber,
          message: `Question ${questionNumber}: Passage selection is required.`
        });
      }

      // Only add question if no errors for this row
      if (!errors.some((e) => e.line === questionNumber)) {
        const question: TestQuestion = {
          number: questionNumber,
          prompt: rowValue.question.trim(),
          options: {
            A: rowValue.answerA.trim(),
            B: rowValue.answerB.trim(),
            C: rowValue.answerC.trim(),
            D: rowValue.answerD.trim()
          }
        };

        if ((testType === 'reading' || testType === 'mixed') && rowValue.passageId) {
          question.passageId = rowValue.passageId;
        }

        questions.push(question);

        answerKey[questionNumber] = rowValue.correctAnswer;

        if ((testType === 'reading' || testType === 'mixed') && rowValue.passageId && passageQuestionMap[rowValue.passageId]) {
          passageQuestionMap[rowValue.passageId].push(questionNumber);
        }
      }
    }

    if (testType === 'reading' || testType === 'mixed') {
      for (const passage of passages) {
        passage.questionNumbers = passageQuestionMap[passage.id] ?? [];

        if (passage.questionNumbers.length === 0) {
          errors.push({
            scope: 'question',
            line: Number.parseInt(passage.id.replace('P', ''), 10),
            message: `${passage.title || passage.id}: At least one question must be assigned.`
          });
        }
      }

      if (testType === 'mixed') {
        const hasStandaloneQuestion = questions.some((question) => !question.passageId);
        const hasReadingQuestion = questions.some((question) => !!question.passageId);

        if (!hasStandaloneQuestion) {
          errors.push({
            scope: 'question',
            line: 1,
            message: 'Bài kiểm tra kết hợp phải có ít nhất một câu hỏi MCQ độc lập.'
          });
        }

        if (!hasReadingQuestion) {
          errors.push({
            scope: 'question',
            line: 1,
            message: 'Bài kiểm tra kết hợp phải có ít nhất một câu hỏi thuộc phần đọc hiểu.'
          });
        }
      }
    }

    return {
      questions,
      passages,
      answerKey,
      errors
    };
  }
}

