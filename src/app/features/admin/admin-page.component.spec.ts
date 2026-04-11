import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AdminReviewService } from '../../core/services/admin-review.service';
import { AdminSessionService } from '../../core/services/admin-session.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { PublishedTest } from '../../shared/models/test.models';
import { AdminPageComponent } from './admin-page.component';

describe('AdminPageComponent', () => {
	const publishedTests: PublishedTest[] = [
		{
			code: '123456',
			title: 'Midterm Review',
			testType: 'standard',
			durationMinutes: 45,
			questions: [
				{
					number: 1,
					prompt: 'Capital of France?',
					options: { A: 'Rome', B: 'Paris', C: 'Madrid', D: 'Berlin' }
				}
			],
			answerKey: { 1: 'B' },
			createdAtIso: '2026-04-10T09:15:00.000Z',
			creator: {
				uid: 'teacher-1',
				username: 'demo.teacher',
				displayName: 'Demo Teacher'
			}
		},
		{
			code: '654321',
			title: 'Reading Drill',
			testType: 'reading',
			durationMinutes: 30,
			questions: [
				{
					number: 1,
					prompt: 'What is the best title?',
					passageId: 'A',
					options: { A: 'Birds', B: 'Trees', C: 'Rivers', D: 'Clouds' }
				}
			],
			passages: [
				{
					id: 'A',
					title: 'Forest Notes',
					content: 'A short reading passage.',
					questionNumbers: [1]
				}
			],
			answerKey: { 1: 'A' },
			createdAtIso: '2026-04-11T08:00:00.000Z',
			creator: {
				uid: 'teacher-2',
				username: 'reading.coach',
				displayName: 'Another Instructor'
			}
		}
	];

	async function createComponent(isLoggedIn: boolean, tests: PublishedTest[] = []) {
		TestBed.resetTestingModule();

		await TestBed.configureTestingModule({
			imports: [AdminPageComponent],
			providers: [
				provideRouter([]),
				{
					provide: AdminSessionService,
					useValue: {
						isLoggedIn: signal(isLoggedIn),
						login: vi.fn().mockReturnValue(true),
						logout: vi.fn()
					}
				},
				{
					provide: AdminReviewService,
					useValue: {
						listTeacherAccounts: vi.fn().mockResolvedValue({ accounts: [] }),
						approveTeacherAccount: vi.fn().mockResolvedValue(undefined),
						rejectTeacherAccount: vi.fn().mockResolvedValue(undefined)
					}
				},
				{
					provide: TestRepositoryService,
					useValue: {
						listPublishedTests: vi.fn().mockResolvedValue(tests),
						deleteTest: vi.fn().mockResolvedValue(undefined)
					}
				}
			]
		}).compileComponents();

		const fixture = TestBed.createComponent(AdminPageComponent);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		return fixture;
	}

	it('creates the component', async () => {
		const fixture = await createComponent(false);

		expect(fixture.componentInstance).toBeTruthy();
	});

	it('shows the login card without the admin tabs when logged out', async () => {
		const fixture = await createComponent(false);
		const compiled = fixture.nativeElement as HTMLElement;

		expect(compiled.textContent).toContain('Static admin access');
		expect(compiled.querySelector('[role="tablist"]')).toBeNull();
	});

	it('shows approvals as the default tab when logged in', async () => {
		const fixture = await createComponent(true);
		const compiled = fixture.nativeElement as HTMLElement;

		expect(compiled.querySelector('[role="tablist"]')).not.toBeNull();
		expect(compiled.querySelector('#approvals-panel')).not.toBeNull();
		expect(compiled.querySelector('#tests-panel')).toBeNull();
		expect(compiled.textContent).toContain('Teacher Approval Queue');
	});

	it('switches to the tests tab', async () => {
		const fixture = await createComponent(true);
		const compiled = fixture.nativeElement as HTMLElement;
		const testsTab = compiled.querySelector('#tests-tab') as HTMLButtonElement;

		testsTab.click();
		fixture.detectChanges();

		expect(compiled.querySelector('#approvals-panel')).toBeNull();
		expect(compiled.querySelector('#tests-panel')).not.toBeNull();
		expect(compiled.textContent).toContain('Published Test Oversight');
	});

	it('filters admin published tests by creator from the shared search field', async () => {
		const fixture = await createComponent(true, publishedTests);
		const compiled = fixture.nativeElement as HTMLElement;
		const testsTab = compiled.querySelector('#tests-tab') as HTMLButtonElement;

		testsTab.click();
		fixture.detectChanges();

		const searchInput = compiled.querySelector('input[type="search"]') as HTMLInputElement;
		searchInput.value = 'another instructor';
		searchInput.dispatchEvent(new Event('input'));
		fixture.detectChanges();

		expect(compiled.textContent).toContain('Reading Drill');
		expect(compiled.textContent).not.toContain('Midterm Review');
	});
});