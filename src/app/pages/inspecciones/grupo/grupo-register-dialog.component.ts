import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { GrupoItem } from './grupo.model';
import {
  ActualizarGrupoRequest,
  RegistrarGrupoRequest,
  GrupoService
} from './grupo.service';

export interface GrupoRegisterDialogData {
  usrReg: string;
  grupo?: GrupoItem;
}

@Component({
  selector: 'app-grupo-register-dialog',
  templateUrl: './grupo-register-dialog.component.html',
  styleUrls: ['./grupo-register-dialog.component.scss']
})
export class GrupoRegisterDialogComponent implements OnInit {
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    grupoCod: [null as number | null, [Validators.required, Validators.min(1)]],
    grupoNombre: ['', [Validators.required, Validators.maxLength(255)]],
    grupoDescripcion: ['', [Validators.required]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly grupoService: GrupoService,
    private readonly dialogRef: MatDialogRef<GrupoRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: GrupoRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return this.data?.grupo?.grupoId !== null && this.data?.grupo?.grupoId !== undefined;
  }

  ngOnInit(): void {
    if (!this.esEdicion) {
      return;
    }

    const id = this.data?.grupo?.grupoId;
    if (id === null || id === undefined) {
      return;
    }

    this.form.patchValue({
      grupoCod: this.data?.grupo?.grupoCod ?? null,
      grupoNombre: String(this.data?.grupo?.grupoNombre ?? '').trim(),
      grupoDescripcion: String(this.data?.grupo?.grupoDescripcion ?? '').trim(),
      estado: this.normalizarEstado(this.data?.grupo?.estado)
    });
  }

  cerrar(): void {
    this.dialogRef.close(false);
  }

  guardar(): void {
    this.saveError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError = 'Completa todos los campos obligatorios.';
      return;
    }

    if (this.esEdicion) {
      this.actualizarGrupo();
      return;
    }

    this.registrarGrupo();
  }

  private registrarGrupo(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const grupoCod = Number(this.form.value.grupoCod);
    const payload: RegistrarGrupoRequest = {
      Grupo_Cod: grupoCod,
      Grupo_Nombre: String(this.form.value.grupoNombre ?? '').trim(),
      Grupo_Descripcion: String(this.form.value.grupoDescripcion ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.grupoService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando grupo', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el grupo.';
      }
    });
  }

  private actualizarGrupo(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    const id = this.data?.grupo?.grupoId;
    if (id === null || id === undefined) {
      this.saveError = 'No se pudo identificar el grupo a actualizar.';
      return;
    }

    const payload: ActualizarGrupoRequest = {
      Grupo_Id: id,
      Grupo_Cod: Number(this.form.value.grupoCod),
      Grupo_Nombre: String(this.form.value.grupoNombre ?? '').trim(),
      Grupo_Descripcion: String(this.form.value.grupoDescripcion ?? '').trim(),
      Estado: this.normalizarEstado(this.form.value.estado),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.grupoService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando grupo', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el grupo.';
      }
    });
  }

  private normalizarEstado(value: unknown): string {
    const texto = String(value ?? '').trim().toUpperCase();
    return texto === 'I' || texto === 'INACTIVO' ? 'I' : 'A';
  }

  get grupoCodCtrl() {
    return this.form.controls.grupoCod;
  }

  get grupoNombreCtrl() {
    return this.form.controls.grupoNombre;
  }

  get grupoDescripcionCtrl() {
    return this.form.controls.grupoDescripcion;
  }

  get estadoCtrl() {
    return this.form.controls.estado;
  }
}
