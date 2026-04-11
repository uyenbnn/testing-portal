import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AdminReviewService } from '../../core/services/admin-review.service';
import { AdminSessionService } from '../../core/services/admin-session.service';
import { TestRepositoryService } from '../../core/services/test-repository.service';
import { AdminPageComponent } from './admin-page.component';

describe('AdminPageComponent', () => {
	it('creates the component', async () => {
		await TestBed.configureTestingModule({
			imports: [AdminPageComponent],
			providers: [
				provideRouter([]),
				{
					provide: AdminSessionService,
					useValue: {
						isLoggedIn: signal(false),
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
						listPublishedTests: vi.fn().mockResolvedValue([]),
						deleteTest: vi.fn().mockResolvedValue(undefined)
					}
				}
			]
		}).compileComponents();

		const fixture = TestBed.createComponent(AdminPageComponent);
		fixture.detectChanges();

		expect(fixture.componentInstance).toBeTruthy();
	});
});