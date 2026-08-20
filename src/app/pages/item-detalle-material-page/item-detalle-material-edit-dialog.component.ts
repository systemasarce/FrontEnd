import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActualizarItemDetalleMaterialRequest, ApiService } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';
import { ItemDetalleMaterialRow } from './item-detalle-material-page.component';

type RecordData = Record<string, unknown>;
interface Option { id: number; descripcion: string; grupoId?: number; }

@Component({
  selector: 'app-item-detalle-material-edit-dialog',
  templateUrl: './item-detalle-material-edit-dialog.component.html',
  styleUrls: ['../sub-grupo-item-page/sub-grupo-item-dialog.component.scss']
})
export class ItemDetalleMaterialEditDialogComponent implements OnInit {
  readonly form: FormGroup;
  grupos: Option[] = []; subGrupos: Option[] = [];
  isLoading = false; isLoadingSubGrupos = false; isSaving = false; errorMessage = '';
  constructor(@Inject(MAT_DIALOG_DATA) public data: { item: ItemDetalleMaterialRow }, private ref: MatDialogRef<ItemDetalleMaterialEditDialogComponent>, fb: FormBuilder, private api: ApiService, private auth: AuthService) {
    this.form = fb.group({
      codigo: [{ value: data.item.codigo, disabled: true }],
      grupoId: [data.item.grupoId, Validators.required], subGrupoId: [data.item.subGrupoId, Validators.required],
      descripcion: [data.item.descripcion, [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]],
      estado: [data.item.flgEst || 'A', Validators.required]
    });
  }
  ngOnInit(): void { this.cargarCatalogos(); }
  onGrupoChange(): void {
    this.form.patchValue({ subGrupoId: null });
    this.cargarSubGrupos(Number(this.form.controls['grupoId'].value), null);
  }
  guardar(): void {
    if (this.form.invalid || this.isSaving || this.data.item.id === null) { this.form.markAllAsTouched(); return; }
    this.isSaving = true; this.errorMessage = '';
    const p: ActualizarItemDetalleMaterialRequest = {
      Det_Mat_Id: this.data.item.id, Grp_Id: Number(this.form.value.grupoId), Sub_Grp_Id: Number(this.form.value.subGrupoId),
      Det_Mat_Des: String(this.form.value.descripcion || '').trim(), Flg_Est: String(this.form.value.estado || 'A'), Usr_Mod: this.auth.getCurrentUser() || 'sistemas'
    };
    this.api.actualizarItemDetalleMaterial(p).subscribe({ next: () => { this.isSaving = false; this.ref.close(true); }, error: (e) => { console.error('Error actualizando detalle de material:', e); this.errorMessage = 'No se pudo actualizar el detalle de material.'; this.isSaving = false; } });
  }
  cerrar(): void { if (!this.isSaving) this.ref.close(false); }
  private cargarCatalogos(): void {
    this.isLoading = true;
    this.api.getListarGrupoItem({ Flg_Est: 'A' }).subscribe({ next: (r) => {
      this.grupos = this.records(r).map((x) => ({ id: this.num(x,['Grp_Id','grp_Id','grpId']), descripcion: this.txt(x,['Grp_Des','grp_Des','grpDes']) })).filter((x) => x.id > 0);
      if (this.data.item.grupoId && !this.grupos.some((x) => x.id === this.data.item.grupoId)) this.grupos.push({ id: this.data.item.grupoId, descripcion: this.data.item.grupo || `Grupo ${this.data.item.grupoId}` });
      this.form.patchValue({ grupoId: this.data.item.grupoId }, { emitEvent: false });
      this.isLoading = false;
      this.cargarSubGrupos(Number(this.data.item.grupoId), this.data.item.subGrupoId);
    }, error: () => { this.errorMessage = 'No se pudieron cargar los grupos.'; this.isLoading = false; } });
  }
  private cargarSubGrupos(grupoId: number, subGrupoIdSeleccionado: number | null): void {
    this.subGrupos = [];
    if (!Number.isInteger(grupoId) || grupoId <= 0) return;
    this.isLoadingSubGrupos = true;
    this.api.getListarSubGrupoItemPorGrpId(grupoId).subscribe({
      next: (s) => {
        this.subGrupos = this.records(s).map((x) => ({
          id: this.num(x, ['Sub_Grp_Id', 'sub_Grp_Id', 'subGrpId']),
          descripcion: this.txt(x, ['Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes'])
        })).filter((x) => x.id > 0);
        if (subGrupoIdSeleccionado && !this.subGrupos.some((x) => x.id === subGrupoIdSeleccionado)) {
          this.subGrupos.push({ id: subGrupoIdSeleccionado, descripcion: this.data.item.subGrupo || `Sub Grupo ${subGrupoIdSeleccionado}` });
        }
        this.form.patchValue({ subGrupoId: subGrupoIdSeleccionado }, { emitEvent: false });
        this.isLoadingSubGrupos = false;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar los sub grupos del grupo seleccionado.';
        this.isLoadingSubGrupos = false;
      }
    });
  }
  private records(r: unknown): RecordData[] { if (Array.isArray(r)) return r as RecordData[]; if (this.rec(r)) for (const k of ['elements','Elements','data','Data','result','Result']) if (Array.isArray(r[k])) return r[k] as RecordData[]; return []; }
  private txt(x: RecordData, ks: string[]): string { for (const k of ks) if (x[k] != null) return String(x[k]).trim(); return ''; }
  private num(x: RecordData, ks: string[]): number { for (const k of ks) { const n = Number(x[k]); if (Number.isInteger(n)) return n; } return 0; }
  private rec(x: unknown): x is RecordData { return typeof x === 'object' && x !== null && !Array.isArray(x); }
}
