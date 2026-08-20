import { Component, Inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ActualizarItemRequest, ApiService } from 'src/app/Services/api.services';
import { AuthService } from 'src/app/features/auth/services/auth.service';
import { noWhitespaceValidator } from 'src/app/shared/validators/form-validators';

type DataRecord = Record<string, unknown>;
interface Option { id: number; descripcion: string; }
interface ItemEditData { item: { itmId:number; itmDes:string; itmGrp:number; itmSubGrp?:number; itmDetMatId?:number; uniMedId?:number; flgEst:string; }; }

@Component({ selector:'app-item-edit-dialog', templateUrl:'./item-edit-dialog.component.html', styleUrls:['./item-dialog.component.scss'] })
export class ItemEditDialogComponent {
  readonly form: FormGroup;
  readonly unidadSearchControl = new FormControl('', { nonNullable: true });
  grupos: Option[]=[]; subGrupos: Option[]=[]; detallesMaterial: Option[]=[]; unidadesMedida: Option[]=[];
  isLoadingGroups=true; isLoadingSubGroups=false; isLoadingDetalles=false; isLoadingUnidades=true; isSaving=false; errorMessage='';
  constructor(@Inject(MAT_DIALOG_DATA) public data:ItemEditData, private ref:MatDialogRef<ItemEditDialogComponent>, fb:FormBuilder, private api:ApiService, private auth:AuthService){
    this.form=fb.group({itmDes:[data.item.itmDes,[Validators.required,noWhitespaceValidator(),Validators.maxLength(120)]],itmGrp:[data.item.itmGrp,Validators.required],itmSubGrp:[data.item.itmSubGrp??null,Validators.required],itmDetMat:[data.item.itmDetMatId??null,Validators.required],uniMedId:[data.item.uniMedId??null,Validators.required],flgEst:[data.item.flgEst||'A',Validators.required]});
    this.cargarGrupos();
    this.cargarUnidadesMedida();
  }
  get filteredUnidadesMedida(): Option[] {
    const search = this.unidadSearchControl.value.trim().toLowerCase();
    if (!search) return this.unidadesMedida;
    return this.unidadesMedida.filter((unidad) => String(unidad.id).includes(search) || unidad.descripcion.toLowerCase().includes(search));
  }
  onGrupoChange():void{this.form.patchValue({itmSubGrp:null,itmDetMat:null});this.subGrupos=[];this.detallesMaterial=[];this.cargarSubGrupos(Number(this.form.value.itmGrp),null);}
  onSubGrupoChange():void{this.form.patchValue({itmDetMat:null});this.detallesMaterial=[];this.cargarDetalles(Number(this.form.value.itmGrp),Number(this.form.value.itmSubGrp),null);}
  guardar():void{
    if(this.form.invalid||this.isSaving){this.form.markAllAsTouched();return;}
    this.isSaving=true;this.errorMessage='';
    const p:ActualizarItemRequest={Itm_Id:this.data.item.itmId,Itm_Des:String(this.form.value.itmDes||'').trim(),Itm_Grp:Number(this.form.value.itmGrp),Itm_Sub_Grp:Number(this.form.value.itmSubGrp),Itm_Det_Mat_Id:Number(this.form.value.itmDetMat),Uni_Med_Id:Number(this.form.value.uniMedId),Flg_Est:String(this.form.value.flgEst||'A'),Usr_Mod:this.auth.getCurrentUser()||'sistemas'};
    this.api.actualizarItem(p).subscribe({next:()=>{this.isSaving=false;this.ref.close(true);},error:(e)=>{console.error('Error actualizando item:',e);this.errorMessage='No se pudo actualizar el item.';this.isSaving=false;}});
  }
  cerrar():void{if(!this.isSaving)this.ref.close(false);}
  onUnidadSelectOpened(opened:boolean):void{if(opened)this.unidadSearchControl.setValue('');}
  trackByOption(_index:number, option:Option):number{return option.id;}
  private cargarGrupos():void{this.api.getListarGrupoItem().subscribe({next:r=>{this.grupos=this.options(r,['Grp_Id','grp_Id','grpId'],['Grp_Des','grp_Des','grpDes']);this.isLoadingGroups=false;this.cargarSubGrupos(this.data.item.itmGrp,this.data.item.itmSubGrp??null);},error:()=>{this.errorMessage='No se pudieron cargar los grupos.';this.isLoadingGroups=false;}});}
  private cargarUnidadesMedida():void{this.api.getListarUnidadMedida({Flg_Est:'A'}).subscribe({next:r=>{this.unidadesMedida=this.options(r,['Uni_Med_Id','uni_Med_Id','uniMedId'],['Uni_Med_Des','uni_Med_Des','uniMedDes']);this.isLoadingUnidades=false;},error:()=>{this.errorMessage='No se pudo cargar la lista de unidades de medida.';this.isLoadingUnidades=false;}});}
  private cargarSubGrupos(grp:number,selected:number|null):void{if(!grp)return;this.isLoadingSubGroups=true;this.api.getListarSubGrupoItemPorGrpId(grp).subscribe({next:r=>{this.subGrupos=this.options(r,['Sub_Grp_Id','sub_Grp_Id','subGrpId'],['Sub_Grp_Des','sub_Grp_Des','subGrpDes']);this.form.patchValue({itmSubGrp:selected},{emitEvent:false});this.isLoadingSubGroups=false;if(selected)this.cargarDetalles(grp,selected,this.data.item.itmDetMatId??null);},error:()=>{this.errorMessage='No se pudieron cargar los sub grupos.';this.isLoadingSubGroups=false;}});}
  private cargarDetalles(grp:number,sub:number,selected:number|null):void{if(!grp||!sub)return;this.isLoadingDetalles=true;this.api.getItemDetalleMaterialEntity(grp,sub).subscribe({next:r=>{this.detallesMaterial=this.options(r,['Det_Mat_Id','det_Mat_Id','detMatId'],['Det_Mat_Des','det_Mat_Des','detMatDes']);this.form.patchValue({itmDetMat:selected},{emitEvent:false});this.isLoadingDetalles=false;},error:()=>{this.errorMessage='No se pudieron cargar los detalles de material.';this.isLoadingDetalles=false;}});}
  private options(r:unknown,ids:string[],ds:string[]):Option[]{return this.records(r).map(x=>({id:this.num(x,ids),descripcion:this.txt(x,ds)})).filter(x=>x.id>0).sort((a,b)=>a.descripcion.localeCompare(b.descripcion));}
  private records(r:unknown):DataRecord[]{if(Array.isArray(r))return r.filter((x):x is DataRecord=>this.rec(x));if(this.rec(r))for(const k of ['elements','Elements','data','Data','result','Result']){const v=r[k];if(Array.isArray(v))return v.filter((x):x is DataRecord=>this.rec(x));}return[];}
  private txt(x:DataRecord,ks:string[]):string{for(const k of ks)if(x[k]!=null)return String(x[k]).trim();return'';} private num(x:DataRecord,ks:string[]):number{for(const k of ks){const n=Number(x[k]);if(Number.isInteger(n))return n;}return 0;} private rec(x:unknown):x is DataRecord{return typeof x==='object'&&x!==null&&!Array.isArray(x);}
}
