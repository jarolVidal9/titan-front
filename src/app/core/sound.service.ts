import { Injectable, inject } from '@angular/core';
import { SettingsService } from './settings.service';

export type Sfx = 'rest_end' | 'pr' | 'levelup' | 'tap';

/** Sonidos: 8-bit en retro, suaves en moderno. */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly settings = inject(SettingsService);
  private current?: HTMLAudioElement;

  play(sfx: Sfx): void {
    try {
      this.current?.pause();
      this.current = new Audio(`sounds/${this.settings.style()}_${sfx}.wav`);
      void this.current.play().catch(() => {});
    } catch {
      // El navegador puede bloquear el audio sin interacción previa.
    }
  }

  vibrate(pattern: number[] = [400, 150, 400, 150, 700]): void {
    navigator.vibrate?.(pattern);
  }
}
