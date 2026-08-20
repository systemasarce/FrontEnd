import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, MonedaFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { MonedaEditDialogComponent } from './moneda-edit-dialog.component';
import { MonedaRegisterDialogComponent } from './moneda-register-dialog.component';

type DataRecord = Record<string, unknown>;

interface MonedaRow {
  monId: number | null;
  monDes: string;
  monAbr: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-moneda-page',
  templateUrl: './moneda-page.component.html',
  styleUrls: ['./moneda-page.component.scss']
})
export class MonedaPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  monedas: MonedaRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  private appliedFilters: MonedaFiltro = { Flg_Est: 'A' };

  constructor(
    private readonly apiService: ApiService,
    private readonly formBuilder: FormBuilder,
    private readonly dialog: MatDialog
  ) {
    this.filtersForm = this.formBuilder.group({
      codigo: [''],
      descripcion: [''],
      estado: ['A']
    });
  }

  ngOnInit(): void {
    this.cargarMonedas();
  }

  cargarMonedas(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();
    this.appliedFilters = { ...filtros };

    this.apiService.getListarMoneda(filtros).subscribe({
      next: (response: unknown) => {
        this.monedas = this.extractRecords(response)
          .map((item) => this.mapMoneda(item))
          .filter((item) => item.monId !== null || !!item.monDes || !!item.monAbr)
          .sort((left, right) => (left.monId ?? 0) - (right.monId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.monedas.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando monedas:', error);
        this.monedas = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de monedas. Intenta nuevamente.';
        this.isLoading = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      codigo: '',
      descripcion: '',
      estado: 'A'
    });
    this.cargarMonedas();
  }

  registrarMoneda(): void {
    const dialogRef = this.dialog.open(MonedaRegisterDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarMonedas();
      }
    });
  }

  editarMoneda(moneda: MonedaRow): void {
    if (moneda.monId === null) {
      return;
    }

    const dialogRef = this.dialog.open(MonedaEditDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { moneda }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarMonedas();
      }
    });
  }

  trackByMoneda(_index: number, moneda: MonedaRow): string {
    return moneda.monId !== null ? String(moneda.monId) : `${moneda.monDes}-${moneda.monAbr}`;
  }

  get paginatedMonedas(): MonedaRow[] {
    return paginateItems(this.monedas, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.monedas.length, this.pageSize);
  }

  get emptyStateMessage(): string {
    const descripcion = String(this.appliedFilters.Mon_Des ?? '').trim();
    const codigo = String(this.appliedFilters.Mon_Id ?? '').trim();
    const estado = this.getEstadoTexto(this.appliedFilters.Flg_Est);
    const hasSpecificFilters = Boolean(codigo || descripcion);

    if (hasSpecificFilters) {
      return `No se han encontrado monedas ${estado} con los filtros aplicados.`;
    }

    return `No se han encontrado monedas ${estado}.`;
  }

  sanitizeCodigoInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;

    if (!input) {
      return;
    }

    const sanitizedValue = input.value.replace(/[^\d]/g, '');

    if (sanitizedValue !== input.value) {
      input.value = sanitizedValue;
      this.filtersForm.controls['codigo'].setValue(sanitizedValue, { emitEvent: false });
    }
  }

  private getFiltros(): MonedaFiltro {
    const codigoRaw = this.getCodigoBuscado();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: MonedaFiltro = {
      Flg_Est: estado
    };

    if (codigoRaw) {
      const codigo = Number(codigoRaw);

      if (Number.isInteger(codigo) && codigo > 0) {
        filtros.Mon_Id = codigo;
      }
    }

    if (descripcion) {
      filtros.Mon_Des = descripcion;
    }

    return filtros;
  }

  private getCodigoBuscado(): string {
    return String(this.filtersForm.controls['codigo'].value ?? '').trim();
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    if (response['Success'] === false || response['success'] === false) {
      return [];
    }

    const possibleArrayKeys = ['monedas', 'Monedas', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return this.hasMonedaFields(response) ? [response] : [];
  }

  private mapMoneda(item: DataRecord): MonedaRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      monId: this.getNumberValue(item, ['Mon_Id', 'mon_Id', 'monId', 'id', 'Id']),
      monDes: this.getTextValue(item, ['Mon_Des', 'mon_Des', 'monDes', 'descripcion', 'Descripcion']),
      monAbr: this.getTextValue(item, ['Mon_Abr', 'mon_Abr', 'monAbr', 'abreviatura', 'Abreviatura']),
      flgEst,
      estado: activo ? 'Activo' : 'Inactivo',
      activo
    };
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

      if (Number.isInteger(value)) {
        return value;
      }
    }

    return null;
  }

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasMonedaFields(item: DataRecord): boolean {
    const recordKeys = ['Mon_Id', 'mon_Id', 'monId', 'Mon_Des', 'mon_Des', 'monDes', 'Mon_Abr', 'mon_Abr', 'monAbr', 'Flg_Est', 'flg_Est', 'flgEst'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }

  private getEstadoTexto(flgEst?: string): string {
    return String(flgEst || '').toUpperCase() === 'I' ? 'inactivas' : 'activas';
  }
}
