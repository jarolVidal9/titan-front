import { Component, computed, inject, input } from '@angular/core';
import { SettingsService } from '../core/settings.service';

/** Foto del ejercicio o un marcador con la inicial. */
@Component({
  selector: 'app-exercise-photo',
  template: `
    @if (photo()) {
      <img [src]="photo()" [alt]="name()" />
    } @else {
      <span [style.font-size.px]="size() * (settings.isRetro() ? 0.32 : 0.42)" aria-hidden="true">{{ initial() }}</span>
    }
  `,
  host: { '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  styles: `
    :host {
      display: grid;
      place-items: center;
      flex: none;
      overflow: hidden;
      border-radius: var(--radius-sm);
      background: var(--primary-soft);
      color: var(--primary);
      font-family: var(--font-display);
      font-weight: 800;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    :host-context([data-style='retro']) {
      border: 2px solid var(--plate);
      background: var(--surface-high);
      color: var(--cyan);
    }
  `,
})
export class ExercisePhoto {
  protected readonly settings = inject(SettingsService);

  readonly photo = input<string | null>(null);
  readonly name = input('');
  readonly size = input(56);

  protected readonly initial = computed(() => (this.name().trim().charAt(0) || '?').toUpperCase());
}
