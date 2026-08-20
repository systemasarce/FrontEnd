import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { formatDateRequestValue, formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';

@Component({
  selector: 'app-asignaciones-usuarios-reporte-page',
  templateUrl: './asignaciones-usuarios-reporte-page.component.html',
  styleUrls: [
    './kardex-general-reporte-page.component.scss',
    './ingreso-salidas-almacen-reporte-page.component.scss'
  ]
})
export class AsignacionesUsuariosReportePageComponent implements OnInit {
  readonly fechaInicioControl = new FormControl(this.getFirstDayOfCurrentMonth(), { nonNullable: true });
  readonly fechaFinControl = new FormControl(this.getToday(), { nonNullable: true });
  readonly asignacionControl = new FormControl<number | null>(null);
  readonly estadoControl = new FormControl('A', { nonNullable: true });
  readonly usuarioAsignadoControl = new FormControl('', { nonNullable: true });
  readonly usuarioRegistroControl = new FormControl('', { nonNullable: true });
  readonly centroCostoControl = new FormControl(0, { nonNullable: true });
  readonly itemControl = new FormControl(0, { nonNullable: true });
  readonly usuarioAsignadoSearchControl = new FormControl('', { nonNullable: true });
  readonly usuarioRegistroSearchControl = new FormControl('', { nonNullable: true });
  readonly centroCostoSearchControl = new FormControl('', { nonNullable: true });
  readonly itemSearchControl = new FormControl('', { nonNullable: true });
  readonly estados: ReporteEstadoOption[] = [
    { code: '', description: 'Todos los estados' },
    { code: 'A', description: 'Activo' },
    { code: 'I', description: 'Inactivo' }
  ];

  usuarios: ReporteUsuarioOption[] = [];
  centrosCosto: ReporteCentroCostoOption[] = [];
  items: ReporteItemOption[] = [];
  rows: AsignacionUsuarioRow[] = [];
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

  get filteredUsuariosAsignados(): ReporteUsuarioOption[] {
    return this.filterUsuarios(this.usuarioAsignadoSearchControl.value);
  }

  get filteredUsuariosRegistro(): ReporteUsuarioOption[] {
    return this.filterUsuarios(this.usuarioRegistroSearchControl.value);
  }

  get filteredCentrosCosto(): ReporteCentroCostoOption[] {
    const search = this.centroCostoSearchControl.value.trim().toLowerCase();
    return search
      ? this.centrosCosto.filter((item) =>
          [item.code, item.description].some((value) => value.toLowerCase().includes(search))
        )
      : this.centrosCosto;
  }

  get filteredItems(): ReporteItemOption[] {
    const search = this.itemSearchControl.value.trim().toLowerCase();
    return search
      ? this.items.filter((item) =>
          [item.code, item.description].some((value) => value.toLowerCase().includes(search))
        )
      : this.items;
  }

  get paginatedRows(): AsignacionUsuarioRow[] {
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
    const asignacionId = this.normalizeFilterNumber(this.asignacionControl.value);

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

    if (asignacionId === null) {
      this.rows = [];
      this.errorMessage = 'El ID de asignación debe ser un número entero positivo.';
      return;
    }

    this.isLoadingGrid = true;
    this.errorMessage = '';
    this.currentPage = 1;

    this.apiService.getReporteAsignacionUsuario(
      this.estadoControl.value,
      this.usuarioAsignadoControl.value.trim(),
      this.usuarioRegistroControl.value.trim(),
      Number(this.centroCostoControl.value || 0),
      asignacionId,
      Number(this.itemControl.value || 0),
      fechaInicio,
      fechaFin
    ).subscribe({
      next: (response: unknown) => {
        this.rows = this.extractRecords(response)
          .map((item) => this.mapRow(item))
          .filter((item): item is AsignacionUsuarioRow => item !== null);
        this.currentPage = normalizePaginationPage(1, this.rows.length, this.pageSize);
        this.isLoadingGrid = false;
      },
      error: (error: unknown) => {
        this.rows = [];
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el reporte de asignaciones por usuario.');
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
      'Asignación',
      'Fecha',
      'Cód. usuario asignado',
      'Usuario asignado',
      'Centro de costo',
      'Cód. registrador',
      'Registrado por',
      'ID ítem',
      'Cód. ítem',
      'Descripción ítem',
      'Cantidad'
    ];
    const body = this.rows
      .map((row) => `<Row>${[
        row.asignacionId,
        row.fecha,
        row.usuarioAsignadoCodigo,
        row.usuarioAsignado,
        row.centroCosto,
        row.usuarioRegistroCodigo,
        row.usuarioRegistro,
        row.itemId,
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
  <Worksheet ss:Name="Asignaciones usuarios">
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

  trackByRow(index: number, row: AsignacionUsuarioRow): string {
    return `${row.asignacionId}-${row.itemId}-${index}`;
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  trackByUsuario(_: number, item: ReporteUsuarioOption): string {
    return item.code;
  }

  trackByEstado(_: number, item: ReporteEstadoOption): string {
    return item.code;
  }

  private cargarCatalogos(): void {
    this.isLoadingCatalogos = true;

    forkJoin({
      usuarios: this.apiService.getListarUsuarioActivo({ Flg_Est: 'A' }),
      centrosCosto: this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }),
      items: this.apiService.getListarItem({ Flg_Est: 'A' })
    }).subscribe({
      next: ({ usuarios, centrosCosto, items }) => {
        this.usuarios = this.extractRecords(usuarios)
          .map((item) => this.mapUsuario(item))
          .filter((item): item is ReporteUsuarioOption => item !== null)
          .sort((left, right) => left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }));
        this.centrosCosto = this.extractRecords(centrosCosto)
          .map((item) => this.mapCentroCosto(item))
          .filter((item): item is ReporteCentroCostoOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description, 'es', { sensitivity: 'base' }));
        this.items = this.extractRecords(items)
          .map((item) => this.mapItem(item))
          .filter((item): item is ReporteItemOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description, 'es', { sensitivity: 'base' }));
        this.isLoadingCatalogos = false;
      },
      error: () => {
        this.usuarios = [];
        this.centrosCosto = [];
        this.items = [];
        this.isLoadingCatalogos = false;
      }
    });
  }

  private mapRow(item: DataRecord): AsignacionUsuarioRow | null {
    const asignacionId = this.getNumberValue(item, ['Asg_Id', 'asg_Id', 'asgId']);
    const itemId = this.getNumberValue(item, ['Asg_Det_Itm_Id', 'asg_Det_Itm_Id', 'asgDetItmId']);

    if (!asignacionId && !itemId) {
      return null;
    }

    return {
      asignacionId: asignacionId ?? 0,
      fecha: formatDisplayDate(this.getTextValue(item, ['Asg_Fec', 'asg_Fec', 'asgFec'])) || '-',
      usuarioAsignadoCodigo: this.getTextValue(item, ['Asg_Usr', 'asg_Usr', 'asgUsr']) || '-',
      usuarioAsignado: this.getTextValue(item, ['Usr_Asignacion', 'usr_Asignacion', 'usrAsignacion']) || '-',
      centroCostoId: this.getNumberValue(item, ['Asg_Usr_Cen_Cos', 'asg_Usr_Cen_Cos', 'asgUsrCenCos']) ?? 0,
      centroCosto: this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']) || '-',
      usuarioRegistroCodigo: this.getTextValue(item, ['Usr_Reg', 'usr_Reg', 'usrReg']) || '-',
      usuarioRegistro: this.getTextValue(item, ['Usr_Registro', 'usr_Registro', 'usrRegistro']) || '-',
      itemId: itemId ?? 0,
      itemCodigo: this.getTextValue(item, ['Itm_Cod', 'itm_Cod', 'itmCod']) || '-',
      itemDescripcion: this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes']) || '-',
      cantidad: this.getDecimalValue(item, ['Asg_Det_Can', 'asg_Det_Can', 'asgDetCan']) ?? 0
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

  private filterUsuarios(searchValue: string): ReporteUsuarioOption[] {
    const search = searchValue.trim().toLowerCase();
    return search
      ? this.usuarios.filter((item) =>
          [item.code, item.name].some((value) => value.toLowerCase().includes(search))
        )
      : this.usuarios;
  }

  private normalizeFilterNumber(value: number | null): number | null {
    if (value === null || value === undefined) {
      return 0;
    }

    const numberValue = Number(value);
    return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null;
  }

  private buildFileName(): string {
    const start = formatDateRequestValue(this.fechaInicioControl.value);
    const end = formatDateRequestValue(this.fechaFinControl.value);
    return `reporte_asignaciones_usuarios_${start}_${end}.xls`;
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

interface ReporteEstadoOption {
  code: string;
  description: string;
}

interface ReporteUsuarioOption {
  code: string;
  name: string;
}

interface ReporteCentroCostoOption {
  id: number;
  code: string;
  description: string;
}

interface ReporteItemOption {
  id: number;
  code: string;
  description: string;
}

interface AsignacionUsuarioRow {
  asignacionId: number;
  fecha: string;
  usuarioAsignadoCodigo: string;
  usuarioAsignado: string;
  centroCostoId: number;
  centroCosto: string;
  usuarioRegistroCodigo: string;
  usuarioRegistro: string;
  itemId: number;
  itemCodigo: string;
  itemDescripcion: string;
  cantidad: number;
}
