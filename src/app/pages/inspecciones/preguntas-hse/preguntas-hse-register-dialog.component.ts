import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PreguntasHseItem } from './preguntas-hse.model';
import { PreguntasHseService, RegistrarPreguntasHseRequest, ActualizarPreguntasHseRequest } from './preguntas-hse.service';

export interface PreguntasHseRegisterDialogData {
  usrReg: string;
  preguntasHse?: PreguntasHseItem;
}

@Component({
  selector: 'app-preguntas-hse-register-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './preguntas-hse-register-dialog.component.html',
  styleUrls: ['./preguntas-hse-register-dialog.component.scss']
})
export class PreguntasHseRegisterDialogComponent implements OnInit {
  cargandoDatos = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    pregunta: ['', [Validators.required, Validators.maxLength(255)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly preguntasHseService: PreguntasHseService,
    private readonly dialogRef: MatDialogRef<PreguntasHseRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PreguntasHseRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.preguntasHse?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatos();
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
      this.actualizar();
      return;
    }

    this.registrar();
  }

  private cargarDatos(): void {
    const id = this.data?.preguntasHse?.id;
    if (!id) {
      return;
    }

    this.cargandoDatos = true;

    this.preguntasHseService.consultarDatos(id).subscribe({
      next: (response: unknown) => {
        const detalle = this.preguntasHseService.mapPreguntasHseDetalle(response);
        this.cargandoDatos = false;

        if (!detalle) {
          this.saveError = 'No se pudo cargar la información de Preguntas HSE.';
          return;
        }

        this.form.patchValue({
          pregunta: detalle.pregunta,
          estado: detalle.estado === 'I' ? 'I' : 'A'
        });
      },
      error: (error: unknown) => {
        console.error('Error consultando datos de Preguntas HSE', error);
        this.cargandoDatos = false;
        this.saveError = 'No se pudo cargar la información de Preguntas HSE.';
      }
    });
  }

  private registrar(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarPreguntasHseRequest = {
      Pregunta_Nombre: String(this.form.value.pregunta ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;
    this.preguntasHseService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando Preguntas HSE', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar la Pregunta HSE.';
      }
    });
  }

  private actualizar(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    const id = Number(this.data?.preguntasHse?.id ?? 0);

    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    if (!id) {
      this.saveError = 'No se pudo identificar la Pregunta HSE a actualizar.';
      return;
    }

    const payload: ActualizarPreguntasHseRequest = {
      Id: id,
      Pregunta_Nombre: String(this.form.value.pregunta ?? '').trim(),
      Estado: String(this.form.value.estado ?? 'A'),
      Usr_Mod: usrMod
    };

    this.guardando = true;
    this.preguntasHseService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando Preguntas HSE', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar la Pregunta HSE.';
      }
    });
  }
}
