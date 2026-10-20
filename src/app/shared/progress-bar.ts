import { Component, computed, inject, input } from '@angular/core';
import { SettingsService } from '../core/settings.service';

/** Barra de progreso: segmentada (retro) o continua con gradiente (moderno). */
@Component({
  selector: 'app-progress-bar',
  template: `
    @if (settings.isRetro()) {
      <div class="segments" [style.height.px]="height() + 6">
        @for (filled of cells(); track $index) {
          <i [class.on]="filled" [style.background]="filled ? color() : null"></i>
        }
      </div>
    } @else {
      <div class="track" [style.height.px]="height()">
        <div class="fill" [style.width.%]="clamped() * 100"></div>
      </div>
    }
  `,
  host: { role: 'progressbar', '[attr.aria-valuenow]': 'round(clamped() * 100)', 'aria-valuemin': '0', 'aria-valuemax': '100' },
  styles: `
    :host {
      display: block;
    }
    .track {
      overflow: hidden;
      border-radius: 999px;
      background: var(--surface-high);
    }
    .fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--violet), var(--cyan));
      transition: width 0.3s ease;
    }
    .segments {
      display: flex;
      gap: 2px;
      padding: 2px;
      border: 2px solid var(--cyan);
      background: var(--bg);
      i {
        flex: 1;
        background: var(--surface-high);
      }
    }
  `,
})
export class ProgressBar {
  protected readonly settings = inject(SettingsService);

  readonly value = input.required<number>();
  readonly height = input(14);
  readonly segments = input(20);
  readonly color = input('var(--gold)');

  protected readonly clamped = computed(() => Math.min(1, Math.max(0, this.value() || 0)));
  protected readonly cells = computed(() => {
    const filled = Math.floor(this.clamped() * this.segments());
    return Array.from({ length: this.segments() }, (_, i) => i < filled);
  });
  protected readonly round = Math.round;
}
