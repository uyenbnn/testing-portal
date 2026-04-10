import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./features/welcome/welcome-page.component').then((m) => m.WelcomePageComponent)
	},
	{
		path: 'teacher',
		loadComponent: () =>
			import('./features/teacher/teacher-page.component').then((m) => m.TeacherPageComponent)
	},
	{
		path: 'student',
		loadComponent: () =>
			import('./features/student/student-page.component').then((m) => m.StudentPageComponent)
	},
	{
		path: '**',
		redirectTo: ''
	}
];
