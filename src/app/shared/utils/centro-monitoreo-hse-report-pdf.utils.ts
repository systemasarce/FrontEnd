export interface CentroMonitoreoHseReportePdfData {
  codigo: string;
  supervisor: string;
  inspector: string;
  fecha: string;
  hora: string;
  estado: string;
  ubicacion: string;
  puntaje: string;
  motivoEdicion: string;
}

export interface CentroMonitoreoHseReportePdfOptions {
  logoBytes?: Uint8Array;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_LEFT = 22;
const PAGE_RIGHT = PAGE_WIDTH - 22;

export function createCentroMonitoreoHseReportPdf(
  report: CentroMonitoreoHseReportePdfData,
  options: CentroMonitoreoHseReportePdfOptions = {}
): Blob {
  const pageContents = [buildPageContent(report, !!options.logoBytes)];
  return new Blob([buildPdfDocument(pageContents, options.logoBytes)], { type: 'application/pdf' });
}

function buildPageContent(report: CentroMonitoreoHseReportePdfData, hasLogo: boolean): string {
  const commands: string[] = ['0.65 w', '0 0 0 RG'];
  const addText = createTextAdder(commands);
  const addLine = createLineAdder(commands);
  const addRect = createRectAdder(commands);
  const addImage = createImageAdder(commands);

  if (hasLogo) {
    addImage(22, 14, 115, 48);
  } else {
    addText(22, 28, 'ARCE', 22, true);
    addText(22, 48, 'MONTAJES E INGENIERIA ARCE PERU S.A.C.', 8, true);
  }

  addText(PAGE_WIDTH / 2, 96, 'REPORTE CENTRO DE MONITOREO HSE', 16, true, 'center');
  addText(PAGE_WIDTH / 2, 122, `Nro.${sanitizeValue(report.codigo)}`, 16, true, 'center');

  addText(PAGE_WIDTH / 2, 156, 'DATOS GENERALES', 14, true, 'center');
  addLine(PAGE_LEFT, 170, PAGE_RIGHT, 170);

  const labelX = 28;
  const valueX = 285;
  const lineHeight = 20;
  let y = 216;

  appendLabelValue(addText, labelX, valueX, y, 'Subido por:', report.supervisor, 11, 250);
  y += lineHeight;
  appendLabelValue(addText, labelX, valueX, y, 'Revisado por:', report.inspector, 11, 250);
  y += lineHeight;
  appendLabelValue(addText, labelX, valueX, y, 'Fecha:', report.fecha, 11, 250);
  y += lineHeight;
  appendLabelValue(addText, labelX, valueX, y, 'Hora:', report.hora, 11, 250);
  y += lineHeight;
  appendLabelValue(addText, labelX, valueX, y, 'Estado:', report.estado, 11, 250);
  y += lineHeight;
  appendLocationValue(addText, labelX, valueX, y, report.ubicacion, 10, 250, 11);

  addText(PAGE_WIDTH / 2, 382, 'PUNTUACION', 16, true, 'center');

  const tableX = 22;
  const tableTop = 432;
  const tableWidth = PAGE_RIGHT - tableX;
  const halfWidth = tableWidth / 2;
  const rowLabelH = 22;
  const rowValueH = 30;

  addRect(tableX, tableTop, tableWidth, rowLabelH + rowValueH);
  addLine(tableX, tableTop + rowLabelH, tableX + tableWidth, tableTop + rowLabelH);
  addLine(tableX + halfWidth, tableTop, tableX + halfWidth, tableTop + rowLabelH + rowValueH);

  addCenteredTextInBox(addText, tableX, tableTop, halfWidth, rowLabelH, 'Puntuación', 12, true);
  addCenteredTextInBox(addText, tableX + halfWidth, tableTop, halfWidth, rowLabelH, 'NOTA', 12, true);
  addCenteredTextInBox(addText, tableX, tableTop + rowLabelH, halfWidth, rowValueH, sanitizeValue(report.puntaje), 13, false);
  addCenteredTextInBox(addText, tableX + halfWidth, tableTop + rowLabelH, halfWidth, rowValueH, sanitizeValue(report.motivoEdicion), 13, false);

  return commands.join('\n');
}

function appendLabelValue(
  addText: ReturnType<typeof createTextAdder>,
  labelX: number,
  valueX: number,
  y: number,
  label: string,
  value: string,
  size = 11,
  maxWidth = 250
): void {
  const safeLabel = sanitizePdfText(label);
  const safeValue = sanitizeValue(value);
  const labelWidth = approximateTextWidth(safeLabel, size) + 12;
  const valueWidth = Math.max(maxWidth - labelWidth, 20);
  const lines = wrapTextToWidth(safeValue, size, valueWidth);

  addText(labelX, y, safeLabel, size, true);
  lines.forEach((line, index) => {
    addText(valueX, y + index * 12, line, size, false, 'left', valueWidth);
  });
}

function appendWrappedLabelValue(
  addText: ReturnType<typeof createTextAdder>,
  labelX: number,
  valueX: number,
  y: number,
  label: string,
  value: string,
  size = 11,
  maxWidth = 250,
  lineHeight = 14
): void {
  const safeLabel = sanitizePdfText(label);
  const safeValue = sanitizeValue(value);
  const labelWidth = approximateTextWidth(safeLabel, size) + 12;
  const valueWidth = Math.max(maxWidth - labelWidth, 20);
  const lines = wrapTextToWidth(safeValue, size, valueWidth);

  addText(labelX, y, safeLabel, size, true);
  lines.forEach((line, index) => {
    addText(valueX, y + index * lineHeight, line, size, false, 'left', valueWidth);
  });
}

function appendLocationValue(
  addText: ReturnType<typeof createTextAdder>,
  labelX: number,
  valueX: number,
  y: number,
  value: string,
  size = 10,
  maxWidth = 250,
  lineHeight = 11
): void {
  const safeLabel = sanitizePdfText('Ubicacion:');
  const safeValue = sanitizeValue(value);
  const availableWidth = Math.max(maxWidth, 20);

  addText(labelX, y, safeLabel, 11, true);

  const lines = looksLikeUrl(safeValue)
    ? wrapUrlToWidth(safeValue, size, availableWidth)
    : wrapTextToWidth(safeValue, size, availableWidth);

  lines.forEach((line, index) => {
    addText(valueX, y + index * lineHeight, line, size, false, 'left', availableWidth);
  });
}

function addCenteredTextInBox(
  addText: ReturnType<typeof createTextAdder>,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  size = 10,
  bold = false
): void {
  addText(x + width / 2, y + height / 2 + 4, text, size, bold, 'center', width - 10);
}

function addWrappedLeftTextInBox(
  addText: ReturnType<typeof createTextAdder>,
  x: number,
  y: number,
  width: number,
  height: number,
  lines: string[],
  size = 10
): void {
  const lineHeight = 11;
  const paddingX = 8;
  const paddingTop = 8;
  const maxLines = Math.max(1, Math.floor((height - paddingTop) / lineHeight));

  lines.slice(0, maxLines).forEach((line, index) => {
    addText(x + paddingX, y + paddingTop + index * lineHeight, line, size, false, 'left', width - paddingX * 2);
  });
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function wrapUrlToWidth(text: string, fontSize: number, maxWidth: number): string[] {
  const tokens = text.match(/[^/?&=%.,#-]+|[/?&=%.,#-]+/g) ?? [text];
  const lines: string[] = [];
  let currentLine = '';

  const pushCurrent = () => {
    if (currentLine) {
      lines.push(currentLine);
      currentLine = '';
    }
  };

  const pushTokenChunk = (chunk: string) => {
    if (!chunk) return;
    if (approximateTextWidth(chunk, fontSize) <= maxWidth) {
      if (approximateTextWidth(currentLine ? currentLine + chunk : chunk, fontSize) <= maxWidth) {
        currentLine += chunk;
      } else {
        pushCurrent();
        currentLine = chunk;
      }
      return;
    }

    let temp = '';
    for (const ch of chunk) {
      const candidate = temp + ch;
      if (approximateTextWidth(candidate, fontSize) > maxWidth && temp) {
        if (approximateTextWidth(currentLine + temp, fontSize) > maxWidth && currentLine) {
          pushCurrent();
        }
        if (approximateTextWidth(temp, fontSize) > maxWidth) {
          lines.push(temp);
          temp = ch;
        } else {
          currentLine += temp;
          temp = ch;
        }
      } else {
        temp = candidate;
      }
    }
    if (temp) {
      if (approximateTextWidth(currentLine + temp, fontSize) > maxWidth && currentLine) {
        pushCurrent();
      }
      currentLine += temp;
    }
  };

  tokens.forEach(pushTokenChunk);
  pushCurrent();
  return lines.length ? lines : ['-'];
}

function createTextAdder(commands: string[]) {
  return (
    x: number,
    y: number,
    text: string,
    size = 10,
    bold = false,
    align: 'left' | 'center' | 'right' = 'left',
    maxWidth?: number
  ) => {
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

function createLineAdder(commands: string[]) {
  return (x1: number, y1: number, x2: number, y2: number) => {
    commands.push(`${x1.toFixed(2)} ${toPdfY(y1).toFixed(2)} m ${x2.toFixed(2)} ${toPdfY(y2).toFixed(2)} l S`);
  };
}

function createImageAdder(commands: string[]) {
  return (x: number, y: number, width: number, height: number) => {
    commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${toPdfY(y + height).toFixed(2)} cm /Im1 Do Q`);
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

function buildPdfDocument(pageContents: string[], logoBytes?: Uint8Array): Uint8Array {
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
  const logoInfo = logoBytes ? obtenerDimensionesJpeg(logoBytes) : null;
  const imageId = logoBytes
    ? addBinaryObject(
        `<< /Type /XObject /Subtype /Image /Width ${(logoInfo?.Width ?? 1591)} /Height ${(logoInfo?.Height ?? 672)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`,
        logoBytes,
        '\nendstream'
      )
    : null;
  const pagesObjectId = addObject('');
  const pageIds: number[] = [];
  const resources = imageId
    ? `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >>`
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

function obtenerDimensionesJpeg(bytes: Uint8Array): { Width: number; Height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    return null;
  }

  let i = 2;
  while (i + 1 < bytes.length) {
    while (i < bytes.length && bytes[i] !== 0xFF) {
      i++;
    }

    while (i < bytes.length && bytes[i] === 0xFF) {
      i++;
    }

    if (i >= bytes.length) {
      break;
    }

    const marker = bytes[i++];
    if (marker === 0xD9 || marker === 0xDA) {
      break;
    }

    if (i + 1 >= bytes.length) {
      break;
    }

    const length = (bytes[i] << 8) + bytes[i + 1];
    if (length < 2 || i + length - 1 > bytes.length) {
      break;
    }

    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3 || marker === 0xC5 || marker === 0xC6 || marker === 0xC7 || marker === 0xC9 || marker === 0xCA || marker === 0xCB || marker === 0xCD || marker === 0xCE || marker === 0xCF) {
      if (i + 7 >= bytes.length) {
        break;
      }

      const height = (bytes[i + 3] << 8) + bytes[i + 4];
      const width = (bytes[i + 5] << 8) + bytes[i + 6];
      return { Width: width, Height: height };
    }

    i += length;
  }

  return null;
}

function toPdfY(yFromTop: number): number {
  return PAGE_HEIGHT - yFromTop;
}

function approximateTextWidth(text: string, fontSize: number): number {
  const helveticaWidths: Record<string, number> = {
    ' ': 0.278, '!': 0.278, '"': 0.355, '#': 0.556, '$': 0.556, '%': 0.889, '&': 0.667, "'": 0.191,
    '(': 0.333, ')': 0.333, '*': 0.389, '+': 0.584, ',': 0.278, '-': 0.333, '.': 0.278, '/': 0.278,
    '0': 0.556, '1': 0.556, '2': 0.556, '3': 0.556, '4': 0.556, '5': 0.556, '6': 0.556, '7': 0.556, '8': 0.556, '9': 0.556,
    ':': 0.278, ';': 0.278, '<': 0.584, '=': 0.584, '>': 0.584, '?': 0.556, '@': 1.015,
    A: 0.667, B: 0.667, C: 0.722, D: 0.722, E: 0.667, F: 0.611, G: 0.778, H: 0.722, I: 0.278, J: 0.5,
    K: 0.667, L: 0.556, M: 0.833, N: 0.722, O: 0.778, P: 0.667, Q: 0.778, R: 0.722, S: 0.667, T: 0.611,
    U: 0.722, V: 0.667, W: 0.944, X: 0.667, Y: 0.667, Z: 0.611, '[': 0.278, '\\': 0.278, ']': 0.278,
    '^': 0.469, _: 0.556, '`': 0.333, a: 0.556, b: 0.556, c: 0.5, d: 0.556, e: 0.556, f: 0.278, g: 0.556,
    h: 0.556, i: 0.222, j: 0.222, k: 0.5, l: 0.222, m: 0.833, n: 0.556, o: 0.556, p: 0.556, q: 0.556,
    r: 0.333, s: 0.5, t: 0.278, u: 0.556, v: 0.5, w: 0.722, x: 0.5, y: 0.5, z: 0.5, '{': 0.334,
    '|': 0.26, '}': 0.334, '~': 0.584
  };

  return text.split('').reduce((total, character) => total + (helveticaWidths[character] ?? 0.556) * fontSize, 0);
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
