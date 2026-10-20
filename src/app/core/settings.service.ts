import { DOCUMENT, Injectable, computed, effect, inject } from '@angular/core';
import { LocalDb } from './db/local-db';

export type AppStyle = 'retro' | 'modern';

/** Ajustes sincronizados (tabla `settings`) y el estilo visual aplicado al documento. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly db = inject(LocalDb);

  readonly style = computed<AppStyle>(() => (this.db.get('settings', 'app_style')?.value === 'retro' ? 'retro' : 'modern'));
  readonly isRetro = computed(() => this.style() === 'retro');
  readonly defaultRestSec = computed(() => Number(this.db.get('settings', 'default_rest_sec')?.value) || 90);

  constructor() {
    const doc = inject(DOCUMENT);
    effect(() => {
      doc.documentElement.dataset['style'] = this.style();
      doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', this.isRetro() ? '#0f0e13' : '#7b2cbf');
      try {
        localStorage.setItem('titan.style', this.style()); // lo lee index.html antes de pintar
      } catch {
        // Sin almacenamiento: solo se pierde el arranque sin parpadeo.
      }
    });
  }

  setStyle(style: AppStyle): void {
    this.db.put('settings', 'app_style', { value: style });
  }

  setDefaultRest(seconds: number): void {
    this.db.put('settings', 'default_rest_sec', { value: String(seconds) });
  }

  /** Texto "gamer" en retro, normal en moderno. */
  shout(retro: string, modern: string): string {
    return this.isRetro() ? retro : modern;
  }
}
