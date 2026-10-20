import { Component, input, output } from '@angular/core';
import { Card } from './card';

/** Valor grande con − / + a los lados; tocar el número permite escribirlo. */
@Component({
  selector: 'app-set-stepper',
  imports: [Card],
  template: `
    <app-card padding="8px">
      <div class="row">
        <button type="button" class="icon-btn tonal" (click)="minus.emit()" [attr.aria-label]="'Menos ' + label()">
          <span aria-hidden="true" class="icon">remove</span>
        </button>
        <button type="button" class="value grow" (click)="edit.emit()" [attr.aria-label]="'Escribir ' + label()">
          <span class="tiny muted">{{ label() }}</span>
          <span class="num">{{ value() }}</span>
        </button>
        <button type="button" class="icon-btn tonal" (click)="plus.emit()" [attr.aria-label]="'Más ' + label()">
          <span aria-hidden="true" class="icon">add</span>
        </button>
      </div>
    </app-card>
  `,
  styles: `
    .value {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px;
      border: 0;
      background: none;
      cursor: text;
      .num {
        font-size: 36px;
        line-height: 1.15;
      }
    }
    :host-context([data-style='retro']) .num {
      color: var(--cyan);
    }
  `,
})
export class SetStepper {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly minus = output();
  readonly plus = output();
  readonly edit = output();
}
