import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { ProviderPageComponent } from './provider-page.component';

describe('ProviderPageComponent', () => {
  let component: ProviderPageComponent;
  let fixture: ComponentFixture<ProviderPageComponent>;
  let apiServiceMock: { getListarProveedorActivo: jasmine.Spy };
  let matDialogMock: { open: jasmine.Spy };

  beforeEach(async () => {
    apiServiceMock = {
      getListarProveedorActivo: jasmine.createSpy('getListarProveedorActivo').and.returnValue(
        of([
          {
            Prv_Id: 20,
            Prv_Nom: 'Proveedor Sur',
            Prv_Ruc: '20999999999',
            Prv_Tel: '01-111-2222',
            Prv_Dir: 'Calle 2',
            Prv_Nom_Con: 'Luis Perez',
            Fec_Reg: '2024-05-02T13:45:20',
            Flg_Est: 'A'
          },
          {
            Prv_Id: 10,
            Prv_Nom: 'Proveedor Norte',
            Prv_Ruc: '20123456789',
            Prv_Tel: '01-555-1212',
            Prv_Dir: 'Av. Central 123',
            Prv_Nom_Con: 'Ana Torres',
            Fec_Reg: '2024-05-01T13:45:20',
            Flg_Est: 'A'
          }
        ])
      )
    };
    matDialogMock = {
      open: jasmine.createSpy('open').and.returnValue({
        afterClosed: () => of(false)
      })
    };

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [ProviderPageComponent],
      providers: [
        {
          provide: ApiService,
          useValue: apiServiceMock
        },
        {
          provide: MatDialog,
          useValue: matDialogMock
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should map provider data from the API response', () => {
    expect(component.proveedores.length).toBe(2);
    expect(component.proveedores[0].prvNom).toBe('Proveedor Norte');
    expect(component.proveedores[0].prvRuc).toBe('20123456789');
    expect(component.proveedores[0].fecha).toBe('05-01-2024');
  });

  it('should sort providers by id in ascending order', () => {
    expect(component.proveedores.map((proveedor) => proveedor.prvId)).toEqual([10, 20]);
  });

  it('should initialize active providers filter by default', () => {
    expect(component.filtersForm.controls['estado'].value).toBe('A');
  });

  it('should clear filters and keep active providers as default', () => {
    component.filtersForm.patchValue({
      id: '10',
      nombre: 'Norte',
      ruc: '20123456789',
      nombreContacto: 'Ana',
      estado: 'I'
    });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      id: '',
      nombre: '',
      ruc: '',
      nombreContacto: '',
      estado: 'A'
    });
  });

  it('should clear id when the input receives zero or negative values', () => {
    const zeroInput = document.createElement('input');
    zeroInput.value = '0';

    component.sanitizeIdInput({ target: zeroInput } as unknown as Event);
    expect(component.filtersForm.controls['id'].value).toBe('');

    const negativeInput = document.createElement('input');
    negativeInput.value = '-5';

    component.sanitizeIdInput({ target: negativeInput } as unknown as Event);
    expect(component.filtersForm.controls['id'].value).toBe('');
  });

  it('should open the provider edit dialog and reload when it closes after update', () => {
    matDialogMock.open.and.returnValue({
      afterClosed: () => of(true)
    });

    component.editarProveedor(component.proveedores[0]);

    expect(matDialogMock.open).toHaveBeenCalled();
    expect(apiServiceMock.getListarProveedorActivo).toHaveBeenCalledTimes(2);
  });
});
