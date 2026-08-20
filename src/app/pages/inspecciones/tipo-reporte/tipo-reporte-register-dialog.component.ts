import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TipoReporteItem } from './tipo-reporte.model';
import {
  ActualizarTipoReporteRequest,
  RegistrarTipoReporteRequest,
  TipoReporteService
} from './tipo-reporte.service';

export interface TipoReporteRegisterDialogData {
  usrReg: string;
  tipoReporte?: TipoReporteItem;
}

@Component({
  selector: 'app-tipo-reporte-register-dialog',
  templateUrl: './tipo-reporte-register-dialog.component.html',
  styleUrls: ['./tipo-reporte-register-dialog.component.scss']
})
export class TipoReporteRegisterDialogComponent implements OnInit {
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    reporteTipo: ['', [Validators.required, Validators.maxLength(255)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly tipoReporteService: TipoReporteService,
    private readonly dialogRef: MatDialogRef<TipoReporteRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: TipoReporteRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return this.data?.tipoReporte?.reporteId !== null && this.data?.tipoReporte?.reporteId !== undefined;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.form.patchValue({
        reporteTipo: String(this.data?.tipoReporte?.reporteTipo ?? '').trim(),
        estado: this.normalizarEstado(this.data?.tipoReporte?.estado)
      });
    }
  }

  cerrar(): void {
    this.dialogRef.close(false);
  }

  guardar(): void {
    this.saveError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.esEdicion) {
      this.actualizarTipoReporte();
      return;
    }

    this.registrarTipoReporte();
  }

  private registrarTipoReporte(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarTipoReporteRequest = {
      Reporte_Tipo: String(this.form.value.reporteTipo ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.tipoReporteService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando tipo de reporte', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el tipo de reporte.';
      }
    });
  }

  private actualizarTipoReporte(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    const id = this.data?.tipoReporte?.reporteId;
    if (id === null || id === undefined) {
      this.saveError = 'No se pudo identificar el tipo de reporte a actualizar.';
      return;
    }

    const payload: ActualizarTipoReporteRequest = {
      Reporte_Id: id,
      Reporte_Tipo: String(this.form.value.reporteTipo ?? '').trim(),
      Estado: this.normalizarEstado(this.form.value.estado),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.tipoReporteService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando tipo de reporte', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el tipo de reporte.';
      }
    });
  }

  private normalizarEstado(value: unknown): string {
    const texto = String(value ?? '').trim().toUpperCase();

    if (texto === 'I' || texto === 'INACTIVO') {
      return 'I';
    }

    return 'A';
  }

  get reporteTipoCtrl() {
    return this.form.controls.reporteTipo;
  }

  get estadoCtrl() {
    return this.form.controls.estado;
  }
}
