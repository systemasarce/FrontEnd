import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { MotivoItem } from './motivo.model';
import { MotivoService, RegistrarMotivoRequest, ActualizarMotivoRequest } from './motivo.service';

export interface MotivoRegisterDialogData {
  usrReg: string;
  motivo?: MotivoItem;
}

@Component({
  selector: 'app-motivo-register-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './motivo-register-dialog.component.html',
  styleUrls: ['./motivo-register-dialog.component.scss']
})
export class MotivoRegisterDialogComponent implements OnInit {
  cargandoDatosMotivo = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(255)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly motivoService: MotivoService,
    private readonly dialogRef: MatDialogRef<MotivoRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: MotivoRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.motivo?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatosMotivo();
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
      this.actualizarMotivo();
      return;
    }

    this.registrarMotivo();
  }

  private cargarDatosMotivo(): void {
    const motivoId = this.data?.motivo?.id;
    if (!motivoId) {
      return;
    }

    this.cargandoDatosMotivo = true;

    this.motivoService.consultarDatos(motivoId).subscribe({
      next: (response: unknown) => {
        const detalle = this.motivoService.mapMotivoDetalle(response);
        this.cargandoDatosMotivo = false;

        if (!detalle) {
          this.saveError = 'No se pudo cargar la información del motivo.';
          return;
        }

        this.form.patchValue({
          nombre: detalle.nombre,
          estado: detalle.estado === 'I' ? 'I' : 'A'
        });
      },
      error: (error: unknown) => {
        console.error('Error consultando datos del motivo', error);
        this.cargandoDatosMotivo = false;
        this.saveError = 'No se pudo cargar la información del motivo.';
      }
    });
  }

  private registrarMotivo(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarMotivoRequest = {
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.motivoService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando motivo', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el motivo.';
      }
    });
  }

  private actualizarMotivo(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    const motivoId = Number(this.data?.motivo?.id ?? 0);

    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    if (!motivoId) {
      this.saveError = 'No se pudo identificar el motivo a actualizar.';
      return;
    }

    const payload: ActualizarMotivoRequest = {
      Id: motivoId,
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Estado: String(this.form.value.estado ?? 'A'),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.motivoService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando motivo', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el motivo.';
      }
    });
  }
}
