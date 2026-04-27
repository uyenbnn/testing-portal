import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormArray } from '@angular/forms';
import { ParseError, TestType, OptionKey } from '../../../../shared/models/test.models';
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
  readonly isTableMode = input(false);
  readonly numQuestionsValue = input(0);
  readonly numPassagesValue = input(0);
  readonly readingPassageOptions = input<readonly { value: string; label: string }[]>([]);

  readonly MCQ_ANSWER_OPTIONS: OptionKey[] = ['A', 'B', 'C', 'D'];

  getMcqTableControls() {
    const formArray = this.form().get('questionsTable') as FormArray;
    return (formArray?.controls || []) as any[];
  }

  getReadingPassageControls() {
    const formArray = this.form().get('readingPassages') as FormArray;
    return (formArray?.controls || []) as any[];
  }

  getQuestionsByPassage(passageId: string | null | undefined) {
    if (!passageId) {
      return [] as any[];
    }

    return this.getMcqTableControls().filter((control) => control.get('passageId')?.value === passageId);
  }

  getStandaloneQuestionControls() {
    return this.getMcqTableControls().filter((control) => !control.get('passageId')?.value);
  }

  getPassageLabel(passageId: string | null | undefined): string {
    if (!passageId) {
      return '';
    }

    const option = this.readingPassageOptions().find((item) => item.value === passageId);
    return option?.label ?? passageId;
  }

  readonly useQuestionTemplate = output<void>();
  readonly useAnswerTemplate = output<void>();
  readonly publishTest = output<void>();
}
