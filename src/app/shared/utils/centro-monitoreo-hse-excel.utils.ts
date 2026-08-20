export interface CentroMonitoreoHseExcelRow {
  Codigo?: string;
  codigo?: string;
  Inspector?: string;
  inspector?: string;
  Supervisor?: string;
  supervisor?: string;
  Fecha?: string;
  fecha?: string;
  Hora?: string;
  hora?: string;
  Estado?: string;
  estado?: string;
  Puntaje?: string | number;
  puntaje?: string | number;
  Comentario?: string;
  comentario?: string;
  Ubicacion?: string;
  ubicacion?: string;
  Ubicación?: string;
  ubicación?: string;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEET_NAME = 'CentroMonitoreoHSE';
const HEADER_FILL = 'FFD8D8FC';
const MAX_COLUMN_WIDTH = 255;
const MIN_COLUMN_WIDTH = 10;

const HEADERS = [
  '#',
  'Codigo',
  'Inspector',
  'Supervisor',
  'Fecha',
  'Hora',
  'Estado',
  'Puntaje',
  'Comentario',
  'Ubicación',
] as const;

export function createCentroMonitoreoHseExcel(rows: CentroMonitoreoHseExcelRow[]): Blob {
  const dataRows = rows.map((row, index) => [
    String(index + 1),
    normalizeCellValue(getRowValue(row, 'Codigo', 'codigo')),
    normalizeCellValue(getRowValue(row, 'Inspector', 'inspector')),
    normalizeCellValue(getRowValue(row, 'Supervisor', 'supervisor')),
    normalizeCellValue(getRowValue(row, 'Fecha', 'fecha')),
    normalizeCellValue(getRowValue(row, 'Hora', 'hora')),
    normalizeCellValue(getRowValue(row, 'Estado', 'estado')),
    normalizeCellValue(getRowValue(row, 'Puntaje', 'puntaje')),
    normalizeCellValue(getRowValue(row, 'Comentario', 'comentario')),
    normalizeCellValue(getRowValue(row, 'Ubicacion', 'ubicacion', 'Ubicación', 'ubicación')),
  ]);

  const columnWidths = computeColumnWidths(HEADERS, dataRows);

  const xmlFiles = [
    {
      path: '[Content_Types].xml',
      content: buildContentTypesXml(),
    },
    {
      path: '_rels/.rels',
      content: buildRootRelationshipsXml(),
    },
    {
      path: 'xl/workbook.xml',
      content: buildWorkbookXml(SHEET_NAME),
    },
    {
      path: 'xl/_rels/workbook.xml.rels',
      content: buildWorkbookRelationshipsXml(),
    },
    {
      path: 'xl/styles.xml',
      content: buildStylesXml(),
    },
    {
      path: 'xl/worksheets/sheet1.xml',
      content: buildSheetXml(HEADERS, dataRows, columnWidths),
    },
  ];

  const bytes = createZip(xmlFiles);
  return new Blob([bytes], { type: XLSX_MIME });
}

function buildContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" />
</Types>`;
}

function buildRootRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" />
</Relationships>`;
}

function buildWorkbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1" />
  </sheets>
</workbook>`;
}

function buildWorkbookRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" />
</Relationships>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11" />
      <color theme="1" />
      <name val="Calibri" />
      <family val="2" />
    </font>
    <font>
      <b />
      <sz val="11" />
      <color theme="1" />
      <name val="Calibri" />
      <family val="2" />
    </font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none" /></fill>
    <fill><patternFill patternType="gray125" /></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${HEADER_FILL}" /><bgColor indexed="64" /></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF" /><bgColor indexed="64" /></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left /><right /><top /><bottom /><diagonal /></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" />
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">
      <alignment horizontal="center" vertical="center" />
    </xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" />
    </xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" />
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0" />
  </cellStyles>
</styleSheet>`;
}

function buildSheetXml(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  columnWidths: readonly number[]
): string {
  const totalRows = rows.length + 1;
  const lastColumnLetter = columnLetter(headers.length);
  const dimensionRef = `A1:${lastColumnLetter}${totalRows}`;

  const colsXml = columnWidths
    .map((width, index) => {
      const column = index + 1;
      return `    <col min="${column}" max="${column}" width="${width.toFixed(2)}" customWidth="1" />`;
    })
    .join('\n');

  const headerCells = headers
    .map((value, index) => buildDataCell(columnLetter(index + 1), 1, value, 1))
    .join('');

  const xmlRows = rows
    .map((row, rowIndex) => {
      const cells = headers
        .map((_, colIndex) => buildDataCell(columnLetter(colIndex + 1), rowIndex + 2, row[colIndex] ?? '', 2))
        .join('');
      return `    <row r="${rowIndex + 2}">${cells}</row>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensionRef}" />
  <sheetViews>
    <sheetView workbookViewId="0" showGridLines="0" />
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15" />
  <cols>
${colsXml}
  </cols>
  <sheetData>
    <row r="1" spans="1:${headers.length}" ht="18" customHeight="1">${headerCells}</row>
${xmlRows}
  </sheetData>
</worksheet>`;
}

function buildDataCell(column: string, row: number, value: string, styleIndex = 0): string {
  const styleAttr = styleIndex > 0 ? ` s="${styleIndex}"` : '';
  if (value === '' || value === null || value === undefined) {
    return `<c r="${column}${row}"${styleAttr} />`;
  }
  return `<c r="${column}${row}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function normalizeCellValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function getRowValue(row: CentroMonitoreoHseExcelRow, ...keys: Array<keyof CentroMonitoreoHseExcelRow | string>): string | number | null | undefined {
  for (const key of keys) {
    const value = (row as Record<string, unknown>)[String(key)];
    if (value !== undefined && value !== null && value !== '') {
      return value as string | number;
    }
  }
  return '';
}

function computeColumnWidths(headers: readonly string[], rows: readonly (readonly string[])[]): number[] {
  return headers.map((header, index) => {
    const values = [header, ...rows.map((row) => row[index] ?? '')];
    const maxLength = values.reduce((max, value) => Math.max(max, visibleLength(value)), 0);

    // La anchura de Excel no coincide 1:1 con el número de caracteres, por eso
    // aplicamos un pequeño margen para que enlaces y textos largos entren mejor.
    const adjusted = Math.ceil(maxLength * 1.15) + 2;

    return clamp(adjusted, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH);
  });
}

function visibleLength(value: string): number {
  return String(value).replace(/\s+/g, ' ').trim().length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnLetter(index: number): string {
  let value = index;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

type ZipFileEntry = {
  path: string;
  content: string;
};

function createZip(entries: ZipFileEntry[]): Uint8Array {
  const encodedEntries = entries.map((entry) => ({
    path: entry.path,
    pathBytes: encodeUtf8(entry.path),
    contentBytes: encodeUtf8(entry.content),
  }));

  const fileParts: Uint8Array[] = [];
  const centralDirectoryParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of encodedEntries) {
    const crc = crc32(entry.contentBytes);
    const localHeader = new Uint8Array(30 + entry.pathBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, entry.contentBytes.length);
    writeUint32(localView, 22, entry.contentBytes.length);
    writeUint16(localView, 26, entry.pathBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(entry.pathBytes, 30);

    fileParts.push(localHeader, entry.contentBytes);

    const centralHeader = new Uint8Array(46 + entry.pathBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, entry.contentBytes.length);
    writeUint32(centralView, 24, entry.contentBytes.length);
    writeUint16(centralView, 28, entry.pathBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(entry.pathBytes, 46);

    centralDirectoryParts.push(centralHeader);

    offset += localHeader.length + entry.contentBytes.length;
  }

  const centralDirectory = concatUint8Arrays(centralDirectoryParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, encodedEntries.length);
  writeUint16(endView, 10, encodedEntries.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  return concatUint8Arrays([...fileParts, centralDirectory, endRecord]);
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(totalLength);
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }
  return output;
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
