import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, SubGrupoItemFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { SubGrupoItemEditDialogComponent } from './sub-grupo-item-edit-dialog.component';
import { SubGrupoItemRegisterDialogComponent } from './sub-grupo-item-register-dialog.component';

type DataRecord = Record<string, unknown>;

export interface SubGrupoItemRow {
  subGrpId: number | null;
  subGrpCod: string;
  subGrpDes: string;
  grpId: number | null;
  grpDes: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-sub-grupo-item-page',
  templateUrl: './sub-grupo-item-page.component.html',
  styleUrls: ['./sub-grupo-item-page.component.scss']
})
export class SubGrupoItemPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  subGruposItem: SubGrupoItemRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';
  private appliedFilters: SubGrupoItemFiltro = { Flg_Est: 'A' };

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
    this.cargarSubGrupoItem();
  }

  cargarSubGrupoItem(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();
    this.appliedFilters = { ...filtros };

    this.apiService.getListarSubGrupoItem(filtros).subscribe({
      next: (response: unknown) => {
        this.subGruposItem = this.extractRecords(response)
          .map((item) => this.mapSubGrupoItem(item))
          .sort((left, right) => left.subGrpCod.localeCompare(right.subGrpCod));
        this.currentPage = normalizePaginationPage(this.currentPage, this.subGruposItem.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando sub grupos de item:', error);
        this.subGruposItem = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de sub grupos de item. Intenta nuevamente.';
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
    this.cargarSubGrupoItem();
  }

  registrarSubGrupoItem(): void {
    const dialogRef = this.dialog.open(SubGrupoItemRegisterDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarSubGrupoItem();
      }
    });
  }

  editarSubGrupoItem(subGrupoItem: SubGrupoItemRow): void {
    if (subGrupoItem.subGrpId === null) {
      return;
    }

    const dialogRef = this.dialog.open(SubGrupoItemEditDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { subGrupoItem }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarSubGrupoItem();
      }
    });
  }

  trackBySubGrupoItem(_index: number, subGrupoItem: SubGrupoItemRow): string {
    return subGrupoItem.subGrpId !== null ? String(subGrupoItem.subGrpId) : subGrupoItem.subGrpCod;
  }

  get paginatedSubGruposItem(): SubGrupoItemRow[] {
    return paginateItems(this.subGruposItem, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.subGruposItem.length, this.pageSize);
  }

  get emptyStateMessage(): string {
    const codigo = String(this.appliedFilters.Sub_Grp_Cod ?? '').trim();
    const descripcion = String(this.appliedFilters.Sub_Grp_Des ?? '').trim();
    const estado = this.getEstadoTexto(this.appliedFilters.Flg_Est);
    const hasSpecificFilters = Boolean(codigo || descripcion);

    if (hasSpecificFilters) {
      return `No se encontraron sub grupos de item ${estado.toLowerCase()} con los filtros aplicados.`;
    }

    return `No se encontraron sub grupos de item ${estado.toLowerCase()} para mostrar.`;
  }

  private getFiltros(): SubGrupoItemFiltro {
    const codigo = String(this.filtersForm.controls['codigo'].value ?? '').trim();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: SubGrupoItemFiltro = {
      Flg_Est: estado
    };

    if (codigo) {
      filtros.Sub_Grp_Cod = codigo;
    }

    if (descripcion) {
      filtros.Sub_Grp_Des = descripcion;
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

    const possibleArrayKeys = ['subGrupoItems', 'SubGrupoItems', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return this.looksLikeSubGrupoItemRecord(response) ? [response] : [];
  }

  private mapSubGrupoItem(item: DataRecord): SubGrupoItemRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      subGrpId: this.getNumberValue(item, ['Sub_Grp_Id', 'sub_Grp_Id', 'subGrpId', 'id', 'Id']),
      subGrpCod: this.getTextValue(item, ['Sub_Grp_Cod', 'sub_Grp_Cod', 'subGrpCod', 'codigo', 'Codigo']),
      subGrpDes: this.getTextValue(item, ['Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes', 'descripcion', 'Descripcion']),
      grpId: this.getNumberValue(item, ['Grp_Id', 'grp_Id', 'grpId', 'GrpId', 'grp_id', 'grupoId', 'GrupoId']),
      grpDes: this.getTextValue(item, ['Grp_Des', 'grp_Des', 'grpDes', 'grupo', 'Grupo']),
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

  private getEstadoTexto(flgEst: string | undefined): string {
    const estado = String(flgEst ?? 'A').trim().toUpperCase();
    return estado === 'I' ? 'inactivos' : 'activos';
  }

  private looksLikeSubGrupoItemRecord(item: DataRecord): boolean {
    const recordKeys = ['Sub_Grp_Id', 'sub_Grp_Id', 'subGrpId', 'Sub_Grp_Cod', 'sub_Grp_Cod', 'subGrpCod', 'Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes'];
    return recordKeys.some((key) => Object.prototype.hasOwnProperty.call(item, key));
  }
}
