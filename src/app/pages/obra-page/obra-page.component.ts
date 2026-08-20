import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import {
  ActualizarFechaObraRequest,
  ActualizarObraRequest,
  ApiService,
  ObraFiltro,
  RegistrarObraRequest
} from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { DEFAULT_GRID_PAGE_SIZE, normalizePaginationPage, paginateItems } from 'src/app/shared/utils/pagination.utils';
import { formatDateInputValue, formatDateRequestValue, formatDisplayDate } from 'src/app/shared/utils/date.utils';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';
import { GlobalVariable } from 'src/app/VarGlobals';

type DataRecord = Record<string, unknown>;

interface ObraOption {
  id: number;
  description: string;
}

interface ObraUsuarioOption {
  code: string;
  description: string;
}

interface ObraRow {
  id: number;
  nombre: string;
  centroCosto: string;
  cliente: string;
  responsable: string;
  estadoCodigo: string;
  estado: string;
  fechaApertura: string;
  fechaInicio: string;
  fechaInicioInput: string;
  fechaFin: string;
  fechaFinInput: string;
  fechaCierre: string;
  fechaCierreInput: string;
}

type ObraDateField = 'inicio' | 'fin' | 'cierre';

@Component({
  selector: 'app-obra-page',
  templateUrl: './obra-page.component.html',
  styleUrls: ['./obra-page.component.scss']
})
export class ObraPageComponent implements OnInit {
  readonly pageSize = DEFAULT_GRID_PAGE_SIZE;
  readonly estados = [
    { code: 'EP', label: 'En proyecto' },
    { code: 'EE', label: 'En ejecución' },
    { code: 'FI', label: 'Finalizado' },
    { code: 'CA', label: 'Cancelado' }
  ];
  readonly filtroCentroCostoSearchControl = new FormControl('', { nonNullable: true });
  readonly filtroClienteSearchControl = new FormControl('', { nonNullable: true });
  readonly filtroEstadoSearchControl = new FormControl('', { nonNullable: true });
  readonly filtroResponsableSearchControl = new FormControl('', { nonNullable: true });
  readonly editorCentroCostoSearchControl = new FormControl('', { nonNullable: true });
  readonly editorClienteSearchControl = new FormControl('', { nonNullable: true });
  readonly editorResponsableSearchControl = new FormControl('', { nonNullable: true });
  readonly filtersForm: FormGroup;
  readonly form: FormGroup;

  obras: ObraRow[] = [];
  centrosCosto: ObraOption[] = [];
  clientes: ObraOption[] = [];
  usuarios: ObraUsuarioOption[] = [];
  currentPage = 1;
  isLoading = false;
  isLoadingCatalogs = false;
  isLoadingEditor = false;
  isSaving = false;
  showEditor = false;
  editingObraId: number | null = null;
  errorMessage = '';
  editorErrorMessage = '';
  savingDateKey = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly authService: AuthService
  ) {
    this.filtersForm = this.formBuilder.group({
      id: [''],
      centroCosto: [0],
      nombre: [''],
      ubicacion: [''],
      area: [''],
      cliente: [0],
      estado: [''],
      responsable: ['']
    });

    this.form = this.formBuilder.group({
      centroCosto: [null, Validators.required],
      nombre: ['', [Validators.required, noWhitespaceValidator(), Validators.maxLength(250)]],
      ubicacion: ['', Validators.maxLength(250)],
      area: ['', Validators.maxLength(250)],
      cliente: [null, Validators.required],
      codigoContrato: ['', Validators.maxLength(255)],
      fechaApertura: [formatDateRequestValue(new Date()), Validators.required],
      responsable: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.buscar();
  }

  get paginatedObras(): ObraRow[] {
    return paginateItems(this.obras, this.currentPage, this.pageSize);
  }

  get editorTitle(): string {
    return this.editingObraId === null ? 'Registrar obra' : `Editar obra N.° ${this.editingObraId}`;
  }

  get filteredFiltroCentrosCosto(): ObraOption[] {
    return this.filterOptions(this.centrosCosto, this.filtroCentroCostoSearchControl.value);
  }

  get filteredEditorCentrosCosto(): ObraOption[] {
    return this.filterOptions(this.centrosCosto, this.editorCentroCostoSearchControl.value);
  }

  get filteredFiltroClientes(): ObraOption[] {
    return this.filterOptions(this.clientes, this.filtroClienteSearchControl.value);
  }

  get filteredEditorClientes(): ObraOption[] {
    return this.filterOptions(this.clientes, this.editorClienteSearchControl.value);
  }

  get filteredFiltroResponsables(): ObraUsuarioOption[] {
    return this.filterUsuarios(this.filtroResponsableSearchControl.value);
  }

  get filteredEditorResponsables(): ObraUsuarioOption[] {
    return this.filterUsuarios(this.editorResponsableSearchControl.value);
  }

  get filteredEstados(): Array<{ code: string; label: string }> {
    const search = this.normalizeSearch(this.filtroEstadoSearchControl.value);
    return search
      ? this.estados.filter((item) => this.normalizeSearch(`${item.code} ${item.label}`).includes(search))
      : this.estados;
  }

  buscar(): void {
    if (this.isLoading) {
      return;
    }

    const idRaw = String(this.filtersForm.controls['id'].value ?? '').trim();
    if (idRaw && (!Number.isInteger(Number(idRaw)) || Number(idRaw) <= 0)) {
      this.errorMessage = 'El ID de obra debe ser un número entero mayor que cero.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getListarObra(this.getFilters()).subscribe({
      next: (response: unknown) => {
        this.obras = this.extractRecords(response)
          .map((item) => this.mapObra(item))
          .filter((item): item is ObraRow => item !== null);
        this.currentPage = normalizePaginationPage(this.currentPage, this.obras.length, this.pageSize);
        this.isLoading = false;
      },
      error: (error: unknown) => {
        if (this.isNoInformationResponse(error)) {
          this.obras = [];
          this.currentPage = 1;
        } else {
          this.errorMessage = this.resolveError(error, 'No se pudo consultar las obras.');
        }
        this.isLoading = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.filtersForm.reset({
      id: '',
      centroCosto: 0,
      nombre: '',
      ubicacion: '',
      area: '',
      cliente: 0,
      estado: '',
      responsable: ''
    });
    this.currentPage = 1;
    this.buscar();
  }

  nuevaObra(): void {
    this.editingObraId = null;
    this.editorErrorMessage = '';
    this.form.reset({
      centroCosto: null,
      nombre: '',
      ubicacion: '',
      area: '',
      cliente: null,
      codigoContrato: '',
      fechaApertura: formatDateRequestValue(new Date()),
      responsable: ''
    });
    this.showEditor = true;
  }

  editarObra(obra: ObraRow): void {
    if (this.isLoadingEditor) {
      return;
    }

    this.isLoadingEditor = true;
    this.editorErrorMessage = '';

    this.apiService.getCargarObraModificar(obra.id).subscribe({
      next: (response: unknown) => {
        const record = this.extractRecords(response)[0];

        if (!record) {
          this.errorMessage = 'No se encontraron los datos completos de la obra seleccionada.';
          this.isLoadingEditor = false;
          return;
        }

        this.editingObraId = obra.id;
        this.form.reset({
          centroCosto: this.getNumber(record, ['Obr_Cen_Cos', 'obr_Cen_Cos', 'obrCenCos']),
          nombre: this.getText(record, ['Obr_Nom', 'obr_Nom', 'obrNom']),
          ubicacion: this.getText(record, ['Obr_Ubi', 'obr_Ubi', 'obrUbi']),
          area: this.getText(record, ['Obr_Are', 'obr_Are', 'obrAre']),
          cliente: this.getNumber(record, ['Obr_Cli_Id', 'obr_Cli_Id', 'obrCliId']),
          codigoContrato: this.getText(record, ['Obr_Cod_Con', 'obr_Cod_Con', 'obrCodCon']),
          fechaApertura: formatDateInputValue(this.getText(record, ['Obr_Fec_Ape', 'obr_Fec_Ape', 'obrFecApe'])),
          responsable: this.getText(record, ['Obr_Rsp', 'obr_Rsp', 'obrRsp'])
        });
        this.showEditor = true;
        this.isLoadingEditor = false;
      },
      error: (error: unknown) => {
        this.errorMessage = this.resolveError(error, 'No se pudo cargar la obra para editar.');
        this.isLoadingEditor = false;
      }
    });
  }

  guardar(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    const centroCosto = Number(this.form.controls['centroCosto'].value);
    const cliente = Number(this.form.controls['cliente'].value);
    const fechaApertura = formatDateRequestValue(this.form.controls['fechaApertura'].value);

    if (!Number.isInteger(centroCosto) || centroCosto <= 0 || !Number.isInteger(cliente) || cliente <= 0 || !fechaApertura) {
      this.editorErrorMessage = 'Completa los datos obligatorios de la obra.';
      return;
    }

    this.isSaving = true;
    this.editorErrorMessage = '';
    const commonPayload = {
      Obr_Cen_Cos: centroCosto,
      Obr_Nom: this.controlText('nombre'),
      Obr_Ubi: this.optionalControlText('ubicacion'),
      Obr_Are: this.optionalControlText('area'),
      Obr_Cli_Id: cliente,
      Obr_Cod_Con: this.optionalControlText('codigoContrato'),
      Obr_Fec_Ape: fechaApertura,
      Obr_Rsp: this.controlText('responsable')
    };

    const request$ = this.editingObraId === null
      ? this.apiService.registrarObra({
          ...commonPayload,
          Flg_Est: 'EP',
          Usr_Reg: this.getCurrentOperator()
        } as RegistrarObraRequest)
      : this.apiService.actualizarObra({
          ...commonPayload,
          Obr_Id: this.editingObraId,
          Usr_Mod: this.getCurrentOperator()
        } as ActualizarObraRequest);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.showEditor = false;
        this.buscar();
      },
      error: (error: unknown) => {
        this.editorErrorMessage = this.resolveError(error, 'No se pudo guardar la obra.');
        this.isSaving = false;
      }
    });
  }

  cancelarEdicion(): void {
    if (!this.isSaving) {
      this.showEditor = false;
      this.editingObraId = null;
      this.editorErrorMessage = '';
    }
  }

  onPageChange(page: number): void {
    this.currentPage = normalizePaginationPage(page, this.obras.length, this.pageSize);
  }

  actualizarFecha(obra: ObraRow, field: ObraDateField): void {
    const value = field === 'inicio'
      ? obra.fechaInicioInput
      : field === 'fin'
        ? obra.fechaFinInput
        : obra.fechaCierreInput;

    const formattedDate = formatDateRequestValue(value);
    if (!formattedDate) {
      this.errorMessage = 'Selecciona una fecha válida antes de actualizar.';
      return;
    }

    const payload: ActualizarFechaObraRequest = {
      Obr_Id: obra.id,
      Usr_Mod: this.getCurrentOperator(),
      ...(field === 'inicio' ? { Obr_Fec_Ini: formattedDate } : {}),
      ...(field === 'fin' ? { Obr_Fec_Fin: formattedDate } : {}),
      ...(field === 'cierre' ? { Obr_Fec_Cie: formattedDate } : {})
    };

    this.errorMessage = '';
    this.savingDateKey = this.getDateSaveKey(obra.id, field);
    const request$ = field === 'inicio'
      ? this.apiService.actualizarFechaInicioObra(payload)
      : field === 'fin'
        ? this.apiService.actualizarFechaFinObra(payload)
        : this.apiService.actualizarFechaCierreObra(payload);

    request$.subscribe({
      next: () => {
        const displayDate = formatDisplayDate(formattedDate);
        if (field === 'inicio') {
          obra.fechaInicio = displayDate;
        } else if (field === 'fin') {
          obra.fechaFin = displayDate;
        } else {
          obra.fechaCierre = displayDate;
        }
        this.savingDateKey = '';
      },
      error: (error: unknown) => {
        this.errorMessage = this.resolveError(error, 'No se pudo actualizar la fecha de la obra.');
        this.savingDateKey = '';
      }
    });
  }

  isSavingDate(obraId: number, field: ObraDateField): boolean {
    return this.savingDateKey === this.getDateSaveKey(obraId, field);
  }

  sanitizeId(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/\D/g, '');
    if (sanitized !== input.value) {
      input.value = sanitized;
      this.filtersForm.controls['id'].setValue(sanitized, { emitEvent: false });
    }
  }

  trackByObra(_index: number, obra: ObraRow): number {
    return obra.id;
  }

  trackByOption(_index: number, option: ObraOption): number {
    return option.id;
  }

  trackByUsuario(_index: number, option: ObraUsuarioOption): string {
    return option.code;
  }

  onSelectOpened(opened: boolean, searchControl: FormControl<string>): void {
    if (opened) {
      searchControl.setValue('');
    }
  }

  private cargarCatalogos(): void {
    this.isLoadingCatalogs = true;
    forkJoin({
      centros: this.apiService.getListarCentroCostoActivo({ Flg_Est: 'A' }).pipe(catchError(() => of([]))),
      clientes: this.apiService.getListarClienteWb({ Flg_Est: 'A' }).pipe(catchError(() => of([]))),
      usuarios: this.apiService.getListarUsuarioActivo({ Flg_Est: 'A' }).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ centros, clientes, usuarios }) => {
        this.centrosCosto = this.mapOptions(centros, ['Cen_Cos_Id', 'cen_Cos_Id', 'cenCosId'], ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']);
        this.clientes = this.mapOptions(clientes, ['Cli_Id', 'cli_Id', 'cliId'], ['Cli_Nom', 'cli_Nom', 'cliNom']);
        this.usuarios = this.extractRecords(usuarios)
          .map((item) => ({
            code: this.getText(item, ['Usr_Cod', 'usr_Cod', 'usrCod']),
            description: this.getText(item, ['Usr_Nom', 'usr_Nom', 'usrNom'])
          }))
          .filter((item) => Boolean(item.code))
          .sort((left, right) => left.description.localeCompare(right.description));
        this.isLoadingCatalogs = false;
      },
      error: () => {
        this.isLoadingCatalogs = false;
      }
    });
  }

  private getFilters(): ObraFiltro {
    const raw = this.filtersForm.getRawValue();
    return {
      Obr_Id: Number(raw.id) || 0,
      Obr_Cen_Cos: Number(raw.centroCosto) || 0,
      Obr_Nom: String(raw.nombre || '').trim(),
      Obr_Ubi: String(raw.ubicacion || '').trim(),
      Obr_Are: String(raw.area || '').trim(),
      Obr_Cli_Id: Number(raw.cliente) || 0,
      Flg_Est: String(raw.estado || '').trim(),
      Obr_Rsp: String(raw.responsable || '').trim()
    };
  }

  private mapObra(item: DataRecord): ObraRow | null {
    const id = this.getNumber(item, ['Obr_Id', 'obr_Id', 'obrId']);
    if (!id) {
      return null;
    }

    const estadoCodigo = this.getText(item, ['Flg_Est', 'flg_Est', 'flgEst']);
    const fechaInicio = this.getText(item, ['Obr_Fec_Ini', 'obr_Fec_Ini', 'obrFecIni']);
    const fechaFin = this.getText(item, ['Obr_Fec_Fin', 'obr_Fec_Fin', 'obrFecFin']);
    const fechaCierre = this.getText(item, ['Obr_Fec_Cie', 'obr_Fec_Cie', 'obrFecCie']);
    return {
      id,
      nombre: this.getText(item, ['Obr_Nom', 'obr_Nom', 'obrNom']),
      centroCosto: this.getText(item, ['Cen_Cos_Des', 'cen_Cos_Des', 'cenCosDes']),
      cliente: this.getText(item, ['CLi_Nom', 'Cli_Nom', 'cli_Nom', 'cliNom']),
      responsable: this.getText(item, ['Usr_Nom', 'usr_Nom', 'usrNom', 'Obr_Rsp', 'obr_Rsp', 'obrRsp']),
      estadoCodigo,
      estado: this.getEstadoLabel(estadoCodigo),
      fechaApertura: formatDisplayDate(this.getText(item, ['Obr_Fec_Ape', 'obr_Fec_Ape', 'obrFecApe'])),
      fechaInicio: formatDisplayDate(fechaInicio),
      fechaInicioInput: formatDateInputValue(fechaInicio),
      fechaFin: formatDisplayDate(fechaFin),
      fechaFinInput: formatDateInputValue(fechaFin),
      fechaCierre: formatDisplayDate(fechaCierre),
      fechaCierreInput: formatDateInputValue(fechaCierre)
    };
  }

  private mapOptions(response: unknown, idKeys: string[], descriptionKeys: string[]): ObraOption[] {
    return this.extractRecords(response)
      .map((item) => ({ id: this.getNumber(item, idKeys) ?? 0, description: this.getText(item, descriptionKeys) }))
      .filter((item) => item.id > 0 && Boolean(item.description))
      .sort((left, right) => left.description.localeCompare(right.description));
  }

  private filterOptions(options: ObraOption[], searchValue: string): ObraOption[] {
    const search = this.normalizeSearch(searchValue);
    return search
      ? options.filter((item) => this.normalizeSearch(`${item.id} ${item.description}`).includes(search))
      : options;
  }

  private filterUsuarios(searchValue: string): ObraUsuarioOption[] {
    const search = this.normalizeSearch(searchValue);
    return search
      ? this.usuarios.filter((item) => this.normalizeSearch(`${item.code} ${item.description}`).includes(search))
      : this.usuarios;
  }

  private normalizeSearch(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private extractRecords(response: unknown): DataRecord[] {
    if (Array.isArray(response)) {
      return response.filter((item): item is DataRecord => this.isRecord(item));
    }
    if (!this.isRecord(response) || response['Success'] === false || response['success'] === false) {
      return [];
    }
    for (const key of ['Elements', 'elements', 'Data', 'data', 'Result', 'result']) {
      const value = response[key];
      if (Array.isArray(value)) {
        return value.filter((item): item is DataRecord => this.isRecord(item));
      }
    }
    return [response];
  }

  private getText(item: DataRecord, keys: string[]): string {
    for (const key of keys) {
      const value = item[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }
    return '';
  }

  private getNumber(item: DataRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = item[key];
      if (value === null || value === undefined || value === '') {
        continue;
      }
      const parsed = Number(value);
      if (Number.isInteger(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private controlText(controlName: string): string {
    return String(this.form.controls[controlName].value ?? '').trim();
  }

  private optionalControlText(controlName: string): string | null {
    return this.controlText(controlName) || null;
  }

  private getEstadoLabel(code: string): string {
    return this.estados.find((item) => item.code === code.toUpperCase())?.label || code || 'Sin estado';
  }

  private getDateSaveKey(obraId: number, field: ObraDateField): string {
    return `${obraId}-${field}`;
  }

  private getCurrentOperator(): string {
    const globalUser = this.normalizeOperator(GlobalVariable.vusu?.trim() ?? '');
    return globalUser || this.normalizeOperator(this.authService.getCurrentUser().trim()) || 'sistemas';
  }

  private normalizeOperator(value: string): string {
    return value && !value.includes('@') ? value : '';
  }

  private isNoInformationResponse(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
      return false;
    }
    const message = this.isRecord(error.error) ? this.getText(error.error, ['Message', 'message']) : '';
    return message.toLowerCase().includes('no existe informaci');
  }

  private resolveError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error;
      }
      if (this.isRecord(error.error)) {
        return this.getText(error.error, ['Message', 'message', 'title', 'Title']) || `${fallback} Código HTTP: ${error.status}.`;
      }
    }
    return fallback;
  }

  private isRecord(value: unknown): value is DataRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
