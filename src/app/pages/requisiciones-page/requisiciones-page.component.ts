import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom, forkJoin, from, of } from 'rxjs';
import { concatMap, map, switchMap, toArray } from 'rxjs/operators';

import { ActualizarDetallePedidoRequest, ActualizarPedidoEstadoRequest, ActualizarPedidoRequest, ApiService, CatalogoNumeroOption, CatalogoTextoOption, EliminarDetallePedidoRequest, EnviarCorreoPedidoAprobadoRequest, EnviarCorreoPedidoRechazadoRequest, PedidosFiltro, RechazarPedidoRequest, RegistrarCentroCostoPedidoRequest, RegistrarDetallePedidoRequest, RegistrarPedidoRequest } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ApprovalUserOption, ApprovalUserSelectorDialogComponent } from './approval-user-selector-dialog.component';
import { CentroCostoOption, CentroCostoSelectorDialogComponent } from './centro-costo-selector-dialog.component';
import { PedidoCancelDialogComponent } from './pedido-cancel-dialog.component';
import { PedidoDetalleDeleteDialogComponent } from './pedido-detalle-delete-dialog.component';
import { PedidoDetalleDialogComponent, PedidoDetalleDialogData } from './pedido-detalle-dialog.component';
import { PedidoDetalleDialogValue, PedidoDetalleItemOption, PedidoDetalleUnidadOption } from './pedido-detalle-dialog.models';
import { PedidoArchivoDialogRow, PedidoArchivosDialogComponent } from './pedido-archivos-dialog.component';
import { PedidoRechazoDialogComponent, PedidoRechazoDialogResult } from './pedido-rechazo-dialog.component';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { formatDateInputValue, formatDisplayDate } from 'src/app/shared/utils/date.utils';
import {
  createPedidoReportPdf,
  mapPedidoReportDisplayDate,
  PedidoReporteDetallePdf,
  PedidoReporteEmbeddedImage,
  PedidoReportePdfData
} from 'src/app/shared/utils/pedido-report-pdf.utils';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

type DataRecord = Record<string, unknown>;

interface RequisitionRow {
  requisicion: number;
  codigo: string;
  archivo: string;
  archivoNombre: string;
  gerencia: string;
  fecha: string;
  proveedor: string;
  moneda: string;
  total: number;
  estado: string;
  codigoUsr: string;
  usrAprobacion: string;
  fechaUsrGa: string;
  ordenCompraServicio: string;
  gn: string;
  tipo: string;
}

interface CentroCostoRow {
  id: number;
  codigo: number;
  costo: string;
  cantidad: number;
  persistedId: number | null;
}

interface PedidoDetalleRow {
  id: number;
  persistedId: number | null;
  item: string;
  codigoItem: string;
  descripcion: string;
  centroCostoId: number | null;
  centroCosto: string;
  unidadCodigo: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface PedidoArchivoAdjuntoRow {
  id: number;
  pedidoId: number;
  nombre: string;
  ruta: string;
}

interface PedidoReporteCabeceraRow {
  pedidoId: number;
  fechaSolicitud: string;
  solicitante: string;
  recepciona: string;
  centroCosto: string;
  ot: string;
  referencia: string;
  referenciaGeneral: string;
  tipoServicio: string;
  tipoCompra: string;
  moneda: string;
  almacen: string;
  oc: string;
  telefono: string;
  lugarEntrega: string;
  direccionEntrega: string;
  fechaEntrega: string;
  proveedorReferencia: string;
  detalle: PedidoReporteDetallePdf[];
}

@Component({
  selector: 'app-requisiciones-page',
  templateUrl: './requisiciones-page.component.html',
  styleUrls: ['./requisiciones-page.component.scss']
})
export class RequisicionesPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly cabeceraForm: FormGroup;
  readonly centroCostoForm: FormGroup;
  readonly detalleForm: FormGroup;
  readonly detallePedidoForm: FormGroup;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  readonly estadoOptions = ['Pendiente', 'Aprobado', 'Cancelado', 'Rechazado'];
  tipoOptions: CatalogoTextoOption[] = [
    { codigo: '', descripcion: 'Todos' }
  ];
  readonly actionButtons = ['Nuevo', 'Modificar', 'Rechazar', 'Eliminar', 'Aprobar'];
  tipoServicioOptions: CatalogoTextoOption[] = [];
  tipoMoneda: CatalogoNumeroOption[] = [];
  requisiciones: RequisitionRow[] = [];
  centrosCosto: CentroCostoRow[] = [];
  editandoCentroCostoId: number | null = null;
  editandoCentroCostoCantidad = 0;
  archivoAdjunto = 'Sin archivo adjunto';
  mostrarEditorPedido = false;
  mostrarDetallePedido = false;
  isLoadingPedidos = false;
  isLoadingArchivosAdjuntosListado: number | null = null;
  isLoadingApprovalUsers = false;
  isLoadingCentrosCosto = false;
  errorMessage = '';
  isLoadingCorrelativo = false;
  isSavingPedido = false;
  isUpdatingPedidoEstado = false;
  approvalUsers: ApprovalUserOption[] = [];
  centroCostoOptions: CentroCostoOption[] = [];
  saveErrorMessage = '';
  selectedPedidoId: number | null = null;
  isEditingPedido = false;
  isLoadingPedidoDetalle = false;
  expandedPedidoId: number | null = null;
  isLoadingDetalleExpandido = false;
  detalleExpandidoError = '';
  pedidoDetalles: Record<number, PedidoDetalleRow[]> = {};
  pedidoCentrosCosto: Record<number, CentroCostoRow[]> = {};
  pedidoDetalleCantidadLimites: Record<number, number> = {};
  detalleItemOptions: PedidoDetalleItemOption[] = [];
  detalleUnidadOptions: PedidoDetalleUnidadOption[] = [];
  selectedPedidoDetalleId: number | null = null;
  isEditingPedidoDetalle = false;
  isSavingPedidoDetalle = false;
  isLoadingReportePedidoId: number | null = null;
  private pedidoLogoBytes: Uint8Array | null | undefined;
  private pedidoHeaderImageBytes: Uint8Array | null | undefined;
  detallePedidoErrorMessage = '';
  detallePedidoCantidadLimite = 0;
  currentPedidosPage = 1;
  currentDetalleExpandidoPage = 1;
  currentCentroCostoPage = 1;
  archivoFile: File | null = null;
  archivoFiles: File[] = [];
  archivosAdjuntosGuardados: PedidoArchivoAdjuntoRow[] = [];

  private nextCentroCostoId = 1;
  private deletedCentroCostoIds: number[] = [];
  private detallePedidoCabecera: RequisitionRow | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly dialog: MatDialog,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.filtersForm = this.formBuilder.group({
      nroRequisicion: [''],
      proveedor: [''],
      estado: ['Pendiente'],
      tipo: [''],
      ordenCompraServicio: ['Todos']
    });

    this.cabeceraForm = this.formBuilder.group({
      requisicionCompra: [null],
      usuarioAprobacionId: [0],
      usuarioAprobacion: ['', [Validators.required, noWhitespaceValidator()]]
    });

    this.centroCostoForm = this.formBuilder.group({
      centroCostoId: [0],
      centroCosto: ['']
    });

    this.detalleForm = this.formBuilder.group({
      lugarEntrega: ['', [Validators.required, noWhitespaceValidator()]],
      referencia: ['', [Validators.required, noWhitespaceValidator()]],
      oc: ['', Validators.required],
      moneda: [null, Validators.required],
      fechaEntrega: [this.getPedidoFechaEntregaMinima(), Validators.required],
      referenciaGeneral: [''],
      sustento: ['', [Validators.required, noWhitespaceValidator()]],
      archivo: ['Sin archivo adjunto']
    });

    this.detallePedidoForm = this.formBuilder.group({
      codigoItem: [''],
      unidad: [''],
      centroCostoId: [0],
      centroCostoDescripcion: [''],
      centroCostoCantidadRequerida: [0],
      cantidad: [0],
      precioUnitario: [0]
    });
  }

  ngOnInit(): void {
    this.cargarUsuariosAprobacion();
    this.cargarCentrosCosto();
    this.cargarCatalogosDetallePedido();
    this.cargarPedidos();
    this.resetPedidoEditor();
    this.mostrarEditorPedido = false;
  }

  get totalPorcentaje(): number {
    return this.centrosCosto.reduce((accumulator, item) => accumulator + item.cantidad, 0);
  }

  get approvalUserButtonLabel(): string {
    return this.cabeceraForm.controls['usuarioAprobacion'].value?.trim() || 'Seleccionar';
  }

  get centroCostoButtonLabel(): string {
    return this.centroCostoForm.controls['centroCosto'].value?.trim() || '+ Clic para seleccionar centro de costo';
  }

  get canModifyPedido(): boolean {
    return this.selectedPedidoId !== null && !this.isLoadingPedidoDetalle;
  }

  get canApprovePedido(): boolean {
    return this.canModifyPedido && this.isSelectedPedidoAssignedToCurrentUser();
  }

  get canManagePedidoDetalle(): boolean {
    return this.mostrarDetallePedido && this.expandedPedidoId !== null && !this.isLoadingDetalleExpandido && !this.isSavingPedidoDetalle;
  }

  get canModifyPedidoDetalle(): boolean {
    const selectedDetail = this.getSelectedPedidoDetalleRow();
    return this.canManagePedidoDetalle && !!selectedDetail && selectedDetail.persistedId !== null;
  }

  get detallePedidoSeleccionado(): RequisitionRow | null {
    return this.detallePedidoCabecera;
  }

  get detallePedidoSubtotal(): number {
    const cantidad = this.normalizeCantidadCentroCosto(Number(this.detallePedidoForm.controls['cantidad'].value));
    const precioUnitario = this.normalizeCantidadCentroCosto(Number(this.detallePedidoForm.controls['precioUnitario'].value));
    return this.normalizeCantidadCentroCosto(cantidad * precioUnitario);
  }

  get detallePedidoCantidadDisponible(): number {
    if (this.expandedPedidoId === null) {
      return this.detallePedidoCantidadLimite;
    }

    return this.normalizeCantidadCentroCosto(
      Math.max(0, this.detallePedidoCantidadLimite - this.getTotalActualDetalleSinSeleccionado(this.expandedPedidoId))
    );
  }

  get paginatedRequisiciones(): RequisitionRow[] {
    return paginateItems(this.requisicionesFiltradasPorOrden, this.currentPedidosPage, this.pageSize);
  }

  get requisicionesFiltradasPorOrden(): RequisitionRow[] {
    const filtro = String(this.filtersForm.controls['ordenCompraServicio']?.value || 'Todos');

    if (filtro === 'Con OC/OS') {
      return this.requisiciones.filter((item) => this.tieneOrdenCompraServicio(item));
    }

    if (filtro === 'Pendientes de Generar') {
      return this.requisiciones.filter((item) => !this.tieneOrdenCompraServicio(item));
    }

    return this.requisiciones;
  }

  get paginatedDetallePedidoExpandido(): PedidoDetalleRow[] {
    return paginateItems(this.getDetallePedidoExpandido(), this.currentDetalleExpandidoPage, this.pageSize);
  }

  get paginatedCentrosCosto(): CentroCostoRow[] {
    return paginateItems(this.centrosCosto, this.currentCentroCostoPage, this.pageSize);
  }

  get pedidoFechaEntregaMinima(): string {
    return this.getPedidoFechaEntregaMinima();
  }

  get pedidoFechaEntregaMinimaDate(): Date {
    const [year, month, day] = this.getPedidoFechaEntregaMinima().split('-').map((value) => Number(value));

    if (!year || !month || !day) {
      return new Date();
    }

    return new Date(year, month - 1, day);
  }

  private getPedidoFechaEntregaMinima(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  }

  aplicarFiltros(): void {
    this.cargarPedidos();
  }

  onFiltroOrdenCompraServicioChange(): void {
    this.currentPedidosPage = 1;
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      nroRequisicion: '',
      proveedor: '',
      estado: 'Pendiente',
      tipo: 'Todos',
      ordenCompraServicio: 'Todos'
    });
    this.cargarPedidos();
  }

  formatTotal(total: number, moneda: string): string {
    const totalFormateado = new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(total);
    return totalFormateado;
  }

  formatDetalleNumero(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    }).format(value);
  }

  verReportePedido(item: RequisitionRow): void {
    if (this.isLoadingReportePedidoId === item.requisicion) {
      return;
    }

    this.isLoadingReportePedidoId = item.requisicion;
    this.errorMessage = '';

    this.apiService.getCargarReportePedido(String(item.requisicion)).subscribe({
      next: async (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo cargar el reporte del pedido.');
          const reporte = this.mapPedidoReporteCabecera(response, item);

          if (!reporte) {
            throw new Error('No se encontro informacion para el reporte del pedido.');
          }

          const logoBytes = await this.loadPedidoLogoBytes();
          const headerImageBytes = await this.loadPedidoHeaderImageBytes();
          const pdfData = await this.buildPedidoReportePdfData(reporte, item);
          const pdfBlob = createPedidoReportPdf(pdfData, { logoBytes, headerImageBytes });
          const url = URL.createObjectURL(pdfBlob);
          window.open(url, '_blank');
          this.isLoadingReportePedidoId = null;
        } catch (error) {
          this.errorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el reporte del pedido.');
          this.isLoadingReportePedidoId = null;
        }
      },
      error: (error: unknown) => {
        console.error('Error cargando reporte del pedido:', error);
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el reporte del pedido.');
        this.isLoadingReportePedidoId = null;
      }
    });
  }

  ejecutarAccion(action: string): void {
    if (action === 'Nuevo') {
      this.iniciarNuevoPedido();
      return;
    }

    if (action === 'Modificar') {
      this.modificarPedidoSeleccionado();
      return;
    }

    if (action === 'Rechazar') {
      this.abrirDialogoRechazoPedido();
      return;
    }

    if (action === 'Eliminar') {
      this.actualizarEstadoPedidoSeleccionado('C', 'No se pudo cancelar el pedido seleccionado.');
      return;
    }

    if (action === 'Aprobar') {
      this.actualizarEstadoPedidoSeleccionado('A', 'No se pudo aprobar el pedido seleccionado.');
    }

  }

  isActionDisabled(action: string): boolean {
    if (action === 'Aprobar' || action === 'Rechazar') {
      if (this.isUpdatingPedidoEstado) {
        return true;
      }

      return !this.canApprovePedido;
    }

    if (action === 'Modificar' || action === 'Eliminar') {
      if (this.isUpdatingPedidoEstado) {
        return true;
      }

      return !this.canModifyPedido;
    }

    return false;
  }

  iniciarNuevoPedido(): void {
    this.resetPedidoEditor();
    this.isEditingPedido = false;
    this.cerrarDetallePedido();
    this.mostrarEditorPedido = true;
    this.cargarCorrelativoNuevo();
  }

  seleccionarPedido(item: RequisitionRow): void {
    this.selectedPedidoId = item.requisicion;
  }

  isPedidoSeleccionado(item: RequisitionRow): boolean {
    return this.selectedPedidoId === item.requisicion;
  }

  private getSelectedPedidoRow(): RequisitionRow | null {
    if (this.selectedPedidoId === null) {
      return null;
    }

    return this.requisiciones.find((item) => item.requisicion === this.selectedPedidoId) ?? null;
  }

  private isSelectedPedidoAssignedToCurrentUser(): boolean {
    const selectedPedido = this.getSelectedPedidoRow();

    if (!selectedPedido) {
      return false;
    }

    const usuarioAprobacion = this.normalizeUsuarioComparacion(selectedPedido.usrAprobacion);
    const usuarioActual = this.normalizeUsuarioComparacion(this.authService.getCurrentUser());

    return !!usuarioAprobacion && usuarioAprobacion === usuarioActual;
  }

  private normalizeUsuarioComparacion(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private abrirDialogoRechazoPedido(): void {
    if (this.selectedPedidoId === null || this.isUpdatingPedidoEstado || !this.canApprovePedido) {
      return;
    }

    const dialogRef = this.dialog.open(PedidoRechazoDialogComponent, {
      autoFocus: false,
      width: 'min(34rem, 92vw)'
    });

    dialogRef.afterClosed().subscribe((result?: PedidoRechazoDialogResult) => {
      if (!result?.motivo) {
        return;
      }

      this.rechazarPedidoSeleccionado(result.motivo);
    });
  }

  private rechazarPedidoSeleccionado(motivo: string): void {
    if (this.selectedPedidoId === null || this.isUpdatingPedidoEstado) {
      return;
    }

    const selectedPedido = this.getSelectedPedidoRow();

    this.isUpdatingPedidoEstado = true;
    this.errorMessage = '';

    this.apiService.patchRechazarPedido({
      Ped_Id: this.selectedPedidoId,
      Ped_Mot_Rch: motivo
    } as RechazarPedidoRequest).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo rechazar el pedido seleccionado.');
          if (selectedPedido) {
            this.enviarCorreoPedidoRechazadoARegistrador(selectedPedido, motivo);
          }
          this.isUpdatingPedidoEstado = false;
          this.cargarPedidos();
          window.dispatchEvent(new CustomEvent('pedido-notifications-refresh'));
        } catch (error) {
          this.errorMessage = this.resolveErrorMessage(error, 'No se pudo rechazar el pedido seleccionado.');
          this.isUpdatingPedidoEstado = false;
        }
      },
      error: (error: unknown) => {
        console.error('Error rechazando pedido:', error);
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo rechazar el pedido seleccionado.');
        this.isUpdatingPedidoEstado = false;
      }
    });
  }

  private enviarCorreoPedidoRechazadoARegistrador(pedido: RequisitionRow, motivo: string): void {
    const usuarioRegistro = String(pedido.codigoUsr || '').trim();

    if (!usuarioRegistro || usuarioRegistro === '-') {
      return;
    }

    this.apiService.getListarUsuarioActivo({ Usr_Cod: usuarioRegistro }).pipe(
      switchMap((response: unknown) => {
        const usuario = this.extractRecords(response)[0];
        const correoDestino = usuario
          ? this.getTextValue(usuario, ['Usr_Corr', 'usr_Corr', 'usrCorr', 'Correo', 'correo', 'Email', 'email'])
          : '';

        if (!correoDestino) {
          return of(null);
        }

        const correoPayload: EnviarCorreoPedidoRechazadoRequest = {
          Ped_Id: pedido.requisicion,
          CorreoDestino: correoDestino,
          UsuarioRegistro: this.getTextValue(usuario, ['Usr_Nom', 'usr_Nom', 'usrNom']) || usuarioRegistro,
          UsuarioAprobacion: this.authService.getCurrentUserName().trim() || this.authService.getCurrentUser().trim(),
          TipoServicio: pedido.tipo,
          MotivoRechazo: motivo
        };

        return this.apiService.postEnviarCorreoPedidoRechazado(correoPayload);
      })
    ).subscribe({
      error: (error: unknown) => {
        console.warn('No se pudo enviar el correo de pedido rechazado al usuario registrador:', error);
      }
    });
  }

  toggleDetallePedido(item: RequisitionRow): void {
    this.mostrarDetallePedido = true;
    this.mostrarEditorPedido = false;
    this.detallePedidoCabecera = item;
    this.expandedPedidoId = item.requisicion;
    this.currentDetalleExpandidoPage = 1;
    this.detalleExpandidoError = '';
    this.seleccionarPedido(item);
    this.resetDetallePedidoEditor();

    if (this.pedidoDetalles[item.requisicion] && this.pedidoCentrosCosto[item.requisicion]) {
      this.detallePedidoCantidadLimite = this.pedidoDetalleCantidadLimites[item.requisicion] ?? 0;
      this.isLoadingDetalleExpandido = false;
      return;
    }

    this.isLoadingDetalleExpandido = true;

    forkJoin({
      detalleResponse: this.apiService.getListarDetallePedido(item.requisicion),
      centroCostoResponse: this.apiService.getListarPedidoRegistradoCentroCosto(item.requisicion)
    }).subscribe({
      next: ({ detalleResponse, centroCostoResponse }) => {
        this.pedidoDetalles[item.requisicion] = this.extractRecords(detalleResponse)
          .map((detail, index) => this.mapPedidoDetalle(detail, index))
          .filter((detail): detail is PedidoDetalleRow => detail !== null);
        this.currentDetalleExpandidoPage = normalizePaginationPage(this.currentDetalleExpandidoPage, this.getDetallePedidoExpandido().length, this.pageSize);
        this.updatePedidoTotal(item.requisicion);
        this.pedidoCentrosCosto[item.requisicion] = this.mapCentroCostoRegistrados(centroCostoResponse);
        this.detallePedidoCantidadLimite = this.extractTotalCantidadPermitida(centroCostoResponse);
        this.pedidoDetalleCantidadLimites[item.requisicion] = this.detallePedidoCantidadLimite;
        this.isLoadingDetalleExpandido = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando detalle de pedido:', error);
        this.pedidoDetalles[item.requisicion] = [];
        this.pedidoCentrosCosto[item.requisicion] = [];
        this.currentDetalleExpandidoPage = 1;
        this.detallePedidoCantidadLimite = 0;
        this.pedidoDetalleCantidadLimites[item.requisicion] = 0;
        this.detalleExpandidoError = this.resolveErrorMessage(error, 'No se pudo cargar el detalle del pedido.');
        this.isLoadingDetalleExpandido = false;
      }
    });
  }

  isDetalleExpandido(item: RequisitionRow): boolean {
    return this.expandedPedidoId === item.requisicion;
  }

  getDetallePedidoExpandido(): PedidoDetalleRow[] {
    if (this.expandedPedidoId === null) {
      return [];
    }

    return (this.pedidoDetalles[this.expandedPedidoId] ?? []).map((detail) => this.enrichPedidoDetalle(detail));
  }

  getCentroCostoPedidoExpandido(): CentroCostoRow[] {
    if (this.expandedPedidoId === null) {
      return [];
    }

    return this.pedidoCentrosCosto[this.expandedPedidoId] ?? [];
  }

  onPedidosPageChange(page: number): void {
    this.currentPedidosPage = normalizePaginationPage(page, this.requisicionesFiltradasPorOrden.length, this.pageSize);
  }

  private tieneOrdenCompraServicio(item: RequisitionRow): boolean {
    const numeroOrden = String(item.ordenCompraServicio || '').trim().toLowerCase();
    return !!numeroOrden && numeroOrden !== '-' && numeroOrden !== '0';
  }

  onDetalleExpandidoPageChange(page: number): void {
    this.currentDetalleExpandidoPage = normalizePaginationPage(page, this.getDetallePedidoExpandido().length, this.pageSize);
  }

  onCentroCostoPageChange(page: number): void {
    this.currentCentroCostoPage = normalizePaginationPage(page, this.centrosCosto.length, this.pageSize);
  }

  seleccionarPedidoDetalle(item: PedidoDetalleRow): void {
    this.selectedPedidoDetalleId = item.id;
  }

  isPedidoDetalleSeleccionado(item: PedidoDetalleRow): boolean {
    return this.selectedPedidoDetalleId === item.id;
  }

  iniciarNuevoPedidoDetalle(): void {
    if (!this.canManagePedidoDetalle) {
      return;
    }

    if (!this.canOpenDetallePedidoDialog(false)) {
      return;
    }

    this.isEditingPedidoDetalle = false;
    this.selectedPedidoDetalleId = null;
    this.detallePedidoErrorMessage = '';
    this.detallePedidoForm.reset({
      codigoItem: '',
      unidad: '',
      centroCostoId: 0,
      centroCostoDescripcion: '',
      centroCostoCantidadRequerida: 0,
      cantidad: 0,
      precioUnitario: 0
    });
    this.openPedidoDetalleDialog({
      itemCode: '',
      itemDescription: '',
      unitCode: '',
      unitDescription: '',
      centroCostoId: 0,
      centroCostoDescripcion: '',
      centroCostoCantidadRequerida: 0,
      quantity: 0,
      unitPrice: 0
    });
  }

  modificarPedidoDetalleSeleccionado(): void {
    if (!this.canModifyPedidoDetalle) {
      return;
    }

    if (!this.canOpenDetallePedidoDialog(true)) {
      return;
    }

    const selectedDetail = this.getSelectedPedidoDetalleRow();

    if (!selectedDetail) {
      return;
    }

    if (selectedDetail.persistedId === null) {
      this.detallePedidoErrorMessage = 'Selecciona un detalle registrado para modificarlo.';
      return;
    }

    this.isSavingPedidoDetalle = true;
    this.detallePedidoErrorMessage = '';

    this.apiService.getListarDetallePedidoModificar(selectedDetail.persistedId).subscribe({
      next: (response: unknown) => {
        const detalle = this.extractRecords(response)[0];

        if (!detalle) {
          this.detallePedidoErrorMessage = 'No se encontro informacion del detalle seleccionado.';
          this.isSavingPedidoDetalle = false;
          return;
        }

        this.detallePedidoForm.patchValue({
          codigoItem: this.getTextValue(detalle, ['Ped_Cod_Itm', 'ped_Cod_Itm', 'pedCodItm']),
          unidad: this.getTextValue(detalle, ['Ped_Uni_Med', 'ped_Uni_Med', 'pedUniMed']),
          centroCostoId: this.getNumberValue(detalle, ['Ped_Cen_Cos_Asg', 'ped_Cen_Cos_Asg', 'pedCenCosAsg']) ?? 0,
          centroCostoDescripcion: this.getTextValue(detalle, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']),
          centroCostoCantidadRequerida: 0,
          cantidad: this.getDecimalValue(detalle, ['Ped_Can', 'ped_Can', 'pedCan']) ?? 0,
          precioUnitario: this.getDecimalValue(detalle, ['Ped_Cos_Uni', 'ped_Cos_Uni', 'pedCosUni']) ?? 0
        });
        this.isEditingPedidoDetalle = true;
        this.openPedidoDetalleDialog({
          itemCode: String(this.detallePedidoForm.controls['codigoItem'].value ?? '').trim(),
          itemDescription: this.getTextValue(detalle, ['Itm_Des', 'itm_Des', 'itmDes'])
            || this.resolveDetalleItemDescription(String(this.detallePedidoForm.controls['codigoItem'].value ?? '').trim()),
          unitCode: String(this.detallePedidoForm.controls['unidad'].value ?? '').trim(),
          unitDescription: this.getTextValue(detalle, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes'])
            || this.resolveDetalleUnidadDescription(String(this.detallePedidoForm.controls['unidad'].value ?? '').trim()),
          centroCostoId: Number(this.detallePedidoForm.controls['centroCostoId'].value ?? 0),
          centroCostoDescripcion: String(this.detallePedidoForm.controls['centroCostoDescripcion'].value ?? '').trim(),
          centroCostoCantidadRequerida: Number(this.detallePedidoForm.controls['centroCostoCantidadRequerida'].value ?? 0),
          quantity: Number(this.detallePedidoForm.controls['cantidad'].value ?? 0),
          unitPrice: Number(this.detallePedidoForm.controls['precioUnitario'].value ?? 0)
        }, selectedDetail.item);
        this.isSavingPedidoDetalle = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando detalle para modificar:', error);
        this.detallePedidoErrorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el detalle seleccionado.');
        this.isSavingPedidoDetalle = false;
      }
    });
  }

  guardarPedidoDetalle(): void {
    if (this.expandedPedidoId === null || this.isSavingPedidoDetalle) {
      return;
    }

    const payload = this.buildDetallePedidoPayload();

    if (!payload) {
      return;
    }

    this.isSavingPedidoDetalle = true;
    this.detallePedidoErrorMessage = '';
    const selectedDetail = this.getSelectedPedidoDetalleRow();

    this.validarCantidadTotalDetalle(this.expandedPedidoId, payload.Ped_Can).pipe(
      switchMap(() => this.isEditingPedidoDetalle && selectedDetail?.persistedId !== null
        ? this.apiService.patchActualizarDetallePedido({
            Ped_Det_Id: selectedDetail!.persistedId!,
            Ped_Cod_Itm: payload.Ped_Cod_Itm,
            Ped_Uni_Med: payload.Ped_Uni_Med,
            Ped_Cen_Cos_Asg: payload.Ped_Cen_Cos_Asg,
            Ped_Can: payload.Ped_Can,
            Ped_Cos_Uni: payload.Ped_Cos_Uni,
            Ped_Cos_Tot: payload.Ped_Cos_Tot,
            Usr_Mod: this.authService.getCurrentUser().trim()
          } as ActualizarDetallePedidoRequest)
        : this.apiService.postRegistrarDetallePedido(payload)
      ),
      switchMap((response: unknown) => {
        this.assertSuccessfulResponse(response, this.isEditingPedidoDetalle
          ? 'No se pudo actualizar el detalle del pedido.'
          : 'No se pudo registrar el detalle del pedido.');
        return this.reloadDetallePedidoExpandido(this.expandedPedidoId!);
      })
    ).subscribe({
      next: () => {
        this.isSavingPedidoDetalle = false;
        this.resetDetallePedidoEditor();
      },
      error: (error: unknown) => {
        console.error('Error guardando detalle de pedido:', error);
        this.detallePedidoErrorMessage = this.resolveErrorMessage(error, 'No se pudo guardar el detalle del pedido.');
        this.isSavingPedidoDetalle = false;
      }
    });
  }

  eliminarPedidoDetalleSeleccionado(): void {
    if (!this.canModifyPedidoDetalle) {
      return;
    }

    const selectedDetail = this.getSelectedPedidoDetalleRow();

    if (!selectedDetail || selectedDetail.persistedId === null) {
      this.detallePedidoErrorMessage = 'Selecciona un detalle registrado para eliminarlo.';
      return;
    }

    this.isSavingPedidoDetalle = true;
    this.detallePedidoErrorMessage = '';

    this.apiService.deleteEliminarDetallePedido({
      Ped_Det_Id: selectedDetail.persistedId
    } as EliminarDetallePedidoRequest).pipe(
      switchMap((response: unknown) => {
        this.assertSuccessfulResponse(response, 'No se pudo eliminar el detalle del pedido.');
        return this.reloadDetallePedidoExpandido(this.expandedPedidoId!);
      })
    ).subscribe({
      next: () => {
        this.isSavingPedidoDetalle = false;
        this.resetDetallePedidoEditor();
      },
      error: (error: unknown) => {
        console.error('Error eliminando detalle de pedido:', error);
        this.detallePedidoErrorMessage = this.resolveErrorMessage(error, 'No se pudo eliminar el detalle del pedido.');
        this.isSavingPedidoDetalle = false;
      }
    });
  }

  cancelarEdicionPedidoDetalle(): void {
    this.resetDetallePedidoEditor();
  }

  editarPedidoDetalle(detail: PedidoDetalleRow): void {
    this.selectedPedidoDetalleId = detail.id;
    this.modificarPedidoDetalleSeleccionado();
  }

  confirmarEliminarPedidoDetalle(detail: PedidoDetalleRow): void {
    if (detail.persistedId === null || this.isSavingPedidoDetalle) {
      return;
    }

    const dialogRef = this.dialog.open(PedidoDetalleDeleteDialogComponent, {
      width: 'min(30rem, 92vw)',
      disableClose: true,
      data: {
        codigoItem: detail.codigoItem,
        descripcion: detail.descripcion
      }
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (!confirmed) {
        return;
      }

      this.selectedPedidoDetalleId = detail.id;
      this.eliminarPedidoDetalleSeleccionado();
    });
  }

  modificarPedidoSeleccionado(): void {
    if (this.selectedPedidoId === null || this.isLoadingPedidoDetalle) {
      return;
    }

    this.cerrarDetallePedido();
    this.resetPedidoEditor();
    this.mostrarEditorPedido = true;
    this.isEditingPedido = true;
    this.isLoadingPedidoDetalle = true;
    this.saveErrorMessage = '';

    console.log('[Pedidos][Archivos adjuntos][Ped_Cab_Id enviado]', this.selectedPedidoId);

    forkJoin({
      pedidoResponse: this.apiService.getListarPedidoModificar(this.selectedPedidoId),
      centroCostoResponse: this.apiService.getListarPedidoRegistradoCentroCosto(this.selectedPedidoId),
      archivosResponse: this.apiService.getListarArchivosAdjuntos(this.selectedPedidoId)
    }).subscribe({
      next: ({ pedidoResponse, centroCostoResponse, archivosResponse }) => {
        const pedido = this.extractRecords(pedidoResponse)[0];

        if (!pedido) {
          this.saveErrorMessage = 'No se encontro informacion del pedido seleccionado.';
          this.isLoadingPedidoDetalle = false;
          return;
        }

        this.populatePedidoEditor(pedido);
        this.populateCentroCostoEditor(centroCostoResponse);
        this.populateArchivosAdjuntosEditor(archivosResponse);
        this.isLoadingPedidoDetalle = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando pedido para modificar:', error);
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo cargar la informacion del pedido seleccionado.');
        this.isLoadingPedidoDetalle = false;
      }
    });
  }

  private actualizarEstadoPedidoSeleccionado(flgEst: 'A' | 'C', fallbackMessage: string): void {
    if (this.selectedPedidoId === null || this.isLoadingPedidoDetalle || this.isUpdatingPedidoEstado) {
      return;
    }

    const selectedPedido = this.getSelectedPedidoRow();

    if (flgEst === 'A' && !this.isSelectedPedidoAssignedToCurrentUser()) {
      this.errorMessage = 'Solo el usuario de aprobacion asignado puede aprobar este pedido.';
      return;
    }

    this.isUpdatingPedidoEstado = true;
    this.errorMessage = '';

    this.apiService.patchActualizarPedidoEstado({
      Ped_Id: this.selectedPedidoId,
      Flg_Est: flgEst
    } as ActualizarPedidoEstadoRequest).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, fallbackMessage);
          if (flgEst === 'A' && selectedPedido) {
            this.enviarCorreoPedidoAprobadoARegistrador(selectedPedido);
          }
          this.isUpdatingPedidoEstado = false;
          this.cargarPedidos();
          window.dispatchEvent(new CustomEvent('pedido-notifications-refresh'));
        } catch (error) {
          this.errorMessage = this.resolveErrorMessage(error, fallbackMessage);
          this.isUpdatingPedidoEstado = false;
        }
      },
      error: (error: unknown) => {
        console.error('Error actualizando estado del pedido:', error);
        this.errorMessage = this.resolveErrorMessage(error, fallbackMessage);
        this.isUpdatingPedidoEstado = false;
      }
    });
  }

  private enviarCorreoPedidoAprobadoARegistrador(pedido: RequisitionRow): void {
    const usuarioRegistro = String(pedido.codigoUsr || '').trim();

    if (!usuarioRegistro || usuarioRegistro === '-') {
      return;
    }

    this.apiService.getListarUsuarioActivo({ Usr_Cod: usuarioRegistro }).pipe(
      switchMap((response: unknown) => {
        const usuario = this.extractRecords(response)[0];
        const correoDestino = usuario
          ? this.getTextValue(usuario, ['Usr_Corr', 'usr_Corr', 'usrCorr', 'Correo', 'correo', 'Email', 'email'])
          : '';

        if (!correoDestino) {
          return of(null);
        }

        const correoPayload: EnviarCorreoPedidoAprobadoRequest = {
          Ped_Id: pedido.requisicion,
          CorreoDestino: correoDestino,
          UsuarioRegistro: this.getTextValue(usuario, ['Usr_Nom', 'usr_Nom', 'usrNom']) || usuarioRegistro,
          UsuarioAprobacion: this.authService.getCurrentUserName().trim() || this.authService.getCurrentUser().trim(),
          TipoServicio: pedido.tipo
        };

        return this.apiService.postEnviarCorreoPedidoAprobado(correoPayload);
      })
    ).subscribe({
      error: (error: unknown) => {
        console.warn('No se pudo enviar el correo de pedido aprobado al usuario registrador:', error);
      }
    });
  }

  openApprovalUserDialog(): void {
    if (this.isLoadingApprovalUsers) {
      return;
    }

    this.cargarUsuariosAprobacion(true);
  }

  private abrirApprovalUserDialog(): void {
    if (!this.approvalUsers.length) {
      return;
    }

    const dialogRef = this.dialog.open(ApprovalUserSelectorDialogComponent, {
      autoFocus: false,
      width: '36rem',
      data: {
        users: this.approvalUsers
      }
    });

    dialogRef.afterClosed().subscribe((selectedUser?: ApprovalUserOption) => {
      if (selectedUser) {
        this.cabeceraForm.patchValue({
          usuarioAprobacionId: selectedUser.id,
          usuarioAprobacion: selectedUser.code
        });
      }
    });
  }

  openCentroCostoDialog(): void {
    if (!this.centroCostoOptions.length) {
      return;
    }

    const dialogRef = this.dialog.open(CentroCostoSelectorDialogComponent, {
      autoFocus: false,
      width: '38rem',
      data: {
        centrosCosto: this.centroCostoOptions
      }
    });

    dialogRef.afterClosed().subscribe((selectedCentroCosto?: CentroCostoOption) => {
      if (selectedCentroCosto) {
        this.applySelectedCentroCosto(selectedCentroCosto);
      }
    });
  }

  confirmarCancelacionPedido(): void {
    const dialogRef = this.dialog.open(PedidoCancelDialogComponent, {
      width: 'min(30rem, 92vw)',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (confirmed) {
        this.cerrarEditorPedido();
      }
    });
  }

  cerrarEditorPedido(): void {
    this.resetPedidoEditor();
    this.mostrarEditorPedido = false;
    this.editandoCentroCostoId = null;
    this.isEditingPedido = false;
    this.isLoadingPedidoDetalle = false;
  }

  cerrarDetallePedido(): void {
    this.mostrarDetallePedido = false;
    this.expandedPedidoId = null;
    this.detallePedidoCabecera = null;
    this.detallePedidoCantidadLimite = 0;
    this.isLoadingDetalleExpandido = false;
    this.detalleExpandidoError = '';
    this.resetDetallePedidoEditor();
  }

  // guardarPedido(): void {
  //   if (this.isSavingPedido) {
  //     return;
  //   }



  //   if (this.editandoCentroCostoId !== null && !this.guardarCantidadCentroCosto(this.editandoCentroCostoId)) {
  //     return;
  //   }

  //   if (this.isEditingPedido) {
  //     const payload = this.buildActualizarPedidoPayload();

  //     if (!payload) {
  //       return;
  //     }

  //     this.isSavingPedido = true;
  //     this.saveErrorMessage = '';
  //     console.debug('Ped_Can_Tot actualizar:', payload.Ped_Can_Tot);

  //     this.apiService.patchActualizarPedido(payload).pipe(
  //       switchMap((response: unknown) => {
  //         this.assertSuccessfulResponse(response, 'No se pudo actualizar el pedido.');
  //         return this.sincronizarCentrosCostoPedido(payload.Ped_Id);
  //       })
  //     ).subscribe({
  //       next: () => {
  //         this.isSavingPedido = false;
  //         this.cerrarEditorPedido();
  //         this.cargarPedidos();
  //       },
  //       error: (error: unknown) => {
  //         console.error('Error guardando pedido:', error);
  //         this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el pedido. Intenta nuevamente.');
  //         this.isSavingPedido = false;
  //       }
  //     });

  //     return;
  //   }

  //   const payload = this.buildRegistrarPedidoPayload();
  //   const file = this.selectedFile;

  //   if (!payload) {
  //     return;
  //   }

  //   this.isSavingPedido = true;
  //   this.saveErrorMessage = '';
  //   console.debug('Ped_Can_Tot registrar:', payload.Ped_Can_Tot);

  //   this.apiService.postRegistrarPedido(payload).pipe(
  //     switchMap((response: unknown) => {
  //       this.assertSuccessfulResponse(response, 'No se pudo registrar el pedido.');
  //       return this.apiService.patchActualizarPedidoEstado({
  //         Ped_Id: payload.Ped_Id,
  //         Flg_Est: 'P'
  //       } as ActualizarPedidoEstadoRequest);
  //     }),
  //     switchMap((response: unknown) => {
  //       this.assertSuccessfulResponse(response, 'No se pudo establecer el pedido como pendiente.');
  //       return this.registrarCentrosCostoPedido(payload.Ped_Id);
  //     })
  //   ).subscribe({
  //     next: () => {
  //       this.isSavingPedido = false;
  //       this.cerrarEditorPedido();
  //       this.cargarPedidos();
  //     },
  //     error: (error: unknown) => {
  //       console.error('Error guardando pedido:', error);
  //       this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo registrar el pedido. Intenta nuevamente.');
  //       this.isSavingPedido = false;
  //     }
  //   });
  // }

  guardarPedido(): void {
    if (this.isSavingPedido) return;

    if (this.editandoCentroCostoId !== null && !this.guardarCantidadCentroCosto(this.editandoCentroCostoId)) {
      return;
    }

    // Caso: actualizar pedido (sin archivo)
    if (this.isEditingPedido) {
      const payload = this.buildActualizarPedidoPayload();
      if (!payload) return;

      this.isSavingPedido = true;
      this.saveErrorMessage = '';
      console.debug('Ped_Can_Tot actualizar:', payload.Ped_Can_Tot);

      this.apiService.patchActualizarPedido(payload, this.archivoFile).pipe(
        switchMap((response: unknown) => {
          this.assertSuccessfulResponse(response, 'No se pudo actualizar el pedido.');
          return this.sincronizarCentrosCostoPedido(payload.Ped_Id);
        })
      ).subscribe({
        next: () => {
          this.isSavingPedido = false;
          this.cerrarEditorPedido();
          this.cargarPedidos();
        },
        error: (error: unknown) => {
          console.error('Error guardando pedido:', error);
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el pedido. Intenta nuevamente.');
          this.isSavingPedido = false;
        }
      });

      return;
    }

    // Caso: registrar pedido (con archivo)
    const payload = this.buildRegistrarPedidoPayload();
    if (!payload) return;

    this.isSavingPedido = true;
    this.saveErrorMessage = '';
    console.debug('Ped_Can_Tot registrar:', payload.Ped_Can_Tot);

    const formData = new FormData();
    Object.keys(payload).forEach(key => {
      const value = (payload as any)[key];
      if (value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    if (this.archivoFile) {
      formData.append('archivo', this.archivoFile, this.archivoFile.name);
    } else {
      formData.append('archivo', new File([], 'sin-archivo-adjunto.txt'), 'sin-archivo-adjunto.txt');
    }

    this.apiService.postRegistrarPedido(formData).pipe(
      switchMap((response: unknown) => {
        this.assertSuccessfulResponse(response, 'No se pudo registrar el pedido.');
        return this.apiService.patchActualizarPedidoEstado({
          Ped_Id: payload.Ped_Id,
          Flg_Est: 'P'
        } as ActualizarPedidoEstadoRequest);
      }),
      switchMap(() => this.registrarCentrosCostoPedido(payload.Ped_Id))
    ).subscribe({
      next: () => {
        this.isSavingPedido = false;
        this.cerrarEditorPedido();
        this.cargarPedidos();
      },
      error: (error: unknown) => {
        console.error('Error guardando pedido:', error);
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo registrar el pedido. Intenta nuevamente.');
        this.isSavingPedido = false;
      }
    });
  }


  agregarCentroCosto(centroCosto: CentroCostoOption): void {
    const yaExiste = this.centrosCosto.some((item) => item.codigo === centroCosto.id);

    if (yaExiste) {
      this.centroCostoForm.patchValue({
        centroCostoId: 0,
        centroCosto: ''
      });
      return;
    }

    this.centrosCosto = [
      {
        id: this.nextCentroCostoId++,
        codigo: centroCosto.id,
        costo: centroCosto.descripcion,
        cantidad: 0,
        persistedId: null
      },
      ...this.centrosCosto
    ];
    this.currentCentroCostoPage = 1;
    this.centroCostoForm.patchValue({
      centroCostoId: 0,
      centroCosto: ''
    });
  }

  editarCentroCosto(item: CentroCostoRow): void {
    this.editandoCentroCostoId = item.id;
    this.editandoCentroCostoCantidad = item.cantidad;
  }

  onCantidadCentroCostoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cantidad = Number(input.value);

    this.editandoCentroCostoCantidad = this.normalizeCantidadCentroCosto(cantidad);
  }

  guardarCantidadCentroCosto(id: number): boolean {
    const cantidadNormalizada = this.normalizeCantidadCentroCosto(this.editandoCentroCostoCantidad);

    if (cantidadNormalizada <= 0) {
      this.saveErrorMessage = 'La cantidad del centro de costo debe ser mayor a cero.';
      return false;
    }

    this.centrosCosto = this.centrosCosto.map((item) =>
      item.id === id
        ? {
            ...item,
            cantidad: cantidadNormalizada
          }
        : item
    );
    this.currentCentroCostoPage = normalizePaginationPage(this.currentCentroCostoPage, this.centrosCosto.length, this.pageSize);

    this.saveErrorMessage = '';
    this.cancelarEdicionCentroCosto();
    return true;
  }

  eliminarCentroCosto(id: number): void {
    const persistedId = this.centrosCosto.find((item) => item.id === id)?.persistedId;
    this.centrosCosto = this.centrosCosto.filter((item) => item.id !== id);
    this.currentCentroCostoPage = normalizePaginationPage(this.currentCentroCostoPage, this.centrosCosto.length, this.pageSize);

    if (persistedId) {
      this.deletedCentroCostoIds = [...this.deletedCentroCostoIds, persistedId];
    }

    if (this.editandoCentroCostoId === id) {
      this.cancelarEdicionCentroCosto();
    }
  }

  cancelarEdicionCentroCosto(): void {
    this.editandoCentroCostoId = null;
    this.editandoCentroCostoCantidad = 0;
  }

  // adjuntarArchivo(): void {
  //   this.archivoAdjunto = 'sustento-pedido.pdf';
  //   this.detalleForm.patchValue({
  //     archivo: this.archivoAdjunto
  //   });
  // }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const archivosSeleccionados = Array.from(input.files);
      const nombresGuardados = new Set(this.archivosAdjuntosGuardados.map((archivo) => archivo.nombre.toLowerCase()));
      this.archivoFiles = [
        ...this.archivoFiles,
        ...archivosSeleccionados.filter((archivo) =>
          !nombresGuardados.has(archivo.name.toLowerCase()) &&
          !this.archivoFiles.some((existente) =>
            existente.name === archivo.name &&
            existente.size === archivo.size &&
            existente.lastModified === archivo.lastModified
          )
        )
      ];
      this.actualizarArchivoAdjuntoFormControl();
      input.value = '';
    }
  }

  quitarArchivo(index?: number): void {
    if (typeof index === 'number' && this.archivoFiles.length) {
      this.archivoFiles.splice(index, 1);
      this.actualizarArchivoAdjuntoFormControl();
      return;
    }

    this.archivoFile = null;
    this.archivoFiles = [];
    this.actualizarArchivoAdjuntoFormControl();
  }

  // verArchivo(): void {
  //   //this.archivoAdjunto = this.detalleForm.controls['archivo'].value || 'Sin archivo adjunto';
  //   if (this.archivoFile) {
  //     const url = URL.createObjectURL(this.archivoFile);
  //     window.open(url, '_blank');
  //   }
  // }

  verArchivo(index?: number): void {
    if (typeof index === 'number' && this.archivoFiles[index]) {
      this.openArchivoLocalEnChrome(this.archivoFiles[index]);
    } else if (this.detalleForm.value.archivo) {
      const nombreArchivo = this.detalleForm.value.archivo;

      this.abrirArchivoPedidoPorNombre(nombreArchivo);
    }
  }

  verArchivoAdjunto(archivo: { nombre: string; local: boolean; index: number }): void {
    if (archivo.local) {
      this.verArchivo(archivo.index);
      return;
    }

    this.abrirArchivoPedidoPorNombre(archivo.nombre);
  }

  private abrirArchivoPedidoPorNombre(nombreArchivo: string): void {
    if (!nombreArchivo || nombreArchivo === 'Sin archivo adjunto') {
      return;
    }

    this.apiService.getArchivoPedido(nombreArchivo).subscribe({
      next: (arrayBuffer: ArrayBuffer) => {
        this.openArrayBufferArchivoEnChrome(nombreArchivo, arrayBuffer);
      },
      error: () => {
        this.saveErrorMessage = 'No se pudo abrir el archivo.';
      }
    });
  }

  private openArchivoLocalEnChrome(archivo: File): void {
    if (this.isTextPreviewFile(archivo.name, archivo.type)) {
      const reader = new FileReader();
      reader.onload = () => this.openTextoEnChrome(archivo.name, String(reader.result || ''));
      reader.onerror = () => {
        this.saveErrorMessage = 'No se pudo abrir el archivo.';
      };
      reader.readAsText(archivo);
      return;
    }

    if (this.isOfficePreviewFile(archivo.name)) {
      this.openArchivoOfficeEnChrome(archivo.name, URL.createObjectURL(archivo), archivo.type || this.getMimeTypeFromFileName(archivo.name));
      return;
    }

    this.openArchivoEnChrome(archivo.name, URL.createObjectURL(archivo), archivo.type);
  }

  private openArrayBufferArchivoEnChrome(nombreArchivo: string, arrayBuffer: ArrayBuffer): void {
    const mimeType = this.getMimeTypeFromFileName(nombreArchivo);

    if (this.isTextPreviewFile(nombreArchivo, mimeType)) {
      const contenido = new TextDecoder('utf-8').decode(arrayBuffer);
      this.openTextoEnChrome(nombreArchivo, contenido);
      return;
    }

    if (this.isOfficePreviewFile(nombreArchivo)) {
      const blob = new Blob([arrayBuffer], { type: mimeType });
      this.openArchivoOfficeEnChrome(nombreArchivo, URL.createObjectURL(blob), mimeType);
      return;
    }

    const blob = new Blob([arrayBuffer], { type: mimeType });
    this.openArchivoEnChrome(nombreArchivo, URL.createObjectURL(blob), mimeType);
  }

  private isTextPreviewFile(nombreArchivo: string, mimeType?: string): boolean {
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || '';
    return ['txt', 'sql', 'csv', 'log', 'xml'].includes(extension) ||
      Boolean(mimeType?.startsWith('text/') || mimeType === 'application/xml' || mimeType === 'text/xml');
  }

  private isOfficePreviewFile(nombreArchivo: string): boolean {
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || '';
    return ['doc', 'docx', 'xls', 'xlsx'].includes(extension);
  }

  private openArchivoOfficeEnChrome(nombreArchivo: string, url: string, mimeType: string): void {
    const ventana = window.open('', '_blank');
    if (!ventana) {
      window.open(url, '_blank');
      return;
    }

    const nombreSeguro = this.escapeHtml(nombreArchivo);
    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${nombreSeguro}</title>
          <style>
            html, body { margin: 0; width: 100%; height: 100%; background: #f5f5f5; font-family: Arial, sans-serif; }
            header { padding: 14px 18px; background: #3f3d39; color: #fff; font-weight: 700; }
            .viewer { width: 100%; height: calc(100% - 52px); border: 0; display: block; }
            .fallback { padding: 24px; color: #555; }
            .fallback a { color: #ff8f22; font-weight: 700; }
          </style>
        </head>
        <body>
          <header>${nombreSeguro}</header>
          <object class="viewer" data="${url}" type="${mimeType}">
            <div class="fallback">
              Chrome no puede previsualizar este tipo de archivo directamente.
              <a href="${url}" target="_blank" rel="noopener">Abrir archivo</a>
            </div>
          </object>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  private openArchivoEnChrome(nombreArchivo: string, url: string, mimeType?: string): void {
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || '';
    const puedePrevisualizar = ['pdf', 'png', 'jpg', 'jpeg', 'gif'].includes(extension) ||
      Boolean(mimeType?.startsWith('image/') || mimeType === 'application/pdf');

    if (!puedePrevisualizar) {
      window.open(url, '_blank');
      return;
    }

    const ventana = window.open('', '_blank');
    if (!ventana) {
      window.open(url, '_blank');
      return;
    }

    const nombreSeguro = this.escapeHtml(nombreArchivo);
    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${nombreSeguro}</title>
          <style>
            html, body { margin: 0; width: 100%; height: 100%; background: #f5f5f5; }
            .viewer { width: 100%; height: 100%; border: 0; display: block; }
          </style>
        </head>
        <body>
          <iframe class="viewer" src="${url}" title="${nombreSeguro}"></iframe>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  private openTextoEnChrome(nombreArchivo: string, contenido: string): void {
    const ventana = window.open('', '_blank');
    if (!ventana) {
      const blob = new Blob([contenido], { type: 'text/plain' });
      window.open(URL.createObjectURL(blob), '_blank');
      return;
    }

    const nombreSeguro = this.escapeHtml(nombreArchivo);
    const contenidoSeguro = this.escapeHtml(contenido);
    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${nombreSeguro}</title>
          <style>
            body { margin: 0; background: #f7f7f7; color: #2f2f2f; font-family: Consolas, Monaco, monospace; }
            header { padding: 14px 18px; background: #3f3d39; color: #fff; font: 600 14px Arial, sans-serif; }
            pre { margin: 0; padding: 18px; white-space: pre-wrap; word-break: break-word; font-size: 13px; line-height: 1.45; }
          </style>
        </head>
        <body>
          <header>${nombreSeguro}</header>
          <pre>${contenidoSeguro}</pre>
        </body>
      </html>
    `);
    ventana.document.close();
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  get archivosAdjuntosVista(): Array<{ nombre: string; size?: number; local: boolean; index: number }> {
    const archivosGuardados = this.archivosAdjuntosGuardados.map((archivo, index) => ({
      nombre: archivo.nombre,
      local: false,
      index
    }));

    const archivosLocales = this.archivoFiles.map((archivo, index) => ({
      nombre: archivo.name,
      size: archivo.size,
      local: true,
      index
    }));

    if (archivosGuardados.length || archivosLocales.length) {
      return [...archivosGuardados, ...archivosLocales];
    }

    const nombreArchivo = String(this.detalleForm?.value?.archivo || this.archivoAdjunto || '').trim();
    if (!nombreArchivo || nombreArchivo === 'Sin archivo adjunto') {
      return [];
    }

    return [{
      nombre: nombreArchivo,
      local: false,
      index: 0
    }];
  }

  formatFileSize(size?: number): string {
    if (!size) {
      return '-';
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected getAttachmentDisplayName(): string {
    const nombresArchivos = [
      ...this.archivosAdjuntosGuardados.map((archivo) => archivo.nombre),
      ...this.archivoFiles.map((archivo) => archivo.name)
    ].filter((nombre) => !!nombre);

    if (!nombresArchivos.length) {
      return 'Sin archivo adjunto';
    }

    if (nombresArchivos.length === 1) {
      return nombresArchivos[0];
    }

    return nombresArchivos.join(', ');
  }

  private actualizarArchivoAdjuntoFormControl(): void {
    this.archivoFile = this.archivoFiles[0] ?? null;
    this.archivoAdjunto = this.getAttachmentDisplayName();
    this.detalleForm.patchValue({
      archivo: this.archivoAdjunto
    });
  }

  verArchivoPedidoListado(item: RequisitionRow, event?: Event): void {
    event?.stopPropagation();
    this.saveErrorMessage = '';
    const nombreArchivo = item.archivoNombre.trim();

    if (!nombreArchivo) {
      this.saveErrorMessage = 'El pedido seleccionado no tiene archivo adjunto.';
      return;
    }

    this.apiService.getArchivoPedido(nombreArchivo).subscribe({
      next: (arrayBuffer: ArrayBuffer) => {
        this.openArrayBufferArchivoEnChrome(nombreArchivo, arrayBuffer);
      },
      error: () => {
        this.saveErrorMessage = 'No se pudo abrir el archivo del pedido.';
      }
    });
  }

  abrirArchivosPedidoListado(item: RequisitionRow, event?: Event): void {
    event?.stopPropagation();
    this.saveErrorMessage = '';
    this.isLoadingArchivosAdjuntosListado = item.requisicion;
    console.log('[Pedidos][Archivos adjuntos listado][Ped_Cab_Id enviado]', item.requisicion);

    this.apiService.getListarArchivosAdjuntos(item.requisicion).subscribe({
      next: (response) => {
        console.log('[Pedidos][Archivos adjuntos listado][Respuesta backend]', response);
        const archivos = this.extractRecords(response)
          .map((record) => this.mapPedidoArchivoAdjunto(record))
          .filter((archivo): archivo is PedidoArchivoAdjuntoRow => archivo !== null);
        console.log('[Pedidos][Archivos adjuntos listado][Mapeados popup]', archivos);
        this.isLoadingArchivosAdjuntosListado = null;

        this.dialog.open(PedidoArchivosDialogComponent, {
          width: 'min(720px, 96vw)',
          maxWidth: '96vw',
          data: {
            pedidoCodigo: item.codigo,
            archivos,
            verArchivo: (archivo: PedidoArchivoDialogRow) => {
              this.abrirArchivoPedidoPorNombre(archivo.nombre);
            }
          }
        });
      },
      error: (error: unknown) => {
        console.error('[Pedidos][Archivos adjuntos listado][Error]', error);
        this.isLoadingArchivosAdjuntosListado = null;
        this.saveErrorMessage = 'No se pudieron cargar los archivos adjuntos del pedido.';
      }
    });
  }





  trackByRequisicion(_index: number, item: RequisitionRow): number {
    return item.requisicion;
  }

  trackByCentroCosto(_index: number, item: CentroCostoRow): number {
    return item.id;
  }

  trackByPedidoDetalle(_index: number, item: PedidoDetalleRow): number {
    return item.id;
  }

  private cargarPedidos(): void {
    this.isLoadingPedidos = true;
    this.errorMessage = '';
    this.requisiciones = [];
    this.currentPedidosPage = 1;

    this.buildPedidosRequest(this.getFiltros()).subscribe({
      next: (response: unknown) => {
        this.requisiciones = this.extractRecords(response)
          .map((item) => this.mapPedido(item))
          .filter((item) => item.requisicion > 0)
          .sort((left, right) => right.requisicion - left.requisicion);
        this.currentPedidosPage = normalizePaginationPage(this.currentPedidosPage, this.requisiciones.length, this.pageSize);
        this.selectedPedidoId = this.requisiciones.some((item) => item.requisicion === this.selectedPedidoId)
          ? this.selectedPedidoId
          : null;
        this.expandedPedidoId = this.requisiciones.some((item) => item.requisicion === this.expandedPedidoId)
          ? this.expandedPedidoId
          : null;
        this.isLoadingPedidos = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando pedidos:', error);
        this.requisiciones = [];
        this.currentPedidosPage = 1;
        this.errorMessage = 'No se pudo cargar la informacion de pedidos. Intenta nuevamente.';
        this.isLoadingPedidos = false;
      }
    });
  }

  private buildPedidosRequest(filtros: PedidosFiltro): Observable<unknown> {
    return this.apiService.getListarPedido(filtros);
  }

  private cargarUsuariosAprobacion(openDialogAfterLoad = false): void {
    this.isLoadingApprovalUsers = true;

    this.apiService.getObtenerUsuariosAprobacion('S').subscribe({
      next: (response: unknown) => {
        this.approvalUsers = this.extractRecords(response)
          .map((item) => this.mapApprovalUser(item))
          .filter((user) => user.id > 0 && !!user.code);
        this.isLoadingApprovalUsers = false;

        if (openDialogAfterLoad) {
          this.abrirApprovalUserDialog();
        }
      },
      error: (error: unknown) => {
        console.error('Error cargando usuarios de aprobacion:', error);
        this.approvalUsers = [];
        this.isLoadingApprovalUsers = false;
      }
    });
  }

  private cargarCentrosCosto(): void {
    this.isLoadingCentrosCosto = true;

    this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.centroCostoOptions = this.extractRecords(response)
          .map((item) => this.mapCentroCostoOption(item))
          .filter((item) => item.id > 0 && !!item.descripcion);
        this.isLoadingCentrosCosto = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando centros de costo:', error);
        this.centroCostoOptions = [];
        this.isLoadingCentrosCosto = false;
      }
    });
  }

  private cargarCatalogosDetallePedido(): void {
    forkJoin({
      itemsResponse: this.apiService.getListarItem({ Flg_Est: 'A' }),
      unitsResponse: this.apiService.getListarUnidadMedida({ Flg_Est: 'A' }),
      serviceTypesResponse: this.apiService.getListarTipoServicioActivo({ Flg_Est: 'A' }),
      currenciesResponse: this.apiService.getListarMoneda({ Flg_Est: 'A' })
    }).subscribe({
      next: ({ itemsResponse, unitsResponse, serviceTypesResponse, currenciesResponse }) => {
        this.detalleItemOptions = this.extractRecords(itemsResponse)
          .map((item) => this.mapDetalleItemOption(item))
          .filter((item): item is PedidoDetalleItemOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description));
        this.detalleUnidadOptions = this.extractRecords(unitsResponse)
          .map((item) => this.mapDetalleUnidadOption(item))
          .filter((item): item is PedidoDetalleUnidadOption => item !== null)
          .sort((left, right) => left.description.localeCompare(right.description));
        this.tipoServicioOptions = this.extractRecords(serviceTypesResponse)
          .map((item) => this.mapTipoServicioOption(item))
          .filter((item): item is CatalogoTextoOption => item !== null)
          .sort((left, right) => left.descripcion.localeCompare(right.descripcion));
        this.tipoMoneda = this.extractRecords(currenciesResponse)
          .map((item) => this.mapMonedaOption(item))
          .filter((item): item is CatalogoNumeroOption => item !== null)
          .sort((left, right) => left.descripcion.localeCompare(right.descripcion));
        this.tipoOptions = [
          { codigo: '', descripcion: 'Todos' },
          ...this.tipoServicioOptions
        ];
        this.applyDefaultPedidoSelectValues();
      },
      error: (error: unknown) => {
        console.error('Error cargando catalogos de detalle de pedido:', error);
        this.detalleItemOptions = [];
        this.detalleUnidadOptions = [];
        this.tipoServicioOptions = [];
        this.tipoMoneda = [];
        this.tipoOptions = [{ codigo: '', descripcion: 'Todos' }];
      }
    });
  }


  private canOpenDetallePedidoDialog(isEditing = false): boolean {
    if (!isEditing && this.expandedPedidoId !== null) {
      const totalActual = this.getTotalActualDetalleSinSeleccionado(this.expandedPedidoId);
      const totalPermitido = this.normalizeCantidadCentroCosto(this.detallePedidoCantidadLimite);

      if (totalPermitido > 0 && totalActual >= totalPermitido) {
        this.detallePedidoErrorMessage = `Ya se alcanzo el maximo de la cantidad permitida (${this.formatDetalleNumero(totalPermitido)}). No se pueden registrar mas items.`;
        return false;
      }
    }

    return true;
  }

  private openPedidoDetalleDialog(initialValue: PedidoDetalleDialogValue, itemNumber?: string): void {
    if (this.expandedPedidoId === null || !this.detallePedidoCabecera) {
      return;
    }

    const dialogData: PedidoDetalleDialogData = {
      pedidoCodigo: this.detallePedidoCabecera.codigo,
      itemNumber: itemNumber || String(this.getDetallePedidoExpandido().length + 1),
      moneda: this.detallePedidoCabecera.moneda,
      cantidadDisponible: this.detallePedidoCantidadDisponible,
      isEditing: this.isEditingPedidoDetalle,
      centrosCosto: this.getDetalleCentroCostoOptions(),
      items: this.detalleItemOptions,
      units: this.detalleUnidadOptions,
      initialValue
    };

    const dialogRef = this.dialog.open(PedidoDetalleDialogComponent, {
      width: 'min(44rem, 94vw)',
      disableClose: true,
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop',
      autoFocus: false,
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result?: PedidoDetalleDialogValue) => {
      if (!result) {
        this.resetDetallePedidoEditor();
        return;
      }

      this.detallePedidoForm.patchValue({
        codigoItem: result.itemCode,
        unidad: result.unitCode,
        centroCostoId: result.centroCostoId,
        centroCostoDescripcion: result.centroCostoDescripcion,
        centroCostoCantidadRequerida: result.centroCostoCantidadRequerida,
        cantidad: result.quantity,
        precioUnitario: result.unitPrice
      });
      this.guardarPedidoDetalle();
    });
  }

  private applySelectedCentroCosto(centroCosto: CentroCostoOption): void {
    this.centroCostoForm.patchValue({
      centroCostoId: centroCosto.id,
      centroCosto: centroCosto.descripcion
    });
    this.agregarCentroCosto(centroCosto);
  }

  private getDetalleCentroCostoOptions(): CentroCostoOption[] {
    return this.getCentroCostoPedidoExpandido().map((centroCosto) => {
      const cantidadUsada = this.getCantidadDetallePorCentroCosto(centroCosto.codigo);
      const cantidadRestante = this.normalizeCantidadCentroCosto(Math.max(0, centroCosto.cantidad - cantidadUsada));

      return {
        id: centroCosto.codigo,
        descripcion: centroCosto.costo,
        cantidadRequerida: cantidadRestante
      };
    });
  }


  private buildRegistrarPedidoPayload(): RegistrarPedidoRequest | null {
    const payloadBase = this.buildPedidoPayloadBase();
    const usuarioRegistro = this.authService.getCurrentUser().trim();

    if (!payloadBase) {
      return null;
    }

    if (!usuarioRegistro) {
      this.saveErrorMessage = 'No se encontro el usuario actual de la sesion.';
      return null;
    }

    return {
      ...payloadBase,
      Usr_Reg: usuarioRegistro
    };
  }

  private buildActualizarPedidoPayload(): ActualizarPedidoRequest | null {
    const payloadBase = this.buildPedidoPayloadBase();
    const usuarioModificacion = this.authService.getCurrentUser().trim();

    if (!payloadBase) {
      return null;
    }

    if (!usuarioModificacion) {
      this.saveErrorMessage = 'No se encontro el usuario actual de la sesion.';
      return null;
    }

    return {
      ...payloadBase,
      Usr_Mod: usuarioModificacion
    };
  }

  private buildPedidoPayloadBase(): Omit<RegistrarPedidoRequest, 'Usr_Reg'> | null {
    const requisicionCompra = Number(this.cabeceraForm.controls['requisicionCompra'].value);
    const usuarioAprobacion = String(this.cabeceraForm.controls['usuarioAprobacion'].value || '').trim();
    const lugarEntrega = Number(this.detalleForm.controls['lugarEntrega'].value);
    const referencia = String(this.detalleForm.controls['referencia'].value || '').trim();
    const tipoServicio = String(this.detalleForm.controls['oc'].value || '').trim();
    const moneda = Number(this.detalleForm.controls['moneda'].value);
    const fechaEntrega = this.normalizePedidoFechaEntrega(String(this.detalleForm.controls['fechaEntrega'].value || '').trim());
    const sustento = String(this.detalleForm.controls['sustento'].value || '').trim();
    const attachmentName = this.archivoAdjunto !== 'Sin archivo adjunto' ? this.archivoAdjunto : '';
    const cantidadTotal = this.getTotalCantidadCentroCosto();

    if (!Number.isInteger(requisicionCompra) || requisicionCompra <= 0) {
      this.saveErrorMessage = 'El pedido aun no tiene un correlativo valido.';
      return null;
    }

    if (!usuarioAprobacion) {
      this.cabeceraForm.controls['usuarioAprobacion'].markAsTouched();
      this.saveErrorMessage = 'Selecciona un usuario de aprobacion antes de guardar.';
      return null;
    }

    if (!Number.isInteger(lugarEntrega) || lugarEntrega <= 0) {
      this.detalleForm.controls['lugarEntrega'].markAsTouched();
      this.saveErrorMessage = 'Selecciona un lugar de entrega antes de guardar.';
      return null;
    }

    if (!referencia) {
      this.detalleForm.controls['referencia'].markAsTouched();
      this.saveErrorMessage = 'Ingresa una referencia antes de guardar.';
      return null;
    }

    if (!tipoServicio) {
      this.detalleForm.controls['oc'].markAsTouched();
      this.saveErrorMessage = 'Selecciona un tipo de servicio antes de guardar.';
      return null;
    }

    if (!Number.isInteger(moneda) || moneda <= 0) {
      this.detalleForm.controls['moneda'].markAsTouched();
      this.saveErrorMessage = 'Selecciona una moneda antes de guardar.';
      return null;
    }

    if (!fechaEntrega) {
      this.detalleForm.controls['fechaEntrega'].markAsTouched();
      this.saveErrorMessage = 'Ingresa una fecha de entrega valida antes de guardar.';
      return null;
    }

    if (!sustento) {
      this.detalleForm.controls['sustento'].markAsTouched();
      this.saveErrorMessage = 'Ingresa un sustento antes de guardar.';
      return null;
    }

    if (!this.centrosCosto.length) {
      this.saveErrorMessage = 'Agrega al menos un centro de costo antes de guardar.';
      return null;
    }

    if (this.centrosCosto.some((item) => this.normalizeCantidadCentroCosto(item.cantidad) <= 0)) {
      this.saveErrorMessage = 'Todas las cantidades de centros de costo deben ser mayores a cero.';
      return null;
    }

    if (cantidadTotal <= 0) {
      this.saveErrorMessage = 'La cantidad total del pedido debe ser mayor a cero.';
      return null;
    }

    return {
      Ped_Id: requisicionCompra,
      Ped_Usr_Apr: usuarioAprobacion,
      Ped_Lug_Ent: lugarEntrega,
      Ped_Ref: referencia,
      Ped_Ref_Gral: String(this.detalleForm.controls['referenciaGeneral'].value || '').trim(),
      Ped_Tip_Com: tipoServicio,
      Ped_Tip_Mon: moneda,
      Ped_Fec_Ent: fechaEntrega,
      Ped_Sus: sustento,
      Ped_Arc_Adj_Nom: attachmentName,
      Ped_Arc_Adj_Rut: '',
      Ped_Prv_Cod: 0,
      Ped_For_Pag_Cod: 0,
      Ped_Can_Tot: cantidadTotal
    };
  }

  private registrarCentrosCostoPedido(pedId: number): Observable<unknown> {
    if (!this.centrosCosto.length) {
      return of(null);
    }

    return from(this.centrosCosto).pipe(
      concatMap((item) => this.apiService.postRegistrarCentroCostoPedidoRegistrado(this.buildRegistrarCentroCostoPayload(pedId, item)).pipe(
        switchMap((response: unknown) => {
          this.assertSuccessfulResponse(response, `No se pudo registrar el centro de costo ${item.codigo}.`);
          return of(response);
        })
      )),
      toArray()
    );
  }

  private buildRegistrarCentroCostoPayload(pedId: number, item: CentroCostoRow): RegistrarCentroCostoPedidoRequest {
    return {
      Ped_Id: pedId,
      Ped_Cen_Cos: String(item.codigo),
      Ped_Can: this.normalizeCantidadCentroCosto(item.cantidad)
    };
  }

  private sincronizarCentrosCostoPedido(pedId: number): Observable<unknown> {
    return this.eliminarCentrosCostoSincronizacion().pipe(
      switchMap(() => this.registrarCentrosCostoPedido(pedId))
    );
  }

  private eliminarCentrosCostoSincronizacion(): Observable<unknown> {
    const ids = this.isEditingPedido
      ? this.obtenerIdsPersistidosCentroCosto()
      : [...this.deletedCentroCostoIds];

    if (!ids.length) {
      return of(null);
    }

    this.deletedCentroCostoIds = [];

    return from(ids).pipe(
      concatMap((id) => this.apiService.deleteEliminarCentroCostoPedidoRegistrado({ Ped_Cen_Cos_Id: id }).pipe(
        switchMap((response: unknown) => {
          this.assertSuccessfulResponse(response, `No se pudo eliminar el centro de costo ${id}.`);
          return of(response);
        })
      )),
      toArray()
    );
  }

  private obtenerIdsPersistidosCentroCosto(): number[] {
    const idsPersistidos = this.centrosCosto
      .map((item) => item.persistedId)
      .filter((id): id is number => id !== null);

    return [...new Set([...idsPersistidos, ...this.deletedCentroCostoIds])];
  }

  private normalizeCantidadCentroCosto(cantidad: number): number {
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      return 0;
    }

    return Math.round(cantidad * 1000) / 1000;
  }

  private getTotalCantidadCentroCosto(): number {
    return this.normalizeCantidadCentroCosto(
      this.centrosCosto.reduce((total, item) => total + this.normalizeCantidadCentroCosto(item.cantidad), 0)
    );
  }

  private validarCantidadTotalDetalle(pedId: number, cantidadNueva: number): Observable<void> {
    return this.apiService.getListarPedidoRegistradoCentroCosto(pedId).pipe(
      map((response: unknown) => {
        const totalPermitido = this.extractTotalCantidadPermitida(response);
        const totalActual = this.getTotalActualDetalleSinSeleccionado(pedId);
        const totalPropuesto = this.normalizeCantidadCentroCosto(totalActual + cantidadNueva);

        if (totalPropuesto > totalPermitido) {
          throw new Error(
            `La suma de cantidades del detalle (${this.formatDetalleNumero(totalPropuesto)}) no puede ser mayor que la cantidad total permitida (${this.formatDetalleNumero(totalPermitido)}).`
          );
        }
      }),
      switchMap(() => of(void 0))
    );
  }

  private getTotalActualDetalleSinSeleccionado(pedId: number): number {
    const selectedRowId = this.isEditingPedidoDetalle ? this.selectedPedidoDetalleId : null;

    return this.normalizeCantidadCentroCosto(
      (this.pedidoDetalles[pedId] ?? []).reduce((total, item) => {
        if (selectedRowId !== null && item.id === selectedRowId) {
          return total;
        }

        return total + this.normalizeCantidadCentroCosto(item.cantidad);
      }, 0)
    );
  }

  private getCantidadDetallePorCentroCosto(centroCostoCodigo: number): number {
    if (this.expandedPedidoId === null) {
      return 0;
    }

    const selectedRowId = this.isEditingPedidoDetalle ? this.selectedPedidoDetalleId : null;

    return this.normalizeCantidadCentroCosto(
      (this.pedidoDetalles[this.expandedPedidoId] ?? []).reduce((total, item) => {
        if (selectedRowId !== null && item.id === selectedRowId) {
          return total;
        }

        if (item.centroCostoId !== centroCostoCodigo) {
          return total;
        }

        return total + this.normalizeCantidadCentroCosto(item.cantidad);
      }, 0)
    );
  }

  private extractTotalCantidadPermitida(response: unknown): number {
    return this.normalizeCantidadCentroCosto(
      this.extractRecords(response).reduce((total, item) => total + this.normalizeCantidadCentroCosto(
        this.getDecimalValue(item, ['Ped_Can', 'ped_Can', 'pedCan']) ?? 0
      ), 0)
    );
  }

  private normalizePedidoFechaEntrega(value: string): string {
    if (!value) {
      return '';
    }

    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);

    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}T00:00:00`;
    }

    const separatedMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);

    if (separatedMatch) {
      return `${separatedMatch[3]}-${separatedMatch[1].padStart(2, '0')}-${separatedMatch[2].padStart(2, '0')}T00:00:00`;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');

    return `${parsedDate.getFullYear()}-${month}-${day}T00:00:00`;
  }

  private getFiltros(): PedidosFiltro {
    const filters = this.filtersForm.getRawValue() as {
      nroRequisicion: string;
      proveedor: string;
      estado: string;
      tipo: string;
    };
    const requisicionBuscada = Number(filters.nroRequisicion);
    const tipoBuscado = Number(filters.tipo);
    const filtros: PedidosFiltro = {};
    const usuarioActual = this.authService.getCurrentUser().trim();

    if (usuarioActual) {
      filtros.Usr_Cod = usuarioActual;
    }

    if (filters.nroRequisicion && Number.isInteger(requisicionBuscada) && requisicionBuscada > 0) {
      filtros.Ped_Id = requisicionBuscada;
    }

    if (filters.proveedor?.trim()) {
      filtros.Prv_Nom = filters.proveedor.trim();
    }

    const estado = this.mapEstadoFilter(filters.estado);

    if (estado) {
      filtros.Flg_Est = estado;
    }

    if (filters.tipo?.trim() && Number.isInteger(tipoBuscado) && tipoBuscado > 0) {
      filtros.Ped_Tip_Com = tipoBuscado;
    }

    const palabrasClaveDetalle = String(this.filtersForm.controls['palabrasClaveDetalle']?.value || '').trim();

    if (palabrasClaveDetalle) {
      filtros.Itm_Des = palabrasClaveDetalle;
    }

    return filtros;
  }

  private cargarCorrelativoNuevo(): void {
    this.isLoadingCorrelativo = true;
    this.cabeceraForm.patchValue({
      requisicionCompra: null
    });

    this.apiService.getListarPedidoCorrelativoNuevo().subscribe({
      next: (response: unknown) => {
        const correlativo = this.extractRecords(response)
          .map((item) => this.getNumberValue(item, ['Ped_Id', 'ped_Id', 'pedId', 'requisicion', 'Requisicion']))
          .find((value): value is number => value !== null);

        this.cabeceraForm.patchValue({
          requisicionCompra: correlativo ?? null
        });
        this.isLoadingCorrelativo = false;
      },
      error: (error: unknown) => {
        console.error('Error cargando correlativo de pedido:', error);
        this.cabeceraForm.patchValue({
          requisicionCompra: null
        });
        this.isLoadingCorrelativo = false;
      }
    });
  }

  private mapEstadoFilter(estado: string): string {
    switch (estado) {
      case 'Pendiente':
        return 'P';
      case 'Aprobado':
        return 'A';
      case 'Cancelado':
        return 'C';
      case 'Rechazado':
        return 'R';
      default:
        return '';
    }
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    const possibleArrayKeys = ['pedidos', 'Pedidos', 'usuarios', 'Usuarios', 'users', 'Users', 'centrosCosto', 'CentrosCosto', 'elements', 'Elements', 'data', 'Data', 'result', 'Result'];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return [response];
  }

  private mapPedido(item: DataRecord): RequisitionRow {
    const requisicion = this.getNumberValue(item, ['Ped_Id', 'ped_Id', 'pedId', 'requisicion', 'Requisicion']) ?? 0;
    const archivoNombre = this.getTextValue(item, ['Ped_Arc_Adj_Nom', 'ped_Arc_Adj_Nom', 'pedArcAdjNom', 'archivo', 'Archivo']);
    const fechaRegistro = formatDisplayDate(this.getTextValue(item, ['Fec_Reg', 'fec_Reg', 'fecReg', 'Fecha', 'fecha']));
    const fechaAprobacion = formatDisplayDate(this.getTextValue(item, ['Fec_Apr', 'fec_Apr', 'fecApr', 'FechaAprobacion', 'fechaAprobacion', 'Fec_Mod', 'fec_Mod', 'fecMod', 'FechaUsrGa', 'fechaUsrGa']));
    const proveedor = this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom', 'proveedor', 'Proveedor']) || '-';
    const moneda = this.resolveCurrency(item);
    const total = this.getDecimalValue(item, ['Ped_Tot', 'ped_Tot', 'pedTot', 'total', 'Total']) ?? 0;
    const estado = this.resolveStatus(item);
    const tipo = this.resolveTipo(item);

    return {
      requisicion,
      codigo: this.getTextValue(item, ['Ped_Cod', 'ped_Cod', 'pedCod', 'codigo', 'Codigo']) || (requisicion > 0 ? `PED-${requisicion}` : '-'),
      archivo: this.resolveAttachmentLabel(archivoNombre),
      archivoNombre,
      gerencia: this.getTextValue(item, ['Gerencia', 'gerencia', 'Are_Des', 'are_Des', 'area']) || '-',
      fecha: fechaRegistro || '-',
      proveedor,
      moneda,
      total,
      estado,
      codigoUsr: this.getTextValue(item, ['Usr_Reg', 'usr_Reg', 'usrReg', 'Usr_Cod', 'usrCod']) || '-',
      usrAprobacion: this.getTextValue(item, ['Ped_Usr_Apr', 'ped_Usr_Apr', 'pedUsrApr', 'Usr_Apr', 'usrApr']) || '-',
      fechaUsrGa: fechaAprobacion || '-',
      ordenCompraServicio: this.getTextValue(item, ['Ord_Com_Ped_Id', 'ord_Com_Ped_Id', 'ordComPedId']) || '-',
      gn: this.getTextValue(item, ['Gn', 'gn', 'Ped_Gn', 'ped_Gn']) || '-',
      tipo
    };
  }


  private resolveAttachmentLabel(archivoNombre: string): string {
    if (!archivoNombre) {
      return '-';
    }

    const extension = archivoNombre.split('.').pop()?.trim().toUpperCase();

    return extension || 'ADJ';
  }

  private getMimeTypeFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'txt':
      case 'sql':
        return 'text/plain';
      case 'csv':
        return 'text/csv';
      case 'xml':
        return 'application/xml';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }

  private resolveCurrency(item: DataRecord): string {
    const currencyText = this.getTextValue(item, ['Mon_Abr', 'mon_Abr', 'monAbr', 'Ped_Tip_Mon_Des', 'ped_Tip_Mon_Des', 'pedTipMonDes', 'Moneda', 'moneda']);

    if (currencyText) {
      return currencyText.toUpperCase();
    }

    const currencyCode = this.getNumberValue(item, ['Ped_Tip_Mon', 'ped_Tip_Mon', 'pedTipMon']);
    const option = this.tipoMoneda.find((current) => current.codigo === currencyCode);
    return option?.descripcion || '-';
  }

  private resolveStatus(item: DataRecord): string {
    const statusText = this.getTextValue(item, ['Ped_Est_Des', 'ped_Est_Des', 'pedEstDes', 'Estado', 'estado']);

    if (statusText) {
      return this.toTitleCase(statusText);
    }

    const statusFlag = this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']).toUpperCase();

    switch (statusFlag) {
      case 'A':
        return 'Aprobado';
      case 'P':
        return 'Pendiente';
      case 'C':
      case 'O':
        return 'Cancelado';
      case 'R':
        return 'Rechazado';
      default:
        return '-';
    }
  }

  private resolveTipo(item: DataRecord): string {
    const tipoText = this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes', 'Ped_Tip_Com_Des', 'ped_Tip_Com_Des', 'pedTipComDes']);

    if (tipoText) {
      return tipoText;
    }

    const tipoCode = this.getTextValue(item, ['Ped_Tip_Com', 'ped_Tip_Com', 'pedTipCom']);
    const option = this.tipoServicioOptions.find((current) => current.codigo === tipoCode);
    return option?.descripcion || '-';
  }

  private async loadPedidoLogoBytes(): Promise<Uint8Array | undefined> {
    if (this.pedidoLogoBytes !== undefined) {
      return this.pedidoLogoBytes ?? undefined;
    }

    try {
      const response = await fetch('assets/ArceLogo.jpg');

      if (!response.ok) {
        this.pedidoLogoBytes = null;
        return undefined;
      }

      this.pedidoLogoBytes = new Uint8Array(await response.arrayBuffer());
      return this.pedidoLogoBytes;
    } catch {
      this.pedidoLogoBytes = null;
      return undefined;
    }
  }

  private async loadPedidoHeaderImageBytes(): Promise<Uint8Array | undefined> {
    if (this.pedidoHeaderImageBytes !== undefined) {
      return this.pedidoHeaderImageBytes ?? undefined;
    }

    try {
      const response = await fetch('assets/PedidoInterno.jpg');

      if (!response.ok) {
        this.pedidoHeaderImageBytes = null;
        return undefined;
      }

      this.pedidoHeaderImageBytes = new Uint8Array(await response.arrayBuffer());
      return this.pedidoHeaderImageBytes;
    } catch {
      this.pedidoHeaderImageBytes = null;
      return undefined;
    }
  }

  private mapPedidoReporteCabecera(response: unknown, pedido: RequisitionRow): PedidoReporteCabeceraRow | null {
    const cabecera = this.extractRecords(response)[0];

    if (!cabecera) {
      return null;
    }

    const detalleValue = cabecera['Detalle_Reporte'] ?? cabecera['detalle_Reporte'] ?? cabecera['detalleReporte'];
    const detalleRecords = Array.isArray(detalleValue)
      ? detalleValue.filter((item): item is DataRecord => this.isDataRecord(item))
      : [];
    const detalle = detalleRecords.map((item) => this.mapPedidoReporteDetalle(item));

    return {
      pedidoId: this.getNumberValue(cabecera, ['Ped_Id', 'ped_Id', 'pedId']) ?? pedido.requisicion,
      fechaSolicitud: mapPedidoReportDisplayDate(this.getTextValue(cabecera, ['Fec_Reg', 'fec_Reg', 'fecReg'])),
      solicitante: this.getTextValue(cabecera, ['Usr_Nom', 'usr_Nom', 'usrNom']) || pedido.codigoUsr,
      recepciona: this.getTextValue(cabecera, ['Ped_Usr_Apr_Nom', 'ped_Usr_Apr_Nom', 'pedUsrAprNom', 'Usr_Apr_Nom', 'usrAprNom', 'Ped_Usr_Apr', 'ped_Usr_Apr', 'pedUsrApr']) || pedido.usrAprobacion,
      centroCosto: this.resolvePedidoReporteCentroCosto(detalleRecords),
      ot: this.getTextValue(cabecera, ['Ped_Ot', 'ped_Ot', 'pedOt', 'Ord_Com_Ped_Id', 'ord_Com_Ped_Id', 'ordComPedId']) || pedido.ordenCompraServicio,
      referencia: this.getTextValue(cabecera, ['Ped_Ref', 'ped_Ref', 'pedRef']) || '-',
      referenciaGeneral: this.getTextValue(cabecera, ['Ped_Ref_Gral', 'ped_Ref_Gral', 'pedRefGral']) || '-',
      tipoServicio: this.getTextValue(cabecera, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes']) || pedido.tipo,
      tipoCompra: this.getTextValue(cabecera, ['Ped_Tip_Com_Des', 'ped_Tip_Com_Des', 'pedTipComDes', 'Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes']) || pedido.tipo,
      moneda: this.getTextValue(cabecera, ['Mon_Abr', 'mon_Abr', 'monAbr']) || pedido.moneda,
      almacen: this.getTextValue(cabecera, ['Alm_Des', 'alm_Des', 'almDes', 'Almacen', 'almacen']) || '-',
      oc: this.getTextValue(cabecera, ['Ord_Com_Ped_Id', 'ord_Com_Ped_Id', 'ordComPedId']) || pedido.ordenCompraServicio,
      telefono: this.getTextValue(cabecera, ['Usr_Tel', 'usr_Tel', 'usrTel', 'Prv_Tel', 'prv_Tel', 'prvTel', 'Telefono', 'telefono']) || '-',
      lugarEntrega: this.getTextValue(cabecera, ['Dir_Des', 'dir_Des', 'dirDes', 'Ped_Lug_Ent_Des', 'ped_Lug_Ent_Des', 'Ped_Lug_Ent', 'ped_Lug_Ent', 'pedLugEnt']) || '-',
      direccionEntrega: this.getTextValue(cabecera, ['Dir_Ubi', 'dir_Ubi', 'dirUbi', 'Ped_Ref', 'ped_Ref', 'pedRef']) || '-',
      fechaEntrega: mapPedidoReportDisplayDate(this.getTextValue(cabecera, ['Ped_Fec_Ent', 'ped_Fec_Ent', 'pedFecEnt'])),
      proveedorReferencia: this.getTextValue(cabecera, ['Ped_Sus', 'ped_Sus', 'pedSus']) || '-',
      detalle
    };
  }

  private mapPedidoReporteDetalle(item: DataRecord): PedidoReporteDetallePdf {
    const descripcion = this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes']) || '-';
    const observacion = this.getTextValue(item, ['Ped_Obs_Ped', 'ped_Obs_Ped', 'pedObsPed', 'Ped_Obs', 'ped_Obs', 'pedObs']);
    const comentario = this.getTextValue(item, ['Ped_Com', 'ped_Com', 'pedCom']);
    const requisitos = this.getTextValue(item, ['Ped_Req', 'ped_Req', 'pedReq']);
    const imagen = this.getTextValue(item, ['Ped_Det_Img', 'ped_Det_Img', 'pedDetImg']);

    return {
      descripcion: observacion ? `${descripcion} - ${observacion}` : descripcion,
      unidad: this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr']) || '-',
      cantidad: this.getDecimalValue(item, ['Ped_Can', 'ped_Can', 'pedCan']) ?? 0,
      comentario: comentario || '-',
      centroCosto: this.getTextValue(item, [
        'Cen_Cos_Des',
        'cen_Cos_Des',
        'cenCosDes',
        'Ped_Cen_Cos_Des',
        'ped_Cen_Cos_Des',
        'pedCenCosDes',
        'Cen_Cos_Cod',
        'cen_Cos_Cod',
        'cenCosCod',
        'Ped_Cen_Cos_Asg',
        'ped_Cen_Cos_Asg',
        'pedCenCosAsg'
      ]) || '-',
      requisitos: requisitos || '-',
      imagen: imagen || '-'
    };
  }

  private resolvePedidoReporteCentroCosto(detalle: DataRecord[]): string {
    const firstRecord = detalle.find((item): item is DataRecord => this.isDataRecord(item));

    if (!firstRecord) {
      return '-';
    }

    return this.getTextValue(firstRecord, [
      'Cen_Cos_Des',
      'cen_Cos_Des',
      'cenCosDes',
      'Ped_Cen_Cos_Des',
      'ped_Cen_Cos_Des',
      'pedCenCosDes',
      'Cen_Cos_Cod',
      'cen_Cos_Cod',
      'cenCosCod',
      'Ped_Cen_Cos_Asg',
      'ped_Cen_Cos_Asg',
      'pedCenCosAsg'
    ]) || '-';
  }

  private async buildPedidoReportePdfData(reporte: PedidoReporteCabeceraRow, pedido: RequisitionRow): Promise<PedidoReportePdfData> {
    const detalle = await Promise.all(
      reporte.detalle.map(async (item) => ({
        ...item,
        imagenData: await this.loadPedidoReporteDetalleImage(item.imagen)
      }))
    );

    return {
      pedidoId: reporte.pedidoId,
      codigoPedido: pedido.codigo,
      fechaSolicitud: reporte.fechaSolicitud,
      solicitante: reporte.solicitante,
      recepciona: reporte.recepciona,
      centroCosto: reporte.centroCosto,
      ot: reporte.ot,
      referencia: reporte.referencia,
      referenciaGeneral: reporte.referenciaGeneral,
      tipoServicio: reporte.tipoServicio,
      tipoCompra: reporte.tipoCompra,
      moneda: reporte.moneda,
      almacen: reporte.almacen,
      oc: reporte.oc,
      telefono: reporte.telefono,
      lugarEntrega: reporte.lugarEntrega,
      direccionEntrega: reporte.direccionEntrega,
      fechaEntrega: reporte.fechaEntrega,
      proveedorReferencia: reporte.proveedorReferencia,
      detalle
    };
  }

  private async loadPedidoReporteDetalleImage(imageName?: string): Promise<PedidoReporteEmbeddedImage | undefined> {
    const normalizedImageName = String(imageName || '').trim();

    if (!normalizedImageName || normalizedImageName === '-') {
      return undefined;
    }

    try {
      const imageBuffer = await firstValueFrom(this.apiService.getArchivoDetallePedido(normalizedImageName));

      if (!imageBuffer) {
        return undefined;
      }

      return await this.convertPedidoReporteImageToJpeg(imageBuffer, normalizedImageName);
    } catch (error) {
      console.warn('No se pudo cargar la imagen del detalle para el reporte de pedido:', normalizedImageName, error);
      return undefined;
    }
  }

  private async convertPedidoReporteImageToJpeg(buffer: ArrayBuffer, imageName: string): Promise<PedidoReporteEmbeddedImage> {
    const blob = new Blob([buffer], { type: this.resolvePedidoReporteImageMimeType(imageName) });
    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = await this.loadPedidoReporteImageElement(objectUrl);
      const maxDimension = 160;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
      const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No se pudo obtener el contexto del canvas para la imagen del reporte.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64Payload = dataUrl.split(',')[1] || '';

      return {
        bytes: this.base64ToUint8Array(base64Payload),
        width,
        height
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private loadPedidoReporteImageElement(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo cargar la imagen para el reporte.'));
      image.src = url;
    });
  }

  private resolvePedidoReporteImageMimeType(imageName: string): string {
    const extension = imageName.split('.').pop()?.trim().toLowerCase() || '';

    switch (extension) {
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  private base64ToUint8Array(base64Value: string): Uint8Array {
    const binaryString = atob(base64Value);
    const bytes = new Uint8Array(binaryString.length);

    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }

    return bytes;
  }

  private mapApprovalUser(item: DataRecord): ApprovalUserOption {
    return {
      id: this.getNumberValue(item, ['Usr_Id', 'usr_Id', 'usrId', 'id', 'Id']) ?? 0,
      code: this.getTextValue(item, ['Usr_Cod', 'usr_Cod', 'usrCod']),
      name: this.getTextValue(item, ['Usr_Nom', 'usr_Nom', 'usrNom']),
      email: this.getTextValue(item, ['Usr_Corr', 'usr_Corr', 'usrCorr', 'Correo', 'correo', 'Email', 'email'])
    };
  }

  private mapCentroCostoOption(item: DataRecord): CentroCostoOption {
    return {
      id: this.getNumberValue(item, ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId', 'id', 'Id']) ?? 0,
      descripcion: this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes', 'descripcion', 'Descripcion'])
    };
  }

  private mapTipoServicioOption(item: DataRecord): CatalogoTextoOption | null {
    const id = this.getNumberValue(item, ['Tip_Ser_Id', 'tip_Ser_Id', 'tipSerId', 'id', 'Id']);
    const descripcion = this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes', 'descripcion', 'Descripcion']);

    if (!id || !descripcion) {
      return null;
    }

    return {
      codigo: String(id),
      descripcion
    };
  }

  private mapMonedaOption(item: DataRecord): CatalogoNumeroOption | null {
    const id = this.getNumberValue(item, ['Mon_Id', 'mon_Id', 'monId', 'id', 'Id']);
    const descripcion = this.getTextValue(item, ['Mon_Abr', 'mon_Abr', 'monAbr', 'Mon_Des', 'mon_Des', 'monDes', 'descripcion', 'Descripcion']);

    if (!id || !descripcion) {
      return null;
    }

    return {
      codigo: id,
      descripcion: descripcion.toUpperCase()
    };
  }

  private getTextValue(item: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private getNumberValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);

      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  private getDecimalValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(item[key]);

      if (!Number.isNaN(value)) {
        return value;
      }
    }

    return null;
  }

  private toTitleCase(value: string): string {
    const normalized = value.trim().toLowerCase();

    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '-';
  }

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private assertSuccessfulResponse(response: unknown, fallbackMessage: string): void {
    if (!this.isDataRecord(response)) {
      return;
    }

    if (response['Success'] === false || response['success'] === false) {
      throw new Error(this.extractResponseMessage(response) || fallbackMessage);
    }
  }

  private extractResponseMessage(response: DataRecord): string {
    const message = response['Message'] ?? response['message'];
    return typeof message === 'string' ? message.trim() : '';
  }

  private resolveErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    if (error instanceof HttpErrorResponse) {
      const body = error.error;

      if (this.isDataRecord(body)) {
        const message = this.extractResponseMessage(body);

        if (message) {
          return message;
        }
      }

      if (typeof body === 'string' && body.trim()) {
        return body.trim();
      }
    }

    return fallbackMessage;
  }

  private resetPedidoEditor(): void {
    this.cabeceraForm.reset({
      requisicionCompra: null,
      usuarioAprobacionId: 0,
      usuarioAprobacion: ''
    });
    this.centroCostoForm.reset({
      centroCostoId: 0,
      centroCosto: ''
    });
    this.nextCentroCostoId = 1;
    this.detalleForm.reset({
      lugarEntrega: '',
      referencia: '',
      oc: '',
      moneda: null,
      fechaEntrega: this.getPedidoFechaEntregaMinima(),
      referenciaGeneral: '',
      sustento: '',
      archivo: 'Sin archivo adjunto'
    });
    this.applyDefaultPedidoSelectValues(true);
    this.centrosCosto = [];
    this.currentCentroCostoPage = 1;
    this.editandoCentroCostoCantidad = 0;
    this.archivoFile = null;
    this.archivoFiles = [];
    this.archivosAdjuntosGuardados = [];
    this.archivoAdjunto = 'Sin archivo adjunto';
    this.saveErrorMessage = '';
    this.isSavingPedido = false;
    this.isLoadingPedidoDetalle = false;
    this.deletedCentroCostoIds = [];
  }

  private populatePedidoEditor(item: DataRecord): void {
    const pedId = this.getNumberValue(item, ['Ped_Id', 'ped_Id', 'pedId', 'requisicion', 'Requisicion']);
    const approvalCode = this.getTextValue(item, ['Ped_Usr_Apr', 'ped_Usr_Apr', 'pedUsrApr', 'Usr_Apr', 'usrApr']);
    const approvalUser = this.approvalUsers.find((user) => user.code === approvalCode);

    this.cabeceraForm.patchValue({
      requisicionCompra: pedId ?? null,
      usuarioAprobacionId: approvalUser?.id ?? 0,
      usuarioAprobacion: approvalCode
    });

    this.detalleForm.patchValue({
      lugarEntrega: this.getTextValue(item, ['Ped_Lug_Ent', 'ped_Lug_Ent', 'pedLugEnt']),
      referencia: this.getTextValue(item, ['Ped_Ref', 'ped_Ref', 'pedRef']),
      oc: this.getTextValue(item, ['Ped_Tip_Com', 'ped_Tip_Com', 'pedTipCom']),
      moneda: this.getNumberValue(item, ['Ped_Tip_Mon', 'ped_Tip_Mon', 'pedTipMon']),
      fechaEntrega: formatDateInputValue(this.getTextValue(item, ['Ped_Fec_Ent', 'ped_Fec_Ent', 'pedFecEnt'])),
      referenciaGeneral: this.getTextValue(item, ['Ped_Ref_Gral', 'ped_Ref_Gral', 'pedRefGral']),
      sustento: this.getTextValue(item, ['Ped_Sus', 'ped_Sus', 'pedSus']),
      archivo: this.getTextValue(item, ['Ped_Arc_Adj_Nom', 'ped_Arc_Adj_Nom', 'pedArcAdjNom']) || 'Sin archivo adjunto'
    });

    this.archivoFile = null;
    this.archivoFiles = [];
    this.archivosAdjuntosGuardados = [];
    this.archivoAdjunto = String(this.detalleForm.controls['archivo'].value || 'Sin archivo adjunto');
  }

  private applyDefaultPedidoSelectValues(force = false): void {
    if (this.isEditingPedido) {
      return;
    }

    const patch: Partial<{
      oc: string;
      moneda: number | null;
    }> = {};

    const selectedTipoServicio = this.detalleForm.controls['oc'].value;
    const selectedMoneda = this.detalleForm.controls['moneda'].value;

    if (this.tipoServicioOptions.length && (force || !String(selectedTipoServicio || '').trim())) {
      patch.oc = this.tipoServicioOptions[0].codigo;
    }

    if (this.tipoMoneda.length && (force || selectedMoneda === null || selectedMoneda === undefined || selectedMoneda === '')) {
      patch.moneda = this.tipoMoneda[0].codigo;
    }

    if (Object.keys(patch).length) {
      this.detalleForm.patchValue(patch, { emitEvent: false });
    }
  }

  private populateCentroCostoEditor(response: unknown): void {
    const centros = this.mapCentroCostoRegistrados(response);
    this.centrosCosto = centros;
    this.currentCentroCostoPage = normalizePaginationPage(this.currentCentroCostoPage, this.centrosCosto.length, this.pageSize);
    this.nextCentroCostoId = centros.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
  }

  private populateArchivosAdjuntosEditor(response: unknown): void {
    console.log('[Pedidos][Archivos adjuntos][Respuesta backend]', response);
    this.archivosAdjuntosGuardados = this.extractRecords(response)
      .map((item) => this.mapPedidoArchivoAdjunto(item))
      .filter((archivo): archivo is PedidoArchivoAdjuntoRow => archivo !== null);
    console.log('[Pedidos][Archivos adjuntos][Mapeados grilla]', this.archivosAdjuntosGuardados);
    this.actualizarArchivoAdjuntoFormControl();
  }

  private mapPedidoArchivoAdjunto(item: DataRecord): PedidoArchivoAdjuntoRow | null {
    const nombre = this.getTextValue(item, [
      'Ped_Cab_Arc_Nom',
      'ped_Cab_Arc_Nom',
      'pedCabArcNom',
      'Archivo',
      'archivo',
      'Nombre',
      'nombre'
    ]);

    if (!nombre) {
      return null;
    }

    return {
      id: this.getDecimalValue(item, ['Ped_Cab_Arc_Id', 'ped_Cab_Arc_Id', 'pedCabArcId']) ?? 0,
      pedidoId: this.getDecimalValue(item, ['Ped_Cab_Id', 'ped_Cab_Id', 'pedCabId']) ?? 0,
      nombre,
      ruta: this.getTextValue(item, [
        'Ped_Cab_Arc_Rut',
        'ped_Cab_Arc_Rut',
        'pedCabArcRut',
        'Ruta',
        'ruta'
      ])
    };
  }

  private mapCentroCostoRegistrados(response: unknown): CentroCostoRow[] {
    let nextId = 1;

    return this.extractRecords(response)
      .map((item) => this.mapCentroCostoRegistrado(item, nextId++))
      .filter((item): item is CentroCostoRow => item !== null);
  }

  private mapCentroCostoRegistrado(item: DataRecord, rowId: number): CentroCostoRow | null {
    const id = this.getNumberValue(item, ['Ped_Cen_Cos_Id', 'ped_Cen_Cos_Id', 'pedCenCosId']);
    const codigoTexto = this.getTextValue(item, ['Ped_Cen_Cos', 'ped_Cen_Cos', 'pedCenCos']);
    const codigo = Number(codigoTexto);

    if (!id || !Number.isInteger(codigo) || codigo <= 0) {
      return null;
    }

    const centroCosto = this.centroCostoOptions.find((option) => option.id === codigo);

    return {
      id: rowId,
      codigo,
      costo: centroCosto?.descripcion || `Centro de costo ${codigo}`,
      cantidad: this.getDecimalValue(item, ['Ped_Can', 'ped_Can', 'pedCan']) ?? 0,
      persistedId: id
    };
  }

  private mapDetalleItemOption(item: DataRecord): PedidoDetalleItemOption | null {
    const id = this.getNumberValue(item, ['Itm_Id', 'itm_Id', 'itmId', 'id', 'Id']);
    const description = this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes', 'descripcion', 'Descripcion']);
    const unitId = this.getNumberValue(item, ['Uni_Med_Id', 'uni_Med_Id', 'uniMedId']);
    const unitDescription = this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes']);

    if (!id || !description) {
      return null;
    }

    return {
      id,
      code: String(id),
      description,
      groupDescription: this.getTextValue(item, ['Grp_Des', 'grp_Des', 'grpDes', 'grupo', 'Grupo']) || 'Sin grupo',
      unitId: unitId ?? undefined,
      unitCode: unitId ? String(unitId) : undefined,
      unitDescription: unitDescription || undefined
    };
  }

  private mapDetalleUnidadOption(item: DataRecord): PedidoDetalleUnidadOption | null {
    const id = this.getNumberValue(item, ['Uni_Med_Id', 'uni_Med_Id', 'uniMedId', 'id', 'Id']);
    const description = this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'descripcion', 'Descripcion']);
    const abbreviation = this.getTextValue(item, ['Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr', 'abreviatura', 'Abreviatura']);

    if (!id || !description || !abbreviation) {
      return null;
    }

    return {
      id,
      code: String(id),
      description,
      abbreviation
    };
  }

  private mapPedidoDetalle(item: DataRecord, index: number): PedidoDetalleRow | null {
    const persistedId = this.getNumberValue(item, ['Ped_Det_Id', 'ped_Det_Id', 'pedDetId']);
    const id = persistedId ?? index + 1;
    const codigoItem = this.getTextValue(item, ['Ped_Cod_Itm', 'ped_Cod_Itm', 'pedCodItm']);
    const unidadCodigo = this.getTextValue(item, ['Ped_Uni_Med', 'ped_Uni_Med', 'pedUniMed']);
    const cantidad = this.getDecimalValue(item, ['Ped_Can', 'ped_Can', 'pedCan']) ?? 0;
    const precioUnitario = this.getDecimalValue(item, ['Ped_Cos_Uni', 'ped_Cos_Uni', 'pedCosUni']) ?? 0;
    const subtotal = this.getDecimalValue(item, ['Ped_Cos_Tot', 'ped_Cos_Tot', 'pedCosTot']) ?? 0;
    const descripcionItem = this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes', 'Ped_Des_Itm', 'ped_Des_Itm', 'pedDesItm', 'Ped_Des', 'ped_Des']);
    const descripcionUnidad = this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes']);
    const descripcionCentroCosto = this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']);
    const centroCostoId = this.getNumberValue(item, ['Ped_Cen_Cos_Asg', 'ped_Cen_Cos_Asg', 'pedCenCosAsg']);

    if (!codigoItem && !cantidad && !precioUnitario && !subtotal) {
      return null;
    }

    const itemDescription = descripcionItem || this.resolveDetalleItemDescription(codigoItem);
    const unidadDescripcion = descripcionUnidad || this.resolveDetalleUnidadDescription(unidadCodigo);

    return {
      id,
      persistedId,
      item: String(index + 1),
      codigoItem: codigoItem || '-',
      descripcion: itemDescription || '-',
      centroCostoId,
      centroCosto: descripcionCentroCosto || '-',
      unidadCodigo: unidadCodigo || '-',
      unidad: unidadDescripcion || unidadCodigo || '-',
      cantidad,
      precioUnitario,
      subtotal
    };
  }

  private enrichPedidoDetalle(detail: PedidoDetalleRow): PedidoDetalleRow {
    const description = detail.descripcion !== '-' ? detail.descripcion : this.resolveDetalleItemDescription(detail.codigoItem) || '-';
    const unidad = this.resolveDetalleUnidadDescription(detail.unidadCodigo) || detail.unidad || '-';

    return {
      ...detail,
      descripcion: description,
      unidad
    };
  }

  private resolveDetalleItemDescription(itemCode: string): string {
    const normalizedCode = itemCode.trim();

    if (!normalizedCode) {
      return '';
    }

    return this.detalleItemOptions.find((option) => option.code === normalizedCode)?.description || '';
  }

  private resolveDetalleUnidadDescription(unitCode: string): string {
    const normalizedCode = unitCode.trim();

    if (!normalizedCode) {
      return '';
    }

    return this.detalleUnidadOptions.find((option) => option.code === normalizedCode)?.description || '';
  }

  private buildDetallePedidoPayload(): RegistrarDetallePedidoRequest | null {
    if (this.expandedPedidoId === null) {
      this.detallePedidoErrorMessage = 'No hay un pedido seleccionado para registrar el detalle.';
      return null;
    }

    const codigoItem = Number(String(this.detallePedidoForm.controls['codigoItem'].value || '').trim());
    const unidad = Number(String(this.detallePedidoForm.controls['unidad'].value || '').trim());
    const centroCostoAsignado = Number(this.detallePedidoForm.controls['centroCostoId'].value || 0);
    const cantidad = this.normalizeCantidadCentroCosto(Number(this.detallePedidoForm.controls['cantidad'].value));
    const precioUnitario = this.normalizeCantidadCentroCosto(Number(this.detallePedidoForm.controls['precioUnitario'].value));
    const subtotal = this.normalizeCantidadCentroCosto(cantidad * precioUnitario);
    const usuarioRegistro = this.authService.getCurrentUser().trim();

    if (!Number.isInteger(codigoItem) || codigoItem <= 0) {
      this.detallePedidoErrorMessage = 'Selecciona un item.';
      return null;
    }

    if (!Number.isInteger(unidad) || unidad <= 0) {
      this.detallePedidoErrorMessage = 'Selecciona una unidad de medida.';
      return null;
    }

    if (!Number.isInteger(centroCostoAsignado) || centroCostoAsignado <= 0) {
      this.detallePedidoErrorMessage = 'Selecciona un centro de costo asignado.';
      return null;
    }

    if (cantidad <= 0) {
      this.detallePedidoErrorMessage = 'La cantidad debe ser mayor a cero.';
      return null;
    }

    if (cantidad > this.detallePedidoCantidadDisponible) {
      this.detallePedidoErrorMessage = `La cantidad no puede ser mayor a ${this.formatDetalleNumero(this.detallePedidoCantidadDisponible)}.`;
      return null;
    }

    if (precioUnitario <= 0) {
      this.detallePedidoErrorMessage = 'El precio unitario debe ser mayor a cero.';
      return null;
    }

    if (subtotal <= 0) {
      this.detallePedidoErrorMessage = 'El subtotal debe ser mayor a cero.';
      return null;
    }

    if (!usuarioRegistro) {
      this.detallePedidoErrorMessage = 'No se encontro el usuario actual de la sesion.';
      return null;
    }

    return {
      Ped_Cab_Id: this.expandedPedidoId,
      Ped_Cod_Itm: codigoItem,
      Ped_Uni_Med: unidad,
      Ped_Cen_Cos_Asg: centroCostoAsignado,
      Ped_Can: cantidad,
      Ped_Cos_Uni: precioUnitario,
      Ped_Cos_Tot: subtotal,
      Usr_Reg: usuarioRegistro
    };
  }

  private reloadDetallePedidoExpandido(pedidoId: number): Observable<unknown> {
    this.isLoadingDetalleExpandido = true;
    this.detalleExpandidoError = '';

    return this.apiService.getListarDetallePedido(pedidoId).pipe(
      map((response: unknown) => {
        this.pedidoDetalles[pedidoId] = this.extractRecords(response)
          .map((detail, index) => this.mapPedidoDetalle(detail, index))
          .filter((detail): detail is PedidoDetalleRow => detail !== null);
        this.updatePedidoTotal(pedidoId);
        this.detallePedidoCantidadLimite = this.pedidoDetalleCantidadLimites[pedidoId] ?? this.detallePedidoCantidadLimite;
        this.isLoadingDetalleExpandido = false;
        return response;
      }),
      switchMap((response: unknown) => of(response))
    );
  }

  private getSelectedPedidoDetalleRow(): PedidoDetalleRow | null {
    if (this.selectedPedidoDetalleId === null) {
      return null;
    }

    return this.getDetallePedidoExpandido().find((detail) => detail.id === this.selectedPedidoDetalleId) ?? null;
  }

  private updatePedidoTotal(pedidoId: number): void {
    const total = this.normalizeCantidadCentroCosto(
      (this.pedidoDetalles[pedidoId] ?? []).reduce((sum, detail) => sum + (detail.subtotal || 0), 0)
    );

    this.requisiciones = this.requisiciones.map((pedido) =>
      pedido.requisicion === pedidoId
        ? {
            ...pedido,
            total
          }
        : pedido
    );
  }

  private resetDetallePedidoEditor(): void {
    this.selectedPedidoDetalleId = null;
    this.isEditingPedidoDetalle = false;
    this.isSavingPedidoDetalle = false;
    this.detallePedidoErrorMessage = '';
    this.detallePedidoForm.reset({
      codigoItem: '',
      unidad: '',
      centroCostoId: 0,
      centroCostoDescripcion: '',
      centroCostoCantidadRequerida: 0,
      cantidad: 0,
      precioUnitario: 0
    });
  }
}
