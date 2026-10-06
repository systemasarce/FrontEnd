import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from '../../inspecciones-page/confirmacion-accion-dialog.component';
import { GrupoItem, GrupoFiltro } from './grupo.model';
import { GrupoRegisterDialogComponent } from './grupo-register-dialog.component';
import { GrupoService } from './grupo.service';

@Component({
  selector: 'app-grupo-page',
  templateUrl: './grupo-page.component.html',
  styleUrls: ['./grupo-page.component.scss']
})
export class GrupoPageComponent implements OnInit {
  readonly filtros: GrupoFiltro = {
    Grupo_Id: undefined,
    Grupo_Cod: undefined,
    Grupo_Nombre: '',
    Estado: 'A'
  };

  grupos: GrupoItem[] = [];
  cargando = false;
  eliminando = false;
  errorMessage = '';

  readonly pageSize = 20;
  paginaActual = 1;

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.grupos.length / this.pageSize));
  }

  get gruposPaginados(): GrupoItem[] {
    const inicio = (this.paginaActual - 1) * this.pageSize;
    return this.grupos.slice(inicio, inicio + this.pageSize);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  constructor(
    private readonly grupoService: GrupoService,
    private readonly dialog: MatDialog,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarGrupos();
  }

  abrirNuevo(): void {
    const dialogRef = this.dialog.open(GrupoRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || ''
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarGrupos();
      }
    });
  }

  editarGrupo(grupo: GrupoItem): void {
    if (grupo.grupoId === null || grupo.grupoId === undefined) {
      return;
    }

    const dialogRef = this.dialog.open(GrupoRegisterDialogComponent, {
      width: '560px',
      maxWidth: '96vw',
      disableClose: true,
      autoFocus: false,
      data: {
        usrReg: this.authService.getCurrentUser() || '',
        grupo
      }
    });

    dialogRef.afterClosed().subscribe((reload) => {
      if (reload === true) {
        this.cargarGrupos();
      }
    });
  }

  buscar(): void {
    this.cargarGrupos();
  }

  limpiar(): void {
    this.filtros.Grupo_Id = undefined;
    this.filtros.Grupo_Cod = undefined;
    this.filtros.Grupo_Nombre = '';
    this.filtros.Estado = 'A';
    this.cargarGrupos();
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) {
      return;
    }

    this.paginaActual = pagina;
  }

  trackByGrupo(_index: number, grupo: GrupoItem): number | null {
    return grupo.grupoId;
  }

  formatEstado(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }

    const normalized = text.toUpperCase();
    if (normalized === 'A' || normalized === 'ACTIVO' || normalized === '1' || normalized === 'TRUE') {
      return 'Activo';
    }

    if (normalized === 'I' || normalized === 'INACTIVO' || normalized === '0' || normalized === 'FALSE') {
      return 'Inactivo';
    }

    return text;
  }

  eliminarGrupo(grupo: GrupoItem): void {
    if (grupo.grupoId === null || grupo.grupoId === undefined) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar grupo',
        mensaje: `Se eliminará el grupo "${grupo.grupoNombre}". Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) {
        this.ejecutarEliminacionGrupo(grupo.grupoId as number);
      }
    });
  }

  private ejecutarEliminacionGrupo(id: number): void {
    const usrMod = this.authService.getCurrentUser().trim();
    if (!usrMod) {
      this.errorMessage = 'No se pudo identificar el usuario. Vuelve a iniciar sesión.';
      return;
    }

    this.eliminando = true;

    this.grupoService.eliminar(id, usrMod).subscribe({
      next: () => {
        this.eliminando = false;
        this.cargarGrupos();
      },
      error: (error: unknown) => {
        console.error('Error eliminando grupo', error);
        this.eliminando = false;
        this.errorMessage = 'No se pudo eliminar el grupo.';
      }
    });
  }

  cargarGrupos(): void {
    this.cargando = true;
    this.errorMessage = '';
    this.paginaActual = 1;

    this.grupoService.listar(this.filtros).pipe(
      catchError((error: unknown) => {
        console.error('Error cargando grupos', error);
        this.grupos = [];
        this.errorMessage = 'No se pudo cargar la información de Grupo.';
        this.cargando = false;
        return of([]);
      })
    ).subscribe({
      next: (response: unknown) => {
        this.grupos = this.grupoService.mapGrupoItems(response);
        this.cargando = false;
      },
      error: () => {
        this.grupos = [];
        this.cargando = false;
      }
    });
  }
}
