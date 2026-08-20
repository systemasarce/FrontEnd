import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TareaItem } from './tarea.model';
import { ActualizarTareaRequest, RegistrarTareaRequest, TareaService } from './tarea.service';

export interface TareaRegisterDialogData {
  usrReg: string;
  tarea?: TareaItem;
}

@Component({
  selector: 'app-tarea-register-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tarea-register-dialog.component.html',
  styleUrls: ['./tarea-register-dialog.component.scss']
})
export class TareaRegisterDialogComponent implements OnInit {
  cargandoDatosTarea = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(55)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly tareaService: TareaService,
    private readonly dialogRef: MatDialogRef<TareaRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: TareaRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.tarea?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatosTarea();
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
      this.actualizarTarea();
      return;
    }

    this.registrarTarea();
  }

  private cargarDatosTarea(): void {
    const tareaId = this.data?.tarea?.id;
    if (!tareaId) {
      return;
    }

    this.cargandoDatosTarea = true;

    this.tareaService.consultarDatos(tareaId).subscribe({
      next: (response: unknown) => {
        const detalle = this.tareaService.mapTareaDetalle(response);
        this.cargandoDatosTarea = false;

        if (!detalle) {
          this.saveError = 'No se pudo cargar la información de la tarea.';
          return;
        }

        this.form.patchValue({
          nombre: detalle.nombre,
          estado: detalle.estado === 'I' ? 'I' : 'A'
        });
      },
      error: (error: unknown) => {
        console.error('Error consultando datos de la tarea', error);
        this.cargandoDatosTarea = false;
        this.saveError = 'No se pudo cargar la información de la tarea.';
      }
    });
  }

  private registrarTarea(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarTareaRequest = {
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.tareaService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando tarea', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar la tarea.';
      }
    });
  }

  private actualizarTarea(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    const tareaId = Number(this.data?.tarea?.id ?? 0);

    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    if (!tareaId) {
      this.saveError = 'No se pudo identificar la tarea a actualizar.';
      return;
    }

    const payload: ActualizarTareaRequest = {
      Id: tareaId,
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Estado: String(this.form.value.estado ?? 'A'),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.tareaService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando tarea', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar la tarea.';
      }
    });
  }
}
