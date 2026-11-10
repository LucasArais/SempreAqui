Pod::Spec.new do |s|
  s.name           = 'IaLocal'
  s.version        = '1.0.0'
  s.summary        = 'IA no próprio aparelho para o SempreAqui: transcrição e modelo de linguagem da Apple.'
  s.description    = 'Transcreve o relato com o reconhecimento de fala do iOS e organiza com o modelo local da Apple, sem enviar o áudio para fora do celular.'
  s.author         = 'SempreAqui'
  s.homepage       = 'https://github.com/LucasArais/SempreAqui'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  # Os frameworks só existem no iOS 26: ligação fraca para o app continuar abrindo em versões antigas.
  s.weak_frameworks = 'FoundationModels', 'Speech'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
