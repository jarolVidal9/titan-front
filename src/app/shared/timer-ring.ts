import { Component, computed, inject, input } from '@angular/core';
import { SettingsService } from '../core/settings.service';

const COUNT = 40;

/** Anillo del temporizador: bloques tipo 16-bit (retro) o arco continuo con gradiente (moderno). */
@Component({
  selector: 'app-timer-ring',
  template: `
    <svg viewBox="0 0 100 100" aria-hidden="true">
      @if (settings.isRetro()) {
        @for (b of blocks(); track $index) {
          <rect [attr.x]="b.x - 2.3" [attr.y]="b.y - 2.3" width="4.6" height="4.6" [attr.fill]="b.color" shape-rendering="crispEdges" />
        }
      } @else {
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="var(--violet)" />
            <stop offset="0.5" stop-color="var(--cyan)" />
            <stop offset="1" stop-color="var(--violet)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-high)" stroke-width="5" />
        <circle
          cx="50" cy="50" r="44" fill="none" stroke="url(#ring-grad)" stroke-width="5" stroke-linecap="round"
          transform="rotate(-90 50 50)" [attr.stroke-dasharray]="circumference" [attr.stroke-dashoffset]="offset()"
          [style.opacity]="progress() > 0 ? 1 : 0"
        />
      }
    </svg>
    <div class="content"><ng-content /></div>
  `,
  host: { '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  styles: `
    :host {
      position: relative;
      display: block;
    }
    svg {
      width: 100%;
      height: 100%;
    }
    circle {
      transition: stroke-dashoffset 0.25s linear;
    }
    .content {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
    }
  `,
})
export class TimerRing {
  protected readonly settings = inject(SettingsService);

  readonly progress = input.required<number>(); // 1 = lleno, 0 = terminado
  readonly size = input(240);

  protected readonly circumference = 2 * Math.PI * 44;
  protected readonly offset = computed(() => this.circumference * (1 - Math.min(1, Math.max(0, this.progress()))));

  protected readonly blocks = computed(() => {
    const p = Math.min(1, Math.max(0, this.progress()));
    const lit = Math.ceil(p * COUNT);
    return Array.from({ length: COUNT }, (_, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / COUNT;
      const color = i < lit ? (i < lit - 1 || p >= 1 ? 'var(--cyan)' : 'var(--gold)') : 'var(--surface-high)';
      return { x: 50 + Math.cos(a) * 42, y: 50 + Math.sin(a) * 42, color };
    });
  });
}
