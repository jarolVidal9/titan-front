import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <span aria-hidden="true" class="icon lg">{{ icon() }}</span>
    <p class="title">{{ title() }}</p>
    @if (message()) {
      <p class="muted">{{ message() }}</p>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      text-align: center;
    }
    .icon {
      font-size: 56px;
      color: var(--primary);
      margin-bottom: 8px;
    }
    :host-context([data-style='retro']) .icon {
      color: var(--cyan);
    }
    p {
      margin: 0;
      max-width: 420px;
    }
    ::ng-deep app-empty-state > .btn {
      margin-top: 12px;
    }
  `,
})
export class EmptyState {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly message = input<string>();
}
