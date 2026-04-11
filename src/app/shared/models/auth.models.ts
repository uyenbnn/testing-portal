export type TeacherApprovalStatus = 'pending' | 'approved' | 'rejected';
export type TeacherGender = 'female' | 'male' | 'other' | 'prefer_not_to_say';

export interface TeacherProfile {
  uid: string;
  firstName: string;
  lastName: string;
  gender: TeacherGender;
  phoneNumber: string;
  email: string;
  username: string;
  normalizedUsername: string;
  status: TeacherApprovalStatus;
  createdAtIso: string;
  approvedAtIso?: string;
  rejectedAtIso?: string;
}

export interface TeacherSignupInput {
  firstName: string;
  lastName: string;
  gender: TeacherGender;
  phoneNumber: string;
  email: string;
  username: string;
  password: string;
}

export interface TeacherUsernameLookup {
  uid: string;
  email: string;
  username: string;
}

export interface AdminTeacherReviewItem {
  uid: string;
  firstName: string;
  lastName: string;
  gender: TeacherGender;
  phoneNumber: string;
  email: string;
  username: string;
  status: TeacherApprovalStatus;
  createdAtIso: string;
}

export interface TeacherAccountReviewResponse {
  accounts: AdminTeacherReviewItem[];
}

export interface TeacherModerationRequest {
  uid: string;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
