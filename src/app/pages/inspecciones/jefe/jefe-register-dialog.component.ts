import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { JefeItem } from './jefe.model';
import { ActualizarJefeRequest, JefeService, RegistrarJefeRequest } from './jefe.service';

export interface JefeRegisterDialogData {
  usrReg: string;
  jefe?: JefeItem;
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  selector: 'app-jefe-register-dialog',
  templateUrl: './jefe-register-dialog.component.html',
  styleUrls: ['./jefe-register-dialog.component.scss']
})
export class JefeRegisterDialogComponent implements OnInit {
  cargandoDatosJefe = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    tipoReporte: ['', [Validators.required, Validators.maxLength(55)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly jefeService: JefeService,
    private readonly dialogRef: MatDialogRef<JefeRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: JefeRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.jefe?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatosJefe();
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
      this.actualizarJefe();
      return;
    }

    this.registrarJefe();
  }

  private registrarJefe(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarJefeRequest = {
      Reporte_Tipo: String(this.form.value.tipoReporte ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.jefeService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando tipo reporte', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el tipo de reporte.';
      }
    });
  }

  private actualizarJefe(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    const id = this.data?.jefe?.id;
    if (!id) {
      this.saveError = 'No se pudo identificar al tipo de reporte a actualizar.';
      return;
    }

    const payload: ActualizarJefeRequest = {
      Reporte_Id: id,
      Reporte_Tipo: String(this.form.value.tipoReporte ?? '').trim(),
      Estado: this.normalizarEstado(this.form.value.estado),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.jefeService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando tipo reporte', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el tipo de reporte.';
      }
    });
  }

  private cargarDatosJefe(): void {
    const id = this.data?.jefe?.id;
    if (!id) {
      return;
    }

    this.cargandoDatosJefe = true;

    this.jefeService.consultarDatos(id).subscribe({
      next: (response: unknown) => {
        const detalle = this.jefeService.mapJefeDetalle(response) as any;
        const raw = (response as any)?.data ?? response ?? {};
        const jefeBase = this.data?.jefe ?? {};

        const fuente = {
          ...jefeBase,
          ...raw,
          ...detalle
        };

        this.form.patchValue({
          tipoReporte: this.extraerTexto(fuente, [
            'tipoReporte',
            'Reporte_Tipo',
            'reporte_Tipo',
            'reporte_tipo',
            'Tipo_Reporte',
            'tipo_reporte'
          ]),
          estado: this.normalizarEstado(this.extraerTexto(fuente, [
            'estado',
            'Estado'
          ]))
        });

        this.cargandoDatosJefe = false;
      },
      error: (error: unknown) => {
        console.error('Error consultando datos del tipo reporte', error);
        this.cargandoDatosJefe = false;
        this.saveError = 'No se pudo cargar la información del tipo de reporte.';
      }
    });
  }

  private extraerTexto(obj: any, keys: string[]): string {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private normalizarEstado(value: unknown): string {
    const texto = String(value ?? '').trim().toUpperCase();

    if (texto === 'I' || texto === 'INACTIVO') {
      return 'I';
    }

    return 'A';
  }

  get tipoReporteCtrl() {
    return this.form.controls.tipoReporte;
  }

  get estadoCtrl() {
    return this.form.controls.estado;
  }
}
