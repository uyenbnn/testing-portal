import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminReviewService } from '../../core/services/admin-review.service';
import { AdminSessionService } from '../../core/services/admin-session.service';
import { AdminTeacherReviewItem } from '../../shared/models/auth.models';

@Component({
	selector: 'app-admin-page',
	imports: [ReactiveFormsModule, RouterLink],
	templateUrl: './admin-page.component.html',
	styleUrl: './admin-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPageComponent {
	private readonly fb = inject(NonNullableFormBuilder);
	private readonly session = inject(AdminSessionService);
	private readonly reviewService = inject(AdminReviewService);

	readonly loginForm = this.fb.group({
		username: this.fb.control('', [Validators.required]),
		password: this.fb.control('', [Validators.required])
	});
	readonly isLoggedIn = this.session.isLoggedIn;
	readonly isSubmitting = signal(false);
	readonly isLoadingAccounts = signal(false);
	readonly loginError = signal('');
	readonly dashboardError = signal('');
	readonly pendingAccounts = signal<AdminTeacherReviewItem[]>([]);
	readonly actionStates = signal<Record<string, 'approve' | 'reject'>>({});
	readonly pendingCount = computed(() => this.pendingAccounts().length);

	constructor() {
		if (this.isLoggedIn()) {
			void this.loadTeacherAccounts();
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
		await this.loadTeacherAccounts();
	}

	logout(): void {
		this.session.logout();
		this.pendingAccounts.set([]);
		this.dashboardError.set('');
		this.actionStates.set({});
	}

	async refreshAccounts(): Promise<void> {
		await this.loadTeacherAccounts();
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
			this.dashboardError.set('Failed to load teacher accounts. Make sure the Firebase functions are deployed.');
		} finally {
			this.isLoadingAccounts.set(false);
		}
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