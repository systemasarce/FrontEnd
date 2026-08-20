import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { ApiService, EliminarObservacionPlaneadaRequest } from 'src/app/Services/api.services';
import type { CentroMonitoreoHseExcelRow } from 'src/app/shared/utils/centro-monitoreo-hse-excel.utils';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ConfirmacionAccionDialogComponent } from './confirmacion-accion-dialog.component';
import { ElegirEdicionCentroMonitoreoDialogComponent, ElegirEdicionCentroMonitoreoResultado } from './elegir-edicion-centro-monitoreo-dialog.component';
import { CentroMonitoreoHsePuntajeResult } from './centro-monitoreo-hse-puntaje-dialog.component';
import { WeReportArchivosDialogComponent } from './we-report-archivos-dialog.component';
import { CentroMonitoreoHseNotaResult } from './centro-monitoreo-hse-nota-dialog.component';
import { createCentroMonitoreoHseReportPdf, CentroMonitoreoHseReportePdfData } from 'src/app/shared/utils/centro-monitoreo-hse-report-pdf.utils';
import { createCentroMonitoreoHseExcel } from 'src/app/shared/utils/centro-monitoreo-hse-excel.utils';

type TabActivo = 'prevencion' | 'medio-ambiente' | 'observaciones' | 'stop-work' | 'we-report' | 'centro-monitoreo-hse';

interface ObservacionPlaneadaListado {
  Observacion_Id: number;
  Codigo_Obs: string;
  Usr_Nom: string;
  Jef_Nombre: string;
  Cen_Cos_Des: string;
  Cliente_Nombre: string;
  Subestacion_Nombre: string;
  Motivo_Nombre: string;
  Obs_Detalle: string;
}

interface MedioAmbienteListado {
  Medio_Ambiente_Id: number;
  Medio_Ambiente_Cod: string;
  Supervisor_Nom: string;
  Jef_Nombre: string;
  Cen_Cos_Des: string;
  Cliente_Nombre: string;
  Subestacion_Nombre: string;
  Actividad: string;
  Orden_Trabajo: string;
  Tipo_Nombre: string;
}

interface PrevencionListado {
  Prevencion_Id: number;
  Prevencion_Cod: string;
  Usr_Nom: string;
  Jef_Nombre: string;
  Cen_Cos_Des: string;
  Cliente_Nombre: string;
  Subestacion_Nombre: string;
  Actividad: string;
  Orden_Trabajo: string;
  Tipo_Nombre: string;
}

interface WeReportListado {
  We_Report_Id: number;
  Codigo_We_Report: string;
  Usr_Nom: string;
  Reporte_Tipo: string;
  Cen_Cos_Des: string;
  Cliente_Nombre: string;
  Report_Descripcion: string;
  Report_Acciones_Inmediata: string;
  Report_Foto1_Ubicacion?: string;
  Report_Foto2_Ubicacion?: string;
  Report_Potencial: string;
  Report_Aplica: string;
}

interface CentroMonitoreoListado {
  Centro_HSE_Id: number;
  Centro_HSE_Cod: string;
  Usr_Inspector: string;
  Usr_Supervisor: string;
  Cliente_Nombre: string;
  Centro_Revision: string;
  Centro_Puntaje: string;
  Centro_Comentario?: string;
  Centro_Ubicacion?: string;
  Estado?: string;
  Fec_Reg?: string;
  Fec_Mod?: string;
}

interface StopReportListado {
  Stop_Work_Id: number;
  Codigo_We_Report: string;
  Codigo_Stop_Work: string;
  Usr_Nom: string;
  Cen_Cos_Des: string;
  Stop_Supervisor_Nom: string;
  Stop_Inspector: string;
  Cliente_Nombre: string;
  OT: string;
  Tipo_Riesgo: string;
  Estado: string;
}

const LABEL_NUEVO: Record<TabActivo, string> = {
  'prevencion':      'Nueva inspección de prevención',
  'medio-ambiente':  'Nueva inspección de medio ambiente',
  'observaciones':   'Nueva observación planeada',
  'stop-work':       'Nuevo Stop Report',
  'we-report':       'Nuevo We Report',
  'centro-monitoreo-hse': 'Nuevo Monitoreo HSE',
};

@Component({
  selector: 'app-inspecciones-page',
  templateUrl: './inspecciones-page.component.html',
  styleUrls: ['./inspecciones-page.component.scss'],
})
export class InspeccionesPageComponent implements OnInit {
  vistaActual: 'inspecciones' | 'observaciones-planeadas' | 'medio-ambiente' | 'prevencion' | 'stop-report' | 'we-report-form' | 'centro-monitoreo-hse-form' | 'centro-monitoreo-hse-nota' | 'centro-monitoreo-hse-puntaje' = 'inspecciones';

  tabActivo: TabActivo = 'observaciones';

  filtroDesde: Date | null = new Date();
  filtroHasta: Date | null = new Date();
  estadoFiltro: 'A' | 'I' = 'A';
  busquedaGeneral = '';

  // ── Observaciones Planeadas ─────────────────────────────────────
  observacionesPlaneadas: ObservacionPlaneadaListado[] = [];
  cargandoObservacionesPlaneadas = false;
  eliminandoObservacion = false;

  // ── Medio Ambiente ──────────────────────────────────────────────
  registrosMedioAmbiente: MedioAmbienteListado[] = [];
  cargandoMedioAmbiente = false;
  eliminandoMedioAmbiente = false;

  // ── Prevención ──────────────────────────────────────────────────
  registrosPrevencion: PrevencionListado[] = [];
  cargandoPrevencion = false;
  eliminandoPrevencion = false;

  // ── We Report ───────────────────────────────────────────────────
  registrosWeReport: WeReportListado[] = [];
  cargandoWeReport = false;

  // ── Stop Report ─────────────────────────────────────────────────
  registrosStopReport: StopReportListado[] = [];
  cargandoStopReport = false;
  eliminandoStopReport = false;

  // ── Centro de Monitoreo HSE ──────────────────────────────────────
  registrosCentroMonitoreoHse: CentroMonitoreoListado[] = [];
  cargandoCentroMonitoreoHse = false;
  eliminandoCentroMonitoreoHse = false;
  centroMonitoreoIdSeleccionado: number | null = null;
  centroMonitoreoNotaSeleccionado: CentroMonitoreoListado | null = null;
  centroMonitoreoPuntajeSeleccionado: CentroMonitoreoListado | null = null;
  private centroMonitoreoLogoBytes: Uint8Array | null | undefined;

  registrosPorPagina = 10;
  opcionesRegistros = [10, 25, 50, 100, 0];
  paginaActual = 1;

  modoFormulario: 'nuevo' | 'editar' = 'nuevo';
  observacionIdSeleccionado: number | null = null;
  codigoObsSeleccionado: string | null = null;
  inspeccionIdSeleccionado: number | null = null;
  stopReportIdSeleccionado: number | null = null;
  weReportIdSeleccionado: number | null = null;
  weReportCodSeleccionado: string | null = null;

  constructor(
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.buscarRegistros();
  }

  get labelNuevo(): string {
    return LABEL_NUEVO[this.tabActivo];
  }

  cambiarTab(tab: TabActivo): void {
    this.tabActivo = tab;
    this.vistaActual = 'inspecciones';
    this.paginaActual = 1;
    this.closeCombos();

    if (tab === 'centro-monitoreo-hse') {
      this.prepararRangoInicialCentroMonitoreoHse();
    }

    this.buscarRegistros();
  }

  abrirObservacionesPlaneadas(): void {
    this.modoFormulario = 'nuevo';
    this.observacionIdSeleccionado = null;
    this.codigoObsSeleccionado = null;
    this.inspeccionIdSeleccionado = null;
    this.stopReportIdSeleccionado = null;
    this.weReportIdSeleccionado = null;
    this.weReportCodSeleccionado = null;
    this.centroMonitoreoIdSeleccionado = null;
    this.paginaActual = 1;
    this.closeCombos();

    switch (this.tabActivo) {
      case 'medio-ambiente':
        this.vistaActual = 'medio-ambiente';
        break;
      case 'prevencion':
        this.vistaActual = 'prevencion';
        break;
      case 'stop-work':
        this.vistaActual = 'stop-report';
        break;
      case 'we-report':
        this.vistaActual = 'we-report-form';
        break;
      case 'centro-monitoreo-hse':
        this.vistaActual = 'centro-monitoreo-hse-form';
        break;
      default:
        this.vistaActual = 'observaciones-planeadas';
        break;
    }
  }

  // ── Acciones Observaciones ──────────────────────────────────────
  editarObservacion(observacionId: number, codigoObs: string): void {
    this.modoFormulario = 'editar';
    this.observacionIdSeleccionado = observacionId ?? null;
    this.codigoObsSeleccionado = (codigoObs ?? '').trim() || null;
    this.vistaActual = 'observaciones-planeadas';
  }

  eliminarObservacion(obs: ObservacionPlaneadaListado): void {
    const codigoObs = (obs.Codigo_Obs ?? '').trim();
    if (!codigoObs) {
      alert('No se encontró el código de la observación para eliminar.');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar observación',
        mensaje: `Se eliminará la observación ${codigoObs}. Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.ejecutarEliminacionObservacion(codigoObs); }
    });
  }

  private ejecutarEliminacionObservacion(codigoObs: string): void {
    const usuario = this.authService.getCurrentUser().trim();
    if (!usuario) { alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.'); return; }

    const payload: EliminarObservacionPlaneadaRequest = { Codigo_Obs: codigoObs, Usr_Mod: usuario };

    this.eliminandoObservacion = true;
    this.apiService.eliminarObservacionPlaneada(payload).subscribe({
      next: (response: unknown) => {
        this.eliminandoObservacion = false;
        if (this.esRespuestaExitosa(response)) {
          this.cargarObservacionesPlaneadas();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo eliminar la observación planeada.');
        }
      },
      error: (error: unknown) => {
        this.eliminandoObservacion = false;
        alert(this.getErrorMessage(error, 'No se pudo eliminar la observación planeada.'));
      }
    });
  }

  // ── Acciones Medio Ambiente ─────────────────────────────────────
  editarMedioAmbiente(id: number): void {
    this.modoFormulario = 'editar';
    this.inspeccionIdSeleccionado = id;
    this.vistaActual = 'medio-ambiente';
  }

  eliminarMedioAmbiente(reg: MedioAmbienteListado): void {
    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar inspección',
        mensaje: `Se eliminará la inspección ${reg.Medio_Ambiente_Cod}. Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.ejecutarEliminacionMedioAmbiente(reg.Medio_Ambiente_Id); }
    });
  }

  private ejecutarEliminacionMedioAmbiente(id: number): void {
    const usuario = this.authService.getCurrentUser().trim();
    if (!usuario) { alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.'); return; }

    this.eliminandoMedioAmbiente = true;
    this.apiService.deleteEliminarMedioAmbiente(id, usuario).subscribe({
      next: (response: unknown) => {
        this.eliminandoMedioAmbiente = false;
        if (this.esRespuestaExitosa(response)) {
          this.cargarMedioAmbiente();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo eliminar la inspección.');
        }
      },
      error: (error: unknown) => {
        this.eliminandoMedioAmbiente = false;
        alert(this.getErrorMessage(error, 'No se pudo eliminar la inspección.'));
      }
    });
  }

  // ── Acciones Prevención ─────────────────────────────────────────
  editarPrevencion(id: number): void {
    this.modoFormulario = 'editar';
    this.inspeccionIdSeleccionado = id;
    this.vistaActual = 'prevencion';
  }

  eliminarPrevencion(reg: PrevencionListado): void {
    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar inspección',
        mensaje: `Se eliminará la inspección ${reg.Prevencion_Cod}. Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.ejecutarEliminacionPrevencion(reg.Prevencion_Id); }
    });
  }

  private ejecutarEliminacionPrevencion(id: number): void {
    const usuario = this.authService.getCurrentUser().trim();
    if (!usuario) { alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.'); return; }

    this.eliminandoPrevencion = true;
    this.apiService.deleteEliminarPrevencion(id, usuario).subscribe({
      next: (response: unknown) => {
        this.eliminandoPrevencion = false;
        if (this.esRespuestaExitosa(response)) {
          this.cargarPrevencion();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo eliminar la inspección de prevención.');
        }
      },
      error: (error: unknown) => {
        this.eliminandoPrevencion = false;
        alert(this.getErrorMessage(error, 'No se pudo eliminar la inspección de prevención.'));
      }
    });
  }


  // ── Acciones Stop Report ───────────────────────────────────────
  editarStopReport(stopReportId: number): void {
    this.modoFormulario = 'editar';
    this.stopReportIdSeleccionado = stopReportId ?? null;
    this.vistaActual = 'stop-report';
  }


  eliminarStopReport(reg: StopReportListado): void {
    const codigo = (reg.Codigo_Stop_Work ?? '').trim();
    if (!codigo) {
      alert('No se encontró el código del Stop Report para eliminar.');
      return;
    }

    const id = Number(reg.Stop_Work_Id ?? 0);
    if (!id || Number.isNaN(id)) {
      alert('No se encontró el ID del Stop Report para eliminar.');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar Stop Report',
        mensaje: `Se eliminará el Stop Report ${codigo}. Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.ejecutarEliminacionStopReport(id); }
    });
  }

  private ejecutarEliminacionStopReport(id: number): void {
    const usuario = (this.authService.getCurrentUser?.() ?? '').trim();
    if (!usuario) {
      alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.');
      return;
    }

    if (!id || Number.isNaN(id)) {
      alert('No se pudo identificar el ID del Stop Report.');
      return;
    }

    this.eliminandoStopReport = true;
    this.apiService.deleteEliminarStopReport(id, usuario).subscribe({
      next: (response: unknown) => {
        this.eliminandoStopReport = false;
        if (this.esRespuestaExitosa(response)) {
          this.cargarStopReport();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo eliminar el Stop Report.');
        }
      },
      error: (error: unknown) => {
        this.eliminandoStopReport = false;
        alert(this.getErrorMessage(error, 'No se pudo eliminar el Stop Report.'));
      }
    });
  }

  // ── Acciones Centro de Monitoreo HSE ────────────────────────────
  esRevisionAbierta(centroRevision: string | null | undefined): boolean {
    return String(centroRevision ?? '').trim().toUpperCase() === 'ABIERTO';
  }

  verNotaCentroMonitoreoHse(reg: CentroMonitoreoListado): void {
    this.centroMonitoreoNotaSeleccionado = reg;
    this.vistaActual = 'centro-monitoreo-hse-nota';
  }

  manejarNotaCentroMonitoreoGuardado(resultado: CentroMonitoreoHseNotaResult): void {
    const usuario = (this.authService.getCurrentUser?.() ?? '').trim();
    if (!usuario) {
      alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.');
      return;
    }

    if (!resultado.centroMonitoreoId) {
      alert('No se pudo identificar el Centro de Monitoreo HSE.');
      return;
    }

    const detalles: Array<{ Pregunta_Id: number; Puntaje_Tipo: 'A' | 'D'; Puntaje_Rpta: 'S' | 'N' }> = [];
    for (const respuesta of resultado.respuestas) {
      detalles.push({
        Pregunta_Id: respuesta.preguntaId,
        Puntaje_Tipo: 'A',
        Puntaje_Rpta: respuesta.audio === 'P' ? 'S' : 'N'
      });
      detalles.push({
        Pregunta_Id: respuesta.preguntaId,
        Puntaje_Tipo: 'D',
        Puntaje_Rpta: respuesta.documento === 'P' ? 'S' : 'N'
      });
    }

    this.apiService.postInsertarPuntajeCentroHse({
      Centro_HSE_Id: resultado.centroMonitoreoId,
      Usr_Reg: usuario,
      Centro_Comentario: resultado.comentario,
      Detalles: detalles
    }).subscribe({
      next: (response: unknown) => {
        if (this.esRespuestaExitosa(response)) {
          this.volverAInspecciones();
          this.cargarCentroMonitoreoHse();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo guardar la Nota de Centro de Monitoreo HSE.');
        }
      },
      error: (error: unknown) => {
        alert(this.getErrorMessage(error, 'No se pudo guardar la Nota de Centro de Monitoreo HSE.'));
      }
    });
  }

  cancelarNotaCentroMonitoreoHse(): void {
    this.volverAInspecciones();
  }

  elegirEdicionCentroMonitoreoHse(id: number): void {
    const dialogRef = this.dialog.open(ElegirEdicionCentroMonitoreoDialogComponent, {
      width: '420px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((resultado: ElegirEdicionCentroMonitoreoResultado) => {
      if (resultado === 'centro-monitoreo') {
        this.editarCentroMonitoreoHse(id);
      } else if (resultado === 'puntaje') {
        this.editarPuntajeCentroMonitoreoHse(id);
      }
    });
  }

  editarPuntajeCentroMonitoreoHse(id: number): void {
    const reg = this.registrosCentroMonitoreoHse.find((item) => item.Centro_HSE_Id === id) ?? null;
    this.centroMonitoreoPuntajeSeleccionado = reg;
    this.vistaActual = 'centro-monitoreo-hse-puntaje';
  }

  cancelarPuntajeCentroMonitoreoHse(): void {
    this.volverAInspecciones();
  }

  manejarPuntajeCentroMonitoreoGuardado(resultado: CentroMonitoreoHsePuntajeResult): void {
    const usuario = (this.authService.getCurrentUser?.() ?? '').trim();
    if (!usuario) {
      alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.');
      return;
    }

    if (!resultado.centroMonitoreoId) {
      alert('No se pudo identificar el Centro de Monitoreo HSE.');
      return;
    }

    this.apiService.postActualizarPuntajeCentroHse({
      Centro_HSE_Id: resultado.centroMonitoreoId,
      Usr_Mod: usuario,
      Detalles: resultado.detalles,
      Centro_Revision: resultado.Centro_Revision,
      Centro_Motivo: resultado.Centro_Motivo ?? resultado.Motivo,
      Motivo: resultado.Motivo,
      Centro_Comentario: resultado.Centro_Comentario
    }).subscribe({
      next: (response: unknown) => {
        if (this.esRespuestaExitosa(response)) {
          this.volverAInspecciones();
          this.cargarCentroMonitoreoHse();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo actualizar el Puntaje de Centro de Monitoreo HSE.');
        }
      },
      error: (error: unknown) => {
        alert(this.getErrorMessage(error, 'No se pudo actualizar el Puntaje de Centro de Monitoreo HSE.'));
      }
    });
  }

  async verPdfCentroMonitoreoHse(reg: CentroMonitoreoListado): Promise<void> {
    if (!reg?.Centro_HSE_Id) {
      alert('No se pudo identificar el registro del Centro de Monitoreo HSE.');
      return;
    }

    const ventana = window.open('', '_blank');
    if (!ventana) {
      alert('El navegador bloqueó la vista previa del PDF. Habilita las ventanas emergentes e inténtalo de nuevo.');
      return;
    }

    try {
      const logoBytes = await this.loadArceLogoBytes();
      const pdfData = await this.obtenerDatosPdfCentroMonitoreoHse(reg);
      const pdfBlob = createCentroMonitoreoHseReportPdf(pdfData, { logoBytes });

      const url = URL.createObjectURL(pdfBlob);
      ventana.location.href = url;
      ventana.focus();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error: unknown) {
      ventana.close();
      alert(this.getErrorMessage(error, 'No se pudo generar la vista previa del PDF del Centro de Monitoreo HSE.'));
    }
  }

  async descargarPdfCentroMonitoreoHse(reg: CentroMonitoreoListado): Promise<void> {
    if (!reg?.Centro_HSE_Id) {
      alert('No se pudo identificar el registro del Centro de Monitoreo HSE.');
      return;
    }

    try {
      const logoBytes = await this.loadArceLogoBytes();
      const pdfData = await this.obtenerDatosPdfCentroMonitoreoHse(reg);
      const pdfBlob = createCentroMonitoreoHseReportPdf(pdfData, { logoBytes });

      const url = URL.createObjectURL(pdfBlob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `Centro_HSE_${reg.Centro_HSE_Cod || reg.Centro_HSE_Id}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error: unknown) {
      alert(this.getErrorMessage(error, 'No se pudo generar el PDF del Centro de Monitoreo HSE.'));
    }
  }

  descargarExcelGeneralCentroMonitoreoHse(): void {
    this.apiService.getExcelGeneralCentroMonitoreoHse().subscribe({
      next: (rows: CentroMonitoreoHseExcelRow[]) => {
        const blob = createCentroMonitoreoHseExcel(rows ?? []);
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `Centro_Monitoreo_HSE_General_${this.formatearFechaArchivo(new Date())}.xlsx`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: (error: unknown) => {
        alert(this.getErrorMessage(error, 'No se pudo generar el Excel general del Centro de Monitoreo HSE.'));
      }
    });
  }

  descargarExcelEspecificoCentroMonitoreoHse(): void {
    const fechaDesde = this.formatearFechaConsulta(this.filtroDesde);
    const fechaHasta = this.formatearFechaConsulta(this.filtroHasta);

    if (!fechaDesde || !fechaHasta) {
      alert('Selecciona un rango de fechas para exportar el Excel específico.');
      return;
    }

    this.apiService.getExcelEspecificoCentroMonitoreoHse(fechaDesde, fechaHasta, this.estadoFiltro).subscribe({
      next: (rows: CentroMonitoreoHseExcelRow[]) => {
        const blob = createCentroMonitoreoHseExcel(rows ?? []);
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `Centro_Monitoreo_HSE_Especifico_${this.formatearFechaArchivo(new Date())}.xlsx`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: (error: unknown) => {
        alert(this.getErrorMessage(error, 'No se pudo generar el Excel específico del Centro de Monitoreo HSE.'));
      }
    });
  }

  editarCentroMonitoreoHse(id: number): void {
    this.modoFormulario = 'editar';
    this.centroMonitoreoIdSeleccionado = id ?? null;
    this.vistaActual = 'centro-monitoreo-hse-form';
  }

  eliminarCentroMonitoreoHse(reg: CentroMonitoreoListado): void {
    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar Monitoreo HSE',
        mensaje: `Se eliminará el registro ${reg.Centro_HSE_Cod}. Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.ejecutarEliminacionCentroMonitoreoHse(reg.Centro_HSE_Id); }
    });
  }

  private ejecutarEliminacionCentroMonitoreoHse(id: number): void {
    const usuario = (this.authService.getCurrentUser?.() ?? '').trim();
    if (!usuario) {
      alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.');
      return;
    }

    this.eliminandoCentroMonitoreoHse = true;
    this.apiService.postEliminarCentroMonitoreoHse({ Centro_Monitoreo_Id: id, Usr_Mod: usuario }).subscribe({
      next: (response: unknown) => {
        this.eliminandoCentroMonitoreoHse = false;
        if (this.esRespuestaExitosa(response)) {
          this.cargarCentroMonitoreoHse();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo eliminar el registro de Monitoreo HSE.');
        }
      },
      error: (error: unknown) => {
        this.eliminandoCentroMonitoreoHse = false;
        alert(this.getErrorMessage(error, 'No se pudo eliminar el registro de Monitoreo HSE.'));
      }
    });
  }

  editarWeReport(registro: WeReportListado): void {
    this.modoFormulario = 'editar';
    this.weReportIdSeleccionado = registro.We_Report_Id;
    this.weReportCodSeleccionado = null;
    this.inspeccionIdSeleccionado = null;
    this.observacionIdSeleccionado = null;
    this.codigoObsSeleccionado = null;
    this.vistaActual = 'we-report-form';
  }

  eliminarWeReport(registro: WeReportListado): void {
    const codigo = (registro.Codigo_We_Report ?? '').trim();
    if (!codigo) {
      alert('No se encontró el código del We Report para eliminar.');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Eliminar We Report',
        mensaje: `Se eliminará el We Report ${codigo}. Esta acción cambiará su estado a inactivo.`,
        textoConfirmar: 'Confirmar eliminación',
        textoCancelar: 'Volver',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean) => {
      if (confirmado) { this.ejecutarEliminacionWeReport(registro.We_Report_Id); }
    });
  }

  private ejecutarEliminacionWeReport(id: number): void {
    const usuario = (this.authService.getCurrentUser?.() ?? '').trim();
    if (!usuario) {
      alert('No se pudo identificar el usuario. Vuelve a iniciar sesión.');
      return;
    }

    this.apiService.postEliminarWeReport({ We_Report_Id: id, Usr_Mod: usuario }).subscribe({
      next: (response: unknown) => {
        if (this.esRespuestaExitosa(response)) {
          this.buscarRegistros();
        } else {
          alert(this.getRespuestaMensaje(response) || 'No se pudo eliminar el We Report.');
        }
      },
      error: (error: unknown) => {
        alert(this.getErrorMessage(error, 'No se pudo eliminar el We Report.'));
      }
    });
  }

  manejarWeReportGuardado(event: { weReportId: number; weReportCod: string; aplicaStopWork: boolean }): void {
    this.weReportIdSeleccionado = event.weReportId;
    this.weReportCodSeleccionado = event.weReportCod;
    this.modoFormulario = 'nuevo';

    if (event.aplicaStopWork) {
      this.stopReportIdSeleccionado = null;
      this.vistaActual = 'stop-report';
      return;
    }

    this.vistaActual = 'we-report-form';
  }

  abrirArchivosWeReport(registro: WeReportListado): void {
    this.dialog.open(WeReportArchivosDialogComponent, {
      width: '920px',
      maxWidth: '96vw',
      autoFocus: false,
      disableClose: false,
      panelClass: 'we-report-archivos-dialog-panel',
      data: registro
    });
  }

  closeCombos(): void {
    // En esta vista no hay combos desplegables propios todavía,
    // pero el método se mantiene para compatibilidad con las llamadas existentes.
  }

  // ── Volver ──────────────────────────────────────────────────────
  volverAInspecciones(): void {
    this.vistaActual = 'inspecciones';
    this.modoFormulario = 'nuevo';
    this.observacionIdSeleccionado = null;
    this.codigoObsSeleccionado = null;
    this.inspeccionIdSeleccionado = null;
    this.stopReportIdSeleccionado = null;
    this.weReportIdSeleccionado = null;
    this.weReportCodSeleccionado = null;
    this.centroMonitoreoIdSeleccionado = null;
    this.centroMonitoreoNotaSeleccionado = null;
    this.centroMonitoreoPuntajeSeleccionado = null;
    this.paginaActual = 1;
    this.closeCombos();
    this.buscarRegistros();
  }

  buscarRegistros(): void {
    if (this.tabActivo === 'medio-ambiente') {
      this.cargarMedioAmbiente();
    } else if (this.tabActivo === 'prevencion') {
      this.cargarPrevencion();
    } else if (this.tabActivo === 'observaciones') {
      this.cargarObservacionesPlaneadas();
    } else if (this.tabActivo === 'stop-work') {
      this.cargarStopReport();
    } else if (this.tabActivo === 'we-report') {
      this.cargarWeReport();
    } else if (this.tabActivo === 'centro-monitoreo-hse') {
      this.cargarCentroMonitoreoHse();
    }
  }

  // alias para compatibilidad con el HTML existente
  buscarObservaciones(): void { this.buscarRegistros(); }

  private prepararRangoInicialCentroMonitoreoHse(): void {
    if (!this.esRangoPorDefectoActual()) {
      return;
    }

    const hoy = new Date();
    this.filtroDesde = new Date(hoy.getFullYear(), 0, 1);
    this.filtroHasta = hoy;
  }

  private esRangoPorDefectoActual(): boolean {
    if (!this.filtroDesde || !this.filtroHasta) {
      return false;
    }

    const hoy = new Date();
    return this.mismaFecha(this.filtroDesde, hoy) && this.mismaFecha(this.filtroHasta, hoy);
  }

  private mismaFecha(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  // ── Filtros ─────────────────────────────────────────────────────
  cambiarFiltroDesde(valor: Date | null): void { this.filtroDesde = valor; }
  cambiarFiltroHasta(valor: Date | null): void { this.filtroHasta = valor; }
  cambiarBusqueda(valor: string): void { this.busquedaGeneral = valor ?? ''; this.paginaActual = 1; }
  cambiarEstado(valor: string): void { this.estadoFiltro = valor === 'A' ? 'A' : 'I'; this.paginaActual = 1; }

  cambiarRegistrosPorPagina(valor: string): void {
    const numero = this.toNumber(valor);
    this.registrosPorPagina = numero >= 0 ? numero : 10;
    this.paginaActual = 1;
  }

  // ── Getters paginación Observaciones ───────────────────────────
  get observacionesFiltradas(): ObservacionPlaneadaListado[] {
    let items = [...this.observacionesPlaneadas];
    const termino = this.normalizarTexto(this.busquedaGeneral.trim());
    if (termino) {
      items = items.filter(item =>
        this.normalizarTexto(this.crearTextoBusquedaObs(item)).includes(termino)
      );
    }
    return items;
  }

  get observacionesPaginadas(): ObservacionPlaneadaListado[] {
    if (this.registrosPorPagina <= 0) { return this.observacionesFiltradas; }
    return this.observacionesFiltradas.slice(this.inicioPagina, this.inicioPagina + this.registrosPorPagina);
  }

  // ── Getters paginación Medio Ambiente ──────────────────────────
  get medioAmbienteFiltrado(): MedioAmbienteListado[] {
    let items = [...this.registrosMedioAmbiente];
    const termino = this.normalizarTexto(this.busquedaGeneral.trim());
    if (termino) {
      items = items.filter(item =>
        this.normalizarTexto(this.crearTextoBusquedaMA(item)).includes(termino)
      );
    }
    return items;
  }

  get medioAmbientePaginado(): MedioAmbienteListado[] {
    if (this.registrosPorPagina <= 0) { return this.medioAmbienteFiltrado; }
    return this.medioAmbienteFiltrado.slice(this.inicioPagina, this.inicioPagina + this.registrosPorPagina);
  }

  // ── Getters paginación Prevención ─────────────────────────────
  get prevencionFiltrado(): PrevencionListado[] {
    let items = [...this.registrosPrevencion];
    const termino = this.normalizarTexto(this.busquedaGeneral.trim());
    if (termino) {
      items = items.filter(item =>
        this.normalizarTexto(this.crearTextoBusquedaPrevencion(item)).includes(termino)
      );
    }
    return items;
  }

  get prevencionPaginado(): PrevencionListado[] {
    if (this.registrosPorPagina <= 0) { return this.prevencionFiltrado; }
    return this.prevencionFiltrado.slice(this.inicioPagina, this.inicioPagina + this.registrosPorPagina);
  }

  // ── Getters paginación We Report ───────────────────────────────
  get weReportFiltrados(): WeReportListado[] {
    let items = [...this.registrosWeReport];
    const termino = this.normalizarTexto(this.busquedaGeneral.trim());
    if (termino) {
      items = items.filter(item =>
        this.normalizarTexto(this.crearTextoBusquedaWeReport(item)).includes(termino)
      );
    }
    return items;
  }

  get weReportPaginados(): WeReportListado[] {
    if (this.registrosPorPagina <= 0) { return this.weReportFiltrados; }
    return this.weReportFiltrados.slice(this.inicioPagina, this.inicioPagina + this.registrosPorPagina);
  }

  // ── Getters paginación Stop Report ─────────────────────────────
  get stopReportFiltrado(): StopReportListado[] {
    let items = [...this.registrosStopReport];
    const termino = this.normalizarTexto(this.busquedaGeneral.trim());
    if (termino) {
      items = items.filter(item =>
        this.normalizarTexto(this.crearTextoBusquedaStopReport(item)).includes(termino)
      );
    }
    return items;
  }

  get stopReportPaginado(): StopReportListado[] {
    if (this.registrosPorPagina <= 0) { return this.stopReportFiltrado; }
    return this.stopReportFiltrado.slice(this.inicioPagina, this.inicioPagina + this.registrosPorPagina);
  }

  // ── Getters paginación Centro de Monitoreo HSE ─────────────────
  get centroMonitoreoFiltrado(): CentroMonitoreoListado[] {
    let items = [...this.registrosCentroMonitoreoHse];
    const termino = this.normalizarTexto(this.busquedaGeneral.trim());
    if (termino) {
      items = items.filter(item =>
        this.normalizarTexto(this.crearTextoBusquedaCentroMonitoreo(item)).includes(termino)
      );
    }
    return items;
  }

  get centroMonitoreoPaginado(): CentroMonitoreoListado[] {
    if (this.registrosPorPagina <= 0) { return this.centroMonitoreoFiltrado; }
    return this.centroMonitoreoFiltrado.slice(this.inicioPagina, this.inicioPagina + this.registrosPorPagina);
  }

  get totalFiltrados(): number {
    if (this.tabActivo === 'medio-ambiente') {
      return this.medioAmbienteFiltrado.length;
    }

    if (this.tabActivo === 'prevencion') {
      return this.prevencionFiltrado.length;
    }

    if (this.tabActivo === 'we-report') {
      return this.weReportFiltrados.length;
    }

    if (this.tabActivo === 'stop-work') {
      return this.stopReportFiltrado.length;
    }

    if (this.tabActivo === 'centro-monitoreo-hse') {
      return this.centroMonitoreoFiltrado.length;
    }

    return this.observacionesFiltradas.length;
  }

  get totalMostrado(): number {
    if (this.tabActivo === 'medio-ambiente') {
      return this.medioAmbientePaginado.length;
    }

    if (this.tabActivo === 'prevencion') {
      return this.prevencionPaginado.length;
    }

    if (this.tabActivo === 'we-report') {
      return this.weReportPaginados.length;
    }

    if (this.tabActivo === 'stop-work') {
      return this.stopReportPaginado.length;
    }

    if (this.tabActivo === 'centro-monitoreo-hse') {
      return this.centroMonitoreoPaginado.length;
    }

    return this.observacionesPaginadas.length;
  }

  get desdeMostrado(): number { return this.totalFiltrados > 0 ? this.inicioPagina + 1 : 0; }
  get hastaMostrado(): number { return this.totalFiltrados > 0 ? Math.min(this.inicioPagina + this.totalMostrado, this.totalFiltrados) : 0; }
  get totalPaginas(): number { return this.registrosPorPagina <= 0 ? 1 : Math.max(1, Math.ceil(this.totalFiltrados / this.registrosPorPagina)); }
  get puedeIrAnterior(): boolean { return this.registrosPorPagina > 0 && this.paginaActual > 1; }
  get puedeIrSiguiente(): boolean { return this.registrosPorPagina > 0 && this.paginaActual < this.totalPaginas; }
  get inicioPagina(): number { return this.registrosPorPagina <= 0 ? 0 : (this.paginaActual - 1) * this.registrosPorPagina; }

  paginaAnterior(): void {
    if (this.puedeIrAnterior) { this.paginaActual--; }
  }

  paginaSiguiente(): void {
    if (this.puedeIrSiguiente) { this.paginaActual++; }
  }

  private ajustarPaginaActual(): void {
    this.paginaActual = Math.min(this.paginaActual, this.totalPaginas);
    if (this.paginaActual < 1) { this.paginaActual = 1; }
  }

  // ── Carga de datos ──────────────────────────────────────────────
  private cargarObservacionesPlaneadas(): void {
    this.cargandoObservacionesPlaneadas = true;
    const fechaDesde = this.formatearFechaConsulta(this.filtroDesde);
    const fechaHasta = this.formatearFechaConsulta(this.filtroHasta);

    if (!fechaDesde || !fechaHasta) {
      this.observacionesPlaneadas = [];
      this.cargandoObservacionesPlaneadas = false;
      return;
    }

    this.apiService.getFiltrarObservaciones(fechaDesde, fechaHasta, this.estadoFiltro).subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.observacionesPlaneadas = raw.map(item => ({
          Observacion_Id: this.toNumber(item?.['Observacion_Id'] ?? item?.['observacion_Id'] ?? 0),
          Codigo_Obs:        this.texto(item?.['Codigo_Obs']        ?? item?.['codigo_Obs']),
          Usr_Nom:           this.texto(item?.['Usr_Nom']           ?? item?.['usr_Nom']),
          Jef_Nombre:        this.texto(item?.['Jef_Nombre']        ?? item?.['jef_Nombre']),
          Cen_Cos_Des:       this.texto(item?.['Cen_Cos_Des']       ?? item?.['cen_Cos_Des']),
          Cliente_Nombre:    this.texto(item?.['Cliente_Nombre']    ?? item?.['cliente_Nombre']),
          Subestacion_Nombre:this.texto(item?.['Subestacion_Nombre']?? item?.['subestacion_Nombre']),
          Motivo_Nombre:     this.texto(item?.['Motivo_Nombre']     ?? item?.['motivo_Nombre']),
          Obs_Detalle:       this.texto(item?.['Obs_Detalle']       ?? item?.['obs_Detalle']),
        }));
        this.ajustarPaginaActual();
        this.cargandoObservacionesPlaneadas = false;
      },
      error: () => {
        this.observacionesPlaneadas = [];
        this.cargandoObservacionesPlaneadas = false;
      }
    });
  }

  private cargarPrevencion(): void {
    this.cargandoPrevencion = true;
    const fechaDesde = this.formatearFechaConsulta(this.filtroDesde);
    const fechaHasta = this.formatearFechaConsulta(this.filtroHasta);

    if (!fechaDesde || !fechaHasta) {
      this.registrosPrevencion = [];
      this.cargandoPrevencion = false;
      return;
    }

    this.apiService.getFiltrarPrevencion(fechaDesde, fechaHasta, this.estadoFiltro).subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.registrosPrevencion = raw.map(item => ({
          Prevencion_Id:  this.toNumber(item?.['Prevencion_Id']  ?? item?.['prevencion_Id']  ?? 0),
          Prevencion_Cod: this.texto(item?.['Prevencion_Cod'] ?? item?.['prevencion_Cod']),
          Usr_Nom:        this.texto(item?.['Usr_Nom']         ?? item?.['usr_Nom']),
          Jef_Nombre:     this.texto(item?.['Jef_Nombre']     ?? item?.['jef_Nombre']),
          Cen_Cos_Des:    this.texto(item?.['Cen_Cos_Des']    ?? item?.['cen_Cos_Des']),
          Cliente_Nombre: this.texto(item?.['Cliente_Nombre'] ?? item?.['cliente_Nombre']),
          Subestacion_Nombre: this.texto(item?.['Subestacion_Nombre'] ?? item?.['subestacion_Nombre']),
          Actividad:      this.texto(item?.['Actividad']      ?? item?.['actividad']),
          Orden_Trabajo:  this.texto(item?.['Orden_Trabajo']  ?? item?.['orden_Trabajo']),
          Tipo_Nombre:    this.texto(item?.['Tipo_Nombre']    ?? item?.['tipo_Nombre']),
        }));
        this.ajustarPaginaActual();
        this.cargandoPrevencion = false;
      },
      error: () => {
        this.registrosPrevencion = [];
        this.cargandoPrevencion = false;
      }
    });
  }

  private cargarMedioAmbiente(): void {
    this.cargandoMedioAmbiente = true;
    const fechaDesde = this.formatearFechaConsulta(this.filtroDesde);
    const fechaHasta = this.formatearFechaConsulta(this.filtroHasta);

    if (!fechaDesde || !fechaHasta) {
      this.registrosMedioAmbiente = [];
      this.cargandoMedioAmbiente = false;
      return;
    }

    this.apiService.getFiltrarMedioAmbiente(fechaDesde, fechaHasta, this.estadoFiltro).subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.registrosMedioAmbiente = raw.map(item => ({
          Medio_Ambiente_Id:  this.toNumber(item?.['Medio_Ambiente_Id']  ?? item?.['medio_Ambiente_Id']  ?? 0),
          Medio_Ambiente_Cod: this.texto(item?.['Medio_Ambiente_Cod'] ?? item?.['medio_Ambiente_Cod']),
          Supervisor_Nom:     this.texto(item?.['Supervisor_Nom']     ?? item?.['supervisor_Nom']),
          Jef_Nombre:         this.texto(item?.['Jef_Nombre']         ?? item?.['jef_Nombre']),
          Cen_Cos_Des:        this.texto(item?.['Cen_Cos_Des']        ?? item?.['cen_Cos_Des']),
          Cliente_Nombre:     this.texto(item?.['Cliente_Nombre']     ?? item?.['cliente_Nombre']),
          Subestacion_Nombre: this.texto(item?.['Subestacion_Nombre'] ?? item?.['subestacion_Nombre']),
          Actividad:          this.texto(item?.['Actividad']          ?? item?.['actividad']),
          Orden_Trabajo:      this.texto(item?.['Orden_Trabajo']      ?? item?.['orden_Trabajo']),
          Tipo_Nombre:        this.texto(item?.['Tipo_Nombre']        ?? item?.['tipo_Nombre']),
        }));
        this.ajustarPaginaActual();
        this.cargandoMedioAmbiente = false;
      },
      error: () => {
        this.registrosMedioAmbiente = [];
        this.cargandoMedioAmbiente = false;
      }
    });
  }

  private cargarWeReport(): void {
    this.cargandoWeReport = true;
    const fechaDesde = this.formatearFechaConsulta(this.filtroDesde);
    const fechaHasta = this.formatearFechaConsulta(this.filtroHasta);

    if (!fechaDesde || !fechaHasta) {
      this.registrosWeReport = [];
      this.cargandoWeReport = false;
      return;
    }

    this.apiService.getFiltrarWeReport(fechaDesde, fechaHasta, this.estadoFiltro).subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.registrosWeReport = raw.map(item => ({
          We_Report_Id: this.toNumber(item?.['We_Report_Id'] ?? item?.['we_Report_Id'] ?? 0),
          Codigo_We_Report: this.texto(item?.['Codigo_We_Report'] ?? item?.['codigo_We_Report']),
          Usr_Nom: this.texto(item?.['Usr_Nom'] ?? item?.['usr_Nom']),
          Reporte_Tipo: this.texto(item?.['Reporte_Tipo'] ?? item?.['reporte_Tipo']),
          Cen_Cos_Des: this.texto(item?.['Cen_Cos_Des'] ?? item?.['cen_Cos_Des']),
          Cliente_Nombre: this.texto(item?.['Cliente_Nombre'] ?? item?.['cliente_Nombre']),
          Report_Descripcion: this.texto(item?.['Report_Descripcion'] ?? item?.['report_Descripcion']),
          Report_Acciones_Inmediata: this.texto(item?.['Report_Acciones_Inmediata'] ?? item?.['report_Acciones_Inmediata']),
          Report_Foto1_Ubicacion: this.texto(item?.['Report_Foto1_Ubicacion'] ?? item?.['report_Foto1_Ubicacion']),
          Report_Foto2_Ubicacion: this.texto(item?.['Report_Foto2_Ubicacion'] ?? item?.['report_Foto2_Ubicacion']),
          Report_Potencial: this.texto(item?.['Report_Potencial'] ?? item?.['report_Potencial']),
          Report_Aplica: this.texto(item?.['Report_Aplica'] ?? item?.['report_Aplica']),
        }));
        this.ajustarPaginaActual();
        this.cargandoWeReport = false;
      },
      error: () => {
        this.registrosWeReport = [];
        this.cargandoWeReport = false;
      }
    });
  }

  private cargarStopReport(): void {
    this.cargandoStopReport = true;
    const fechaDesde = this.formatearFechaConsulta(this.filtroDesde);
    const fechaHasta = this.formatearFechaConsulta(this.filtroHasta);

    if (!fechaDesde || !fechaHasta) {
      this.registrosStopReport = [];
      this.cargandoStopReport = false;
      return;
    }

    this.apiService.getFiltrarStopReport(fechaDesde, fechaHasta, this.estadoFiltro).subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.registrosStopReport = raw.map(item => ({
          Stop_Work_Id: this.toNumber(item?.['Stop_Work_Id'] ?? item?.['stop_Work_Id'] ?? item?.['Stop_Report_Id'] ?? item?.['stop_Report_Id'] ?? 0),
          Codigo_We_Report: this.texto(item?.['Codigo_We_Report'] ?? item?.['codigo_We_Report'] ?? item?.['We_Report_Cod'] ?? item?.['we_Report_Cod']),
          Codigo_Stop_Work: this.texto(item?.['Codigo_Stop_Work'] ?? item?.['codigo_Stop_Work']),
          Usr_Nom: this.texto(item?.['Usr_Nom'] ?? item?.['usr_Nom']),
          Cen_Cos_Des: this.texto(item?.['Cen_Cos_Des'] ?? item?.['cen_Cos_Des']),
          Stop_Supervisor_Nom: this.texto(item?.['Stop_Supervisor_Nom'] ?? item?.['stop_Supervisor_Nom']),
          Stop_Inspector: this.texto(item?.['Stop_Inspector'] ?? item?.['stop_Inspector']),
          Cliente_Nombre: this.texto(item?.['Cliente_Nombre'] ?? item?.['cliente_Nombre']),
          OT: this.texto(item?.['OT'] ?? item?.['ot'] ?? item?.['Stop_OP'] ?? item?.['stop_OP']),
          Tipo_Riesgo: this.texto(item?.['Tipo_Riesgo'] ?? item?.['tipo_Riesgo']),
          Estado: this.texto(item?.['Estado'] ?? item?.['estado']),
        }));
        this.ajustarPaginaActual();
        this.cargandoStopReport = false;
      },
      error: () => {
        this.registrosStopReport = [];
        this.cargandoStopReport = false;
      }
    });
  }

  private cargarCentroMonitoreoHse(): void {
    this.cargandoCentroMonitoreoHse = true;
    const fechaDesde = this.formatearFechaConsulta(this.filtroDesde);
    const fechaHasta = this.formatearFechaConsulta(this.filtroHasta);

    if (!fechaDesde || !fechaHasta) {
      this.registrosCentroMonitoreoHse = [];
      this.cargandoCentroMonitoreoHse = false;
      return;
    }

    this.apiService.getFiltrarCentroMonitoreoHse(fechaDesde, fechaHasta, this.estadoFiltro).subscribe({
      next: (response: unknown) => {
        const raw = this.extraerLista<Record<string, unknown>>(response);
        this.registrosCentroMonitoreoHse = raw.map(item => ({
          Centro_HSE_Id:   this.toNumber(item?.['Centro_HSE_Id']   ?? item?.['centro_HSE_Id']   ?? 0),
          Centro_HSE_Cod:  this.texto(item?.['Centro_HSE_Cod']     ?? item?.['centro_HSE_Cod']),
          Usr_Inspector:   this.texto(item?.['Usr_Inspector']      ?? item?.['usr_Inspector']),
          Usr_Supervisor:  this.texto(item?.['Usr_Supervisor']     ?? item?.['usr_Supervisor']),
          Cliente_Nombre:  this.texto(item?.['Cliente_Nombre']     ?? item?.['cliente_Nombre']),
          Centro_Revision: this.texto(item?.['Centro_Revision']    ?? item?.['centro_Revision']),
          Centro_Puntaje:  this.texto(item?.['Centro_Puntaje']     ?? item?.['centro_Puntaje']),
          Centro_Comentario: this.texto(item?.['Centro_Comentario'] ?? item?.['centro_Comentario'] ?? item?.['Comentario'] ?? item?.['comentario']),
          Centro_Ubicacion: this.texto(item?.['Centro_Ubicacion']   ?? item?.['centro_Ubicacion'] ?? item?.['Ubicacion'] ?? item?.['ubicacion']),
          Estado:          this.texto(item?.['Estado']             ?? item?.['estado'] ?? item?.['Revision'] ?? item?.['revision']),
          Fec_Reg:         this.texto(item?.['Fec_Reg']            ?? item?.['fec_Reg']),
          Fec_Mod:         this.texto(item?.['Fec_Mod']            ?? item?.['fec_Mod']),
        }));
        this.ajustarPaginaActual();
        this.cargandoCentroMonitoreoHse = false;
      },
      error: () => {
        this.registrosCentroMonitoreoHse = [];
        this.cargandoCentroMonitoreoHse = false;
      }
    });
  }

  private formatearFechaArchivo(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const hours = String(fecha.getHours()).padStart(2, '0');
    const minutes = String(fecha.getMinutes()).padStart(2, '0');
    const seconds = String(fecha.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  // ── Helpers ─────────────────────────────────────────────────────
  private formatearFechaConsulta(fecha: Date | null): string {
    if (!fecha) { return ''; }
    const year  = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day   = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private crearTextoBusquedaObs(item: ObservacionPlaneadaListado): string {
    return [item.Codigo_Obs, item.Usr_Nom, item.Jef_Nombre, item.Cen_Cos_Des,
            item.Cliente_Nombre, item.Subestacion_Nombre, item.Motivo_Nombre, item.Obs_Detalle].join(' ');
  }

  private crearTextoBusquedaMA(item: MedioAmbienteListado): string {
    return [item.Medio_Ambiente_Cod, item.Supervisor_Nom, item.Jef_Nombre, item.Cen_Cos_Des,
            item.Cliente_Nombre, item.Subestacion_Nombre, item.Actividad,
            item.Orden_Trabajo, item.Tipo_Nombre].join(' ');
  }

  private crearTextoBusquedaPrevencion(item: PrevencionListado): string {
    return [item.Prevencion_Cod, item.Usr_Nom, item.Jef_Nombre, item.Cen_Cos_Des,
            item.Cliente_Nombre, item.Subestacion_Nombre, item.Actividad,
            item.Orden_Trabajo, item.Tipo_Nombre].join(' ');
  }

  private crearTextoBusquedaWeReport(item: WeReportListado): string {
    return [item.Codigo_We_Report, item.Usr_Nom, item.Reporte_Tipo, item.Cen_Cos_Des,
            item.Cliente_Nombre, item.Report_Descripcion, item.Report_Acciones_Inmediata,
            item.Report_Potencial, item.Report_Aplica].join(' ');
  }

  private crearTextoBusquedaStopReport(item: StopReportListado): string {
    return [item.Codigo_Stop_Work, item.Usr_Nom, item.Cen_Cos_Des, item.Stop_Supervisor_Nom,
            item.Stop_Inspector, item.Cliente_Nombre, item.OT, item.Tipo_Riesgo, item.Estado].join(' ');
  }

  private crearTextoBusquedaCentroMonitoreo(item: CentroMonitoreoListado): string {
    return [item.Centro_HSE_Cod, item.Usr_Inspector, item.Usr_Supervisor, item.Cliente_Nombre, item.Centro_Revision, item.Centro_Comentario, item.Centro_Ubicacion, item.Estado].join(' ');
  }

  private normalizarTexto(value: string): string {
    return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private extraerLista<T>(response: unknown): T[] {
    if (Array.isArray(response)) { return response as T[]; }
    if (response && typeof response === 'object') {
      const r = response as Record<string, unknown>;
      for (const k of ['Elements','elements','Data','data','Result','result','items','Items','response','Response']) {
        if (Array.isArray(r[k])) { return r[k] as T[]; }
        if (r[k] && typeof r[k] === 'object') {
          const c = r[k] as Record<string, unknown>;
          for (const n of ['Elements','elements','Data','data','Result','result']) {
            if (Array.isArray(c[n])) { return c[n] as T[]; }
          }
        }
      }
    }
    return [];
  }
  private async obtenerDatosPdfCentroMonitoreoHse(reg: CentroMonitoreoListado): Promise<CentroMonitoreoHseReportePdfData> {
    const base: CentroMonitoreoHseReportePdfData = {
      codigo: reg.Centro_HSE_Cod || `#${reg.Centro_HSE_Id}`,
      supervisor: reg.Usr_Supervisor || '-',
      inspector: reg.Usr_Inspector || '-',
      fecha: this.formatearFechaPdf(reg.Fec_Mod || reg.Fec_Reg),
      hora: this.formatearHoraPdf(reg.Fec_Mod || reg.Fec_Reg),
      estado: reg.Estado || reg.Centro_Revision || '-',
      ubicacion: this.normalizarUbicacionMaps(reg.Centro_Ubicacion) || '-',
      puntaje: reg.Centro_Puntaje || '-',
      motivoEdicion: reg.Centro_Comentario || '-',
    };

    const detalle = await this.cargarDetallePdfCentroMonitoreoHse(reg.Centro_HSE_Id);
    if (!detalle) {
      return base;
    }

    return {
      codigo: this.texto(this.valor(detalle, 'Centro_HSE_Cod', 'Centro_HSE_COD', 'Codigo_Centro_HSE')) || base.codigo,
      supervisor: this.texto(this.valor(detalle, 'Supervisor', 'Usr_Supervisor', 'Supervisor_Nom', 'Usr_Nom')) || base.supervisor,
      inspector: this.texto(this.valor(detalle, 'Inspector', 'Usr_Inspector', 'Inspector_Nom', 'Usr_Nom')) || base.inspector,
      fecha: this.formatearFechaPdf(this.valor(detalle, 'Fecha', 'Fec_Mod', 'Fec_Reg')) || base.fecha,
      hora: this.formatearHoraPdf(this.valor(detalle, 'Hora', 'Fec_Mod', 'Fec_Reg')) || base.hora,
      estado: this.texto(this.valor(detalle, 'Centro_Revision', 'Revision', 'Estado')) || base.estado,
      ubicacion: this.normalizarUbicacionMaps(this.valor(detalle, 'Centro_Ubicacion', 'Ubicacion', 'ubicacion')) || base.ubicacion,
      puntaje: this.texto(this.valor(detalle, 'Centro_Puntaje', 'Puntaje')) || base.puntaje,
      motivoEdicion: this.texto(this.valor(detalle, 'Centro_Comentario', 'Comentario', 'Motivo')) || base.motivoEdicion,
    };
  }

  private async cargarDetallePdfCentroMonitoreoHse(id: number): Promise<Record<string, unknown> | null> {
    try {
      const response = await firstValueFrom(this.apiService.getDatosReportePdfCentroMonitoreoHse(id));
      if (Array.isArray(response)) {
        return (response[0] as Record<string, unknown>) ?? null;
      }
      if (response && typeof response === 'object') {
        return response as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private valor(obj: Record<string, unknown>, ...keys: string[]): unknown {
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return '';
  }

  private formatearFechaPdf(value: unknown): string {
    const texto = this.texto(value);
    if (!texto) { return ''; }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) { return texto; }

    const fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) { return texto; }

    const day = String(fecha.getDate()).padStart(2, '0');
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const year = fecha.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatearHoraPdf(value: unknown): string {
    const texto = this.texto(value);
    if (!texto) { return ''; }
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(texto)) { return texto.length === 5 ? `${texto}:00` : texto; }

    const fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) { return texto; }

    const hour = String(fecha.getHours()).padStart(2, '0');
    const minute = String(fecha.getMinutes()).padStart(2, '0');
    const second = String(fecha.getSeconds()).padStart(2, '0');
    return `${hour}:${minute}:${second}`;
  }

  private normalizarUbicacionMaps(value: unknown): string {
    const texto = this.texto(value);
    if (!texto) {
      return '';
    }

    if (/^https?:\/\//i.test(texto)) {
      return texto;
    }

    const coordenadas = texto.replace(/\s+/g, '');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordenadas)}`;
  }

  private async loadArceLogoBytes(): Promise<Uint8Array | undefined> {
    if (this.centroMonitoreoLogoBytes !== undefined) {
      return this.centroMonitoreoLogoBytes ?? undefined;
    }

    const candidates = [
      'assets/ArceLogo.jpg',
      './assets/ArceLogo.jpg',
      '/assets/ArceLogo.jpg'
    ];

    for (const ruta of candidates) {
      try {
        const response = await fetch(ruta, { cache: 'no-cache' });
        if (!response.ok) {
          continue;
        }

        this.centroMonitoreoLogoBytes = new Uint8Array(await response.arrayBuffer());
        return this.centroMonitoreoLogoBytes;
      } catch {
        // Probar la siguiente ruta.
      }
    }

    this.centroMonitoreoLogoBytes = null;
    return undefined;
  }

  private texto(value: unknown): string {
    if (value === undefined || value === null) { return ''; }
    return String(value).trim();
  }

  private toNumber(value: unknown): number {
    if (value === undefined || value === null || value === '') { return 0; }
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }

  private esRespuestaExitosa(response: unknown): boolean {
    if (response && typeof response === 'object') {
      const r = response as Record<string, unknown>;
      if (r['success'] !== undefined) { return r['success'] === true; }
      if (r['Success'] !== undefined) { return r['Success'] === true; }
    }
    return true;
  }

  private getRespuestaMensaje(response: unknown): string {
    if (response && typeof response === 'object') {
      const r = response as Record<string, unknown>;
      for (const k of ['message', 'Message']) {
        const v = r[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') { return String(v); }
      }
    }
    return '';
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
      const r = error as Record<string, unknown>;
      const body = r['error'];
      if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        // Priorizar 'detail'/'Detail' (mensaje SQL real) sobre 'message'/'Message',
        // que suele ser un texto genérico fijo definido en el backend.
        for (const k of ['detail', 'Detail', 'message', 'Message']) {
          const v = b[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') { return String(v); }
        }
      }
      for (const k of ['detail', 'Detail', 'message', 'Message']) {
        const v = r[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') { return String(v); }
      }
    }
    return fallback;
  }
}
