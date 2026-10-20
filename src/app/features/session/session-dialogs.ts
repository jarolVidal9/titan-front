import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import type { SessionExerciseView } from '../../core/data/models';
import { SettingsService } from '../../core/settings.service';

/** Confirmación al terminar, con notas opcionales. Devuelve las notas (o undefined si sigue entrenando). */
@Component({
  template: `
    <h2 class="dialog-title">¿Terminar sesión?</h2>
    <textarea class="input" rows="3" placeholder="Notas (opcional)" [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
    <div class="dialog-actions">
      <button type="button" class="btn btn-text" (click)="ref.close()">Seguir entrenando</button>
      <button type="button" class="btn btn-primary" (click)="ref.close(notes())">Terminar</button>
    </div>
  `,
})
export class FinishDialog {
  protected readonly ref = inject(DialogRef<string>);
  protected readonly notes = signal(inject<string | null>(DIALOG_DATA) ?? '');
}

export interface SummaryData {
  xp: number;
  exercises: number;
  sets: number;
  records: string[];
}

@Component({
  template: `
    <h2 class="dialog-title">{{ settings.shout('¡STAGE CLEAR!', '¡Sesión completada!') }}</h2>
    <p class="xp">+{{ data.xp }} XP</p>
    <p style="margin: 12px 0 0">{{ data.exercises }} ejercicios · {{ data.sets }} series</p>
    @if (data.records.length) {
      <p class="gold title" style="margin: 16px 0 4px">{{ settings.shout('NEW RECORDS', 'Récords nuevos') }}</p>
      @for (r of data.records; track r) {
        <div>★ {{ r }}</div>
      }
    }
    <div class="dialog-actions">
      <button type="button" class="btn btn-primary" (click)="ref.close()">Genial</button>
    </div>
  `,
  styles: `
    .xp {
      margin: 0;
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 900;
      color: var(--gold);
    }
    :host-context([data-style='retro']) .xp {
      font-size: 20px;
    }
  `,
})
export class SummaryDialog {
  protected readonly settings = inject(SettingsService);
  protected readonly ref = inject(DialogRef);
  protected readonly data = inject<SummaryData>(DIALOG_DATA);
}

/** Elegir con qué ejercicios de la sesión se forma la biserie. */
@Component({
  template: `
    <h2 class="dialog-title">Unir en biserie con…</h2>
    @for (c of candidates; track c.sessionExercise.id) {
      <label class="list-item">
        <input type="checkbox" class="check" [checked]="selected().includes(c.sessionExercise.id)" (change)="toggle(c.sessionExercise.id)" />
        <span class="grow">{{ c.exercise.name }}</span>
      </label>
    }
    <div class="dialog-actions">
      <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
      <button type="button" class="btn btn-primary" [disabled]="!selected().length" (click)="ref.close(selected())">Unir</button>
    </div>
  `,
  styles: `
    .check {
      width: 22px;
      height: 22px;
      accent-color: var(--primary);
    }
  `,
})
export class LinkDialog {
  protected readonly candidates = inject<SessionExerciseView[]>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<string[]>);
  protected readonly selected = signal<string[]>([]);

  protected toggle(id: string): void {
    this.selected.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
}
