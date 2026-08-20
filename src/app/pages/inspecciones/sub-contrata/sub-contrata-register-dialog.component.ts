import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SubContrataItem } from './sub-contrata.model';
import { ActualizarSubContrataRequest, RegistrarSubContrataRequest, SubContrataService } from './sub-contrata.service';

export interface SubContrataRegisterDialogData {
  usrReg: string;
  subContrata?: SubContrataItem;
}

@Component({
  selector: 'app-sub-contrata-register-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sub-contrata-register-dialog.component.html',
  styleUrls: ['./sub-contrata-register-dialog.component.scss']
})
export class SubContrataRegisterDialogComponent implements OnInit {
  cargandoDatosSubContrata = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(255)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly subContrataService: SubContrataService,
    private readonly dialogRef: MatDialogRef<SubContrataRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: SubContrataRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.subContrata?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatosSubContrata();
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
      this.actualizarSubContrata();
      return;
    }

    this.registrarSubContrata();
  }

  private cargarDatosSubContrata(): void {
    const subContrataId = this.data?.subContrata?.id;
    if (!subContrataId) {
      return;
    }

    this.cargandoDatosSubContrata = true;

    this.subContrataService.consultarDatos(subContrataId).subscribe({
      next: (response: unknown) => {
        const detalle = this.subContrataService.mapSubContrataDetalle(response);
        this.cargandoDatosSubContrata = false;

        if (!detalle) {
          this.saveError = 'No se pudo cargar la información de la sub contrata.';
          return;
        }

        this.form.patchValue({
          nombre: detalle.nombre,
          estado: detalle.estado === 'I' ? 'I' : 'A'
        });
      },
      error: (error: unknown) => {
        console.error('Error consultando datos de la sub contrata', error);
        this.cargandoDatosSubContrata = false;
        this.saveError = 'No se pudo cargar la información de la sub contrata.';
      }
    });
  }

  private registrarSubContrata(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarSubContrataRequest = {
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.subContrataService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando sub contrata', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar la sub contrata.';
      }
    });
  }

  private actualizarSubContrata(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    const subContrataId = Number(this.data?.subContrata?.id ?? 0);

    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    if (!subContrataId) {
      this.saveError = 'No se pudo identificar la sub contrata a actualizar.';
      return;
    }

    const payload: ActualizarSubContrataRequest = {
      Id: subContrataId,
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Estado: String(this.form.value.estado ?? 'A'),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.subContrataService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando sub contrata', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar la sub contrata.';
      }
    });
  }
}
