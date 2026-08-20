import { AfterViewInit, Component, Inject, NgZone, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import fixWebmDuration from 'fix-webm-duration';

export interface CapturaAudioDialogData {
  titulo: string;
}

type EstadoGrabacion = 'idle' | 'grabando' | 'pausado' | 'grabado';

/** Cantidad de barras visibles en la forma de onda (efecto "scroll" tipo grabadora de Windows). */
const BARRAS_VISIBLES = 60;

@Component({
  selector: 'app-captura-audio-dialog',
  templateUrl: './captura-audio-dialog.component.html',
  styleUrls: ['./captura-audio-dialog.component.scss']
})
export class CapturaAudioDialogComponent implements AfterViewInit, OnDestroy {
  estado: EstadoGrabacion = 'idle';
  cargando = false;
  errorMensaje = '';
  tiempoSegundos = 0;
  previewUrl: SafeUrl | null = null;
  /** Niveles de amplitud (0 a 1) usados para dibujar la forma de onda mientras se graba. */
  waveform: number[] = [];
  /** Audios ya confirmados con "Agregar otro audio", pendientes de guardarse todos juntos. */
  audiosEnCola: File[] = [];

  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: BlobPart[] = [];
  private timer?: number;
  private archivoGrabado: File | null = null;
  private mimeTypeGrabacion = '';
  private grabacionInicioMs = 0;
  private previewObjectUrl: string | null = null;

  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private waveformRafId?: number;
  private ultimaMuestraMs = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CapturaAudioDialogData,
    private readonly dialogRef: MatDialogRef<CapturaAudioDialogComponent>,
    private readonly zone: NgZone,
    private readonly sanitizer: DomSanitizer
  ) {}

  async ngAfterViewInit(): Promise<void> {
    await this.prepararMicrofono();
  }

  ngOnDestroy(): void {
    this.liberarPreview();
    this.detenerRecursos();
  }

  get grabando(): boolean {
    return this.estado === 'grabando';
  }

  get pausado(): boolean {
    return this.estado === 'pausado';
  }

  get totalAudiosListos(): number {
    return this.audiosEnCola.length + (this.archivoGrabado ? 1 : 0);
  }

  /**
   * MediaRecorder dispara sus eventos fuera de NgZone y, además, a veces coinciden con
   * un ciclo de detección de cambios que Angular ya está ejecutando (p. ej. la animación
   * de apertura del diálogo), lo que produce el error NG0100
   * (ExpressionChangedAfterItHasBeenCheckedError). Diferir el cambio a un macrotask nuevo
   * (setTimeout) deja que el ciclo en curso termine antes de aplicar el cambio de estado.
   */
  private aplicarCambio(fn: () => void): void {
    setTimeout(() => this.zone.run(fn), 0);
  }

  async iniciarGrabacion(): Promise<void> {
    if (this.estado === 'grabando' || this.estado === 'pausado') {
      return;
    }

    this.liberarPreview();
    this.archivoGrabado = null;
    this.waveform = [];

    if (!this.stream || this.stream.getAudioTracks().every(track => track.readyState === 'ended')) {
      await this.prepararMicrofono();
    }
    if (!this.stream) {
      return;
    }

    this.chunks = [];
    const mimeType = this.obtenerMimeTypeSoportado();

    try {
      this.recorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);
    } catch {
      this.errorMensaje = 'El navegador no permite grabar audio con este formato.';
      return;
    }

    this.mimeTypeGrabacion = this.recorder.mimeType || mimeType || 'audio/webm';

    // Los eventos de MediaRecorder se disparan fuera de NgZone, por lo que cualquier
    // cambio de estado dentro de ellos debe envolverse en zone.run() para que Angular
    // repinte la vista de inmediato (de lo contrario hace falta una interacción extra,
    // como un segundo clic, para que la UI refleje el cambio).
    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.recorder.onerror = () => {
      this.aplicarCambio(() => {
        this.errorMensaje = 'No se pudo grabar el audio.';
        this.detenerRecursos();
        this.estado = 'idle';
      });
    };

    this.recorder.onstop = () => {
      // onstop es async porque reparamos la duración del WebM antes de exponer el archivo.
      this.finalizarGrabacion(mimeType).catch(() => {
        this.aplicarCambio(() => {
          this.errorMensaje = 'No se pudo procesar el audio grabado.';
          this.estado = 'idle';
        });
      });
    };

    this.recorder.start(250);
    this.estado = 'grabando';
    this.errorMensaje = '';
    this.tiempoSegundos = 0;
    this.grabacionInicioMs = Date.now();
    this.iniciarTimer();
    this.iniciarAnalizadorNivel();
  }

  /** Pausa la grabación en curso, o la reanuda si ya estaba pausada. */
  pausarOReanudar(): void {
    if (!this.recorder) {
      return;
    }

    if (this.estado === 'grabando') {
      try {
        this.recorder.pause();
      } catch {
        return;
      }
      this.estado = 'pausado';
      this.detenerTimer();
      this.detenerAnalizadorNivel();
      return;
    }

    if (this.estado === 'pausado') {
      try {
        this.recorder.resume();
      } catch {
        return;
      }
      this.estado = 'grabando';
      this.iniciarTimer();
      this.iniciarAnalizadorNivel();
    }
  }

  detenerGrabacion(): void {
    if (!this.recorder || (this.estado !== 'grabando' && this.estado !== 'pausado')) {
      return;
    }

    try {
      this.recorder.stop();
    } catch {
      this.detenerTimer();
      this.detenerAnalizadorNivel();
      this.detenerMicrofono();
      this.estado = 'idle';
    }
  }

  /** Descarta la grabación actual (sin guardarla) y vuelve al estado inicial para grabar de nuevo. */
  grabarDeNuevo(): void {
    this.liberarPreview();
    this.archivoGrabado = null;
    this.errorMensaje = '';
    this.waveform = [];
    this.estado = 'idle';
  }

  /** Encola el audio actual como confirmado y limpia la vista para grabar uno adicional. */
  agregarOtroAudio(): void {
    if (this.archivoGrabado) {
      this.audiosEnCola.push(this.archivoGrabado);
    }
    this.liberarPreview();
    this.archivoGrabado = null;
    this.errorMensaje = '';
    this.waveform = [];
    this.estado = 'idle';
  }

  /**
   * Aun reparando el WebM con fix-webm-duration, algunos navegadores (Chrome en particular)
   * siguen mostrando 0:00 en el <audio> hasta que se "recorre" el archivo al menos una vez.
   * Este truco fuerza al navegador a calcular la duración real haciendo un seek al final
   * y regresando al inicio, sin que se note ni se escuche nada.
   */
  onDuracionCargada(audio: HTMLAudioElement): void {
    if (isFinite(audio.duration) && audio.duration > 0) {
      return;
    }

    const alTerminarBusqueda = () => {
      audio.removeEventListener('timeupdate', alTerminarBusqueda);
      this.zone.run(() => {
        audio.currentTime = 0;
      });
    };

    audio.addEventListener('timeupdate', alTerminarBusqueda);
    audio.currentTime = Number.MAX_SAFE_INTEGER;
  }

  /** Guarda el audio actual (si existe) junto con todos los que se hayan agregado y cierra el diálogo. */
  guardar(): void {
    if (this.archivoGrabado) {
      this.audiosEnCola.push(this.archivoGrabado);
      this.archivoGrabado = null;
    }

    if (this.audiosEnCola.length === 0) {
      return;
    }

    const archivos = this.audiosEnCola;
    this.audiosEnCola = [];
    this.previewUrl = null;
    this.dialogRef.close(archivos);
  }

  cancelar(): void {
    this.liberarPreview();
    this.detenerRecursos();
    this.audiosEnCola = [];
    this.dialogRef.close(null);
  }

  private async finalizarGrabacion(mimeTypeSolicitado: string): Promise<void> {
    const tipo = this.recorder?.mimeType || this.mimeTypeGrabacion || mimeTypeSolicitado || 'audio/webm';
    let blob = new Blob(this.chunks, { type: tipo });

    // Chrome (y derivados) graban WebM sin la duración correcta en la cabecera cuando se
    // usa MediaRecorder con timeslices. Esto hace que el <audio> muestre 0 segundos y a
    // veces no reproduzca nada. Se corrige inyectando la duración real (medida con
    // Date.now(), más precisa que el contador de segundos en pantalla) antes de construir
    // el File final, tanto para la vista previa como para el archivo que se sube.
    if (tipo.toLowerCase().includes('webm') && blob.size > 0) {
      const duracionMs = Math.max(Date.now() - this.grabacionInicioMs, this.tiempoSegundos * 1000, 1);
      try {
        blob = await fixWebmDuration(blob, duracionMs, { logger: false });
      } catch {
        // Si la corrección falla, se continúa con el blob original en vez de bloquear al usuario.
      }
    }

    const extension = this.obtenerExtensionDesdeMimeType(tipo);
    const file = new File([blob], `audio-${Date.now()}.${extension}`, { type: tipo || 'audio/webm' });
    const objectUrl = URL.createObjectURL(file);

    this.aplicarCambio(() => {
      this.detenerTimer();
      this.detenerAnalizadorNivel();
      this.detenerMicrofono();

      this.archivoGrabado = file;
      this.previewObjectUrl = objectUrl;
      // Angular no permite blob: en un [src] sin marcarlo explícitamente como seguro;
      // si no se hace esto, Angular lo sustituye por "unsafe:blob:..." y el navegador
      // no puede reproducirlo (ERR_UNKNOWN_URL_SCHEME).
      this.previewUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);
      this.estado = 'grabado';
    });
  }

  private async prepararMicrofono(): Promise<void> {
    this.cargando = true;
    this.errorMensaje = '';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      this.aplicarCambio(() => {
        this.errorMensaje = 'No se pudo acceder al micrófono. Verifica los permisos del navegador.';
      });
    } finally {
      this.cargando = false;
    }
  }

  private iniciarTimer(): void {
    this.detenerTimer();
    this.timer = window.setInterval(() => {
      this.zone.run(() => {
        this.tiempoSegundos++;
      });
    }, 1000);
  }

  /** Analiza el nivel de audio del micrófono en tiempo real para dibujar la forma de onda. */
  private iniciarAnalizadorNivel(): void {
    if (!this.stream) {
      return;
    }

    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }
      this.audioContext = new AudioContextCtor();
      const fuente = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      fuente.connect(this.analyser);
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => undefined);
    }

    const datos = new Uint8Array(this.analyser!.frequencyBinCount);

    const muestrear = (timestamp: number) => {
      if (this.estado !== 'grabando') {
        return;
      }

      if (timestamp - this.ultimaMuestraMs >= 80) {
        this.ultimaMuestraMs = timestamp;
        this.analyser!.getByteTimeDomainData(datos);

        let suma = 0;
        for (let i = 0; i < datos.length; i++) {
          const valor = (datos[i] - 128) / 128;
          suma += valor * valor;
        }
        const nivel = Math.min(1, Math.sqrt(suma / datos.length) * 4);

        this.zone.run(() => {
          this.waveform = [...this.waveform, nivel].slice(-BARRAS_VISIBLES);
        });
      }

      this.waveformRafId = requestAnimationFrame(muestrear);
    };

    this.waveformRafId = requestAnimationFrame(muestrear);
  }

  private detenerAnalizadorNivel(): void {
    if (this.waveformRafId) {
      cancelAnimationFrame(this.waveformRafId);
      this.waveformRafId = undefined;
    }
  }

  private detenerRecursos(): void {
    this.detenerTimer();
    this.detenerAnalizadorNivel();
    this.detenerMicrofono();
    this.cerrarAudioContext();
    this.estado = 'idle';
  }

  private detenerTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private detenerMicrofono(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = undefined;
    }

    this.recorder = undefined;
  }

  private cerrarAudioContext(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = undefined;
    this.analyser = undefined;
  }

  private liberarPreview(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
    this.previewUrl = null;
  }

  private obtenerMimeTypeSoportado(): string {
    // audio/mp4 se excluye a propósito: el MP4 que genera MediaRecorder al grabar por
    // trozos (timeslices) suele quedar sin los átomos necesarios para reproducirse desde
    // un Blob URL en un <audio> normal (requeriría Media Source Extensions). WebM sí es
    // reproducible directo y ya cuenta con el fix de duración (fix-webm-duration).
    const tipos = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav'
    ];

    for (const tipo of tipos) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(tipo)) {
        return tipo;
      }
    }

    return '';
  }

  private obtenerExtensionDesdeMimeType(mimeType: string): string {
    const tipo = (mimeType || '').toLowerCase();
    if (tipo.includes('mp4')) return 'm4a';
    if (tipo.includes('ogg')) return 'ogg';
    if (tipo.includes('wav')) return 'wav';
    return 'webm';
  }
}
