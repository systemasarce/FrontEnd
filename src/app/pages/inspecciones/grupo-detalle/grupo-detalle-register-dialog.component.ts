import { Component, ElementRef, HostListener, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { catchError, finalize, of } from 'rxjs';

import { GrupoItem } from '../grupo/grupo.model';
import { GrupoService } from '../grupo/grupo.service';
import { GrupoDetalleItem } from './grupo-detalle.model';
import {
  ActualizarGrupoDetalleRequest,
  GrupoDetalleService,
  RegistrarGrupoDetalleRequest
} from './grupo-detalle.service';

export interface GrupoDetalleRegisterDialogData {
  usrReg: string;
  grupoDetalle?: GrupoDetalleItem;
}

@Component({
  selector: 'app-grupo-detalle-register-dialog',
  templateUrl: './grupo-detalle-register-dialog.component.html',
  styleUrls: ['./grupo-detalle-register-dialog.component.scss']
})
export class GrupoDetalleRegisterDialogComponent implements OnInit {
  guardando = false;
  cargandoGrupos = false;
  saveError = '';
  grupos: GrupoItem[] = [];
  grupoSeleccionado: GrupoItem | null = null;
  grupoComboAbierto = false;
  grupoBusqueda = '';

  readonly form = this.fb.group({
    detalleCod: ['', [Validators.required, Validators.maxLength(15)]],
    detalleNombre: ['', [Validators.required]],
    detalleValor: [null as number | null, [Validators.required, Validators.min(0)]],
    grupoId: [null as number | null, [Validators.required, Validators.min(1)]],
    estado: ['A', [Validators.required]]
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly grupoDetalleService: GrupoDetalleService,
    private readonly grupoService: GrupoService,
    private readonly dialogRef: MatDialogRef<GrupoDetalleRegisterDialogComponent>,
    private readonly elementRef: ElementRef<HTMLElement>,
    @Inject(MAT_DIALOG_DATA) public readonly data: GrupoDetalleRegisterDialogData
  ) {}

  get esEdicion(): boolean {
    return this.data?.grupoDetalle?.detalleId !== null && this.data?.grupoDetalle?.detalleId !== undefined;
  }

  ngOnInit(): void {
    this.cargarGrupos();

    if (this.esEdicion) {
      const detalle = this.data.grupoDetalle!;
      this.form.patchValue({
        detalleCod: detalle.detalleCod,
        detalleNombre: detalle.detalleNombre,
        detalleValor: detalle.detalleValor,
        grupoId: detalle.grupoId,
        estado: this.normalizarEstado(detalle.estado)
      });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target || !this.elementRef.nativeElement.contains(target)) {
      this.grupoComboAbierto = false;
    }
  }

  private cargarGrupos(): void {
    this.cargandoGrupos = true;
    this.grupoService.listar({ Estado: 'A' }).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando grupos para Grupo Detalle', error);
        this.saveError = 'No se pudo cargar la lista de grupos.';
        return of([]);
      }),
      finalize(() => this.cargandoGrupos = false)
    ).subscribe((response: unknown) => {
      this.grupos = this.grupoService.mapGrupoItems(response);
      this.sincronizarGrupoSeleccionado();
    });
  }

  private sincronizarGrupoSeleccionado(): void {
    const grupoId = Number(this.form.value.grupoId ?? 0);
    if (grupoId > 0) {
      this.grupoSeleccionado = this.grupos.find(x => Number(x.grupoId) === grupoId) ?? null;
      if (this.grupoSeleccionado) {
        return;
      }
    }

    const grupoNombre = String(this.data?.grupoDetalle?.grupoNombre ?? '').trim();
    if (grupoNombre) {
      this.grupoSeleccionado = this.grupos.find(
        x => this.normalizarTexto(x.grupoNombre) === this.normalizarTexto(grupoNombre)
      ) ?? null;
    }
  }

  toggleGrupoCombo(): void {
    if (this.cargandoGrupos) {
      return;
    }

    this.grupoComboAbierto = !this.grupoComboAbierto;
    if (this.grupoComboAbierto) {
      this.grupoBusqueda = '';
    }
  }

  seleccionarGrupo(grupo: GrupoItem | null): void {
    this.grupoSeleccionado = grupo;
    this.form.patchValue({ grupoId: grupo?.grupoId ?? null });
    this.grupoComboAbierto = false;
    this.grupoBusqueda = '';
    this.form.get('grupoId')?.markAsTouched();
  }

  get grupoDisplay(): string {
    if (this.grupoSeleccionado) {
      return this.grupoSeleccionado.grupoNombre;
    }

    const grupoId = Number(this.form.value.grupoId ?? 0);
    if (grupoId > 0) {
      const grupo = this.grupos.find(x => Number(x.grupoId) === grupoId);
      if (grupo) {
        return grupo.grupoNombre;
      }
    }

    return 'Seleccione grupo';
  }

  get gruposFiltrados(): GrupoItem[] {
    const termino = this.normalizarTexto(this.grupoBusqueda);
    if (!termino) {
      return this.grupos;
    }

    return this.grupos.filter(grupo =>
      this.normalizarTexto(`${grupo.grupoCod} ${grupo.grupoNombre}`).includes(termino)
    );
  }

  onGrupoBusqueda(event: Event): void {
    this.grupoBusqueda = (event.target as HTMLInputElement).value ?? '';
  }

  cerrar(): void {
    this.dialogRef.close(false);
  }

  guardar(): void {
    this.saveError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError = 'Completa todos los campos obligatorios.';
      return;
    }

    if (this.esEdicion) {
      this.actualizarGrupoDetalle();
    } else {
      this.registrarGrupoDetalle();
    }
  }

  private registrarGrupoDetalle(): void {
    const usrReg = String(this.data?.usrReg ?? '').trim();
    if (!usrReg) {
      this.saveError = 'No se pudo obtener el usuario registrado.';
      return;
    }

    const payload: RegistrarGrupoDetalleRequest = {
      Detalle_Cod: String(this.form.value.detalleCod ?? '').trim(),
      Detalle_Nombre: String(this.form.value.detalleNombre ?? '').trim(),
      Detalle_Valor: Number(this.form.value.detalleValor),
      Grupo_Id: Number(this.form.value.grupoId),
      Usr_Reg: usrReg
    };

    this.guardando = true;
    this.grupoDetalleService.registrar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error registrando Grupo Detalle', error);
        this.guardando = false;
        this.saveError = 'No se pudo registrar el Grupo Detalle.';
      }
    });
  }

  private actualizarGrupoDetalle(): void {
    const usrMod = String(this.data?.usrReg ?? '').trim();
    const id = this.data?.grupoDetalle?.detalleId;

    if (!usrMod) {
      this.saveError = 'No se pudo obtener el usuario que modifica.';
      return;
    }

    if (id === null || id === undefined) {
      this.saveError = 'No se pudo identificar el Grupo Detalle a actualizar.';
      return;
    }

    const payload: ActualizarGrupoDetalleRequest = {
      Detalle_Id: id,
      Detalle_Cod: String(this.form.value.detalleCod ?? '').trim(),
      Detalle_Nombre: String(this.form.value.detalleNombre ?? '').trim(),
      Detalle_Valor: Number(this.form.value.detalleValor),
      Grupo_Id: Number(this.form.value.grupoId),
      Usr_Mod: usrMod
    };

    this.guardando = true;
    this.grupoDetalleService.actualizar(payload).subscribe({
      next: () => {
        this.guardando = false;
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        console.error('Error actualizando Grupo Detalle', error);
        this.guardando = false;
        this.saveError = 'No se pudo actualizar el Grupo Detalle.';
      }
    });
  }

  private normalizarEstado(value: unknown): string {
    const texto = String(value ?? '').trim().toUpperCase();
    return texto === 'I' || texto === 'INACTIVO' ? 'I' : 'A';
  }

  private normalizarTexto(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
