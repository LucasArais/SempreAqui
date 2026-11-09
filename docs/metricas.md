# Métricas de uso

O app registra eventos **anônimos e agregados** para sabermos se ele ajuda de verdade e se a IA está acertando. Nenhum evento carrega conteúdo de áudio, transcrição, resumo ou nome. A família entra apenas como um hash, que serve para contar famílias ativas sem identificar nenhuma.

## O que medimos

| Indicador | De onde vem | Por que importa |
|---|---|---|
| **Taxa de correção** | relatos com ao menos um campo corrigido / relatos processados | Principal indicador de qualidade da IA. Se cai com o tempo, a IA está aprendendo com a família |
| Correções por campo | eventos `campo_corrigido` | Mostra onde a IA mais erra (sono? humor?) e onde melhorar o prompt |
| Diários por semana | eventos `diario_gravado` | Uso real. Meta: pelo menos 4 por semana por família ativa |
| Famílias ativas por semana | hashes distintos | Adoção |
| Tempo até o primeiro diário | `primeiro_diario`, segundos desde a instalação | Meta: menos de 2 minutos |
| Relatos enviados depois de ficar offline | `relato_enviado_offline` | Prova que a fila offline funciona na vida real |
| Sessões de reminiscência e reação | `sessao_concluida` com a reação marcada | Quais temas funcionam (Ciclo 4) |

## Como ver

Com o backend rodando:

```bash
curl -s localhost:8000/metricas | python3 -m json.tool
```

Exemplo de resposta:

```json
{
  "diarios_por_semana": [{"semana": "2026-S46", "diarios": 12, "familias": 3}],
  "relatos_processados": 12,
  "relatos_com_correcao": 2,
  "taxa_de_correcao": 0.167,
  "correcoes_por_campo": [{"campo": "sono.qualidade", "correcoes": 2}],
  "segundos_ate_primeiro_diario_mediana": 84,
  "sessoes_reminiscencia": [{"reacao": "gostou_muito", "sessoes": 4}]
}
```

## Garantias de privacidade

- Só tipos de evento conhecidos são aceitos (`backend/core/repositorio.py`, `EVENTOS_PERMITIDOS`). Qualquer outro é recusado.
- O campo `rotulo` aceita apenas identificadores curtos (`sono.qualidade`, `gostou_muito`), nunca texto livre.
- Há um teste que confere que o painel não contém o id da família nem palavras dos relatos (`test_metricas_sao_anonimas_e_calculam_taxa_de_correcao`).
