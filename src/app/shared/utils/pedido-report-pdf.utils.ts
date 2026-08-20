import { formatDisplayDate } from './date.utils';

export interface PedidoReporteDetallePdf {
  descripcion: string;
  unidad: string;
  cantidad: number;
  comentario?: string;
  centroCosto?: string;
  requisitos?: string;
  imagen?: string;
  imagenData?: PedidoReporteEmbeddedImage;
}

export interface PedidoReporteEmbeddedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface PedidoReportePdfData {
  pedidoId: number;
  codigoPedido: string;
  fechaSolicitud: string;
  solicitante: string;
  recepciona?: string;
  centroCosto?: string;
  ot?: string;
  referencia: string;
  referenciaGeneral?: string;
  tipoServicio: string;
  tipoCompra?: string;
  moneda: string;
  almacen?: string;
  oc?: string;
  telefono?: string;
  lugarEntrega: string;
  direccionEntrega?: string;
  fechaEntrega: string;
  proveedorReferencia?: string;
  detalle: PedidoReporteDetallePdf[];
}

export interface PedidoReportePdfOptions {
  logoBytes?: Uint8Array;
  headerImageBytes?: Uint8Array;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_LEFT = 28;
const PAGE_RIGHT = PAGE_WIDTH - 28;
const PAGE_TOP = 28;
const ROW_HEIGHT = 24;
const HEADER_IMAGE_WIDTH = 109;
const HEADER_IMAGE_HEIGHT = 54;

export function createPedidoReportPdf(report: PedidoReportePdfData, options: PedidoReportePdfOptions = {}): Blob {
  const detailPages = paginatePedidoDetalle(report.detalle);
  let itemStartIndex = 0;
  let detailImageStartIndex = 0;
  const pageContents = detailPages.map((detallePagina) => {
    const pageContent = buildPageContent(
      { ...report, detalle: detallePagina },
      options.logoBytes,
      options.headerImageBytes,
      itemStartIndex,
      detailImageStartIndex
    );
    itemStartIndex += detallePagina.length;
    detailImageStartIndex += pageContent.detailImages.length;
    return pageContent;
  });
  return new Blob([buildPdfDocument(pageContents, options.logoBytes, options.headerImageBytes)], { type: 'application/pdf' });
}

function buildPageContent(
  report: PedidoReportePdfData,
  logoBytes?: Uint8Array,
  headerImageBytes?: Uint8Array,
  itemStartIndex = 0,
  detailImageStartIndex = 0
): { content: string; detailImages: PedidoReporteEmbeddedImage[] } {
  const commands: string[] = ['0.65 w', '0 0 0 RG'];
  const addText = createTextAdder(commands);
  const addLine = createLineAdder(commands);
  const addRect = createRectAdder(commands);
  const addImage = createImageAdder(commands);
  const addHeaderImage = createImageAdder(commands, 'Im2');

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

  addRect(PAGE_RIGHT - 175, 116, 155, 48);
  addText(PAGE_RIGHT - 97.5, 135, 'PEDIDO INTERNO', 10, true, 'center');
  addText(PAGE_RIGHT - 97.5, 152, valueOrDash(report.codigoPedido), 11, true, 'center');

  addRect(PAGE_LEFT, 180, PAGE_RIGHT - PAGE_LEFT, 78);
  addFixedLabelValue(addText, PAGE_LEFT + 6, 118, 196, 'FECHA SOLICITUD:', report.fechaSolicitud, 8, 170);
  addFixedLabelValue(addText, PAGE_LEFT + 6, 118, 212, 'SOLICITANTE:', report.solicitante, 8, 170);
  addFixedLabelValue(addText, PAGE_LEFT + 6, 118, 228, 'TIPO DE PEDIDO:', report.tipoServicio, 8, 170);

  addFixedLabelValue(addText, 310, 402, 196, 'FECHA ENTREGA:', report.fechaEntrega, 8, 130);
  addFixedLabelValue(addText, 310, 402, 212, 'REFERENCIA:', report.referenciaGeneral || report.referencia, 8, 130);
  addWrappedFixedLabelValue(addText, 310, 402, 228, 'LUGAR ENTREGA:', report.direccionEntrega || report.lugarEntrega, 8, 130);

  const tableTop = 292;
  const detailImages = drawDetailTable(addText, addLine, addRect, tableTop, report.detalle, itemStartIndex, detailImageStartIndex, commands);

  return {
    content: commands.join('\n'),
    detailImages
  };
}

interface FieldDrawConfig {
  label: string;
  value: string;
  x: number;
  valueX: number;
  endX: number;
}

function drawInfoRow(
  addText: TextAdder,
  addDashedLine: (x1: number, y: number, x2: number) => void,
  y: number,
  fields: FieldDrawConfig[]
): void {
  fields.forEach((field) => {
    addText(field.x, y - 5, `${field.label}:`, 7.2, true);
    addText(field.valueX, y - 5, valueOrDash(field.value), 7.2, false, 'left', field.endX - field.valueX - 4);
    addDashedLine(field.valueX, y + 2, field.endX);
  });
}

function drawSimpleField(addText: TextAdder, y: number, label: string, value?: string): void {
  addText(PAGE_LEFT + 5, y, label, 7.2, true);
  addText(PAGE_LEFT + 122, y, valueOrDash(value), 7.2, false, 'left', PAGE_RIGHT - PAGE_LEFT - 135);
}

function addFixedLabelValue(
  addText: TextAdder,
  labelX: number,
  valueX: number,
  y: number,
  label: string,
  value: string,
  size = 8,
  maxWidth?: number
): void {
  addText(labelX, y, label, size, true);
  addText(valueX, y, valueOrDash(value), size, false, 'left', maxWidth);
}

function addWrappedFixedLabelValue(
  addText: TextAdder,
  labelX: number,
  valueX: number,
  y: number,
  label: string,
  value: string,
  size = 8,
  maxWidth = 130,
  lineHeight = 12
): void {
  addText(labelX, y, label, size, true);
  wrapTextToWidth(valueOrDash(value), size, maxWidth).slice(0, 3).forEach((line, index) => {
    addText(valueX, y + index * lineHeight, line, size, false, 'left', maxWidth);
  });
}

function drawDetailTable(
  addText: TextAdder,
  addLine: ReturnType<typeof createLineAdder>,
  addRect: ReturnType<typeof createRectAdder>,
  top: number,
  rows: PedidoReporteDetallePdf[],
  itemStartIndex = 0,
  detailImageStartIndex = 0,
  commands: string[]
): PedidoReporteEmbeddedImage[] {
  const columns = [PAGE_LEFT, 60, 105, 145, 255, 340, 415, 490, PAGE_RIGHT];
  const headers = ['ITEM', 'CANT.', 'UND.', 'DESCRIPCION', 'C. COSTO', 'COMENT.', 'REQUIS.', 'IMAGEN'];
  const detailRows = rows.length ? rows : [{
    descripcion: 'SIN ITEMS REGISTRADOS',
    unidad: '-',
    cantidad: 0,
    comentario: '',
    centroCosto: '-',
    requisitos: '',
    imagen: ''
  }];

  addRect(PAGE_LEFT, top, PAGE_RIGHT - PAGE_LEFT, 24);
  columns.slice(1, -1).forEach((x) => addLine(x, top, x, top + 24));
  headers.forEach((header, index) => {
    addText((columns[index] + columns[index + 1]) / 2, top + 15, header, 7, true, 'center');
  });

  let rowY = top + 24;
  let detailImageIndex = detailImageStartIndex;
  const detailImages: PedidoReporteEmbeddedImage[] = [];

  detailRows.forEach((row, index) => {
    const {
      descriptionLines,
      centroCostoLines,
      comentarioLines,
      requisitoLines,
      imagenLines,
      descriptionTextWidth,
      centroCostoWidth,
      comentarioWidth,
      requisitoWidth,
      imagenWidth,
      imageBoxHeight,
      lineHeight,
      rowHeight
    } = buildPedidoDetailRowMetrics(row);
    const rowMiddleY = rowY + rowHeight / 2 + 3;

    addRect(PAGE_LEFT, rowY, PAGE_RIGHT - PAGE_LEFT, rowHeight);
    columns.slice(1, -1).forEach((x) => addLine(x, rowY, x, rowY + rowHeight));
    addText((columns[0] + columns[1]) / 2, rowMiddleY, String(itemStartIndex + index + 1), 7, false, 'center');
    addText(columns[2] - 6, rowMiddleY, formatAmount(row.cantidad, 2), 7, false, 'right');
    addText((columns[2] + columns[3]) / 2, rowMiddleY, row.unidad, 7, false, 'center', columns[3] - columns[2] - 6);

    descriptionLines.forEach((line, lineIndex) => {
      addText(columns[3] + 4, rowY + 13 + lineIndex * lineHeight, line, 7, false, 'left', descriptionTextWidth);
    });
    centroCostoLines.forEach((line, lineIndex) => {
      addText(columns[4] + 4, rowY + 13 + lineIndex * lineHeight, line, 7, false, 'left', centroCostoWidth);
    });
    comentarioLines.forEach((line, lineIndex) => {
      addText(columns[5] + 4, rowY + 13 + lineIndex * lineHeight, line, 7, false, 'left', comentarioWidth);
    });
    requisitoLines.forEach((line, lineIndex) => {
      addText(columns[6] + 4, rowY + 13 + lineIndex * lineHeight, line, 7, false, 'left', requisitoWidth);
    });
    if (row.imagenData) {
      detailImageIndex += 1;
      detailImages.push(row.imagenData);
      const imageName = `DetIm${detailImageIndex}`;
      const addDetailImage = createImageAdder(commands, imageName);
      const fit = getImageFitSize(row.imagenData.width, row.imagenData.height, imagenWidth, imageBoxHeight);
      const imageX = columns[7] + 4 + (imagenWidth - fit.width) / 2;
      const imageY = rowY + (rowHeight - fit.height) / 2;
      addDetailImage(imageX, imageY, fit.width, fit.height);
    } else {
      imagenLines.forEach((line, lineIndex) => {
        addText(columns[7] + 4, rowY + 13 + lineIndex * lineHeight, line, 7, false, 'left', imagenWidth);
      });
    }

    rowY += rowHeight;
  });

  return detailImages;
}

function paginatePedidoDetalle(rows: PedidoReporteDetallePdf[]): PedidoReporteDetallePdf[][] {
  const normalizedRows = rows.length
    ? rows
    : [{
        descripcion: 'SIN ITEMS REGISTRADOS',
        unidad: '-',
        cantidad: 0,
        comentario: '',
        centroCosto: '-',
        requisitos: '',
        imagen: ''
      }];

  const pages: PedidoReporteDetallePdf[][] = [];
  const currentPage: PedidoReporteDetallePdf[] = [];
  const tableTop = 292;
  const tableHeaderHeight = 24;
  const pageBottomLimit = PAGE_HEIGHT - 46;
  let consumedHeight = tableTop + tableHeaderHeight;

  normalizedRows.forEach((row) => {
    const { rowHeight } = buildPedidoDetailRowMetrics(row);

    if (currentPage.length > 0 && consumedHeight + rowHeight > pageBottomLimit) {
      pages.push([...currentPage]);
      currentPage.length = 0;
      consumedHeight = tableTop + tableHeaderHeight;
    }

    currentPage.push(row);
    consumedHeight += rowHeight;
  });

  if (currentPage.length > 0) {
    pages.push([...currentPage]);
  }

  return pages.length ? pages : [[]];
}

function buildPedidoDetailRowMetrics(row: PedidoReporteDetallePdf) {
  const columns = [PAGE_LEFT, 60, 105, 145, 255, 340, 415, 490, PAGE_RIGHT];
  const descriptionWidth = columns[4] - columns[3] - 8;
  const centroCostoWidth = columns[5] - columns[4] - 8;
  const comentarioWidth = columns[6] - columns[5] - 8;
  const requisitoWidth = columns[7] - columns[6] - 8;
  const imagenWidth = columns[8] - columns[7] - 8;
  const descriptionTextWidth = Math.max(40, descriptionWidth * 0.78);
  const descriptionLines = wrapTextToWidth(row.descripcion, 7, descriptionTextWidth);
  const centroCostoLines = wrapTextToWidth(row.centroCosto || '-', 7, centroCostoWidth);
  const comentarioLines = wrapTextToWidth(row.comentario || '-', 7, comentarioWidth);
  const requisitoLines = wrapTextToWidth(row.requisitos || '-', 7, requisitoWidth);
  const imagenLines = row.imagenData ? [] : wrapTextToWidth(row.imagen || '-', 7, imagenWidth);
  const lineHeight = 9;
  const imageBoxHeight = row.imagenData ? 44 : ROW_HEIGHT;
  const rowHeight = Math.max(
    ROW_HEIGHT,
    imageBoxHeight + 8,
    12 + Math.max(
      descriptionLines.length,
      centroCostoLines.length,
      comentarioLines.length,
      requisitoLines.length,
      imagenLines.length
    ) * lineHeight
  );

  return {
    descriptionLines,
    centroCostoLines,
    comentarioLines,
    requisitoLines,
    imagenLines,
    descriptionTextWidth,
    centroCostoWidth,
    comentarioWidth,
    requisitoWidth,
    imagenWidth,
    imageBoxHeight,
    lineHeight,
    rowHeight
  };
}

function createLabelValueAdder(addText: TextAdder) {
  return (x: number, y: number, label: string, value: string, size = 8, maxWidth?: number, gap = 8) => {
    const safeLabel = sanitizePdfText(label);
    const safeValue = valueOrDash(value);
    const labelWidth = approximateTextWidth(safeLabel, size) + gap;
    addText(x, y, safeLabel, size, true);
    addText(x + labelWidth, y, safeValue, size, false, 'left', maxWidth ? Math.max(maxWidth - labelWidth, 20) : undefined);
  };
}

function addWrappedLabelValue(
  addText: TextAdder,
  x: number,
  y: number,
  label: string,
  value: string,
  size = 8,
  maxWidth = 230,
  gap = 8,
  lineHeight = 12
): void {
  const safeLabel = sanitizePdfText(label);
  const safeValue = valueOrDash(value);
  const labelWidth = approximateTextWidth(safeLabel, size) + gap;
  const valueWidth = Math.max(maxWidth - labelWidth, 20);
  const lines = wrapTextToWidth(safeValue, size, valueWidth);

  addText(x, y, safeLabel, size, true);
  lines.slice(0, 3).forEach((line, index) => {
    addText(x + labelWidth, y + index * lineHeight, line, size, false, 'left', valueWidth);
  });
}

type TextAdder = (
  x: number,
  y: number,
  text: string,
  size?: number,
  bold?: boolean,
  align?: 'left' | 'center' | 'right',
  maxWidth?: number
) => void;

function createTextAdder(commands: string[]): TextAdder {
  return (x, y, text, size = 10, bold = false, align = 'left', maxWidth) => {
    const safeText = sanitizePdfText(text);
    const fittedText = fitTextToWidth(safeText, size, maxWidth);
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

function createLineAdder(commands: string[]) {
  return (x1: number, y1: number, x2: number, y2: number) => {
    commands.push(`${x1.toFixed(2)} ${toPdfY(y1).toFixed(2)} m ${x2.toFixed(2)} ${toPdfY(y2).toFixed(2)} l S`);
  };
}

function createRectAdder(commands: string[]) {
  return (x: number, y: number, width: number, height: number) => {
    commands.push(`${x.toFixed(2)} ${toPdfY(y + height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  };
}

function createImageAdder(commands: string[], imageName = 'Im1') {
  return (x: number, y: number, width: number, height: number) => {
    commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${toPdfY(y + height).toFixed(2)} cm /${imageName} Do Q`);
  };
}

type PdfObject =
  | { kind: 'text'; body: string }
  | { kind: 'binary'; header: string; bytes: Uint8Array; footer: string };

function buildPdfDocument(
  pageContents: Array<{ content: string; detailImages: PedidoReporteEmbeddedImage[] }>,
  logoBytes?: Uint8Array,
  headerImageBytes?: Uint8Array
): Uint8Array {
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
  const globalImageIds: Array<number | null> = [
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
  const detailImageIds = pageContents
    .flatMap((page) => page.detailImages)
    .map((image) =>
      addBinaryObject(
        `<< /Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(image.width))} /Height ${Math.max(1, Math.round(image.height))} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
        image.bytes,
        '\nendstream'
      )
    );
  const pagesObjectId = addObject('');
  const pageIds: number[] = [];
  let detailImageResourceIndex = 0;

  pageContents.forEach((page) => {
    const stream = `${page.content}\n`;
    const contentId = addObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}endstream`);
    const xObjectEntries: string[] = [];

    globalImageIds.forEach((imageId, index) => {
      if (imageId) {
        xObjectEntries.push(`/Im${index + 1} ${imageId} 0 R`);
      }
    });

    page.detailImages.forEach(() => {
      detailImageResourceIndex += 1;
      const imageId = detailImageIds[detailImageResourceIndex - 1];
      xObjectEntries.push(`/DetIm${detailImageResourceIndex} ${imageId} 0 R`);
    });

    const resources = xObjectEntries.length
      ? `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> /XObject << ${xObjectEntries.join(' ')} >> >>`
      : `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >>`;
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

  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function getImageFitSize(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) {
  const safeWidth = Math.max(1, sourceWidth || 1);
  const safeHeight = Math.max(1, sourceHeight || 1);
  const widthRatio = maxWidth / safeWidth;
  const heightRatio = maxHeight / safeHeight;
  const scale = Math.min(widthRatio, heightRatio, 1);

  return {
    width: safeWidth * scale,
    height: safeHeight * scale
  };
}

function toPdfY(yFromTop: number): number {
  return PAGE_HEIGHT - yFromTop;
}

function approximateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.5;
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
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    if (approximateTextWidth(word, fontSize) > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }

      const wordParts = splitTextToWidth(word, fontSize, maxWidth);
      lines.push(...wordParts.slice(0, -1));
      currentLine = wordParts[wordParts.length - 1] || '';
      return;
    }

    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (approximateTextWidth(nextLine, fontSize) <= maxWidth) {
      currentLine = nextLine;
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

function splitTextToWidth(text: string, fontSize: number, maxWidth: number): string[] {
  const parts: string[] = [];
  let currentPart = '';

  Array.from(text).forEach((character) => {
    const nextPart = `${currentPart}${character}`;

    if (currentPart && approximateTextWidth(nextPart, fontSize) > maxWidth) {
      parts.push(currentPart);
      currentPart = character;
      return;
    }

    currentPart = nextPart;
  });

  if (currentPart) {
    parts.push(currentPart);
  }

  return parts.length ? parts : ['-'];
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

function formatAmount(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number.isFinite(value) ? value : 0);
}

function formatToday(): string {
  return formatDisplayDate(new Date().toISOString()) || '-';
}

function valueOrDash(value?: string): string {
  const text = String(value ?? '').trim();
  return text || '-';
}

function encodeText(value: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(value);
}

function byteLength(value: string): number {
  return encodeText(value).length;
}

export function mapPedidoReportDisplayDate(value: string): string {
  return formatDisplayDate(value) || '-';
}
