import { Dialog } from '@angular/cdk/dialog';
import { createGlobalPositionStrategy } from '@angular/cdk/overlay';
import type { ComponentType } from '@angular/cdk/portal';
import { Injectable, Injector, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  type ChoiceOption,
  ChoiceSheet,
  ConfirmDialog,
  type ConfirmData,
  DateTimeDialog,
  type DateTimeData,
  GroupPickerDialog,
  type GroupPickerData,
  NumberDialog,
  type NumberData,
  PromptDialog,
  type PromptData,
  SecondsDialog,
} from './dialogs';

export interface Toast {
  id: number;
  message: string;
  icon?: string;
  kind?: 'record';
}

@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);
  private nextToast = 0;

  readonly toasts = signal<Toast[]>([]);

  /** Diálogo centrado. Devuelve lo que pase el componente a `close()` (undefined si se cancela). */
  open<R, D = unknown>(component: ComponentType<unknown>, data?: D): Promise<R | undefined> {
    const ref = this.dialog.open<R, D>(component, { data, panelClass: 'dialog-panel', autoFocus: 'first-tabbable' });
    return firstValueFrom(ref.closed);
  }

  /** Hoja que sube desde abajo. */
  sheet<R, D = unknown>(component: ComponentType<unknown>, data?: D, tall = false): Promise<R | undefined> {
    const ref = this.dialog.open<R, D>(component, {
      data,
      panelClass: ['sheet-panel', ...(tall ? ['tall'] : [])],
      positionStrategy: createGlobalPositionStrategy(this.injector).centerHorizontally().bottom('0'),
      autoFocus: 'dialog',
    });
    return firstValueFrom(ref.closed);
  }

  async confirm(data: ConfirmData): Promise<boolean> {
    return (await this.open<boolean>(ConfirmDialog, data)) === true;
  }

  prompt(data: PromptData): Promise<string | undefined> {
    return this.open<string>(PromptDialog, data);
  }

  number(title: string, initial: string, decimal = false): Promise<number | undefined> {
    return this.open<number, NumberData>(NumberDialog, { title, initial, decimal });
  }

  /** Selector de segundos (15 s – 10 min). */
  seconds(initial: number): Promise<number | undefined> {
    return this.open<number>(SecondsDialog, initial);
  }

  choose<T>(title: string, options: ChoiceOption<T>[]): Promise<T | undefined> {
    return this.sheet<T>(ChoiceSheet, { title, options });
  }

  pickGroups(data: GroupPickerData): Promise<Set<string> | undefined> {
    return this.open<Set<string>>(GroupPickerDialog, data);
  }

  dateTime(data: DateTimeData): Promise<number | undefined> {
    return this.open<number>(DateTimeDialog, data);
  }

  toast(message: string, options: { icon?: string; kind?: 'record'; ms?: number } = {}): void {
    const toast: Toast = { id: ++this.nextToast, message, icon: options.icon, kind: options.kind };
    this.toasts.update((list) => [...list.slice(-2), toast]);
    setTimeout(() => this.toasts.update((list) => list.filter((t) => t !== toast)), options.ms ?? 3200);
  }
}
