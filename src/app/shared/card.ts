import { Component, ElementRef, booleanAttribute, computed, inject, input } from '@angular/core';

export type CardAccent = 'gold' | 'secondary' | 'cyan' | 'danger' | null;

/**
 * Tarjeta: esquinas en escalón + sombra dura en retro (como el escudo del logo),
 * redondeada con sombra suave en moderno.
 */
@Component({
  selector: 'app-card',
  template: `<div class="frame"><div class="body"><ng-content /></div></div>`,
  host: {
    '[class.clickable]': 'clickable()',
    '[style.--card-accent]': 'accentColor()',
    '[style.--card-pad]': 'padding()',
    '[attr.role]': "clickable() ? 'button' : null",
    '[attr.tabindex]': 'clickable() ? 0 : null',
    '(keydown.enter)': 'activate($event)',
    '(keydown.space)': 'activate($event)',
  },
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .frame {
      height: 100%;
      border: var(--outline-w) solid var(--card-accent, var(--card-outline));
      border-radius: var(--radius);
      background: var(--surface);
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .body {
      height: 100%;
      padding: var(--card-pad, 16px);
    }
    :host(.clickable) {
      cursor: pointer;
    }
    :host(.clickable:hover) .frame {
      border-color: var(--card-accent, var(--primary));
    }

    :host-context([data-style='retro']) {
      --step: polygon(
        8px 0, calc(100% - 8px) 0, calc(100% - 8px) 4px, calc(100% - 4px) 4px, calc(100% - 4px) 8px,
        100% 8px, 100% calc(100% - 8px), calc(100% - 4px) calc(100% - 8px), calc(100% - 4px) calc(100% - 4px),
        calc(100% - 8px) calc(100% - 4px), calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 4px),
        4px calc(100% - 4px), 4px calc(100% - 8px), 0 calc(100% - 8px), 0 8px, 4px 8px, 4px 4px, 8px 4px
      );
      filter: drop-shadow(4px 4px 0 color-mix(in srgb, var(--card-accent, var(--violet)) 55%, transparent));
    }
    :host-context([data-style='retro']) .frame {
      padding: 2px;
      border: 0;
      background: var(--card-accent, var(--plate));
      clip-path: var(--step);
    }
    :host-context([data-style='retro']) .body {
      background: var(--surface);
      clip-path: var(--step);
    }
  `,
})
export class Card {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly accent = input<CardAccent>(null);
  readonly clickable = input(false, { transform: booleanAttribute });
  readonly padding = input('16px');

  protected readonly accentColor = computed(() => {
    const a = this.accent();
    return a ? `var(--${a})` : null;
  });

  /** Enter/espacio en una tarjeta clicable equivale a un clic (solo si el foco está en la tarjeta). */
  protected activate(event: Event): void {
    if (!this.clickable() || event.target !== this.el.nativeElement) return;
    event.preventDefault();
    this.el.nativeElement.click();
  }
}
