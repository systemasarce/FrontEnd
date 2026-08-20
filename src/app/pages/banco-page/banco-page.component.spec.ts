import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ApiService } from 'src/app/Services/api.services';
import { BancoEditDialogComponent } from './banco-edit-dialog.component';
import { BancoPageComponent } from './banco-page.component';
import { BancoRegisterDialogComponent } from './banco-register-dialog.component';

describe('BancoPageComponent', () => {
  let component: BancoPageComponent;
  let fixture: ComponentFixture<BancoPageComponent>;
  let apiServiceMock: {
    getListarBanco: jasmine.Spy;
  };
  let matDialogMock: {
    open: jasmine.Spy;
  };

  beforeEach(async () => {
    apiServiceMock = {
      getListarBanco: jasmine.createSpy('getListarBanco').and.returnValue(
        of({
          elements: [
            { Ban_Id: 1, Ban_Des: 'Banco de Credito', Ban_Abr: 'BCP', Flg_Est: 'A' },
            { Ban_Id: 2, Ban_Des: 'Interbank', Ban_Abr: 'IBK', Flg_Est: 'A' }
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
      declarations: [BancoPageComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: MatDialog, useValue: matDialogMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BancoPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load bancos on init', () => {
    expect(apiServiceMock.getListarBanco).toHaveBeenCalledWith({ Flg_Est: 'A' });
    expect(component.bancos.length).toBe(2);
  });

  it('should search bancos using ID, descripcion and estado filters', () => {
    apiServiceMock.getListarBanco.calls.reset();
    component.filtersForm.setValue({
      codigo: '2',
      descripcion: 'Inter',
      estado: 'I'
    });

    component.cargarBancos();

    expect(apiServiceMock.getListarBanco).toHaveBeenCalledWith({
      Ban_Id: 2,
      Ban_Des: 'Inter',
      Flg_Est: 'I'
    });
  });

  it('should reset filters and reload active bancos', () => {
    apiServiceMock.getListarBanco.calls.reset();
    component.filtersForm.setValue({
      codigo: '5',
      descripcion: 'Banco Demo',
      estado: 'I'
    });

    component.limpiarFiltros();

    expect(component.filtersForm.value).toEqual({
      codigo: '',
      descripcion: '',
      estado: 'A'
    });
    expect(apiServiceMock.getListarBanco).toHaveBeenCalledWith({ Flg_Est: 'A' });
  });

  it('should open register dialog', () => {
    component.registrarBanco();

    expect(matDialogMock.open).toHaveBeenCalledWith(BancoRegisterDialogComponent, jasmine.objectContaining({
      panelClass: 'animated-dialog-pane',
      backdropClass: 'animated-dialog-backdrop'
    }));
  });

  it('should open edit dialog for the provided row', () => {
    component.editarBanco(component.bancos[1]);

    expect(matDialogMock.open).toHaveBeenCalledWith(BancoEditDialogComponent, jasmine.objectContaining({
      data: {
        banco: jasmine.objectContaining({
          banId: 2,
          banDes: 'Interbank',
          banAbr: 'IBK'
        })
      }
    }));
  });
});
