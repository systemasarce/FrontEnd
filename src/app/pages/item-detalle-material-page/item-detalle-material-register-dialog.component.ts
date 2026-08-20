import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ApiService, RegistrarItemDetalleMaterialRequest } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

type RecordData = Record<string, unknown>;
interface Option { id: number; descripcion: string; grupoId?: number; }

@Component({
  selector: 'app-item-detalle-material-register-dialog',
  templateUrl: './item-detalle-material-register-dialog.component.html',
  styleUrls: ['../sub-grupo-item-page/sub-grupo-item-dialog.component.scss']
})
export class ItemDetalleMaterialRegisterDialogComponent implements OnInit {
  readonly form: FormGroup;
  grupos: Option[] = [];
  subGrupos: Option[] = [];
  isLoading = false;
  isLoadingSubGrupos = false;
  isSaving = false;
  errorMessage = '';

  constructor(private ref: MatDialogRef<ItemDetalleMaterialRegisterDialogComponent>, private fb: FormBuilder, private api: ApiService, private auth: AuthService) {
    this.form = fb.group({
      grupoId: [null, Validators.required],
      subGrupoId: [null, Validators.required],
      descripcion: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(120)]]
    });
  }
  ngOnInit(): void { this.cargarCatalogos(); }
  onGrupoChange(): void {
    this.form.patchValue({ subGrupoId: null });
    this.cargarSubGrupos(Number(this.form.controls['grupoId'].value));
  }
  guardar(): void {
    if (this.form.invalid || this.isSaving) { this.form.markAllAsTouched(); return; }
    this.isSaving = true; this.errorMessage = '';
    const payload: RegistrarItemDetalleMaterialRequest = {
      Grp_Id: Number(this.form.value.grupoId), Sub_Grp_Id: Number(this.form.value.subGrupoId),
      Det_Mat_Des: String(this.form.value.descripcion || '').trim(), Usr_Reg: this.auth.getCurrentUser() || 'sistemas'
    };
    this.api.registrarItemDetalleMaterial(payload).subscribe({
      next: () => { this.isSaving = false; this.ref.close(true); },
      error: (error) => { console.error('Error registrando detalle de material:', error); this.errorMessage = 'No se pudo registrar el detalle de material.'; this.isSaving = false; }
    });
  }
  cerrar(): void { if (!this.isSaving) this.ref.close(false); }
  private cargarCatalogos(): void {
    this.isLoading = true;
    this.api.getListarGrupoItem({ Flg_Est: 'A' }).subscribe({
      next: (r) => {
        this.grupos = this.records(r).map((x) => ({ id: this.num(x, ['Grp_Id', 'grp_Id', 'grpId']), descripcion: this.txt(x, ['Grp_Des', 'grp_Des', 'grpDes']) })).filter((x) => x.id > 0);
        this.isLoading = false;
      },
      error: () => { this.errorMessage = 'No se pudieron cargar los grupos.'; this.isLoading = false; }
    });
  }
  private cargarSubGrupos(grupoId: number): void {
    this.subGrupos = [];
    if (!Number.isInteger(grupoId) || grupoId <= 0) return;
    this.isLoadingSubGrupos = true;
    this.api.getListarSubGrupoItemPorGrpId(grupoId).subscribe({
      next: (s) => {
        this.subGrupos = this.records(s).map((x) => ({
          id: this.num(x, ['Sub_Grp_Id', 'sub_Grp_Id', 'subGrpId']),
          descripcion: this.txt(x, ['Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes'])
        })).filter((x) => x.id > 0);
        this.isLoadingSubGrupos = false;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar los sub grupos del grupo seleccionado.';
        this.isLoadingSubGrupos = false;
      }
    });
  }
  private records(r: unknown): RecordData[] { if (Array.isArray(r)) return r as RecordData[]; if (this.rec(r)) for (const k of ['elements','Elements','data','Data','result','Result']) if (Array.isArray(r[k])) return r[k] as RecordData[]; return []; }
  private txt(x: RecordData, keys: string[]): string { for (const k of keys) if (x[k] != null) return String(x[k]).trim(); return ''; }
  private num(x: RecordData, keys: string[]): number { for (const k of keys) { const n = Number(x[k]); if (Number.isInteger(n)) return n; } return 0; }
  private rec(x: unknown): x is RecordData { return typeof x === 'object' && x !== null && !Array.isArray(x); }
}
