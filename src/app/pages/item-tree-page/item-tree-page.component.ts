import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { ApiService } from 'src/app/Services/api.services';
import { GrupoItemRegisterDialogComponent } from '../grupo-item-page/grupo-item-register-dialog.component';
import { GrupoItemEditDialogComponent } from '../grupo-item-page/grupo-item-edit-dialog.component';
import { ItemDetalleMaterialEditDialogComponent } from '../item-detalle-material-page/item-detalle-material-edit-dialog.component';
import { ItemDetalleMaterialRegisterDialogComponent } from '../item-detalle-material-page/item-detalle-material-register-dialog.component';
import { SubGrupoItemEditDialogComponent } from '../sub-grupo-item-page/sub-grupo-item-edit-dialog.component';
import { SubGrupoItemRegisterDialogComponent } from '../sub-grupo-item-page/sub-grupo-item-register-dialog.component';

type DataRecord = Record<string, unknown>;

interface MaterialDetalleNode {
  id: number;
  codigo: string;
  descripcion: string;
  estado: string;
  activo: boolean;
}

interface SubGrupoNode {
  id: number;
  codigo: string;
  descripcion: string;
  estado: string;
  activo: boolean;
  detalles: MaterialDetalleNode[];
}

interface GrupoNode {
  id: number;
  codigo: string;
  descripcion: string;
  estado: string;
  activo: boolean;
  subGrupos: SubGrupoNode[];
}

@Component({
  selector: 'app-item-tree-page',
  templateUrl: './item-tree-page.component.html',
  styleUrls: ['./item-tree-page.component.scss']
})
export class ItemTreePageComponent implements OnInit {
  grupos: GrupoNode[] = [];
  isLoading = false;
  errorMessage = '';

  constructor(
    private readonly apiService: ApiService,
    private readonly dialog: MatDialog,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.cargarArbol();
  }

  cargarArbol(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      gruposResponse: this.apiService.getListarGrupoItem({ Flg_Est: '' }),
      subGruposResponse: this.apiService.getListarSubGrupoItem({ Flg_Est: '' }),
      detallesResponse: this.apiService.getListarItemDetalleMaterial({ Flg_Est: '' })
    }).subscribe({
      next: ({ gruposResponse, subGruposResponse, detallesResponse }) => {
        const grupos = this.extractRecords(gruposResponse)
          .map((item) => this.mapGrupo(item))
          .filter((item): item is GrupoNode => item !== null);
        const subGrupos = this.extractRecords(subGruposResponse)
          .map((item) => this.mapSubGrupo(item))
          .filter((item): item is SubGrupoNode & { grpId: number } => item !== null);
        const detalles = this.extractRecords(detallesResponse)
          .map((item) => this.mapDetalle(item))
          .filter((item): item is MaterialDetalleNode & { grpId: number; subGrpId: number } => item !== null);

        this.grupos = grupos
          .map((grupo) => ({
            ...grupo,
            subGrupos: subGrupos
              .filter((subGrupo) => subGrupo.grpId === grupo.id)
              .map(({ grpId: _grpId, ...subGrupo }) => ({
                ...subGrupo,
                detalles: detalles
                  .filter((detalle) => detalle.grpId === grupo.id && detalle.subGrpId === subGrupo.id)
                  .map(({ grpId: _detalleGrpId, subGrpId: _detalleSubGrpId, ...detalle }) => detalle)
                  .sort((left, right) => this.compareTreeNodes(left.codigo, left.descripcion, right.codigo, right.descripcion))
              }))
              .sort((left, right) => this.compareTreeNodes(left.codigo, left.descripcion, right.codigo, right.descripcion))
          }))
          .sort((left, right) => this.compareTreeNodes(left.codigo, left.descripcion, right.codigo, right.descripcion));

        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando arbol de grupos:', error);
        this.grupos = [];
        this.errorMessage = 'No se pudo cargar el arbol de grupos.';
        this.isLoading = false;
      }
    });
  }

  trackByGrupo(_: number, grupo: GrupoNode): number {
    return grupo.id;
  }

  trackBySubGrupo(_: number, subGrupo: SubGrupoNode): number {
    return subGrupo.id;
  }

  trackByDetalle(_: number, detalle: MaterialDetalleNode): number {
    return detalle.id;
  }

  cerrar(): void {
    this.router.navigate(['/item']);
  }

  registrarGrupo(): void {
    this.dialog.open(GrupoItemRegisterDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    }).afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarArbol();
      }
    });
  }

  editarGrupo(grupo: GrupoNode): void {
    this.dialog.open(GrupoItemEditDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: {
        grupoItem: {
          grpId: grupo.id,
          grpDes: grupo.descripcion,
          flgEst: grupo.activo ? 'A' : 'I'
        }
      }
    }).afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarArbol();
      }
    });
  }

  registrarSubGrupo(grupo: GrupoNode): void {
    const dialogRef = this.dialog.open(SubGrupoItemRegisterDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      dialogRef.componentInstance.form.patchValue({ grpId: grupo.id });
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarArbol();
      }
    });
  }

  editarSubGrupo(grupo: GrupoNode, subGrupo: SubGrupoNode): void {
    this.dialog.open(SubGrupoItemEditDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: {
        subGrupoItem: {
          subGrpId: subGrupo.id,
          subGrpCod: subGrupo.codigo,
          subGrpDes: subGrupo.descripcion,
          grpId: grupo.id,
          grpDes: grupo.descripcion,
          flgEst: subGrupo.activo ? 'A' : 'I'
        }
      }
    }).afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarArbol();
      }
    });
  }

  registrarDetalle(grupo: GrupoNode, subGrupo: SubGrupoNode): void {
    const dialogRef = this.dialog.open(ItemDetalleMaterialRegisterDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      dialogRef.componentInstance.form.patchValue({ grupoId: grupo.id });
      dialogRef.componentInstance.onGrupoChange();

      setTimeout(() => {
        dialogRef.componentInstance.form.patchValue({ subGrupoId: subGrupo.id });
      });
    });

    dialogRef.afterClosed().subscribe((created: boolean | undefined) => {
      if (created) {
        this.cargarArbol();
      }
    });
  }

  editarDetalle(grupo: GrupoNode, subGrupo: SubGrupoNode, detalle: MaterialDetalleNode): void {
    this.dialog.open(ItemDetalleMaterialEditDialogComponent, {
      width: 'min(34rem, 92vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: {
        item: {
          id: detalle.id,
          codigo: detalle.codigo,
          descripcion: detalle.descripcion,
          grupoId: grupo.id,
          grupo: grupo.descripcion,
          subGrupoId: subGrupo.id,
          subGrupo: subGrupo.descripcion,
          flgEst: detalle.activo ? 'A' : 'I',
          estado: detalle.estado,
          activo: detalle.activo
        }
      }
    }).afterClosed().subscribe((updated: boolean | undefined) => {
      if (updated) {
        this.cargarArbol();
      }
    });
  }

  private mapGrupo(item: DataRecord): GrupoNode | null {
    const id = this.getNumberValue(item, ['Grp_Id', 'grp_Id', 'grpId', 'id', 'Id']);

    if (!id) {
      return null;
    }

    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    return {
      id,
      codigo: this.getTextValue(item, ['Grp_Cod', 'grp_Cod', 'grpCod']) || String(id),
      descripcion: this.getTextValue(item, ['Grp_Des', 'grp_Des', 'grpDes', 'descripcion', 'Descripcion']),
      estado: flgEst.toUpperCase() === 'A' ? 'Activo' : 'Inactivo',
      activo: flgEst.toUpperCase() === 'A',
      subGrupos: []
    };
  }

  private mapSubGrupo(item: DataRecord): (SubGrupoNode & { grpId: number }) | null {
    const id = this.getNumberValue(item, ['Sub_Grp_Id', 'sub_Grp_Id', 'subGrpId', 'id', 'Id']);
    const grpId = this.getNumberValue(item, ['Grp_Id', 'grp_Id', 'grpId', 'grupoId', 'GrupoId']);

    if (!id || !grpId) {
      return null;
    }

    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    return {
      id,
      grpId,
      codigo: this.getTextValue(item, ['Sub_Grp_Cod', 'sub_Grp_Cod', 'subGrpCod']) || String(id),
      descripcion: this.getTextValue(item, ['Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes', 'descripcion', 'Descripcion']),
      estado: flgEst.toUpperCase() === 'A' ? 'Activo' : 'Inactivo',
      activo: flgEst.toUpperCase() === 'A',
      detalles: []
    };
  }

  private mapDetalle(item: DataRecord): (MaterialDetalleNode & { grpId: number; subGrpId: number }) | null {
    const id = this.getNumberValue(item, ['Det_Mat_Id', 'det_Mat_Id', 'detMatId', 'id', 'Id']);
    const grpId = this.getNumberValue(item, ['Grp_Id', 'grp_Id', 'grpId']);
    const subGrpId = this.getNumberValue(item, ['Sub_Grp_Id', 'sub_Grp_Id', 'subGrpId']);

    if (!id || !grpId || !subGrpId) {
      return null;
    }

    const flgEst = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']) || 'A';
    return {
      id,
      grpId,
      subGrpId,
      codigo: this.getTextValue(item, ['Det_Mat_Cod', 'det_Mat_Cod', 'detMatCod']) || String(id),
      descripcion: this.getTextValue(item, ['Det_Mat_Des', 'det_Mat_Des', 'detMatDes', 'descripcion', 'Descripcion']),
      estado: flgEst.toUpperCase() === 'A' ? 'Activo' : 'Inactivo',
      activo: flgEst.toUpperCase() === 'A'
    };
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    for (const key of ['items', 'Items', 'elements', 'Elements', 'data', 'Data', 'result', 'Result']) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
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

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private compareTreeNodes(leftCode: string, leftDescription: string, rightCode: string, rightDescription: string): number {
    const codeCompare = String(leftCode || '').localeCompare(String(rightCode || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });

    if (codeCompare !== 0) {
      return codeCompare;
    }

    return String(leftDescription || '').localeCompare(String(rightDescription || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  }
}
