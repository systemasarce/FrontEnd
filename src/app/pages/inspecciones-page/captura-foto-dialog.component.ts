import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface CapturaFotoDialogData {
  titulo: string;
}

@Component({
  selector: 'app-captura-foto-dialog',
  templateUrl: './captura-foto-dialog.component.html',
  styleUrls: ['./captura-foto-dialog.component.scss']
})
export class CapturaFotoDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private stream?: MediaStream;
  errorMensaje = '';
  cargando = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CapturaFotoDialogData,
    private readonly dialogRef: MatDialogRef<CapturaFotoDialogComponent>
  ) {}

  async ngAfterViewInit(): Promise<void> {
    await this.reiniciarCamara();
  }

  private async reiniciarCamara(): Promise<void> {
    this.detenerCamara();
    this.cargando = true;
    this.errorMensaje = '';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const video = this.videoRef?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
      }
    } catch {
      this.errorMensaje = 'No se pudo acceder a la cámara. Verifica los permisos del navegador.';
    } finally {
      this.cargando = false;
    }
  }


  ngOnDestroy(): void {
    this.detenerCamara();
  }

  capturar(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas) { return; }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { return; }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { return; }
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      this.dialogRef.close(file);
    }, 'image/jpeg', 0.92);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }

  private detenerCamara(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = undefined;
    }
  }
}
