import { MaxId62 } from '../bms/base.ts';
import { niBPM } from './constants.ts';
import { newNote, type Note } from './note.ts';

export interface ChartHeader {
  title: string;
  artist: string;
  genre: string;
  playLevel: string;
  subTitle: string;
  subArtist: string;
  stageFile: string;
  banner: string;
  backBMP: string;
  exRank: string;
  total: string;
  comment: string;
  player: number;
  rank: number;
  difficulty: number;
  lnObj: number;
}

export interface Chart {
  notes: Note[];
  notesTemplate: Note[];
  mColumn: number[];
  measureLength: number[];
  measureBottom: number[];
  greatestVPosition: number;
  hWAV: string[];
  hBMP: string[];
  hBPM: number[];
  hSTOP: number[];
  hBMSCROLL: number[];
  hCOM: (string | undefined)[];
  hCOMNum: number;
  header: ChartHeader;
  expansion: string;
  expansionSplit: string[];
  ghostMode: number;
  base62: boolean;
  fileNameTemplate: string;
  ntInput: boolean;
  randomSource: string | undefined;
}

export type ReadonlyChart = {
  readonly [K in keyof Chart]: Chart[K] extends readonly (infer T)[]
    ? readonly Readonly<T>[]
    : Readonly<Chart[K]>;
};

export interface EditorOptions {
  bpmx1296: boolean;
  stopx1296: boolean;
  bpmChannel08: boolean;
  bmsGridLimit: number;
}

export const defaultEditorOptions: Readonly<EditorOptions> = {
  bpmx1296: false,
  stopx1296: false,
  bpmChannel08: false,
  bmsGridLimit: 192 / 10000,
};

export function headerText(value: string): string {
  const end = value.indexOf('\0');
  return end < 0 ? value : value.slice(0, end);
}

export function defaultHeader(): ChartHeader {
  return {
    title: '',
    artist: '',
    genre: '',
    playLevel: '',
    subTitle: '',
    subArtist: '',
    stageFile: '',
    banner: '',
    backBMP: '',
    exRank: '',
    total: '',
    comment: '',
    player: 0,
    rank: 3,
    difficulty: 0,
    lnObj: 0,
  };
}

export function createChart(): Chart {
  return {
    notes: [newNote(niBPM, -1, 1200000)],
    notesTemplate: [newNote(niBPM, -1, 1200000)],
    mColumn: new Array<number>(1000).fill(0),
    measureLength: new Array<number>(1000).fill(192),
    measureBottom: Array.from({ length: 1000 }, (_, i) => i * 192),
    greatestVPosition: 0,
    hWAV: new Array<string>(MaxId62 + 1).fill(''),
    hBMP: new Array<string>(MaxId62 + 1).fill(''),
    hBPM: new Array<number>(MaxId62 + 1).fill(0),
    hSTOP: new Array<number>(MaxId62 + 1).fill(0),
    hBMSCROLL: new Array<number>(MaxId62 + 1).fill(0),
    hCOM: new Array<string | undefined>(MaxId62 + 1).fill(undefined),
    hCOMNum: 0,
    header: defaultHeader(),
    expansion: '',
    expansionSplit: ['', '', ''],
    ghostMode: 0,
    base62: false,
    fileNameTemplate: '',
    ntInput: true,
    randomSource: undefined,
  };
}
