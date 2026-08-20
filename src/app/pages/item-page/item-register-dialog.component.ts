import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ApiService, RegistrarItemRequest } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

type DataRecord = Record<string, unknown>;
interface Option { id: number; descripcion: string; }

@Component({
  selector: 'app-item-register-dialog',
  templateUrl: './item-register-dialog.component.html',
  styleUrls: ['./item-dialog.component.scss']
})
export class ItemRegisterDialogComponent {
  readonly form: FormGroup;
  readonly unidadSearchControl = new FormControl('', { nonNullable: true });
  grupos: Option[] = [];
  subGrupos: Option[] = [];
  detallesMaterial: Option[] = [];
  unidadesMedida: Option[] = [];
  isSaving = false;
  isLoadingGroups = true;
  isLoadingSubGroups = false;
  isLoadingDetalles = false;
  isLoadingUnidades = true;
  errorMessage = '';

  constructor(private dialogRef: MatDialogRef<ItemRegisterDialogComponent>, fb: FormBuilder, private api: ApiService, private auth: AuthService) {
    this.form = fb.group({
      itmDes: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]],
      itmGrp: [null, Validators.required],
      itmSubGrp: [null, Validators.required],
      itmDetMat: [null, Validators.required],
      uniMedId: [null, Validators.required]
    });
    this.cargarGrupos();
    this.cargarUnidadesMedida();
  }

  get filteredUnidadesMedida(): Option[] {
    const search = this.unidadSearchControl.value.trim().toLowerCase();
    if (!search) {
      return this.unidadesMedida;
    }

    return this.unidadesMedida.filter((unidad) =>
      String(unidad.id).includes(search) || unidad.descripcion.toLowerCase().includes(search)
    );
  }

  onGrupoChange(): void {
    this.form.patchValue({ itmSubGrp: null, itmDetMat: null });
    this.subGrupos = []; this.detallesMaterial = [];
    const id = Number(this.form.controls['itmGrp'].value);
    if (!id) return;
    this.isLoadingSubGroups = true;
    this.api.getListarSubGrupoItemPorGrpId(id).subscribe({
      next: (r) => { this.subGrupos = this.mapOptions(r, ['Sub_Grp_Id','sub_Grp_Id','subGrpId'], ['Sub_Grp_Des','sub_Grp_Des','subGrpDes']); this.isLoadingSubGroups = false; },
      error: () => { this.errorMessage = 'No se pudieron cargar los sub grupos.'; this.isLoadingSubGroups = false; }
    });
  }

  onSubGrupoChange(): void {
    this.form.patchValue({ itmDetMat: null }); this.detallesMaterial = [];
    const grpId = Number(this.form.controls['itmGrp'].value);
    const subId = Number(this.form.controls['itmSubGrp'].value);
    if (!grpId || !subId) return;
    this.isLoadingDetalles = true;
    this.api.getItemDetalleMaterialEntity(grpId, subId).subscribe({
      next: (r) => { this.detallesMaterial = this.mapOptions(r, ['Det_Mat_Id','det_Mat_Id','detMatId'], ['Det_Mat_Des','det_Mat_Des','detMatDes']); this.isLoadingDetalles = false; },
      error: () => { this.errorMessage = 'No se pudieron cargar los detalles de material.'; this.isLoadingDetalles = false; }
    });
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) { this.form.markAllAsTouched(); return; }
    this.isSaving = true; this.errorMessage = '';
    const payload: RegistrarItemRequest = {
      Itm_Des: String(this.form.value.itmDes || '').trim(),
      Itm_Grp: Number(this.form.value.itmGrp),
      Itm_Sub_Grp: Number(this.form.value.itmSubGrp),
      Itm_Det_Mat_Id: Number(this.form.value.itmDetMat),
      Uni_Med_Id: Number(this.form.value.uniMedId),
      Usr_Reg: this.auth.getCurrentUser() || 'sistemas'
    };
    this.api.registrarItem(payload).subscribe({
      next: () => { this.isSaving = false; this.dialogRef.close(true); },
      error: (e) => { console.error('Error registrando item:', e); this.errorMessage = this.error(e); this.isSaving = false; }
    });
  }
  cerrar(): void { if (!this.isSaving) this.dialogRef.close(false); }

  onUnidadSelectOpened(opened: boolean): void {
    if (opened) {
      this.unidadSearchControl.setValue('');
    }
  }

  trackByOption(_index: number, option: Option): number {
    return option.id;
  }

  private cargarGrupos(): void {
    this.api.getListarGrupoItem({ Flg_Est: 'A' }).subscribe({
      next: (r) => { this.grupos = this.mapOptions(r, ['Grp_Id','grp_Id','grpId'], ['Grp_Des','grp_Des','grpDes']); this.isLoadingGroups = false; },
      error: () => { this.errorMessage = 'No se pudo cargar la lista de grupos.'; this.isLoadingGroups = false; }
    });
  }
  private cargarUnidadesMedida(): void {
    this.api.getListarUnidadMedida({ Flg_Est: 'A' }).subscribe({
      next: (r) => {
        this.unidadesMedida = this.mapOptions(r, ['Uni_Med_Id','uni_Med_Id','uniMedId'], ['Uni_Med_Des','uni_Med_Des','uniMedDes']);
        this.isLoadingUnidades = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la lista de unidades de medida.';
        this.isLoadingUnidades = false;
      }
    });
  }
  private mapOptions(r: unknown, ids: string[], descriptions: string[]): Option[] {
    return this.records(r).map((x) => ({ id: this.num(x, ids), descripcion: this.text(x, descriptions) })).filter((x) => x.id > 0).sort((a,b) => a.descripcion.localeCompare(b.descripcion));
  }
  private records(r: unknown): DataRecord[] { if (Array.isArray(r)) return r.filter((x): x is DataRecord => this.record(x)); if (this.record(r)) for (const k of ['elements','Elements','data','Data','result','Result']) { const v=r[k]; if(Array.isArray(v)) return v.filter((x):x is DataRecord=>this.record(x)); } return []; }
  private text(x: DataRecord, ks: string[]): string { for(const k of ks) if(x[k]!=null) return String(x[k]).trim(); return ''; }
  private num(x: DataRecord, ks: string[]): number { for(const k of ks){const n=Number(x[k]);if(Number.isInteger(n))return n;}return 0; }
  private record(x: unknown): x is DataRecord { return typeof x === 'object' && x !== null && !Array.isArray(x); }
  private error(e: unknown): string { return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : 'No se pudo registrar el item.'; }
}
