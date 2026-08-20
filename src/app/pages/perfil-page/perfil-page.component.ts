import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, PerfilFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { PerfilAccesosDialogComponent } from './perfil-accesos-dialog.component';

type DataRecord = Record<string, unknown>;

export interface PerfilRow {
  prfCod: string;
  prfDes: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-perfil-page',
  templateUrl: './perfil-page.component.html',
  styleUrls: ['./perfil-page.component.scss']
})
export class PerfilPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  perfiles: PerfilRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  private appliedFilters: PerfilFiltro = { Flg_Est: 'A' };

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
    this.cargarPerfiles();
  }

  cargarPerfiles(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();
    this.appliedFilters = { ...filtros };

    this.apiService.getListarPerfil(filtros).subscribe({
      next: (response: unknown) => {
        this.perfiles = this.extractRecords(response)
          .map((item) => this.mapPerfil(item))
          .filter((item) => !!item.prfCod || !!item.prfDes)
          .sort((left, right) => left.prfCod.localeCompare(right.prfCod));
        this.currentPage = normalizePaginationPage(this.currentPage, this.perfiles.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando perfiles:', error);
        this.perfiles = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de perfiles. Intenta nuevamente.';
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
    this.cargarPerfiles();
  }

  registrarPerfil(): void {
    this.errorMessage = 'El registro de perfiles se habilitara cuando este disponible el endpoint de registro.';
  }

  abrirAccesosPerfil(perfil: PerfilRow): void {
    this.dialog.open(PerfilAccesosDialogComponent, {
      width: 'min(38rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { perfil }
    });
  }

  trackByPerfil(_index: number, perfil: PerfilRow): string {
    return perfil.prfCod || perfil.prfDes;
  }

  get paginatedPerfiles(): PerfilRow[] {
    return paginateItems(this.perfiles, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.perfiles.length, this.pageSize);
  }

  get emptyStateMessage(): string {
    const descripcion = String(this.appliedFilters.Prf_Des ?? '').trim();
    const codigo = String(this.appliedFilters.Prf_Cod ?? '').trim();
    const estado = this.getEstadoTexto(this.appliedFilters.Flg_Est);
    const hasSpecificFilters = Boolean(codigo || descripcion);

    if (hasSpecificFilters) {
      return `No se han encontrado perfiles ${estado.toLowerCase()} con los filtros aplicados.`;
    }

    return `No se han encontrado perfiles ${estado.toLowerCase()}.`;
  }

  private getFiltros(): PerfilFiltro {
    const codigo = String(this.filtersForm.controls['codigo'].value ?? '').trim();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: PerfilFiltro = {
      Flg_Est: estado
    };

    if (codigo) {
      filtros.Prf_Cod = codigo;
    }

    if (descripcion) {
      filtros.Prf_Des = descripcion;
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

    const possibleArrayKeys = ['perfiles', 'Perfiles', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return this.hasPerfilFields(response) ? [response] : [];
  }

  private mapPerfil(item: DataRecord): PerfilRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      prfCod: this.getTextValue(item, ['Prf_Cod', 'prf_Cod', 'prfCod', 'codigo', 'Codigo']),
      prfDes: this.getTextValue(item, ['Prf_Des', 'prf_Des', 'prfDes', 'descripcion', 'Descripcion']),
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

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hasPerfilFields(item: DataRecord): boolean {
    const recordKeys = ['Prf_Cod', 'prf_Cod', 'prfCod', 'Prf_Des', 'prf_Des', 'prfDes', 'Flg_Est', 'flg_Est', 'flgEst'];
    return recordKeys.some((key) => item[key] !== undefined && item[key] !== null);
  }

  private getEstadoTexto(flgEst?: string): string {
    return String(flgEst || '').toUpperCase() === 'I' ? 'inactivos' : 'activos';
  }
}
