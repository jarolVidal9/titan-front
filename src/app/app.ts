import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ProgressService } from './core/data/progress.service';
import { SoundService } from './core/sound.service';
import { SyncService } from './core/sync/sync.service';
import { LevelUpDialog } from './features/gamification/level-up-dialog';
import { RestTimerBar } from './features/timer/rest-timer-bar';
import { UiService } from './shared/ui.service';

const NAV = [
  { path: '/today', icon: 'bolt', label: 'Hoy' },
  { path: '/routine', icon: 'calendar_month', label: 'Rutina' },
  { path: '/library', icon: 'fitness_center', label: 'Biblioteca' },
  { path: '/history', icon: 'insights', label: 'Historial' },
  { path: '/settings', icon: 'tune', label: 'Ajustes' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, RestTimerBar],
  template: `
    <main>
      <router-outlet />
    </main>

    @if (showNav()) {
      <app-rest-timer-bar />
      <nav aria-label="Principal">
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'page' : null">
            <span class="pill"><span aria-hidden="true" class="icon" [class.filled]="rla.isActive">{{ item.icon }}</span></span>
            <span class="label">{{ item.label }}</span>
          </a>
        }
      </nav>
    }

    <div class="toast-host" aria-live="polite">
      @for (t of ui.toasts(); track t.id) {
        <div class="toast" [class.record]="t.kind === 'record'">
          @if (t.icon) {
            <span aria-hidden="true" class="icon">{{ t.icon }}</span>
          }
          <span>{{ t.message }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    nav {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 30;
      display: flex;
      justify-content: center;
      height: calc(var(--nav-h) + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--surface);
      border-top: 1px solid var(--outline);
    }
    a {
      flex: 1;
      max-width: 120px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--muted);
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
    }
    .pill {
      display: grid;
      place-items: center;
      width: 56px;
      height: 30px;
      border-radius: 15px;
      transition: background 0.15s;
    }
    a.active {
      color: var(--on-surface);
      .pill {
        background: var(--primary-soft);
      }
    }
    :host-context([data-style='retro']) {
      nav {
        border-top: 2px solid var(--cyan);
      }
      a {
        font-size: 11px;
      }
      a.active .pill {
        border-radius: 0;
        background: var(--violet);
        outline: 2px solid var(--cyan);
        color: #fff;
      }
    }

    /* En pantallas anchas la navegación pasa a una barra lateral. */
    @media (min-width: 960px) {
      :host {
        --nav-h: 0px;
      }
      nav {
        inset: 0 auto 0 0;
        flex-direction: column;
        justify-content: flex-start;
        gap: 8px;
        width: 96px;
        height: auto;
        padding: 24px 0;
        border-top: 0;
        border-right: 1px solid var(--outline);
      }
      a {
        flex: none;
        height: 64px;
      }
      main {
        margin-left: 96px;
      }
      :host-context([data-style='retro']) nav {
        border-top: 0;
        border-right: 2px solid var(--cyan);
      }
    }
  `,
})
export class App {
  protected readonly ui = inject(UiService);
  protected readonly nav = NAV;

  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: '' },
  );
  protected readonly showNav = computed(() => !this.url().startsWith('/login'));

  constructor() {
    // Celebra cuando se sube de nivel (no al abrir la app ni al recibir datos de la nube).
    const progress = inject(ProgressService);
    const sound = inject(SoundService);
    const sync = inject(SyncService);
    const level = computed(() => progress.xp().level);
    let previous: number | null = null;
    effect(() => {
      const next = level();
      untracked(() => {
        const fromCloud = sync.status() === 'syncing';
        if (previous != null && next > previous && !fromCloud && document.visibilityState === 'visible') {
          sound.play('levelup');
          sound.vibrate([120, 80, 120, 80, 300]);
          void this.ui.open(LevelUpDialog, next);
        }
        previous = next;
      });
    });
  }
}
