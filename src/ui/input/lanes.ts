import { nEnabled, nTitle, updateColumnsX, type EditorView } from '../../editor/view.ts';

export type LanePreset = 'theme' | 'SP' | 'DP' | 'PMS' | 'all';

export function lanePreset(view: EditorView, preset: Exclude<LanePreset, 'theme'>): EditorView {
  const visible = (i: number): boolean =>
    preset === 'all' ||
    i <= 3 ||
    i === 27 ||
    (preset === 'SP'
      ? i >= 4 && i <= 13
      : preset === 'DP'
        ? i >= 4 && i <= 22
        : i >= 14 && i <= 22);
  if (view.columns.every((c, i) => c.isVisible === visible(i))) return view;
  return updateColumnsX({
    ...view,
    columns: view.columns.map((column, i) => ({
      ...column,
      isVisible: visible(i),
    })),
  });
}

export function visibleLanes(view: EditorView): { index: number; title: string }[] {
  const lanes: { index: number; title: string }[] = [];
  for (let i = 1; i <= view.gColumns; i++) {
    if (nEnabled(view, i)) lanes.push({ index: i, title: nTitle(view, i) });
  }
  return lanes;
}
