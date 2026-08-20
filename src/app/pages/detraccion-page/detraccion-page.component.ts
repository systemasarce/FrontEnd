import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, DetraccionFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { DetraccionEditDialogComponent } from './detraccion-edit-dialog.component';
import { DetraccionRegisterDialogComponent } from './detraccion-register-dialog.component';

type DataRecord = Record<string, unknown>;

export interface DetraccionRow {
  detId: number | null;
  detDes: string;
  detPor: number | null;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-detraccion-page',
  templateUrl: './detraccion-page.component.html',
  styleUrls: ['./detraccion-page.component.scss']
})
export class DetraccionPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  detracciones: DetraccionRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  private appliedFilters: DetraccionFiltro = { Flg_Est: 'A' };

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
    this.cargarDetracciones();
  }

  cargarDetracciones(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();
    this.appliedFilters = { ...filtros };

    this.apiService.getListarDetraccion(filtros).subscribe({
      next: (response: unknown) => {
        this.detracciones = this.extractRecords(response)
          .map((item) => this.mapDetraccion(item))
          .filter((item) => item.detId !== null || !!item.detDes)
          .sort((left, right) => (left.detId ?? 0) - (right.detId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.detracciones.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando detracciones:', error);
        this.detracciones = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de detracciones. Intenta nuevamente.';
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
    this.cargarDetracciones();
  }

  registrarDetraccion(): void {
    const dialogRef = this.dialog.open(DetraccionRegisterDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarDetracciones();
      }
    });
  }

  editarDetraccion(detraccion: DetraccionRow): void {
    if (detraccion.detId === null) {
      return;
    }

    const dialogRef = this.dialog.open(DetraccionEditDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { detraccion }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarDetracciones();
      }
    });
  }

  trackByDetraccion(_index: number, detraccion: DetraccionRow): string {
    return detraccion.detId !== null ? String(detraccion.detId) : detraccion.detDes;
  }

  get paginatedDetracciones(): DetraccionRow[] {
    return paginateItems(this.detracciones, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.detracciones.length, this.pageSize);
  }

  get emptyStateMessage(): string {
    const descripcion = String(this.appliedFilters.Det_Des ?? '').trim();
    const codigo = String(this.appliedFilters.Det_Id ?? '').trim();
    const estado = this.getEstadoTexto(this.appliedFilters.Flg_Est);
    const hasSpecificFilters = Boolean(codigo || descripcion);

    if (hasSpecificFilters) {
      return `No se han encontrado detracciones ${estado.toLowerCase()} con los filtros aplicados.`;
    }

    return `No se han encontrado detracciones ${estado.toLowerCase()}.`;
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

  formatPorcentaje(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
  }

  private getFiltros(): DetraccionFiltro {
    const codigoRaw = this.getCodigoBuscado();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: DetraccionFiltro = {
      Flg_Est: estado
    };

    if (codigoRaw) {
      const codigo = Number(codigoRaw);

      if (Number.isInteger(codigo) && codigo > 0) {
        filtros.Det_Id = codigo;
      }
    }

    if (descripcion) {
      filtros.Det_Des = descripcion;
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

    const possibleArrayKeys = ['detracciones', 'Detracciones', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return this.hasDetraccionFields(response) ? [response] : [];
  }

  private mapDetraccion(item: DataRecord): DetraccionRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      detId: this.getNumberValue(item, ['Det_Id', 'det_Id', 'detId', 'id', 'Id']),
      detDes: this.getTextValue(item, ['Det_Des', 'det_Des', 'detDes', 'descripcion', 'Descripcion']),
      detPor: this.getDecimalValue(item, ['Det_Por', 'det_Por', 'detPor', 'porcentaje', 'Porcentaje']),
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

  private getDecimalValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);

      if (Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasDetraccionFields(item: DataRecord): boolean {
    const recordKeys = ['Det_Id', 'det_Id', 'detId', 'Det_Des', 'det_Des', 'detDes', 'Det_Por', 'det_Por', 'detPor', 'Flg_Est', 'flg_Est', 'flgEst'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }

  private getEstadoTexto(flgEst?: string): string {
    return String(flgEst || '').toUpperCase() === 'I' ? 'inactivas' : 'activas';
  }
}
