const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { setGlobalOptions } = require('firebase-functions/v2');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

const ADMIN_USERNAME = 'portal@admin';
const ADMIN_PASSWORD = 'uyen@@Bnn#6768';

initializeApp();
setGlobalOptions({ region: 'us-central1' });

function assertAdminCredentials(data) {
  if (!data || data.username !== ADMIN_USERNAME || data.password !== ADMIN_PASSWORD) {
    throw new HttpsError('permission-denied', 'Invalid admin credentials.');
  }
}

function assertUid(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'A valid teacher account id is required.');
  }

  return value.trim();
}

function toReviewItem(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const {
    uid,
    firstName,
    lastName,
    gender,
    phoneNumber,
    email,
    username,
    status,
    createdAtIso
  } = candidate;

  if (
    typeof uid !== 'string' ||
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    typeof gender !== 'string' ||
    typeof phoneNumber !== 'string' ||
    typeof email !== 'string' ||
    typeof username !== 'string' ||
    typeof status !== 'string' ||
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

exports.listTeacherAccounts = onCall(async (request) => {
  assertAdminCredentials(request.data);

  const snapshot = await getDatabase().ref('teachers').get();
  if (!snapshot.exists()) {
    return { accounts: [] };
  }

  const accounts = Object.values(snapshot.val())
    .map((candidate) => toReviewItem(candidate))
    .filter((candidate) => candidate && candidate.status === 'pending')
    .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));

  return { accounts };
});

exports.approveTeacherAccount = onCall(async (request) => {
  assertAdminCredentials(request.data);
  const uid = assertUid(request.data?.uid);
  const teacherRef = getDatabase().ref(`teachers/${uid}`);
  const snapshot = await teacherRef.get();

  if (!snapshot.exists()) {
    throw new HttpsError('not-found', 'Teacher account not found.');
  }

  await teacherRef.update({
    status: 'approved',
    approvedAtIso: new Date().toISOString(),
    rejectedAtIso: null
  });

  return { success: true };
});

exports.rejectTeacherAccount = onCall(async (request) => {
  assertAdminCredentials(request.data);
  const uid = assertUid(request.data?.uid);
  const database = getDatabase();
  const teacherRef = database.ref(`teachers/${uid}`);
  const snapshot = await teacherRef.get();

  if (!snapshot.exists()) {
    throw new HttpsError('not-found', 'Teacher account not found.');
  }

  const teacher = snapshot.val();
  const normalizedUsername = typeof teacher.normalizedUsername === 'string' ? teacher.normalizedUsername : null;

  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
    if (errorCode !== 'auth/user-not-found') {
      throw error;
    }
  }

  await Promise.all([
    teacherRef.remove(),
    normalizedUsername ? database.ref(`teacherUsernames/${normalizedUsername}`).remove() : Promise.resolve()
  ]);

  return { success: true };
});