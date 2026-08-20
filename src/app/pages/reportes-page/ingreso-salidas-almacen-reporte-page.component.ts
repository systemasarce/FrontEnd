import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { formatDateRequestValue, formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';

@Component({
  selector: 'app-ingreso-salidas-almacen-reporte-page',
  templateUrl: './ingreso-salidas-almacen-reporte-page.component.html',
  styleUrls: [
    './kardex-general-reporte-page.component.scss',
    './ingreso-salidas-almacen-reporte-page.component.scss'
  ]
})
export class IngresoSalidasAlmacenReportePageComponent implements OnInit {
  readonly usuarioControl = new FormControl('', { nonNullable: true });
  readonly fechaInicioControl = new FormControl(this.getFirstDayOfCurrentMonth(), { nonNullable: true });
  readonly fechaFinControl = new FormControl(this.getToday(), { nonNullable: true });
  readonly centroCostoControl = new FormControl(0, { nonNullable: true });
  readonly proveedorControl = new FormControl(0, { nonNullable: true });
  readonly itemControl = new FormControl(0, { nonNullable: true });
  readonly tipoIngresoControl = new FormControl(0, { nonNullable: true });
  readonly usuarioSearchControl = new FormControl('', { nonNullable: true });
  readonly centroCostoSearchControl = new FormControl('', { nonNullable: true });
  readonly proveedorSearchControl = new FormControl('', { nonNullable: true });
  readonly itemSearchControl = new FormControl('', { nonNullable: true });
  readonly tiposIngreso: ReporteTipoIngresoOption[] = [
    { id: 0, description: 'Todos los tipos' },
    { id: 1, description: 'Ingreso directo' },
    { id: 2, description: 'Orden de compra' },
    { id: 3, description: 'Orden de servicio' },
    { id: 4, description: 'Salida' }
  ];

  usuarios: ReporteUsuarioOption[] = [];
  centrosCosto: ReporteCentroCostoOption[] = [];
  proveedores: ReporteProveedorOption[] = [];
  items: ReporteItemOption[] = [];
  rows: IngresoSalidaAlmacenRow[] = [];
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

  get filteredCentrosCosto(): ReporteCentroCostoOption[] {
    const search = this.centroCostoSearchControl.value.trim().toLowerCase();
    return search
      ? this.centrosCosto.filter((item) =>
          [item.code, item.description].some((value) => value.toLowerCase().includes(search))
        )
      : this.centrosCosto;
  }

  get filteredProveedores(): ReporteProveedorOption[] {
    const search = this.proveedorSearchControl.value.trim().toLowerCase();
    return search
      ? this.proveedores.filter((item) =>
          [String(item.id), item.name].some((value) => value.toLowerCase().includes(search))
        )
      : this.proveedores;
  }

  get filteredItems(): ReporteItemOption[] {
    const search = this.itemSearchControl.value.trim().toLowerCase();
    return search
      ? this.items.filter((item) =>
          [item.code, item.description].some((value) => value.toLowerCase().includes(search))
        )
      : this.items;
  }

  get paginatedRows(): IngresoSalidaAlmacenRow[] {
    return paginateItems(this.rows, this.currentPage, this.pageSize);
  }

  onSelectOpened(opened: boolean, searchControl: FormControl<string>): void {
    if (opened) {
      searchControl.setValue('');
    }
  }

  buscar(): void {
    const fechaInicio = formatDateRequestValue(this.fechaInicioControl.value);
    const fechaFin = formatDateRequestValue(this.fechaFinControl.value);

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

    this.isLoadingGrid = true;
    this.errorMessage = '';
    this.currentPage = 1;

    this.apiService.getReporteIngresoSalidasAlmacen(
      this.usuarioControl.value.trim(),
      fechaInicio,
      fechaFin,
      Number(this.centroCostoControl.value || 0),
      Number(this.proveedorControl.value || 0),
      Number(this.itemControl.value || 0),
      Number(this.tipoIngresoControl.value || 0)
    ).subscribe({
      next: (response: unknown) => {
        this.rows = this.extractRecords(response)
          .map((item) => this.mapRow(item))
          .filter((item): item is IngresoSalidaAlmacenRow => item !== null);
        this.currentPage = normalizePaginationPage(1, this.rows.length, this.pageSize);
        this.isLoadingGrid = false;
      },
      error: (error: unknown) => {
        this.rows = [];
        this.errorMessage = this.resolveErrorMessage(
          error,
          'No se pudo cargar el reporte de ingresos y salidas de almacén.'
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
      'Mov. ID',
      'Fecha',
      'Cód. Solicitante',
      'Solicitante',
      'Cód. Registrador',
      'Registrado por',
      'Ubicación',
      'Tipo de ingreso',
      'Centro de costo',
      'Proveedor',
      'Cód. ítem',
      'Descripción ítem',
      'Cantidad'
    ];
    const body = this.rows
      .map((row) => `<Row>${[
        row.movimientoId,
        row.fecha,
        row.solicitanteCodigo,
        row.solicitante,
        row.registradorCodigo,
        row.registrador,
        row.ubicacion,
        row.tipoIngreso,
        row.centroCosto,
        row.proveedor,
        row.itemCodigo,
        row.itemDescripcion,
        this.formatCantidad(row.cantidad)
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
  <Worksheet ss:Name="Ingresos y salidas">
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
    link.download = this.buildFileName();
    link.click();
    URL.revokeObjectURL(url);
  }

  formatCantidad(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    }).format(value);
  }

  resolveTipoClass(value: string): string {
    const normalized = value.trim().toUpperCase();

    if (normalized.includes('INGRESO')) {
      return 'reporte-panel__tipo-badge--ingreso';
    }

    if (normalized.includes('SALIDA')) {
      return 'reporte-panel__tipo-badge--salida';
    }

    return 'reporte-panel__tipo-badge--neutral';
  }

  trackByRow(index: number, row: IngresoSalidaAlmacenRow): string {
    return `${row.movimientoId}-${row.itemCodigo}-${index}`;
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  trackByUsuario(_: number, item: ReporteUsuarioOption): string {
    return item.code;
  }

  private cargarCatalogos(): void {
    this.isLoadingCatalogos = true;

    forkJoin({
      usuarios: this.apiService.getListarUsuarioActivo({ Flg_Est: 'A' }),
      centrosCosto: this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }),
      proveedores: this.apiService.getListarProveedorActivo({ Flg_Est: 'A' }),
      items: this.apiService.getListarItem({ Flg_Est: 'A' })
    }).subscribe({
      next: ({ usuarios, centrosCosto, proveedores, items }) => {
        this.usuarios = this.extractRecords(usuarios)
          .map((item) => this.mapUsuario(item))
          .filter((item): item is ReporteUsuarioOption => item !== null)
          .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));
        this.centrosCosto = this.extractRecords(centrosCosto)
          .map((item) => this.mapCentroCosto(item))
          .filter((item): item is ReporteCentroCostoOption => item !== null)
          .sort((left, right) =>
            left.description.localeCompare(right.description, 'es', { sensitivity: 'base' })
          );
        this.proveedores = this.extractRecords(proveedores)
          .map((item) => this.mapProveedor(item))
          .filter((item): item is ReporteProveedorOption => item !== null)
          .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));
        this.items = this.extractRecords(items)
          .map((item) => this.mapItem(item))
          .filter((item): item is ReporteItemOption => item !== null)
          .sort((left, right) =>
            left.description.localeCompare(right.description, 'es', { sensitivity: 'base' })
          );
        this.isLoadingCatalogos = false;
      },
      error: () => {
        this.usuarios = [];
        this.centrosCosto = [];
        this.proveedores = [];
        this.items = [];
        this.isLoadingCatalogos = false;
      }
    });
  }

  private mapRow(item: DataRecord): IngresoSalidaAlmacenRow | null {
    const movimientoId = this.getNumberValue(item, ['Alm_Mov_Id', 'alm_Mov_Id', 'almMovId']);
    const itemCodigo = this.getTextValue(item, ['Itm_Cod', 'itm_Cod', 'itmCod']);
    const itemDescripcion = this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes']);

    if (!movimientoId && !itemCodigo && !itemDescripcion) {
      return null;
    }

    return {
      movimientoId: movimientoId ?? 0,
      fecha: formatDisplayDate(this.getTextValue(item, ['Fec_Reg', 'fec_Reg', 'fecReg'])) || '-',
      solicitanteCodigo: this.getTextValue(item, ['Alm_Sol_Dni', 'alm_Sol_Dni', 'almSolDni']) || '-',
      solicitante: this.getTextValue(item, ['Usr_Nom', 'usr_Nom', 'usrNom']) || '-',
      registradorCodigo: this.getTextValue(item, ['Usr_Reg', 'usr_Reg', 'usrReg']) || '-',
      registrador: this.getTextValue(item, ['Usr_Nom_Reg', 'usr_Nom_Reg', 'usrNomReg']) || '-',
      ubicacion: this.getTextValue(item, ['Ubi_Des', 'ubi_Des', 'ubiDes']) || '-',
      tipoIngreso: this.getTextValue(item, ['Ing_Des', 'ing_Des', 'ingDes']) || '-',
      centroCosto: this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']) || '-',
      proveedor: this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom']) || 'Sin proveedor',
      itemCodigo: itemCodigo || '-',
      itemDescripcion: itemDescripcion || '-',
      cantidad: this.getDecimalValue(item, ['Alm_Det_Can', 'alm_Det_Can', 'almDetCan']) ?? 0
    };
  }

  private mapUsuario(item: DataRecord): ReporteUsuarioOption | null {
    const code = this.getTextValue(item, ['Usr_Cod', 'usr_Cod', 'usrCod']);
    const name = this.getTextValue(item, ['Usr_Nom', 'usr_Nom', 'usrNom']);
    return code ? { code, name: name || code } : null;
  }

  private mapCentroCosto(item: DataRecord): ReporteCentroCostoOption | null {
    const id = this.getNumberValue(item, ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId']);
    const description = this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']);

    if (!id || !description) {
      return null;
    }

    return {
      id,
      code: this.getTextValue(item, ['Cen_Cos_Cod', 'cen_Cos_Cod', 'cenCosCod']) || String(id),
      description
    };
  }

  private mapProveedor(item: DataRecord): ReporteProveedorOption | null {
    const id = this.getNumberValue(item, ['Prv_Id', 'prv_Id', 'prvId']);
    const name = this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom']);
    return id && name ? { id, name } : null;
  }

  private mapItem(item: DataRecord): ReporteItemOption | null {
    const id = this.getNumberValue(item, ['Itm_Id', 'itm_Id', 'itmId']);
    const description = this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes']);

    if (!id || !description) {
      return null;
    }

    return {
      id,
      code: this.getTextValue(item, ['Itm_Cod', 'itm_Cod', 'itmCod']) || String(id),
      description
    };
  }

  private buildFileName(): string {
    const start = formatDateRequestValue(this.fechaInicioControl.value);
    const end = formatDateRequestValue(this.fechaFinControl.value);
    return `reporte_ingresos_salidas_almacen_${start}_${end}.xls`;
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
      const rawValue = item[key];
      const value = Number(rawValue);

      if (rawValue !== null && rawValue !== undefined && rawValue !== '' && Number.isFinite(value)) {
        return value;
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

  private getToday(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  private getFirstDayOfCurrentMonth(): Date {
    const today = this.getToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }
}

type DataRecord = Record<string, unknown>;

interface ReporteUsuarioOption {
  code: string;
  name: string;
}

interface ReporteCentroCostoOption {
  id: number;
  code: string;
  description: string;
}

interface ReporteProveedorOption {
  id: number;
  name: string;
}

interface ReporteItemOption {
  id: number;
  code: string;
  description: string;
}

interface ReporteTipoIngresoOption {
  id: number;
  description: string;
}

interface IngresoSalidaAlmacenRow {
  movimientoId: number;
  fecha: string;
  solicitanteCodigo: string;
  solicitante: string;
  registradorCodigo: string;
  registrador: string;
  ubicacion: string;
  tipoIngreso: string;
  centroCosto: string;
  proveedor: string;
  itemCodigo: string;
  itemDescripcion: string;
  cantidad: number;
}
