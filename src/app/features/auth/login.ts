import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, email, form, minLength, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { SettingsService } from '../../core/settings.service';
import { AuthService, apiErrorMessage } from '../../core/sync/auth.service';
import { Card } from '../../shared/card';

@Component({
  imports: [Card, FormField, FormRoot],
  template: `
    <div class="wrap">
      <header class="brand">
        <img src="branding/emblem-192.png" alt="" width="96" height="96" />
        <h1>TITAN</h1>
        <p class="muted">Diario de entrenamiento</p>
      </header>

      <app-card padding="24px">
        <div class="segmented tabs" role="tablist">
          <button type="button" role="tab" [class.selected]="mode() === 'login'" [attr.aria-selected]="mode() === 'login'" (click)="mode.set('login')">Entrar</button>
          <button type="button" role="tab" [class.selected]="mode() === 'register'" [attr.aria-selected]="mode() === 'register'" (click)="mode.set('register')">Crear cuenta</button>
        </div>

        <form [formRoot]="form" class="stack lg mt-16">
          <label class="field">
            <span>Email</span>
            <input class="input" type="email" autocomplete="email" [formField]="form.email" />
            @if (form.email().touched()) {
              @for (e of form.email().errors(); track e.kind) {
                <span class="error">{{ e.message }}</span>
              }
            }
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input class="input" type="password" [autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" [formField]="form.password" />
            @if (form.password().touched()) {
              @for (e of form.password().errors(); track e.kind) {
                <span class="error">{{ e.message }}</span>
              }
            }
          </label>

          @for (e of serverErrors(); track $index) {
            <p class="error-box" role="alert"><span aria-hidden="true" class="icon sm">error</span> {{ e }}</p>
          }

          <button type="submit" class="btn btn-primary block" [disabled]="form().submitting()">
            {{ form().submitting() ? 'Conectando…' : mode() === 'login' ? 'Entrar' : 'Crear cuenta' }}
          </button>
        </form>
        <p class="tiny muted center" style="margin: 14px 0 0">
          Con una cuenta tus datos se sincronizan entre el celular y la web. Sin conexión todo sigue funcionando.
        </p>
      </app-card>

      <button type="button" class="btn btn-text block mt-16" (click)="guest()">Usar sin cuenta (solo en este navegador)</button>
    </div>
  `,
  styles: `
    .wrap {
      max-width: 420px;
      margin: 0 auto;
      padding: 32px 16px 48px;
    }
    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
      h1 {
        margin-top: 12px;
        font-size: 32px;
        letter-spacing: 4px;
        font-weight: 900;
      }
      p {
        margin: 4px 0 0;
      }
    }
    :host-context([data-style='retro']) .brand {
      img {
        image-rendering: pixelated;
      }
      h1 {
        font-size: 22px;
        color: var(--gold);
      }
    }
    .tabs {
      display: flex;
      button {
        flex: 1;
      }
    }
    .error-box {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--danger) 14%, transparent);
      color: var(--danger);
      font-size: 14px;
    }
  `,
})
export default class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly settings = inject(SettingsService);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly serverErrors = signal<string[]>([]);

  private readonly model = signal({ email: this.auth.user()?.email ?? '', password: '' });
  protected readonly form = form(
    this.model,
    (p) => {
      required(p.email, { message: 'Escribe tu email' });
      email(p.email, { message: 'Ese email no es válido' });
      required(p.password, { message: 'Escribe tu contraseña' });
      minLength(p.password, 8, { message: 'Mínimo 8 caracteres' });
    },
    {
      submission: {
        action: async (f) => {
          this.serverErrors.set([]);
          try {
            const { email, password } = f().value();
            await this.auth.login(email.trim(), password, this.mode() === 'register');
            await this.router.navigateByUrl('/today');
          } catch (e) {
            this.serverErrors.set([apiErrorMessage(e)]);
          }
          return undefined;
        },
      },
    },
  );

  protected guest(): void {
    this.auth.continueAsGuest();
    void this.router.navigateByUrl('/today');
  }
}
