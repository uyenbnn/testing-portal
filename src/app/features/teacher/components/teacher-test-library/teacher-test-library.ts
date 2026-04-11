import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PublishedTest } from '../../../../shared/models/test.models';
import { CreatedTestItem, PassageQuestionGroup } from '../../teacher-page.models';

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
  readonly pendingDeleteTest = input<PublishedTest | null>(null);

  readonly openTestDetails = output<CreatedTestItem>();
  readonly closeSelectedTest = output<void>();
  readonly requestDeleteTest = output<PublishedTest>();
  readonly cancelDeleteRequest = output<void>();
  readonly deleteTest = output<PublishedTest>();

  isDeleting(code: string): boolean {
    return this.deletingCodes()[code] ?? false;
  }
}
