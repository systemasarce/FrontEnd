import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, of } from 'rxjs';

import {
  AlmacenFiltro,
  ActualizarMotivoRechazoAlmacenRequest,
  ActualizarPedidoDetalleIngresoAlmacenRequest,
  ActualizarIngresoAlmacenDetalleRequest,
  ActualizarIngresoAlmacenRequest,
  ActualizarStockItemIngresoDirectoRequest,
  ActualizarStockItemSalidaRequest,
  ActualizarStockItemRequest,
  ApiService,
  CambiarEstadoOrdenCompraRequest,
  CatalogoNumeroOption,
  CatalogoTextoOption,
  RegistrarIngresoAlmacenOrdenCompraRequest,
  RegistrarIngresoAlmacenDetalleRequest,
  RegistrarIngresoAlmacenRequest
} from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { ProviderRecord } from 'src/app/features/provider-form/provider-form.models';
import { ConfirmacionAccionDialogComponent } from '../inspecciones-page/confirmacion-accion-dialog.component';
import { PedidoRechazoDialogComponent, PedidoRechazoDialogResult } from '../requisiciones-page/pedido-rechazo-dialog.component';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { formatDateRequestValue, formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { PedidoDetalleItemOption, PedidoDetalleUnidadOption } from '../requisiciones-page/pedido-detalle-dialog.models';
import {
  AlmacenSalidaReporteDialogResult,
  AlmacenSalidasReporteDialogComponent
} from './almacen-salidas-reporte-dialog.component';

type DataRecord = Record<string, unknown>;

interface AlmacenRow {
  id: number;
  movimientoId: number;
  tipoIngresoId: number;
  tipoIngreso: string;
  ordenCompraId: number;
  pedidoId: number;
  ubicacionId: number;
  centroCostoId: number;
  centroCosto: string;
  solicitanteDocumento: string;
  almacen: string;
  fechaRegistro: string;
  registradoPor: string;
  solicitante: string;
  estadoAprobacion: string;
  estadoConsumo: string;
}

interface OrdenCompraPendienteAlmacenRow {
  id: number;
  ordenCompraId: number;
  pedidoId: number;
  numeroOrden: string;
  pedidoCodigo: string;
  tipo: string;
  fecha: string;
  proveedorId: number;
  proveedor: string;
  proveedorRuc: string;
  formaPago: string;
  refObra: string;
  referencia: string;
  total: number;
  estado: string;
}

interface IngresoOrdenDetalleRow {
  id: number;
  almacenDetalleId: number;
  pedidoDetalleId: number;
  itemId: number;
  itemCodigo: string;
  itemDescripcion: string;
  unidadId: number;
  unidad: string;
  centroCostoId: number;
  centroCosto: string;
  compra: number;
  ingresado: number;
  pendiente: number;
  serie: string;
  costoUnitario: number | null;
  documentoNumero: string;
  fechaDetalle: string;
  cantidadIngresar: number | null;
  seleccionado: boolean;
}

interface SalidaItemRow {
  itemId: number;
  itemCodigo: string;
  descripcion: string;
  unidadId: number;
  unidadCodigo: string;
  unidadDescripcion: string;
  grupo: string;
  subGrupo: string;
  detalleMaterial: string;
  stock: number;
  reservado: number;
  disponible: number;
}

interface SalidaDetalleDraft {
  detalleId: number;
  itemId: number;
  itemDescripcion: string;
  unidadId: number;
  cantidad: number;
  fecha: string;
  originalCantidad: number;
}

interface ReporteSalidaRow {
  fecha: string;
  solicitante: string;
  documento: string;
  item: string;
  unidad: string;
  cantidad: number;
}

interface AlmacenSolicitanteOption {
  id: number;
  code: string;
  documentNumber: string;
  name: string;
}

interface AlmacenCentroCostoOption {
  id: number;
  code: string;
  description: string;
}

@Component({
  selector: 'app-almacen-page',
  templateUrl: './almacen-page.component.html',
  styleUrls: ['./almacen-page.component.scss']
})
export class AlmacenPageComponent implements OnInit {
  readonly filtersForm: FormGroup;
  readonly ingresoDirectoForm: FormGroup;
  readonly salidaMaterialesForm: FormArray;
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  readonly salidaPageSize = 20;
  readonly estadoOptions: CatalogoTextoOption[] = [
    { codigo: '', descripcion: 'Todos' },
    { codigo: 'A', descripcion: 'Activo' },
    { codigo: 'I', descripcion: 'Inactivo' }
  ];
  readonly estadoAprobacionOptions: CatalogoTextoOption[] = [
    { codigo: '', descripcion: 'Todos' },
    { codigo: 'I', descripcion: 'Ingresado' },
    { codigo: 'P', descripcion: 'Pendiente' },
    { codigo: 'C', descripcion: 'Cerrado' }
  ];
  readonly tipoIngresoOptions: CatalogoNumeroOption[] = [
    { codigo: 0, descripcion: 'Todos' },
    { codigo: 1, descripcion: 'Ingreso directo' },
    { codigo: 2, descripcion: 'Orden de compra' },
    { codigo: 3, descripcion: 'Orden de servicio' }
  ];
  readonly listadoOptions: CatalogoTextoOption[] = [
    { codigo: 'P', descripcion: 'Pendiente' },
    { codigo: 'I', descripcion: 'Ingresado' },
    { codigo: 'S', descripcion: 'Salida' }
  ];
  readonly ubicacionOptions: CatalogoTextoOption[] = [
    { codigo: '1', descripcion: 'BASE' },
    { codigo: '2', descripcion: 'OBRA' }
  ];

  readonly solicitanteSearchControl = new FormControl('', { nonNullable: true });
  readonly proveedorSearchControl = new FormControl('', { nonNullable: true });
  readonly centroCostoSearchControl = new FormControl('', { nonNullable: true });
  readonly centrosCostoMaterialSearchControl = new FormControl('', { nonNullable: true });
  readonly materialSearchControl = new FormControl('', { nonNullable: true });
  readonly unidadSearchControl = new FormControl('', { nonNullable: true });
  readonly listadoControl = new FormControl<'P' | 'I' | 'S'>('P', { nonNullable: true });
  readonly ingresoOrdenGuiaRemitenteControl = new FormControl('', { nonNullable: true });

  almacenes: AlmacenRow[] = [];
  ordenesCompraPendientesAlmacen: OrdenCompraPendienteAlmacenRow[] = [];
  salidaItems: SalidaItemRow[] = [];
  solicitanteOptions: AlmacenSolicitanteOption[] = [];
  proveedorOptions: ProviderRecord[] = [];
  centroCostoOptions: AlmacenCentroCostoOption[] = [];
  itemOptions: PedidoDetalleItemOption[] = [];
  unidadOptions: PedidoDetalleUnidadOption[] = [];
  ubicacionIngresoOrdenOptions: CatalogoNumeroOption[] = [];
  globalSearch = '';
  isLoadingAlmacen = false;
  isLoadingCatalogos = false;
  isSavingIngreso = false;
  isLoadingEditor = false;
  isExportingSalidas = false;
  showIngresoDirectoForm = false;
  showIngresoOrdenForm = false;
  isSalidaMode = false;
  isEditMode = false;
  errorMessage = '';
  saveErrorMessage = '';
  currentPage = 1;
  ingresoOrdenSeleccionada: OrdenCompraPendienteAlmacenRow | null = null;
  ingresoOrdenDetalles: IngresoOrdenDetalleRow[] = [];
  ingresoOrdenUbicacionId = 1;
  private pendingEditMovimientoId: number | null = null;
  private pendingEditCabeceraRecord: DataRecord | null = null;
  private pendingEditDetalleRecords: DataRecord[] = [];
  private currentEditDetalleId = 0;
  private currentEditFlgEst = 'A';
  private isIngresoOrdenEditMode = false;
  private ingresoOrdenMovimientoId = 0;
  private salidaItemSeleccionado: SalidaItemRow | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar
  ) {
    this.filtersForm = this.formBuilder.group({
      movimientoId: [''],
      tipoIngreso: [0],
      estado: [''],
      estadoAprobacion: ['']
    });

    this.ingresoDirectoForm = this.formBuilder.group({
      movimientoId: [{ value: 'Auto', disabled: true }],
      tipoIngresoTexto: [{ value: 'Ingreso directo', disabled: true }],
      ubicacion: ['1', Validators.required],
      solicitanteId: [''],
      proveedorId: [0],
      centroCostoSolicitanteId: [0, Validators.required],
      serie: [''],
      costoUnitario: [null, Validators.min(0)],
      materialId: [0, Validators.required],
      materialCode: [''],
      materialDescription: ['', Validators.required],
      unidadId: [0, Validators.required],
      unidadCode: [''],
      unidadDescription: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(0.001)]],
      documentoNumero: [''],
      fecha: [this.getTodayDateValue()],
      centrosCostoMaterialIds: [[]]
    });

    this.salidaMaterialesForm = this.formBuilder.array([]);
  }

  ngOnInit(): void {
    this.cargarListadoSeleccionado();
    this.cargarCatalogosEditor();
  }

  get isListadoPendiente(): boolean {
    return this.listadoControl.value === 'P';
  }

  get isListadoIngresado(): boolean {
    return this.listadoControl.value === 'I';
  }

  get isListadoSalida(): boolean {
    return this.listadoControl.value === 'S';
  }

  get actionButtons(): string[] {
    return this.isListadoSalida ? [] : ['Ing. Directo'];
  }

  get filteredAlmacenes(): AlmacenRow[] {
    const search = this.globalSearch.trim().toLowerCase();

    if (!search) {
      return this.almacenes;
    }

    return this.almacenes.filter((item) => {
      const searchableValues = [
        item.movimientoId,
        item.tipoIngreso,
        item.centroCosto,
        item.almacen,
        item.fechaRegistro,
        item.registradoPor,
        item.solicitante,
        item.estadoAprobacion,
        item.estadoConsumo
      ];

      return searchableValues.some((value) => String(value).toLowerCase().includes(search));
    });
  }

  get paginatedAlmacenes(): AlmacenRow[] {
    return paginateItems(this.filteredAlmacenes, this.currentPage, this.pageSize);
  }

  get paginatedOrdenesCompraPendientesAlmacen(): OrdenCompraPendienteAlmacenRow[] {
    return paginateItems(this.ordenesCompraPendientesAlmacen, this.currentPage, this.pageSize);
  }

  get filteredSalidaItems(): SalidaItemRow[] {
    const search = this.globalSearch.trim().toLowerCase();

    if (!search) {
      return this.salidaItems;
    }

    return this.salidaItems.filter((item) => {
      const searchableValues = [
        item.itemCodigo,
        item.descripcion,
        item.grupo,
        item.subGrupo,
        item.detalleMaterial,
        item.stock
      ];

      return searchableValues.some((value) => String(value).toLowerCase().includes(search));
    });
  }

  get paginatedSalidaItems(): SalidaItemRow[] {
    return paginateItems(this.filteredSalidaItems, this.currentPage, this.salidaPageSize);
  }

  get filteredSolicitanteOptions(): AlmacenSolicitanteOption[] {
    const search = this.solicitanteSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.solicitanteOptions;
    }

    return this.solicitanteOptions.filter((item) =>
      [item.name, item.code, item.documentNumber].some((value) => value.toLowerCase().includes(search))
    );
  }

  get filteredCentroCostoOptions(): AlmacenCentroCostoOption[] {
    const search = this.centroCostoSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.centroCostoOptions;
    }

    return this.centroCostoOptions.filter((item) =>
      [item.description, item.code].some((value) => value.toLowerCase().includes(search))
    );
  }

  get filteredProveedorOptions(): ProviderRecord[] {
    const search = this.proveedorSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.proveedorOptions;
    }

    return this.proveedorOptions.filter((item) =>
      [item.name, item.ruc, String(item.code)].some((value) => value.toLowerCase().includes(search))
    );
  }

  get filteredMaterialOptions(): PedidoDetalleItemOption[] {
    const search = this.materialSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.itemOptions;
    }

    return this.itemOptions.filter((item) =>
      [item.description, item.code, item.groupDescription, item.unitDescription || '']
        .some((value) => value.toLowerCase().includes(search))
    );
  }

  get filteredUnidadOptions(): PedidoDetalleUnidadOption[] {
    const search = this.unidadSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.unidadOptions;
    }

    return this.unidadOptions.filter((item) =>
      [item.description, item.abbreviation, item.code].some((value) => value.toLowerCase().includes(search))
    );
  }

  get filteredCentrosCostoMaterialOptions(): AlmacenCentroCostoOption[] {
    const search = this.centrosCostoMaterialSearchControl.value.trim().toLowerCase();

    if (!search) {
      return this.centroCostoOptions;
    }

    return this.centroCostoOptions.filter((item) =>
      [item.description, item.code].some((value) => value.toLowerCase().includes(search))
    );
  }

  get selectedMaterialLabel(): string {
    const code = String(this.ingresoDirectoForm.controls['materialCode'].value || '').trim();
    return code || 'Seleccionar material';
  }

  get selectedUnidadLabel(): string {
    const code = String(this.ingresoDirectoForm.controls['unidadCode'].value || '').trim();
    return code || 'Seleccionar unidad';
  }

  get selectedCentroCostosMaterialLabel(): string {
    const selectedIds = (this.ingresoDirectoForm.controls['centrosCostoMaterialIds'].value as number[]) || [];

    if (!selectedIds.length) {
      return 'Seleccionar centros de costo';
    }

    const labels = this.centroCostoOptions
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.code);

    return labels.join(', ');
  }

  get salidaMaterialRows(): FormGroup[] {
    return this.salidaMaterialesForm.controls as FormGroup[];
  }

  get editorEyebrow(): string {
    return this.isEditMode ? 'Edicion' : 'Edicion';
  }

  get editorTitle(): string {
    if (this.isSalidaMode) {
      return this.isEditMode ? 'Editar salida' : 'Generar salida';
    }

    return this.isEditMode ? 'Editar ingreso directo' : 'Registrar ingreso directo';
  }

  get editorDescription(): string {
    return this.isSalidaMode
      ? 'Completa la informacion de la salida de almacen y confirma el material seleccionado.'
      : 'Completa la informacion del ingreso a almacen y selecciona materiales con sus centros de costo asociados.';
  }

  get materialsSectionDescription(): string {
    return this.isSalidaMode
      ? 'Selecciona el material, define la unidad y registra los datos de salida.'
      : 'Selecciona los materiales, define la unidad y registra los centros de costo asociados al ingreso.';
  }

  get editorSaveButtonText(): string {
    if (this.isSavingIngreso) {
      return 'Guardando...';
    }

    if (this.isSalidaMode) {
      return this.isEditMode ? 'Actualizar salida' : 'Generar salida';
    }

    return 'Guardar';
  }

  aplicarFiltros(): void {
    this.cargarListadoSeleccionado();
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      movimientoId: '',
      tipoIngreso: 0,
      estado: '',
      estadoAprobacion: this.getEstadoAprobacionListado()
    });
    this.globalSearch = '';
    this.cargarListadoSeleccionado();
  }

  onGlobalSearchChange(value: string): void {
    this.globalSearch = value;
    const totalItems = this.isListadoPendiente
      ? this.ordenesCompraPendientesAlmacen.length
      : this.filteredAlmacenes.length;
    const currentPageSize = this.pageSize;
    this.currentPage = normalizePaginationPage(1, totalItems, currentPageSize);
  }

  onPageChange(page: number): void {
    const totalItems = this.isListadoPendiente
      ? this.ordenesCompraPendientesAlmacen.length
      : this.filteredAlmacenes.length;
    const currentPageSize = this.pageSize;
    this.currentPage = normalizePaginationPage(page, totalItems, currentPageSize);
  }

  onListadoChange(): void {
    this.currentPage = 1;
    this.globalSearch = '';
    this.errorMessage = '';
    this.filtersForm.patchValue(
      {
        movimientoId: '',
        tipoIngreso: 0,
        estado: '',
        estadoAprobacion: this.getEstadoAprobacionListado()
      },
      { emitEvent: false }
    );
    this.cargarListadoSeleccionado();
  }

  ejecutarAccion(action: string): void {
    if (action === 'Ing. Directo') {
      this.abrirIngresoDirecto();
    }

  }

  generarSalidaItem(item: SalidaItemRow): void {
    if ((item.disponible ?? 0) <= 0) {
      this.snackBar.open('Stock Insuficiente', 'Cerrar', {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    this.abrirSalidaItem(item);
  }

  onSolicitanteSelectOpened(opened: boolean): void {
    if (!opened) {
      this.solicitanteSearchControl.setValue('', { emitEvent: false });
    }
  }

  onCentroCostoSelectOpened(opened: boolean): void {
    if (!opened) {
      this.centroCostoSearchControl.setValue('', { emitEvent: false });
    }
  }

  onProveedorSelectOpened(opened: boolean): void {
    if (opened && !this.proveedorOptions.length && !this.isLoadingCatalogos) {
      this.cargarCatalogosEditor();
    }

    if (!opened) {
      this.proveedorSearchControl.setValue('', { emitEvent: false });
    }
  }

  onCentroCostoMaterialSelectOpened(opened: boolean): void {
    if (!opened) {
      this.centrosCostoMaterialSearchControl.setValue('', { emitEvent: false });
    }
  }

  onMaterialSelectOpened(opened: boolean): void {
    if (!opened) {
      this.materialSearchControl.setValue('', { emitEvent: false });
    }
  }

  onUnidadSelectOpened(opened: boolean): void {
    if (!opened) {
      this.unidadSearchControl.setValue('', { emitEvent: false });
    }
  }

  onMaterialChange(materialIdRaw: number | string): void {
    const materialId = Number(materialIdRaw);
    const selectedItem = this.itemOptions.find((item) => item.id === materialId);

    if (!selectedItem) {
      this.ingresoDirectoForm.patchValue({
        materialId: 0,
        materialCode: '',
        materialDescription: '',
        unidadId: 0,
        unidadCode: '',
        unidadDescription: ''
      });
      return;
    }

    const unidadId = selectedItem.unitId ?? Number(selectedItem.unitCode || 0);
    const selectedUnit = this.unidadOptions.find((unit) =>
      unit.id === unidadId || unit.code === String(selectedItem.unitCode || '').trim()
    );

    this.ingresoDirectoForm.patchValue({
      materialId: selectedItem.id,
      materialCode: selectedItem.code,
      materialDescription: selectedItem.description,
      unidadId: selectedUnit?.id ?? unidadId ?? 0,
      unidadCode: selectedUnit?.code ?? selectedItem.unitCode ?? '',
      unidadDescription: selectedUnit?.description ?? selectedItem.unitDescription ?? ''
    });
  }

  onUnidadChange(unidadIdRaw: number | string): void {
    const unidadId = Number(unidadIdRaw);
    const selectedUnit = this.unidadOptions.find((unit) => unit.id === unidadId);

    if (!selectedUnit) {
      this.ingresoDirectoForm.patchValue({
        unidadId: 0,
        unidadCode: '',
        unidadDescription: ''
      });
      return;
    }

    this.ingresoDirectoForm.patchValue({
      unidadId: selectedUnit.id,
      unidadCode: selectedUnit.code,
      unidadDescription: selectedUnit.description
    });
  }

  guardarIngresoDirecto(): void {
    console.log('[Almacen][Generar consumo][Botón Guardar] datos del formulario:', {
      modo: this.isEditMode ? 'actualización' : 'registro',
      cabecera: this.ingresoDirectoForm.getRawValue(),
      materiales: this.salidaMaterialRows.map((row, index) => ({
        index,
        ...row.getRawValue()
      }))
    });

    if (this.isSalidaMode) {
      if (this.isEditMode) {
        this.actualizarSalidaDirecta();
        return;
      }

      this.guardarSalidaDirecta();
      return;
    }

    if (this.isEditMode) {
      this.actualizarIngresoDirecto();
      return;
    }

    if (this.ingresoDirectoForm.invalid) {
      this.ingresoDirectoForm.markAllAsTouched();
      const invalidControls = this.getInvalidIngresoDirectoControls();
      console.log('Almacen ingreso directo invalid controls', invalidControls);
      this.saveErrorMessage = `Completa los campos obligatorios para registrar el ingreso directo. Campos invalidos: ${invalidControls.join(', ')}`;
      return;
    }

    const cabeceraPayload = this.buildRegistrarIngresoAlmacenPayload();

    if (!cabeceraPayload) {
      return;
    }

    this.isSavingIngreso = true;
    this.saveErrorMessage = '';

    this.apiService.postRegistrarIngresoAlmacen(cabeceraPayload).subscribe({
      next: (cabeceraResponse: unknown) => {
        try {
          this.assertSuccessfulResponse(cabeceraResponse, 'No se pudo registrar la cabecera del ingreso a almacen.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo registrar la cabecera del ingreso a almacen.');
          return;
        }

        const movimientoId = this.extractAlmacenMovimientoIdFromResponse(cabeceraResponse);

        if (!movimientoId) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = 'Se registro la cabecera, pero no se pudo identificar el Alm_Mov_Id devuelto por el backend.';
          return;
        }

        const detallePayload = this.buildRegistrarIngresoAlmacenDetallePayload(movimientoId);

        if (!detallePayload) {
          this.isSavingIngreso = false;
          return;
        }

        const stockPayload = this.buildActualizarStockItemIngresoDirectoPayload(movimientoId, detallePayload);

        console.log('[Almacen][Ingreso directo][Guardar] payloads:', {
          cabeceraPayload,
          detallePayload,
          stockPayload
        });

        this.actualizarStockIngresoDirecto(stockPayload, () => {
          this.apiService.postRegistrarIngresoAlmacenDetalle(detallePayload).subscribe({
          next: (detalleResponse: unknown) => {
            try {
              this.assertSuccessfulResponse(detalleResponse, 'No se pudo registrar el detalle del ingreso a almacen.');
            } catch (error: unknown) {
              this.isSavingIngreso = false;
              this.saveErrorMessage = this.resolveErrorMessage(
                error,
                `Se registro el movimiento ${movimientoId}, pero no se pudo registrar el detalle del ingreso.`
              );
              return;
            }

            this.isSavingIngreso = false;
            this.filtersForm.patchValue({ movimientoId: movimientoId }, { emitEvent: false });
            this.globalSearch = '';
            this.showIngresoDirectoForm = false;
            this.saveErrorMessage = '';
            this.resetIngresoDirectoForm();
            this.cargarListadoSeleccionado();
          },
          error: (error: unknown) => {
            this.isSavingIngreso = false;
            this.saveErrorMessage = this.resolveErrorMessage(
              error,
              `Se registro el movimiento ${movimientoId}, pero no se pudo registrar el detalle del ingreso.`
            );
          }
          });
        });
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo registrar el ingreso a almacen.');
      }
    });
  }

  onSalidaMaterialChange(index: number, materialIdRaw: number | string): void {
    const row = this.getSalidaMaterialRow(index);
    const materialId = Number(materialIdRaw);
    const selectedItem = this.itemOptions.find((item) => item.id === materialId);

    if (!row) {
      return;
    }

    if (!selectedItem) {
      row.patchValue({
        materialId: 0,
        materialCode: '',
        materialDescription: '',
        unidadId: 0,
        unidadCode: '',
        unidadDescription: '',
        stockDisponible: 0,
        stockReservado: 0,
        stockTotal: 0
      });
      return;
    }

    const selectedUnit = this.unidadOptions.find((unit) => unit.id === selectedItem.unitId);
    const stockInfo = this.getSalidaStockInfo(selectedItem.id);

    row.patchValue({
      materialId: selectedItem.id,
      materialCode: selectedItem.code,
      materialDescription: selectedItem.description,
      unidadId: selectedUnit?.id ?? selectedItem.unitId ?? 0,
      unidadCode: selectedUnit?.code ?? selectedItem.unitCode ?? '',
      unidadDescription: selectedUnit?.description ?? selectedItem.unitDescription ?? '',
      stockDisponible: stockInfo.disponible,
      stockReservado: stockInfo.reservado,
      stockTotal: stockInfo.stockTotal
    });

    this.cargarStockSalidaMaterialRow(index);
  }

  onSalidaUnidadChange(index: number, unidadIdRaw: number | string): void {
    const row = this.getSalidaMaterialRow(index);
    const unidadId = Number(unidadIdRaw);
    const selectedUnit = this.unidadOptions.find((unit) => unit.id === unidadId);

    if (!row) {
      return;
    }

    if (!selectedUnit) {
      row.patchValue({
        unidadId: 0,
        unidadCode: '',
        unidadDescription: ''
      });
      return;
    }

    row.patchValue({
      unidadId: selectedUnit.id,
      unidadCode: selectedUnit.code,
      unidadDescription: selectedUnit.description
    });
  }

  agregarMaterialSalida(): void {
    this.salidaMaterialesForm.push(this.createSalidaMaterialGroup());
  }

  quitarMaterialSalida(index: number): void {
    if (this.salidaMaterialesForm.length <= 1) {
      return;
    }

    this.salidaMaterialesForm.removeAt(index);
  }

  private guardarSalidaDirecta(): void {
    if (this.salidaMaterialesForm.invalid) {
      this.salidaMaterialesForm.markAllAsTouched();
      this.saveErrorMessage = 'Completa los campos obligatorios para registrar la salida.';
      return;
    }

    const materialSinDisponible = this.getMaterialSalidaSinDisponible();

    if (materialSinDisponible) {
      this.mostrarStockInsuficiente(materialSinDisponible);
      return;
    }

    const cabeceraPayload = this.buildRegistrarSalidaAlmacenPayload();

    if (!cabeceraPayload) {
      return;
    }

    const salidaDetalles = this.buildSalidaDetalleDrafts();

    if (!salidaDetalles.length) {
      return;
    }

    const hasStockInsuficiente = salidaDetalles.some((detalle) =>
      detalle.cantidad > this.getStockDisponibleSalida(detalle.itemId)
    );

    if (hasStockInsuficiente) {
      this.mostrarStockInsuficiente(this.getPrimerMaterialSalidaConStockInsuficiente(salidaDetalles));
      return;
    }

    this.isSavingIngreso = true;
    this.saveErrorMessage = '';

    console.log('[Almacen][Salida][Guardar][POST /api/Almacen/postRegistrarIngresoAlmacen] payload:', cabeceraPayload);

    this.apiService.postRegistrarIngresoAlmacen(cabeceraPayload).subscribe({
      next: (cabeceraResponse: unknown) => {
        console.log('[Almacen][Salida][Guardar][POST /api/Almacen/postRegistrarIngresoAlmacen] response:', cabeceraResponse);

        try {
          this.assertSuccessfulResponse(cabeceraResponse, 'No se pudo registrar la cabecera de la salida de almacen.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo registrar la cabecera de la salida de almacen.');
          return;
        }

        const movimientoId = this.extractAlmacenMovimientoIdFromResponse(cabeceraResponse);

        if (!movimientoId) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = 'Se registro la cabecera, pero no se pudo identificar el Alm_Mov_Id devuelto por el backend.';
          return;
        }

        const detallePayloads = salidaDetalles.map((detalle) =>
          this.buildRegistrarSalidaAlmacenDetallePayload(movimientoId, detalle)
        );

        if (!detallePayloads.length || detallePayloads.some((detalle) => detalle === null)) {
          this.isSavingIngreso = false;
          return;
        }

        console.log('[Almacen][Salida][Guardar] payloads:', {
          cabeceraPayload,
          detallePayloads
        });

        this.registrarDetallesSalidaSecuencial(
          movimientoId,
          detallePayloads.filter((detalle): detalle is RegistrarIngresoAlmacenDetalleRequest => detalle !== null),
          0,
          () => {
            this.isSavingIngreso = false;
            this.filtersForm.patchValue({ movimientoId }, { emitEvent: false });
            this.globalSearch = '';
            this.showIngresoDirectoForm = false;
            this.isSalidaMode = false;
            this.salidaItemSeleccionado = null;
            this.saveErrorMessage = '';
            this.resetIngresoDirectoForm();
            this.resetSalidaMateriales();
            this.listadoControl.setValue('S', { emitEvent: false });
            this.cargarListadoSeleccionado();
          }
        );
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo registrar la salida de almacen.');
      }
    });
  }

  private actualizarSalidaDirecta(): void {
    if (this.salidaMaterialesForm.invalid) {
      this.salidaMaterialesForm.markAllAsTouched();
      this.saveErrorMessage = 'Completa los campos obligatorios para actualizar la salida.';
      return;
    }

    const materialSinDisponible = this.getMaterialSalidaSinDisponible();

    if (materialSinDisponible) {
      this.mostrarStockInsuficiente(materialSinDisponible);
      return;
    }

    const cabeceraPayload = this.buildActualizarIngresoAlmacenPayload();

    if (!cabeceraPayload) {
      return;
    }

    const salidaDetalles = this.buildSalidaDetalleDrafts();

    if (!salidaDetalles.length) {
      return;
    }

    const hasStockInsuficiente = salidaDetalles.some((detalle) => {
      const stockDisponible = this.getStockDisponibleSalida(detalle.itemId) + detalle.originalCantidad;
      return detalle.cantidad > stockDisponible;
    });

    if (hasStockInsuficiente) {
      this.mostrarStockInsuficiente(this.getPrimerMaterialSalidaConStockInsuficiente(salidaDetalles, true));
      return;
    }

    const detallePayloads = salidaDetalles.map((detalle) =>
      detalle.detalleId > 0
        ? this.buildActualizarSalidaAlmacenDetallePayload(detalle)
        : this.buildRegistrarSalidaAlmacenDetallePayload(cabeceraPayload.Alm_Mov_Id, detalle)
    );

    if (!detallePayloads.length || detallePayloads.some((detalle) => detalle === null)) {
      return;
    }

    this.isSavingIngreso = true;
    this.saveErrorMessage = '';

    console.log('[Almacen][Salida][Actualizar] payloads:', {
      cabeceraPayload,
      detallePayloads
    });

    console.log('[Almacen][Salida][Actualizar][PATCH /api/Almacen/patchActualizarIngresoAlmacen] payload:', cabeceraPayload);

    this.apiService.patchActualizarIngresoAlmacen(cabeceraPayload).subscribe({
      next: (cabeceraResponse: unknown) => {
        console.log('[Almacen][Salida][Actualizar][PATCH /api/Almacen/patchActualizarIngresoAlmacen] response:', cabeceraResponse);

        try {
          this.assertSuccessfulResponse(cabeceraResponse, 'No se pudo actualizar la cabecera de la salida de almacen.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar la cabecera de la salida de almacen.');
          return;
        }

        this.guardarDetallesSalidaActualizacionSecuencial(
          cabeceraPayload.Alm_Mov_Id,
          detallePayloads.filter(
            (detalle): detalle is RegistrarIngresoAlmacenDetalleRequest | ActualizarIngresoAlmacenDetalleRequest =>
              detalle !== null
          ),
          0,
          () => {
            this.isSavingIngreso = false;
            this.filtersForm.patchValue({ movimientoId: cabeceraPayload.Alm_Mov_Id }, { emitEvent: false });
            this.globalSearch = '';
            this.showIngresoDirectoForm = false;
            this.isSalidaMode = false;
            this.isEditMode = false;
            this.salidaItemSeleccionado = null;
            this.saveErrorMessage = '';
            this.clearPendingEditData();
            this.resetIngresoDirectoForm();
            this.resetSalidaMateriales();
            this.listadoControl.setValue('S', { emitEvent: false });
            this.cargarListadoSeleccionado();
          }
        );
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar la salida de almacen.');
      }
    });
  }

  cancelarIngresoDirecto(): void {
    this.showIngresoDirectoForm = false;
    this.isSalidaMode = false;
    this.salidaItemSeleccionado = null;
    this.isEditMode = false;
    this.saveErrorMessage = '';
    this.clearPendingEditData();
    this.resetIngresoDirectoForm();
  }

  abrirIngresoOrden(item: OrdenCompraPendienteAlmacenRow): void {
    console.log('Almacen ingresar orden - fila seleccionada:', item);
    this.errorMessage = '';
    this.saveErrorMessage = '';
    this.isLoadingEditor = true;
    this.showIngresoDirectoForm = false;
    this.showIngresoOrdenForm = true;
    this.isIngresoOrdenEditMode = false;
    this.ingresoOrdenMovimientoId = 0;
    this.ingresoOrdenSeleccionada = item;
    this.ingresoOrdenDetalles = [];
    this.ingresoOrdenUbicacionId = 1;
    this.ingresoOrdenGuiaRemitenteControl.setValue('');

    this.apiService.getListarCabeceraIngresoAlmacen(item.ordenCompraId).subscribe({
      next: (response: unknown) => {
        console.log('Almacen ingresar orden - cabecera response:', response);
        const record = this.extractRecords(response)[0] ?? null;
        const cabecera = record
          ? this.mapCabeceraIngresoOrden(record, item)
          : item;
        this.ingresoOrdenSeleccionada = cabecera;
        this.cargarDetalleIngresoOrden(cabecera, item);
      },
      error: (error: unknown) => {
        this.isLoadingEditor = false;
        this.saveErrorMessage = this.resolveErrorMessage(
          error,
          'No se pudo cargar la cabecera del ingreso a almacen.'
        );
      }
    });
  }

  cancelarIngresoOrden(): void {
    this.showIngresoOrdenForm = false;
    this.ingresoOrdenSeleccionada = null;
    this.ingresoOrdenDetalles = [];
    this.ingresoOrdenUbicacionId = 1;
    this.ingresoOrdenGuiaRemitenteControl.setValue('');
    this.saveErrorMessage = '';
    this.isIngresoOrdenEditMode = false;
    this.ingresoOrdenMovimientoId = 0;
  }

  trackByAlmacen(_: number, item: AlmacenRow): number {
    return item.id;
  }

  trackByOrdenCompraPendienteAlmacen(_: number, item: OrdenCompraPendienteAlmacenRow): number {
    return item.id;
  }

  trackByIngresoOrdenDetalle(_: number, item: IngresoOrdenDetalleRow): number {
    return item.id;
  }

  setCantidadIngresoDetalle(item: IngresoOrdenDetalleRow, value: string): void {
    const cantidad = Number(value);
    item.cantidadIngresar = value === '' || !Number.isFinite(cantidad) ? null : cantidad;
  }

  setSeleccionIngresoDetalle(item: IngresoOrdenDetalleRow, checked: boolean): void {
    item.seleccionado = checked;
  }

  get areAllIngresoOrdenDetallesSelected(): boolean {
    return this.ingresoOrdenDetalles.length > 0
      && this.ingresoOrdenDetalles.every((item) => item.seleccionado);
  }

  setSeleccionTodosIngresoOrdenDetalles(checked: boolean): void {
    this.ingresoOrdenDetalles = this.ingresoOrdenDetalles.map((item) => ({
      ...item,
      seleccionado: checked
    }));
  }

  setIngresoOrdenUbicacion(value: number): void {
    this.ingresoOrdenUbicacionId = Number(value) || 0;
  }

  getCantidadMaximaIngreso(item: IngresoOrdenDetalleRow): number {
    return this.isIngresoOrdenEditMode ? item.compra : item.pendiente;
  }

  get esIngresoOrdenServicio(): boolean {
    return this.ingresoOrdenSeleccionada
      ? this.esOrdenServicio(this.ingresoOrdenSeleccionada.tipo || this.ingresoOrdenSeleccionada.formaPago)
      : false;
  }

  setSerieIngresoDetalle(item: IngresoOrdenDetalleRow, value: string): void {
    item.serie = value;
  }

  setCostoUnitarioIngresoDetalle(item: IngresoOrdenDetalleRow, value: string): void {
    const costoUnitario = Number(value);
    item.costoUnitario = value === '' || !Number.isFinite(costoUnitario) ? null : costoUnitario;
  }

  get mostrarGuiaRemitenteIngresoOrden(): boolean {
    return !this.esIngresoOrdenServicio && !this.isIngresoOrdenEditMode;
  }

  guardarIngresoOrden(): void {
    if (this.isIngresoOrdenEditMode) {
      this.actualizarIngresoOrden();
      return;
    }

    const cabecera = this.ingresoOrdenSeleccionada;
    const detallePayloads = this.esIngresoOrdenServicio ? [] : this.buildActualizarPedidoDetalleIngresoAlmacenPayloads();
    const stockPayloads = this.esIngresoOrdenServicio ? [] : this.buildActualizarStockItemPayloads();

    console.log('[Almacen][Guardar ingreso por orden]', {
      cabecera,
      esIngresoOrdenServicio: this.esIngresoOrdenServicio,
      detallesGrilla: this.ingresoOrdenDetalles,
      detallePayloads,
      stockPayloads
    });

    if (!cabecera || (!this.esIngresoOrdenServicio && (!detallePayloads.length || !stockPayloads.length))) {
      return;
    }

    this.isSavingIngreso = true;
    this.saveErrorMessage = '';

    if (this.esIngresoOrdenServicio) {
      this.cambiarEstadoOrdenCompraIngresada(cabecera, () => {
        this.finalizarGuardadoIngresoOrden();
      });
      return;
    }

    const cabeceraPayload = this.buildRegistrarIngresoAlmacenOrdenCompraPayload();

    if (!cabeceraPayload) {
      this.isSavingIngreso = false;
      return;
    }

    this.actualizarStockIngresoOrden(stockPayloads, () => {
      this.cambiarEstadoOrdenCompraIngresada(cabecera, () => {
        this.registrarIngresoOrdenCompra(cabeceraPayload, detallePayloads);
      });
    });
  }

  private registrarIngresoOrdenCompra(
    cabeceraPayload: RegistrarIngresoAlmacenOrdenCompraRequest,
    detallePayloads: ActualizarPedidoDetalleIngresoAlmacenRequest[]
  ): void {
    this.apiService.postRegistrarIngresoAlmacenOrdenCompra(cabeceraPayload).subscribe({
      next: (cabeceraResponse: unknown) => {
        try {
          this.assertSuccessfulResponse(cabeceraResponse, 'No se pudo registrar el ingreso de almacen por orden de compra.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo registrar el ingreso de almacen por orden de compra.');
          return;
        }

        const movimientoId = this.extractAlmacenMovimientoIdFromResponse(cabeceraResponse);

        if (!movimientoId) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = 'Se registro la cabecera, pero no se pudo identificar el Alm_Mov_Id devuelto por el backend.';
          return;
        }

        const almacenDetallePayloads = this.buildRegistrarIngresoOrdenAlmacenDetallePayloads(movimientoId);

        console.log('[Almacen][Ingreso orden][Detalle almacen] payloads:', almacenDetallePayloads);

        if (!detallePayloads.length) {
          this.finalizarGuardadoIngresoOrden();
          return;
        }

        if (!almacenDetallePayloads.length) {
          this.isSavingIngreso = false;
          return;
        }

        this.registrarDetallesIngresoOrdenAlmacenSecuencial(almacenDetallePayloads, 0, () => {
          this.actualizarPedidoDetalleIngresoAlmacenSecuencial(detallePayloads, 0, () => {
            this.finalizarGuardadoIngresoOrden();
          });
        });
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo registrar el ingreso de almacen por orden de compra.');
      }
    });
  }

  private actualizarIngresoOrden(): void {
    if (this.esIngresoOrdenServicio) {
      this.finalizarGuardadoIngresoOrden();
      return;
    }

    const rowsSeleccionados = this.ingresoOrdenDetalles.filter((item) => item.seleccionado);
    console.log('[Almacen][Actualizar ingreso por orden][rows grilla]', this.ingresoOrdenDetalles);
    console.log('[Almacen][Actualizar ingreso por orden][rows seleccionados]', rowsSeleccionados);
    console.table(rowsSeleccionados.map((item) => ({
      id: item.id,
      almacenDetalleId: item.almacenDetalleId,
      pedidoDetalleId: item.pedidoDetalleId,
      itemId: item.itemId,
      itemCodigo: item.itemCodigo,
      itemDescripcion: item.itemDescripcion,
      unidadId: item.unidadId,
      centroCostoId: item.centroCostoId,
      cantidadIngresar: item.cantidadIngresar,
      serie: item.serie,
      costoUnitario: item.costoUnitario,
      compra: item.compra,
      ingresado: item.ingresado,
      pendiente: item.pendiente
    })));

    const detallePayloads = this.buildActualizarPedidoDetalleIngresoAlmacenPayloads();
    const detalleAlmacenPayloads = this.buildActualizarIngresoAlmacenDetalleOrdenCompraPayloads();
    const stockPayloads = this.buildActualizarStockItemPayloads();

    console.log('[Almacen][Actualizar ingreso por orden]', {
      cabecera: this.ingresoOrdenSeleccionada,
      detallesGrilla: this.ingresoOrdenDetalles,
      detallePayloads,
      detalleAlmacenPayloads,
      stockPayloads
    });

    if (!this.ingresoOrdenSeleccionada || !detallePayloads.length || !detalleAlmacenPayloads.length || !stockPayloads.length) {
      return;
    }

    this.isSavingIngreso = true;
    this.saveErrorMessage = '';

    this.actualizarStockIngresoOrden(stockPayloads, () => {
      this.actualizarPedidoDetalleIngresoAlmacenSecuencial(detallePayloads, 0, () => {
        this.actualizarDetallesIngresoOrdenAlmacenSecuencial(detalleAlmacenPayloads, 0, () => {
          this.finalizarGuardadoIngresoOrden();
        });
      });
    });
  }

  private actualizarStockIngresoOrden(stockPayloads: ActualizarStockItemRequest[], onSuccess: () => void): void {
    console.log('[Almacen][patchActualizarStockItem] payloads:', stockPayloads);

    if (!stockPayloads.length) {
      onSuccess();
      return;
    }

    this.actualizarStockIngresoOrdenSecuencial(stockPayloads, 0, onSuccess);
  }

  private cambiarEstadoOrdenCompraIngresada(cabecera: OrdenCompraPendienteAlmacenRow, onSuccess: () => void): void {
    const payload: CambiarEstadoOrdenCompraRequest = {
      Ord_Com_Id: cabecera.ordenCompraId,
      Flg_Alm: 'I'
    };

    console.log('Almacen ingreso orden - cambiar estado OC:', payload);

    this.apiService.patchCambiarEstadoOrdenCompra(payload).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo cambiar el estado de almacen de la orden de compra.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo cambiar el estado de almacen de la orden de compra.');
          return;
        }

        onSuccess();
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo cambiar el estado de almacen de la orden de compra.');
      }
    });
  }

  private finalizarGuardadoIngresoOrden(): void {
    this.isSavingIngreso = false;
    this.showIngresoOrdenForm = false;
    this.ingresoOrdenSeleccionada = null;
    this.ingresoOrdenDetalles = [];
    this.ingresoOrdenUbicacionId = 1;
    this.ingresoOrdenGuiaRemitenteControl.setValue('');
    this.saveErrorMessage = '';
    this.isIngresoOrdenEditMode = false;
    this.ingresoOrdenMovimientoId = 0;
    this.cargarListadoSeleccionado();
    window.dispatchEvent(new CustomEvent('process-notifications-refresh'));
  }

  trackBySolicitante(_: number, item: AlmacenSolicitanteOption): number {
    return item.id;
  }

  formatSolicitanteLabel(option: AlmacenSolicitanteOption): string {
    return option.name;
  }

  trackByCentroCosto(_: number, item: AlmacenCentroCostoOption): number {
    return item.id;
  }

  editarMovimiento(item: AlmacenRow): void {
    const isSalidaMovimiento = this.esMovimientoSalida(item);
    if (isSalidaMovimiento && !this.esUsuarioEditorSalida()) {
      this.snackBar.open('Solo los usuarios dayala y jmalasquez pueden editar movimientos de salida.', 'Cerrar', {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    if (this.esIngresoPorOrden(item)) {
      this.editarIngresoOrden(item);
      return;
    }

    this.errorMessage = '';
    this.saveErrorMessage = '';
    this.isLoadingEditor = true;
    this.showIngresoDirectoForm = true;
    this.showIngresoOrdenForm = false;
    this.isIngresoOrdenEditMode = false;
    this.isEditMode = true;
    this.isSalidaMode = isSalidaMovimiento;
    this.resetIngresoDirectoForm();
    this.isSalidaMode = isSalidaMovimiento;

    forkJoin({
      cabecera: this.apiService.getListarIngresoAlmacenModificar(item.movimientoId),
      detalle: this.apiService.getListarIngresoAlmacenDetalleModificar(item.movimientoId)
    }).subscribe({
      next: ({ cabecera, detalle }) => {
        console.log('getListarIngresoAlmacenModificar response', cabecera);
        const cabeceraRecord = this.extractRecords(cabecera)[0] ?? null;
        const detalleRecords = this.extractRecords(detalle);
        const detalleRecord = detalleRecords[0] ?? null;

        if (!cabeceraRecord && !detalleRecord) {
          this.isLoadingEditor = false;
          this.saveErrorMessage = 'No se encontraron datos para editar el ingreso seleccionado.';
          return;
        }

        this.pendingEditMovimientoId = item.movimientoId;
        this.pendingEditCabeceraRecord = cabeceraRecord;
        this.pendingEditDetalleRecords = detalleRecords;
        this.tryPatchPendingEditForm();
        this.isLoadingEditor = false;
      },
      error: (error: unknown) => {
        this.isLoadingEditor = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el ingreso seleccionado para editar.');
      }
    });
  }

  aprobarConsumoSalida(item: AlmacenRow): void {
    if (!this.validarEstadoConsumoPendiente(item)) {
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Despachar consumo',
        mensaje: `Se actualizara el stock del movimiento ${item.movimientoId}. ¿Deseas continuar?`,
        textoConfirmar: 'Despachar',
        textoCancelar: 'Cancelar',
        tipo: 'normal'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean | undefined) => {
      if (confirmado) {
        this.ejecutarDespachoSalida(item);
      }
    });
  }

  private ejecutarDespachoSalida(item: AlmacenRow): void {
    const payload: ActualizarStockItemSalidaRequest = {
      Alm_Mov_Id: item.movimientoId,
      Alm_Det_Itm_Id: 0,
      Can_Ing: 0
    };

    this.errorMessage = '';
    this.isLoadingAlmacen = true;
    console.log('[Almacen][Salida][Despachar consumo] payload:', payload);

    this.apiService.patchActualizarStockItemSalida(payload).subscribe({
      next: (response: unknown) => {
        this.isLoadingAlmacen = false;

        try {
          this.assertSuccessfulResponse(response, 'No se pudo despachar el consumo de salida.');
        } catch (error: unknown) {
          this.errorMessage = this.resolveErrorMessage(error, 'No se pudo despachar el consumo de salida.');
          return;
        }

        this.snackBar.open('Consumo despachado correctamente.', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.cargarListadoSeleccionado();
      },
      error: (error: unknown) => {
        this.isLoadingAlmacen = false;
        console.log('[Almacen][Salida][Despachar consumo] error:', error);
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo despachar el consumo de salida.');
      }
    });
  }

  rechazarConsumoSalida(item: AlmacenRow): void {
    if (!this.validarEstadoConsumoPendiente(item)) {
      return;
    }

    const dialogRef = this.dialog.open(PedidoRechazoDialogComponent, {
      width: '520px',
      disableClose: true,
      data: {
        titulo: 'Rechazar consumo',
        etiquetaMotivo: 'Motivo del rechazo',
        textoError: 'Ingresa el motivo del rechazo.',
        textoConfirmar: 'Guardar motivo'
      }
    });

    dialogRef.afterClosed().subscribe((result?: PedidoRechazoDialogResult) => {
      const motivo = String(result?.motivo || '').trim();

      if (!motivo) {
        return;
      }

      const payload: ActualizarMotivoRechazoAlmacenRequest = {
        Alm_Mov_Id: item.movimientoId,
        Alm_Mot_Rch: motivo
      };

      this.errorMessage = '';
      this.isLoadingAlmacen = true;
      console.log('[Almacen][Salida][Rechazar consumo] payload:', payload);

      this.apiService.patchActualizarMotivoRechazoAlmacen(payload).subscribe({
        next: (response: unknown) => {
          this.isLoadingAlmacen = false;

          try {
            this.assertSuccessfulResponse(response, 'No se pudo registrar el motivo del rechazo.');
          } catch (error: unknown) {
            this.errorMessage = this.resolveErrorMessage(error, 'No se pudo registrar el motivo del rechazo.');
            return;
          }

          this.snackBar.open('Consumo rechazado correctamente.', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.cargarListadoSeleccionado();
        },
        error: (error: unknown) => {
          this.isLoadingAlmacen = false;
          console.log('[Almacen][Salida][Rechazar consumo] error:', error);
          this.errorMessage = this.resolveErrorMessage(error, 'No se pudo registrar el motivo del rechazo.');
        }
      });
    });
  }

  anularConsumoSalida(item: AlmacenRow): void {
    if (!this.esEstadoConsumoDespachado(item)) {
      this.snackBar.open('Solo se puede anular un consumo que haya sido despachado.', 'Cerrar', {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmacionAccionDialogComponent, {
      width: '460px',
      disableClose: true,
      data: {
        titulo: 'Anular consumo',
        mensaje: `Se anulara el movimiento ${item.movimientoId} y se devolvera su stock. ¿Deseas continuar?`,
        textoConfirmar: 'Anular',
        textoCancelar: 'Cancelar',
        tipo: 'peligro'
      }
    });

    dialogRef.afterClosed().subscribe((confirmado: boolean | undefined) => {
      if (!confirmado) {
        return;
      }

      const payload: ActualizarStockItemSalidaRequest = {
        Alm_Mov_Id: item.movimientoId,
        Alm_Det_Itm_Id: 0,
        Can_Ing: 0
      };

      this.errorMessage = '';
      this.isLoadingAlmacen = true;
      console.log('[Almacen][Salida][Anular consumo] payload:', payload);

      this.apiService.patchActualizarStockItemSalidaAnulacion(payload).subscribe({
        next: (response: unknown) => {
          this.isLoadingAlmacen = false;

          try {
            this.assertSuccessfulResponse(response, 'No se pudo anular el consumo de salida.');
          } catch (error: unknown) {
            this.errorMessage = this.resolveErrorMessage(error, 'No se pudo anular el consumo de salida.');
            return;
          }

          this.snackBar.open('Consumo anulado correctamente.', 'Cerrar', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          this.cargarListadoSeleccionado();
        },
        error: (error: unknown) => {
          this.isLoadingAlmacen = false;
          console.log('[Almacen][Salida][Anular consumo] error:', error);
          this.errorMessage = this.resolveErrorMessage(error, 'No se pudo anular el consumo de salida.');
        }
      });
    });
  }

  esEstadoConsumoPendiente(item: AlmacenRow): boolean {
    const estado = String(item.estadoConsumo || '').trim().toLowerCase();
    return estado === 'pendiente' || estado === 'p';
  }

  esEstadoConsumoDespachado(item: AlmacenRow): boolean {
    const estado = String(item.estadoConsumo || '').trim().toLowerCase();
    return estado === 'despachado' || estado === 'd';
  }

  puedeEditarMovimiento(item: AlmacenRow): boolean {
    return !this.esMovimientoSalida(item) || this.esUsuarioEditorSalida();
  }

  private esUsuarioEditorSalida(): boolean {
    const currentUser = this.authService.getCurrentUser().trim().toLowerCase();
    return currentUser === 'dayala' || currentUser === 'jmalasquez';
  }

  private validarEstadoConsumoPendiente(item: AlmacenRow): boolean {
    if (this.esEstadoConsumoPendiente(item)) {
      return true;
    }

    this.snackBar.open('Solo se puede despachar o rechazar cuando el estado de consumo es Pendiente.', 'Cerrar', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return false;
  }

  private abrirIngresoDirecto(): void {
    this.errorMessage = '';
    this.saveErrorMessage = '';
    this.isSalidaMode = false;
    this.salidaItemSeleccionado = null;
    this.isEditMode = false;
    this.resetIngresoDirectoForm();
    this.showIngresoOrdenForm = false;
    this.ingresoOrdenSeleccionada = null;
    this.ingresoOrdenUbicacionId = 1;
    this.isIngresoOrdenEditMode = false;
    this.showIngresoDirectoForm = true;
  }

  abrirSalidaManual(): void {
    this.errorMessage = '';
    this.saveErrorMessage = '';
    this.isSalidaMode = true;
    this.salidaItemSeleccionado = null;
    this.isEditMode = false;
    this.resetIngresoDirectoForm();
    this.showIngresoOrdenForm = false;
    this.ingresoOrdenSeleccionada = null;
    this.ingresoOrdenUbicacionId = 1;
    this.isIngresoOrdenEditMode = false;
    this.showIngresoDirectoForm = true;
    this.resetSalidaMateriales();

    const currentUser = this.authService.getCurrentUser().trim();

    this.ingresoDirectoForm.patchValue({
      tipoIngresoTexto: 'Salida',
      solicitanteId: currentUser,
      centroCostoSolicitanteId: 0,
      materialId: 0,
      materialCode: '',
      materialDescription: '',
      unidadId: 0,
      unidadCode: '',
      unidadDescription: '',
      cantidad: 1,
      documentoNumero: '',
      fecha: this.getTodayDateValue()
    });

    this.ingresoDirectoForm.controls['solicitanteId'].enable({ emitEvent: false });
    this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].enable({ emitEvent: false });
    this.ingresoDirectoForm.controls['materialId'].enable({ emitEvent: false });
    this.ingresoDirectoForm.controls['unidadId'].enable({ emitEvent: false });
    this.cargarCentroCostoUsuarioSalida(currentUser);
  }

  abrirReporteSalidas(): void {
    const dialogRef = this.dialog.open<
      AlmacenSalidasReporteDialogComponent,
      { items: Array<{ id: number; code: string; description: string }> },
      AlmacenSalidaReporteDialogResult | undefined
    >(AlmacenSalidasReporteDialogComponent, {
      width: '680px',
      maxWidth: '95vw',
      data: {
        items: this.itemOptions
          .map((item) => ({
            id: item.id,
            code: item.code,
            description: item.description
          }))
          .sort((left, right) =>
            left.description.localeCompare(right.description, 'es', { sensitivity: 'base' })
          )
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.exportarReporteSalidas(result);
      }
    });
  }

  private exportarReporteSalidas(filters: AlmacenSalidaReporteDialogResult): void {
    const fechaInicio = formatDateRequestValue(filters.fechaInicio);
    const fechaFin = formatDateRequestValue(filters.fechaFin);

    if (!fechaInicio || !fechaFin) {
      this.snackBar.open('No se pudo identificar el rango de fechas del reporte.', 'Cerrar', {
        duration: 3500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    this.isExportingSalidas = true;

    this.apiService.getReporteListarSalidas(fechaInicio, fechaFin, filters.itemId).subscribe({
      next: (response: unknown) => {
        const rows = this.extractRecords(response)
          .map((item) => this.mapReporteSalidaRow(item))
          .filter((item): item is ReporteSalidaRow => item !== null);

        this.isExportingSalidas = false;

        if (!rows.length) {
          this.snackBar.open('No se encontraron salidas para los filtros seleccionados.', 'Cerrar', {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
          return;
        }

        this.descargarReporteSalidasExcel(rows, fechaInicio, fechaFin, filters.itemLabel);
      },
      error: (error: unknown) => {
        this.isExportingSalidas = false;
        this.snackBar.open(
          this.resolveErrorMessage(error, 'No se pudo generar el reporte de salidas.'),
          'Cerrar',
          {
            duration: 4500,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );
      }
    });
  }

  private mapReporteSalidaRow(item: DataRecord): ReporteSalidaRow | null {
    const fecha = this.getTextValue(item, ['Fec_Reg', 'fec_Reg', 'fecReg']);
    const solicitante = this.getTextValue(item, ['Usr_Nom', 'usr_Nom', 'usrNom']);
    const documento = this.getTextValue(item, ['Usr_Doc_Nro', 'usr_Doc_Nro', 'usrDocNro']);
    const itemDescripcion = this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes']);
    const unidad = this.getTextValue(item, ['Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr']);
    const cantidad = Number(this.findDataValue(item, 'Alm_Det_Can') ?? 0);

    if (!fecha && !solicitante && !documento && !itemDescripcion) {
      return null;
    }

    return {
      fecha: formatDisplayDate(fecha) || fecha || '-',
      solicitante: solicitante || '-',
      documento: documento || '-',
      item: itemDescripcion || '-',
      unidad: unidad || '-',
      cantidad: Number.isFinite(cantidad) ? cantidad : 0
    };
  }

  private descargarReporteSalidasExcel(
    rows: ReporteSalidaRow[],
    fechaInicio: string,
    fechaFin: string,
    itemLabel: string
  ): void {
    const headers = ['Fecha salida', 'Solicitante', 'Documento', 'Ítem', 'Unidad', 'Cantidad'];
    const body = rows
      .map((row) => `<Row>${[
        row.fecha,
        row.solicitante,
        row.documento,
        row.item,
        row.unidad,
        new Intl.NumberFormat('es-PE', { maximumFractionDigits: 3 }).format(row.cantidad)
      ].map((value) => this.buildReporteSalidaExcelCell(value)).join('')}</Row>`)
      .join('');
    const headerCells = headers
      .map((header) => this.buildReporteSalidaExcelCell(header, 'Header'))
      .join('');
    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#6F6B67" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="Default">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Reporte de salidas">
    <Table>
      <Row>${headerCells}</Row>
      ${body}
    </Table>
  </Worksheet>
</Workbook>`;
    const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const itemSuffix = this.sanitizeReporteSalidaFileName(itemLabel || 'todos');
    link.href = url;
    link.download = `reporte_salidas_${fechaInicio}_${fechaFin}_${itemSuffix}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private buildReporteSalidaExcelCell(value: string | number, styleId = 'Default'): string {
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${this.escapeReporteSalidaXml(value)}</Data></Cell>`;
  }

  private escapeReporteSalidaXml(value: string | number): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private sanitizeReporteSalidaFileName(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'todos';
  }

  private abrirSalidaItem(item: SalidaItemRow): void {
    this.errorMessage = '';
    this.saveErrorMessage = '';
    this.isSalidaMode = true;
    this.salidaItemSeleccionado = item;
    this.isEditMode = false;
    this.resetIngresoDirectoForm();
    this.showIngresoOrdenForm = false;
    this.ingresoOrdenSeleccionada = null;
    this.ingresoOrdenUbicacionId = 1;
    this.isIngresoOrdenEditMode = false;
    this.showIngresoDirectoForm = true;
    this.resetSalidaMateriales();

    const materialOption = this.itemOptions.find((option) => option.id === item.itemId);
    const unidadId = materialOption?.unitId ?? item.unidadId;
    const unidadOption = this.unidadOptions.find((option) => option.id === unidadId);
    const currentUser = this.authService.getCurrentUser().trim();

    this.ingresoDirectoForm.patchValue({
      tipoIngresoTexto: 'Salida',
      solicitanteId: currentUser,
      centroCostoSolicitanteId: 0,
      materialId: item.itemId,
      materialCode: materialOption?.code || item.itemCodigo,
      materialDescription: materialOption?.description || item.descripcion,
      unidadId: unidadOption?.id ?? unidadId ?? 0,
      unidadCode: unidadOption?.code || materialOption?.unitCode || item.unidadCodigo,
      unidadDescription: unidadOption?.description || materialOption?.unitDescription || item.unidadDescripcion,
      cantidad: 1,
      documentoNumero: '',
      fecha: this.getTodayDateValue()
    });

    this.ingresoDirectoForm.controls['solicitanteId'].enable({ emitEvent: false });
    this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].enable({ emitEvent: false });
    this.ingresoDirectoForm.controls['materialId'].disable({ emitEvent: false });
    this.ingresoDirectoForm.controls['unidadId'].disable({ emitEvent: false });
    this.patchSalidaMaterialRowFromValues(0, {
      materialId: item.itemId,
      materialCode: materialOption?.code || item.itemCodigo,
      materialDescription: materialOption?.description || item.descripcion,
      unidadId: unidadOption?.id ?? unidadId ?? 0,
      unidadCode: unidadOption?.code || materialOption?.unitCode || item.unidadCodigo,
      unidadDescription: unidadOption?.description || materialOption?.unitDescription || item.unidadDescripcion,
      stockDisponible: item.disponible,
      stockReservado: item.reservado,
      stockTotal: item.stock,
      cantidad: 1,
      fecha: this.getTodayDateValue()
    });
    this.cargarCentroCostoUsuarioSalida(currentUser);
  }

  private cargarCentroCostoUsuarioSalida(usrCod: string): void {
    if (!usrCod) {
      return;
    }

    this.apiService.getConsultaDatosUsuario({ Usr_Cod: usrCod }).subscribe({
      next: (response: unknown) => {
        const record = this.extractRecords(response)[0] ?? null;
        const centroCostoId = this.getNumberValue(record, [
          'Usr_Cen_Cos_Id',
          'usr_Cen_Cos_Id',
          'usrCenCosId',
          'Cen_Cos_Id',
          'cen_Cos_Id',
          'cenCosId'
        ]) ?? 0;

        if (centroCostoId > 0) {
          this.ingresoDirectoForm.patchValue({
            centroCostoSolicitanteId: centroCostoId
          });
          this.actualizarStocksSalidaMateriales();
        }

        console.log('[Almacen][Salida] Datos usuario solicitante:', {
          usrCod,
          response,
          centroCostoId
        });
      },
      error: (error: unknown) => {
        console.error('[Almacen][Salida] No se pudo consultar datos del usuario solicitante.', error);
      }
    });
  }

  private resetIngresoDirectoForm(): void {
    this.ingresoDirectoForm.controls['solicitanteId'].enable({ emitEvent: false });
    this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].enable({ emitEvent: false });
    this.ingresoDirectoForm.controls['materialId'].enable({ emitEvent: false });
    this.ingresoDirectoForm.controls['unidadId'].enable({ emitEvent: false });

    this.ingresoDirectoForm.reset({
      movimientoId: 'Auto',
      tipoIngresoTexto: 'Ingreso directo',
      ubicacion: '1',
      solicitanteId: '',
      proveedorId: 0,
      centroCostoSolicitanteId: 0,
      serie: '',
      costoUnitario: null,
      materialId: 0,
      materialCode: '',
      materialDescription: '',
      unidadId: 0,
      unidadCode: '',
      unidadDescription: '',
      cantidad: 1,
      documentoNumero: '',
      fecha: this.getTodayDateValue(),
      centrosCostoMaterialIds: []
    });
    this.solicitanteSearchControl.setValue('', { emitEvent: false });
    this.proveedorSearchControl.setValue('', { emitEvent: false });
    this.centroCostoSearchControl.setValue('', { emitEvent: false });
    this.centrosCostoMaterialSearchControl.setValue('', { emitEvent: false });
    this.currentEditDetalleId = 0;
    this.currentEditFlgEst = 'A';
  }

  private resetSalidaMateriales(): void {
    while (this.salidaMaterialesForm.length) {
      this.salidaMaterialesForm.removeAt(0);
    }

    this.salidaMaterialesForm.push(this.createSalidaMaterialGroup());
  }

  private createSalidaMaterialGroup(): FormGroup {
    return this.formBuilder.group({
      detalleId: [0],
      materialId: [0, Validators.required],
      materialCode: [''],
      materialDescription: [''],
      unidadId: [0, Validators.required],
      unidadCode: [''],
      unidadDescription: [''],
      stockDisponible: [{ value: 0, disabled: true }],
      stockReservado: [{ value: 0, disabled: true }],
      stockTotal: [{ value: 0, disabled: true }],
      cantidad: [1, [Validators.required, Validators.min(0.001)]],
      originalCantidad: [0],
      fecha: [this.getTodayDateValue(), Validators.required]
    });
  }

  private getSalidaMaterialRow(index: number): FormGroup | null {
    return (this.salidaMaterialesForm.at(index) as FormGroup | null) ?? null;
  }

  private patchSalidaMaterialRowFromValues(index: number, values: Record<string, unknown>): void {
    const row = this.getSalidaMaterialRow(index);

    if (!row) {
      return;
    }

    row.patchValue(values);
  }

  private clearPendingEditData(): void {
    this.pendingEditMovimientoId = null;
    this.pendingEditCabeceraRecord = null;
    this.pendingEditDetalleRecords = [];
  }

  private patchIngresoDirectoFormForEdit(
    movimientoId: number,
    cabeceraRecord: DataRecord | null,
    detalleRecords: DataRecord[]
  ): void {
    const detalleRecord = detalleRecords[0] ?? null;
    const sourceRecord = detalleRecord ?? cabeceraRecord ?? {};
    const ubicacion = this.resolveUbicacionCodigo(detalleRecord, cabeceraRecord);
    const solicitanteId = this.resolveSolicitanteId(detalleRecord, cabeceraRecord);
    const centroCostoSolicitanteId = this.resolveCentroCostoId(detalleRecord, cabeceraRecord);
    const materialOption = this.resolveItemOption(detalleRecord);
    const unidadOption = this.resolveUnidadOption(detalleRecord);
    const proveedorId = this.resolveProveedorId(detalleRecord, cabeceraRecord);
    this.currentEditDetalleId = this.getNumberValue(sourceRecord, ['Alm_Det_Id', 'alm_Det_Id', 'almDetId']) ?? 0;
    this.currentEditFlgEst = this.getTextValue(cabeceraRecord ?? sourceRecord, ['Flg_Est', 'flg_Est', 'flgEst']).toUpperCase() || 'A';
    const cantidad = this.getDecimalValue(sourceRecord, ['Alm_Det_Can', 'alm_Det_Can', 'almDetCan', 'Cantidad', 'cantidad']) ?? 1;
    const documentoNumero = this.getTextValue(sourceRecord, ['Alm_Det_Doc_Nro', 'alm_Det_Doc_Nro', 'almDetDocNro', 'Doc_Nro', 'doc_Nro', 'docNro']);
    const materialId = materialOption?.id ?? this.getNumberValue(sourceRecord, ['Alm_Det_Itm_Id', 'alm_Det_Itm_Id', 'almDetItmId', 'Itm_Id', 'itm_Id', 'itmId']) ?? 0;
    const materialCode = materialOption?.code
      || (materialId > 0 ? String(materialId) : '');
    const materialDescription = materialOption?.description
      || this.getTextValue(sourceRecord, ['Itm_Des', 'itm_Des', 'itmDes', 'Material', 'material']);
    const unidadId = unidadOption?.id ?? this.getNumberValue(sourceRecord, ['Alm_Det_Uni_Med_Id', 'alm_Det_Uni_Med_Id', 'almDetUniMedId', 'Uni_Med_Id', 'uni_Med_Id', 'uniMedId']) ?? 0;
    const unidadCode = unidadOption?.code
      || this.getTextValue(sourceRecord, ['Uni_Med_Cod', 'uni_Med_Cod', 'uniMedCod'])
      || (unidadId > 0 ? String(unidadId) : '');
    const unidadDescription = unidadOption?.description
      || this.getTextValue(sourceRecord, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'Unidad', 'unidad']);
    const salidaStockInfo = this.getSalidaStockInfo(materialId);
    const serieCabecera = this.getTextValue(cabeceraRecord ?? {}, ['Alm_Ser', 'alm_Ser', 'almSer']);
    const serieDetalle = this.getTextValue(detalleRecord ?? {}, ['Alm_Ser', 'alm_Ser', 'almSer']);
    const serie = this.isSalidaMode
      ? (serieCabecera || serieDetalle)
      : (serieDetalle || serieCabecera);
    const costoUnitario = this.getDecimalValue(detalleRecord ?? {}, [
      'Alm_Cos_Unit', 'alm_Cos_Unit', 'almCosUnit',
      'Alm_Cost_Unit', 'alm_Cost_Unit', 'almCostUnit'
    ]);

    this.ingresoDirectoForm.patchValue({
      movimientoId: String(movimientoId),
      tipoIngresoTexto: this.getTextValue(cabeceraRecord ?? sourceRecord, ['Ing_Des', 'ing_Des', 'ingDes']) || 'Ingreso directo',
      ubicacion,
      solicitanteId,
      proveedorId,
      centroCostoSolicitanteId,
      serie,
      costoUnitario,
      materialId,
      materialCode,
      materialDescription,
      unidadId,
      unidadCode,
      unidadDescription,
      cantidad,
      documentoNumero,
      fecha: this.parseDateValue(this.getTextValue(sourceRecord, ['Alm_Det_Fec', 'alm_Det_Fec', 'almDetFec', 'Fec_Reg', 'fec_Reg', 'fecReg']))
    });

    if (this.isSalidaMode) {
      this.ingresoDirectoForm.controls['solicitanteId'].enable({ emitEvent: false });
      this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].enable({ emitEvent: false });
      while (this.salidaMaterialesForm.length) {
        this.salidaMaterialesForm.removeAt(0);
      }

      const salidaDetalleRecords = detalleRecords.length ? detalleRecords : [sourceRecord];

      salidaDetalleRecords.forEach((record, index) => {
        const recordMaterialOption = this.resolveItemOption(record);
        const recordUnidadOption = this.resolveUnidadOption(record);
        const recordDetalleId = this.getNumberValue(record, ['Alm_Det_Id', 'alm_Det_Id', 'almDetId']) ?? 0;
        const recordCantidad = this.getDecimalValue(record, ['Alm_Det_Can', 'alm_Det_Can', 'almDetCan', 'Cantidad', 'cantidad']) ?? 1;
        const recordMaterialId = recordMaterialOption?.id
          ?? this.getNumberValue(record, ['Alm_Det_Itm_Id', 'alm_Det_Itm_Id', 'almDetItmId', 'Itm_Id', 'itm_Id', 'itmId'])
          ?? 0;
        const recordMaterialCode = recordMaterialOption?.code || (recordMaterialId > 0 ? String(recordMaterialId) : '');
        const recordMaterialDescription = recordMaterialOption?.description
          || this.getTextValue(record, ['Itm_Des', 'itm_Des', 'itmDes', 'Material', 'material']);
        const recordUnidadId = recordUnidadOption?.id
          ?? this.getNumberValue(record, ['Alm_Det_Uni_Med_Id', 'alm_Det_Uni_Med_Id', 'almDetUniMedId', 'Uni_Med_Id', 'uni_Med_Id', 'uniMedId'])
          ?? 0;
        const recordUnidadCode = recordUnidadOption?.code
          || this.getTextValue(record, ['Uni_Med_Cod', 'uni_Med_Cod', 'uniMedCod'])
          || (recordUnidadId > 0 ? String(recordUnidadId) : '');
        const recordUnidadDescription = recordUnidadOption?.description
          || this.getTextValue(record, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'Unidad', 'unidad']);
        const recordSalidaStockInfo = this.getSalidaStockInfo(recordMaterialId);

        this.salidaMaterialesForm.push(this.createSalidaMaterialGroup());
        this.patchSalidaMaterialRowFromValues(index, {
          detalleId: recordDetalleId,
          materialId: recordMaterialId,
          materialCode: recordMaterialCode,
          materialDescription: recordMaterialDescription,
          unidadId: recordUnidadId,
          unidadCode: recordUnidadCode,
          unidadDescription: recordUnidadDescription,
          stockDisponible: recordSalidaStockInfo.disponible,
          stockReservado: recordSalidaStockInfo.reservado,
          stockTotal: recordSalidaStockInfo.stockTotal,
          cantidad: recordCantidad,
          originalCantidad: recordCantidad,
          fecha: this.parseDateValue(this.getTextValue(record, ['Alm_Det_Fec', 'alm_Det_Fec', 'almDetFec', 'Fec_Reg', 'fec_Reg', 'fecReg']))
        });
        this.cargarStockSalidaMaterialRow(index);
      });
    }
  }

  private tryPatchPendingEditForm(): void {
    if (!this.isEditMode || !this.pendingEditMovimientoId) {
      return;
    }

    this.patchIngresoDirectoFormForEdit(
      this.pendingEditMovimientoId,
      this.pendingEditCabeceraRecord,
      this.pendingEditDetalleRecords
    );

    const solicitanteId = String(this.ingresoDirectoForm.controls['solicitanteId'].value || '').trim();

    if (solicitanteId) {
      this.clearPendingEditData();
    }
  }

  private cargarMovimientos(): void {
    this.isLoadingAlmacen = true;
    this.errorMessage = '';
    this.ordenesCompraPendientesAlmacen = [];

    this.apiService.getListarIngresoAlmacen(this.getFiltros()).subscribe({
      next: (response: unknown) => {
        this.almacenes = this.extractRecords(response)
          .map((item, index) => this.mapAlmacen(item, index))
          .filter((item): item is AlmacenRow => item !== null);
        this.currentPage = normalizePaginationPage(this.currentPage, this.filteredAlmacenes.length, this.pageSize);
        this.isLoadingAlmacen = false;
      },
      error: (error: unknown) => {
        this.almacenes = [];
        this.currentPage = 1;
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el listado de ingresos de almacen.');
        this.isLoadingAlmacen = false;
      }
    });
  }

  private cargarOrdenesCompraPendientesAlmacen(): void {
    this.isLoadingAlmacen = true;
    this.errorMessage = '';
    this.almacenes = [];

    this.apiService.getListarOrdenCompraPendienteAlmacen({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.ordenesCompraPendientesAlmacen = this.extractRecords(response)
          .map((item, index) => this.mapOrdenCompraPendienteAlmacen(item, index))
          .filter((item): item is OrdenCompraPendienteAlmacenRow => item !== null);
        this.currentPage = normalizePaginationPage(
          this.currentPage,
          this.ordenesCompraPendientesAlmacen.length,
          this.pageSize
        );
        this.isLoadingAlmacen = false;
      },
      error: (error: unknown) => {
        this.ordenesCompraPendientesAlmacen = [];
        this.currentPage = 1;
        this.errorMessage = this.resolveErrorMessage(
          error,
          'No se pudo cargar el listado de ordenes de compra pendientes para almacen.'
        );
        this.isLoadingAlmacen = false;
      }
    });
  }

  private cargarListadoSeleccionado(): void {
    if (this.isListadoPendiente) {
      this.cargarOrdenesCompraPendientesAlmacen();
      return;
    }

    this.cargarMovimientos();
  }

  private cargarItemsSalida(): void {
    this.isLoadingAlmacen = true;
    this.errorMessage = '';
    this.salidaItems = [];

    this.apiService.getListarItem({ Flg_Est: 'A' }).subscribe({
      next: (response: unknown) => {
        this.salidaItems = this.extractRecords(response)
          .map((item) => this.mapSalidaItem(item))
          .filter((item): item is SalidaItemRow => item !== null);
        this.currentPage = normalizePaginationPage(this.currentPage, this.salidaItems.length, this.salidaPageSize);
        this.isLoadingAlmacen = false;
      },
      error: (error: unknown) => {
        this.salidaItems = [];
        this.currentPage = 1;
        this.errorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el listado de items para salida.');
        this.isLoadingAlmacen = false;
      }
    });
  }

  private cargarDetalleIngresoOrden(
    cabecera: OrdenCompraPendienteAlmacenRow,
    fallback?: OrdenCompraPendienteAlmacenRow
  ): void {
    if (this.esOrdenServicio(cabecera.tipo || cabecera.formaPago || fallback?.tipo || fallback?.formaPago || '')) {
      this.ingresoOrdenDetalles = [];
      this.isLoadingEditor = false;
      return;
    }

    const pedCabId = cabecera.pedidoId || fallback?.pedidoId || 0;
    const ordComId = cabecera.ordenCompraId || fallback?.ordenCompraId || 0;

    console.log('Almacen ingresar orden - detalle request:', {
      Ped_Cab_Id: pedCabId,
      Ord_Com_Id: ordComId,
      cabecera,
      fallback
    });

    if (!pedCabId || !ordComId) {
      this.ingresoOrdenDetalles = [];
      this.isLoadingEditor = false;
      this.saveErrorMessage = 'No se pudo identificar el pedido asociado a la orden seleccionada.';
      return;
    }

    this.apiService.getListarDetalleIngresoAlmacen(pedCabId, ordComId).subscribe({
      next: (response: unknown) => {
        console.log('Almacen ingresar orden - detalle response:', response);
        const detalleRecords = this.extractRecords(response);
        console.log('[Almacen][Detalle ingreso orden][records antes de mapear]', detalleRecords);
        console.log('[Almacen][Detalle ingreso orden][keys por registro]', detalleRecords.map((item) => Object.keys(item)));

        if (!this.isIngresoOrdenEditMode || !this.ingresoOrdenMovimientoId) {
          this.aplicarDetalleIngresoOrden(detalleRecords);
          return;
        }

        this.apiService.getListarIngresoAlmacenDetalleModificar(this.ingresoOrdenMovimientoId).subscribe({
          next: (detalleAlmacenResponse: unknown) => {
            const detalleAlmacenRecords = this.extractRecords(detalleAlmacenResponse);
            const detalleCombinado = detalleRecords.map((detallePedido) => {
              const almacenDetalleId = this.getNumberValue(detallePedido, ['Alm_Det_Id', 'alm_Det_Id', 'almDetId']) ?? 0;
              const itemId = this.getNumberValue(detallePedido, ['Ped_Cod_Itm', 'ped_Cod_Itm', 'pedCodItm', 'Itm_Id', 'itm_Id', 'itmId']) ?? 0;
              const detalleAlmacen = detalleAlmacenRecords.find((detalle) => {
                const detalleId = this.getNumberValue(detalle, ['Alm_Det_Id', 'alm_Det_Id', 'almDetId']) ?? 0;
                const detalleItemId = this.getNumberValue(detalle, ['Alm_Det_Itm_Id', 'alm_Det_Itm_Id', 'almDetItmId']) ?? 0;
                return (almacenDetalleId > 0 && detalleId === almacenDetalleId)
                  || (itemId > 0 && detalleItemId === itemId);
              });

              return detalleAlmacen ? { ...detallePedido, ...detalleAlmacen } : detallePedido;
            });

            this.aplicarDetalleIngresoOrden(detalleCombinado);
          },
          error: () => this.aplicarDetalleIngresoOrden(detalleRecords)
        });
      },
      error: (error: unknown) => {
        this.ingresoOrdenDetalles = [];
        this.isLoadingEditor = false;
        this.saveErrorMessage = this.resolveErrorMessage(
          error,
          'No se pudo cargar el detalle del ingreso a almacen.'
        );
      }
    });
  }

  private aplicarDetalleIngresoOrden(detalleRecords: DataRecord[]): void {
    this.ingresoOrdenDetalles = detalleRecords
      .map((item, index) => this.mapIngresoOrdenDetalle(item, index))
      .filter((item): item is IngresoOrdenDetalleRow => item !== null);
    console.log('[Almacen][Detalle ingreso orden][grilla mapeada]', this.ingresoOrdenDetalles);
    this.isLoadingEditor = false;
  }

  private cargarCatalogosEditor(): void {
    this.isLoadingCatalogos = true;
    let pendingRequests = 6;
    const finishRequest = () => {
      pendingRequests -= 1;

      if (pendingRequests <= 0) {
        this.isLoadingCatalogos = false;
      }
    };

    this.apiService.getListarUsuarioActivo({ Flg_Est: 'A' }).pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (response: unknown) => {
        this.solicitanteOptions = this.extractRecords(response)
          .map((item) => this.mapSolicitanteOption(item))
          .filter((item): item is AlmacenSolicitanteOption => item !== null);
        this.refrescarGridAlmacenConCatalogos();
        this.tryPatchPendingEditForm();
        finishRequest();
      },
      error: () => {
        this.solicitanteOptions = [];
        this.refrescarGridAlmacenConCatalogos();
        finishRequest();
      }
    });

    this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }).pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (response: unknown) => {
        this.centroCostoOptions = this.extractRecords(response)
          .map((item) => this.mapCentroCostoOption(item))
          .filter((item): item is AlmacenCentroCostoOption => item !== null);
        this.refrescarGridAlmacenConCatalogos();
        this.tryPatchPendingEditForm();
        finishRequest();
      },
      error: () => {
        this.centroCostoOptions = [];
        this.refrescarGridAlmacenConCatalogos();
        finishRequest();
      }
    });

    this.apiService.getListarItem({ Flg_Est: 'A' }).pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (response: unknown) => {
        const itemRecords = this.extractRecords(response);
        this.itemOptions = itemRecords
          .map((item) => this.mapItemOption(item))
          .filter((item): item is PedidoDetalleItemOption => item !== null);
        this.salidaItems = itemRecords
          .map((item) => this.mapSalidaItem(item))
          .filter((item): item is SalidaItemRow => item !== null);
        this.refrescarGridAlmacenConCatalogos();
        this.tryPatchPendingEditForm();
        finishRequest();
      },
      error: () => {
        this.itemOptions = [];
        this.salidaItems = [];
        this.refrescarGridAlmacenConCatalogos();
        finishRequest();
      }
    });

    this.apiService.getListarUnidadMedida({ Flg_Est: 'A' }).pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (response: unknown) => {
        this.unidadOptions = this.extractRecords(response)
          .map((item) => this.mapUnidadOption(item))
          .filter((item): item is PedidoDetalleUnidadOption => item !== null);
        this.refrescarGridAlmacenConCatalogos();
        this.tryPatchPendingEditForm();
        finishRequest();
      },
      error: () => {
        this.unidadOptions = [];
        this.refrescarGridAlmacenConCatalogos();
        finishRequest();
      }
    });

    this.apiService.getListarProveedorActivo({ Flg_Est: 'A' }).pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (response: unknown) => {
        this.proveedorOptions = this.extractRecords(response)
          .map((item) => this.mapProveedorOption(item))
          .filter((item): item is ProviderRecord => item !== null);
        this.tryPatchPendingEditForm();
        finishRequest();
      },
      error: () => {
        this.proveedorOptions = [];
        finishRequest();
      }
    });

    this.apiService.getListarUbicacionActivo({ Flg_Est: 'A' }).pipe(
      catchError(() => of([]))
    ).subscribe({
      next: (response: unknown) => {
        this.ubicacionIngresoOrdenOptions = this.extractRecords(response)
          .map((item) => this.mapUbicacionOption(item))
          .filter((item): item is CatalogoNumeroOption => item !== null);
        finishRequest();
      },
      error: () => {
        this.ubicacionIngresoOrdenOptions = [];
        finishRequest();
      }
    });
  }

  private esIngresoPorOrden(item: AlmacenRow): boolean {
    if (this.esMovimientoSalida(item)) {
      return false;
    }

    const tipoIngreso = item.tipoIngreso.trim().toLowerCase();
    return item.tipoIngresoId > 1 || tipoIngreso.includes('orden');
  }

  private esMovimientoSalida(item: AlmacenRow): boolean {
    return item.tipoIngresoId === 4 || item.tipoIngreso.trim().toLowerCase().includes('salida');
  }

  private esOrdenServicio(tipo: string): boolean {
    return tipo.trim().toLowerCase().includes('servicio');
  }

  private mapAlmacenRowToIngresoOrdenFallback(item: AlmacenRow): OrdenCompraPendienteAlmacenRow {
    return {
      id: item.ordenCompraId || item.movimientoId,
      ordenCompraId: item.ordenCompraId,
      pedidoId: item.pedidoId,
      numeroOrden: item.ordenCompraId ? this.formatNumeroIngresoOrden(item.ordenCompraId, item.tipoIngreso) : '-',
      pedidoCodigo: this.formatPedidoCodigo(item.pedidoId),
      tipo: item.tipoIngreso,
      fecha: item.fechaRegistro,
      proveedorId: 0,
      proveedor: '-',
      proveedorRuc: '-',
      formaPago: item.tipoIngreso,
      refObra: '-',
      referencia: '-',
      total: 0,
      estado: item.estadoAprobacion
    };
  }

  private editarIngresoOrden(item: AlmacenRow): void {
    this.errorMessage = '';
    this.saveErrorMessage = '';
    this.isLoadingEditor = true;
    this.showIngresoDirectoForm = false;
    this.showIngresoOrdenForm = true;
    this.isIngresoOrdenEditMode = true;
    this.ingresoOrdenMovimientoId = item.movimientoId;
    this.isEditMode = false;
    this.ingresoOrdenDetalles = [];
    this.ingresoOrdenUbicacionId = item.ubicacionId || 1;

    const fallback: OrdenCompraPendienteAlmacenRow = this.mapAlmacenRowToIngresoOrdenFallback(item);
    this.ingresoOrdenSeleccionada = fallback;

    this.apiService.getListarIngresoAlmacenModificar(item.movimientoId).subscribe({
      next: (response: unknown) => {
        console.log('Almacen editar ingreso por orden - cabecera almacen response:', response);
        const record = this.extractRecords(response)[0] ?? null;
        const ordenCompraId = record
          ? this.getNumberValue(record, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId']) ?? fallback.ordenCompraId
          : fallback.ordenCompraId;
        const pedidoId = record
          ? this.getNumberValue(record, ['Ped_Id', 'ped_Id', 'pedId', 'Ped_Cab_Id', 'ped_Cab_Id', 'pedCabId']) ?? fallback.pedidoId
          : fallback.pedidoId;
        const ubicacionId = record
          ? this.getNumberValue(record, ['Alm_Ubi', 'alm_Ubi', 'almUbi']) ?? this.ingresoOrdenUbicacionId
          : this.ingresoOrdenUbicacionId;

        this.ingresoOrdenUbicacionId = ubicacionId || 1;

        if (!ordenCompraId || !pedidoId) {
          this.isLoadingEditor = false;
          this.saveErrorMessage = 'No se pudo identificar la orden de compra o el pedido asociado al ingreso.';
          return;
        }

        const fallbackConIds: OrdenCompraPendienteAlmacenRow = {
          ...fallback,
          id: ordenCompraId,
          ordenCompraId,
          pedidoId,
          numeroOrden: this.formatNumeroIngresoOrden(ordenCompraId, fallback.tipo),
          pedidoCodigo: this.formatPedidoCodigo(pedidoId)
        };

        this.apiService.getListarCabeceraIngresoAlmacen(ordenCompraId).subscribe({
          next: (cabeceraResponse: unknown) => {
            console.log('Almacen editar ingreso por orden - cabecera OC response:', cabeceraResponse);
            const cabeceraRecord = this.extractRecords(cabeceraResponse)[0] ?? null;
            const cabecera = cabeceraRecord
              ? this.mapCabeceraIngresoOrden(cabeceraRecord, fallbackConIds)
              : fallbackConIds;
            this.ingresoOrdenSeleccionada = {
              ...cabecera,
              pedidoId: cabecera.pedidoId || pedidoId,
              ordenCompraId: cabecera.ordenCompraId || ordenCompraId
            };
            this.cargarDetalleIngresoOrden(this.ingresoOrdenSeleccionada, fallbackConIds);
          },
          error: (error: unknown) => {
            this.isLoadingEditor = false;
            this.saveErrorMessage = this.resolveErrorMessage(
              error,
              'No se pudo cargar la cabecera de la orden asociada al ingreso.'
            );
          }
        });
      },
      error: (error: unknown) => {
        this.isLoadingEditor = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo cargar el ingreso por orden seleccionado.');
      }
    });
  }

  private getFiltros(): AlmacenFiltro {
    const movimientoId = Number(this.filtersForm.controls['movimientoId'].value);
    const tipoIngreso = Number(this.filtersForm.controls['tipoIngreso'].value);
    const estado = String(this.filtersForm.controls['estado'].value || '').trim();
    const estadoAprobacion = this.getEstadoAprobacionListado();
    const filtros: AlmacenFiltro = {
      Alm_Mov_Id: 0,
      Alm_Tip_Ing: 0
    };

    if (Number.isInteger(movimientoId) && movimientoId > 0) {
      filtros.Alm_Mov_Id = movimientoId;
    }

    if (Number.isInteger(tipoIngreso) && tipoIngreso > 0) {
      filtros.Alm_Tip_Ing = tipoIngreso;
    }

    if (estado) {
      filtros.Flg_Est = estado;
    }

    if (estadoAprobacion) {
      filtros.Flg_Est_Apr = estadoAprobacion;
    }

    return filtros;
  }

  private getEstadoAprobacionListado(): string {
    if (this.isListadoIngresado) {
      return 'I';
    }

    if (this.isListadoSalida) {
      return 'S';
    }

    return '';
  }

  private buildRegistrarIngresoAlmacenPayload(): RegistrarIngresoAlmacenRequest | null {
    const solicitante = this.getSelectedSolicitante();
    const centroCostoId = Number(this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].value);
    const ubicacion = Number(this.ingresoDirectoForm.controls['ubicacion'].value);
    const currentUser = this.getCurrentOperator();

    if (!solicitante) {
      this.saveErrorMessage = 'Selecciona un solicitante valido para registrar el ingreso.';
      return null;
    }

    if (!solicitante.code) {
      this.saveErrorMessage = 'El solicitante seleccionado no tiene codigo asociado para registrar el ingreso.';
      return null;
    }

    if (!Number.isInteger(centroCostoId) || centroCostoId <= 0) {
      this.saveErrorMessage = 'Selecciona un centro de costo valido para el solicitante.';
      return null;
    }

    if (!Number.isInteger(ubicacion) || ubicacion <= 0) {
      this.saveErrorMessage = 'Selecciona una ubicacion valida para registrar el ingreso.';
      return null;
    }

    return {
      Alm_Ubi: ubicacion,
      Alm_Tip_Ing: 1,
      Alm_Sol_Dni: solicitante.code,
      Alm_Cen_Cos: centroCostoId,
      Usr_Reg: currentUser
    };
  }

  private buildRegistrarIngresoAlmacenOrdenCompraPayload(): RegistrarIngresoAlmacenOrdenCompraRequest | null {
    const cabecera = this.ingresoOrdenSeleccionada;
    const ubicacion = Number(this.ingresoOrdenUbicacionId);
    const currentUser = this.getCurrentOperator();
    const guiaRemitente = this.ingresoOrdenGuiaRemitenteControl.value.trim() || null;

    if (!cabecera) {
      this.saveErrorMessage = 'No se encontro la orden de compra seleccionada para registrar el ingreso.';
      return null;
    }

    if (!Number.isInteger(ubicacion) || ubicacion <= 0) {
      this.saveErrorMessage = 'Selecciona una ubicacion valida para registrar el ingreso.';
      return null;
    }

    if (!Number.isInteger(cabecera.ordenCompraId) || cabecera.ordenCompraId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar la orden de compra seleccionada.';
      return null;
    }

    if (!Number.isInteger(cabecera.pedidoId) || cabecera.pedidoId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el pedido asociado a la orden de compra.';
      return null;
    }

    const tipoIngreso = this.esOrdenServicio(cabecera.tipo || cabecera.formaPago) ? 3 : 2;

    return {
      Alm_Ubi: ubicacion,
      Alm_Tip_Ing: tipoIngreso,
      Usr_Reg: currentUser,
      Ord_Com_Id: cabecera.ordenCompraId,
      Ped_Id: cabecera.pedidoId,
      Alm_Gui_Rem: guiaRemitente
    };
  }

  private buildActualizarPedidoDetalleIngresoAlmacenPayloads(): ActualizarPedidoDetalleIngresoAlmacenRequest[] {
    const cabecera = this.ingresoOrdenSeleccionada;
    const seleccionados = this.ingresoOrdenDetalles.filter((item) => item.seleccionado);

    if (!cabecera) {
      this.saveErrorMessage = 'No se encontro la orden de compra seleccionada para actualizar el detalle.';
      return [];
    }

    if (!seleccionados.length) {
      this.saveErrorMessage = 'Selecciona al menos un producto para registrar el ingreso.';
      return [];
    }

    const detalleSinId = seleccionados.find((item) => !Number.isInteger(item.pedidoDetalleId) || item.pedidoDetalleId <= 0);
    if (detalleSinId) {
      this.saveErrorMessage = `El producto ${detalleSinId.itemDescripcion} no tiene Ped_Det_Id para actualizar el pedido.`;
      return [];
    }

    const detalleSinCantidad = seleccionados.find((item) => !Number.isFinite(item.cantidadIngresar) || Number(item.cantidadIngresar) <= 0);
    if (detalleSinCantidad) {
      this.saveErrorMessage = `Ingresa una cantidad valida para ${detalleSinCantidad.itemDescripcion}.`;
      return [];
    }

    const detalleMayorPendiente = seleccionados.find((item) => Number(item.cantidadIngresar) > this.getCantidadMaximaIngreso(item));
    if (detalleMayorPendiente) {
      this.saveErrorMessage = `La cantidad a ingresar de ${detalleMayorPendiente.itemDescripcion} no puede superar la cantidad permitida.`;
      return [];
    }

    return seleccionados.map((item) => ({
      Ped_Det_Id: item.pedidoDetalleId,
      Ord_Com_Id: cabecera.ordenCompraId,
      Can_Ing: Number(item.cantidadIngresar),
      Alm_Ser: item.serie.trim() || null,
      Alm_Cos_Unit: item.costoUnitario
    }));
  }

  private buildActualizarIngresoAlmacenDetalleOrdenCompraPayloads(): ActualizarIngresoAlmacenDetalleRequest[] {
    const cabecera = this.ingresoOrdenSeleccionada;
    const seleccionados = this.ingresoOrdenDetalles.filter((item) => item.seleccionado);
    const currentUser = this.getCurrentOperator();

    if (!cabecera) {
      this.saveErrorMessage = 'No se encontro la orden de compra seleccionada para actualizar el detalle de almacen.';
      return [];
    }

    if (!seleccionados.length) {
      this.saveErrorMessage = 'Selecciona al menos un producto para actualizar el detalle de almacen.';
      return [];
    }

    const detalleSinAlmacenId = seleccionados.find((item) => !Number.isInteger(item.almacenDetalleId) || item.almacenDetalleId <= 0);
    if (detalleSinAlmacenId) {
      this.saveErrorMessage = `El producto ${detalleSinAlmacenId.itemDescripcion} no tiene Alm_Det_Id para actualizar el detalle de almacen.`;
      return [];
    }

    const detalleSinCantidad = seleccionados.find((item) => !Number.isFinite(item.cantidadIngresar) || Number(item.cantidadIngresar) <= 0);
    if (detalleSinCantidad) {
      this.saveErrorMessage = `Ingresa una cantidad valida para actualizar el detalle de almacen de ${detalleSinCantidad.itemDescripcion}.`;
      return [];
    }

    const detalleSinItem = seleccionados.find((item) => !Number.isInteger(item.itemId) || item.itemId <= 0);
    if (detalleSinItem) {
      this.saveErrorMessage = `El producto ${detalleSinItem.itemDescripcion} no tiene item asociado para actualizar el detalle de almacen.`;
      return [];
    }

    const detalleSinUnidad = seleccionados.find((item) => !Number.isInteger(item.unidadId) || item.unidadId <= 0);
    if (detalleSinUnidad) {
      this.saveErrorMessage = `El producto ${detalleSinUnidad.itemDescripcion} no tiene unidad asociada para actualizar el detalle de almacen.`;
      return [];
    }

    const detalleSinCentroCosto = seleccionados.find((item) => !Number.isInteger(item.centroCostoId) || item.centroCostoId <= 0);
    if (detalleSinCentroCosto) {
      this.saveErrorMessage = `El producto ${detalleSinCentroCosto.itemDescripcion} no tiene centro de costo asociado para actualizar el detalle de almacen.`;
      return [];
    }

    const detalleCostoInvalido = seleccionados.find((item) => item.costoUnitario !== null
      && (!Number.isFinite(item.costoUnitario) || item.costoUnitario < 0));
    if (detalleCostoInvalido) {
      this.saveErrorMessage = `Ingresa un costo unitario valido para ${detalleCostoInvalido.itemDescripcion}.`;
      return [];
    }

    return seleccionados.map((item) => ({
      Alm_Det_Id: item.almacenDetalleId,
      Alm_Det_Itm_Id: item.itemId,
      Alm_Det_Uni_Med_Id: item.unidadId,
      Alm_Det_Can: Number(item.cantidadIngresar),
      Alm_Det_Doc_Nro: item.documentoNumero || cabecera.numeroOrden || cabecera.pedidoCodigo || '',
      Alm_Det_Fec: item.fechaDetalle || formatDateRequestValue(new Date()),
      Alm_Det_Cen_Cos_Id: item.centroCostoId,
      Alm_Det_Prv_Id: cabecera.proveedorId || 0,
      Alm_Ser: item.serie.trim() || null,
      Alm_Cos_Unit: item.costoUnitario,
      Usr_Reg: currentUser,
      Usr_Mod: currentUser
    }));
  }

  private buildActualizarStockItemPayloads(): ActualizarStockItemRequest[] {
    const cabecera = this.ingresoOrdenSeleccionada;
    const seleccionados = this.ingresoOrdenDetalles.filter((item) => item.seleccionado);

    console.log('[Almacen][buildActualizarStockItemPayloads]', {
      cabecera,
      seleccionados
    });

    if (!cabecera) {
      this.saveErrorMessage = 'No se encontro la orden de compra seleccionada para actualizar el stock.';
      return [];
    }

    if (!seleccionados.length) {
      this.saveErrorMessage = 'Selecciona al menos un producto para actualizar el stock.';
      return [];
    }

    const detalleSinItem = seleccionados.find((item) => !Number.isInteger(item.itemId) || item.itemId <= 0);
    if (detalleSinItem) {
      console.log('[Almacen][Stock sin itemId]', detalleSinItem);
      this.saveErrorMessage = `El producto ${detalleSinItem.itemDescripcion} no tiene item asociado para actualizar stock.`;
      return [];
    }

    const detalleSinCantidad = seleccionados.find((item) => !Number.isFinite(item.cantidadIngresar) || Number(item.cantidadIngresar) <= 0);
    if (detalleSinCantidad) {
      this.saveErrorMessage = `Ingresa una cantidad valida para actualizar stock de ${detalleSinCantidad.itemDescripcion}.`;
      return [];
    }

    const detalleCostoInvalido = seleccionados.find((item) => item.costoUnitario !== null
      && (!Number.isFinite(item.costoUnitario) || item.costoUnitario < 0));
    if (detalleCostoInvalido) {
      this.saveErrorMessage = `Ingresa un costo unitario valido para ${detalleCostoInvalido.itemDescripcion}.`;
      return [];
    }

    return seleccionados.map((item) => ({
      Itm_Id: item.itemId,
      Ord_Com_Id: cabecera.ordenCompraId,
      Can_Ing: Number(item.cantidadIngresar)
    }));
  }

  private buildRegistrarIngresoOrdenAlmacenDetallePayloads(movimientoId: number): RegistrarIngresoAlmacenDetalleRequest[] {
    const cabecera = this.ingresoOrdenSeleccionada;
    const seleccionados = this.ingresoOrdenDetalles.filter((item) => item.seleccionado);
    const currentUser = this.getCurrentOperator();
    const fechaIngreso = formatDateRequestValue(new Date());

    if (!cabecera) {
      this.saveErrorMessage = 'No se encontro la orden de compra seleccionada para registrar el detalle de almacen.';
      return [];
    }

    if (!Number.isInteger(movimientoId) || movimientoId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el movimiento de almacen para registrar el detalle.';
      return [];
    }

    if (!seleccionados.length) {
      this.saveErrorMessage = 'Selecciona al menos un producto para registrar el detalle de almacen.';
      return [];
    }

    const detalleSinItem = seleccionados.find((item) => !Number.isInteger(item.itemId) || item.itemId <= 0);
    if (detalleSinItem) {
      this.saveErrorMessage = `El producto ${detalleSinItem.itemDescripcion} no tiene item asociado para registrar el detalle de almacen.`;
      return [];
    }

    const detalleSinUnidad = seleccionados.find((item) => !Number.isInteger(item.unidadId) || item.unidadId <= 0);
    if (detalleSinUnidad) {
      this.saveErrorMessage = `El producto ${detalleSinUnidad.itemDescripcion} no tiene unidad asociada para registrar el detalle de almacen.`;
      return [];
    }

    const detalleSinCentroCosto = seleccionados.find((item) => !Number.isInteger(item.centroCostoId) || item.centroCostoId <= 0);
    if (detalleSinCentroCosto) {
      this.saveErrorMessage = `El producto ${detalleSinCentroCosto.itemDescripcion} no tiene centro de costo asociado para registrar el detalle de almacen.`;
      return [];
    }

    const detalleSinCantidad = seleccionados.find((item) => !Number.isFinite(item.cantidadIngresar) || Number(item.cantidadIngresar) <= 0);
    if (detalleSinCantidad) {
      this.saveErrorMessage = `Ingresa una cantidad valida para registrar el detalle de almacen de ${detalleSinCantidad.itemDescripcion}.`;
      return [];
    }

    const detalleCostoInvalido = seleccionados.find((item) => item.costoUnitario !== null
      && (!Number.isFinite(item.costoUnitario) || item.costoUnitario < 0));
    if (detalleCostoInvalido) {
      this.saveErrorMessage = `Ingresa un costo unitario valido para ${detalleCostoInvalido.itemDescripcion}.`;
      return [];
    }

    return seleccionados.map((item) => ({
      Alm_Mov_Id: movimientoId,
      Alm_Det_Itm_Id: item.itemId,
      Alm_Det_Uni_Med_Id: item.unidadId,
      Alm_Det_Can: Number(item.cantidadIngresar),
      Alm_Det_Doc_Nro: cabecera.numeroOrden || cabecera.pedidoCodigo || '',
      Alm_Det_Fec: fechaIngreso,
      Alm_Det_Cen_Cos_Id: item.centroCostoId,
      Alm_Det_Prv_Id: cabecera.proveedorId || 0,
      Alm_Ser: item.serie.trim() || null,
      Alm_Cos_Unit: item.costoUnitario,
      Usr_Reg: currentUser
    }));
  }

  private registrarDetallesIngresoOrdenAlmacenSecuencial(
    detallePayloads: RegistrarIngresoAlmacenDetalleRequest[],
    index: number,
    onSuccess: () => void
  ): void {
    const detallePayload = detallePayloads[index];

    if (!detallePayload) {
      onSuccess();
      return;
    }

    console.log('[Almacen][Ingreso orden][postRegistrarIngresoAlmacenDetalle] payload:', detallePayload);

    this.apiService.postRegistrarIngresoAlmacenDetalle(detallePayload).subscribe({
      next: (detalleResponse: unknown) => {
        try {
          this.assertSuccessfulResponse(detalleResponse, 'No se pudo registrar el detalle del ingreso de almacen.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(
            error,
            `Se registro el movimiento ${detallePayload.Alm_Mov_Id}, pero no se pudo registrar el detalle de almacen.`
          );
          return;
        }

        this.registrarDetallesIngresoOrdenAlmacenSecuencial(detallePayloads, index + 1, onSuccess);
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(
          error,
          `Se registro el movimiento ${detallePayload.Alm_Mov_Id}, pero no se pudo registrar el detalle de almacen.`
        );
      }
    });
  }

  private actualizarPedidoDetalleIngresoAlmacenSecuencial(
    detallePayloads: ActualizarPedidoDetalleIngresoAlmacenRequest[],
    index: number,
    onSuccess: () => void
  ): void {
    const detallePayload = detallePayloads[index];

    if (!detallePayload) {
      onSuccess();
      return;
    }

    this.apiService.patchActualizarPedidoDetalleIngresoAlmacen(detallePayload).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo actualizar el detalle del pedido para ingreso de almacen.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(
            error,
            'Se registro el ingreso, pero no se pudo actualizar el detalle del pedido.'
          );
          return;
        }

        this.actualizarPedidoDetalleIngresoAlmacenSecuencial(detallePayloads, index + 1, onSuccess);
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(
          error,
          'Se registro el ingreso, pero no se pudo actualizar el detalle del pedido.'
        );
      }
    });
  }

  private actualizarDetallesIngresoOrdenAlmacenSecuencial(
    detallePayloads: ActualizarIngresoAlmacenDetalleRequest[],
    index: number,
    onSuccess: () => void
  ): void {
    const detallePayload = detallePayloads[index];

    if (!detallePayload) {
      onSuccess();
      return;
    }

    this.apiService.patchActualizarIngresoAlmacenDetalle(detallePayload).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo actualizar el detalle del ingreso por orden.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el detalle del ingreso por orden.');
          return;
        }

        this.actualizarDetallesIngresoOrdenAlmacenSecuencial(detallePayloads, index + 1, onSuccess);
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el detalle del ingreso por orden.');
      }
    });
  }

  private actualizarStockIngresoOrdenSecuencial(
    stockPayloads: ActualizarStockItemRequest[],
    index: number,
    onSuccess: () => void
  ): void {
    const stockPayload = stockPayloads[index];

    if (!stockPayload) {
      onSuccess();
      return;
    }

    this.apiService.patchActualizarStockItem(stockPayload).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo actualizar el stock del item.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el stock del item.');
          return;
        }

        this.actualizarStockIngresoOrdenSecuencial(stockPayloads, index + 1, onSuccess);
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el stock del item.');
      }
    });
  }

  private buildActualizarStockItemIngresoDirectoPayload(
    movimientoId: number,
    detallePayload: RegistrarIngresoAlmacenDetalleRequest | ActualizarIngresoAlmacenDetalleRequest
  ): ActualizarStockItemIngresoDirectoRequest {
    return {
      Alm_Mov_Id: movimientoId,
      Alm_Det_Itm_Id: detallePayload.Alm_Det_Itm_Id,
      Can_Ing: Number(detallePayload.Alm_Det_Can)
    };
  }

  private buildActualizarStockItemSalidaPayload(
    movimientoId: number,
    detallePayload: RegistrarIngresoAlmacenDetalleRequest
  ): ActualizarStockItemSalidaRequest {
    return {
      Alm_Mov_Id: movimientoId,
      Alm_Det_Itm_Id: detallePayload.Alm_Det_Itm_Id,
      Can_Ing: Number(detallePayload.Alm_Det_Can)
    };
  }

  private getStockDisponibleSalida(materialIdRaw?: number): number {
    const materialId = materialIdRaw ?? Number(this.ingresoDirectoForm.controls['materialId'].value);
    const materialRow = this.salidaMaterialRows.find((row) => Number(row.controls['materialId'].value) === materialId);
    const rowDisponible = Number(materialRow?.controls['stockDisponible']?.value);

    if (Number.isFinite(rowDisponible)) {
      return rowDisponible;
    }

    if (this.salidaItemSeleccionado && this.salidaItemSeleccionado.itemId === materialId) {
      return this.salidaItemSeleccionado.disponible;
    }

    const selectedItem = this.salidaItems.find((item) => item.itemId === materialId);
    return selectedItem?.disponible ?? 0;
  }

  private getMaterialSalidaSinDisponible(): string {
    const row = this.salidaMaterialRows.find((item) => {
      const materialId = Number(item.controls['materialId'].value);
      const disponible = Number(item.controls['stockDisponible'].value);
      return Number.isInteger(materialId) && materialId > 0 && (!Number.isFinite(disponible) || disponible <= 0);
    });

    return row ? String(row.controls['materialDescription'].value || '').trim() : '';
  }

  private getPrimerMaterialSalidaConStockInsuficiente(
    detalles: SalidaDetalleDraft[],
    incluirCantidadOriginal = false
  ): string {
    const detalle = detalles.find((item) => {
      const disponible = this.getStockDisponibleSalida(item.itemId) + (incluirCantidadOriginal ? item.originalCantidad : 0);
      return item.cantidad > disponible;
    });

    return detalle?.itemDescripcion || '';
  }

  private tieneMaterialSalidaSinDisponible(): boolean {
    return this.salidaMaterialRows.some((row) => {
      const materialId = Number(row.controls['materialId'].value);
      const disponible = Number(row.controls['stockDisponible'].value);
      return Number.isInteger(materialId) && materialId > 0 && (!Number.isFinite(disponible) || disponible <= 0);
    });
  }

  private mostrarStockInsuficiente(materialDescripcion = ''): void {
    const material = materialDescripcion.trim();
    const mensaje = material ? `Stock Insuficiente para el material ${material}` : 'Stock Insuficiente';

    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  private getSalidaStockInfo(materialIdRaw?: number): { disponible: number; reservado: number; stockTotal: number } {
    const materialId = Number(materialIdRaw);
    const selectedItem = this.salidaItems.find((item) => item.itemId === materialId);
    const stockTotal = selectedItem?.stock ?? 0;
    const reservado = selectedItem?.reservado ?? 0;
    const disponible = selectedItem?.disponible ?? Math.max(stockTotal - reservado, 0);

    return {
      disponible: this.normalizeDecimal(disponible),
      reservado: this.normalizeDecimal(reservado),
      stockTotal: this.normalizeDecimal(stockTotal)
    };
  }

  private actualizarStocksSalidaMateriales(): void {
    this.salidaMaterialRows.forEach((_, index) => this.cargarStockSalidaMaterialRow(index));
  }

  private cargarStockSalidaMaterialRow(index: number): void {
    const row = this.getSalidaMaterialRow(index);
    const centroCostoId = Number(this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].value);
    const materialId = Number(row?.controls['materialId'].value);

    if (!row || !Number.isInteger(centroCostoId) || centroCostoId <= 0 || !Number.isInteger(materialId) || materialId <= 0) {
      this.patchStockSalidaMaterialRow(row, 0, 0, 0);
      return;
    }

    this.apiService.getListarStocksItems(centroCostoId, materialId).subscribe({
      next: (response: unknown) => {
        const record = this.extractRecords(response)[0] ?? {};
        const disponible = this.getDecimalValue(record, ['Disponible', 'disponible']) ?? 0;
        const reservado = this.getDecimalValue(record, ['Reservado', 'reservado']) ?? 0;
        const stockTotal = this.getDecimalValue(record, ['Total', 'total']) ?? 0;

        console.log('[Almacen][Salida][getListarStocksItems]', {
          index,
          Usr_Cen_Cos_Id: centroCostoId,
          Alm_Det_Itm_Id: materialId,
          response,
          disponible,
          reservado,
          stockTotal
        });

        this.patchStockSalidaMaterialRow(row, disponible, reservado, stockTotal);
      },
      error: (error: unknown) => {
        console.error('[Almacen][Salida] No se pudo listar stock del item.', {
          index,
          Usr_Cen_Cos_Id: centroCostoId,
          Alm_Det_Itm_Id: materialId,
          error
        });
        const fallback = this.getSalidaStockInfo(materialId);
        this.patchStockSalidaMaterialRow(row, fallback.disponible, fallback.reservado, fallback.stockTotal);
      }
    });
  }

  private patchStockSalidaMaterialRow(row: FormGroup | null, disponible: number, reservado: number, stockTotal: number): void {
    if (!row) {
      return;
    }

    row.patchValue({
      stockDisponible: this.normalizeDecimal(disponible),
      stockReservado: this.normalizeDecimal(reservado),
      stockTotal: this.normalizeDecimal(stockTotal)
    });
  }

  private actualizarStockIngresoDirecto(stockPayload: ActualizarStockItemIngresoDirectoRequest, onSuccess: () => void): void {
    console.log('[Almacen][patchActualizarStockItemIngresoDirecto] payload:', stockPayload);

    this.apiService.patchActualizarStockItemIngresoDirecto(stockPayload).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo actualizar el stock del ingreso directo.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el stock del ingreso directo.');
          return;
        }

        onSuccess();
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el stock del ingreso directo.');
      }
    });
  }

  private actualizarStockSalida(stockPayload: ActualizarStockItemSalidaRequest, onSuccess: () => void): void {
    console.log('[Almacen][patchActualizarStockItemSalida] payload:', stockPayload);

    this.apiService.patchActualizarStockItemSalida(stockPayload).subscribe({
      next: (response: unknown) => {
        try {
          this.assertSuccessfulResponse(response, 'No se pudo actualizar el stock de la salida.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el stock de la salida.');
          return;
        }

        onSuccess();
      },
      error: (error: unknown) => {
        console.log('[Almacen][patchActualizarStockItemSalida] error:', error);
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el stock de la salida.');
      }
    });
  }

  private buildRegistrarSalidaAlmacenPayload(): RegistrarIngresoAlmacenRequest | null {
    const solicitanteValue = String(
      this.ingresoDirectoForm.controls['solicitanteId'].value || ''
    ).trim();
    const centroCostoId = Number(this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].value);
    const ubicacion = Number(this.ingresoDirectoForm.controls['ubicacion'].value);
    const serie = this.isSalidaMode
      ? (String(this.ingresoDirectoForm.controls['serie'].value || '').trim() || null)
      : null;
    const currentUser = this.authService.getCurrentUser().trim();

    if (!solicitanteValue) {
      this.saveErrorMessage = 'Selecciona un solicitante válido para registrar la salida.';
      return null;
    }

    if (!currentUser) {
      this.saveErrorMessage = 'No se pudo identificar el usuario que inició sesión.';
      return null;
    }

    if (!Number.isInteger(centroCostoId) || centroCostoId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el centro de costo del solicitante.';
      return null;
    }

    if (!Number.isInteger(ubicacion) || ubicacion <= 0) {
      this.saveErrorMessage = 'Selecciona una ubicacion valida para registrar la salida.';
      return null;
    }

    return {
      Alm_Ubi: ubicacion,
      Alm_Tip_Ing: 4,
      Alm_Sol_Dni: solicitanteValue,
      Alm_Cen_Cos: centroCostoId,
      Alm_Ser: serie,
      Usr_Reg: currentUser
    };
  }

  private buildSalidaDetalleDrafts(): SalidaDetalleDraft[] {
    const drafts: SalidaDetalleDraft[] = [];

    for (const row of this.salidaMaterialRows) {
      const detalleId = Number(row.controls['detalleId'].value || 0);
      const itemId = Number(row.controls['materialId'].value);
      const itemDescripcion = String(row.controls['materialDescription'].value || '').trim();
      const unidadId = Number(row.controls['unidadId'].value);
      const cantidad = Number(row.controls['cantidad'].value);
      const originalCantidad = Number(row.controls['originalCantidad'].value || 0);
      const fecha = formatDateRequestValue(row.controls['fecha'].value);

      if (!Number.isInteger(itemId) || itemId <= 0) {
        this.saveErrorMessage = 'Selecciona un material valido para registrar la salida.';
        return [];
      }

      if (!Number.isInteger(unidadId) || unidadId <= 0) {
        this.saveErrorMessage = 'Selecciona una unidad valida para registrar la salida.';
        return [];
      }

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        this.saveErrorMessage = 'Ingresa una cantidad valida para registrar la salida.';
        return [];
      }

      if (!fecha) {
        this.saveErrorMessage = 'Selecciona una fecha valida para registrar la salida.';
        return [];
      }

      drafts.push({ detalleId, itemId, itemDescripcion, unidadId, cantidad, fecha, originalCantidad });
    }

    return drafts;
  }

  private buildRegistrarSalidaAlmacenDetallePayload(
    movimientoId: number,
    detalle: SalidaDetalleDraft
  ): RegistrarIngresoAlmacenDetalleRequest | null {
    const itemId = detalle.itemId;
    const unidadId = detalle.unidadId;
    const cantidad = detalle.cantidad;
    const fecha = detalle.fecha;
    const centroCostoId = Number(this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].value);
    const currentUser = this.getCurrentOperator();

    if (!Number.isInteger(itemId) || itemId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el material seleccionado para registrar la salida.';
      return null;
    }

    if (!Number.isInteger(unidadId) || unidadId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar la unidad del material para registrar la salida.';
      return null;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      this.saveErrorMessage = 'Ingresa una cantidad valida para registrar la salida.';
      return null;
    }

    if (!Number.isInteger(centroCostoId) || centroCostoId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el centro de costo del solicitante para registrar el detalle.';
      return null;
    }

    if (!fecha) {
      this.saveErrorMessage = 'Selecciona una fecha valida para registrar la salida.';
      return null;
    }

    return {
      Alm_Mov_Id: movimientoId,
      Alm_Det_Itm_Id: itemId,
      Alm_Det_Uni_Med_Id: unidadId,
      Alm_Det_Can: cantidad,
      Alm_Det_Doc_Nro: '',
      Alm_Det_Fec: fecha,
      Alm_Det_Cen_Cos_Id: centroCostoId,
      Alm_Det_Prv_Id: 0,
      Usr_Reg: currentUser
    };
  }

  private buildActualizarSalidaAlmacenDetallePayload(detalle: SalidaDetalleDraft): ActualizarIngresoAlmacenDetalleRequest | null {
    const centroCostoId = Number(this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].value);
    const currentUser = this.getCurrentOperator();

    if (!Number.isInteger(detalle.detalleId) || detalle.detalleId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el detalle de la salida a actualizar.';
      return null;
    }

    if (!Number.isInteger(detalle.itemId) || detalle.itemId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el material seleccionado para actualizar la salida.';
      return null;
    }

    if (!Number.isInteger(detalle.unidadId) || detalle.unidadId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar la unidad del material para actualizar la salida.';
      return null;
    }

    if (!Number.isFinite(detalle.cantidad) || detalle.cantidad <= 0) {
      this.saveErrorMessage = 'Ingresa una cantidad valida para actualizar la salida.';
      return null;
    }

    if (!Number.isInteger(centroCostoId) || centroCostoId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el centro de costo del solicitante para actualizar el detalle.';
      return null;
    }

    if (!detalle.fecha) {
      this.saveErrorMessage = 'Selecciona una fecha valida para actualizar la salida.';
      return null;
    }

    return {
      Alm_Det_Id: detalle.detalleId,
      Alm_Det_Itm_Id: detalle.itemId,
      Alm_Det_Uni_Med_Id: detalle.unidadId,
      Alm_Det_Can: detalle.cantidad,
      Alm_Det_Doc_Nro: '',
      Alm_Det_Fec: detalle.fecha,
      Alm_Det_Cen_Cos_Id: centroCostoId,
      Alm_Det_Prv_Id: 0,
      Usr_Reg: currentUser
    };
  }

  private registrarDetallesSalidaSecuencial(
    movimientoId: number,
    detallePayloads: RegistrarIngresoAlmacenDetalleRequest[],
    index: number,
    onSuccess: () => void
  ): void {
    const detallePayload = detallePayloads[index];

    if (!detallePayload) {
      onSuccess();
      return;
    }

    console.log(
      `[Almacen][Salida][Guardar][POST /api/Almacen/postRegistrarIngresoAlmacenDetalle][${index + 1}/${detallePayloads.length}] payload:`,
      detallePayload
    );

    this.apiService.postRegistrarIngresoAlmacenDetalle(detallePayload).subscribe({
      next: (detalleResponse: unknown) => {
        console.log(
          `[Almacen][Salida][Guardar][POST /api/Almacen/postRegistrarIngresoAlmacenDetalle][${index + 1}/${detallePayloads.length}] response:`,
          detalleResponse
        );

        try {
          this.assertSuccessfulResponse(detalleResponse, 'No se pudo registrar el detalle de la salida de almacen.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(
            error,
            `Se registro el movimiento ${movimientoId}, pero no se pudo registrar el detalle de la salida.`
          );
          return;
        }

        this.registrarDetallesSalidaSecuencial(movimientoId, detallePayloads, index + 1, onSuccess);
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(
          error,
          `Se registro el movimiento ${movimientoId}, pero no se pudo registrar el detalle de la salida.`
        );
      }
    });
  }

  private guardarDetallesSalidaActualizacionSecuencial(
    movimientoId: number,
    detallePayloads: Array<RegistrarIngresoAlmacenDetalleRequest | ActualizarIngresoAlmacenDetalleRequest>,
    index: number,
    onSuccess: () => void
  ): void {
    const detallePayload = detallePayloads[index];

    if (!detallePayload) {
      onSuccess();
      return;
    }

    const isDetalleExistente = 'Alm_Det_Id' in detallePayload;
    const endpoint = isDetalleExistente
      ? 'PATCH /api/Almacen/patchActualizarIngresoAlmacenDetalle'
      : 'POST /api/Almacen/postRegistrarIngresoAlmacenDetalle';

    console.log(
      `[Almacen][Salida][Actualizar][${endpoint}][${index + 1}/${detallePayloads.length}] payload:`,
      detallePayload
    );

    const request$ = isDetalleExistente
      ? this.apiService.patchActualizarIngresoAlmacenDetalle(detallePayload)
      : this.apiService.postRegistrarIngresoAlmacenDetalle(detallePayload);

    request$.subscribe({
      next: (detalleResponse: unknown) => {
        console.log(
          `[Almacen][Salida][Actualizar][${endpoint}][${index + 1}/${detallePayloads.length}] response:`,
          detalleResponse
        );

        try {
          this.assertSuccessfulResponse(detalleResponse, 'No se pudo guardar el detalle de la salida de almacen.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(
            error,
            `Se actualizo el movimiento ${movimientoId}, pero no se pudo guardar el detalle de la salida.`
          );
          return;
        }

        this.guardarDetallesSalidaActualizacionSecuencial(movimientoId, detallePayloads, index + 1, onSuccess);
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(
          error,
          `Se actualizo el movimiento ${movimientoId}, pero no se pudo guardar el detalle de la salida.`
        );
      }
    });
  }

  private buildRegistrarIngresoAlmacenDetallePayload(movimientoId: number): RegistrarIngresoAlmacenDetalleRequest | null {
    const itemId = Number(this.ingresoDirectoForm.controls['materialId'].value);
    const unidadId = Number(this.ingresoDirectoForm.controls['unidadId'].value);
    const cantidad = Number(this.ingresoDirectoForm.controls['cantidad'].value);
    const fecha = formatDateRequestValue(this.ingresoDirectoForm.controls['fecha'].value);
    const documentoReferencia = String(this.ingresoDirectoForm.controls['documentoNumero'].value || '').trim();
    const centroCostoId = Number(this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].value);
    const proveedorValue = Number(this.ingresoDirectoForm.controls['proveedorId'].value);
    const proveedorId = Number.isInteger(proveedorValue) && proveedorValue > 0
      ? proveedorValue
      : null;
    const serie = String(this.ingresoDirectoForm.controls['serie'].value || '').trim() || null;
    const costoUnitarioValue = this.ingresoDirectoForm.controls['costoUnitario'].value;
    const costoUnitario = costoUnitarioValue === null || costoUnitarioValue === ''
      ? null
      : Number(costoUnitarioValue);
    const currentUser = this.getCurrentOperator();

    if (!Number.isInteger(itemId) || itemId <= 0) {
      this.saveErrorMessage = 'Selecciona un material valido para registrar el detalle.';
      return null;
    }

    if (!Number.isInteger(unidadId) || unidadId <= 0) {
      this.saveErrorMessage = 'Selecciona una unidad valida para registrar el detalle.';
      return null;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      this.saveErrorMessage = 'Ingresa una cantidad valida para registrar el detalle.';
      return null;
    }

    if (!Number.isInteger(centroCostoId) || centroCostoId <= 0) {
      this.saveErrorMessage = 'Selecciona un centro de costo valido para registrar el detalle.';
      return null;
    }

    if (costoUnitario !== null && (!Number.isFinite(costoUnitario) || costoUnitario < 0)) {
      this.saveErrorMessage = 'Ingresa un costo unitario valido.';
      return null;
    }

    return {
      Alm_Mov_Id: movimientoId,
      Alm_Det_Itm_Id: itemId,
      Alm_Det_Uni_Med_Id: unidadId,
      Alm_Det_Can: cantidad,
      Alm_Det_Doc_Nro: documentoReferencia,
      Alm_Det_Fec: fecha,
      Alm_Det_Cen_Cos_Id: centroCostoId,
      Alm_Det_Prv_Id: proveedorId,
      Alm_Ser: serie,
      Alm_Cos_Unit: costoUnitario,
      Usr_Reg: currentUser
    };
  }

  private actualizarIngresoDirecto(): void {
    if (this.ingresoDirectoForm.invalid) {
      this.ingresoDirectoForm.markAllAsTouched();
      const invalidControls = this.getInvalidIngresoDirectoControls();
      console.log('Almacen actualizar ingreso directo invalid controls', invalidControls);
      this.saveErrorMessage = `Completa los campos obligatorios para actualizar el ingreso directo. Campos invalidos: ${invalidControls.join(', ')}`;
      return;
    }

    const cabeceraPayload = this.buildActualizarIngresoAlmacenPayload();

    if (!cabeceraPayload) {
      return;
    }

    const detallePayload = this.buildActualizarIngresoAlmacenDetallePayload();

    if (!detallePayload) {
      return;
    }

    this.isSavingIngreso = true;
    this.saveErrorMessage = '';

    const stockPayload = this.buildActualizarStockItemIngresoDirectoPayload(cabeceraPayload.Alm_Mov_Id, detallePayload);

    console.log('[Almacen][Ingreso directo][Actualizar] payloads:', {
      cabeceraPayload,
      detallePayload,
      stockPayload
    });

    this.apiService.patchActualizarIngresoAlmacen(cabeceraPayload).subscribe({
      next: (cabeceraResponse: unknown) => {
        try {
          this.assertSuccessfulResponse(cabeceraResponse, 'No se pudo actualizar la cabecera del ingreso a almacen.');
        } catch (error: unknown) {
          this.isSavingIngreso = false;
          this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar la cabecera del ingreso a almacen.');
          return;
        }

        this.actualizarStockIngresoDirecto(stockPayload, () => {
          this.apiService.patchActualizarIngresoAlmacenDetalle(detallePayload).subscribe({
          next: (detalleResponse: unknown) => {
            try {
              this.assertSuccessfulResponse(detalleResponse, 'No se pudo actualizar el detalle del ingreso a almacen.');
            } catch (error: unknown) {
              this.isSavingIngreso = false;
              this.saveErrorMessage = this.resolveErrorMessage(
                error,
                `Se actualizo el movimiento ${cabeceraPayload.Alm_Mov_Id}, pero no se pudo actualizar el detalle del ingreso.`
              );
              return;
            }

            this.isSavingIngreso = false;
            this.filtersForm.patchValue({ movimientoId: cabeceraPayload.Alm_Mov_Id }, { emitEvent: false });
            this.globalSearch = '';
            this.showIngresoDirectoForm = false;
            this.isEditMode = false;
            this.saveErrorMessage = '';
            this.clearPendingEditData();
            this.resetIngresoDirectoForm();
            this.cargarListadoSeleccionado();
          },
          error: (error: unknown) => {
            this.isSavingIngreso = false;
            this.saveErrorMessage = this.resolveErrorMessage(
              error,
              `Se actualizo el movimiento ${cabeceraPayload.Alm_Mov_Id}, pero no se pudo actualizar el detalle del ingreso.`
            );
          }
          });
        });
      },
      error: (error: unknown) => {
        this.isSavingIngreso = false;
        this.saveErrorMessage = this.resolveErrorMessage(error, 'No se pudo actualizar el ingreso a almacen.');
      }
    });
  }

  private buildActualizarIngresoAlmacenPayload(): ActualizarIngresoAlmacenRequest | null {
    const solicitante = this.getSelectedSolicitante();
    const movimientoId = Number(this.ingresoDirectoForm.controls['movimientoId'].value);
    const centroCostoId = Number(this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].value);
    const ubicacion = Number(this.ingresoDirectoForm.controls['ubicacion'].value);
    const serie = this.isSalidaMode
      ? (String(this.ingresoDirectoForm.controls['serie'].value || '').trim() || null)
      : null;
    const currentUser = this.getCurrentOperator();

    if (!Number.isInteger(movimientoId) || movimientoId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el movimiento a actualizar.';
      return null;
    }

    if (!solicitante) {
      this.saveErrorMessage = 'Selecciona un solicitante valido para actualizar el ingreso.';
      return null;
    }

    if (!solicitante.code) {
      this.saveErrorMessage = 'El solicitante seleccionado no tiene codigo asociado para actualizar el ingreso.';
      return null;
    }

    if (!Number.isInteger(centroCostoId) || centroCostoId <= 0) {
      this.saveErrorMessage = 'Selecciona un centro de costo valido para el solicitante.';
      return null;
    }

    if (!Number.isInteger(ubicacion) || ubicacion <= 0) {
      this.saveErrorMessage = 'Selecciona una ubicacion valida para actualizar el ingreso.';
      return null;
    }

    return {
      Alm_Mov_Id: movimientoId,
      Alm_Ubi: ubicacion,
      Alm_Sol_Dni: solicitante.code,
      Alm_Cen_Cos: centroCostoId,
      Alm_Ser: serie,
      Flg_Est: this.currentEditFlgEst || 'A',
      Usr_Mod: currentUser
    };
  }

  private buildActualizarIngresoAlmacenDetallePayload(): ActualizarIngresoAlmacenDetalleRequest | null {
    const itemId = Number(this.ingresoDirectoForm.controls['materialId'].value);
    const unidadId = Number(this.ingresoDirectoForm.controls['unidadId'].value);
    const cantidad = Number(this.ingresoDirectoForm.controls['cantidad'].value);
    const fecha = formatDateRequestValue(this.ingresoDirectoForm.controls['fecha'].value);
    const documentoReferencia = String(this.ingresoDirectoForm.controls['documentoNumero'].value || '').trim();
    const centroCostoId = Number(this.ingresoDirectoForm.controls['centroCostoSolicitanteId'].value);
    const proveedorValue = Number(this.ingresoDirectoForm.controls['proveedorId'].value);
    const proveedorId = Number.isInteger(proveedorValue) && proveedorValue > 0
      ? proveedorValue
      : null;
    const serie = String(this.ingresoDirectoForm.controls['serie'].value || '').trim() || null;
    const costoUnitarioValue = this.ingresoDirectoForm.controls['costoUnitario'].value;
    const costoUnitario = costoUnitarioValue === null || costoUnitarioValue === ''
      ? null
      : Number(costoUnitarioValue);
    const currentUser = this.getCurrentOperator();

    if (!Number.isInteger(this.currentEditDetalleId) || this.currentEditDetalleId <= 0) {
      this.saveErrorMessage = 'No se pudo identificar el detalle del ingreso a actualizar.';
      return null;
    }

    if (!Number.isInteger(itemId) || itemId <= 0) {
      this.saveErrorMessage = 'Selecciona un material valido para actualizar el detalle.';
      return null;
    }

    if (!Number.isInteger(unidadId) || unidadId <= 0) {
      this.saveErrorMessage = 'Selecciona una unidad valida para actualizar el detalle.';
      return null;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      this.saveErrorMessage = 'Ingresa una cantidad valida para actualizar el detalle.';
      return null;
    }

    if (!Number.isInteger(centroCostoId) || centroCostoId <= 0) {
      this.saveErrorMessage = 'Selecciona un centro de costo valido para actualizar el detalle.';
      return null;
    }

    if (costoUnitario !== null && (!Number.isFinite(costoUnitario) || costoUnitario < 0)) {
      this.saveErrorMessage = 'Ingresa un costo unitario valido.';
      return null;
    }

    return {
      Alm_Det_Id: this.currentEditDetalleId,
      Alm_Det_Itm_Id: itemId,
      Alm_Det_Uni_Med_Id: unidadId,
      Alm_Det_Can: cantidad,
      Alm_Det_Doc_Nro: documentoReferencia,
      Alm_Det_Fec: fecha,
      Alm_Det_Cen_Cos_Id: centroCostoId,
      Alm_Det_Prv_Id: proveedorId,
      Alm_Ser: serie,
      Alm_Cos_Unit: costoUnitario,
      Usr_Reg: currentUser,
      Usr_Mod: currentUser
    };
  }

  private resolveUbicacionCodigo(detalleRecord: DataRecord | null, cabeceraRecord: DataRecord | null): string {
    const source = detalleRecord ?? cabeceraRecord ?? {};
    const directValue = this.getTextValue(source, ['Alm_Ubi', 'alm_Ubi', 'almUbi']);

    if (directValue === '1' || directValue === '2') {
      return directValue;
    }

    const description = this.getTextValue(source, ['Ubi_Des', 'ubi_Des', 'ubiDes']).toUpperCase();
    return description === 'OBRA' ? '2' : '1';
  }

  private resolveSolicitanteId(detalleRecord: DataRecord | null, cabeceraRecord: DataRecord | null): string {
    const detalleSource = detalleRecord ?? {};
    const cabeceraSource = cabeceraRecord ?? {};
    const storedValue = this.getTextValue(cabeceraSource, ['Alm_Sol_Dni', 'alm_Sol_Dni', 'almSolDni', 'Usr_Cod', 'usr_Cod', 'usrCod'])
      || this.getTextValue(detalleSource, ['Alm_Sol_Dni', 'alm_Sol_Dni', 'almSolDni', 'Usr_Cod', 'usr_Cod', 'usrCod'])
      || this.getTextValue(cabeceraSource, ['Usr_Doc_Nro', 'usr_Doc_Nro', 'usrDocNro'])
      || this.getTextValue(detalleSource, ['Usr_Doc_Nro', 'usr_Doc_Nro', 'usrDocNro']);
    const normalizedStoredValue = storedValue.trim().toLowerCase();

    if (normalizedStoredValue) {
      const matchByCode = this.solicitanteOptions.find(
        (item) => item.code.trim().toLowerCase() === normalizedStoredValue
      );

      if (matchByCode) {
        return matchByCode.code;
      }

      const matchByDocument = this.solicitanteOptions.find(
        (item) => item.documentNumber.trim().toLowerCase() === normalizedStoredValue
      );

      if (matchByDocument) {
        return matchByDocument.code;
      }

      return storedValue.trim();
    }

    const name = (
      this.getTextValue(cabeceraSource, ['Usr_Nom', 'usr_Nom', 'usrNom'])
      || this.getTextValue(detalleSource, ['Usr_Nom', 'usr_Nom', 'usrNom'])
    ).toLowerCase();
    return this.solicitanteOptions.find((item) => item.name.toLowerCase() === name)?.code ?? '';
  }

  private resolveCentroCostoId(detalleRecord: DataRecord | null, cabeceraRecord: DataRecord | null): number {
    const source = detalleRecord ?? cabeceraRecord ?? {};
    const directId = this.getNumberValue(source, ['Alm_Cen_Cos', 'alm_Cen_Cos', 'almCenCos', 'Alm_Det_Cen_Cos_Id', 'alm_Det_Cen_Cos_Id', 'almDetCenCosId', 'Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId']);

    if (directId) {
      return directId;
    }

    const description = this.getTextValue(source, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']).toLowerCase();
    return this.centroCostoOptions.find((item) => item.description.toLowerCase() === description)?.id ?? 0;
  }

  private resolveItemOption(detalleRecord: DataRecord | null): PedidoDetalleItemOption | null {
    if (!detalleRecord) {
      return null;
    }

    const directId = this.getNumberValue(detalleRecord, ['Alm_Det_Itm_Id', 'alm_Det_Itm_Id', 'almDetItmId', 'Itm_Id', 'itm_Id', 'itmId']);

    if (directId) {
      const matchById = this.itemOptions.find((item) => item.id === directId);

      if (matchById) {
        return matchById;
      }
    }

    const description = this.getTextValue(detalleRecord, ['Itm_Des', 'itm_Des', 'itmDes', 'Material', 'material']).toLowerCase();
    return this.itemOptions.find((item) => item.description.toLowerCase() === description) ?? null;
  }

  private resolveUnidadOption(detalleRecord: DataRecord | null): PedidoDetalleUnidadOption | null {
    if (!detalleRecord) {
      return null;
    }

    const directId = this.getNumberValue(detalleRecord, ['Alm_Det_Uni_Med_Id', 'alm_Det_Uni_Med_Id', 'almDetUniMedId', 'Uni_Med_Id', 'uni_Med_Id', 'uniMedId']);

    if (directId) {
      const matchById = this.unidadOptions.find((item) => item.id === directId);

      if (matchById) {
        return matchById;
      }
    }

    const description = this.getTextValue(detalleRecord, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'Unidad', 'unidad']).toLowerCase();
    return this.unidadOptions.find((item) => item.description.toLowerCase() === description) ?? null;
  }

  private resolveProveedorId(detalleRecord: DataRecord | null, cabeceraRecord: DataRecord | null): number {
    const source = detalleRecord ?? cabeceraRecord ?? {};
    const directId = this.getNumberValue(source, ['Alm_Det_Prv_Id', 'alm_Det_Prv_Id', 'almDetPrvId', 'Prv_Id', 'prv_Id', 'prvId']);

    if (directId) {
      return directId;
    }

    const name = this.getTextValue(source, ['Prv_Nom', 'prv_Nom', 'prvNom']).toLowerCase();
    return this.proveedorOptions.find((item) => item.name.toLowerCase() === name)?.code ?? 0;
  }

  private mapAlmacen(item: DataRecord, index: number): AlmacenRow | null {
    const movimientoId = this.getNumberValue(item, ['Alm_Mov_Id', 'alm_Mov_Id', 'almMovId', 'id', 'Id']);

    if (!movimientoId) {
      return null;
    }

    const tipoIngresoId = this.getNumberValue(item, ['Alm_Tip_Ing', 'alm_Tip_Ing', 'almTipIng', 'Ing_Id', 'ing_Id', 'ingId']) ?? 0;
    const centroCostoId = this.getNumberValue(item, ['Alm_Cen_Cos', 'alm_Cen_Cos', 'almCenCos', 'Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId']) ?? 0;
    const solicitanteDocumento = this.getTextValue(item, [
      'Alm_Sol_Dni',
      'alm_Sol_Dni',
      'almSolDni',
      'Usr_Doc_Nro',
      'usr_Doc_Nro',
      'usrDocNro'
    ]);
    const tipoIngresoDescripcion = this.getTextValue(item, ['Ing_Des', 'ing_Des', 'ingDes', 'Alm_Tip_Ing_Des', 'alm_Tip_Ing_Des', 'almTipIngDes'])
      || this.resolveTipoIngresoDescripcion(tipoIngresoId)
      || `Tipo ${tipoIngresoId}`;
    const estadoAprobacion = this.resolveEstadoAprobacion(item);
    const estadoConsumo = this.resolveEstadoConsumo(item);

    return {
      id: movimientoId || index + 1,
      movimientoId,
      tipoIngresoId,
      tipoIngreso: tipoIngresoDescripcion,
      ordenCompraId: this.getNumberValue(item, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId']) ?? 0,
      pedidoId: this.getNumberValue(item, ['Ped_Id', 'ped_Id', 'pedId', 'Ped_Cab_Id', 'ped_Cab_Id', 'pedCabId']) ?? 0,
      ubicacionId: this.getNumberValue(item, ['Alm_Ubi', 'alm_Ubi', 'almUbi', 'Ubi_Id', 'ubi_Id', 'ubiId']) ?? 0,
      centroCostoId,
      centroCosto: this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']) || this.resolveCentroCostoDescripcion(centroCostoId),
      solicitanteDocumento,
      almacen: this.getTextValue(item, ['Ubi_Des', 'ubi_Des', 'ubiDes']) || this.resolveUbicacionDescripcion(item),
      fechaRegistro: formatDisplayDate(this.getTextValue(item, ['Fec_Reg', 'fec_Reg', 'fecReg', 'Fecha', 'fecha'])) || '-',
      registradoPor: this.getTextValue(item, ['Usr_Nom', 'usr_Nom', 'usrNom', 'RegistradoPor', 'registradoPor']) || this.resolveSolicitanteNombre(solicitanteDocumento),
      solicitante: this.getTextValue(item, ['Solicitante', 'solicitante']) || '-',
      estadoAprobacion,
      estadoConsumo
    };
  }

  private mapOrdenCompraPendienteAlmacen(item: DataRecord, index: number): OrdenCompraPendienteAlmacenRow | null {
    const ordenCompraId = this.getNumberValue(item, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId', 'id', 'Id']);

    if (!ordenCompraId) {
      return null;
    }

    return {
      id: ordenCompraId || index + 1,
      ordenCompraId,
      pedidoId: this.getNumberValue(item, ['Ord_Com_Ped_Id', 'ord_Com_Ped_Id', 'ordComPedId', 'Ped_Id', 'ped_Id', 'pedId']) ?? 0,
      numeroOrden: this.getTextValue(item, ['Ord_Num', 'ord_Num', 'ordNum', 'Num_Orden', 'num_Orden', 'numOrden'])
        || this.formatNumeroIngresoOrden(
          ordenCompraId,
          this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes'])
        ),
      pedidoCodigo: this.formatPedidoCodigo(
        this.getNumberValue(item, ['Ord_Com_Ped_Id', 'ord_Com_Ped_Id', 'ordComPedId', 'Ped_Id', 'ped_Id', 'pedId'])
      ),
      tipo: this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes']) || '-',
      fecha: formatDisplayDate(this.getTextValue(item, [
        'Fec_Reg',
        'fec_Reg',
        'fecReg',
        'Ord_Com_Fec',
        'ord_Com_Fec',
        'ordComFec',
        'Fecha',
        'fecha'
      ])) || '-',
      proveedorId: this.getNumberValue(item, ['Ord_Com_Prv', 'ord_Com_Prv', 'ordComPrv', 'Prv_Id', 'prv_Id', 'prvId']) ?? 0,
      proveedor: this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom']) || '-',
      proveedorRuc: this.getTextValue(item, ['Prv_Ruc', 'prv_Ruc', 'prvRuc', 'Ruc', 'ruc']) || '-',
      formaPago: this.getTextValue(item, ['For_Pag_Des', 'for_Pag_Des', 'forPagDes']) || '-',
      refObra: this.getTextValue(item, ['Ord_Com_Ref_Obr', 'ord_Com_Ref_Obr', 'ordComRefObr']) || '-',
      referencia: this.getTextValue(item, ['Ord_Com_Ref', 'ord_Com_Ref', 'ordComRef']) || '-',
      total: this.getOrdenCompraMoneyValue(item, ['Ord_Com_Tot', 'ord_Com_Tot', 'ordComTot']),
      estado: this.resolveEstadoTexto(this.getTextValue(item, ['Flg_Est', 'flg_Est', 'flgEst']))
    };
  }

  private mapCabeceraIngresoOrden(
    item: DataRecord,
    fallback: OrdenCompraPendienteAlmacenRow
  ): OrdenCompraPendienteAlmacenRow {
    const ordenCompraId = this.getNumberValue(item, ['Ord_Com_Id', 'ord_Com_Id', 'ordComId']) ?? fallback.ordenCompraId;
    const pedidoId = this.getNumberValue(item, [
      'Ped_Cab_Id',
      'ped_Cab_Id',
      'pedCabId',
      'Ped_Id',
      'ped_Id',
      'pedId',
      'Ord_Com_Ped_Id',
      'ord_Com_Ped_Id',
      'ordComPedId'
    ]);

    return {
      ...fallback,
      id: ordenCompraId,
      ordenCompraId,
      pedidoId: pedidoId ?? fallback.pedidoId,
      numeroOrden: this.formatNumeroIngresoOrden(
        ordenCompraId,
        this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes']) || fallback.tipo
      ),
      pedidoCodigo: this.formatPedidoCodigo(pedidoId ?? fallback.pedidoId),
      tipo: this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes']) || fallback.tipo,
      fecha: formatDisplayDate(this.getTextValue(item, ['Fec_Reg', 'fec_Reg', 'fecReg'])) || fallback.fecha,
      proveedorId: this.getNumberValue(item, ['Ord_Com_Prv', 'ord_Com_Prv', 'ordComPrv', 'Prv_Id', 'prv_Id', 'prvId']) ?? fallback.proveedorId,
      proveedor: this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom']) || fallback.proveedor,
      proveedorRuc: this.getTextValue(item, ['Prv_Ruc', 'prv_Ruc', 'prvRuc', 'Ruc', 'ruc']) || fallback.proveedorRuc,
      formaPago: this.getTextValue(item, ['Tip_Ser_Des', 'tip_Ser_Des', 'tipSerDes']) || fallback.formaPago
    };
  }

  formatProveedorIngresoOrden(item: OrdenCompraPendienteAlmacenRow): string {
    return item.proveedorId > 0 ? `${item.proveedorId} - ${item.proveedor}` : item.proveedor;
  }

  private mapIngresoOrdenDetalle(item: DataRecord, index: number): IngresoOrdenDetalleRow | null {
    const pedidoDetalleId = this.getNumberValue(item, ['Ped_Det_Id', 'ped_Det_Id', 'pedDetId']) ?? 0;
    const itemId = this.getNumberValue(item, ['Ped_Cod_Itm', 'ped_Cod_Itm', 'pedCodItm', 'Itm_Id', 'itm_Id', 'itmId']) ?? 0;

    if (!pedidoDetalleId && !itemId) {
      return null;
    }

    const compra = this.getDecimalValue(item, ['Ped_Can', 'ped_Can', 'pedCan']) ?? 0;
    const ingresado = this.getDecimalValue(item, ['Can_Ing', 'can_Ing', 'canIng', 'Alm_Det_Can', 'alm_Det_Can', 'almDetCan', 'Ingresado', 'ingresado']) ?? 0;
    const pendiente = Math.max(compra - ingresado, 0);
    const fechaDetalle = this.getTextValue(item, ['Alm_Det_Fec', 'alm_Det_Fec', 'almDetFec']);

    return {
      id: index + 1,
      almacenDetalleId: this.getNumberValue(item, ['Alm_Det_Id', 'alm_Det_Id', 'almDetId']) ?? 0,
      pedidoDetalleId,
      itemId,
      itemCodigo: this.getTextValue(item, ['Itm_Cod', 'itm_Cod', 'itmCod']) || (itemId ? String(itemId) : '-'),
      itemDescripcion: this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes']) || '-',
      unidadId: this.getNumberValue(item, ['Ped_Uni_Med', 'ped_Uni_Med', 'pedUniMed']) ?? 0,
      unidad: this.getTextValue(item, ['Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr', 'Uni_Med_Des', 'uni_Med_Des', 'uniMedDes']) || '-',
      centroCostoId: this.getNumberValue(item, ['Ped_Cen_Cos_Asg', 'ped_Cen_Cos_Asg', 'pedCenCosAsg']) ?? 0,
      centroCosto: this.getTextValue(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']) || '-',
      compra,
      ingresado,
      pendiente,
      serie: this.getTextValue(item, ['Alm_Ser', 'alm_Ser', 'almSer']),
      costoUnitario: this.getDecimalValue(item, [
        'Alm_Cos_Unit',
        'alm_Cos_Unit',
        'almCosUnit',
        'Alm_Cost_Unit',
        'alm_Cost_Unit',
        'almCostUnit'
      ]),
      documentoNumero: this.getTextValue(item, ['Alm_Det_Doc_Nro', 'alm_Det_Doc_Nro', 'almDetDocNro']),
      fechaDetalle: fechaDetalle ? formatDateRequestValue(fechaDetalle) : formatDateRequestValue(new Date()),
      cantidadIngresar: this.isIngresoOrdenEditMode ? ingresado : null,
      seleccionado: this.isIngresoOrdenEditMode
    };
  }

  private formatPedidoCodigo(pedidoId: number | null): string {
    return pedidoId ? `P${pedidoId}` : '-';
  }

  private formatNumeroIngresoOrden(ordenId: number, tipo: string): string {
    if (!ordenId) {
      return '-';
    }

    const normalizedTipo = tipo.trim().toLowerCase();
    const prefijo = this.esOrdenServicio(normalizedTipo) ? 'OSP' : 'OCP';
    return `${prefijo}${String(ordenId).padStart(5, '0')}`;
  }

  private mapSolicitanteOption(item: DataRecord): AlmacenSolicitanteOption | null {
    const id = this.getNumberValue(item, [
      'Usr_Id',
      'usr_Id',
      'usrId',
      'id',
      'Id',
      'Usr_Doc_Nro',
      'usr_Doc_Nro',
      'usrDocNro',
      'Usr_Doc',
      'usr_Doc',
      'usrDoc',
      'Usr_Dni',
      'usr_Dni',
      'usrDni',
      'Doc_Nro',
      'doc_Nro',
      'docNro',
      'Dni',
      'dni'
    ]);
    const code = this.getTextValue(item, ['Usr_Cod', 'usr_Cod', 'usrCod']);
    const documentNumber = this.getTextValue(item, [
      'Usr_Doc_Nro',
      'usr_Doc_Nro',
      'usrDocNro',
      'Usr_Doc',
      'usr_Doc',
      'usrDoc',
      'Usr_Dni',
      'usr_Dni',
      'usrDni',
      'Doc_Nro',
      'doc_Nro',
      'docNro',
      'Dni',
      'dni'
    ]);
    const name = this.getTextValue(item, ['Usr_Nom', 'usr_Nom', 'usrNom']);

    if (!id || !name) {
      return null;
    }

    return {
      id,
      code: code || String(id),
      documentNumber,
      name
    };
  }

  private mapCentroCostoOption(item: DataRecord): AlmacenCentroCostoOption | null {
    const id = this.getNumberValue(item, [
      'Cen_Cos_Id',
      'cen_Cos_Id',
      'cenCosId',
      'Cen_Cos_Cod',
      'cen_Cos_Cod',
      'cenCosCod',
      'codigo',
      'Codigo',
      'id',
      'Id'
    ]);
    const description = this.getTextValue(item, [
      'Cen_Cos_Des',
      'cen_Cos_Des',
      'cenCosDes',
      'descripcion',
      'Descripcion',
      'Cen_Cos_Nom',
      'cen_Cos_Nom',
      'cenCosNom'
    ]);

    if (!id || !description) {
      return null;
    }

    return {
      id,
      code: this.getTextValue(item, ['Cen_Cos_Cod', 'cen_Cos_Cod', 'cenCosCod', 'codigo', 'Codigo']) || String(id),
      description
    };
  }

  private mapItemOption(item: DataRecord): PedidoDetalleItemOption | null {
    const id = this.getNumberValue(item, [
      'Itm_Id',
      'itm_Id',
      'itmId',
      'id',
      'Id'
    ]);
    const description = this.getTextValue(item, [
      'Itm_Des',
      'itm_Des',
      'itmDes',
      'descripcion',
      'Descripcion',
      'Itm_Nom',
      'itm_Nom',
      'itmNom'
    ]);

    if (!id || !description) {
      return null;
    }

    return {
      id,
      code: String(id),
      description,
      groupDescription: this.getTextValue(item, ['Grp_Des', 'grp_Des', 'grpDes']) || 'Material',
      unitId: this.getNumberValue(item, ['Uni_Med_Id', 'uni_Med_Id', 'uniMedId']) ?? undefined,
      unitCode: this.getTextValue(item, ['Uni_Med_Id', 'uni_Med_Id', 'uniMedId', 'Uni_Med_Cod', 'uni_Med_Cod', 'uniMedCod']),
      unitDescription: this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr'])
    };
  }

  private mapSalidaItem(item: DataRecord): SalidaItemRow | null {
    const itemId = this.getNumberValue(item, ['Itm_Id', 'itm_Id', 'itmId', 'id', 'Id']);
    const descripcion = this.getTextValue(item, ['Itm_Des', 'itm_Des', 'itmDes', 'descripcion', 'Descripcion', 'Itm_Nom', 'itm_Nom', 'itmNom']);

    if (!itemId || !descripcion) {
      return null;
    }

    const stock = this.getStockValue(item);
    const reservado = this.getReservadoValue(item);
    const disponible = Math.max(stock - reservado, 0);

    return {
      itemId,
      itemCodigo: this.getTextValue(item, ['Itm_Cod', 'itm_Cod', 'itmCod']) || String(itemId),
      descripcion,
      unidadId: this.getNumberValue(item, ['Uni_Med_Id', 'uni_Med_Id', 'uniMedId']) ?? 0,
      unidadCodigo: this.getTextValue(item, ['Uni_Med_Cod', 'uni_Med_Cod', 'uniMedCod', 'Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr']),
      unidadDescripcion: this.getTextValue(item, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes', 'Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr']),
      grupo: this.getTextValue(item, ['Grp_Des', 'grp_Des', 'grpDes']) || '-',
      subGrupo: this.getTextValue(item, ['Sub_Grp_Des', 'sub_Grp_Des', 'subGrpDes']) || '-',
      detalleMaterial: this.getTextValue(item, ['Det_Mat_Des', 'det_Mat_Des', 'detMatDes']) || '-',
      stock,
      reservado,
      disponible
    };
  }

  private mapUnidadOption(item: DataRecord): PedidoDetalleUnidadOption | null {
    const id = this.getNumberValue(item, [
      'Uni_Med_Id',
      'uni_Med_Id',
      'uniMedId',
      'Uni_Med_Cod',
      'uni_Med_Cod',
      'uniMedCod',
      'codigo',
      'Codigo',
      'id',
      'Id'
    ]);
    const description = this.getTextValue(item, [
      'Uni_Med_Des',
      'uni_Med_Des',
      'uniMedDes',
      'descripcion',
      'Descripcion',
      'Uni_Med_Nom',
      'uni_Med_Nom',
      'uniMedNom'
    ]);

    if (!id || !description) {
      return null;
    }

    return {
      id,
      code: this.getTextValue(item, ['Uni_Med_Cod', 'uni_Med_Cod', 'uniMedCod', 'codigo', 'Codigo']) || String(id),
      description,
      abbreviation: this.getTextValue(item, ['Uni_Med_Abr', 'uni_Med_Abr', 'uniMedAbr']) || description
    };
  }

  private mapUbicacionOption(item: DataRecord): CatalogoNumeroOption | null {
    const id = this.getNumberValue(item, ['Ubi_Id', 'ubi_Id', 'ubiId', 'id', 'Id']);
    const description = this.getTextValue(item, ['Ubi_Des', 'ubi_Des', 'ubiDes', 'descripcion', 'Descripcion']);

    if (!id || !description) {
      return null;
    }

    return {
      codigo: id,
      descripcion: description
    };
  }

  private mapProveedorOption(item: DataRecord): ProviderRecord | null {
    const code = this.getNumberValue(item, ['Prv_Id', 'prv_Id', 'prvId', 'id', 'Id']);
    const name = this.getTextValue(item, ['Prv_Nom', 'prv_Nom', 'prvNom', 'Proveedor', 'proveedor']);

    if (!code || !name) {
      return null;
    }

    return {
      code,
      name,
      phone: this.getTextValue(item, ['Prv_Tel', 'prv_Tel', 'prvTel']),
      address: this.getTextValue(item, ['Prv_Dir', 'prv_Dir', 'prvDir']),
      contact: this.getTextValue(item, ['Prv_Nom_Con', 'prv_Nom_Con', 'prvNomCon']),
      ruc: this.getTextValue(item, ['Prv_Ruc', 'prv_Ruc', 'prvRuc']),
      email: this.getTextValue(item, ['Prv_Email', 'prv_Email', 'prvEmail']),
      bankCode: this.getNumberValue(item, ['Prv_Ban', 'prv_Ban', 'prvBan']) ?? 0,
      bankName: '',
      bankAccountNumber: this.getTextValue(item, ['Prv_Nro_Cue_Ban', 'prv_Nro_Cue_Ban', 'prvNroCueBan']),
      bankCci: this.getTextValue(item, ['Prv_Nro_Cue_Ban_CCI', 'prv_Nro_Cue_Ban_CCI', 'prvNroCueBanCci'])
    };
  }

  private resolveEstadoAprobacion(item: DataRecord): string {
    const text = this.getTextValue(item, [
      'Flg_Est_Apr_Des',
      'flg_Est_Apr_Des',
      'flgEstAprDes',
      'EstadoAprobacion',
      'estadoAprobacion',
      'Flg_Est_Apr',
      'flg_Est_Apr',
      'flgEstApr'
    ]);

    if (text) {
      return text;
    }

    const code = this.getTextValue(item, ['Flg_Est_Apr', 'flg_Est_Apr', 'flgEstApr']).toUpperCase();

    switch (code) {
      case 'I':
        return 'Ingresado';
      case 'S':
        return 'Salida';
      case 'P':
        return 'Pendiente';
      case 'C':
        return 'Cerrado';
      default:
        return '-';
    }
  }

  private resolveEstadoConsumo(item: DataRecord): string {
    return this.getTextValue(item, [
      'Flg_Est_Alm_Des',
      'flg_Est_Alm_Des',
      'flgEstAlmDes',
      'EstadoConsumo',
      'estadoConsumo',
      'Flg_Est_Alm',
      'flg_Est_Alm',
      'flgEstAlm'
    ]) || '-';
  }

  private resolveTipoIngresoDescripcion(tipoIngresoId: number): string {
    return this.tipoIngresoOptions.find((option) => option.codigo === tipoIngresoId)?.descripcion || '-';
  }

  private resolveCentroCostoDescripcion(centroCostoId: number): string {
    if (!centroCostoId) {
      return '-';
    }

    return this.centroCostoOptions.find((item) => item.id === centroCostoId)?.description || String(centroCostoId);
  }

  private resolveSolicitanteNombre(documento: string): string {
    const normalizedDocumento = documento.trim();

    if (!normalizedDocumento) {
      return '-';
    }

    const normalizedValue = normalizedDocumento.toLowerCase();
    return this.solicitanteOptions.find((item) =>
      item.code.trim().toLowerCase() === normalizedValue
      || item.documentNumber.trim().toLowerCase() === normalizedValue
    )?.name || normalizedDocumento;
  }

  private resolveUbicacionDescripcion(item: DataRecord): string {
    const ubicacionId = this.getTextValue(item, ['Alm_Ubi', 'alm_Ubi', 'almUbi']);

    switch (ubicacionId) {
      case '1':
        return 'BASE';
      case '2':
        return 'OBRA';
      default:
        return '-';
    }
  }

  private refrescarGridAlmacenConCatalogos(): void {
    if (!this.almacenes.length) {
      return;
    }

    this.almacenes = this.almacenes.map((item) => ({
      ...item,
      tipoIngreso: item.tipoIngreso && item.tipoIngreso !== `Tipo ${item.tipoIngresoId}`
        ? item.tipoIngreso
        : this.resolveTipoIngresoDescripcion(item.tipoIngresoId),
      centroCosto: item.centroCosto && item.centroCosto !== '-' ? item.centroCosto : this.resolveCentroCostoDescripcion(item.centroCostoId),
      registradoPor: item.registradoPor && item.registradoPor !== '-' ? item.registradoPor : this.resolveSolicitanteNombre(item.solicitanteDocumento)
    }));
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((value): value is DataRecord => this.isDataRecord(value));
    }

    if (!this.isDataRecord(response)) {
      return [];
    }

    const possibleArrayKeys = [
      'almacen',
      'Almacen',
      'movimientos',
      'Movimientos',
      'ordenCompra',
      'OrdenCompra',
      'ordenesCompra',
      'OrdenesCompra',
      'data',
      'Data',
      'result',
      'Result',
      'elements',
      'Elements'
    ];

    for (const key of possibleArrayKeys) {
      const value = response[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isDataRecord(item));
      }
    }

    return [response];
  }

  private extractAlmacenMovimientoIdFromResponse(response: unknown): number | null {
    if (typeof response === 'number' && Number.isInteger(response) && response > 0) {
      return response;
    }

    if (!this.isDataRecord(response)) {
      return null;
    }

    const directId = this.getNumberValue(response, ['Alm_Mov_Id', 'alm_Mov_Id', 'almMovId', 'Id', 'id']);

    if (directId) {
      return directId;
    }

    const dataAsId = this.getNumberValue(response, ['data', 'Data']);

    if (dataAsId) {
      return dataAsId;
    }

    const nestedKeys = ['almacen', 'Almacen', 'data', 'Data', 'result', 'Result', 'element', 'Element'];

    for (const key of nestedKeys) {
      const nestedValue = response[key];

      if (Array.isArray(nestedValue)) {
        for (const item of nestedValue) {
          if (!this.isDataRecord(item)) {
            continue;
          }

          const nestedId = this.getNumberValue(item, ['Alm_Mov_Id', 'alm_Mov_Id', 'almMovId', 'Id', 'id']);

          if (nestedId) {
            return nestedId;
          }
        }
      }

      if (!this.isDataRecord(nestedValue)) {
        continue;
      }

      const nestedId = this.getNumberValue(nestedValue, ['Alm_Mov_Id', 'alm_Mov_Id', 'almMovId', 'Id', 'id']);

      if (nestedId) {
        return nestedId;
      }
    }

    return null;
  }

  private assertSuccessfulResponse(response: unknown, fallbackMessage: string): void {
    if (!this.isDataRecord(response)) {
      return;
    }

    if (response['success'] === false || response['Success'] === false) {
      const message = this.getTextValue(response, ['message', 'Message']) || fallbackMessage;
      throw new Error(message);
    }
  }

  private getTextValue(item: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = this.findDataValue(item, key);

      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private getNumberValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = Number(this.findDataValue(item, key));

      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  private getDecimalValue(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const rawValue = this.findDataValue(item, key);
      const value = Number(rawValue);

      if (rawValue !== null && rawValue !== undefined && Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  private getOrdenCompraMoneyValue(item: DataRecord, keys: string[]): number {
    return this.normalizeOrdenCompraMoneyValue(this.getDecimalValue(item, keys));
  }

  private normalizeOrdenCompraMoneyValue(value: unknown): number {
    const monto = this.normalizeDecimal(value);

    if (monto >= 10000 && Number.isInteger(monto)) {
      return this.normalizeDecimal(monto / 100);
    }

    return monto;
  }

  private normalizeDecimal(value: unknown): number {
    const decimal = Number(value);

    if (!Number.isFinite(decimal) || decimal < 0) {
      return 0;
    }

    return Math.round(decimal * 100) / 100;
  }

  private getStockValue(item: DataRecord): number {
    const rawValue = this.findDataValue(item, 'Can_Stk')
      ?? this.findDataValue(item, 'can_Stk')
      ?? this.findDataValue(item, 'canStk')
      ?? this.findDataValue(item, 'Stock')
      ?? this.findDataValue(item, 'stock');
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : 0;
  }

  private getReservadoValue(item: DataRecord): number {
    const rawValue = this.findDataValue(item, 'Can_Res')
      ?? this.findDataValue(item, 'can_Res')
      ?? this.findDataValue(item, 'canRes')
      ?? this.findDataValue(item, 'Can_Reservado')
      ?? this.findDataValue(item, 'can_Reservado')
      ?? this.findDataValue(item, 'canReservado')
      ?? this.findDataValue(item, 'Reservado')
      ?? this.findDataValue(item, 'reservado');
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : 0;
  }

  private findDataValue(item: DataRecord, key: string): unknown {
    if (Object.prototype.hasOwnProperty.call(item, key)) {
      return item[key];
    }

    const normalizedKey = this.normalizeDataKey(key);
    const matchedKey = Object.keys(item).find((itemKey) => this.normalizeDataKey(itemKey) === normalizedKey);
    return matchedKey ? item[matchedKey] : undefined;
  }

  private normalizeDataKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }

  private resolveEstadoTexto(value: string): string {
    const code = value.trim().toUpperCase();

    switch (code) {
      case 'A':
        return 'Activo';
      case 'I':
        return 'Inactivo';
      default:
        return code || '-';
    }
  }

  private isDataRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private getSelectedSolicitante(): AlmacenSolicitanteOption | null {
    const solicitanteCode = String(this.ingresoDirectoForm.controls['solicitanteId'].value || '').trim().toLowerCase();
    return this.solicitanteOptions.find((item) => item.code.trim().toLowerCase() === solicitanteCode) ?? null;
  }

  private getInvalidIngresoDirectoControls(): string[] {
    return Object.entries(this.ingresoDirectoForm.controls)
      .filter(([, control]) => control.enabled && control.invalid)
      .map(([name]) => name);
  }

  private parseDateValue(value: string): Date {
    if (!value) {
      return this.getTodayDateValue();
    }

    const normalizedValue = formatDateRequestValue(value);

    if (!normalizedValue) {
      return this.getTodayDateValue();
    }

    const [year, month, day] = normalizedValue.split('-').map((part) => Number(part));

    if (!year || !month || !day) {
      return this.getTodayDateValue();
    }

    return new Date(year, month - 1, day);
  }

  private getTodayDateValue(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  private getCurrentOperator(): string {
    const currentUser = this.authService.getCurrentUser().trim();
    return currentUser || 'sistemas';
  }

  private resolveErrorMessage(error: unknown, fallbackMessage: string): string {
    const deadlockMessage =
      'La base de datos detecto un bloqueo temporal mientras se guardaba el ingreso a almacen. Intenta nuevamente en unos segundos.';

    if (error instanceof Error && error.message.trim()) {
      const message = error.message.trim();
      return this.isDeadlockMessage(message) ? deadlockMessage : message;
    }

    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) {
        const message = error.error.trim();
        return this.isDeadlockMessage(message) ? deadlockMessage : message;
      }

      if (this.isDataRecord(error.error)) {
        const message = this.getTextValue(error.error, ['message', 'Message']);

        if (message) {
          return this.isDeadlockMessage(message) ? deadlockMessage : message;
        }
      }
    }

    return fallbackMessage;
  }

  private isDeadlockMessage(message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes('deadlock') || normalizedMessage.includes('deadlocked on lock resources');
  }
}
