import AVFoundation
import ExpoModulesCore
import Speech

#if canImport(FoundationModels)
import FoundationModels
#endif

/// IA no próprio aparelho: o áudio é transcrito e organizado no celular e nunca sai dele.
///
/// - transcrever: reconhecimento de fala do iOS 26 (SpeechAnalyzer), em português do Brasil.
/// - gerarRegistro: modelo local da Apple com saída presa ao formato do RegistroDiario.
/// - gerarTexto: o mesmo modelo para o resumo da família, que depois passa pelos guardrails.
///
/// Os prompts vêm do JavaScript, versionados junto com os da nuvem. Qualquer falha aqui faz o
/// app usar a nuvem como reserva, com os mesmos guardrails.
public class IaLocalModule: Module {
  private let portugues = Locale(identifier: "pt_BR")

  public func definition() -> ModuleDefinition {
    Name("IaLocal")

    AsyncFunction("disponibilidade") { () async -> [String: Any] in
      await self.disponibilidade()
    }

    AsyncFunction("transcrever") { (uri: String) async throws -> String in
      guard #available(iOS 26.0, *) else { throw FalhaIaLocal("ios_antigo") }
      guard let url = URL(string: uri) else { throw FalhaIaLocal("arquivo") }
      return try await self.transcrever(url)
    }

    AsyncFunction("gerarRegistro") { (instrucoes: String, prompt: String) async throws -> String in
      #if canImport(FoundationModels)
      guard #available(iOS 26.0, *) else { throw FalhaIaLocal("ios_antigo") }
      let sessao = LanguageModelSession(instructions: instrucoes)
      let resposta = try await sessao.respond(
        to: prompt,
        generating: RegistroGerado.self,
        options: GenerationOptions(sampling: .greedy)
      )
      return resposta.rawContent.jsonString
      #else
      throw FalhaIaLocal("sem_modelo")
      #endif
    }

    AsyncFunction("gerarMemoria") { (instrucoes: String, prompt: String) async throws -> String in
      #if canImport(FoundationModels)
      guard #available(iOS 26.0, *) else { throw FalhaIaLocal("ios_antigo") }
      let sessao = LanguageModelSession(instructions: instrucoes)
      let resposta = try await sessao.respond(
        to: prompt,
        generating: MemoriaGerada.self,
        options: GenerationOptions(sampling: .greedy)
      )
      return resposta.rawContent.jsonString
      #else
      throw FalhaIaLocal("sem_modelo")
      #endif
    }

    AsyncFunction("gerarPerguntas") { (instrucoes: String, prompt: String) async throws -> [String] in
      #if canImport(FoundationModels)
      guard #available(iOS 26.0, *) else { throw FalhaIaLocal("ios_antigo") }
      let sessao = LanguageModelSession(instructions: instrucoes)
      let resposta = try await sessao.respond(
        to: prompt,
        generating: PerguntasGeradas.self,
        options: GenerationOptions(temperature: 0.7)
      )
      return resposta.content.perguntas
      #else
      throw FalhaIaLocal("sem_modelo")
      #endif
    }

    AsyncFunction("gerarTexto") { (instrucoes: String, prompt: String) async throws -> String in
      #if canImport(FoundationModels)
      guard #available(iOS 26.0, *) else { throw FalhaIaLocal("ios_antigo") }
      let sessao = LanguageModelSession(instructions: instrucoes)
      let resposta = try await sessao.respond(
        to: prompt,
        options: GenerationOptions(temperature: 0.3, maximumResponseTokens: 400)
      )
      return resposta.content
      #else
      throw FalhaIaLocal("sem_modelo")
      #endif
    }
  }

  private func disponibilidade() async -> [String: Any] {
    guard #available(iOS 26.0, *) else {
      return ["transcricao": false, "modelo": false, "motivo": "ios_antigo"]
    }
    var motivo = ""
    var modelo = false
    #if canImport(FoundationModels)
    let sistema = SystemLanguageModel.default
    switch sistema.availability {
    case .available:
      modelo = sistema.supportsLocale(portugues)
      if !modelo { motivo = "idioma" }
    case .unavailable(.deviceNotEligible):
      motivo = "aparelho"
    case .unavailable(.appleIntelligenceNotEnabled):
      motivo = "apple_intelligence_desligada"
    case .unavailable(.modelNotReady):
      motivo = "baixando"
    case .unavailable:
      motivo = "indisponivel"
    }
    #else
    motivo = "sem_modelo"
    #endif
    let transcritor = await SpeechTranscriber.supportedLocale(equivalentTo: portugues)
    let ditado = await DictationTranscriber.supportedLocale(equivalentTo: portugues)
    let fala = transcritor != nil || ditado != nil
    if !fala && motivo.isEmpty { motivo = "fala" }
    return ["transcricao": fala, "modelo": modelo, "motivo": motivo]
  }

  @available(iOS 26.0, *)
  private func transcrever(_ url: URL) async throws -> String {
    let arquivo = try AVAudioFile(forReading: url)
    // O transcritor novo é o melhor para relatos longos; o de ditado cobre idiomas que ele não tem.
    if let local = await SpeechTranscriber.supportedLocale(equivalentTo: portugues) {
      let transcritor = SpeechTranscriber(locale: local, preset: .transcription)
      try await instalarRecursos([transcritor])
      let analisador = SpeechAnalyzer(modules: [transcritor])
      async let partes = transcritor.results.reduce(into: [String]()) { $0.append(String($1.text.characters)) }
      if let fim = try await analisador.analyzeSequence(from: arquivo) {
        try await analisador.finalizeAndFinish(through: fim)
      } else {
        await analisador.cancelAndFinishNow()
      }
      return juntar(try await partes)
    }
    if let local = await DictationTranscriber.supportedLocale(equivalentTo: portugues) {
      let transcritor = DictationTranscriber(locale: local, preset: .longDictation)
      try await instalarRecursos([transcritor])
      let analisador = SpeechAnalyzer(modules: [transcritor])
      async let partes = transcritor.results.reduce(into: [String]()) { $0.append(String($1.text.characters)) }
      if let fim = try await analisador.analyzeSequence(from: arquivo) {
        try await analisador.finalizeAndFinish(through: fim)
      } else {
        await analisador.cancelAndFinishNow()
      }
      return juntar(try await partes)
    }
    throw FalhaIaLocal("fala")
  }

  @available(iOS 26.0, *)
  private func instalarRecursos(_ modulos: [any SpeechModule]) async throws {
    // Na primeira vez o iOS baixa o modelo de fala em português; depois funciona sem internet.
    if let pedido = try await AssetInventory.assetInstallationRequest(supporting: modulos) {
      try await pedido.downloadAndInstall()
    }
  }

  private func juntar(_ partes: [String]) -> String {
    partes
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .joined(separator: " ")
  }
}

final class FalhaIaLocal: GenericException<String>, @unchecked Sendable {
  override var reason: String { "IA no aparelho indisponível: \(param)" }
}

#if canImport(FoundationModels)
// Espelho do RegistroDiario do backend (core/schemas/diario.py). Os nomes dos campos são os
// mesmos, então o JSON gerado aqui é validado pelo Pydantic sem conversão.

@available(iOS 26.0, *)
@Generable
struct SonoGerado {
  @Guide(description: "Como foi a noite, segundo o relato. ruim se acordou muito ou dormiu pouco.", .anyOf(["boa", "regular", "ruim", "nao_informado"]))
  var qualidade: String
  @Guide(description: "Horas de sono citadas no relato. Vazio se não foram citadas.")
  var horas_aproximadas: Double?
  @Guide(description: "Quantas vezes acordou à noite, se citado. Vazio se não foi citado.")
  var despertares_noturnos: Int?
  @Guide(description: "Detalhe relevante em poucas palavras, ou vazio.")
  var observacao: String?
}

@available(iOS 26.0, *)
@Generable
struct AlimentacaoGerada {
  @Guide(description: "Como comeu no dia.", .anyOf(["boa", "regular", "pouca", "recusou", "nao_informado"]))
  var qualidade: String
  @Guide(description: "Se bebeu água ou líquidos.", .anyOf(["boa", "pouca", "nao_informado"]))
  var hidratacao: String
  var observacao: String?
}

@available(iOS 26.0, *)
@Generable
struct HumorGerado {
  @Guide(description: "Humor que mais apareceu no dia.", .anyOf(["calmo", "alegre", "triste", "ansioso", "irritado", "apatico", "variado", "nao_informado"]))
  var predominante: String
  var observacao: String?
}

@available(iOS 26.0, *)
@Generable
struct AgitacaoGerada {
  @Guide(description: "Intensidade da agitação. nenhuma só se o relato disser que foi tranquilo.", .anyOf(["nenhuma", "leve", "moderada", "intensa", "nao_informado"]))
  var nivel: String
  @Guide(description: "Quando aconteceu: manha, tarde, noite ou madrugada.", .maximumCount(4))
  var periodos: [String]
  @Guide(description: "O que desencadeou, nas palavras do relato.", .maximumCount(4))
  var gatilhos: [String]
}

@available(iOS 26.0, *)
@Generable
struct EpisodioGerado {
  @Guide(description: "Tipo do fato.", .anyOf(["queda", "desorientacao", "tentativa_de_sair", "agressividade", "alucinacao", "recusa_de_cuidado", "engasgo", "outro"]))
  var tipo: String
  @Guide(description: "O que aconteceu, objetivo e curto.")
  var descricao: String
}

@available(iOS 26.0, *)
@Generable
struct MedicacaoGerada {
  @Guide(description: "Se tomou os remédios do dia. parcial se tomou só parte.", .anyOf(["sim", "nao", "parcial", "nao_informado"]))
  var tomou: String
  var observacao: String?
}

@available(iOS 26.0, *)
@Generable
struct QuemCuidaGerado {
  @Guide(description: "Cansaço que a própria pessoa que cuida disse sentir.", .anyOf(["nenhum", "algum", "muito", "nao_informado"]))
  var cansaco: String
  var observacao: String?
}

@available(iOS 26.0, *)
@Generable(description: "Registro de um dia, só com o que foi relatado por quem cuida.")
struct RegistroGerado {
  var sono: SonoGerado
  var alimentacao: AlimentacaoGerada
  var humor: HumorGerado
  var agitacao: AgitacaoGerada
  @Guide(description: "Fatos pontuais e concretos: queda, tentativa de sair, desorientação, recusa, alucinação, agressividade, engasgo.", .maximumCount(6))
  var episodios: [EpisodioGerado]
  var medicacao: MedicacaoGerada
  @Guide(description: "O que acalmou ou fez bem, nas palavras de quem cuida.", .maximumCount(5))
  var o_que_ajudou: [String]
  @Guide(description: "Momentos de afeto, alegria ou conexão.", .maximumCount(5))
  var momentos_bons: [String]
  var quem_cuida: QuemCuidaGerado
  @Guide(description: "Outros fatos relatados.", .maximumCount(5))
  var observacoes: [String]
  @Guide(description: "Só situações que podem exigir atendimento imediato: queda com batida na cabeça, engasgo, falta de ar, desmaio, sangramento, violência, pessoa desaparecida. Vazio se nada disso foi relatado.", .maximumCount(4))
  var sinais_de_alerta: [String]
}

// Espelho de MemoriaOrganizada (backend/core/schemas/passaporte.py): sugestões que a família confere.

@available(iOS 26.0, *)
@Generable
struct ItemSugeridoGerado {
  @Guide(description: "Curto, nas palavras da família.")
  var titulo: String
  @Guide(description: "Um detalhe útil, se houver. Vazio se não houver.")
  var detalhe: String?
}

@available(iOS 26.0, *)
@Generable
struct PessoaSugeridaGerada {
  @Guide(description: "Como a família chama a pessoa.")
  var nome: String
  @Guide(description: "Quem é para ela, em poucas palavras.")
  var relacao: String?
}

@available(iOS 26.0, *)
@Generable
struct MusicaSugeridaGerada {
  var titulo: String
  var artista: String?
}

@available(iOS 26.0, *)
@Generable(description: "O que a família contou, separado nas seções do Passaporte. Só o que foi dito.")
struct MemoriaGerada {
  @Guide(description: "Trabalho, história de vida, jeito dela. Vazio se não foi falado.")
  var quem_ela: String?
  @Guide(description: "Como ela entende e se expressa. Vazio se não foi falado.")
  var como_se_comunica: String?
  @Guide(.maximumCount(6))
  var pessoas_importantes: [PessoaSugeridaGerada]
  @Guide(description: "Horários e hábitos do dia.", .maximumCount(6))
  var rotina: [ItemSugeridoGerado]
  @Guide(description: "O que acalma ou faz bem.", .maximumCount(6))
  var acalma: [ItemSugeridoGerado]
  @Guide(description: "O que agita, assusta ou incomoda.", .maximumCount(6))
  var agita: [ItemSugeridoGerado]
  @Guide(.maximumCount(6))
  var musicas: [MusicaSugeridaGerada]
  @Guide(.maximumCount(6))
  var comidas: [ItemSugeridoGerado]
  @Guide(description: "Histórias, lugares, épocas e fatos marcantes.", .maximumCount(6))
  var lembrancas: [ItemSugeridoGerado]
}

@available(iOS 26.0, *)
@Generable(description: "Perguntas abertas e gentis para uma conversa de reminiscência.")
struct PerguntasGeradas {
  @Guide(description: "Três perguntas curtas, uma por vez, sobre o tema. Nunca testam a memória.", .count(3))
  var perguntas: [String]
}
#endif
