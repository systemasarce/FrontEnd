import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ClimaItem } from './clima.model';
import { ActualizarClimaRequest, ClimaService, RegistrarClimaRequest } from './clima.service';

export interface ClimaRegisterDialogData {
  usrReg: string;
  clima?: ClimaItem;
}

@Component({
  selector: 'app-clima-register-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clima-register-dialog.component.html',
  styleUrls: ['./clima-register-dialog.component.scss']
})
export class ClimaRegisterDialogComponent implements OnInit {
  cargandoDatosClima = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(255)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly climaService: ClimaService,
    private readonly dialogRef: MatDialogRef<ClimaRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ClimaRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.clima?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatosClima();
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
      this.actualizarClima();
      return;
    }

    this.registrarClima();
  }

  private cargarDatosClima(): void {
    const climaId = this.data?.clima?.id;
    if (!climaId) {
      return;
    }

    this.cargandoDatosClima = true;

    this.climaService.consultarDatos(climaId).subscribe({
      next: (response: unknown) => {
        const detalle = this.climaService.mapClimaDetalle(response);
        this.cargandoDatosClima = false;

        if (!detalle) {
          this.saveError = 'No se pudo cargar la información del clima.';
          return;
        }

        this.form.patchValue({
          nombre: detalle.nombre,
          estado: detalle.estado === 'I' ? 'I' : 'A'
        });
      },
      error: (error: unknown) => {
        console.error('Error consultando datos del clima', error);
        this.cargandoDatosClima = false;
        this.saveError = 'No se pudo cargar la información del clima.';
      }
    });
  }

  private registrarClima(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarClimaRequest = {
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.climaService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando clima', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el clima.';
      }
    });
  }

  private actualizarClima(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    const climaId = Number(this.data?.clima?.id ?? 0);

    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    if (!climaId) {
      this.saveError = 'No se pudo identificar el clima a actualizar.';
      return;
    }

    const payload: ActualizarClimaRequest = {
      Id: climaId,
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Estado: String(this.form.value.estado ?? 'A'),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.climaService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando clima', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el clima.';
      }
    });
  }
}
