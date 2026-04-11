import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { ADMIN_PASSWORD, ADMIN_USERNAME } from './admin-session.service';
import { getPortalFunctions } from './firebase-client';
import { TeacherAccountReviewResponse, TeacherModerationRequest } from '../../shared/models/auth.models';

interface AdminCallableEnvelope {
  username: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AdminReviewService {
  private readonly functions = getPortalFunctions();

  async listTeacherAccounts(): Promise<TeacherAccountReviewResponse> {
    return this.callAdminFunction<Record<string, never>, TeacherAccountReviewResponse>('listTeacherAccounts', {});
  }

  async approveTeacherAccount(request: TeacherModerationRequest): Promise<void> {
    await this.callAdminFunction<TeacherModerationRequest, { success: boolean }>('approveTeacherAccount', request);
  }

  async rejectTeacherAccount(request: TeacherModerationRequest): Promise<void> {
    await this.callAdminFunction<TeacherModerationRequest, { success: boolean }>('rejectTeacherAccount', request);
  }

  private async callAdminFunction<TRequest extends object, TResponse>(name: string, payload: TRequest): Promise<TResponse> {
    const callable = httpsCallable<TRequest & AdminCallableEnvelope, TResponse>(this.functions, name);
    const result = await callable({
      ...payload,
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    });

    return result.data;
  }
}
