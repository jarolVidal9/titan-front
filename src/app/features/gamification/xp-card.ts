import { Component, inject } from '@angular/core';
import { ProgressService } from '../../core/data/progress.service';
import { SettingsService } from '../../core/settings.service';
import { Card } from '../../shared/card';
import { ProgressBar } from '../../shared/progress-bar';

/** Tarjeta de nivel + barra de XP. */
@Component({
  selector: 'app-xp-card',
  imports: [Card, ProgressBar],
  template: `
    @let xp = progress.xp();
    <app-card>
      <div class="row" style="align-items: flex-end">
        <span class="level">{{ settings.isRetro() ? 'LV ' + xp.level : 'Nivel ' + xp.level }}</span>
        <span class="grow"></span>
        <span class="num gold">{{ xp.totalXp - xp.levelStartXp }} / {{ xp.nextLevelXp - xp.levelStartXp }} XP</span>
      </div>
      <app-progress-bar class="mt-8" [value]="xp.levelProgress" />
      <p class="tiny muted" style="margin: 8px 0 0">
        {{ xp.totalXp }} XP totales · {{ xp.prs.length }} récords · {{ xp.finishedSessions }} sesiones
      </p>
    </app-card>
  `,
  styles: `
    .level {
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 800;
      color: var(--primary);
    }
    :host-context([data-style='retro']) .level {
      font-size: 18px;
      color: var(--cyan);
    }
  `,
})
export class XpCard {
  protected readonly progress = inject(ProgressService);
  protected readonly settings = inject(SettingsService);
}
