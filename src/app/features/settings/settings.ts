import { DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LocalDb } from '../../core/db/local-db';
import { RestTimerService } from '../../core/rest-timer.service';
import { type AppStyle, SettingsService } from '../../core/settings.service';
import { AuthService } from '../../core/sync/auth.service';
import { SyncService } from '../../core/sync/sync.service';
import { formatDuration, formatTime, shortDateYear } from '../../core/utils/format';
import { Card } from '../../shared/card';
import { PageHeader } from '../../shared/page-header';
import { SectionTitle } from '../../shared/section-title';
import { UiService } from '../../shared/ui.service';
import { BackupError, backupFileName, createBackup, download, readBackup } from './backup';

const REST_PRESETS = [60, 90, 120];

/** Confirmación fuerte: hay que escribir ELIMINAR para habilitar el botón. */
@Component({
  template: `
    <div class="center"><span aria-hidden="true" class="icon lg danger-text">warning</span></div>
    <h2 class="dialog-title center">¿Eliminar todos los datos?</h2>
    <p style="margin: 0">
      Se borran la biblioteca, las fotos, las rutinas, todo el historial, los récords y la XP{{ cloud ? ', también en tu cuenta y en tus otros dispositivos' : '' }}.
      Esto no se puede deshacer.
    </p>
    <p>Si quieres conservar algo, exporta un backup antes.</p>
    <p style="margin-bottom: 8px">Escribe <strong>{{ word }}</strong> para confirmar:</p>
    <input class="input" autocomplete="off" autocapitalize="characters" [placeholder]="word" (input)="text.set($any($event.target).value)" />
    <div class="dialog-actions">
      <button type="button" class="btn btn-text" (click)="ref.close(false)">Cancelar</button>
      <button type="button" class="btn btn-danger" [disabled]="text().trim().toUpperCase() !== word" (click)="ref.close(true)">Eliminar todo</button>
    </div>
  `,
})
class DeleteAllDialog {
  protected readonly ref = inject(DialogRef<boolean>);
  protected readonly cloud = inject(AuthService).loggedIn();
  protected readonly word = 'ELIMINAR';
  protected readonly text = signal('');
}

@Component({
  imports: [PageHeader, Card, SectionTitle, RouterLink],
  template: `
    <div class="page">
      <app-page-header title="Ajustes" />

      <app-section-title text="Cuenta y sincronización" />
      <app-card>
        @if (auth.token()) {
          <div class="row">
            <span aria-hidden="true" class="icon secondary">person</span>
            <div class="grow">
              <div class="title ellipsis">{{ auth.user()?.email }}</div>
              <div class="small" [class.muted]="!problem()" [class.danger-text]="problem()">{{ syncText() }}</div>
            </div>
          </div>
          <div class="row mt-16" style="flex-wrap: wrap">
            @if (auth.expired()) {
              <a class="btn btn-primary" routerLink="/login"><span aria-hidden="true" class="icon">login</span> Volver a entrar</a>
            } @else {
              <button type="button" class="btn btn-outline" [disabled]="sync.status() === 'syncing'" (click)="sync.syncNow()">
                <span aria-hidden="true" class="icon">sync</span> Sincronizar ahora
              </button>
            }
            <button type="button" class="btn btn-text" (click)="logout()"><span aria-hidden="true" class="icon">logout</span> Cerrar sesión</button>
          </div>
        } @else {
          <p style="margin: 0 0 12px">
            Estás usando TITAN sin cuenta: tus datos viven solo en este navegador. Con una cuenta se respaldan y se sincronizan con tus otros dispositivos.
          </p>
          <a class="btn btn-primary" routerLink="/login"><span aria-hidden="true" class="icon">login</span> Entrar o crear cuenta</a>
        }
      </app-card>

      <app-section-title text="Estilo visual" />
      <div class="styles">
        @for (o of styles; track o.id) {
          <app-card clickable [accent]="settings.style() === o.id ? 'gold' : null" padding="12px" (click)="settings.setStyle(o.id)">
            <img src="branding/emblem-192.png" alt="" [class.pixel]="o.id === 'retro'" />
            <div class="style-name" [class.retro]="o.id === 'retro'">{{ o.title }}</div>
            <div class="tiny muted">{{ o.subtitle }}</div>
            @if (settings.style() === o.id) {
              <span aria-hidden="true" class="icon gold filled mt-8">check_circle</span>
            }
          </app-card>
        }
      </div>

      <app-section-title text="Temporizador de descanso" />
      <div class="chips">
        @for (s of restPresets; track s) {
          <button type="button" class="chip" [class.selected]="settings.defaultRestSec() === s" (click)="settings.setDefaultRest(s)">{{ format(s) }}</button>
        }
        <button type="button" class="chip" [class.selected]="customRest()" (click)="pickRest()">{{ customRest() ? format(settings.defaultRestSec()) : 'Otro' }}</button>
      </div>
      <p class="small muted">Es el descanso global. Cada ejercicio puede tener el suyo propio en la biblioteca.</p>
      @if (notificationsSupported) {
        <button type="button" class="list-item" (click)="askNotifications()">
          <span aria-hidden="true" class="icon">notifications_active</span>
          <span class="grow">
            <span class="title" style="display: block">Avisos al terminar el descanso</span>
            <span class="small muted">{{ notificationText() }}</span>
          </span>
        </button>
      }

      <app-section-title text="Catálogos" />
      <a class="list-item" routerLink="/settings/groups" style="text-decoration: none">
        <span aria-hidden="true" class="icon">accessibility_new</span><span class="grow title">Grupos musculares</span><span aria-hidden="true" class="icon">chevron_right</span>
      </a>
      <a class="list-item" routerLink="/settings/rep-types" style="text-decoration: none">
        <span aria-hidden="true" class="icon">repeat</span><span class="grow title">Tipos de repetición</span><span aria-hidden="true" class="icon">chevron_right</span>
      </a>

      <app-section-title text="Copia de seguridad" />
      <p class="small muted" style="margin-top: 0">
        Descarga un archivo con todos tus datos (incluidas las fotos) o restaura uno anterior. Sirve también para pasar datos entre la app y la web.
      </p>
      <div class="stack">
        <button type="button" class="btn btn-primary block" (click)="exportBackup()"><span aria-hidden="true" class="icon">upload_file</span> Exportar backup</button>
        <button type="button" class="btn btn-outline block" (click)="file.click()"><span aria-hidden="true" class="icon">download</span> Importar backup</button>
        <input #file type="file" accept="application/json,.json" hidden (change)="importBackup($event)" />
      </div>

      <app-section-title text="Zona de peligro" />
      <button type="button" class="btn btn-outline danger block" (click)="deleteAll()"><span aria-hidden="true" class="icon">delete_forever</span> Eliminar todos los datos</button>

      <app-section-title text="Acerca de" />
      <div class="about">
        <img src="branding/emblem-192.png" alt="" width="96" height="96" />
        <p class="muted">TITAN · funciona sin conexión</p>
      </div>
    </div>
  `,
  styles: `
    .styles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      img {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        &.pixel {
          border-radius: 0;
          image-rendering: pixelated;
        }
      }
    }
    .style-name {
      margin: 8px 0 4px;
      font-weight: 700;
      font-size: 16px;
      &.retro {
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        line-height: 1.5;
      }
    }
    .about {
      display: flex;
      flex-direction: column;
      align-items: center;
      p {
        margin: 4px 0 0;
      }
    }
  `,
})
export default class SettingsPage {
  protected readonly settings = inject(SettingsService);
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  private readonly db = inject(LocalDb);
  private readonly timer = inject(RestTimerService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  protected readonly restPresets = REST_PRESETS;
  protected readonly format = formatDuration;
  protected readonly styles: { id: AppStyle; title: string; subtitle: string }[] = [
    { id: 'modern', title: 'Moderno', subtitle: 'Limpio, claro u oscuro según el sistema' },
    { id: 'retro', title: 'Retro 16-bit', subtitle: 'Pixel art, neón y sonidos 8-bit' },
  ];
  protected readonly notificationsSupported = 'Notification' in window;
  private readonly permission = signal(this.notificationsSupported ? Notification.permission : 'denied');

  protected readonly customRest = computed(() => !REST_PRESETS.includes(this.settings.defaultRestSec()));
  protected readonly problem = computed(() => this.auth.expired() || this.sync.status() === 'error');
  protected readonly syncText = computed(() => {
    if (this.auth.expired()) return 'Tu sesión venció. Tus datos siguen aquí; vuelve a entrar para sincronizar.';
    const pending = this.db.pendingCount();
    const status = this.sync.status();
    if (status === 'syncing') return 'Sincronizando…';
    if (status === 'offline') return `Sin conexión${pending ? ` · ${pending} cambios por subir` : ''}`;
    if (status === 'error') return this.sync.lastError() ?? 'Error al sincronizar';
    const last = this.sync.lastSyncAt();
    if (pending) return `${pending} cambios por subir`;
    return last ? `Sincronizado · ${shortDateYear(last)}, ${formatTime(last)}` : 'Sincronizado';
  });
  protected readonly notificationText = computed(() =>
    ({ granted: 'Activados', denied: 'Bloqueados en el navegador', default: 'Toca para permitirlos' })[this.permission()],
  );

  protected async pickRest(): Promise<void> {
    const s = await this.ui.seconds(this.settings.defaultRestSec());
    if (s) this.settings.setDefaultRest(s);
  }

  protected async askNotifications(): Promise<void> {
    this.permission.set(await Notification.requestPermission());
  }

  protected async logout(): Promise<void> {
    const pending = this.db.pendingCount();
    const ok = await this.ui.confirm({
      title: '¿Cerrar sesión?',
      message: pending
        ? `Hay ${pending} cambios que aún no se subieron y se perderán. Sincroniza antes si puedes.`
        : 'Se borran los datos de este navegador. Siguen guardados en tu cuenta.',
      confirm: 'Cerrar sesión',
      danger: pending > 0,
    });
    if (!ok) return;
    this.timer.skip();
    await this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  protected async exportBackup(): Promise<void> {
    await this.db.flushed();
    download(createBackup(this.db.exportAll()), backupFileName());
  }

  protected async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const backup = await readBackup(file);
      const ok = await this.ui.confirm({
        title: '¿Reemplazar todos los datos?',
        message: `Backup del ${shortDateYear(backup.createdAt)}, ${formatTime(backup.createdAt)}.\n\nSe reemplazan la biblioteca, rutinas, historial y fotos actuales.`,
        confirm: 'Importar',
        danger: true,
      });
      if (!ok) return;
      this.timer.skip();
      this.db.replaceAll(backup.records);
      this.ui.toast('Backup importado');
    } catch (e) {
      this.ui.toast(e instanceof BackupError ? e.message : `Error al importar: ${e}`);
    }
  }

  protected async deleteAll(): Promise<void> {
    if (!(await this.ui.open<boolean>(DeleteAllDialog))) return;
    this.timer.skip();
    this.db.replaceAll();
    this.ui.toast('Todos los datos fueron eliminados');
  }
}
