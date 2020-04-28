import { Injectable, NgZone } from '@angular/core';
import { User } from '../../intefaces/user';
import { auth } from 'firebase/app';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap, map, first } from 'rxjs/operators';
import { PresenceService } from '../presence/presence.service';
import { Store } from '@ngrx/store';
import * as fromRoot from '../../../app.reducer';
import * as authActions from '../../../components/authentication/store/actions/authentication.actions';
import { Socket } from 'ngx-socket-io';
@Injectable({
  providedIn: 'root'
})

export class AuthService {
  userData: any;
  user$: Observable<any>;

  constructor(
    private afs: AngularFirestore,   // Inject Firestore service
    private afAuth: AngularFireAuth, // Inject Firebase auth service
    private router: Router,
    private presenceService: PresenceService,
    private socket: Socket,
    private store: Store<fromRoot.State>
  ) {
    this.user$ = this.afAuth.authState.pipe(
      switchMap(user => {
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          this.store.dispatch(new authActions.SetAuthenticated(
            {
              isLogged: true,
              isLoggining: false,
              status: 'online',
              UID: user.uid
            }));
          this.presenceService.combineAuthState();
          return this.afs.doc<any>(`users/${user.uid}`).valueChanges();
        } else {
          localStorage.setItem('user', null);
          return of(null);
        }
      })
    );
  }
  GoogleAuth() {   // Sign in with Google
    return this.AuthLogin(new auth.GoogleAuthProvider());
  }

  async SignIn(email, password) {   // Sign in with email/password
    try {
      const result = await this.afAuth.auth.signInWithEmailAndPassword(email, password);
      this.router.navigate(['dashboard']);
      this.SetUserData(result.user);
    } catch (error) {
      window.alert(error.message);
    }
  }
  checkUserEmail(email) {
    return this.afs.collection('users').snapshotChanges().pipe(
      map(actions => actions.map(a => a.payload.doc.data() as User)),
      map(actions => actions.filter(user => user.email === email)[0]),
    );
  }

  GetAllUsers(): Observable<any> {
    return this.afs.collection('users').snapshotChanges()
      .pipe(
        map(actions => actions.map(a => a.payload.doc.data() as User)),
        map((users: Array<User>) => users.filter((user: User) => user.emailVerified === true))
      );
  }

  async SignUp(email, password) { // Sign up with email/password
    try {
      const result = await this.afAuth.auth.createUserWithEmailAndPassword(email, password);
      this.SendVerificationMail(); /* Call the SendVerificaitonMail() function when new user sign up and returns promise */
      this.SetUserData(result.user);
    } catch (error) {
      window.alert(error.message);
    }
  }

  async SendVerificationMail() {   // Send email verfificaiton when new user sign up
    await this.afAuth.auth.currentUser.sendEmailVerification();
    this.router.navigate(['verify-email-address']);
  }

  async ForgotPassword(passwordResetEmail) {   // Reset Forggot password
    try {
      await this.afAuth.auth.sendPasswordResetEmail(passwordResetEmail);
      window.alert('Password reset email sent, check your inbox.');
    } catch (error) {
      window.alert(error);
    }
  }

  getUser() {
    return this.user$.pipe(first()).toPromise();
  }

  get isLoggedIn(): boolean {   // Returns true when user is looged in and email is verified
    const user = JSON.parse(localStorage.getItem('user'));
    return (user !== null && user.emailVerified !== false) ? true : false;
  }

  async AuthLogin(provider) {   // Auth logic to run auth providers
    try {
      const result = await this.afAuth.auth.signInWithPopup(provider);
      this.router.navigate(['dashboard']);
      this.SetUserData(result.user);
    } catch (error) {
      window.alert(error);
    }
  }
  SetUserData(user) {
    const userRef: AngularFirestoreDocument<any> = this.afs.doc(`users/${user.uid}`);
    const userData: User = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      status: 'offline'
    };
    return userRef.set(userData, {
      merge: true
    });
  }
  async SignOut() {   // Sign out
    this.store.dispatch(new authActions.SetUnauthenticated({
        isLogged: false,
        isLoggining: false,
        status: 'offline',
        UID: JSON.parse(localStorage.getItem('user')).uid
      }));
    this.router.navigate(['sign-in']);
    localStorage.removeItem('user');
  }
}
