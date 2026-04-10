import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TestCodeService {
  private readonly maxAttempts = 20;

  async generateUniqueCode(isTaken: (code: string) => Promise<boolean>): Promise<string> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      if (!(await isTaken(code))) {
        return code;
      }
    }

    throw new Error('Unable to generate a unique 6-digit test code. Please try again.');
  }
}
