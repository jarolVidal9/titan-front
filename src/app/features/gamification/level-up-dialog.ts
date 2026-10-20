import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { SettingsService } from '../../core/settings.service';

const COLORS = ['var(--cyan)', 'var(--gold)', 'var(--violet-light)'];

/** Destello: píxeles cuadrados (retro) o confeti suave (moderno). */
function particles() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 28 }, (_, i) => {
    const angle = rnd() * 2 * Math.PI;
    const dist = 40 + rnd() * 90;
    return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, color: COLORS[i % 3] };
  });
}

@Component({
  template: `
    <div class="burst" aria-hidden="true">
      @for (p of particles; track $index) {
        <i [style.--dx.px]="p.dx" [style.--dy.px]="p.dy" [style.background]="p.color"></i>
      }
      <img src="branding/emblem-192.png" alt="" />
    </div>
    <p class="headline">{{ settings.shout('LEVEL UP!', '¡Subiste de nivel!') }}</p>
    <p class="title center">{{ settings.isRetro() ? 'LV ' + level : 'Ahora eres nivel ' + level }}</p>
    <button type="button" class="btn btn-primary block mt-16" (click)="ref.close()">{{ settings.shout('Continuar', 'Seguir') }}</button>
  `,
  styles: `
    .burst {
      position: relative;
      display: grid;
      place-items: center;
      height: 150px;
    }
    img {
      width: 96px;
      height: 96px;
      animation: pop 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    i {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      animation: fly 1.4s ease-out both;
    }
    :host-context([data-style='retro']) {
      i {
        border-radius: 0;
        width: 6px;
        height: 6px;
      }
      img {
        image-rendering: pixelated;
      }
    }
    .headline {
      margin: 12px 0 4px;
      text-align: center;
      font-family: var(--font-display);
      font-size: calc(26px * var(--display-scale) * 1.3);
      font-weight: 800;
      color: var(--gold);
    }
    @keyframes pop {
      from {
        transform: scale(0);
      }
    }
    @keyframes fly {
      from {
        transform: translate(-50%, -50%);
        opacity: 1;
      }
      to {
        transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy)));
        opacity: 0.2;
      }
    }
  `,
})
export class LevelUpDialog {
  protected readonly settings = inject(SettingsService);
  protected readonly ref = inject(DialogRef);
  protected readonly level = inject<number>(DIALOG_DATA);
  protected readonly particles = particles();
}
