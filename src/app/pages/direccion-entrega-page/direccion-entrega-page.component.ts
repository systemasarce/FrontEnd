import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, DireccionEntregaFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { DireccionEntregaEditDialogComponent } from './direccion-entrega-edit-dialog.component';
import { DireccionEntregaRegisterDialogComponent } from './direccion-entrega-register-dialog.component';

type DataRecord = Record<string, unknown>;

export interface DireccionEntregaRow {
  dirId: number | null;
  dirDes: string;
  dirUbi: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-direccion-entrega-page',
  templateUrl: './direccion-entrega-page.component.html',
  styleUrls: ['./direccion-entrega-page.component.scss']
})
export class DireccionEntregaPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  direccionesEntrega: DireccionEntregaRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  private appliedFilters: DireccionEntregaFiltro = { Flg_Est: 'A' };

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
    this.cargarDireccionesEntrega();
  }

  cargarDireccionesEntrega(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();
    this.appliedFilters = { ...filtros };

    this.apiService.getListarDireccionEntregaActivo(filtros).subscribe({
      next: (response: unknown) => {
        this.direccionesEntrega = this.extractRecords(response)
          .map((item) => this.mapDireccionEntrega(item))
          .filter((item) => item.dirId !== null || !!item.dirDes)
          .sort((left, right) => (left.dirId ?? 0) - (right.dirId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.direccionesEntrega.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando direcciones de entrega:', error);
        this.direccionesEntrega = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de direcciones de entrega. Intenta nuevamente.';
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
    this.cargarDireccionesEntrega();
  }

  registrarDireccionEntrega(): void {
    const dialogRef = this.dialog.open(DireccionEntregaRegisterDialogComponent, {
      width: 'min(36rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarDireccionesEntrega();
      }
    });
  }

  editarDireccionEntrega(direccionEntrega: DireccionEntregaRow): void {
    if (direccionEntrega.dirId === null) {
      return;
    }

    const dialogRef = this.dialog.open(DireccionEntregaEditDialogComponent, {
      width: 'min(36rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { direccionEntrega }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarDireccionesEntrega();
      }
    });
  }

  trackByDireccionEntrega(_index: number, direccionEntrega: DireccionEntregaRow): string {
    return direccionEntrega.dirId !== null ? String(direccionEntrega.dirId) : direccionEntrega.dirDes;
  }

  get paginatedDireccionesEntrega(): DireccionEntregaRow[] {
    return paginateItems(this.direccionesEntrega, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.direccionesEntrega.length, this.pageSize);
  }

  get emptyStateMessage(): string {
    const descripcion = String(this.appliedFilters.Dir_Des ?? '').trim();
    const codigo = String(this.appliedFilters.Dir_Id ?? '').trim();
    const estado = this.getEstadoTexto(this.appliedFilters.Flg_Est);
    const hasSpecificFilters = Boolean(codigo || descripcion);

    if (hasSpecificFilters) {
      return `No se han encontrado ${estado.toLowerCase()} con los filtros aplicados.`;
    }

    return `No se han encontrado ${estado.toLowerCase()}.`;
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

  private getFiltros(): DireccionEntregaFiltro {
    const codigoRaw = String(this.filtersForm.controls['codigo'].value ?? '').trim();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: DireccionEntregaFiltro = {
      Flg_Est: estado
    };

    if (codigoRaw) {
      const codigo = Number(codigoRaw);

      if (Number.isInteger(codigo) && codigo > 0) {
        filtros.Dir_Id = codigo;
      }
    }

    if (descripcion) {
      filtros.Dir_Des = descripcion;
    }

    return filtros;
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

    const possibleArrayKeys = ['direccionesEntrega', 'DireccionesEntrega', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return this.hasDireccionEntregaFields(response) ? [response] : [];
  }

  private mapDireccionEntrega(item: DataRecord): DireccionEntregaRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      dirId: this.getNumberValue(item, ['Dir_Id', 'dir_Id', 'dirId', 'id', 'Id']),
      dirDes: this.getTextValue(item, ['Dir_Des', 'dir_Des', 'dirDes', 'descripcion', 'Descripcion']),
      dirUbi: this.getTextValue(item, ['Dir_Ubi', 'dir_Ubi', 'dirUbi', 'ubicacion', 'Ubicacion']),
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

  private hasDireccionEntregaFields(item: DataRecord): boolean {
    const recordKeys = ['Dir_Id', 'dir_Id', 'dirId', 'Dir_Des', 'dir_Des', 'dirDes', 'Dir_Ubi', 'dir_Ubi', 'dirUbi', 'Flg_Est', 'flg_Est', 'flgEst'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }

  private getEstadoTexto(flgEst?: string): string {
    return String(flgEst || '').toUpperCase() === 'I' ? 'Inactivas' : 'Activas';
  }
}
