import { Location } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

/** Encabezado de página con botón de volver y acciones proyectadas. */
@Component({
  selector: 'app-page-header',
  template: `
    <header class="page-header">
      @if (back()) {
        <button type="button" class="icon-btn" aria-label="Volver" (click)="goBack()">
          <span aria-hidden="true" class="icon">arrow_back</span>
        </button>
      }
      <h1>{{ title() }}</h1>
      <ng-content />
    </header>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class PageHeader {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly title = input.required<string>();
  /** Ruta a la que volver si no hay historial (p. ej. al abrir un enlace directo). */
  readonly back = input<string | null>(null);

  goBack(): void {
    if (history.state?.navigationId > 1) this.location.back();
    else void this.router.navigateByUrl(this.back()!);
  }
}
