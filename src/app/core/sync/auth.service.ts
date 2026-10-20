import { HttpClient, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LocalDb } from '../db/local-db';

export interface User {
  id: number;
  email: string;
}

const TOKEN_KEY = 'titan.token';
const USER_KEY = 'titan.user';
const GUEST_KEY = 'titan.guest';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento (modo privado): la sesión dura lo que la pestaña.
  }
}

/** Mensaje legible de un error del backend. */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'No hay conexión con el servidor.';
    return e.error?.error ?? `Error del servidor (${e.status}).`;
  }
  return String(e);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly db = inject(LocalDb);

  readonly token = signal(read(TOKEN_KEY));
  readonly user = signal<User | null>(JSON.parse(read(USER_KEY) ?? 'null'));
  /** Eligió usar la app sin cuenta (solo en este navegador). */
  readonly guest = signal(read(GUEST_KEY) === '1');
  /** El servidor rechazó el token: hay que volver a entrar (los datos locales se conservan). */
  readonly expired = signal(false);
  readonly loggedIn = computed(() => this.token() != null && !this.expired());
  readonly canUseApp = computed(() => this.token() != null || this.guest());

  async login(email: string, password: string, register: boolean): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; user: User }>(`${environment.apiUrl}/auth/${register ? 'register' : 'login'}`, {
        email,
        password,
        deviceName: navigator.userAgent.slice(0, 100),
      }),
    );
    // Otra cuenta en este navegador: no se mezclan los datos.
    if (this.user() && this.user()!.email !== res.user.email) await this.db.reset();
    // Lo que ya había en local (como invitado o de antes) se sube a la cuenta.
    this.db.markAllPending();
    await this.db.setMeta('cursor', 0);
    this.token.set(res.token);
    this.user.set(res.user);
    this.expired.set(false);
    this.guest.set(false);
    write(TOKEN_KEY, res.token);
    write(USER_KEY, JSON.stringify(res.user));
    write(GUEST_KEY, null);
  }

  continueAsGuest(): void {
    this.guest.set(true);
    write(GUEST_KEY, '1');
  }

  /** Cierra sesión y borra los datos de este navegador (siguen en la nube). */
  async logout(): Promise<void> {
    const token = this.token();
    if (token && !this.expired()) {
      this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({ error: () => {} });
    }
    this.token.set(null);
    this.user.set(null);
    this.expired.set(false);
    write(TOKEN_KEY, null);
    write(USER_KEY, null);
    await this.db.reset();
  }

  markExpired(): void {
    this.expired.set(true);
  }
}

/** Agrega el token de sesión a las llamadas al backend. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (!token || !req.url.startsWith(environment.apiUrl)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
