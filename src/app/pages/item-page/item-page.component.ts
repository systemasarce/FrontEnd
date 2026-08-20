import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { ApiService, GrupoItemFiltro, ItemFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { ItemEditDialogComponent } from './item-edit-dialog.component';
import { ItemRegisterDialogComponent } from './item-register-dialog.component';

type DataRecord = Record<string, unknown>;

interface GrupoItemOption {
  grpId: number;
  grpDes: string;
}

interface FilterOption {
  id: number;
  descripcion: string;
}

interface ItemRow {
  itmId: number | null;
  itmCod: string;
  itmDes: string;
  itmGrp: number | null;
  grpDes: string;
  itmSubGrp: number | null;
  subGrpDes: string;
  itmDetMatId: number | null;
  detMatDes: string;
  uniMedId: number | null;
  uniMedDes: string;
  flgEst: string;
  estado: string;
  activo: boolean;
}

@Component({
  selector: 'app-item-page',
  templateUrl: './item-page.component.html',
  styleUrls: ['./item-page.component.scss']
})
export class ItemPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  items: ItemRow[] = [];
  gruposItem: GrupoItemOption[] = [];
  subGruposItem: FilterOption[] = [];
  detallesMaterial: FilterOption[] = [];
  currentPage = 1;
  isLoading = false;
  isLoadingSubGrupos = false;
  isLoadingDetallesMaterial = false;
  errorMessage = '';

  constructor(
    private readonly apiService: ApiService,
    private readonly formBuilder: FormBuilder,
    private readonly dialog: MatDialog,
    private readonly router: Router
  ) {
    this.filtersForm = this.formBuilder.group({
      codigo: [''],
      descripcion: [''],
      grupo: [null],
      subGrupo: [null],
      detalleMaterial: [null],
      estado: ['A']
    });
  }

  ngOnInit(): void {
    this.cargarGruposItem();
    this.cargarItems();
  }

  cargarItems(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros = this.getFiltros();

    console.log('Buscar items - filtros enviados:', filtros);

    this.apiService.getListarItem(filtros).subscribe({
      next: (response: unknown) => {
        this.items = this.extractRecords(response)
          .map((item) => this.mapItem(item))
          .sort((left, right) => (left.itmId ?? 0) - (right.itmId ?? 0));
        this.currentPage = normalizePaginationPage(this.currentPage, this.items.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando items:', error);
        this.items = [];
        this.currentPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de items. Intenta nuevamente.';
        this.isLoading = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      codigo: '',
      descripcion: '',
      grupo: null,
      subGrupo: null,
      detalleMaterial: null,
      estado: 'A'
    });
    this.subGruposItem = [];
    this.detallesMaterial = [];
    this.cargarItems();
  }

  onGrupoFiltroChange(): void {
    this.filtersForm.patchValue({ subGrupo: null, detalleMaterial: null });
    this.subGruposItem = [];
    this.detallesMaterial = [];
    const grupoId = Number(this.filtersForm.controls['grupo'].value);

    if (!Number.isInteger(grupoId) || grupoId <= 0) {
      return;
    }

    this.isLoadingSubGrupos = true;
    this.apiService.getListarSubGrupoItemPorGrpId(grupoId).subscribe({
      next: (response: unknown) => {
        this.subGruposItem = this.extractRecords(response)
          .map((item) => ({
            id: this.getNumberValue(item, ['Sub_Grp_Id', 'sub_Grp_Id', 'subGrpId']) ?? 0,
            descripcion: this.getTextValue(item, ['Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes'])
          }))
          .filter((item) => item.id > 0)
          .sort((left, right) => left.descripcion.localeCompare(right.descripcion));
        this.isLoadingSubGrupos = false;
      },
      error: () => {
        this.subGruposItem = [];
        this.isLoadingSubGrupos = false;
      }
    });
  }

  onSubGrupoFiltroChange(): void {
    this.filtersForm.patchValue({ detalleMaterial: null });
    this.detallesMaterial = [];
    const grupoId = Number(this.filtersForm.controls['grupo'].value);
    const subGrupoId = Number(this.filtersForm.controls['subGrupo'].value);

    if (!Number.isInteger(grupoId) || grupoId <= 0 || !Number.isInteger(subGrupoId) || subGrupoId <= 0) {
      return;
    }

    this.isLoadingDetallesMaterial = true;
    this.apiService.getItemDetalleMaterialEntity(grupoId, subGrupoId).subscribe({
      next: (response: unknown) => {
        this.detallesMaterial = this.extractRecords(response)
          .map((item) => ({
            id: this.getNumberValue(item, ['Det_Mat_Id', 'det_Mat_Id', 'detMatId']) ?? 0,
            descripcion: this.getTextValue(item, ['Det_Mat_Des', 'det_Mat_Des', 'detMatDes'])
          }))
          .filter((item) => item.id > 0)
          .sort((left, right) => left.descripcion.localeCompare(right.descripcion));
        this.isLoadingDetallesMaterial = false;
      },
      error: () => {
        this.detallesMaterial = [];
        this.isLoadingDetallesMaterial = false;
      }
    });
  }

  registrarItem(): void {
    const dialogRef = this.dialog.open(ItemRegisterDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarItems();
      }
    });
  }

  verArbolDeGrupos(): void {
    this.router.navigate(['/item-arbol']);
  }

  editarItem(item: ItemRow): void {
    if (item.itmId === null || item.itmGrp === null) {
      return;
    }

    const dialogRef = this.dialog.open(ItemEditDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: { item }
    });

    dialogRef.afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarItems();
      }
    });
  }

  trackByItem(_index: number, item: ItemRow): string {
    return item.itmId !== null ? String(item.itmId) : `${item.itmDes}-${item.itmGrp ?? 'sin-grupo'}`;
  }

  get paginatedItems(): ItemRow[] {
    return paginateItems(this.items, this.currentPage, this.pageSize);
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.items.length, this.pageSize);
  }

  trackByGrupo(_index: number, grupo: GrupoItemOption): string {
    return String(grupo.grpId);
  }

  private cargarGruposItem(): void {
    const filtros: GrupoItemFiltro = {};

    this.apiService.getListarGrupoItem(filtros).subscribe({
      next: (response: unknown) => {
        this.gruposItem = this.extractRecords(response)
          .map((item) => this.mapGrupoItem(item))
          .filter((grupo) => grupo.grpId > 0)
          .sort((left, right) => left.grpDes.localeCompare(right.grpDes));
      },
      error: (error: unknown) => {
        console.error('Error cargando grupos de item:', error);
        this.gruposItem = [];
      }
    });
  }

  private getFiltros(): ItemFiltro {
    const codigo = String(this.filtersForm.controls['codigo'].value ?? '').trim();
    const descripcion = String(this.filtersForm.controls['descripcion'].value ?? '').trim();
    const grupoId = Number(this.filtersForm.controls['grupo'].value);
    const subGrupoId = Number(this.filtersForm.controls['subGrupo'].value);
    const detalleMaterialId = Number(this.filtersForm.controls['detalleMaterial'].value);
    const estado = String(this.filtersForm.controls['estado'].value ?? '').trim() || 'A';
    const filtros: ItemFiltro = {
      Flg_Est: estado
    };

    if (codigo) {
      filtros.Itm_Cod = codigo;
    }

    if (descripcion) {
      filtros.Itm_Des = descripcion;
    }

    if (Number.isInteger(grupoId) && grupoId > 0) {
      filtros.Itm_Grp = grupoId;
    }

    if (Number.isInteger(subGrupoId) && subGrupoId > 0) {
      filtros.Itm_Sub_Grp = subGrupoId;
    }

    if (Number.isInteger(detalleMaterialId) && detalleMaterialId > 0) {
      filtros.Itm_Det_Mat_Id = detalleMaterialId;
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

    const possibleArrayKeys = ['items', 'Items', 'grupoItems', 'GrupoItems', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return [response];
  }

  private mapItem(item: DataRecord): ItemRow {
    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    const activo = flgEst.toUpperCase() === 'A';

    return {
      itmId: this.getNumberValue(item, ['Itm_Id', 'itm_Id', 'itmId', 'id', 'Id']),
      itmCod: this.getTextValue(item, ['Itm_Cod', 'itm_Cod', 'itmCod']),
      itmDes: this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes', 'descripcion', 'Descripcion']),
      itmGrp: this.getNumberValue(item, ['Itm_Grp', 'itm_Grp', 'itmGrp', 'grpId', 'Grp_Id']),
      grpDes: this.getTextValue(item, ['Grp_Des', 'grp_Des', 'grpDes', 'grupo', 'Grupo']),
      itmSubGrp: this.getNumberValue(item, ['Itm_Sub_Grp', 'itm_Sub_Grp', 'itmSubGrp', 'Sub_Grp_Id', 'sub_Grp_Id']),
      subGrpDes: this.getTextValue(item, ['Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes']),
      itmDetMatId: this.getNumberValue(item, ['Itm_Det_Mat_Id', 'itm_Det_Mat_Id', 'itmDetMatId', 'Det_Mat_Id', 'det_Mat_Id']),
      detMatDes: this.getTextValue(item, ['Det_Mat_Des', 'det_Mat_Des', 'detMatDes']),
      uniMedId: this.getNumberValue(item, ['Uni_Med_Id', 'uni_Med_Id', 'uniMedId']),
      uniMedDes: this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes']),
      flgEst,
      estado: activo ? 'Activo' : 'Inactivo',
      activo
    };
  }

  private mapGrupoItem(item: DataRecord): GrupoItemOption {
    return {
      grpId: this.getNumberValue(item, ['Grp_Id', 'grp_Id', 'grpId', 'id', 'Id']) ?? 0,
      grpDes: this.getTextValue(item, ['Grp_Des', 'grp_Des', 'grpDes', 'descripcion', 'Descripcion'])
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
}
