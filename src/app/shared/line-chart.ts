import { Component, computed, inject, input, signal } from '@angular/core';
import { SettingsService } from '../core/settings.service';
import { niceStep } from './bar-chart';

export interface LinePoint {
  label: string; // eje x
  value: number;
  tooltip: string;
}

const W = 320;
const H = 200;
const PAD = { left: 40, right: 10, top: 12, bottom: 24 };

/** Gráfica de progreso: escalones y puntos cuadrados (retro) o curva suave con gradiente (moderno). */
@Component({
  selector: 'app-line-chart',
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="ariaLabel()">
      <defs>
        <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="area-top" />
          <stop offset="1" class="area-bottom" />
        </linearGradient>
      </defs>
      @for (t of ticks(); track t.value) {
        <line class="grid" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" />
        <text class="axis" [attr.x]="pad.left - 6" [attr.y]="t.y + 3" text-anchor="end">{{ t.label }}</text>
      }
      <path class="area" [attr.d]="areaPath()" fill="url(#area)" />
      <path class="line" [attr.d]="linePath()" />
      @for (p of points(); track $index) {
        @if (p.showLabel) {
          <text class="axis" [attr.x]="p.x" [attr.y]="h - 8" text-anchor="middle">{{ p.label }}</text>
        }
        @if (settings.isRetro()) {
          <rect class="dot" [attr.x]="p.x - 4" [attr.y]="p.y - 4" width="8" height="8" />
        } @else {
          <circle class="dot" [attr.cx]="p.x" [attr.cy]="p.y" r="4" />
        }
        <rect class="hit" [attr.x]="p.x - slot() / 2" y="0" [attr.width]="slot()" [attr.height]="h" (pointerenter)="active.set($index)" (pointerleave)="active.set(null)" (click)="active.set($index)" />
      }
    </svg>
    @if (active() != null) {
      @let p = points()[active()!];
      <div class="tip" [style.left.%]="(p.x / w) * 100" [style.top.%]="(p.y / h) * 100">{{ p.tooltip }}</div>
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
    }
    .axis {
      fill: var(--muted);
      font-size: 9px;
      font-family: var(--font-number);
    }
    .line {
      fill: none;
      stroke: var(--primary);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .area-top {
      stop-color: var(--primary);
      stop-opacity: 0.25;
    }
    .area-bottom {
      stop-color: var(--primary);
      stop-opacity: 0;
    }
    .dot {
      fill: var(--surface);
      stroke: var(--primary);
      stroke-width: 2.5;
    }
    .hit {
      fill: transparent;
      cursor: pointer;
    }
    .tip {
      position: absolute;
      transform: translate(-50%, calc(-100% - 10px));
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
      .line {
        stroke: var(--cyan);
        stroke-linecap: square;
        stroke-linejoin: miter;
      }
      .area-top {
        stop-color: var(--violet);
        stop-opacity: 0.35;
      }
      .area-bottom {
        stop-color: var(--violet);
        stop-opacity: 0.05;
      }
      .dot {
        fill: var(--gold);
        stroke: none;
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
export class LineChart {
  protected readonly settings = inject(SettingsService);

  readonly data = input.required<LinePoint[]>();
  readonly ariaLabel = input('Gráfica de progreso');
  readonly format = input<(v: number) => string>((v) => String(Math.round(v)));

  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly active = signal<number | null>(null);

  private readonly range = computed(() => {
    const values = this.data().map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const pad = Math.abs(max - min) < 1 ? 5 : (max - min) * 0.15;
    return { min: Math.max(0, min - pad), max: max + pad };
  });

  protected readonly slot = computed(() => (W - PAD.left - PAD.right) / Math.max(1, this.data().length - 1));

  protected readonly points = computed(() => {
    const data = this.data();
    const step = Math.max(1, Math.ceil(data.length / 5));
    return data.map((d, i) => ({
      ...d,
      x: PAD.left + (data.length === 1 ? 0 : this.slot() * i),
      y: this.y(d.value),
      showLabel: i % step === 0,
    }));
  });

  protected readonly ticks = computed(() => {
    const { min, max } = this.range();
    const step = niceStep((max - min) / 4);
    const out: { value: number; y: number; label: string }[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push({ value: v, y: this.y(v), label: this.format()(v) });
    return out;
  });

  protected readonly linePath = computed(() => {
    const p = this.points();
    if (!p.length) return '';
    if (this.settings.isRetro()) {
      // Escalones: horizontal hasta el siguiente punto y luego vertical.
      return p.map((pt, i) => (i === 0 ? `M${pt.x},${pt.y}` : `H${pt.x}V${pt.y}`)).join('');
    }
    // Curva suave (Catmull-Rom → Bézier) sin pasarse de los puntos.
    let d = `M${p[0].x},${p[0].y}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] ?? p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] ?? p2;
      const c1y = clampY(p1.y + (p2.y - p0.y) / 6, p1.y, p2.y);
      const c2y = clampY(p2.y - (p3.y - p1.y) / 6, p1.y, p2.y);
      d += `C${p1.x + (p2.x - p0.x) / 6},${c1y} ${p2.x - (p3.x - p1.x) / 6},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  });

  protected readonly areaPath = computed(() => {
    const p = this.points();
    if (!p.length) return '';
    const bottom = H - PAD.bottom;
    return `${this.linePath()}V${bottom}H${p[0].x}Z`;
  });

  private y(v: number): number {
    const { min, max } = this.range();
    return H - PAD.bottom - ((v - min) / (max - min || 1)) * (H - PAD.top - PAD.bottom);
  }
}

const clampY = (v: number, a: number, b: number) => Math.min(Math.max(a, b), Math.max(Math.min(a, b), v));
