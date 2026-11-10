package expo.modules.ialocal

import android.app.ActivityManager
import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import com.google.mlkit.genai.common.DownloadStatus
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.TextPart
import com.google.mlkit.genai.prompt.generateContentRequest
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.react.androidContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Parte nativa da IA no aparelho no Android.
 *
 * O Whisper (whisper.rn) só lê WAV com PCM de 16 bits, mono, a 16 kHz, e o app grava em m4a.
 * Este módulo decodifica o áudio com o MediaCodec do próprio Android, junta os canais, reamostra
 * para 16 kHz e grava um WAV temporário no cache do app. Também informa a memória do aparelho,
 * para o app só oferecer o modelo de linguagem onde ele cabe, e dá acesso ao Gemini Nano
 * nos aparelhos que têm.
 */
@ExpoModule("IaLocal")
class IaLocalModule : Module() {

  // Gemini Nano pelo ML Kit (AICore): o modelo do próprio Android, sem custo e sem sair do celular.
  // Só existe em alguns aparelhos; nos outros, checkStatus devolve UNAVAILABLE e o app usa o Llama.
  private val gemini by lazy { Generation.getClient() }

  @JS
  suspend fun nanoStatus(): String = try {
    when (gemini.checkStatus()) {
      FeatureStatus.AVAILABLE -> "disponivel"
      FeatureStatus.DOWNLOADABLE -> "baixavel"
      FeatureStatus.DOWNLOADING -> "baixando"
      else -> "indisponivel"
    }
  } catch (e: Throwable) {
    "indisponivel"
  }

  /** Pede ao Android para baixar o Gemini Nano. Devolve true quando termina. */
  @JS
  suspend fun nanoBaixar(): Boolean {
    var concluido = false
    try {
      gemini.download().collect { status ->
        if (status is DownloadStatus.DownloadCompleted) concluido = true
      }
    } catch (e: Throwable) {
      return false
    }
    return concluido
  }

  @JS
  suspend fun nanoGerar(prompt: String, temperatura: Double, maxTokens: Double): String {
    val resposta = gemini.generateContent(
      generateContentRequest(TextPart(prompt)) {
        temperature = temperatura.toFloat()
        maxOutputTokens = maxTokens.toInt()
      }
    )
    return resposta.candidates.firstOrNull()?.text ?: ""
  }

  @JS
  fun memoriaTotalMb(): Double {
    val gerenciador = androidContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val info = ActivityManager.MemoryInfo()
    gerenciador.getMemoryInfo(info)
    return info.totalMem / (1024.0 * 1024.0)
  }

  @JS
  suspend fun paraWav16k(uri: String): String = withContext(Dispatchers.IO) {
    val (amostras, taxa, canais) = decodificar(uri)
    val mono = paraMono(amostras, canais)
    val reamostrado = reamostrar(mono, taxa, 16000)
    val destino = File(androidContext.cacheDir, "ia-local-${System.currentTimeMillis()}.wav")
    gravarWav(destino, reamostrado, 16000)
    destino.absolutePath
  }

  private fun decodificar(uri: String): Triple<ShortArray, Int, Int> {
    val extrator = MediaExtractor()
    val caminho = if (uri.startsWith("file://")) Uri.parse(uri).path!! else uri
    extrator.setDataSource(caminho)
    val faixa = (0 until extrator.trackCount).firstOrNull {
      extrator.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
    } ?: throw IllegalArgumentException("O arquivo não tem áudio")
    extrator.selectTrack(faixa)
    val formato = extrator.getTrackFormat(faixa)
    var taxa = formato.getInteger(MediaFormat.KEY_SAMPLE_RATE)
    var canais = formato.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
    val decodificador = MediaCodec.createDecoderByType(formato.getString(MediaFormat.KEY_MIME)!!)
    decodificador.configure(formato, null, null, 0)
    decodificador.start()

    val saida = ByteArrayOutputStream()
    val info = MediaCodec.BufferInfo()
    var fimEntrada = false
    var fimSaida = false
    while (!fimSaida) {
      if (!fimEntrada) {
        val indice = decodificador.dequeueInputBuffer(10_000)
        if (indice >= 0) {
          val buffer = decodificador.getInputBuffer(indice)!!
          val tamanho = extrator.readSampleData(buffer, 0)
          if (tamanho < 0) {
            decodificador.queueInputBuffer(indice, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            fimEntrada = true
          } else {
            decodificador.queueInputBuffer(indice, 0, tamanho, extrator.sampleTime, 0)
            extrator.advance()
          }
        }
      }
      val indiceSaida = decodificador.dequeueOutputBuffer(info, 10_000)
      when {
        indiceSaida >= 0 -> {
          val buffer = decodificador.getOutputBuffer(indiceSaida)!!
          val bytes = ByteArray(info.size)
          buffer.position(info.offset)
          buffer.get(bytes, 0, info.size)
          saida.write(bytes)
          decodificador.releaseOutputBuffer(indiceSaida, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) fimSaida = true
        }
        indiceSaida == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          val novo = decodificador.outputFormat
          taxa = novo.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          canais = novo.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        }
      }
    }
    decodificador.stop()
    decodificador.release()
    extrator.release()

    val pcm = saida.toByteArray()
    val amostras = ShortArray(pcm.size / 2)
    ByteBuffer.wrap(pcm).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(amostras)
    return Triple(amostras, taxa, canais)
  }

  private fun paraMono(amostras: ShortArray, canais: Int): ShortArray {
    if (canais <= 1) return amostras
    val quadros = amostras.size / canais
    return ShortArray(quadros) { i ->
      var soma = 0
      for (c in 0 until canais) soma += amostras[i * canais + c]
      (soma / canais).toShort()
    }
  }

  /** Reamostragem linear: suficiente para fala, que o Whisper vai ler a 16 kHz. */
  private fun reamostrar(amostras: ShortArray, de: Int, para: Int): ShortArray {
    if (de == para || amostras.isEmpty()) return amostras
    val razao = de.toDouble() / para
    val total = (amostras.size / razao).toInt()
    return ShortArray(total) { i ->
      val pos = i * razao
      val a = pos.toInt().coerceAtMost(amostras.size - 1)
      val b = (a + 1).coerceAtMost(amostras.size - 1)
      val t = pos - a
      (amostras[a] * (1 - t) + amostras[b] * t).toInt().toShort()
    }
  }

  private fun gravarWav(destino: File, amostras: ShortArray, taxa: Int) {
    val dados = amostras.size * 2
    val cabecalho = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
      put("RIFF".toByteArray()); putInt(36 + dados); put("WAVE".toByteArray())
      put("fmt ".toByteArray()); putInt(16); putShort(1); putShort(1)
      putInt(taxa); putInt(taxa * 2); putShort(2); putShort(16)
      put("data".toByteArray()); putInt(dados)
    }
    FileOutputStream(destino).use { arquivo ->
      arquivo.write(cabecalho.array())
      val corpo = ByteBuffer.allocate(dados).order(ByteOrder.LITTLE_ENDIAN)
      corpo.asShortBuffer().put(amostras)
      arquivo.write(corpo.array())
    }
  }
}
