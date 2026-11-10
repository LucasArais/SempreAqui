"""Acervo de fontes oficiais do Apoio na Hora Difícil.

Cada trecho é cópia literal (só com espaços e quebras de linha normalizados) do
Guia Prático do Cuidador, Ministério da Saúde, 2008, com a página. Nada aqui é escrito por nós:
se uma situação não tem trecho oficial, o Apoio diz isso e encaminha à equipe de saúde.

A busca é por palavras (core/apoio.py), sem embeddings: o acervo é pequeno, a busca é
explicável e roda sem custo. Trechos com termos que evitamos na interface ficaram de fora.
"""

from __future__ import annotations

GUIA = {
    "titulo": "Guia Prático do Cuidador",
    "orgao": "Ministério da Saúde",
    "ano": 2008,
    "url": "https://bvsms.saude.gov.br/bvs/publicacoes/guia_pratico_cuidador.pdf",
}

# tema: palavras (sem acento, minúsculas) que puxam o trecho na busca.
TRECHOS: list[dict] = [
    {
        "id": "comunicacao",
        "pagina": 43,
        "temas": ["comunicacao", "agitacao", "repeticao", "confusao", "irritacao"],
        "texto": (
            "Algumas vezes a pessoa cuidada pode ficar irritada por não conseguir falar ou se "
            "expressar, embora entenda o que falam com ela. [...] Use frases curtas e objetivas. "
            "[...] Aguarde a resposta da primeira pergunta antes de elaborar a segunda, pois a "
            "pessoa pode necessitar de um tempo maior para entender o que foi falado e responder."
        ),
    },
    {
        "id": "comunicacao-calma",
        "pagina": 44,
        "temas": ["comunicacao", "agitacao", "repeticao", "irritacao"],
        "texto": (
            "Não interrompa a pessoa no meio de sua fala, demonstrando pressa ou impaciência. "
            "[...] Diminua os ruídos no ambiente onde a pessoa cuidada permanece."
        ),
    },
    {
        "id": "musica-carinho",
        "pagina": 44,
        "temas": ["agitacao", "tristeza", "apatia", "musica", "comunicacao"],
        "texto": (
            "Converse e cante com a pessoa, pois essas atividades estimulam o uso da voz. A música "
            "ajuda a pessoa cuidada a recordar pessoas, sentimentos e situações que ocorreram com "
            "ela, ajudando na sua comunicação. O toque, o olhar, o beijo, o carinho são outras "
            "formas de comunicação que ajudam o cuidador a compreender a pessoa cuidada e ser "
            "compreendido por ela."
        ),
    },
    {
        "id": "recusa-banho",
        "pagina": 21,
        "temas": ["banho", "recusa"],
        "texto": (
            "Algumas pessoas idosas, doentes ou com incapacidades podem, às vezes, se recusar a "
            "tomar banho. É preciso que o cuidador identifique as causas. Pode ser que a pessoa "
            "tenha dificuldade para locomover-se, tenha medo da água ou de cair, pode ainda estar "
            "deprimida, sentir dores, tonturas ou mesmo sentir-se envergonhada de ficar exposta à "
            "outra pessoa, especialmente se o cuidador for do sexo oposto. É preciso que o cuidador "
            "tenha muita sensibilidade para lidar com essas questões. Respeite os costumes da "
            "pessoa cuidada e lembre que confiança se conquista, com carinho, tempo e respeito."
        ),
    },
    {
        "id": "nao-quero",
        "pagina": 9,
        "temas": ["recusa", "remedio_recusa", "banho", "comer"],
        "texto": (
            "O “não”, “não quero” ou “não posso”, pode indicar várias coisas, como por exemplo: "
            "não quero ou não gosto de como isso é feito, ou agora não quero, vamos deixar para "
            "depois? O cuidador precisa ir aprendendo a entender o que essas respostas significam "
            "e quando se sentir impotente ou desanimado, diante de uma resposta negativa, é bom "
            "conversar com a pessoa, com a família, com a equipe de saúde."
        ),
    },
    {
        "id": "recusa-comer",
        "pagina": 25,
        "temas": ["comer", "recusa"],
        "texto": (
            "É comum que pessoas doentes tenham o apetite diminuído, mas é preciso estar atento, a "
            "recusa em se alimentar ou a agitação no horário das refeições pode ser decorrente de "
            "prótese mal adaptada, cárie, dentes fraturados, feridas, alterações e inflamação das "
            "gengivas."
        ),
    },
    {
        "id": "rotina",
        "pagina": 42,
        "temas": ["rotina", "confusao", "agitacao", "sono"],
        "texto": (
            "A pessoa cuidada com demência se sente melhor quando existe uma rotina de horários "
            "para as atividades do dia-a-dia. Essa rotina é extremamente importante, pois isso "
            "ajuda a pessoa a organizar sua mente."
        ),
    },
    {
        "id": "vestir",
        "pagina": 43,
        "temas": ["vestir"],
        "texto": (
            "A pessoa que tem demência tem mais dificuldade em tomar decisões. Dê a ela uma peça de "
            "roupa de cada vez, na seqüência que ela deverá vestir, falando clara e pausadamente o "
            "nome da peça."
        ),
    },
    {
        "id": "sono",
        "pagina": 53,
        "temas": ["sono"],
        "texto": (
            "Evite, após as 18 horas, dar a pessoa substâncias estimulantes como o chá preto, mate "
            "e café. Verifique se a pessoa cuidada está sentindo dor, coceira na pele, câimbra ou "
            "outro desconforto que possa estar prejudicando o sono. [...] Atividades prazerosas, "
            "exercícios leves e massagens ajudam a relaxar e melhoram a qualidade do sono."
        ),
    },
    {
        "id": "sono-conversa",
        "pagina": 54,
        "temas": ["sono", "medo"],
        "texto": (
            "Converse com a pessoa a fim de identificar as causas da insônia ou da sonolência. Pode "
            "ser que a pessoa esteja sentindo medo ou angustia ou ter tido desentendimentos "
            "familiares."
        ),
    },
    {
        "id": "remedio-dormir",
        "pagina": 54,
        "temas": ["sono", "remedio"],
        "texto": (
            "Medicamentos para dormir só podem ser administrados se tiverem sido receitados pelo "
            "médico. Esteja atento às reações, pois alguns medicamentos podem provocar agitação ou "
            "excesso de sono."
        ),
    },
    {
        "id": "medicacao-equipe",
        "pagina": 55,
        "temas": ["remedio", "remedio_recusa"],
        "texto": (
            "Peça ajuda à equipe de saúde para organizar a medicação. [...] Converse com a equipe "
            "de saúde sobre o planejamento dos horários de medicação."
        ),
    },
    {
        "id": "confusao-mental",
        "pagina": 59,
        "temas": ["confusao_subita"],
        "texto": (
            "Na confusão mental a pessoa fica agitada, irritada, desorientada, não sabe onde está e "
            "fala coisas sem sentido, parece ativa num momento e logo a seguir pode estar sonolenta "
            "e com a atenção prejudicada. [...] É preciso que a pessoa seja avaliada pela equipe de "
            "saúde."
        ),
    },
    {
        "id": "dividir-cuidado",
        "pagina": 11,
        "temas": ["cansaco"],
        "texto": (
            "O cuidador deve contar com a ajuda de outras pessoas, como a ajuda da família, amigos "
            "ou vizinhos, definir dias e horários para cada um assumir parte dos cuidados. Essa "
            "parceria permite ao cuidador ter um tempo livre para se cuidar, se distrair e "
            "recuperar as energias gastas no ato de cuidar do outro; peça ajuda sempre que algo "
            "não estiver bem."
        ),
    },
    {
        "id": "sentimentos",
        "pagina": 9,
        "temas": ["cansaco", "culpa"],
        "texto": (
            "O cuidador e a pessoa a ser cuidada podem apresentar sentimentos diversos e "
            "contraditórios, tais como: raiva, culpa, medo, angústia, confusão, cansaço, estresse, "
            "tristeza, nervosismo, irritação, choro, medo da morte e da invalidez. Esses "
            "sentimentos podem aparecer juntos na mesma pessoa, o que é bastante normal nessa "
            "situação."
        ),
    },
    {
        "id": "grupos",
        "pagina": 17,
        "temas": ["cansaco", "solidao"],
        "texto": (
            "Nesses grupos é possível conversar sobre as boas experiências e também falar sobre as "
            "angústias, medos e dificuldades. [...] Compartilhar experiências traz alívio, pois "
            "assim o cuidador percebe que não está sozinho, que as dúvidas e dificuldades não são "
            "só suas e também que suas experiências podem ser valiosas para outros cuidadores."
        ),
    },
    {
        "id": "dignidade",
        "pagina": 9,
        "temas": ["confusao", "discussao", "comunicacao"],
        "texto": (
            "Muitas vezes, a pessoa cuidada parece estar dormindo, mas pode estar ouvindo o que "
            "falam a seu redor. Por isso, é fundamental respeitar a dignidade da pessoa cuidada e "
            "não discutir em sua presença, fatos relacionados com ela, agindo como se ela não "
            "entendesse, não existisse, ou não estivesse presente. [...] Encoraje o riso. O bom "
            "humor é uma boa maneira de contornar confusões e mal entendidos."
        ),
    },
    {
        "id": "caminhada",
        "pagina": 36,
        "temas": ["sair", "andar"],
        "texto": (
            "A pessoa que sofre de demência deve ser estimulada a fazer o mesmo trajeto durante as "
            "caminhadas e o cuidador deve mostrar a ela os pontos de referência, falando o nome das "
            "coisas que vão encontrando pelo caminho."
        ),
    },
    {
        "id": "interesse",
        "pagina": 42,
        "temas": ["apatia"],
        "texto": (
            "A falta de interesse em participar de atividades pode significar que a pessoa não está "
            "conseguindo realizar ou não gosta da atividade oferecida. Procure conhecer melhor o "
            "que a pessoa gosta de fazer e peça ajuda da equipe de saúde para encontrar outras "
            "atividades interessantes."
        ),
    },
]


def citacao(trecho: dict) -> dict:
    """Trecho pronto para a tela: texto, de onde veio e link direto para a página."""
    return {
        "id": trecho["id"],
        "texto": trecho["texto"],
        "fonte": f"{GUIA['titulo']}, {GUIA['orgao']}, {GUIA['ano']}, p. {trecho['pagina']}",
        "url": f"{GUIA['url']}#page={trecho['pagina']}",
    }
