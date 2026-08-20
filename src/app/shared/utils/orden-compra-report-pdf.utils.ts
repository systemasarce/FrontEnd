import { formatDisplayDate } from './date.utils';

export interface OrdenCompraReporteDetallePdf {
  item: number;
  cantidad: number;
  unidad: string;
  especificacion: string;
  centroCosto: string;
  precioUnitario: number;
  importe: number;
}

export interface OrdenCompraReportePdfData {
  ordenCompraId: number;
  correlativo?: string;
  tipoServicio?: string;
  monedaAbreviacion?: string;
  fecha: string;
  proveedor: string;
  ruc: string;
  banco: string;
  cuenta: string;
  cci: string;
  contacto: string;
  email: string;
  direccionProveedor: string;
  referenciaObra: string;
  observaciones: string;
  fechaRequerida: string;
  pedido: string;
  direccionEnvio: string;
  solicitadoPor: string;
  condicionPago: string;
  subtotal: number;
  igv: number;
  total: number;
  detraccionDescripcion: string;
  montoDetraccion: number;
  totalPagar: number;
  detalle: OrdenCompraReporteDetallePdf[];
}

export interface OrdenCompraReportePdfOptions {
  logoBytes?: Uint8Array;
  headerImageBytes?: Uint8Array;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_LEFT = 28;
const PAGE_RIGHT = PAGE_WIDTH - 28;
const PAGE_TOP = 28;
const ROW_HEIGHT = 24;
const ROW_MAX_HEIGHT = 42;
const TABLE_HEADER_HEIGHT = 24;
const FIRST_PAGE_TABLE_TOP = 438;
const CONTINUATION_PAGE_TABLE_TOP = 36;
const PAGE_BOTTOM_MARGIN = 30;
const SIGNATURE_EXTRA_OFFSET = PAGE_HEIGHT * 0.05;
const HEADER_IMAGE_WIDTH = 109;
const HEADER_IMAGE_HEIGHT = 54;

export function createOrdenCompraReportPdf(report: OrdenCompraReportePdfData, options: OrdenCompraReportePdfOptions = {}): Blob {
  const pages = paginateDetailRows(report);
  const pageContents = pages.map((page, index) =>
    buildPageContent(report, page, index + 1, pages.length, options.logoBytes, options.headerImageBytes)
  );

  return new Blob([buildPdfDocument(pageContents, options.logoBytes, options.headerImageBytes)], { type: 'application/pdf' });
}

export function mapOrdenCompraReportDisplayDate(value: string): string {
  return formatDisplayDate(value) || '-';
}

type OrdenCompraReportePdfPage = {
  rows: OrdenCompraReporteDetallePdf[];
  isFirstPage: boolean;
  showDetailTable: boolean;
  finalBlocks: FinalBlockPlacement[];
};

type FinalBlockType = 'summary' | 'info' | 'signatures';

type FinalBlockPlacement = {
  type: FinalBlockType;
  top: number;
};

type DetailRowLayout = {
  especificacionLines: string[];
  centroCostoLines: string[];
  rowHeight: number;
};

function buildPageContent(
  report: OrdenCompraReportePdfData,
  page: OrdenCompraReportePdfPage,
  pageNumber: number,
  totalPages: number,
  logoBytes?: Uint8Array,
  headerImageBytes?: Uint8Array
): string {
  const commands: string[] = ['0.65 w', '0 0 0 RG'];
  const addText = createTextAdder(commands);
  const addLabelValue = createLabelValueAdder(addText);
  const addLine = createLineAdder(commands);
  const addRect = createRectAdder(commands);
  const addImage = createImageAdder(commands);
  const addHeaderImage = createImageAdder(commands, 'Im2');
  const isServicio = isOrdenServicio(report.tipoServicio);
  const documentTitle = isServicio ? 'ORDEN DE SERVICIO' : 'ORDEN DE COMPRA';
  const documentCode = sanitizeValue(
    report.correlativo || `${isServicio ? 'OSP' : 'OCP'}${String(report.ordenCompraId || 0).padStart(5, '0')}`
  );
  const documentName = isServicio ? 'orden de servicio' : 'orden de compra';

  const tableTop = page.isFirstPage
    ? drawFirstPageHeader(
        addText,
        addLabelValue,
        addRect,
        addImage,
        addHeaderImage,
        report,
        documentTitle,
        documentCode,
        documentName,
        logoBytes,
        headerImageBytes
      )
    : CONTINUATION_PAGE_TABLE_TOP;

  if (page.showDetailTable) {
    drawDetailTable(commands, addText, addLine, addRect, tableTop, page.rows, pageNumber);
  }

  page.finalBlocks.forEach((block) => {
    if (block.type === 'summary') {
      drawSummaryBlock(addText, addLine, addRect, block.top, report);
    } else if (block.type === 'info') {
      drawInfoBlock(addLabelValue, addRect, block.top, report);
    } else {
      drawSignaturesBlock(addText, addLine, block.top);
    }
  });

  if (totalPages > 1) {
    addText(PAGE_RIGHT, PAGE_HEIGHT - 14, `Pagina ${pageNumber} de ${totalPages}`, 7, false, 'right');
  }

  return commands.join('\n');
}

function drawFirstPageHeader(
  addText: ReturnType<typeof createTextAdder>,
  addLabelValue: ReturnType<typeof createLabelValueAdder>,
  addRect: ReturnType<typeof createRectAdder>,
  addImage: ReturnType<typeof createImageAdder>,
  addHeaderImage: ReturnType<typeof createImageAdder>,
  report: OrdenCompraReportePdfData,
  documentTitle: string,
  documentCode: string,
  documentName: string,
  logoBytes?: Uint8Array,
  headerImageBytes?: Uint8Array
): number {
  addRect(PAGE_LEFT, PAGE_TOP, PAGE_RIGHT - PAGE_LEFT, 74);
  if (logoBytes) {
    addImage(PAGE_LEFT + 18, PAGE_TOP + 12, 112, 47);
  } else {
    addText(PAGE_LEFT + 18, PAGE_TOP + 22, 'ARCE', 24, true);
    addText(PAGE_LEFT + 18, PAGE_TOP + 42, 'MONTAJES E INGENIERIA ARCE PERU S.A.C.', 8, true);
  }
  if (headerImageBytes) {
    addHeaderImage(PAGE_RIGHT - HEADER_IMAGE_WIDTH - 12, PAGE_TOP + 10, HEADER_IMAGE_WIDTH, HEADER_IMAGE_HEIGHT);
  } else {
    const headerRightX = PAGE_RIGHT - 12;
    addText(headerRightX, PAGE_TOP + 16, 'Calle 3, Nro. 177 - Urb La Grimanesa - CALLAO', 8, false, 'right');
    addText(headerRightX, PAGE_TOP + 30, 'Telef: 572-3220 ANEXO 11 - 12', 8, false, 'right');
    addText(headerRightX, PAGE_TOP + 44, 'RUC: 20550259221', 8, false, 'right');
  }

  addRect(PAGE_RIGHT - 155, 116, 135, 42);
  addText(PAGE_RIGHT - 87.5, 134, documentTitle, 10, true, 'center');
  addText(PAGE_RIGHT - 87.5, 150, documentCode, 11, true, 'center');

  addRect(PAGE_LEFT, 174, PAGE_RIGHT - PAGE_LEFT, 112);
  addLabelValue(PAGE_LEFT + 6, 190, 'FECHA:', report.fecha, 8);
  addLabelValue(PAGE_LEFT + 6, 204, 'PROVEEDOR:', report.proveedor, 8, 250);
  addLabelValue(PAGE_LEFT + 6, 218, 'RUC:', report.ruc, 8);
  addLabelValue(PAGE_LEFT + 6, 232, 'BANCO:', report.banco, 8, 250);
  addLabelValue(PAGE_LEFT + 6, 246, 'CUENTA:', report.cuenta, 8, 250);
  addLabelValue(PAGE_LEFT + 6, 260, 'CCI:', report.cci, 8, 250);

  addLabelValue(310, 190, 'CONTACTO:', report.contacto, 8, 230);
  addLabelValue(310, 204, 'EMAIL:', report.email, 8, 230);
  addWrappedLabelValue(addText, 310, 218, 'DIRECCION:', report.direccionProveedor, 8, 230);

  addText(PAGE_LEFT, 318, 'Muy Sres. Nuestros:', 8, true);
  addText(PAGE_LEFT, 342, `Sirvanse suministrarnos los materiales contenidos en la ${documentName}, la misma que pasamos a detallar:`, 8);

  addRect(PAGE_LEFT, 358, PAGE_RIGHT - PAGE_LEFT, 64);
  addLabelValue(PAGE_LEFT + 6, 374, 'REFERENCIA:', report.referenciaObra, 8, PAGE_RIGHT - PAGE_LEFT - 12);
  addLabelValue(PAGE_LEFT + 6, 390, 'FECHA REQ.:', report.fechaRequerida, 8);

  return FIRST_PAGE_TABLE_TOP;
}

function drawDetailTable(
  commands: string[],
  addText: ReturnType<typeof createTextAdder>,
  addLine: ReturnType<typeof createLineAdder>,
  addRect: ReturnType<typeof createRectAdder>,
  top: number,
  rows: OrdenCompraReporteDetallePdf[],
  pageNumber: number
): number {
  const columns = [PAGE_LEFT, 60, 105, 145, 335, 440, 500, PAGE_RIGHT];
  const headers = ['ITEM', 'CANT.', 'UND.', 'ESPECIFICACION', 'CENTRO COSTO', 'PRECIO U.', 'IMPORTE'];

  addRect(PAGE_LEFT, top, PAGE_RIGHT - PAGE_LEFT, TABLE_HEADER_HEIGHT);
  columns.slice(1, -1).forEach((x) => addLine(x, top, x, top + TABLE_HEADER_HEIGHT));
  headers.forEach((header, index) => {
    addText((columns[index] + columns[index + 1]) / 2, top + 15, header, 7, true, 'center');
  });

  let rowY = top + TABLE_HEADER_HEIGHT;
  const detailRows = rows.length ? rows : [getEmptyDetailRow()];

  detailRows.forEach((row) => {
    const layout = getDetailRowLayout(row, columns);
    const rowMiddleY = rowY + layout.rowHeight / 2 + 3;

    addRect(PAGE_LEFT, rowY, PAGE_RIGHT - PAGE_LEFT, layout.rowHeight);
    columns.slice(1, -1).forEach((x) => addLine(x, rowY, x, rowY + layout.rowHeight));
    addText((columns[0] + columns[1]) / 2, rowMiddleY, String(row.item), 7, false, 'center');
    addText(columns[2] - 6, rowMiddleY, formatAmount(row.cantidad, 2), 7, false, 'right');
    addText((columns[2] + columns[3]) / 2, rowMiddleY, row.unidad, 7, false, 'center', columns[3] - columns[2] - 6);
    layout.especificacionLines.forEach((line, index) => {
      addText(columns[3] + 4, rowY + 13 + index * 9, line, 7, false, 'left', columns[4] - columns[3] - 8);
    });
    layout.centroCostoLines.forEach((line, index) => {
      addText(columns[4] + 4, rowY + 13 + index * 9, line, 7, false, 'left', columns[5] - columns[4] - 8);
    });
    addText(columns[6] - 6, rowMiddleY, formatAmount(row.precioUnitario, 2), 7, false, 'right');
    addText(columns[7] - 6, rowMiddleY, formatAmount(row.importe, 2), 7, false, 'right');
    rowY += layout.rowHeight;
  });

  return rowY;
}

function drawSummaryBlock(
  addText: ReturnType<typeof createTextAdder>,
  addLine: ReturnType<typeof createLineAdder>,
  addRect: ReturnType<typeof createRectAdder>,
  top: number,
  report: OrdenCompraReportePdfData
): void {
  const totalsHeight = getTotalsRows(report).length * 20;

  drawObservaciones(addText, addRect, top, report.observaciones, totalsHeight);
  drawTotals(addText, addLine, addRect, top, report);
}

function drawInfoBlock(
  addLabelValue: ReturnType<typeof createLabelValueAdder>,
  addRect: ReturnType<typeof createRectAdder>,
  top: number,
  report: OrdenCompraReportePdfData
): void {
  addRect(PAGE_LEFT, top, PAGE_RIGHT - PAGE_LEFT, 86);
  addLabelValue(PAGE_LEFT + 6, top + 16, 'PEDIDO:', report.pedido, 8);
  addLabelValue(PAGE_LEFT + 6, top + 32, 'DIRECCION ENVIO:', report.direccionEnvio, 8, PAGE_RIGHT - PAGE_LEFT - 12);
  addLabelValue(PAGE_LEFT + 6, top + 48, 'SOLICITADO POR:', report.solicitadoPor, 8, PAGE_RIGHT - PAGE_LEFT - 12);
  addLabelValue(PAGE_LEFT + 6, top + 64, 'CONDICION PAGO:', report.condicionPago, 8);
}

function drawSignaturesBlock(
  addText: ReturnType<typeof createTextAdder>,
  addLine: ReturnType<typeof createLineAdder>,
  lineY: number
): void {
  addLine(PAGE_LEFT, lineY, PAGE_LEFT + 130, lineY);
  addLine((PAGE_LEFT + PAGE_RIGHT) / 2 - 65, lineY, (PAGE_LEFT + PAGE_RIGHT) / 2 + 65, lineY);
  addLine(PAGE_RIGHT - 130, lineY, PAGE_RIGHT, lineY);
  addText(PAGE_LEFT + 65, lineY + 18, 'ENTREGADO POR', 8, true, 'center');
  addText((PAGE_LEFT + PAGE_RIGHT) / 2, lineY + 18, 'RECIBIDO POR', 8, true, 'center');
  addText(PAGE_RIGHT - 65, lineY + 18, 'V B SUPERVISION', 8, true, 'center');
}

function getDetailRowLayout(row: OrdenCompraReporteDetallePdf, columns: number[]): DetailRowLayout {
  const especificacionWidth = columns[4] - columns[3] - 8;
  const centroCostoWidth = columns[5] - columns[4] - 8;
  const lineHeight = 9;
  const maxLines = Math.max(1, Math.floor((ROW_MAX_HEIGHT - 12) / lineHeight));
  const especificacionLines = wrapTextToWidth(row.especificacion, 7, especificacionWidth).slice(0, maxLines);
  const centroCostoLines = wrapTextToWidth(row.centroCosto, 7, centroCostoWidth).slice(0, maxLines);
  const rowHeight = Math.min(
    ROW_MAX_HEIGHT,
    Math.max(ROW_HEIGHT, 12 + Math.max(especificacionLines.length, centroCostoLines.length) * lineHeight)
  );

  return { especificacionLines, centroCostoLines, rowHeight };
}

function getDetailRowHeight(row: OrdenCompraReporteDetallePdf): number {
  const columns = [PAGE_LEFT, 60, 105, 145, 335, 440, 500, PAGE_RIGHT];
  return getDetailRowLayout(row, columns).rowHeight;
}

function getEmptyDetailRow(): OrdenCompraReporteDetallePdf {
  return {
    item: 1,
    cantidad: 0,
    unidad: '-',
    especificacion: 'SIN ITEMS REGISTRADOS',
    centroCosto: '-',
    precioUnitario: 0,
    importe: 0
  };
}

function paginateDetailRows(report: OrdenCompraReportePdfData): OrdenCompraReportePdfPage[] {
  const rows = report.detalle.length ? report.detalle : [getEmptyDetailRow()];
  const pages: OrdenCompraReportePdfPage[] = [];
  let rowIndex = 0;
  let pageIndex = 0;

  while (rowIndex < rows.length) {
    const isFirstPage = pageIndex === 0;
    const tableTop = isFirstPage ? FIRST_PAGE_TABLE_TOP : CONTINUATION_PAGE_TABLE_TOP;
    const normalLimit = PAGE_HEIGHT - PAGE_BOTTOM_MARGIN;
    const pageRows: OrdenCompraReporteDetallePdf[] = [];
    let y = tableTop + TABLE_HEADER_HEIGHT;

    while (rowIndex < rows.length) {
      const row = rows[rowIndex];
      const rowHeight = getDetailRowHeight(row);

      if (pageRows.length > 0 && y + rowHeight > normalLimit) {
        break;
      }

      if (pageRows.length === 0 && y + rowHeight > normalLimit) {
        pageRows.push(row);
        rowIndex += 1;
        y += rowHeight;
        break;
      }

      pageRows.push(row);
      rowIndex += 1;
      y += rowHeight;
    }

    pages.push({ rows: pageRows, isFirstPage, showDetailTable: true, finalBlocks: [] });
    pageIndex += 1;
  }

  if (!pages.length) {
    pages.push({ rows: [getEmptyDetailRow()], isFirstPage: true, showDetailTable: true, finalBlocks: [] });
  }

  let currentPage = pages[pages.length - 1];
  const lastTableTop = currentPage.isFirstPage ? FIRST_PAGE_TABLE_TOP : CONTINUATION_PAGE_TABLE_TOP;
  let cursor = lastTableTop
    + TABLE_HEADER_HEIGHT
    + currentPage.rows.reduce((total, row) => total + getDetailRowHeight(row), 0);
  const pageLimit = PAGE_HEIGHT - PAGE_BOTTOM_MARGIN;
  const blocks: Array<{ type: FinalBlockType; height: number; gap: number }> = [
    { type: 'summary', height: getTotalsRows(report).length * 20, gap: 8 },
    { type: 'info', height: 86, gap: 14 },
    { type: 'signatures', height: 18, gap: 18 + SIGNATURE_EXTRA_OFFSET }
  ];

  blocks.forEach((block) => {
    let gap = block.gap;
    let blockTop = cursor + gap;

    if (blockTop + block.height > pageLimit) {
      currentPage = { rows: [], isFirstPage: false, showDetailTable: false, finalBlocks: [] };
      pages.push(currentPage);
      cursor = CONTINUATION_PAGE_TABLE_TOP;
      gap = block.type === 'signatures' ? block.gap : 0;
      blockTop = cursor + gap;
    }

    currentPage.finalBlocks.push({ type: block.type, top: blockTop });
    cursor = blockTop + block.height;
  });

  return pages;
}

function drawTotals(
  addText: ReturnType<typeof createTextAdder>,
  addLine: ReturnType<typeof createLineAdder>,
  addRect: ReturnType<typeof createRectAdder>,
  top: number,
  report: OrdenCompraReportePdfData
): void {
  const x = 285;
  const width = PAGE_RIGHT - x;
  const rowHeight = 20;
  const labelWidth = 175;
  const labels = getTotalsRows(report);

  labels.forEach(([label, value], index) => {
    const y = top + index * rowHeight;
    const labelText = String(label);
    const labelFontSize = fitFontSizeToWidth(labelText, 7, 5, labelWidth - 12);
    addRect(x, y, width, rowHeight);
    addLine(x + labelWidth, y, x + labelWidth, y + rowHeight);
    addText(x + 6, y + 13, labelText, labelFontSize, true, 'left', labelWidth - 12);
    const numericValue = Number(value);
    const currency = sanitizeValue(report.monedaAbreviacion || 'S/.');
    const formattedValue = isPercepcionLabel(labelText)
      ? `+ ${currency} ${formatAmount(Math.abs(numericValue), 2)}`
      : numericValue < 0
        ? `- ${currency} ${formatAmount(Math.abs(numericValue), 2)}`
        : `${currency} ${formatAmount(numericValue, 2)}`;
    addText((x + labelWidth + PAGE_RIGHT) / 2, y + 13, formattedValue, 7, true, 'center');
  });
}

function drawObservaciones(
  addText: ReturnType<typeof createTextAdder>,
  addRect: ReturnType<typeof createRectAdder>,
  top: number,
  observaciones: string,
  height: number
): void {
  const width = 245;
  const x = PAGE_LEFT;
  const y = top;
  const textX = x + 8;
  const textY = y + 16;
  const label = 'Observaciones:';
  const value = sanitizeValue(observaciones);

  addRect(x, y, width, height);
  addText(textX, textY, label, 8, true);

  if (value && value !== '-') {
    const lines = wrapTextToWidth(value, 8, width - 16);
    lines.slice(0, 4).forEach((line, index) => {
      addText(textX, textY + 14 + index * 12, line, 8, false, 'left', width - 16);
    });
  }
}

function getTotalsRows(report: OrdenCompraReportePdfData): Array<[string, number]> {
  const rows: Array<[string, number]> = [
    ['SUB TOTAL', report.subtotal],
    ['IGV TOTAL', report.igv],
    ['TOTAL CON IGV', report.total]
  ];

  if (report.montoDetraccion > 0) {
    const descripcion = sanitizeValue(report.detraccionDescripcion) || 'DETRACCION';
    rows.push([descripcion, isPercepcionLabel(descripcion) ? report.montoDetraccion : -report.montoDetraccion]);
  }

  rows.push(['TOTAL A PAGAR', report.totalPagar]);

  return rows;
}

function isPercepcionLabel(value: string): boolean {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .includes('PERCEPCION');
}

function fitFontSizeToWidth(text: string, preferredSize: number, minimumSize: number, maxWidth: number): number {
  let size = preferredSize;

  while (size > minimumSize && approximateTextWidth(text, size) > maxWidth) {
    size -= 0.25;
  }

  return Math.max(size, minimumSize);
}

function chunkRows(rows: OrdenCompraReporteDetallePdf[], firstPageRows: number, nextPageRows: number): OrdenCompraReporteDetallePdf[][] {
  if (!rows.length) {
    return [[]];
  }

  const chunks: OrdenCompraReporteDetallePdf[][] = [];
  let startIndex = 0;
  let currentSize = firstPageRows;

  while (startIndex < rows.length) {
    chunks.push(rows.slice(startIndex, startIndex + currentSize));
    startIndex += currentSize;
    currentSize = nextPageRows;
  }

  return chunks;
}

function createTextAdder(commands: string[]) {
  return (x: number, y: number, text: string, size = 10, bold = false, align: 'left' | 'center' | 'right' = 'left', maxWidth?: number) => {
    const fittedText = fitTextToWidth(sanitizePdfText(text), size, maxWidth);
    const textWidth = approximateTextWidth(fittedText, size);
    let drawX = x;

    if (align === 'center') {
      drawX = x - textWidth / 2;
    } else if (align === 'right') {
      drawX = x - textWidth;
    }

    commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${drawX.toFixed(2)} ${toPdfY(y).toFixed(2)} Td (${escapePdfText(fittedText)}) Tj ET`);
  };
}

function createLabelValueAdder(addText: ReturnType<typeof createTextAdder>) {
  return (x: number, y: number, label: string, value: string, size = 8, maxWidth?: number) => {
    const safeLabel = sanitizePdfText(label);
    const safeValue = sanitizeValue(value);
    const labelWidth = approximateTextWidth(safeLabel, size) + 12;
    addText(x, y, safeLabel, size, true);
    addText(x + labelWidth, y, safeValue, size, false, 'left', maxWidth ? Math.max(maxWidth - labelWidth, 20) : undefined);
  };
}

function addWrappedLabelValue(
  addText: ReturnType<typeof createTextAdder>,
  x: number,
  y: number,
  label: string,
  value: string,
  size = 8,
  maxWidth = 230,
  lineHeight = 12
): void {
  const safeLabel = sanitizePdfText(label);
  const safeValue = sanitizeValue(value);
  const labelWidth = approximateTextWidth(safeLabel, size) + 12;
  const valueWidth = Math.max(maxWidth - labelWidth, 20);
  const lines = wrapTextToWidth(safeValue, size, valueWidth);

  addText(x, y, safeLabel, size, true);
  lines.forEach((line, index) => {
    addText(x + labelWidth, y + index * lineHeight, line, size, false, 'left', valueWidth);
  });
}

function createLineAdder(commands: string[]) {
  return (x1: number, y1: number, x2: number, y2: number) => {
    commands.push(`${x1.toFixed(2)} ${toPdfY(y1).toFixed(2)} m ${x2.toFixed(2)} ${toPdfY(y2).toFixed(2)} l S`);
  };
}

function createImageAdder(commands: string[], imageName = 'Im1') {
  return (x: number, y: number, width: number, height: number) => {
    commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${toPdfY(y + height).toFixed(2)} cm /${imageName} Do Q`);
  };
}

function createRectAdder(commands: string[]) {
  return (x: number, y: number, width: number, height: number) => {
    commands.push(`${x.toFixed(2)} ${toPdfY(y + height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  };
}

type PdfObject =
  | { kind: 'text'; body: string }
  | { kind: 'binary'; header: string; bytes: Uint8Array; footer: string };

function buildPdfDocument(pageContents: string[], logoBytes?: Uint8Array, headerImageBytes?: Uint8Array): Uint8Array {
  const objects: PdfObject[] = [];
  const addObject = (body: string): number => {
    objects.push({ kind: 'text', body });
    return objects.length;
  };
  const addBinaryObject = (header: string, bytes: Uint8Array, footer: string): number => {
    objects.push({ kind: 'binary', header, bytes, footer });
    return objects.length;
  };

  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const imageIds: Array<number | null> = [
    logoBytes
      ? addBinaryObject(
          `<< /Type /XObject /Subtype /Image /Width 1591 /Height 672 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`,
          logoBytes,
          '\nendstream'
        )
      : null,
    headerImageBytes
      ? addBinaryObject(
          `<< /Type /XObject /Subtype /Image /Width 169 /Height 84 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${headerImageBytes.length} >>\nstream\n`,
          headerImageBytes,
          '\nendstream'
        )
      : null
  ];
  const pagesObjectId = addObject('');
  const pageIds: number[] = [];
  const xObjectResources = imageIds
    .map((imageId, index) => (imageId ? `/Im${index + 1} ${imageId} 0 R` : ''))
    .filter(Boolean)
    .join(' ');
  const resources = xObjectResources
    ? `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> /XObject << ${xObjectResources} >> >>`
    : `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >>`;

  pageContents.forEach((content) => {
    const stream = `${content}\n`;
    const contentId = addObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}endstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ${resources} /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  });

  objects[pagesObjectId - 1] = {
    kind: 'text',
    body: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  };
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let currentOffset = 0;
  const appendText = (value: string) => {
    const chunk = encodeText(value);
    chunks.push(chunk);
    currentOffset += chunk.length;
  };
  const appendBytes = (value: Uint8Array) => {
    chunks.push(value);
    currentOffset += value.length;
  };

  appendText('%PDF-1.4\n');
  objects.forEach((objectBody, index) => {
    offsets[index + 1] = currentOffset;
    appendText(`${index + 1} 0 obj\n`);

    if (objectBody.kind === 'text') {
      appendText(`${objectBody.body}\n`);
    } else {
      appendText(objectBody.header);
      appendBytes(objectBody.bytes);
      appendText(`${objectBody.footer}\n`);
    }

    appendText('endobj\n');
  });

  const xrefOffset = currentOffset;
  appendText(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);

  for (let index = 1; index <= objects.length; index += 1) {
    appendText(`${String(offsets[index]).padStart(10, '0')} 00000 n \n`);
  }

  appendText(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return concatBytes(chunks, currentOffset);
}

function toPdfY(yFromTop: number): number {
  return PAGE_HEIGHT - yFromTop;
}

function approximateTextWidth(text: string, fontSize: number): number {
  const helveticaWidths: Record<string, number> = {
    ' ': 0.278,
    '!': 0.278,
    '"': 0.355,
    '#': 0.556,
    '$': 0.556,
    '%': 0.889,
    '&': 0.667,
    "'": 0.191,
    '(': 0.333,
    ')': 0.333,
    '*': 0.389,
    '+': 0.584,
    ',': 0.278,
    '-': 0.333,
    '.': 0.278,
    '/': 0.278,
    '0': 0.556,
    '1': 0.556,
    '2': 0.556,
    '3': 0.556,
    '4': 0.556,
    '5': 0.556,
    '6': 0.556,
    '7': 0.556,
    '8': 0.556,
    '9': 0.556,
    ':': 0.278,
    ';': 0.278,
    '<': 0.584,
    '=': 0.584,
    '>': 0.584,
    '?': 0.556,
    '@': 1.015,
    A: 0.667,
    B: 0.667,
    C: 0.722,
    D: 0.722,
    E: 0.667,
    F: 0.611,
    G: 0.778,
    H: 0.722,
    I: 0.278,
    J: 0.5,
    K: 0.667,
    L: 0.556,
    M: 0.833,
    N: 0.722,
    O: 0.778,
    P: 0.667,
    Q: 0.778,
    R: 0.722,
    S: 0.667,
    T: 0.611,
    U: 0.722,
    V: 0.667,
    W: 0.944,
    X: 0.667,
    Y: 0.667,
    Z: 0.611,
    '[': 0.278,
    '\\': 0.278,
    ']': 0.278,
    '^': 0.469,
    _: 0.556,
    '`': 0.333,
    a: 0.556,
    b: 0.556,
    c: 0.5,
    d: 0.556,
    e: 0.556,
    f: 0.278,
    g: 0.556,
    h: 0.556,
    i: 0.222,
    j: 0.222,
    k: 0.5,
    l: 0.222,
    m: 0.833,
    n: 0.556,
    o: 0.556,
    p: 0.556,
    q: 0.556,
    r: 0.333,
    s: 0.5,
    t: 0.278,
    u: 0.556,
    v: 0.5,
    w: 0.722,
    x: 0.5,
    y: 0.5,
    z: 0.5,
    '{': 0.334,
    '|': 0.26,
    '}': 0.334,
    '~': 0.584
  };

  return text
    .split('')
    .reduce((total, character) => total + (helveticaWidths[character] ?? 0.556) * fontSize, 0);
}

function fitTextToWidth(text: string, fontSize: number, maxWidth?: number): string {
  if (!maxWidth || approximateTextWidth(text, fontSize) <= maxWidth) {
    return text;
  }

  let trimmed = text;

  while (trimmed.length > 3 && approximateTextWidth(`${trimmed}...`, fontSize) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed}...`;
}

function wrapTextToWidth(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (approximateTextWidth(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : ['-'];
}

function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function byteLength(value: string): number {
  return encodeText(value).length;
}

function concatBytes(chunks: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });

  return result;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function sanitizePdfText(text: string): string {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

function sanitizeValue(value: string): string {
  return value?.trim() || '-';
}

function formatAmount(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number.isFinite(value) ? value : 0);
}

function isOrdenServicio(value?: string): boolean {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .includes('servicio');
}
