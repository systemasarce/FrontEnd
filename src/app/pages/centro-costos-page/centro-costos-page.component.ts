import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, CentroCostoFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { CentroCostoEditDialogComponent } from './centro-costo-edit-dialog.component';
import { CentroCostoRegisterDialogComponent } from './centro-costo-register-dialog.component';

type DataRecord = Record<string, unknown>;

interface CentroCostoRow {
  cenCosId: number | null;
  cenCosDes: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-centro-costos-page',
  templateUrl: './centro-costos-page.component.html',
  styleUrls: ['./centro-costos-page.component.scss']
})
export class CentroCostosPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  centrosCosto: CentroCostoRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  private appliedFilters: CentroCostoFiltro = { Flg_Est: 'A' };

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
    this.cargarCentrosCosto();
  }

  cargarCentrosCosto(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();
    this.appliedFilters = { ...filtros };

    this.apiService.getListarCentroCostoActivo(filtros).subscribe({
      next: (response: unknown) => {
        this.centrosCosto = this.extractRecords(response)
          .map((item) => this.mapCentroCosto(item))
          .filter((item) => item.cenCosId !== null || !!item.cenCosDes)
          .sort((left, right) => (left.cenCosId ?? 0) - (right.cenCosId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.centrosCosto.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando centros de costo:', error);
        this.centrosCosto = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de centros de costo. Intenta nuevamente.';
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
    this.cargarCentrosCosto();
  }

  registrarCentroCosto(): void {
    const dialogRef = this.dialog.open(CentroCostoRegisterDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarCentrosCosto();
      }
    });
  }

  editarCentroCosto(centroCosto: CentroCostoRow): void {
    if (centroCosto.cenCosId === null) {
      return;
    }

    const dialogRef = this.dialog.open(CentroCostoEditDialogComponent, {
      width: 'min(32rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { centroCosto }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarCentrosCosto();
      }
    });
  }

  trackByCentroCosto(_index: number, centroCosto: CentroCostoRow): string {
    return centroCosto.cenCosId !== null ? String(centroCosto.cenCosId) : centroCosto.cenCosDes;
  }

  get paginatedCentrosCosto(): CentroCostoRow[] {
    return paginateItems(this.centrosCosto, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.centrosCosto.length, this.pageSize);
  }

  get emptyStateMessage(): string {
    const descripcion = String(this.appliedFilters.Cen_Cos_Des ?? '').trim();
    const codigo = String(this.appliedFilters.Cen_Cos_Id ?? '').trim();
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

  private getFiltros(): CentroCostoFiltro {
    const codigoRaw = this.getCodigoBuscado();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: CentroCostoFiltro = {
      Flg_Est: estado
    };

    if (codigoRaw) {
      const codigo = Number(codigoRaw);

      if (Number.isInteger(codigo) && codigo > 0) {
        filtros.Cen_Cos_Id = codigo;
      }
    }

    if (descripcion) {
      filtros.Cen_Cos_Des = descripcion;
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

    const possibleArrayKeys = ['centrosCosto', 'CentrosCosto', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return this.hasCentroCostoFields(response) ? [response] : [];
  }

  private mapCentroCosto(item: DataRecord): CentroCostoRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      cenCosId: this.getNumberValue(item, ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId', 'id', 'Id']),
      cenCosDes: this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes', 'descripcion', 'Descripcion']),
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

  private hasCentroCostoFields(item: DataRecord): boolean {
    const recordKeys = ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId', 'Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes', 'Flg_Est', 'flg_Est', 'flgEst'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }

  private getEstadoTexto(flgEst?: string): string {
    return String(flgEst || '').toUpperCase() === 'I' ? 'Inactivos' : 'Activos';
  }
}
