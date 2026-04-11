import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ParseError, TestType } from '../../../../shared/models/test.models';
import { TeacherTestTypeOption } from '../../teacher-page.models';

@Component({
  selector: 'app-teacher-test-builder',
  imports: [ReactiveFormsModule],
  templateUrl: './teacher-test-builder.html',
  styleUrl: './teacher-test-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherTestBuilder {
  readonly form = input.required<FormGroup>();
  readonly testTypes = input.required<readonly TeacherTestTypeOption[]>();
  readonly selectedTestType = input<TestType>('standard');
  readonly questionErrors = input<readonly ParseError[]>([]);
  readonly answerErrors = input<readonly ParseError[]>([]);
  readonly previewQuestionCount = input(0);
  readonly previewPassageCount = input(0);
  readonly previewAnswerCount = input(0);
  readonly isPublishing = input(false);
  readonly publishedCode = input('');
  readonly errors = input<readonly ParseError[]>([]);

  readonly useQuestionTemplate = output<void>();
  readonly useAnswerTemplate = output<void>();
  readonly publishTest = output<void>();
}
