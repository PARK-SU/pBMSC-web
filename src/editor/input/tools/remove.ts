import { c10toId, cIdto10 } from '../../../core/bms/base.ts';
import { redoRemoveNote, UndoChainBuilder } from '../../../core/edit/chain.ts';
import { intDiv } from '../../../core/vb.ts';
import {
  calculateTotalPlayableNotes,
  draftAddUndo,
  draftRemoveNote,
  hitOptions,
  type InputDraft,
  type PanelMouseEvent,
} from '../events.ts';
import { topNoteAt, type PanelGeometry } from '../hit.ts';

export function deselectOrRemove(d: InputDraft, e: PanelMouseEvent, g: PanelGeometry): void {
  const chart = d.chart;
  d.edit.kMouseOver = -1;
  d.drag.selectedNotes = [];

  if (d.drag.tempFirstMouseDown) return;

  const xI1 = topNoteAt(chart, d.view, hitOptions(d), g, e.x, e.y, 1);
  if (xI1 >= 1) {
    const note = chart.notes[xI1]!;
    if (e.modifiers.shift) {
      d.session.currentWav =
        cIdto10(c10toId(intDiv(note.value, 10000), chart.base62), chart.base62) - 1;
    } else {
      const b = new UndoChainBuilder();
      redoRemoveNote(b, note);
      draftRemoveNote(d, xI1);

      draftAddUndo(d, b.undoHead(), b.redoHead());
      d.redraw = true;
    }
  }

  calculateTotalPlayableNotes(d);
}
