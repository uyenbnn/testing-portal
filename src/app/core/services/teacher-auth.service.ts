import { Injectable, computed, inject, signal } from '@angular/core';
import { createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { normalizeEmail, TeacherProfile, TeacherSignupInput } from '../../shared/models/auth.models';
import { getPortalAuth } from './firebase-client';
import { TeacherAccountService } from './teacher-account.service';

@Injectable({ providedIn: 'root' })
export class TeacherAuthService {
  private readonly teacherAccounts = inject(TeacherAccountService);
  private readonly auth = getPortalAuth();
  private readonly authUser = signal<User | null>(this.auth.currentUser);
  private readonly profileState = signal<TeacherProfile | null>(null);
  private readonly isReadyState = signal(false);
  private readonly isProfileLoadingState = signal(false);

  readonly currentUser = this.authUser.asReadonly();
  readonly currentProfile = this.profileState.asReadonly();
  readonly isReady = this.isReadyState.asReadonly();
  readonly isProfileLoading = this.isProfileLoadingState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isApproved = computed(() => this.currentProfile()?.status === 'approved');
  readonly approvalStatus = computed(() => this.currentProfile()?.status ?? null);
  readonly displayName = computed(() => {
    const profile = this.currentProfile();
    return profile ? `${profile.firstName} ${profile.lastName}` : '';
  });

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.authUser.set(user);

      if (!user) {
        this.profileState.set(null);
        this.isProfileLoadingState.set(false);
        this.isReadyState.set(true);
        return;
      }

      void this.loadTeacherProfile(user.uid);
    });
  }

  async signUp(signup: TeacherSignupInput): Promise<void> {
    const credentials = await createUserWithEmailAndPassword(
      this.auth,
      normalizeEmail(signup.email),
      signup.password
    );

    try {
      await this.teacherAccounts.createPendingTeacherProfile(credentials.user.uid, signup);
      await this.loadTeacherProfile(credentials.user.uid);
    } catch (error) {
      await deleteUser(credentials.user);
      throw error;
    }
  }

  async login(username: string, password: string): Promise<void> {
    const lookup = await this.teacherAccounts.findUsernameLookup(username);
    if (!lookup) {
      throw new Error('INVALID_CREDENTIALS');
    }

    await signInWithEmailAndPassword(this.auth, lookup.email, password);
    const profile = await this.loadTeacherProfile(lookup.uid);

    if (!profile) {
      await signOut(this.auth);
      throw new Error('ACCOUNT_NOT_FOUND');
    }

    if (profile.status === 'rejected') {
      await signOut(this.auth);
      throw new Error('ACCOUNT_REJECTED');
    }
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async refreshProfile(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      this.profileState.set(null);
      return;
    }

    await this.loadTeacherProfile(user.uid);
  }

  private async loadTeacherProfile(uid: string): Promise<TeacherProfile | null> {
    this.isProfileLoadingState.set(true);

    try {
      const profile = await this.teacherAccounts.getTeacherProfile(uid);
      this.profileState.set(profile);
      return profile;
    } finally {
      this.isReadyState.set(true);
      this.isProfileLoadingState.set(false);
    }
  }
}
