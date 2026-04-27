import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { PublishedTest, StudentTestResultRecord, TestQuestion, TestType } from '../../../../shared/models/test.models';
import { CreatedTestItem, PassageQuestionGroup } from '../../teacher-page.models';

type LibraryFilterTestType = 'all' | TestType;
type DetailTab = 'details' | 'results';

@Component({
  selector: 'app-teacher-test-library',
  imports: [],
  templateUrl: './teacher-test-library.html',
  styleUrl: './teacher-test-library.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherTestLibrary {
  readonly sectionTitle = input('Các bài kiểm tra đã tạo'); // "Created tests"
  readonly sectionHint = input('Tất cả các bài kiểm tra đã xuất bản được liệt kê ở đây và có thể bị xóa khỏi cổng thông tin.');
  readonly emptyText = input('Chưa có bài kiểm tra nào được xuất bản.');
  readonly showCreator = input(false);
  readonly isLoadingTests = input(true);
  readonly listError = input('');
  readonly createdTestItems = input.required<readonly CreatedTestItem[]>();
  readonly deletingCodes = input<Record<string, boolean>>({});
  readonly selectedTest = input<CreatedTestItem | null>(null);
  readonly selectedTestPassageGroups = input<readonly PassageQuestionGroup[]>([]);
  readonly selectedTestResults = input<readonly StudentTestResultRecord[]>([]);
  readonly isLoadingSelectedTestResults = input(false);
  readonly selectedTestResultsError = input('');
  readonly pendingDeleteTest = input<PublishedTest | null>(null);
  readonly searchQuery = signal('');
  readonly testTypeFilter = signal<LibraryFilterTestType>('all');
  readonly activeDetailTab = signal<DetailTab>('details');
  readonly detailTabs: { id: DetailTab; label: string }[] = [
    { id: 'details', label: 'Nội dung bài kiểm tra' },
    { id: 'results', label: 'Kết quả học sinh' }
  ];

  readonly normalizedSearchQuery = computed(() => this.searchQuery().trim().toLocaleLowerCase());
  readonly hasActiveFilters = computed(() => this.normalizedSearchQuery().length > 0 || this.testTypeFilter() !== 'all');
  readonly searchPlaceholder = computed(() =>
    this.showCreator()
      ? 'Tìm theo tiêu đề, mã bài hoặc người tạo'
      : 'Tìm theo tiêu đề hoặc mã bài'
  );
  readonly filteredTestItems = computed(() => {
    const query = this.normalizedSearchQuery();
    const testType = this.testTypeFilter();

    return this.createdTestItems().filter((test) => {
      if (testType !== 'all' && test.testType !== testType) {
        return false;
      }

      if (!query) {
        return true;
      }

      return this.matchesSearch(test, query);
    });
  });
  readonly filteredEmptyText = computed(() =>
    this.hasActiveFilters()
      ? 'Không có bài kiểm tra nào khớp với bộ lọc hiện tại.'
      : this.emptyText()
  );
  readonly resultsSummary = computed(() => {
    const visibleCount = this.filteredTestItems().length;
    const totalCount = this.createdTestItems().length;

    if (totalCount === 0) {
      return '0 bài kiểm tra';
    }

    if (!this.hasActiveFilters()) {
      return `${totalCount} bài kiểm tra`;
    }

    return `${visibleCount}/${totalCount} bài kiểm tra phù hợp`;
  });

  readonly openTestDetails = output<CreatedTestItem>();
  readonly closeSelectedTest = output<void>();
  readonly requestDeleteTest = output<PublishedTest>();
  readonly cancelDeleteRequest = output<void>();
  readonly deleteTest = output<PublishedTest>();

  constructor() {
    effect(() => {
      const testCode = this.selectedTest()?.code ?? '';
      if (testCode) {
        this.activeDetailTab.set('details');
      }
    });
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  setTestTypeFilter(value: string): void {
    this.testTypeFilter.set(value === 'standard' || value === 'reading' || value === 'mixed' ? value : 'all');
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.testTypeFilter.set('all');
  }

  isDeleting(code: string): boolean {
    return this.deletingCodes()[code] ?? false;
  }

  setActiveDetailTab(tab: DetailTab): void {
    this.activeDetailTab.set(tab);
  }

  formatSubmittedAt(submittedAtIso: string): string {
    const date = new Date(submittedAtIso);
    if (Number.isNaN(date.getTime())) {
      return submittedAtIso;
    }

    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  hasPassages(test: CreatedTestItem): boolean {
    return (test.passages?.length ?? 0) > 0;
  }

  getStandaloneQuestions(test: CreatedTestItem): TestQuestion[] {
    return test.questions.filter((question) => !question.passageId);
  }

  private matchesSearch(test: CreatedTestItem, query: string): boolean {
    const searchFields = [test.title, test.code];

    if (this.showCreator()) {
      searchFields.push(test.creatorNameLabel, test.creatorUsernameLabel);
    }

    return searchFields.some((field) => field.toLocaleLowerCase().includes(query));
  }
}
