import { Injectable } from '@angular/core';
import { get, ref, remove, update } from 'firebase/database';
import {
  AdminTeacherReviewItem,
  TeacherAccountReviewResponse,
  TeacherGender,
  TeacherModerationRequest
} from '../../shared/models/auth.models';
import { getPortalDatabase } from './firebase-client';

@Injectable({ providedIn: 'root' })
export class AdminReviewService {
  private readonly database = getPortalDatabase();

  async listTeacherAccounts(): Promise<TeacherAccountReviewResponse> {
    const snapshot = await get(ref(this.database, 'teachers'));

    if (!snapshot.exists()) {
      return { accounts: [] };
    }

    const accounts = Object.values(snapshot.val() as Record<string, unknown>)
      .flatMap((candidate) => {
        const teacher = this.toReviewItem(candidate);
        return teacher ? [teacher] : [];
      })
      .filter((account) => account.status === 'pending')
      .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));

    return { accounts };
  }

  async approveTeacherAccount(request: TeacherModerationRequest): Promise<void> {
    await update(ref(this.database, `teachers/${request.uid}`), {
      status: 'approved',
      approvedAtIso: new Date().toISOString(),
      rejectedAtIso: null
    });
  }

  async rejectTeacherAccount(request: TeacherModerationRequest): Promise<void> {
    const teacherRef = ref(this.database, `teachers/${request.uid}`);
    const snapshot = await get(teacherRef);

    if (!snapshot.exists()) {
      throw new Error('Teacher account not found.');
    }

    const teacher = snapshot.val() as { normalizedUsername?: unknown };
    const normalizedUsername = typeof teacher.normalizedUsername === 'string' ? teacher.normalizedUsername : null;

    await Promise.all([
      remove(teacherRef),
      normalizedUsername ? remove(ref(this.database, `teacherUsernames/${normalizedUsername}`)) : Promise.resolve()
    ]);
  }

  private toReviewItem(value: unknown): AdminTeacherReviewItem | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const teacher = value as Record<string, unknown>;
    const uid = teacher['uid'];
    const firstName = teacher['firstName'];
    const lastName = teacher['lastName'];
    const gender = teacher['gender'];
    const phoneNumber = teacher['phoneNumber'];
    const email = teacher['email'];
    const username = teacher['username'];
    const status = teacher['status'];
    const createdAtIso = teacher['createdAtIso'];

    if (
      typeof uid !== 'string' ||
      typeof firstName !== 'string' ||
      typeof lastName !== 'string' ||
      !this.isTeacherGender(gender) ||
      typeof phoneNumber !== 'string' ||
      typeof email !== 'string' ||
      typeof username !== 'string' ||
      (status !== 'pending' && status !== 'approved' && status !== 'rejected') ||
      typeof createdAtIso !== 'string'
    ) {
      return null;
    }

    return {
      uid,
      firstName,
      lastName,
      gender,
      phoneNumber,
      email,
      username,
      status,
      createdAtIso
    };
  }

  private isTeacherGender(value: unknown): value is TeacherGender {
    return value === 'female' || value === 'male' || value === 'other' || value === 'prefer_not_to_say';
  }
}
