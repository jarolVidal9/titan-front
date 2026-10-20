import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import type { Row } from '../core/db/schema';
import { formatDuration } from '../core/utils/format';

export interface ConfirmData {
  title: string;
  message?: string;
  confirm?: string;
  danger?: boolean;
}

@Component({
  template: `
    <h2 class="dialog-title">{{ data.title }}</h2>
    @if (data.message) {
      <p style="white-space: pre-line; margin: 0">{{ data.message }}</p>
    }
    <div class="dialog-actions">
      <button type="button" class="btn btn-text" (click)="ref.close(false)">Cancelar</button>
      <button type="button" class="btn" [class.btn-danger]="data.danger" [class.btn-primary]="!data.danger" (click)="ref.close(true)">
        {{ data.confirm ?? 'Aceptar' }}
      </button>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<boolean>);
}

export interface PromptData {
  title: string;
  initial?: string;
  placeholder?: string;
  confirm?: string;
}

@Component({
  template: `
    <form (submit)="$event.preventDefault(); ref.close(value())">
      <h2 class="dialog-title">{{ data.title }}</h2>
      <input class="input" [value]="value()" (input)="value.set($any($event.target).value)" [placeholder]="data.placeholder ?? ''" autocapitalize="sentences" />
      <div class="dialog-actions">
        <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">{{ data.confirm ?? 'Guardar' }}</button>
      </div>
    </form>
  `,
})
export class PromptDialog {
  protected readonly data = inject<PromptData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<string>);
  protected readonly value = signal(this.data.initial ?? '');
}

export interface NumberData {
  title: string;
  initial: string;
  decimal: boolean;
}

@Component({
  template: `
    <form (submit)="$event.preventDefault(); accept()">
      <h2 class="dialog-title">{{ data.title }}</h2>
      <input
        #box
        class="input num"
        style="font-size: 28px; text-align: center"
        [inputMode]="data.decimal ? 'decimal' : 'numeric'"
        [value]="data.initial"
        (input)="text.set(box.value)"
        (focus)="box.select()"
      />
      <div class="dialog-actions">
        <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Aceptar</button>
      </div>
    </form>
  `,
})
export class NumberDialog {
  protected readonly data = inject<NumberData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<number>);
  protected readonly text = signal(this.data.initial);

  protected accept(): void {
    const n = Number(this.text().replace(',', '.'));
    this.ref.close(Number.isFinite(n) && this.text().trim() !== '' ? n : undefined);
  }
}

@Component({
  template: `
    <h2 class="dialog-title">Tiempo de descanso</h2>
    <p class="num center" style="font-size: 40px; margin: 0">{{ label() }}</p>
    <input type="range" min="15" max="600" step="5" [value]="value()" (input)="value.set(+$any($event.target).value)" aria-label="Segundos" />
    <div class="row" style="justify-content: center">
      <button type="button" class="icon-btn tonal" aria-label="Menos 5 segundos" (click)="nudge(-5)"><span aria-hidden="true" class="icon">remove</span></button>
      <button type="button" class="icon-btn tonal" aria-label="Más 5 segundos" (click)="nudge(5)"><span aria-hidden="true" class="icon">add</span></button>
    </div>
    <div class="dialog-actions">
      <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
      <button type="button" class="btn btn-primary" (click)="ref.close(value())">Aceptar</button>
    </div>
  `,
  styles: `
    input[type='range'] {
      width: 100%;
      margin: 16px 0;
      accent-color: var(--primary);
    }
  `,
})
export class SecondsDialog {
  protected readonly ref = inject(DialogRef<number>);
  protected readonly value = signal(Math.min(600, Math.max(15, inject<number>(DIALOG_DATA))));
  protected readonly label = computed(() => formatDuration(this.value()));

  protected nudge(d: number): void {
    this.value.update((v) => Math.min(600, Math.max(15, v + d)));
  }
}

export interface ChoiceOption<T> {
  value: T;
  icon?: string;
  title: string;
  subtitle?: string;
}

@Component({
  template: `
    <h2 class="dialog-title" style="margin-bottom: 4px">{{ data.title }}</h2>
    @for (o of data.options; track $index) {
      <button type="button" class="list-item" (click)="ref.close(o.value)">
        @if (o.icon) {
          <span aria-hidden="true" class="icon">{{ o.icon }}</span>
        }
        <span class="grow">
          <span class="title" style="display: block">{{ o.title }}</span>
          @if (o.subtitle) {
            <span class="small muted ellipsis" style="display: block">{{ o.subtitle }}</span>
          }
        </span>
      </button>
    }
  `,
})
export class ChoiceSheet {
  protected readonly data = inject<{ title: string; options: ChoiceOption<unknown>[] }>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<unknown>);
}

export interface GroupPickerData {
  title: string;
  groups: Row<'muscle_groups'>[];
  initial?: Iterable<string>;
  confirm?: string;
}

@Component({
  template: `
    <h2 class="dialog-title">{{ data.title }}</h2>
    <div class="chips">
      @for (g of data.groups; track g.id) {
        <button type="button" class="chip" [class.selected]="selected().has(g.id)" [attr.aria-pressed]="selected().has(g.id)" (click)="toggle(g.id)">
          {{ g.name }}
        </button>
      }
    </div>
    <div class="dialog-actions">
      <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
      <button type="button" class="btn btn-primary" (click)="ref.close(selected())">{{ data.confirm ?? 'Guardar' }}</button>
    </div>
  `,
})
export class GroupPickerDialog {
  protected readonly data = inject<GroupPickerData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<Set<string>>);
  protected readonly selected = signal(new Set(this.data.initial ?? []));

  protected toggle(id: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
}

export interface DateTimeData {
  title: string;
  /** 'datetime': fecha y hora (no futuras). 'time': solo la hora, sobre el día de `base`. */
  mode: 'datetime' | 'time';
  initial: number;
  /** Para 'time': inicio de la sesión. Si la hora queda antes, se asume el día siguiente. */
  base?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

@Component({
  template: `
    <form (submit)="$event.preventDefault(); accept()">
      <h2 class="dialog-title">{{ data.title }}</h2>
      @if (data.mode === 'datetime') {
        <input class="input" type="datetime-local" [max]="max" [value]="value()" (input)="value.set($any($event.target).value)" required />
      } @else {
        <input class="input" type="time" [value]="value().slice(11)" (input)="value.set(value().slice(0, 11) + $any($event.target).value)" required />
      }
      <div class="dialog-actions">
        <button type="button" class="btn btn-text" (click)="ref.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Aceptar</button>
      </div>
    </form>
  `,
})
export class DateTimeDialog {
  protected readonly data = inject<DateTimeData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef<number>);
  protected readonly max = toLocalInput(Date.now());
  protected readonly value = signal(toLocalInput(this.data.mode === 'time' ? this.data.initial : Math.min(this.data.initial, Date.now())));

  protected accept(): void {
    let ms = new Date(this.value()).getTime();
    if (Number.isNaN(ms)) return;
    if (this.data.mode === 'time' && this.data.base != null) {
      // Hora de fin sobre el día de inicio; si queda antes del inicio, terminó al día siguiente.
      const base = new Date(this.data.base);
      const [h, m] = this.value().slice(11).split(':').map(Number);
      ms = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m).getTime();
      if (ms < this.data.base) ms += 24 * 60 * 60 * 1000;
    }
    this.ref.close(Math.min(ms, Date.now()));
  }
}
