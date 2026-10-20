import { DOCUMENT, Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { RestTimerService } from '../../core/rest-timer.service';
import { SettingsService } from '../../core/settings.service';
import { formatDuration } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { ProgressBar } from '../../shared/progress-bar';
import { UiService } from '../../shared/ui.service';
import { RestTimerSheet } from './rest-timer-sheet';

/** Barra compacta sobre la navegación mientras hay un descanso activo. */
@Component({
  selector: 'app-rest-timer-bar',
  imports: [Card, ProgressBar],
  template: `
    @if (visible()) {
      <div class="wrap" #wrap>
        <app-card [accent]="finished() ? 'gold' : settings.isRetro() ? 'cyan' : null" padding="10px 6px 10px 14px" clickable (click)="open()">
          <div class="row">
            <span aria-hidden="true" class="icon" [style.color]="color()">{{ finished() ? 'notifications_active' : 'timer' }}</span>
            <div class="grow">
              @if (finished()) {
                <span class="num done">{{ settings.shout('¡A LA SIGUIENTE SERIE!', '¡A la siguiente serie!') }}</span>
              } @else {
                <span class="num time" [style.color]="color()">{{ time() }}</span>
                <app-progress-bar [value]="timer.progress()" [height]="6" [segments]="24" color="var(--cyan)" />
              }
            </div>
            @if (finished()) {
              <button type="button" class="icon-btn" aria-label="Cerrar" (click)="$event.stopPropagation(); timer.dismissFinished()">
                <span aria-hidden="true" class="icon">close</span>
              </button>
            } @else {
              <button type="button" class="icon-btn" [attr.aria-label]="paused() ? 'Reanudar' : 'Pausar'" (click)="$event.stopPropagation(); paused() ? timer.resume() : timer.pause()">
                <span aria-hidden="true" class="icon">{{ paused() ? 'play_arrow' : 'pause' }}</span>
              </button>
              <button type="button" class="btn btn-text sm" (click)="$event.stopPropagation(); timer.add10()">+10s</button>
              <button type="button" class="icon-btn" aria-label="Saltar" (click)="$event.stopPropagation(); timer.skip()">
                <span aria-hidden="true" class="icon">skip_next</span>
              </button>
            }
          </div>
        </app-card>
      </div>
    }
  `,
  styles: `
    .wrap {
      position: fixed;
      left: 50%;
      bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px);
      z-index: 25;
      width: min(100vw - 24px, 560px);
      transform: translateX(-50%);
      animation: up 0.2s ease-out;
    }
    @media (min-width: 960px) {
      .wrap {
        left: calc(50% + 48px);
      }
    }
    .time {
      display: block;
      font-size: 26px;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .done {
      color: var(--gold);
      font-size: 17px;
    }
    @keyframes up {
      from {
        transform: translate(-50%, 20px);
        opacity: 0;
      }
    }
  `,
})
export class RestTimerBar {
  protected readonly timer = inject(RestTimerService);
  protected readonly settings = inject(SettingsService);
  private readonly ui = inject(UiService);
  private readonly wrap = viewChild<ElementRef<HTMLElement>>('wrap');

  protected readonly visible = computed(() => this.timer.state().status !== 'idle');
  protected readonly finished = computed(() => this.timer.state().status === 'finished');
  protected readonly paused = computed(() => this.timer.state().status === 'paused');
  protected readonly time = computed(() => formatDuration(this.timer.remainingSec()));
  protected readonly color = computed(() => (this.finished() ? 'var(--gold)' : this.settings.isRetro() ? 'var(--cyan)' : 'var(--primary)'));

  constructor() {
    // Deja espacio para que el botón flotante y los avisos no queden debajo de la barra.
    const root = inject(DOCUMENT).documentElement;
    effect(() => {
      const el = this.wrap()?.nativeElement;
      root.style.setProperty('--timer-h', el ? `${el.offsetHeight + 8}px` : '0px');
    });
  }

  protected open(): void {
    if (this.finished()) this.timer.dismissFinished();
    else void this.ui.sheet(RestTimerSheet);
  }
}
