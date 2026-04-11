import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeacherTestLibrary } from './teacher-test-library';

describe('TeacherTestLibrary', () => {
  let component: TeacherTestLibrary;
  let fixture: ComponentFixture<TeacherTestLibrary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeacherTestLibrary],
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherTestLibrary);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('createdTestItems', []);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
