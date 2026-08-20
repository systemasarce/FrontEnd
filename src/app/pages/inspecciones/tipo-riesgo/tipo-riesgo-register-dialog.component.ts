import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TipoRiesgoItem } from './tipo-riesgo.model';
import { TipoRiesgoService, RegistrarTipoRiesgoRequest, ActualizarTipoRiesgoRequest } from './tipo-riesgo.service';

export interface TipoRiesgoRegisterDialogData {
  usrReg: string;
  tipoRiesgo?: TipoRiesgoItem;
}

@Component({
  selector: 'app-tipo-riesgo-register-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tipo-riesgo-register-dialog.component.html',
  styleUrls: ['./tipo-riesgo-register-dialog.component.scss']
})
export class TipoRiesgoRegisterDialogComponent implements OnInit {
  cargandoDatosTipoRiesgo = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(255)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly tipoRiesgoService: TipoRiesgoService,
    private readonly dialogRef: MatDialogRef<TipoRiesgoRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: TipoRiesgoRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.tipoRiesgo?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatosTipoRiesgo();
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
      this.actualizarTipoRiesgo();
      return;
    }

    this.registrarTipoRiesgo();
  }

  private cargarDatosTipoRiesgo(): void {
    const tipoRiesgoId = this.data?.tipoRiesgo?.id;
    if (!tipoRiesgoId) {
      return;
    }

    this.cargandoDatosTipoRiesgo = true;

    this.tipoRiesgoService.consultarDatos(tipoRiesgoId).subscribe({
      next: (response: unknown) => {
        const detalle = this.tipoRiesgoService.mapTipoRiesgoDetalle(response);
        this.cargandoDatosTipoRiesgo = false;

        if (!detalle) {
          this.saveError = 'No se pudo cargar la información del tipo de riesgo.';
          return;
        }

        this.form.patchValue({
          nombre: detalle.nombre,
          estado: detalle.estado === 'I' ? 'I' : 'A'
        });
      },
      error: (error: unknown) => {
        console.error('Error consultando datos del tipo de riesgo', error);
        this.cargandoDatosTipoRiesgo = false;
        this.saveError = 'No se pudo cargar la información del tipo de riesgo.';
      }
    });
  }

  private registrarTipoRiesgo(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarTipoRiesgoRequest = {
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.tipoRiesgoService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando tipo de riesgo', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el tipo de riesgo.';
      }
    });
  }

  private actualizarTipoRiesgo(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    const tipoRiesgoId = Number(this.data?.tipoRiesgo?.id ?? 0);

    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    if (!tipoRiesgoId) {
      this.saveError = 'No se pudo identificar el tipo de riesgo a actualizar.';
      return;
    }

    const payload: ActualizarTipoRiesgoRequest = {
      Id: tipoRiesgoId,
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Estado: String(this.form.value.estado ?? 'A'),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.tipoRiesgoService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando tipo de riesgo', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el tipo de riesgo.';
      }
    });
  }
}
