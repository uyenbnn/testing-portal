import { Injectable, signal } from '@angular/core';

const ADMIN_SESSION_STORAGE_KEY = 'testing-portal.admin-session';

export const ADMIN_USERNAME = 'portal@admin';
export const ADMIN_PASSWORD = 'uyen@@Bnn#6768';

@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  readonly isLoggedIn = signal(this.readStoredSession());

  login(username: string, password: string): boolean {
    const isValid = username.trim() === ADMIN_USERNAME && password === ADMIN_PASSWORD;

    if (!isValid) {
      return false;
    }

    this.isLoggedIn.set(true);
    this.writeStoredSession(true);
    return true;
  }

  logout(): void {
    this.isLoggedIn.set(false);
    this.writeStoredSession(false);
  }

  private readStoredSession(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === 'true';
  }

  private writeStoredSession(isLoggedIn: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    if (!isLoggedIn) {
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
      return;
    }

    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'true');
  }
}
