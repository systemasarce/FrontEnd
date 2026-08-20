import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import {
  ApiService,
  GuardarTransferenciaAlmacenRequest,
  RegistrarIngresoAlmacenDetalleRequest,
  RegistrarTransferenciaAlmacenRequest,
  TransferenciaAlmacenFiltro
} from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { GlobalVariable } from 'src/app/VarGlobals';

type DataRecord = Record<string, unknown>;

interface CentroCostoOption {
  id: number;
  description: string;
}

interface UsuarioOption {
  code: string;
  description: string;
}

interface ItemOption {
  id: number;
  code: string;
  description: string;
  unit: string;
  unitId: number;
}

interface TransferenciaRow {
  id: number;
  fecha: string;
  centroCosto: string;
  tipoMovimiento: string;
  solicitante: string;
  aprobador: string;
}

@Component({
  selector: 'app-transferencia-almacen-page',
  templateUrl: './transferencia-almacen-page.component.html',
  styleUrls: ['./transferencia-almacen-page.component.scss']
})
export class TransferenciaAlmacenPageComponent implements OnInit {
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  readonly form: FormGroup;
  readonly filtrosForm: FormGroup;
  readonly origenSearch = new FormControl('', { nonNullable: true });
  readonly destinoSearch = new FormControl('', { nonNullable: true });
  readonly solicitanteSearch = new FormControl('', { nonNullable: true });
  readonly aprobadorSearch = new FormControl('', { nonNullable: true });
  readonly filtroCentroSearch = new FormControl('', { nonNullable: true });
  readonly filtroDestinoSearch = new FormControl('', { nonNullable: true });
  readonly filtroSolicitanteSearch = new FormControl('', { nonNullable: true });
  readonly filtroAprobadorSearch = new FormControl('', { nonNullable: true });

  centrosCosto: CentroCostoOption[] = [];
  solicitantes: UsuarioOption[] = [];
  aprobadores: UsuarioOption[] = [];
  items: ItemOption[] = [];
  transferencias: TransferenciaRow[] = [];
  currentPage = 1;
  showEditor = false;
  editingId: number | null = null;
  editingStatus = 'P';
  isLoadingCatalogs = false;
  isLoadingList = false;
  isLoadingEdit = false;
  isSaving = false;
  pendingStockRequests = 0;
  errorMessage = '';
  actionMessage = '';
  editorErrorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.form = this.formBuilder.group({
      origenId: [0, [Validators.required, Validators.min(1)]],
      destinoId: [0, [Validators.required, Validators.min(1)]],
      solicitante: ['', Validators.required],
      aprobador: ['', Validators.required],
      detalles: this.formBuilder.array([])
    });
    this.filtrosForm = this.formBuilder.group({
      fechaInicio: [this.getFirstDayOfCurrentMonth()],
      fechaFin: [this.getToday()],
      solicitante: [''],
      centroCosto: [0],
      destino: [0],
      tipoIngreso: [0],
      aprobador: [''],
      movimientoOrigen: [0]
    });
  }

  ngOnInit(): void {
    this.resetDetalles();
    this.form.controls['origenId'].valueChanges.subscribe((originValue) => {
      if (Number(this.form.controls['destinoId'].value) === Number(originValue)) {
        this.form.controls['destinoId'].setValue(0);
      }
      this.actualizarStockDetalles();
    });
    this.cargarCatalogos();
    this.cargarTransferencias();
  }

  get detallesForm(): FormArray {
    return this.form.controls['detalles'] as FormArray;
  }

  get detailRows(): FormGroup[] {
    return this.detallesForm.controls as FormGroup[];
  }

  get paginatedTransferencias(): TransferenciaRow[] {
    return paginateItems(this.transferencias, this.currentPage, this.pageSize);
  }

  get filteredOrigenes(): CentroCostoOption[] {
    return this.filterCentros(this.origenSearch.value);
  }

  get filteredDestinos(): CentroCostoOption[] {
    const originId = Number(this.form.controls['origenId'].value || 0);
    return this.filterCentros(this.destinoSearch.value).filter((item) => item.id !== originId);
  }

  get filteredSolicitantes(): UsuarioOption[] {
    return this.filterUsuarios(this.solicitantes, this.solicitanteSearch.value);
  }

  get filteredAprobadores(): UsuarioOption[] {
    return this.filterUsuarios(this.aprobadores, this.aprobadorSearch.value);
  }

  get filteredFiltroCentros(): CentroCostoOption[] {
    return this.filterCentros(this.filtroCentroSearch.value);
  }

  get filteredFiltroDestinos(): CentroCostoOption[] {
    return this.filterCentros(this.filtroDestinoSearch.value);
  }

  get filteredFiltroSolicitantes(): UsuarioOption[] {
    return this.filterUsuarios(this.solicitantes, this.filtroSolicitanteSearch.value);
  }

  get filteredFiltroAprobadores(): UsuarioOption[] {
    return this.filterUsuarios(this.aprobadores, this.filtroAprobadorSearch.value);
  }

  get editorTitle(): string {
    return this.editingId === null ? 'Nueva transferencia de almacén' : `Editar transferencia N.° ${this.editingId}`;
  }

  nuevaTransferencia(): void {
    this.editingId = null;
    this.editingStatus = 'P';
    this.errorMessage = '';
    this.editorErrorMessage = '';
    this.form.reset({ origenId: 0, destinoId: 0, solicitante: '', aprobador: '' });
    this.resetDetalles();
    this.showEditor = true;
  }

  cancelar(): void {
    if (this.isSaving) {
      return;
    }
    this.showEditor = false;
    this.editingId = null;
    this.editorErrorMessage = '';
  }

  agregarDetalle(): void {
    this.detallesForm.push(this.createDetailGroup());
  }

  quitarDetalle(index: number): void {
    if (this.detallesForm.length === 1) {
      this.detallesForm.at(0).reset({ itemId: 0, itemSearch: '', stock: 0, cantidad: 1, detailId: 0, loadingStock: false });
      return;
    }
    this.detallesForm.removeAt(index);
  }

  filteredItems(index: number): ItemOption[] {
    const row = this.detailRows[index];
    const search = this.normalize(row?.controls['itemSearch'].value);
    return this.items.filter((item) => !search || this.normalize(`${item.code} ${item.description}`).includes(search));
  }

  onItemChange(index: number): void {
    const selectedId = Number(this.detailRows[index]?.controls['itemId'].value || 0);
    this.detailRows.forEach((row, rowIndex) => {
      if (rowIndex !== index && selectedId > 0 && Number(row.controls['itemId'].value) === selectedId) {
        this.detailRows[index].patchValue({ itemId: 0, stock: 0 });
        this.editorErrorMessage = 'El ítem seleccionado ya se encuentra agregado en el detalle.';
      }
    });
    if (Number(this.detailRows[index]?.controls['itemId'].value || 0) > 0) {
      this.editorErrorMessage = '';
      this.cargarStock(index);
    }
  }

  guardar(): void {
    this.editorErrorMessage = '';
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      this.editorErrorMessage = 'Completa los campos obligatorios de la transferencia.';
      return;
    }

    const origenId = Number(this.form.controls['origenId'].value);
    const destinoId = Number(this.form.controls['destinoId'].value);
    if (origenId === destinoId) {
      this.editorErrorMessage = 'El almacén de origen y el almacén de destino deben ser diferentes.';
      return;
    }

    const invalidDetail = this.detailRows.find((row) => {
      const itemId = Number(row.controls['itemId'].value);
      const quantity = Number(row.controls['cantidad'].value);
      return itemId <= 0 || quantity <= 0;
    });
    if (invalidDetail) {
      this.editorErrorMessage = 'Revisa el detalle: selecciona un ítem e ingresa una cantidad mayor que cero.';
      return;
    }

    const currentUser = this.getCurrentUser();
    this.isSaving = true;

    if (this.editingId === null) {
      this.registrarMovimientosTransferencia(origenId, destinoId, currentUser);
      return;
    }

    const payload: GuardarTransferenciaAlmacenRequest = {
      Trf_Id: this.editingId,
      Usr_Mod: currentUser,
      Trf_Cen_Cos_Ori: origenId,
      Trf_Cen_Cos_Des: destinoId,
      Trf_Sol: String(this.form.controls['solicitante'].value || ''),
      Trf_Usr_Apr: String(this.form.controls['aprobador'].value || ''),
      Flg_Est: this.editingStatus,
      Detalles: this.detailRows.map((row) => ({
        ...(Number(row.controls['detailId'].value) > 0 ? { Trf_Det_Id: Number(row.controls['detailId'].value) } : {}),
        Trf_Det_Itm_Id: Number(row.controls['itemId'].value),
        Trf_Det_Can: Number(row.controls['cantidad'].value)
      }))
    };

    const request$ = this.apiService.actualizarTransferenciaAlmacen(payload);
    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.showEditor = false;
        this.cargarTransferencias();
      },
      error: (error: unknown) => {
        this.editorErrorMessage = this.resolveError(error, 'No se pudo guardar la transferencia de almacén.');
        this.isSaving = false;
      }
    });
  }

  private registrarMovimientosTransferencia(origenId: number, destinoId: number, currentUser: string): void {
    const solicitante = String(this.form.controls['solicitante'].value || '');
    const aprobador = String(this.form.controls['aprobador'].value || '');
    const commonHeader = {
      Alm_Ubi: 1,
      Alm_Sol_Dni: solicitante,
      Usr_Reg: currentUser,
      Alm_Destino: destinoId,
      Alm_Usr_Apr: aprobador
    };
    const salida: RegistrarTransferenciaAlmacenRequest = {
      ...commonHeader,
      Alm_Cen_Cos: origenId,
      Alm_Tip_Ing: 5,
      Alm_Mov_Ori: 0
    };

    this.apiService.registrarTransferenciaAlmacen(salida).pipe(
      map((response) => this.requireMovementId(response, 'salida')),
      switchMap((salidaId) => this.registrarDetallesMovimiento(salidaId, origenId, currentUser).pipe(map(() => salidaId))),
      switchMap((salidaId) => {
        const ingreso: RegistrarTransferenciaAlmacenRequest = {
          ...commonHeader,
          Alm_Cen_Cos: destinoId,
          Alm_Tip_Ing: 6,
          Alm_Mov_Ori: salidaId
        };
        return this.apiService.registrarTransferenciaAlmacen(ingreso);
      }),
      map((response) => this.requireMovementId(response, 'ingreso')),
      switchMap((ingresoId) => this.registrarDetallesMovimiento(ingresoId, destinoId, currentUser))
    ).subscribe({
      next: () => {
        this.isSaving = false;
        this.showEditor = false;
        this.cargarTransferencias();
      },
      error: (error: unknown) => {
        this.editorErrorMessage = this.resolveError(error, 'No se pudo completar la transferencia de almacén.');
        this.isSaving = false;
      }
    });
  }

  private registrarDetallesMovimiento(movementId: number, costCenterId: number, currentUser: string) {
    const today = this.getToday();
    const requests = this.detailRows.map((row) => {
      const itemId = Number(row.controls['itemId'].value);
      const item = this.items.find((option) => option.id === itemId);
      const detail: RegistrarIngresoAlmacenDetalleRequest = {
        Alm_Mov_Id: movementId,
        Alm_Det_Itm_Id: itemId,
        Alm_Det_Uni_Med_Id: item?.unitId ?? 0,
        Alm_Det_Can: Number(row.controls['cantidad'].value),
        Alm_Det_Doc_Nro: '',
        Alm_Det_Fec: today,
        Alm_Det_Cen_Cos_Id: costCenterId,
        Alm_Det_Prv_Id: null,
        Alm_Ser: null,
        Alm_Cos_Unit: null,
        Usr_Reg: currentUser
      };
      return this.apiService.postRegistrarIngresoAlmacenDetalle(detail);
    });
    return forkJoin(requests);
  }

  private requireMovementId(response: unknown, movementName: string): number {
    if (!this.isRecord(response)) {
      throw new Error(`El backend no devolvió el número de movimiento de ${movementName}.`);
    }
    const movementId = this.number(response, ['Data', 'data', 'Alm_Mov_Id', 'alm_Mov_Id', 'almMovId']);
    if (movementId <= 0) {
      throw new Error(`El backend no devolvió el número de movimiento de ${movementName}.`);
    }
    return movementId;
  }

  editar(row: TransferenciaRow): void {
    if (this.isLoadingEdit) {
      return;
    }
    this.isLoadingEdit = true;
    this.errorMessage = '';
    this.apiService.getCargarTransferenciaAlmacenModificar(row.id).subscribe({
      next: (response: unknown) => {
        const records = this.extractRecords(response);
        if (!records.length) {
          this.errorMessage = 'No se encontraron datos para editar la transferencia.';
          this.isLoadingEdit = false;
          return;
        }
        const header = records[0];
        this.editingId = row.id;
        this.editingStatus = this.text(header, ['Flg_Est', 'flg_Est', 'flgEst']) || 'P';
        this.form.patchValue({
          origenId: this.number(header, ['Trf_Cen_Cos_Ori', 'trf_Cen_Cos_Ori', 'trfCenCosOri']),
          destinoId: this.number(header, ['Trf_Cen_Cos_Des', 'trf_Cen_Cos_Des', 'trfCenCosDes']),
          solicitante: this.text(header, ['Trf_Sol', 'trf_Sol', 'trfSol']),
          aprobador: this.text(header, ['Trf_Usr_Apr', 'trf_Usr_Apr', 'trfUsrApr'])
        });
        this.detallesForm.clear();
        records.forEach((record) => {
          const itemId = this.number(record, ['Trf_Det_Itm_Id', 'trf_Det_Itm_Id', 'trfDetItmId']);
          if (itemId > 0 && !this.detailRows.some((detail) => Number(detail.controls['itemId'].value) === itemId)) {
            this.detallesForm.push(this.createDetailGroup({
              itemId,
              cantidad: this.number(record, ['Trf_Det_Can', 'trf_Det_Can', 'trfDetCan']),
              detailId: this.number(record, ['Trf_Det_Id', 'trf_Det_Id', 'trfDetId'])
            }));
          }
        });
        if (!this.detallesForm.length) {
          this.agregarDetalle();
        }
        this.showEditor = true;
        this.isLoadingEdit = false;
        this.actualizarStockDetalles();
      },
      error: (error: unknown) => {
        this.errorMessage = this.resolveError(error, 'No se pudo cargar la transferencia para editar.');
        this.isLoadingEdit = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.transferencias.length, this.pageSize);
  }

  buscarTransferencias(): void {
    this.actionMessage = '';
    this.currentPage = 1;
    this.cargarTransferencias();
  }

  aprobar(row: TransferenciaRow): void {
    this.actionMessage = `La transferencia N.° ${row.id} está lista para aprobarse cuando se publique el endpoint correspondiente.`;
  }

  rechazar(row: TransferenciaRow): void {
    this.actionMessage = `La transferencia N.° ${row.id} está lista para rechazarse cuando se publique el endpoint correspondiente.`;
  }

  limpiarFiltros(): void {
    this.filtrosForm.reset({
      fechaInicio: this.getFirstDayOfCurrentMonth(),
      fechaFin: this.getToday(),
      solicitante: '',
      centroCosto: 0,
      destino: 0,
      tipoIngreso: 0,
      aprobador: '',
      movimientoOrigen: 0
    });
    this.filtroCentroSearch.setValue('');
    this.filtroDestinoSearch.setValue('');
    this.filtroSolicitanteSearch.setValue('');
    this.filtroAprobadorSearch.setValue('');
    this.buscarTransferencias();
  }

  trackByOption(_: number, item: CentroCostoOption | ItemOption): number {
    return item.id;
  }

  trackByUser(_: number, item: UsuarioOption): string {
    return item.code;
  }

  trackByTransfer(_: number, row: TransferenciaRow): number {
    return row.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private createDetailGroup(value?: { itemId: number; cantidad: number; detailId: number }): FormGroup {
    return this.formBuilder.group({
      itemId: [value?.itemId ?? 0, [Validators.required, Validators.min(1)]],
      itemSearch: [''],
      stock: [{ value: 0, disabled: true }],
      cantidad: [value?.cantidad ?? 1, [Validators.required, Validators.min(0.001)]],
      detailId: [value?.detailId ?? 0],
      loadingStock: [false]
    });
  }

  private resetDetalles(): void {
    this.detallesForm.clear();
    this.agregarDetalle();
  }

  private cargarCatalogos(): void {
    this.isLoadingCatalogs = true;
    forkJoin({
      centros: this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }).pipe(catchError(() => of([]))),
      solicitantes: this.apiService.getListarUsuarioActivo({ Flg_Est: 'A' }).pipe(catchError(() => of([]))),
      aprobadores: this.apiService.getObtenerUsuariosAprobacion('S').pipe(catchError(() => of([]))),
      items: this.apiService.getListarItem({ Itm_Tip: 'AC', Flg_Est: 'A' }).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ centros, solicitantes, aprobadores, items }) => {
        this.centrosCosto = this.extractRecords(centros).map((record) => ({
          id: this.number(record, ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId']),
          description: this.text(record, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes'])
        })).filter((item) => item.id > 0);
        this.solicitantes = this.mapUsuarios(solicitantes);
        this.aprobadores = this.mapUsuarios(aprobadores);
        this.items = this.extractRecords(items)
          .filter((record) => this.text(record, ['Itm_Tip', 'itm_Tip', 'itmTip']).toUpperCase() === 'AC')
          .map((record) => ({
            id: this.number(record, ['Itm_Id', 'itm_Id', 'itmId']),
            code: this.text(record, ['Itm_Cod', 'itm_Cod', 'itmCod']),
            description: this.text(record, ['Itm_Des', 'itm_Des', 'itmDes']),
            unit: this.text(record, ['Uni_Med_Des', 'uni_Med_Des', 'uniMedDes']),
            unitId: this.number(record, ['Uni_Med_Id', 'uni_Med_Id', 'uniMedId'])
          }))
          .filter((item) => item.id > 0);
        this.isLoadingCatalogs = false;
      }
    });
  }

  private cargarTransferencias(): void {
    this.isLoadingList = true;
    this.errorMessage = '';
    this.apiService.getListarTransferenciaAlmacen(this.getFiltrosTransferencia()).subscribe({
      next: (response: unknown) => {
        this.transferencias = this.extractRecords(response).map((record) => this.mapTransferencia(record)).filter((item): item is TransferenciaRow => item !== null);
        this.currentPage = normalizePaginationPage(this.currentPage, this.transferencias.length, this.pageSize);
        this.isLoadingList = false;
      },
      error: (error: unknown) => {
        this.transferencias = [];
        this.errorMessage = this.resolveError(error, 'No se pudieron cargar las transferencias de almacén.');
        this.isLoadingList = false;
      }
    });
  }

  private actualizarStockDetalles(): void {
    this.detailRows.forEach((_, index) => this.cargarStock(index));
  }

  private cargarStock(index: number): void {
    const row = this.detailRows[index];
    const originId = Number(this.form.controls['origenId'].value || 0);
    const itemId = Number(row?.controls['itemId'].value || 0);
    if (!row || originId <= 0 || itemId <= 0) {
      row?.patchValue({ stock: 0, loadingStock: false });
      return;
    }

    row.patchValue({ loadingStock: true });
    this.pendingStockRequests++;
    this.apiService.getListarStocksItems(originId, itemId).subscribe({
      next: (response: unknown) => {
        if (Number(this.form.controls['origenId'].value) === originId && Number(row.controls['itemId'].value) === itemId) {
          const stockRecord = this.extractRecords(response)[0];
          row.patchValue({ stock: stockRecord ? this.number(stockRecord, ['Disponible', 'disponible', 'Can_Stk', 'can_Stk']) : 0 });
        }
        row.patchValue({ loadingStock: false });
        this.pendingStockRequests = Math.max(0, this.pendingStockRequests - 1);
      },
      error: () => {
        row.patchValue({ stock: 0, loadingStock: false });
        this.pendingStockRequests = Math.max(0, this.pendingStockRequests - 1);
      }
    });
  }

  private mapTransferencia(record: DataRecord): TransferenciaRow | null {
    const id = this.number(record, ['Alm_Mov_Id', 'alm_Mov_Id', 'almMovId', 'Trf_Id', 'trf_Id', 'trfId']);
    if (id <= 0) {
      return null;
    }
    return {
      id,
      fecha: formatDisplayDate(this.text(record, ['Fec_Reg', 'fec_Reg', 'fecReg'])),
      centroCosto: this.text(record, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']),
      tipoMovimiento: this.text(record, ['Ing_Des', 'ing_Des', 'ingDes']),
      solicitante: this.text(record, ['Solicitante', 'solicitante', 'Alm_Sol_Dni', 'alm_Sol_Dni']),
      aprobador: this.text(record, ['Aprobador', 'aprobador', 'Alm_Usr_Apr', 'alm_Usr_Apr'])
    };
  }

  private getFiltrosTransferencia(): TransferenciaAlmacenFiltro {
    return {
      Fec_Ini: String(this.filtrosForm.controls['fechaInicio'].value || ''),
      Fec_Fin: String(this.filtrosForm.controls['fechaFin'].value || ''),
      Alm_Sol_Dni: String(this.filtrosForm.controls['solicitante'].value || '').trim(),
      Alm_Cen_Cos: Number(this.filtrosForm.controls['centroCosto'].value || 0),
      Alm_Destino: Number(this.filtrosForm.controls['destino'].value || 0),
      Alm_Tip_Ing: Number(this.filtrosForm.controls['tipoIngreso'].value || 0),
      Alm_Usr_Apr: String(this.filtrosForm.controls['aprobador'].value || '').trim(),
      Alm_Mov_Ori: Number(this.filtrosForm.controls['movimientoOrigen'].value || 0)
    };
  }

  private mapUsuarios(response: unknown): UsuarioOption[] {
    return this.extractRecords(response).map((record) => ({
      code: this.text(record, ['Usr_Cod', 'usr_Cod', 'usrCod']),
      description: this.text(record, ['Usr_Nom', 'usr_Nom', 'usrNom'])
    })).filter((item) => Boolean(item.code));
  }

  private filterCentros(searchValue: string): CentroCostoOption[] {
    const search = this.normalize(searchValue);
    return this.centrosCosto.filter((item) => !search || this.normalize(`${item.id} ${item.description}`).includes(search));
  }

  private filterUsuarios(options: UsuarioOption[], searchValue: string): UsuarioOption[] {
    const search = this.normalize(searchValue);
    return options.filter((item) => !search || this.normalize(`${item.code} ${item.description}`).includes(search));
  }

  private normalize(value: unknown): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is DataRecord => this.isRecord(item));
    }
    if (!this.isRecord(response)) {
      return [];
    }
    for (const key of ['Elements', 'elements', 'Data', 'data', 'Result', 'result']) {
      if (Array.isArray(response[key])) {
        return (response[key] as unknown[]).filter((item): item is DataRecord => this.isRecord(item));
      }
    }
    return [];
  }

  private text(record: DataRecord, keys: string[]): string {
    for (const key of keys) {
      if (record[key] !== null && record[key] !== undefined && String(record[key]).trim()) {
        return String(record[key]).trim();
      }
    }
    return '';
  }

  private number(record: DataRecord, keys: string[]): number {
    const value = Number(this.text(record, keys));
    return Number.isFinite(value) ? value : 0;
  }

  private getCurrentUser(): string {
    const globalUser = String(GlobalVariable.vusu || '').trim();
    return globalUser || this.authService.getCurrentUser().trim() || 'sistemas';
  }

  private getToday(): string {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private getFirstDayOfCurrentMonth(): string {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return new Date(firstDay.getTime() - firstDay.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private resolveError(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (error instanceof HttpErrorResponse && this.isRecord(error.error)) {
      return this.text(error.error, ['Message', 'message', 'title']) || fallback;
    }
    return fallback;
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
