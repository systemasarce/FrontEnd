import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TipoInspeccionItem } from './tipo-inspeccion.model';
import { TipoInspeccionService, RegistrarTipoInspeccionRequest, ActualizarTipoInspeccionRequest } from './tipo-inspeccion.service';

export interface TipoInspeccionRegisterDialogData {
  usrReg: string;
  tipoInspeccion?: TipoInspeccionItem;
}

@Component({
  selector: 'app-tipo-inspeccion-register-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tipo-inspeccion-register-dialog.component.html',
  styleUrls: ['./tipo-inspeccion-register-dialog.component.scss']
})
export class TipoInspeccionRegisterDialogComponent implements OnInit {
  cargandoDatosTipoInspeccion = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(255)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly tipoInspeccionService: TipoInspeccionService,
    private readonly dialogRef: MatDialogRef<TipoInspeccionRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: TipoInspeccionRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.tipoInspeccion?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatosTipoInspeccion();
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
      this.actualizarTipoInspeccion();
      return;
    }

    this.registrarTipoInspeccion();
  }

  private cargarDatosTipoInspeccion(): void {
    const tipoInspeccionId = this.data?.tipoInspeccion?.id;
    if (!tipoInspeccionId) {
      return;
    }

    this.cargandoDatosTipoInspeccion = true;

    this.tipoInspeccionService.consultarDatos(tipoInspeccionId).subscribe({
      next: (response: unknown) => {
        const detalle = this.tipoInspeccionService.mapTipoInspeccionDetalle(response);
        this.cargandoDatosTipoInspeccion = false;

        if (!detalle) {
          this.saveError = 'No se pudo cargar la información del tipo de inspección.';
          return;
        }

        this.form.patchValue({
          nombre: detalle.nombre,
          estado: detalle.estado === 'I' ? 'I' : 'A'
        });
      },
      error: (error: unknown) => {
        console.error('Error consultando datos del tipo de inspección', error);
        this.cargandoDatosTipoInspeccion = false;
        this.saveError = 'No se pudo cargar la información del tipo de inspección.';
      }
    });
  }

  private registrarTipoInspeccion(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarTipoInspeccionRequest = {
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.tipoInspeccionService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando tipo de inspección', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el tipo de inspección.';
      }
    });
  }

  private actualizarTipoInspeccion(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    const tipoInspeccionId = Number(this.data?.tipoInspeccion?.id ?? 0);

    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    if (!tipoInspeccionId) {
      this.saveError = 'No se pudo identificar el tipo de inspección a actualizar.';
      return;
    }

    const payload: ActualizarTipoInspeccionRequest = {
      Id: tipoInspeccionId,
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Estado: String(this.form.value.estado ?? 'A'),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.tipoInspeccionService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando tipo de inspección', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el tipo de inspección.';
      }
    });
  }
}
