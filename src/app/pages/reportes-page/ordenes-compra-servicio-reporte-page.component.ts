import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';

@Component({
  selector: 'app-ordenes-compra-servicio-reporte-page',
  templateUrl: './ordenes-compra-servicio-reporte-page.component.html',
  styleUrls: [
    './kardex-general-reporte-page.component.scss',
    './ordenes-compra-servicio-reporte-page.component.scss'
  ]
})
export class OrdenesCompraServicioReportePageComponent implements OnInit {
  readonly usuarioControl = new FormControl('', { nonNullable: true });
  readonly tipoDocumentoControl = new FormControl(0, { nonNullable: true });
  readonly pedidoControl = new FormControl<number | null>(null);
  readonly ordenControl = new FormControl<number | null>(null);
  readonly proveedorControl = new FormControl(0, { nonNullable: true });
  readonly formaPagoControl = new FormControl(0, { nonNullable: true });
  readonly usuarioSearchControl = new FormControl('', { nonNullable: true });
  readonly proveedorSearchControl = new FormControl('', { nonNullable: true });
  readonly formaPagoSearchControl = new FormControl('', { nonNullable: true });

  readonly tiposDocumento: ReporteOption[] = [
    { id: 0, description: 'Todos los tipos' },
    { id: 1, description: 'Orden de compra' },
    { id: 2, description: 'Orden de servicio' }
  ];

  usuarios: ReporteUsuarioOption[] = [];
  proveedores: ReporteOption[] = [];
  formasPago: ReporteOption[] = [];
  rows: OrdenCompraServicioRow[] = [];
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

  get filteredUsuarios(): ReporteUsuarioOption[] {
    const search = this.usuarioSearchControl.value.trim().toLowerCase();
    return search
      ? this.usuarios.filter((item) =>
          [item.code, item.name].some((value) => value.toLowerCase().includes(search))
        )
      : this.usuarios;
  }

  get filteredProveedores(): ReporteOption[] {
    return this.filterOptions(this.proveedores, this.proveedorSearchControl.value);
  }

  get filteredFormasPago(): ReporteOption[] {
    return this.filterOptions(this.formasPago, this.formaPagoSearchControl.value);
  }

  get paginatedRows(): OrdenCompraServicioRow[] {
    return paginateItems(this.rows, this.currentPage, this.pageSize);
  }

  onSelectOpened(opened: boolean, searchControl: FormControl<string>): void {
    if (opened) {
      searchControl.setValue('');
    }
  }

  buscar(): void {
    const pedidoId = this.normalizeFilterNumber(this.pedidoControl.value);
    const ordenId = this.normalizeFilterNumber(this.ordenControl.value);

    if (pedidoId === null || ordenId === null) {
      this.rows = [];
      this.errorMessage = 'Los números de pedido y orden deben ser enteros positivos.';
      return;
    }

    this.isLoadingGrid = true;
    this.errorMessage = '';
    this.currentPage = 1;

    this.apiService.getGenerarReporteOcos(
      this.usuarioControl.value.trim(),
      Number(this.tipoDocumentoControl.value || 0),
      pedidoId,
      ordenId,
      Number(this.proveedorControl.value || 0),
      Number(this.formaPagoControl.value || 0)
    ).subscribe({
      next: (response: unknown) => {
        this.rows = this.extractRecords(response)
          .map((item) => this.mapRow(item))
          .filter((item): item is OrdenCompraServicioRow => item !== null);
        this.currentPage = normalizePaginationPage(1, this.rows.length, this.pageSize);
        this.isLoadingGrid = false;
      },
      error: (error: unknown) => {
        this.rows = [];
        this.errorMessage = this.resolveErrorMessage(
          error,
          'No se pudo cargar el reporte de órdenes de compra y servicio.'
        );
        this.isLoadingGrid = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.rows.length, this.pageSize);
  }

  exportarExcel(): void {
    if (!this.rows.length) {
      return;
    }

    const headers = [
      'Pedido',
      'Tipo',
      'Solicitante',
      'Fecha de registro',
      'Orden',
      'Proveedor',
      'Forma de pago',
      'Total',
      'Moneda'
    ];
    const body = this.rows
      .map((row) => `<Row>${[
        row.pedidoId,
        row.tipoDocumento,
        row.solicitante,
        row.fechaRegistro,
        row.ordenCorrelativo,
        row.proveedor,
        row.formaPago,
        this.formatTotal(row.total),
        row.monedaDescripcion
      ].map((value) => this.buildExcelCell(value)).join('')}</Row>`)
      .join('');
    const headerCells = headers.map((value) => this.buildExcelCell(value, 'Header')).join('');
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
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Default">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Ordenes OC OS">
    <Table>
      <Row>${headerCells}</Row>
      ${body}
    </Table>
  </Worksheet>
</Workbook>`;
    const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte_ordenes_compra_servicio.xls';
    link.click();
    URL.revokeObjectURL(url);
  }

  resolveTipoClass(row: OrdenCompraServicioRow): string {
    if (row.tipoId === 1 || row.tipoDocumento.toUpperCase().includes('COMPRA')) {
      return 'reporte-panel__documento-badge--compra';
    }

    if (row.tipoId === 2 || row.tipoDocumento.toUpperCase().includes('SERVICIO')) {
      return 'reporte-panel__documento-badge--servicio';
    }

    return 'reporte-panel__documento-badge--neutral';
  }

  formatTotal(value: number | null): string {
    if (value === null) {
      return '-';
    }

    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  trackByRow(index: number, row: OrdenCompraServicioRow): string {
    return `${row.pedidoId}-${row.ordenId}-${index}`;
  }

  trackById(_: number, item: ReporteOption): number {
    return item.id;
  }

  trackByUsuario(_: number, item: ReporteUsuarioOption): string {
    return item.code;
  }

  private cargarCatalogos(): void {
    this.isLoadingCatalogos = true;

    forkJoin({
      usuarios: this.apiService.getListarUsuarioActivo({ Flg_Est: 'A' }),
      proveedores: this.apiService.getListarProveedorActivo({ Flg_Est: 'A' }),
      formasPago: this.apiService.getListarFormaPagoActivo({ Flg_Est: 'A' })
    }).subscribe({
      next: ({ usuarios, proveedores, formasPago }) => {
        this.usuarios = this.extractRecords(usuarios)
          .map((item) => this.mapUsuario(item))
          .filter((item): item is ReporteUsuarioOption => item !== null)
          .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));
        this.proveedores = this.extractRecords(proveedores)
          .map((item) => this.mapOption(item, ['Prv_Id', 'prv_Id', 'prvId'], ['Prv_Nom', 'prv_Nom', 'prvNom']))
          .filter((item): item is ReporteOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description, 'es', { sensitivity: 'base' }));
        this.formasPago = this.extractRecords(formasPago)
          .map((item) => this.mapOption(
            item,
            ['For_Pag_Id', 'for_Pag_Id', 'forPagId'],
            ['For_Pag_Des', 'for_Pag_Des', 'forPagDes']
          ))
          .filter((item): item is ReporteOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description, 'es', { sensitivity: 'base' }));
        this.isLoadingCatalogos = false;
      },
      error: () => {
        this.usuarios = [];
        this.proveedores = [];
        this.formasPago = [];
        this.isLoadingCatalogos = false;
      }
    });
  }

  private mapRow(item: DataRecord): OrdenCompraServicioRow | null {
    const pedidoId = this.getNumberValue(item, ['Ped_Id', 'ped_Id', 'pedId']);
    const ordenId = this.getNumberValue(item, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId']);

    if (!pedidoId && !ordenId) {
      return null;
    }

    const tipoId = this.getNumberValue(item, ['Ped_Tip_Com', 'ped_Tip_Com', 'pedTipCom']) ?? 0;
    return {
      pedidoId: pedidoId ?? 0,
      tipoId,
      tipoDocumento: this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes'])
        || this.resolveTipoDescription(tipoId),
      solicitante: this.getTextValue(item, ['Solicitante', 'solicitante']) || '-',
      fechaRegistro: formatDisplayDate(this.getTextValue(item, ['Fec_Reg', 'fec_Reg', 'fecReg'])) || '-',
      ordenId: ordenId ?? 0,
      ordenCorrelativo: this.formatOrdenCorrelativo(ordenId, tipoId),
      proveedor: this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom']) || '-',
      formaPago: this.getTextValue(item, ['For_Pag_Des', 'for_Pag_Des', 'forPagDes']) || '-',
      total: this.getDecimalValue(item, ['Ord_Com_Tot', 'ord_Com_Tot', 'ordComTot']),
      monedaDescripcion: this.getTextValue(item, ['Mon_Des', 'mon_Des', 'monDes']) || '-'
    };
  }

  private mapUsuario(item: DataRecord): ReporteUsuarioOption | null {
    const code = this.getTextValue(item, ['Usr_Cod', 'usr_Cod', 'usrCod']);
    const name = this.getTextValue(item, ['Usr_Nom', 'usr_Nom', 'usrNom']);
    return code ? { code, name: name || code } : null;
  }

  private mapOption(item: DataRecord, idKeys: string[], descriptionKeys: string[]): ReporteOption | null {
    const id = this.getNumberValue(item, idKeys);
    const description = this.getTextValue(item, descriptionKeys);
    return id && description ? { id, description } : null;
  }

  private filterOptions(items: ReporteOption[], rawSearch: string): ReporteOption[] {
    const search = rawSearch.trim().toLowerCase();
    return search
      ? items.filter((item) =>
          [String(item.id), item.description].some((value) => value.toLowerCase().includes(search))
        )
      : items;
  }

  private normalizeFilterNumber(value: number | null): number | null {
    if (value === null || value === undefined || value === 0) {
      return 0;
    }

    const numberValue = Number(value);
    return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
  }

  private resolveTipoDescription(tipoId: number): string {
    return this.tiposDocumento.find((item) => item.id === tipoId)?.description || '-';
  }

  private formatOrdenCorrelativo(ordenId: number | null, tipoId: number): string {
    if (!ordenId) {
      return '-';
    }

    const prefix = tipoId === 2 ? 'OSP' : 'OCP';
    return `${prefix}${String(ordenId).padStart(5, '0')}`;
  }

  private buildExcelCell(value: string | number, styleId = 'Default'): string {
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${this.escapeXml(value)}</Data></Cell>`;
  }

  private escapeXml(value: string | number): string {
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

  private getTextValue(item: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }
    return '';
  }

  private getNumberValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);
      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    }
    return null;
  }

  private getDecimalValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = item[key];

      if (value === null || value === undefined || value === '') {
        continue;
      }

      const parsedValue = Number(value);
      if (Number.isFinite(parsedValue)) {
        return parsedValue;
      }
    }

    return null;
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

type DataRecord = Record<string, unknown>;

interface ReporteUsuarioOption {
  code: string;
  name: string;
}

interface ReporteOption {
  id: number;
  description: string;
}

interface OrdenCompraServicioRow {
  pedidoId: number;
  tipoId: number;
  tipoDocumento: string;
  solicitante: string;
  fechaRegistro: string;
  ordenId: number;
  ordenCorrelativo: string;
  proveedor: string;
  formaPago: string;
  total: number | null;
  monedaDescripcion: string;
}
