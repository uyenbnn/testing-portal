import { Injectable } from '@angular/core';
import { DataSnapshot, get, ref, remove, runTransaction, set } from 'firebase/database';
import { normalizeEmail, normalizeUsername, TeacherProfile, TeacherSignupInput, TeacherUsernameLookup } from '../../shared/models/auth.models';
import { getPortalDatabase } from './firebase-client';

@Injectable({ providedIn: 'root' })
export class TeacherAccountService {
  private readonly database = getPortalDatabase();

  async createPendingTeacherProfile(uid: string, signup: TeacherSignupInput): Promise<TeacherProfile> {
    const normalizedUsername = normalizeUsername(signup.username);
    const email = normalizeEmail(signup.email);
    const username = signup.username.trim();
    const createdAtIso = new Date().toISOString();

    const lookupRef = ref(this.database, `teacherUsernames/${normalizedUsername}`);
    const lookupResult = await runTransaction(
      lookupRef,
      (currentValue) => currentValue ?? { uid, email, username },
      { applyLocally: false }
    );

    if (!lookupResult.committed) {
      throw new Error('USERNAME_TAKEN');
    }

    const profile: TeacherProfile = {
      uid,
      firstName: signup.firstName.trim(),
      lastName: signup.lastName.trim(),
      gender: signup.gender,
      phoneNumber: signup.phoneNumber.trim(),
      email,
      username,
      normalizedUsername,
      status: 'pending',
      createdAtIso
    };

    try {
      await set(ref(this.database, `teachers/${uid}`), profile);
      return profile;
    } catch (error) {
      await remove(lookupRef);
      throw error;
    }
  }

  async getTeacherProfile(uid: string): Promise<TeacherProfile | null> {
    const snapshot = await get(ref(this.database, `teachers/${uid}`));
    return this.toTeacherProfile(snapshot);
  }

  async findUsernameLookup(username: string): Promise<TeacherUsernameLookup | null> {
    const normalizedUsername = normalizeUsername(username);
    const snapshot = await get(ref(this.database, `teacherUsernames/${normalizedUsername}`));

    if (!snapshot.exists()) {
      return null;
    }

    const candidate = snapshot.val() as Partial<TeacherUsernameLookup> | null;
    if (!candidate || typeof candidate.uid !== 'string' || typeof candidate.email !== 'string' || typeof candidate.username !== 'string') {
      return null;
    }

    return {
      uid: candidate.uid,
      email: candidate.email,
      username: candidate.username
    };
  }

  private toTeacherProfile(snapshot: DataSnapshot): TeacherProfile | null {
    if (!snapshot.exists()) {
      return null;
    }

    const candidate = snapshot.val() as Partial<TeacherProfile> | null;
    if (
      !candidate ||
      typeof candidate.uid !== 'string' ||
      typeof candidate.firstName !== 'string' ||
      typeof candidate.lastName !== 'string' ||
      typeof candidate.gender !== 'string' ||
      typeof candidate.phoneNumber !== 'string' ||
      typeof candidate.email !== 'string' ||
      typeof candidate.username !== 'string' ||
      typeof candidate.normalizedUsername !== 'string' ||
      typeof candidate.status !== 'string' ||
      typeof candidate.createdAtIso !== 'string'
    ) {
      return null;
    }

    if (
      candidate.status !== 'pending' &&
      candidate.status !== 'approved' &&
      candidate.status !== 'rejected'
    ) {
      return null;
    }

    if (
      candidate.gender !== 'female' &&
      candidate.gender !== 'male' &&
      candidate.gender !== 'other' &&
      candidate.gender !== 'prefer_not_to_say'
    ) {
      return null;
    }

    return {
      uid: candidate.uid,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      gender: candidate.gender,
      phoneNumber: candidate.phoneNumber,
      email: candidate.email,
      username: candidate.username,
      normalizedUsername: candidate.normalizedUsername,
      status: candidate.status,
      createdAtIso: candidate.createdAtIso,
      approvedAtIso: typeof candidate.approvedAtIso === 'string' ? candidate.approvedAtIso : undefined,
      rejectedAtIso: typeof candidate.rejectedAtIso === 'string' ? candidate.rejectedAtIso : undefined
    };
  }
}
