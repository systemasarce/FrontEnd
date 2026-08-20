import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { MonedaEditDialogComponent } from './moneda-edit-dialog.component';
import { MonedaPageComponent } from './moneda-page.component';
import { MonedaRegisterDialogComponent } from './moneda-register-dialog.component';

describe('MonedaPageComponent', () => {
  let component: MonedaPageComponent;
  let fixture: ComponentFixture<MonedaPageComponent>;
  let apiServiceMock: {
    getListarMoneda: jasmine.Spy;
  };
  let matDialogMock: {
    open: jasmine.Spy;
  };

  beforeEach(async () => {
    apiServiceMock = {
      getListarMoneda: jasmine.createSpy('getListarMoneda').and.returnValue(
        of({
          elements: [
            { Mon_Id: 1, Mon_Des: 'Soles', Mon_Abr: 'PEN', Flg_Est: 'A' },
            { Mon_Id: 2, Mon_Des: 'Dolares', Mon_Abr: 'USD', Flg_Est: 'A' }
          ]
        })
      )
    };

    matDialogMock = {
      open: jasmine.createSpy('open').and.returnValue({
        afterClosed: () => of(false)
      })
    };

    await TestBed.configureTestingModule({
      declarations: [MonedaPageComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: MatDialog, useValue: matDialogMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MonedaPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load monedas on init', () => {
    expect(apiServiceMock.getListarMoneda).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(component.monedas.length).toBe(2);
  });

  it('should search monedas using ID, descripcion and estado filters', () => {
    apiServiceMock.getListarMoneda.calls.reset();
    component.filtersForm.setValue({
      codigo: '2',
      descripcion: 'Dol',
      estado: 'I'
    });

    component.cargarMonedas();

    expect(apiServiceMock.getListarMoneda).toHaveBeenCalledWith({
      Mon_Id: 2,
      Mon_Des: 'Dol',
      Flg_Est: 'I'
    });
  });

  it('should reset filters and reload active monedas', () => {
    apiServiceMock.getListarMoneda.calls.reset();
    component.filtersForm.setValue({
      codigo: '5',
      descripcion: 'Euro',
      estado: 'I'
    });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      codigo: '',
      descripcion: '',
      estado: 'A'
    });
    expect(apiServiceMock.getListarMoneda).toHaveBeenCalledWith({ Flg_Est: 'A' });
  });

  it('should open register dialog', () => {
    component.registrarMoneda();

    expect(matDialogMock.open).toHaveBeenCalledWith(MonedaRegisterDialogComponent, jasmine.objectContaining({
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop'
    }));
  });

  it('should open edit dialog for the provided row', () => {
    component.editarMoneda(component.monedas[1]);

    expect(matDialogMock.open).toHaveBeenCalledWith(MonedaEditDialogComponent, jasmine.objectContaining({
      data: {
        moneda: jasmine.objectContaining({
          monId: 2,
          monDes: 'Dolares',
          monAbr: 'USD'
        })
      }
    }));
  });
});
