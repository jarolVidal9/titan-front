import { Location } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { PageHeader } from '../../shared/page-header';
import { ExerciseForm } from './exercise-form';

/** `/library/new?name=…` y `/library/:id/edit`. */
@Component({
  imports: [PageHeader, ExerciseForm],
  template: `
    <div class="page">
      <app-page-header [title]="id() ? 'Editar ejercicio' : 'Nuevo ejercicio'" back="/library" />
      <app-exercise-form [exerciseId]="id() ?? null" [initialName]="name() ?? null" (saved)="done()" />
    </div>
  `,
})
export default class ExerciseFormPage {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly name = input<string>(); // query param

  protected done(): void {
    if (history.state?.navigationId > 1) this.location.back();
    else void this.router.navigateByUrl('/library');
  }
}
