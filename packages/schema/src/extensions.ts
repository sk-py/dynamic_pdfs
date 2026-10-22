import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { DynamicMatrixTable, VariableChip, withCellStyle, withRepeatKey } from './nodes';

/**
 * ONE schema for editor and backend. If a node/attribute isn't in here, ProseMirror silently drops it,
 * so editor and server must never define their own copies.
 */
export function createExtensions(opts: { resizableTables?: boolean } = {}) {
  return [
    StarterKit,
    Image,
    Table.configure({ resizable: !!opts.resizableTables }),
    withRepeatKey(TableRow),
    withCellStyle(TableHeader),
    withCellStyle(TableCell),
    VariableChip,
    DynamicMatrixTable,
  ];
}
