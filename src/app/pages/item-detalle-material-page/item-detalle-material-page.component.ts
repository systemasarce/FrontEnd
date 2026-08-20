import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ApiService, ItemDetalleMaterialFiltro } from 'src/app/Services/api.services';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { ItemDetalleMaterialEditDialogComponent } from './item-detalle-material-edit-dialog.component';
import { ItemDetalleMaterialRegisterDialogComponent } from './item-detalle-material-register-dialog.component';

type DataRecord = Record<string, unknown>;
export interface ItemDetalleMaterialRow {
  id: number | null; codigo: string; descripcion: string; grupoId: number | null;
  grupo: string; subGrupoId: number | null; subGrupo: string; flgEst: string; estado: string; activo: boolean;
}

@Component({
  selector: 'app-item-detalle-material-page',
  templateUrl: './item-detalle-material-page.component.html',
  styleUrls: ['../sub-grupo-item-page/sub-grupo-item-page.component.scss']
})
export class ItemDetalleMaterialPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  items: ItemDetalleMaterialRow[] = [];
  currentPage = 1;
  isLoading = false;
  errorMessage = '';

  constructor(private api: ApiService, private fb: FormBuilder, private dialog: MatDialog) {
    this.filtersForm = fb.group({ codigo: [''], descripcion: [''], estado: ['A'] });
  }

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const filtros: ItemDetalleMaterialFiltro = {
      Det_Mat_Cod: String(this.filtersForm.value.codigo || '').trim() || undefined,
      Det_Mat_Des: String(this.filtersForm.value.descripcion || '').trim() || undefined,
      Flg_Est: String(this.filtersForm.value.estado || 'A')
    };
    this.api.getListarItemDetalleMaterial(filtros).subscribe({
      next: (response) => {
        this.items = this.records(response).map((item) => this.map(item));
        this.currentPage = normalizePaginationPage(this.currentPage, this.items.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando detalle de materiales:', error);
        this.items = [];
        this.errorMessage = 'No se pudo cargar el detalle de materiales.';
        this.isLoading = false;
      }
    });
  }

  limpiar(): void { this.filtersForm.reset({ codigo: '', descripcion: '', estado: 'A' }); this.cargar(); }
  nuevo(): void {
    this.dialog.open(ItemDetalleMaterialRegisterDialogComponent, {
      width: 'min(34rem, 92vw)', disableClose: true, panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop', autoFocus: false
    }).afterClosed().subscribe((ok) => { if (ok) this.cargar(); });
  }
  editar(item: ItemDetalleMaterialRow): void {
    if (item.id === null) return;
    this.dialog.open(ItemDetalleMaterialEditDialogComponent, {
      width: 'min(34rem, 92vw)', disableClose: true, panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop', autoFocus: false, data: { item }
    }).afterClosed().subscribe((ok) => { if (ok) this.cargar(); });
  }
  get paginatedItems(): ItemDetalleMaterialRow[] { return paginateItems(this.items, this.currentPage, this.pageSize); }
  onPageChange(page: number): void { this.currentPage = normalizePaginationPage(page, this.items.length, this.pageSize); }
  trackByItem(_: number, item: ItemDetalleMaterialRow): string { return String(item.id ?? item.codigo); }

  private map(item: DataRecord): ItemDetalleMaterialRow {
    const flgEst = this.text(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    return {
      id: this.number(item, ['Det_Mat_Id', 'det_Mat_Id', 'detMatId', 'id', 'Id']),
      codigo: this.text(item, ['Det_Mat_Cod', 'det_Mat_Cod', 'detMatCod']),
      descripcion: this.text(item, ['Det_Mat_Des', 'det_Mat_Des', 'detMatDes']),
      grupoId: this.number(item, ['Grp_Id', 'grp_Id', 'grpId']),
      grupo: this.text(item, ['Grp_Des', 'grp_Des', 'grpDes']),
      subGrupoId: this.number(item, ['Sub_Grp_Id', 'sub_Grp_Id', 'subGrpId']),
      subGrupo: this.text(item, ['Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes']),
      flgEst, estado: flgEst.toUpperCase() === 'A' ? 'Activo' : 'Inactivo', activo: flgEst.toUpperCase() === 'A'
    };
  }
  private records(response: unknown): DataRecord[] {
    if (Array.isArray(response)) return response.filter((x): x is DataRecord => this.record(x));
    if (!this.record(response)) return [];
    for (const key of ['elements', 'Elements', 'data', 'Data', 'result', 'Result']) {
      const value = response[key];
      if (Array.isArray(value)) return value.filter((x: unknown): x is DataRecord => this.record(x));
    }
    return [response];
  }
  private text(item: DataRecord, keys: string[]): string {
    for (const key of keys) if (item[key] != null && String(item[key]).trim()) return String(item[key]).trim();
    return '';
  }
  private number(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) { const value = Number(item[key]); if (Number.isInteger(value)) return value; }
    return null;
  }
  private record(value: unknown): value is DataRecord { return typeof value === 'object' && value !== null && !Array.isArray(value); }
}
