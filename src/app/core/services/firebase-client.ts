import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { environment } from '../../../environments/environment';

export function getPortalFirebaseApp() {
  return getApps()[0] ?? initializeApp(environment.firebase);
}

export function getPortalAuth() {
  return getAuth(getPortalFirebaseApp());
}

export function getPortalDatabase() {
  return getDatabase(getPortalFirebaseApp());
}

export function getPortalFunctions() {
  return getFunctions(getPortalFirebaseApp());
}
