import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminReviewService } from '../../core/services/admin-review.service';
import { AdminSessionService } from '../../core/services/admin-session.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { AdminTeacherReviewItem } from '../../shared/models/auth.models';
import { PublishedTest, ReadingPassage, TestQuestion, TestType } from '../../shared/models/test.models';
import { TeacherTestLibrary } from '../teacher/components/teacher-test-library/teacher-test-library';
import { CreatedTestItem, PassageQuestionGroup } from '../teacher/teacher-page.models';

@Component({
	selector: 'app-admin-page',
	imports: [ReactiveFormsModule, RouterLink, TeacherTestLibrary],
	templateUrl: './admin-page.component.html',
	styleUrl: './admin-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPageComponent {
	private readonly fb = inject(NonNullableFormBuilder);
	private readonly session = inject(AdminSessionService);
	private readonly reviewService = inject(AdminReviewService);
	private readonly repository = inject(TestRepositoryService);

	readonly loginForm = this.fb.group({
		username: this.fb.control('', [Validators.required]),
		password: this.fb.control('', [Validators.required])
	});
	readonly isLoggedIn = this.session.isLoggedIn;
	readonly isSubmitting = signal(false);
	readonly isLoadingAccounts = signal(false);
	readonly isLoadingTests = signal(false);
	readonly loginError = signal('');
	readonly dashboardError = signal('');
	readonly testsError = signal('');
	readonly pendingAccounts = signal<AdminTeacherReviewItem[]>([]);
	readonly publishedTests = signal<PublishedTest[]>([]);
	readonly deletingCodes = signal<Record<string, boolean>>({});
	readonly selectedTest = signal<CreatedTestItem | null>(null);
	readonly pendingDeleteTest = signal<PublishedTest | null>(null);
	readonly actionStates = signal<Record<string, 'approve' | 'reject'>>({});
	readonly pendingCount = computed(() => this.pendingAccounts().length);
	readonly totalTestCount = computed(() => this.publishedTests().length);
	readonly createdTestItems = computed<CreatedTestItem[]>(() =>
		this.publishedTests().map((test) => ({
			...test,
			questionCount: test.questions.length,
			passageCount: test.passages?.length ?? 0,
			createdAtLabel: this.formatCreatedAt(test.createdAtIso),
			testTypeLabel: this.formatTestType(test.testType),
			creatorNameLabel: this.formatCreatorName(test),
			creatorUsernameLabel: this.formatCreatorUsername(test)
		}))
	);
	readonly selectedTestPassageGroups = computed<PassageQuestionGroup[]>(() => {
		const test = this.selectedTest();
		return test ? this.toPassageGroups(test) : [];
	});

	constructor() {
		if (this.isLoggedIn()) {
			void this.loadDashboard();
		}
	}

	async login(): Promise<void> {
		this.loginError.set('');
		this.loginForm.markAllAsTouched();

		if (this.loginForm.invalid) {
			this.loginError.set('Enter the admin username and password.');
			return;
		}

		const isValid = this.session.login(
			this.loginForm.controls.username.value,
			this.loginForm.controls.password.value
		);

		if (!isValid) {
			this.loginError.set('Incorrect admin credentials.');
			return;
		}

		this.loginForm.reset({ username: '', password: '' });
		await this.loadDashboard();
	}

	logout(): void {
		this.session.logout();
		this.pendingAccounts.set([]);
		this.publishedTests.set([]);
		this.dashboardError.set('');
		this.testsError.set('');
		this.actionStates.set({});
		this.deletingCodes.set({});
		this.selectedTest.set(null);
		this.pendingDeleteTest.set(null);
	}

	async refreshAccounts(): Promise<void> {
		await this.loadDashboard();
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

	async deletePublishedTest(test: PublishedTest): Promise<void> {
		this.testsError.set('');
		this.setDeletingState(test.code, true);

		try {
			await this.repository.deleteTest(test.code);
			this.publishedTests.update((tests) => tests.filter((current) => current.code !== test.code));
			this.pendingDeleteTest.set(null);

			if (this.selectedTest()?.code === test.code) {
				this.selectedTest.set(null);
			}
		} catch {
			this.testsError.set('Failed to delete the selected test. Please try again.');
		} finally {
			this.setDeletingState(test.code, false);
		}
	}

	async approveTeacher(uid: string): Promise<void> {
		this.dashboardError.set('');
		this.setActionState(uid, 'approve');

		try {
			await this.reviewService.approveTeacherAccount({ uid });
			this.pendingAccounts.update((accounts) => accounts.filter((account) => account.uid !== uid));
		} catch {
			this.dashboardError.set('Failed to approve the teacher account. Please try again.');
		} finally {
			this.clearActionState(uid);
		}
	}

	async rejectTeacher(uid: string): Promise<void> {
		this.dashboardError.set('');
		this.setActionState(uid, 'reject');

		try {
			await this.reviewService.rejectTeacherAccount({ uid });
			this.pendingAccounts.update((accounts) => accounts.filter((account) => account.uid !== uid));
		} catch {
			this.dashboardError.set('Failed to reject the teacher account. Please try again.');
		} finally {
			this.clearActionState(uid);
		}
	}

	isProcessing(uid: string, action: 'approve' | 'reject'): boolean {
		return this.actionStates()[uid] === action;
	}

	formatCreatedAt(createdAtIso: string): string {
		const createdAt = new Date(createdAtIso);
		if (Number.isNaN(createdAt.getTime())) {
			return 'Unknown date';
		}

		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(createdAt);
	}

	private async loadTeacherAccounts(): Promise<void> {
		this.isLoadingAccounts.set(true);
		this.dashboardError.set('');

		try {
			const response = await this.reviewService.listTeacherAccounts();
			this.pendingAccounts.set(
				[...response.accounts].sort((left, right) => left.createdAtIso.localeCompare(right.createdAtIso))
			);
		} catch {
			this.dashboardError.set('Failed to load teacher accounts. Check your Firebase database rules and network access.');
		} finally {
			this.isLoadingAccounts.set(false);
		}
	}

	private async loadDashboard(): Promise<void> {
		await Promise.all([this.loadTeacherAccounts(), this.loadPublishedTests()]);
	}

	private async loadPublishedTests(): Promise<void> {
		this.isLoadingTests.set(true);
		this.testsError.set('');

		try {
			const tests = await this.repository.listPublishedTests();
			this.publishedTests.set(this.sortTests(tests));
		} catch {
			this.testsError.set('Failed to load published tests. Please check your Firebase access and try again.');
		} finally {
			this.isLoadingTests.set(false);
		}
	}

	private setDeletingState(code: string, isDeleting: boolean): void {
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

	private formatTestType(testType: TestType): string {
		return testType === 'reading' ? 'Reading' : 'Standard MCQ';
	}

	private formatCreatorName(test: PublishedTest): string {
		return test.creator?.displayName || 'Unknown creator';
	}

	private formatCreatorUsername(test: PublishedTest): string {
		return test.creator?.username ? `@${test.creator.username}` : 'Unknown username';
	}

	private toPassageGroups(test: PublishedTest): PassageQuestionGroup[] {
		if (test.testType !== 'reading' || !test.passages?.length) {
			return [];
		}

		return test.passages.map((passage: ReadingPassage) => ({
			passage,
			questions: test.questions.filter((question: TestQuestion) => question.passageId === passage.id)
		}));
	}

	private setActionState(uid: string, action: 'approve' | 'reject'): void {
		this.actionStates.update((current) => ({
			...current,
			[uid]: action
		}));
	}

	private clearActionState(uid: string): void {
		this.actionStates.update((current) => {
			const next = { ...current };
			delete next[uid];
			return next;
		});
	}
}