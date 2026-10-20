import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { RestTimerService } from '../../core/rest-timer.service';
import { SettingsService } from '../../core/settings.service';
import { formatDuration } from '../../core/utils/format';
import { TimerRing } from '../../shared/timer-ring';
import { UiService } from '../../shared/ui.service';

@Component({
  imports: [TimerRing],
  template: `
    @let s = timer.state();
    @if (s.label) {
      <p class="title center" style="margin: 0 0 12px">{{ s.label }}</p>
    }
    <app-timer-ring class="ring" [progress]="timer.progress()" [size]="240">
      <span class="num clock">{{ time() }}</span>
    </app-timer-ring>

    @if (timer.isActive()) {
      <div class="actions">
        <button type="button" class="btn btn-outline" (click)="s.status === 'paused' ? timer.resume() : timer.pause()">
          <span aria-hidden="true" class="icon">{{ s.status === 'paused' ? 'play_arrow' : 'pause' }}</span>
          {{ s.status === 'paused' ? 'Reanudar' : 'Pausar' }}
        </button>
        <button type="button" class="btn btn-outline" (click)="timer.add10()">+10s</button>
        <button type="button" class="btn btn-outline" (click)="timer.skip(); ref.close()"><span aria-hidden="true" class="icon">skip_next</span> Saltar</button>
      </div>
    }

    <p class="title" style="margin: 20px 0 8px">{{ timer.isActive() ? 'Reiniciar con:' : 'Iniciar descanso:' }}</p>
    <div class="chips">
      @for (sec of presets(); track sec) {
        <button type="button" class="chip" (click)="timer.start(sec, s.label)">{{ format(sec) }}</button>
      }
      <button type="button" class="chip" (click)="custom()"><span aria-hidden="true" class="icon">edit</span> Otro</button>
    </div>
  `,
  styles: `
    .ring {
      margin: 0 auto;
    }
    .clock {
      font-size: 56px;
    }
    :host-context([data-style='retro']) .clock {
      font-size: 44px;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 24px;
      .btn {
        padding: 10px 8px;
      }
    }
  `,
})
export class RestTimerSheet {
  protected readonly timer = inject(RestTimerService);
  protected readonly ref = inject(DialogRef);
  private readonly settings = inject(SettingsService);
  private readonly ui = inject(UiService);

  protected readonly format = formatDuration;
  protected readonly time = computed(() => formatDuration(this.timer.remainingSec()));
  protected readonly presets = computed(() => [...new Set([60, 90, 120, this.settings.defaultRestSec()])].sort((a, b) => a - b));

  protected async custom(): Promise<void> {
    const sec = await this.ui.seconds(this.settings.defaultRestSec());
    if (sec) this.timer.start(sec, this.timer.state().label);
  }
}
