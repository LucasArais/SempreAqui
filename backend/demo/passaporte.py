"""Passaporte de Memória da família de demonstração. Pessoas fictícias.

As chaves de foto apontam para retratos gerados por IA que já vêm no app (app/assets/fotos).
"""

PASSAPORTE_DEMO = {
    "nome": "Isabel",
    "como_gosta_de_ser_chamada": "Dona Isabel",
    "idade": 81,
    "foto": "donaIsabel",
    "quem_ela": (
        "Costureira por 40 anos, fez vestidos de noiva para meia cidade. Gosta de casa cheia, "
        "de café passado na hora e de conversar sobre o tempo do ateliê."
    ),
    "como_se_comunica": (
        "Entende melhor frases curtas, uma coisa de cada vez. Quando aperta a mão da gente, quer "
        'companhia. Chama a Cláudia de "minha menina".'
    ),
    "pessoas_importantes": [
        {
            "id": "p-marido",
            "nome": "O marido",
            "relacao": "Falecido em 2015. Se conheceram num baile de São João",
            "foto": "marido",
        },
        {"id": "p-claudia", "nome": "Cláudia", "relacao": "Filha, mora com ela", "foto": "claudia"},
        {"id": "p-rafael", "nome": "Rafael", "relacao": "Filho, mora em Recife", "foto": "rafael"},
        {
            "id": "p-neta",
            "nome": "A neta",
            "relacao": "Filha da Cláudia, canta com ela aos domingos",
            "foto": "neta",
        },
    ],
    "rotina": [
        {
            "id": "r-cafe",
            "titulo": "Acorda por volta das 7h",
            "detalhe": "Café com leite e pão na chapa",
        },
        {
            "id": "r-cochilo",
            "titulo": "Cochilo depois do almoço",
            "detalhe": "Na poltrona da sala, uns 40 minutos",
        },
        {"id": "r-tarde", "titulo": "Fim da tarde", "detalhe": "Novela e chá de camomila"},
    ],
    "acalma": [
        {
            "id": "a-roberto",
            "titulo": "Roberto Carlos",
            "detalhe": 'Principalmente "Detalhes". Ela canta junto',
        },
        {
            "id": "a-retalhos",
            "titulo": "Retalhos de tecido",
            "detalhe": "Gosta de dobrar e separar por cor",
        },
        {
            "id": "a-video",
            "titulo": "Ligação de vídeo com o Rafael",
            "detalhe": "Funciona melhor de manhã",
        },
    ],
    "agita": [
        {
            "id": "g-barulho",
            "titulo": "Barulho e muita gente",
            "detalhe": "Festas grandes, TV alta",
        },
        {"id": "g-banho", "titulo": "Pressa no banho", "detalhe": "Avisar antes de cada passo"},
        {
            "id": "g-tarde",
            "titulo": "Fim da tarde",
            "detalhe": "Às vezes pergunta pela casa da mãe dela",
        },
    ],
    "musicas": [
        {"id": "m-detalhes", "titulo": "Detalhes", "artista": "Roberto Carlos"},
        {"id": "m-forro", "titulo": "Olha pro céu", "artista": "Luiz Gonzaga"},
        {"id": "m-hino", "titulo": "Hinos da igreja", "artista": None},
    ],
    "comidas": [
        {"id": "c-sopa", "titulo": "Sopa de legumes"},
        {"id": "c-pao", "titulo": "Pão de queijo"},
        {"id": "c-doce", "titulo": "Doce de abóbora", "detalhe": "Fazia com a mãe dela"},
    ],
    "lembrancas": [
        {
            "id": "l-atelie",
            "titulo": "O ateliê de costura",
            "detalhe": "1978, os vestidos de noiva",
            "foto": "atelie",
        },
        {
            "id": "l-saojoao",
            "titulo": "São João na praça",
            "detalhe": "1965, onde conheceu o marido",
            "foto": "saoJoao",
        },
        {
            "id": "l-claudia",
            "titulo": "Com a Cláudia pequena",
            "detalhe": "1978",
            "foto": "claudiaPequena",
        },
        {
            "id": "l-casa",
            "titulo": "A casa da Rua das Flores",
            "detalhe": "Onde criou os filhos",
            "foto": "casa",
        },
        {"id": "l-aniversario", "titulo": "Os 81 anos, com a neta", "foto": "aniversario"},
    ],
}

# Chave -> arquivo em app/assets/fotos, para a página somente leitura da demonstração.
FOTOS_DEMO = {
    "donaIsabel": "dona-isabel.jpg",
    "claudia": "claudia.jpg",
    "rafael": "rafael.jpg",
    "neta": "neta.jpg",
    "cuidador": "cuidador.jpg",
    "marido": "marido.jpg",
    "familiaReunida": "familia-reunida.jpg",
    "atelie": "atelie-1978.jpg",
    "claudiaPequena": "claudia-pequena.jpg",
    "saoJoao": "sao-joao.jpg",
    "casa": "casa-rua-das-flores.jpg",
    "aniversario": "aniversario-81.jpg",
}

# Tarefas da família de demonstração. "Cobrir a folga" fica sem responsável: é a que o Rafael
# assume no demo. Dias relativos à data em que o seed roda.
TAREFAS_DEMO = [
    {
        "titulo": "Ligar para a Dona Isabel",
        "tipo": "visita",
        "dias": 0,
        "hora": 10,
        "responsavel_nome": "Rafael",
        "concluida": True,
    },
    {
        "titulo": "Comprar fraldas e lenços",
        "tipo": "compra",
        "dias": 0,
        "hora": 18,
        "responsavel_nome": "A neta",
    },
    {
        "titulo": "Consulta na UBS",
        "tipo": "consulta",
        "dias": 2,
        "hora": 9,
        "responsavel_nome": "Cláudia",
    },
    {
        "titulo": "Cobrir a folga da Cláudia no sábado",
        "tipo": "cobrir_folga",
        "dias": 4,
        "hora": 14,
        "responsavel_nome": None,
    },
]
