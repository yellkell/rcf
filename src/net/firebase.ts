/**
 * THE CLOUD — one Firebase connection, shared by everything.
 *
 * The same discipline as FIRE FIGHT 2 (ff2/src/net/firebase.ts): it opens
 * LAZILY — no Firebase code loads until something asks for the cloud, so a
 * player who boots straight into a hide never pays for the bundle — and it
 * FAILS SOFT: a headset on a dead network, a captive portal, a project with
 * auth switched off, all resolve to `null`, and every caller carries on
 * without a cloud rather than hang or throw.
 *
 * IDENTITY is anonymous auth. No sign-in screen, ever; `signInAnonymously()`
 * mints a uid on first contact and the SDK keeps it in IndexedDB, so a
 * headset stays the same player across sessions. That uid is the basis of
 * the security rules: a document named after you is one only you can write.
 *
 * WHAT DOES NOT COME THROUGH HERE: live poses at 10 Hz. Firestore is the
 * spine — who you are, your look, your record — not the wire.
 */

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/** Set false to cut the cloud off entirely — nothing here ever loads. */
export const FIREBASE_ENABLED = true;

/**
 * The ROBOT CUTTLEFISH web app, in the yellkell-tournaments project.
 *
 * An API key here is a public identifier, not a secret. It names the project;
 * it does not grant anything. The security boundary is firestore.rules.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyANvT34fM1mUFlUFHXNXtjHRldO5btOjw0',
  authDomain: 'yellkell-tournaments.firebaseapp.com',
  projectId: 'yellkell-tournaments',
  storageBucket: 'yellkell-tournaments.appspot.com',
  messagingSenderId: '117411516940',
  appId: '1:117411516940:web:c0b410113b6b7c418f9429',
  measurementId: 'G-CB6N60MMZ9',
};

/** Nothing may hang for ever: every round trip gets a deadline. */
const TIMEOUT_MS = 8_000;

export type FirestoreMod = typeof import('firebase/firestore');

export interface Cloud {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  /** The Firestore module itself — callers need `doc`, `setDoc` and friends,
   *  and re-importing it everywhere would defeat the lazy load. */
  fs: FirestoreMod;
  /** The anonymous uid — the whole identity. */
  uid: string;
}

let pending: Promise<Cloud | null> | null = null;

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });
}

/**
 * The one connection. Resolves to `null` (and remembers that answer for the
 * session) when the cloud is off, unreachable or refuses anonymous sign-in.
 */
export function cloud(): Promise<Cloud | null> {
  if (!FIREBASE_ENABLED) return Promise.resolve(null);
  if (pending) return pending;
  pending = (async () => {
    try {
      const [{ initializeApp, getApps }, authMod, fs] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const cred = await withDeadline(authMod.signInAnonymously(auth), TIMEOUT_MS);
      const uid = cred?.user?.uid ?? auth.currentUser?.uid;
      if (!uid) return null;
      const db = fs.getFirestore(app);
      // Analytics is a nice-to-have: never let it block or break the boot.
      import('firebase/analytics')
        .then((a) => a.isSupported().then((ok) => ok && a.getAnalytics(app)))
        .catch(() => undefined);
      return { app, auth, db, fs, uid };
    } catch (err) {
      console.warn('[cloud] offline:', err);
      return null;
    }
  })();
  return pending;
}
