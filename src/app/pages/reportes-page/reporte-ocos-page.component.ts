import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { formatDateRequestValue, formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';

interface ReporteOcosColumn {
  key: string;
  source: string;
  label: string;
  isDate?: boolean;
  isNumber?: boolean;
  highlightPedido?: boolean;
  highlightOrden?: boolean;
  highlightPago?: boolean;
  highlightEstado?: boolean;
}

type DataRecord = Record<string, unknown>;
type ReporteOcosRow = Record<string, string>;

interface ReporteOcosOption {
  id: number;
  code: string;
  description: string;
}

interface ReporteOcosUsuarioOption {
  code: string;
  description: string;
}

@Component({
  selector: 'app-reporte-ocos-page',
  templateUrl: './reporte-ocos-page.component.html',
  styleUrls: [
    './kardex-general-reporte-page.component.scss',
    './reporte-ocos-page.component.scss'
  ]
})
export class ReporteOcosPageComponent implements OnInit {
  readonly columns: ReporteOcosColumn[] = [
    { key: 'estadoPedido', source: 'EstadoPedido', label: 'Estado pedido', highlightEstado: true },
    { key: 'codigoPedido', source: 'CodigoPedido', label: 'Cód. pedido', highlightPedido: true },
    { key: 'tipoPedido', source: 'TipoPedido', label: 'Tipo de pedido', highlightPedido: true },
    { key: 'descripcionItem', source: 'DescripcionItem', label: 'Descripción item', highlightPedido: true },
    { key: 'centroCostos', source: 'CentroCostos', label: 'Centro de costos', highlightPedido: true },
    { key: 'costoTotalPedidoItem', source: 'CostoTotalPedidoItem', label: 'Costo total pedido item', isNumber: true, highlightPedido: true },
    { key: 'ubicacion', source: 'Ubicacion', label: 'Ubicación', highlightPedido: true },
    { key: 'nomSolicitante', source: 'NomSolicitante', label: 'Solicitante', highlightPedido: true },
    { key: 'fechaPedido', source: 'FechaPedido', label: 'Fecha pedido', isDate: true, highlightPedido: true },
    { key: 'estadoAtencion', source: 'EstadoAtencion', label: 'Estado atención', highlightEstado: true },
    { key: 'codOrden', source: 'CodOrden', label: 'Cód. orden', highlightOrden: true },
    { key: 'descripcion', source: 'Descripcion', label: 'Descripción', highlightOrden: true },
    { key: 'proveedor', source: 'Proveedor', label: 'Proveedor', highlightOrden: true },
    { key: 'fechaOrden', source: 'FechaOrden', label: 'Fecha orden', isDate: true, highlightOrden: true },
    { key: 'formaPago', source: 'FormaPago', label: 'Forma de pago', highlightOrden: true },
    { key: 'moneda', source: 'Moneda', label: 'Moneda', highlightOrden: true },
    { key: 'estadoPago', source: 'EstadoPago', label: 'Estado de pago', highlightEstado: true },
    { key: 'baseSoles', source: 'BaseSoles', label: 'Base soles', isNumber: true, highlightOrden: true },
    { key: 'igvSoles', source: 'IgvSoles', label: 'IGV soles', isNumber: true, highlightOrden: true },
    { key: 'totalSoles', source: 'TotalSoles', label: 'Total soles', isNumber: true, highlightOrden: true },
    { key: 'baseDolares', source: 'BaseDolares', label: 'Base dólares', isNumber: true, highlightOrden: true },
    { key: 'igvDolares', source: 'IgvDolares', label: 'IGV dólares', isNumber: true, highlightOrden: true },
    { key: 'totalDolares', source: 'TotalDolares', label: 'Total dólares', isNumber: true, highlightOrden: true },
    { key: 'abonoProveedor', source: 'AbonoProveedor', label: 'Abono proveedor', highlightOrden: true },
    { key: 'detraccion', source: 'Detraccion', label: 'Detracción', isNumber: true, highlightOrden: true },
    { key: 'pendiente', source: 'Pendiente', label: 'Pendiente', highlightOrden: true },
    { key: 'periodoGasto', source: 'PeriodoGasto', label: 'Periodo gasto', highlightPago: true },
    { key: 'fechaPago', source: 'FechaPago', label: 'Fecha pago', isDate: true, highlightPago: true },
    { key: 'nroComprobantePago', source: 'NroComprobantePago', label: 'Nro. comprobante', highlightPago: true },
    { key: 'fechaEmisionFactura', source: 'FechaEmisionFactura', label: 'Emisión factura', isDate: true, highlightPago: true },
    { key: 'fechaVencimientoFactura', source: 'FechaVencimientoFactura', label: 'Vencimiento factura', isDate: true, highlightPago: true }
  ];
  readonly selectedExportColumnKeys = new Set(this.columns.map((column) => column.key));
  readonly fechaInicioControl = new FormControl(this.getFirstDayOfCurrentMonth(), { nonNullable: true });
  readonly fechaFinControl = new FormControl(this.getToday(), { nonNullable: true });
  readonly pedidoControl = new FormControl<number | null>(null);
  readonly ordenControl = new FormControl<number | null>(null);
  readonly tipoPedidoControl = new FormControl(0, { nonNullable: true });
  readonly monedaControl = new FormControl(0, { nonNullable: true });
  readonly usuarioControl = new FormControl('', { nonNullable: true });
  readonly centroCostoControl = new FormControl(0, { nonNullable: true });
  readonly formaPagoControl = new FormControl(0, { nonNullable: true });
  readonly proveedorControl = new FormControl(0, { nonNullable: true });
  readonly usuarioSearchControl = new FormControl('', { nonNullable: true });
  readonly centroCostoSearchControl = new FormControl('', { nonNullable: true });
  readonly formaPagoSearchControl = new FormControl('', { nonNullable: true });
  readonly proveedorSearchControl = new FormControl('', { nonNullable: true });
  readonly tiposPedido: ReporteOcosOption[] = [
    { id: 0, code: '', description: 'Todos los tipos' },
    { id: 1, code: 'OC', description: 'Orden de compra' },
    { id: 2, code: 'OS', description: 'Orden de servicio' }
  ];

  rows: ReporteOcosRow[] = [];
  monedas: ReporteOcosOption[] = [];
  usuarios: ReporteOcosUsuarioOption[] = [];
  centrosCosto: ReporteOcosOption[] = [];
  formasPago: ReporteOcosOption[] = [];
  proveedores: ReporteOcosOption[] = [];
  readonly pageSize = 15;
  currentPage = 1;
  isLoadingCatalogos = false;
  isLoadingGrid = false;
  errorMessage = '';

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.cargarCatalogos();
    this.buscar();
  }

  get paginatedRows(): ReporteOcosRow[] {
    return paginateItems(this.rows, this.currentPage, this.pageSize);
  }

  get exportColumns(): ReporteOcosColumn[] {
    return this.columns.filter((column) => this.selectedExportColumnKeys.has(column.key));
  }

  get selectedExportColumnCount(): number {
    return this.selectedExportColumnKeys.size;
  }

  get areAllExportColumnsSelected(): boolean {
    return this.selectedExportColumnKeys.size === this.columns.length;
  }

  get filteredUsuarios(): ReporteOcosUsuarioOption[] {
    const search = this.usuarioSearchControl.value.trim().toLowerCase();
    return search
      ? this.usuarios.filter((item) => `${item.code} ${item.description}`.toLowerCase().includes(search))
      : this.usuarios;
  }

  get filteredCentrosCosto(): ReporteOcosOption[] {
    return this.filterOptions(this.centrosCosto, this.centroCostoSearchControl.value);
  }

  get filteredFormasPago(): ReporteOcosOption[] {
    return this.filterOptions(this.formasPago, this.formaPagoSearchControl.value);
  }

  get filteredProveedores(): ReporteOcosOption[] {
    return this.filterOptions(this.proveedores, this.proveedorSearchControl.value);
  }

  toggleExportColumn(columnKey: string, checked: boolean): void {
    if (checked) {
      this.selectedExportColumnKeys.add(columnKey);
      return;
    }

    this.selectedExportColumnKeys.delete(columnKey);
  }

  toggleAllExportColumns(checked: boolean): void {
    this.selectedExportColumnKeys.clear();
    if (checked) {
      this.columns.forEach((column) => this.selectedExportColumnKeys.add(column.key));
    }
  }

  onSelectOpened(opened: boolean, searchControl: FormControl<string>): void {
    if (opened) {
      searchControl.setValue('');
    }
  }

  buscar(): void {
    const fechaInicio = formatDateRequestValue(this.fechaInicioControl.value);
    const fechaFin = formatDateRequestValue(this.fechaFinControl.value);
    const pedidoId = this.normalizeFilterNumber(this.pedidoControl.value);
    const ordenId = this.normalizeFilterNumber(this.ordenControl.value);

    if (!fechaInicio || !fechaFin) {
      this.rows = [];
      this.errorMessage = 'Selecciona una fecha inicial y una fecha final válidas.';
      return;
    }

    if (this.fechaFinControl.value.getTime() < this.fechaInicioControl.value.getTime()) {
      this.rows = [];
      this.errorMessage = 'La fecha final no puede ser menor que la fecha inicial.';
      return;
    }

    if (pedidoId === null || ordenId === null) {
      this.rows = [];
      this.errorMessage = 'Los números de pedido y orden deben ser enteros positivos.';
      return;
    }

    this.isLoadingGrid = true;
    this.errorMessage = '';
    this.currentPage = 1;

    this.apiService.getReporteOCOS(
      fechaInicio,
      fechaFin,
      pedidoId,
      ordenId,
      Number(this.tipoPedidoControl.value || 0),
      Number(this.monedaControl.value || 0),
      this.usuarioControl.value.trim(),
      Number(this.centroCostoControl.value || 0),
      Number(this.formaPagoControl.value || 0),
      Number(this.proveedorControl.value || 0)
    ).subscribe({
      next: (response: unknown) => {
        this.rows = this.extractRecords(response).map((item) => this.mapRow(item));
        this.currentPage = normalizePaginationPage(1, this.rows.length, this.pageSize);
        this.isLoadingGrid = false;
      },
      error: (error: unknown) => {
        this.rows = [];
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el reporte OC/OS.');
        this.isLoadingGrid = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.rows.length, this.pageSize);
  }

  exportarExcel(): void {
    const exportColumns = this.exportColumns;
    if (!this.rows.length || !exportColumns.length) {
      return;
    }

    const headerCells = exportColumns
      .map((column) => this.buildExcelCell(column.label, this.resolveExcelHeaderStyle(column)))
      .join('');
    const exportRows = this.getDistinctExportRows(this.rows, exportColumns);
    const body = exportRows
      .map((row) => `<Row>${exportColumns
        .map((column) => this.buildExcelCell(row[column.key], 'Default', column.isNumber))
        .join('')}</Row>`)
      .join('');
    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#6F6B67" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="HeaderPedido">
      <Font ss:Bold="1" ss:Color="#28516F"/>
      <Interior ss:Color="#CFE8FF" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="HeaderOrden">
      <Font ss:Bold="1" ss:Color="#285C36"/>
      <Interior ss:Color="#D9F2DF" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="HeaderPago">
      <Font ss:Bold="1" ss:Color="#8A4A0F"/>
      <Interior ss:Color="#FFE0BD" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="HeaderEstado">
      <Font ss:Bold="1" ss:Color="#735B00"/>
      <Interior ss:Color="#FFF1A8" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="Default"><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  </Styles>
  <Worksheet ss:Name="Reporte OC OS">
    <Table><Row>${headerCells}</Row>${body}</Table>
  </Worksheet>
</Workbook>`;
    const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte_oc_os.xls';
    link.click();
    URL.revokeObjectURL(url);
  }

  trackByRow(index: number, row: ReporteOcosRow): string {
    return `${row['codigoPedido']}-${row['codOrden']}-${index}`;
  }

  trackByColumn(_: number, column: ReporteOcosColumn): string {
    return column.key;
  }

  trackByOption(_: number, item: ReporteOcosOption): number {
    return item.id;
  }

  trackByUsuario(_: number, item: ReporteOcosUsuarioOption): string {
    return item.code;
  }

  private cargarCatalogos(): void {
    this.isLoadingCatalogos = true;

    forkJoin({
      monedas: this.apiService.getListarMoneda({ Flg_Est: 'A' }),
      usuarios: this.apiService.getListarUsuarioActivo({ Flg_Est: 'A' }),
      centrosCosto: this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }),
      formasPago: this.apiService.getListarFormaPagoActivo({ Flg_Est: 'A' }),
      proveedores: this.apiService.getListarProveedorActivo({ Flg_Est: 'A' })
    }).subscribe({
      next: ({ monedas, usuarios, centrosCosto, formasPago, proveedores }) => {
        this.monedas = this.extractRecords(monedas)
          .map((item) => this.mapOption(item, 'Mon_Id', 'Mon_Des'))
          .filter((item): item is ReporteOcosOption => item !== null);
        this.usuarios = this.extractRecords(usuarios)
          .map((item) => this.mapUsuario(item))
          .filter((item): item is ReporteOcosUsuarioOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description, 'es', { sensitivity: 'base' }));
        this.centrosCosto = this.extractRecords(centrosCosto)
          .map((item) => this.mapOption(item, 'Cen_Cos_Id', 'Cen_Cos_Des', 'Cen_Cos_Cod'))
          .filter((item): item is ReporteOcosOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description, 'es', { sensitivity: 'base' }));
        this.formasPago = this.extractRecords(formasPago)
          .map((item) => this.mapOption(item, 'For_Pag_Id', 'For_Pag_Des'))
          .filter((item): item is ReporteOcosOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description, 'es', { sensitivity: 'base' }));
        this.proveedores = this.extractRecords(proveedores)
          .map((item) => this.mapOption(item, 'Prv_Id', 'Prv_Nom'))
          .filter((item): item is ReporteOcosOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description, 'es', { sensitivity: 'base' }));
        this.isLoadingCatalogos = false;
      },
      error: () => {
        this.monedas = [];
        this.usuarios = [];
        this.centrosCosto = [];
        this.formasPago = [];
        this.proveedores = [];
        this.isLoadingCatalogos = false;
      }
    });
  }

  private mapOption(
    item: DataRecord,
    idKey: string,
    descriptionKey: string,
    codeKey?: string
  ): ReporteOcosOption | null {
    const id = Number(this.getValue(item, idKey));
    const description = String(this.getValue(item, descriptionKey) ?? '').trim();
    const code = codeKey ? String(this.getValue(item, codeKey) ?? '').trim() : '';
    return Number.isInteger(id) && id > 0 && description ? { id, code, description } : null;
  }

  private mapUsuario(item: DataRecord): ReporteOcosUsuarioOption | null {
    const code = String(this.getValue(item, 'Usr_Cod') ?? '').trim();
    const description = String(this.getValue(item, 'Usr_Nom') ?? '').trim();
    return code ? { code, description: description || code } : null;
  }

  private filterOptions(items: ReporteOcosOption[], rawSearch: string): ReporteOcosOption[] {
    const search = rawSearch.trim().toLowerCase();
    return search
      ? items.filter((item) => `${item.id} ${item.code} ${item.description}`.toLowerCase().includes(search))
      : items;
  }

  private normalizeFilterNumber(value: number | null): number | null {
    if (value === null || value === undefined || value === 0) {
      return 0;
    }

    const numericValue = Number(value);
    return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
  }

  private getFirstDayOfCurrentMonth(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  private getToday(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  private mapRow(item: DataRecord): ReporteOcosRow {
    const tipoPedidoId = this.getValue(item, 'IdTipoPedido');
    const tipoPedido = this.getValue(item, 'TipoPedido');

    return this.columns.reduce<ReporteOcosRow>((row, column) => {
      const rawValue = this.getValue(item, column.source);
      const textValue = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();

      if (column.source === 'CodigoPedido') {
        row[column.key] = this.formatCodigoPedido(textValue);
      } else if (column.source === 'CodOrden') {
        row[column.key] = this.formatCodigoOrden(textValue, tipoPedidoId, tipoPedido);
      } else {
        row[column.key] = column.isDate && textValue
          ? this.formatReporteDate(textValue)
          : textValue;
      }

      return row;
    }, {});
  }

  private formatReporteDate(value: string): string {
    const datePart = value.trim().split('T')[0].split(' ')[0];
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);

    if (isoMatch) {
      return `${isoMatch[3].padStart(2, '0')}-${isoMatch[2].padStart(2, '0')}-${isoMatch[1]}`;
    }

    const separatedMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(datePart);

    if (separatedMatch) {
      const firstPart = Number(separatedMatch[1]);
      const secondPart = Number(separatedMatch[2]);
      const year = separatedMatch[3];

      if (firstPart > 12) {
        return `${String(firstPart).padStart(2, '0')}-${String(secondPart).padStart(2, '0')}-${year}`;
      }

      return `${String(secondPart).padStart(2, '0')}-${String(firstPart).padStart(2, '0')}-${year}`;
    }

    return formatDisplayDate(value) || value;
  }

  private formatCodigoPedido(value: string): string {
    if (!value) {
      return '';
    }

    if (!/^\d+$/.test(value)) {
      return value;
    }

    return `PED-${Number(value)}`;
  }

  private formatCodigoOrden(value: string, tipoPedidoId: unknown, tipoPedido: unknown): string {
    if (!value) {
      return '';
    }

    if (!/^\d+$/.test(value)) {
      return value;
    }

    const tipoId = Number(tipoPedidoId);
    const tipoDescripcion = String(tipoPedido ?? '').toUpperCase();
    const esServicio = tipoId === 2 || tipoDescripcion.includes('SERVICIO');
    const prefijo = esServicio ? 'OSP' : 'OCP';
    return `${prefijo}${value.padStart(5, '0')}`;
  }

  private getValue(item: DataRecord, expectedKey: string): unknown {
    const matchingKey = Object.keys(item).find((key) => key.toLowerCase() === expectedKey.toLowerCase());
    return matchingKey ? item[matchingKey] : null;
  }

  private buildExcelCell(value: string, styleId = 'Default', isNumber = false): string {
    if (isNumber && value !== '') {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${numericValue}</Data></Cell>`;
      }
    }

    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${this.escapeXml(value)}</Data></Cell>`;
  }

  private getDistinctExportRows(rows: ReporteOcosRow[], columns: ReporteOcosColumn[]): ReporteOcosRow[] {
    const seenRows = new Set<string>();

    return rows.filter((row) => {
      const selectedValues = columns.map((column) => row[column.key] ?? '');
      const rowKey = JSON.stringify(selectedValues);

      if (seenRows.has(rowKey)) {
        return false;
      }

      seenRows.add(rowKey);
      return true;
    });
  }

  private resolveExcelHeaderStyle(column: ReporteOcosColumn): string {
    if (column.highlightEstado) {
      return 'HeaderEstado';
    }
    if (column.highlightPedido) {
      return 'HeaderPedido';
    }
    if (column.highlightOrden) {
      return 'HeaderOrden';
    }
    if (column.highlightPago) {
      return 'HeaderPago';
    }
    return 'Header';
  }

  private escapeXml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is DataRecord => this.isRecord(item));
    }

    if (!this.isRecord(response)) {
      return [];
    }

    for (const key of ['Elements', 'elements', 'Data', 'data']) {
      const value = response[key];
      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isRecord(item));
      }
    }

    return [response];
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (this.isRecord(error)) {
      const nestedError = this.isRecord(error['error']) ? error['error'] : null;
      const message = String(
        nestedError?.['Message']
        ?? nestedError?.['message']
        ?? error['Message']
        ?? error['message']
        ?? ''
      ).trim();
      if (message) {
        return message;
      }
    }
    return fallback;
  }
}
