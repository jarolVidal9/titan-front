import { Component, inject, input } from '@angular/core';
import { SettingsService } from '../core/settings.service';

@Component({
  selector: 'app-section-title',
  template: `
    <h2>{{ settings.isRetro() ? '> ' + text().toUpperCase() : text() }}</h2>
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 24px 0 10px;
    }
    h2 {
      flex: 1;
      font-family: var(--font-body);
      font-size: 17px;
      font-weight: 700;
    }
    :host-context([data-style='retro']) h2 {
      font-family: 'Press Start 2P', monospace;
      font-size: 11px;
      line-height: 1.6;
      color: var(--gold);
    }
  `,
})
export class SectionTitle {
  protected readonly settings = inject(SettingsService);
  readonly text = input.required<string>();
}
