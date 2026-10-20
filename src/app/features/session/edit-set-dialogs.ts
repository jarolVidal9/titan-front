import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import type { SetRecord } from '../../core/data/models';
import type { SetValues } from '../../core/data/workout.repo';
import type { Row } from '../../core/db/schema';
import { formatKg } from '../../core/utils/format';

/** `null` = borrar la serie. */
export type SetEdit = SetValues | null;

const num = (text: string) => {
  const v = Number(text.replace(',', '.'));
  return Number.isFinite(v) && text.trim() !== '' ? v : null;
};

/** Editar o borrar una serie de fuerza ya guardada. */
@Component({
  template: `
    <form (submit)="$event.preventDefault(); save()">
      <h2 class="dialog-title">Editar serie {{ data.record.set.setNumber }}</h2>
      <div class="stack lg">
        <label class="field">
          <span>Tipo</span>
          <select class="input" (change)="typeId.set($any($event.target).value)">
            @for (t of types; track t.id) {
              <option [value]="t.id" [selected]="t.id === typeId()">{{ t.name }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Peso (kg)</span>
          <input class="input" inputmode="decimal" [value]="weight()" (input)="weight.set($any($event.target).value)" />
        </label>
        <label class="field">
          <span>{{ timed() ? 'Segundos' : 'Repeticiones' }}</span>
          <input class="input" inputmode="numeric" [value]="amount()" (input)="amount.set($any($event.target).value)" />
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-text danger" (click)="ref.close(null)">Eliminar</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `,
})
export class EditSetDialog {
  protected readonly data = inject<{ record: SetRecord; repTypes: Row<'rep_types'>[] }>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<SetEdit>);

  // Incluye el tipo actual aunque esté archivado.
  protected readonly types = this.data.repTypes.some((t) => t.id === this.data.record.repType.id)
    ? this.data.repTypes
    : [...this.data.repTypes, this.data.record.repType];
  protected readonly typeId = signal(this.data.record.set.repTypeId);
  protected readonly weight = signal(formatKg(this.data.record.set.weightKg));
  protected readonly amount = signal(String((this.data.record.repType.measure === 'seconds' ? this.data.record.set.durationSec : this.data.record.set.reps) ?? ''));
  protected readonly timed = computed(() => this.types.find((t) => t.id === this.typeId())?.measure === 'seconds');

  protected save(): void {
    const a = Math.round(num(this.amount()) ?? 0);
    if (a <= 0) return;
    const s = this.data.record.set;
    this.ref.close({
      repTypeId: this.typeId(),
      weightKg: Math.min(999, Math.max(0, num(this.weight()) ?? 0)),
      reps: this.timed() ? null : a,
      durationSec: this.timed() ? a : null,
      distanceKm: s.distanceKm,
      intensity: s.intensity,
      note: s.note,
    });
  }
}

/** Editar o borrar un bloque de cardio. */
@Component({
  template: `
    <form (submit)="$event.preventDefault(); save()">
      <h2 class="dialog-title">Editar cardio</h2>
      <div class="stack lg">
        <label class="field">
          <span>Duración (min)</span>
          <input class="input" inputmode="numeric" [value]="minutes()" (input)="minutes.set($any($event.target).value)" />
        </label>
        <label class="field">
          <span>Distancia (km)</span>
          <input class="input" inputmode="decimal" [value]="km()" (input)="km.set($any($event.target).value)" />
        </label>
        <label class="field">
          <span>Velocidad o nivel</span>
          <input class="input" inputmode="decimal" [value]="intensity()" (input)="intensity.set($any($event.target).value)" />
        </label>
        <label class="field">
          <span>Nota / intervalos</span>
          <textarea class="input" rows="2" [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn btn-text danger" (click)="ref.close(null)">Eliminar</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>
  `,
})
export class EditCardioDialog {
  private readonly record = inject<SetRecord>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<SetEdit>);
  private readonly s = this.record.set;

  protected readonly minutes = signal(String(Math.round((this.s.durationSec ?? 0) / 60)));
  protected readonly km = signal(this.s.distanceKm == null ? '' : formatKg(this.s.distanceKm));
  protected readonly intensity = signal(this.s.intensity == null ? '' : formatKg(this.s.intensity));
  protected readonly note = signal(this.s.note ?? '');

  protected save(): void {
    const m = Math.round(num(this.minutes()) ?? 0);
    if (m <= 0) return;
    const positive = (v: number | null) => (v != null && v > 0 ? v : null);
    this.ref.close({
      repTypeId: this.s.repTypeId,
      weightKg: 0,
      reps: null,
      durationSec: m * 60,
      distanceKm: positive(num(this.km())),
      intensity: positive(num(this.intensity())),
      note: this.note().trim() || null,
    });
  }
}
