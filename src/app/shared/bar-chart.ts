import { Component, computed, input, signal } from '@angular/core';

export interface Bar {
  label: string;
  value: number;
  tooltip: string;
}

const W = 320;
const H = 180;
const PAD = { left: 34, right: 6, top: 10, bottom: 24 };

/** Barras en SVG: cuadradas y con rejilla punteada en retro, redondeadas en moderno (vía CSS). */
@Component({
  selector: 'app-bar-chart',
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="ariaLabel()">
      @for (t of ticks(); track t.value) {
        <line class="grid" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" />
        <text class="axis" [attr.x]="pad.left - 6" [attr.y]="t.y + 3" text-anchor="end">{{ t.value }}</text>
      }
      @for (b of bars(); track $index) {
        <rect
          class="bar"
          [class.active]="active() === $index"
          [attr.x]="b.x"
          [attr.y]="b.y"
          [attr.width]="b.w"
          [attr.height]="b.h"
          (pointerenter)="active.set($index)"
          (pointerleave)="active.set(null)"
          (click)="active.set(active() === $index ? null : $index)"
        />
        <text class="axis" [attr.x]="b.x + b.w / 2" [attr.y]="h - 8" text-anchor="middle">{{ b.label }}</text>
      }
    </svg>
    @if (active() != null) {
      @let b = bars()[active()!];
      <div class="tip" [style.left.%]="((b.x + b.w / 2) / w) * 100">{{ b.tooltip }}</div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }
    svg {
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .grid {
      stroke: var(--outline);
      stroke-width: 1;
    }
    .axis {
      fill: var(--muted);
      font-size: 9px;
      font-family: var(--font-number);
    }
    .bar {
      fill: var(--primary);
      rx: 3;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .bar.active {
      opacity: 0.75;
    }
    .tip {
      position: absolute;
      top: -6px;
      transform: translate(-50%, -100%);
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--on-surface);
      color: var(--bg);
      font-size: 12px;
      font-weight: 700;
      white-space: pre;
      text-align: center;
      pointer-events: none;
    }
    :host-context([data-style='retro']) {
      .grid {
        stroke: var(--surface-high);
        stroke-dasharray: 4 4;
      }
      .bar {
        fill: var(--cyan);
        rx: 0;
      }
      .tip {
        border-radius: 0;
        background: var(--surface-high);
        color: var(--gold);
        border: 2px solid var(--cyan);
      }
    }
  `,
})
export class BarChart {
  readonly data = input.required<Bar[]>();
  readonly ariaLabel = input('Gráfica de barras');

  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly active = signal<number | null>(null);

  private readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)) * 1.15);

  protected readonly ticks = computed(() => {
    const max = this.max();
    const step = niceStep(max / 4);
    const out: { value: number; y: number }[] = [];
    for (let v = 0; v < max; v += step) out.push({ value: v, y: this.y(v) });
    return out;
  });

  protected readonly bars = computed(() => {
    const data = this.data();
    const slot = (W - PAD.left - PAD.right) / Math.max(1, data.length);
    const bw = Math.min(18, slot * 0.6);
    return data.map((d, i) => ({
      ...d,
      x: PAD.left + slot * i + (slot - bw) / 2,
      y: this.y(d.value),
      w: bw,
      h: Math.max(0, H - PAD.bottom - this.y(d.value)),
    }));
  });

  private y(v: number): number {
    return H - PAD.bottom - (v / this.max()) * (H - PAD.top - PAD.bottom);
  }
}

/** 1, 2, 5, 10, 20, 50… */
export function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
