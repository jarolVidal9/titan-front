import { DIALOG_DATA } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import type { Row } from '../../core/db/schema';

/** Explicación de los tipos de serie base (clave = nombre normalizado). */
const EXPLANATIONS: Record<string, [que: string, como: string]> = {
  normal: [
    'Repeticiones a ritmo controlado y con el recorrido completo: más o menos 1–2 s subiendo y 2 s bajando.',
    'Anota las reps y el peso. Es el tipo por defecto.',
  ],
  lenta: [
    'Repeticiones a propósito más lentas, por ejemplo 3–4 s bajando y 2–3 s subiendo. El músculo pasa más tiempo bajo tensión, así que normalmente se usa menos peso.',
    'Anota las reps y el peso como en una serie normal.',
  ],
  isometrica: [
    'Mantienes una posición sin moverte: plancha, sentadilla contra la pared, colgarte de la barra o sostener el peso a mitad del recorrido.',
    'Se registra en SEGUNDOS que aguantaste (no en repeticiones), con el peso si usas alguno.',
  ],
  parcial: [
    'Repeticiones con solo una parte del recorrido (por ejemplo, la mitad de abajo). Se usan al final de una serie, cuando ya no salen completas, o para trabajar el punto más difícil del movimiento.',
    'Anota cuántas parciales hiciste y el peso.',
  ],
  negativa: [
    'Te enfocas en la bajada (fase excéntrica), haciéndola muy lenta: 3–5 s o más. A veces se usa más peso del que puedes subir solo y alguien te ayuda a subirlo.',
    'Anota las reps y el peso que controlaste al bajar.',
  ],
  'al fallo': [
    'Haces repeticiones hasta que no puedes completar ni una más con buena técnica.',
    'Anota las reps que lograste completar y el peso.',
  ],
  dropset: [
    'Al terminar una serie (cerca del fallo), bajas el peso entre un 20 y un 30% y sigues sin descansar. Se puede repetir varias veces.',
    'Registra cada bajada de peso como una serie Dropset aparte, con sus reps y su peso.',
  ],
  escalera: [
    'Escalera descendente: haces 7 reps, descansas unos segundos, luego 6, 5, 4, 3, 2 y 1, normalmente con el mismo peso. Se puede empezar en otro número (ej. 10→1).',
    'Anota el TOTAL de reps de la escalera (7→1 = 28) y el peso, como una sola serie.',
  ],
  calentamiento: [
    'Series ligeras antes de las pesadas para preparar músculos y articulaciones.',
    'Anótalas si quieres llevar registro: NO cuentan para récords, gráficas ni XP.',
  ],
};

export function explainRepType(t: Row<'rep_types'>): [string, string] {
  const known = EXPLANATIONS[t.nameNorm];
  if (known) return known;
  const counts = t.countsForStats ? '' : ' No cuenta para récords.';
  return ['Tipo de serie creado por ti.', t.measure === 'seconds' ? `Se registra en segundos.${counts}` : `Se registra en repeticiones y peso.${counts}`];
}

/** Hoja con la explicación de uno o varios tipos de serie. */
@Component({
  template: `
    @if (types.length > 1) {
      <h2 class="dialog-title" style="margin-bottom: 4px">Tipos de serie</h2>
    }
    @for (t of types; track t.id) {
      @if (!$first) {
        <div class="divider" style="margin: 20px 0"></div>
      }
      <div class="row">
        <span aria-hidden="true" class="icon gold">{{ t.measure === 'seconds' ? 'timer' : 'repeat' }}</span>
        <span class="title grow">{{ t.name }}</span>
      </div>
      <p style="margin: 8px 0">{{ explain(t)[0] }}</p>
      <div class="row top">
        <span aria-hidden="true" class="icon sm secondary">edit_note</span>
        <span class="muted small">{{ explain(t)[1] }}</span>
      </div>
    }
  `,
})
export class RepTypeInfoSheet {
  protected readonly types = inject<Row<'rep_types'>[]>(DIALOG_DATA);
  protected readonly explain = explainRepType;
}
