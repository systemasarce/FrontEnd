import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ClienteItem } from './cliente.model';
import { ActualizarClienteRequest, ClienteService, RegistrarClienteRequest } from './cliente.service';

export interface ClienteRegisterDialogData {
  usrReg: string;
  cliente?: ClienteItem;
}

@Component({
  selector: 'app-cliente-register-dialog',
  templateUrl: './cliente-register-dialog.component.html',
  styleUrls: ['./cliente-register-dialog.component.scss']
})
export class ClienteRegisterDialogComponent implements OnInit {
  cargandoDatosCliente = false;
  guardando = false;
  saveError = '';

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly clienteService: ClienteService,
    private readonly dialogRef: MatDialogRef<ClienteRegisterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ClienteRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return !!this.data?.cliente?.id;
  }

  ngOnInit(): void {
    if (this.esEdicion) {
      this.cargarDatosCliente();
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
      this.actualizarCliente();
      return;
    }

    this.registrarCliente();
  }

  private registrarCliente(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarClienteRequest = {
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Usr_Reg: usrReg
    };

    this.guardando = true;

    this.clienteService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando cliente', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el cliente.';
      }
    });
  }

  private actualizarCliente(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    const id = this.data?.cliente?.id;
    if (!id) {
      this.saveError = 'No se pudo identificar al cliente a actualizar.';
      return;
    }

    const payload: ActualizarClienteRequest = {
      Id: id,
      Nombre: String(this.form.value.nombre ?? '').trim(),
      Estado: this.normalizarEstado(this.form.value.estado),
      Usr_Mod: usrMod
    };

    this.guardando = true;

    this.clienteService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando cliente', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el cliente.';
      }
    });
  }

  private cargarDatosCliente(): void {
    const id = this.data?.cliente?.id;
    if (!id) {
      return;
    }

    this.cargandoDatosCliente = true;

    this.clienteService.consultarDatos(id).subscribe({
      next: (response: unknown) => {
        const detalle = this.clienteService.mapClienteDetalle(response) as any;
        const raw = (response as any)?.data ?? response ?? {};
        const clienteBase = this.data?.cliente ?? {};

        const fuente = {
          ...clienteBase,
          ...raw,
          ...detalle
        };

        this.form.patchValue({
          nombre: this.extraerTexto(fuente, [
            'nombre',
            'Nombre',
            'Cliente_Nombre',
            'cliente_Nombre'
          ]),
          estado: this.normalizarEstado(this.extraerTexto(fuente, [
            'estado',
            'Estado'
          ]))
        });

        this.cargandoDatosCliente = false;
      },
      error: (error: unknown) => {
        console.error('Error consultando datos del cliente', error);
        this.cargandoDatosCliente = false;
        this.saveError = 'No se pudo cargar la información del cliente.';
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

  get nombreCtrl() {
    return this.form.controls.nombre;
  }

  get estadoCtrl() {
    return this.form.controls.estado;
  }
}
