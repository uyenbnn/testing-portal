import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';

import { TeacherTestBuilder } from './teacher-test-builder';

describe('TeacherTestBuilder', () => {
  let component: TeacherTestBuilder;
  let fixture: ComponentFixture<TeacherTestBuilder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherTestBuilder],
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherTestBuilder);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('form', new FormGroup({
      title: new FormControl(''),
      testType: new FormControl('standard'),
      durationMinutes: new FormControl(30),
      questionText: new FormControl(''),
      answerText: new FormControl('')
    }));
    fixture.componentRef.setInput('testTypes', [
      { value: 'standard', label: 'Standard MCQ' },
      { value: 'reading', label: 'Reading' }
    ]);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
