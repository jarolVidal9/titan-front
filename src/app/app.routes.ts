import { inject } from '@angular/core';
import { type CanActivateFn, Router, type Routes } from '@angular/router';
import { AuthService } from './core/sync/auth.service';

/** Hay que entrar con una cuenta o elegir usar la app sin cuenta. */
const appGuard: CanActivateFn = () => inject(AuthService).canUseApp() || inject(Router).createUrlTree(['/login']);

export const routes: Routes = [
  { path: 'login', title: 'Entrar · TITAN', loadComponent: () => import('./features/auth/login') },
  {
    path: '',
    canActivate: [appGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      { path: 'today', title: 'Hoy · TITAN', loadComponent: () => import('./features/today/today') },
      { path: 'session/:id', title: 'Sesión · TITAN', loadComponent: () => import('./features/session/session') },
      { path: 'session/:id/exercise/:seId', title: 'Series · TITAN', loadComponent: () => import('./features/session/exercise-log') },
      { path: 'session/:id/superset/:group', title: 'Biserie · TITAN', loadComponent: () => import('./features/session/superset-log') },
      { path: 'routine', title: 'Rutina · TITAN', loadComponent: () => import('./features/routine/routine') },
      {
        path: 'routine/:weekday',
        title: 'Rutina · TITAN',
        loadComponent: () => import('./features/routine/routine-day'),
        canDeactivate: [(page: { canLeave(): boolean | Promise<boolean> }) => page.canLeave()],
      },
      { path: 'library', title: 'Biblioteca · TITAN', loadComponent: () => import('./features/library/library') },
      { path: 'library/new', title: 'Nuevo ejercicio · TITAN', loadComponent: () => import('./features/library/exercise-form-page') },
      { path: 'library/:id/edit', title: 'Editar ejercicio · TITAN', loadComponent: () => import('./features/library/exercise-form-page') },
      { path: 'exercise/:id', title: 'Historial · TITAN', loadComponent: () => import('./features/history/exercise-history') },
      { path: 'history', title: 'Historial · TITAN', loadComponent: () => import('./features/history/history') },
      { path: 'settings', title: 'Ajustes · TITAN', loadComponent: () => import('./features/settings/settings') },
      { path: 'settings/groups', title: 'Grupos musculares · TITAN', loadComponent: () => import('./features/settings/muscle-groups') },
      { path: 'settings/rep-types', title: 'Tipos de repetición · TITAN', loadComponent: () => import('./features/settings/rep-types') },
    ],
  },
  { path: '**', redirectTo: 'today' },
];
