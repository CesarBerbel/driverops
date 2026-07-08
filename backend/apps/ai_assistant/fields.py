"""Catálogo dos campos de texto da OS configuráveis pela IA + ações e prompt global.

Fonte única da verdade (código, versionado): os campos e as ações são fixos; as
*instruções* por campo e o prompt global são editáveis e vivem no banco
(:mod:`apps.ai_assistant.models`). Os defaults aqui são os textos "de fábrica",
usados para semear e para o botão *Restaurar instrução padrão*.

Cada campo declara:
- chave interna, nome amigável e descrição da finalidade;
- instrução principal da IA (default);
- tom, nível de detalhe e público-alvo padrão;
- permissões (reescrever / corrigir / resumir / expandir);
- grupos de contexto da OS que a IA pode usar naquele campo;
- flags de fidelidade (preservar termos técnicos, manter 1ª pessoa, remover
  gírias) e se o texto é visível ao cliente.
"""

# --- grupos de contexto disponíveis (subconjunto por campo) ------------------
CONTEXT_GROUPS = [
    ("customer", "Dados do cliente"),
    ("vehicle", "Dados do veículo"),
    ("order", "Dados da OS (número, status, datas)"),
    ("customer_report", "Relato do cliente"),
    ("diagnosis", "Diagnóstico existente"),
    ("services", "Serviços vinculados"),
    ("parts", "Peças vinculadas"),
    ("quote", "Orçamento relacionado"),
    ("financial", "Dados financeiros"),
    ("internal_notes", "Observações internas"),
    ("history", "Histórico relevante da OS"),
]
CONTEXT_GROUP_KEYS = frozenset(key for key, _label in CONTEXT_GROUPS)

# --- tom, detalhe e público-alvo ---------------------------------------------
TONES = [
    ("objective", "Objetivo"),
    ("technical", "Técnico"),
    ("commercial", "Comercial"),
    ("friendly", "Amigável"),
    ("formal", "Formal"),
]
DETAIL_LEVELS = [
    ("concise", "Conciso"),
    ("normal", "Equilibrado"),
    ("detailed", "Detalhado"),
]
AUDIENCES = [
    ("customer", "Cliente"),
    ("mechanic", "Mecânico"),
    ("attendant", "Atendente"),
    ("manager", "Gerente"),
    ("internal", "Uso interno"),
]

TONE_KEYS = frozenset(k for k, _ in TONES)
DETAIL_KEYS = frozenset(k for k, _ in DETAIL_LEVELS)
AUDIENCE_KEYS = frozenset(k for k, _ in AUDIENCES)


# --- ações de IA disponíveis nos campos --------------------------------------
# Cada ação: (chave, rótulo, instrução da ação, flag exigida | None)
ACTIONS = [
    (
        "improve",
        "Melhorar texto",
        "Melhore a clareza e a organização do texto, mantendo todo o conteúdo e o sentido original.",
        None,
    ),
    (
        "fix_grammar",
        "Corrigir português",
        "Corrija apenas ortografia, gramática e pontuação. Não altere o conteúdo nem o estilo.",
        "can_fix_grammar",
    ),
    (
        "professional",
        "Tornar mais profissional",
        "Reescreva com linguagem mais profissional e clara, preservando integralmente as informações.",
        "can_rewrite",
    ),
    (
        "summarize",
        "Resumir",
        "Resuma o texto de forma fiel, mantendo apenas as informações realmente presentes.",
        "can_summarize",
    ),
    (
        "detail",
        "Detalhar melhor",
        "Organize e explique melhor o que foi informado, sem inventar dados novos. Se faltar informação, indique.",
        "can_expand",
    ),
    (
        "adapt_customer",
        "Adaptar para o cliente",
        "Adapte o texto para o cliente: linguagem clara, cordial e sem termos excessivamente técnicos, sem expor observações internas.",
        "can_rewrite",
    ),
    (
        "adapt_internal",
        "Adaptar para uso interno",
        "Adapte o texto para uso interno da equipe: objetivo e técnico. Não deve ser exibido ao cliente.",
        "can_rewrite",
    ),
    (
        "final_pdf",
        "Versão final para impressão/PDF",
        "Gere a versão final e formal do texto, adequada para o documento impresso/PDF da OS.",
        "can_rewrite",
    ),
    (
        "rewrite_faithful",
        "Reescrever mantendo as informações",
        "Reescreva para maior clareza mantendo EXATAMENTE as mesmas informações. Não adicione, remova ou altere nenhum dado.",
        "can_rewrite",
    ),
]
ACTION_KEYS = [key for key, *_rest in ACTIONS]
ACTION_MAP = {key: (label, instruction, flag) for key, label, instruction, flag in ACTIONS}


# --- prompt global padrão da oficina -----------------------------------------
DEFAULT_GLOBAL_PROMPT = (
    "Você é um assistente de escrita para uma oficina mecânica. Sua função é "
    "ajudar a redigir, revisar, padronizar e melhorar textos da Ordem de Serviço "
    "(OS). Você NÃO é uma fonte autônoma de informação técnica.\n\n"
    "Regras invioláveis:\n"
    "- Nunca invente informações. Se o texto original não tiver dados suficientes, "
    "apenas melhore a clareza do que foi informado ou indique que faltam informações.\n"
    "- Nunca crie sintomas, defeitos, causas, peças, serviços, testes, medições, "
    "valores, prazos, aprovações ou procedimentos que não tenham sido informados.\n"
    "- Nunca assuma que uma peça foi trocada ou que um serviço foi autorizado se "
    "isso não estiver explícito.\n"
    "- Nunca altere placa, nome do cliente, modelo do veículo, número da OS ou "
    "valores.\n"
    "- Nunca altere dados técnicos sensíveis fornecidos pelo mecânico.\n"
    "- Use linguagem profissional, clara e adequada para oficina mecânica.\n"
    "- Diferencie texto interno de texto visível ao cliente.\n"
    "- Responda no idioma do texto original (padrão: português do Brasil).\n"
    "- Retorne APENAS o texto final do campo, sem explicações adicionais, aspas "
    "ou comentários, salvo quando a ação pedir explicitamente uma análise.\n"
    "- A sugestão será revisada por um responsável da oficina antes de ser aplicada."
)


def _field(
    key,
    name,
    description,
    instruction,
    *,
    tone="objective",
    detail_level="normal",
    audience="internal",
    can_rewrite=True,
    can_fix_grammar=True,
    can_summarize=True,
    can_expand=True,
    use_context=True,
    allowed_context=(),
    preserve_technical_terms=True,
    keep_first_person=False,
    remove_slang=True,
    visible_to_customer=False,
):
    return {
        "field_key": key,
        "name": name,
        "description": description,
        "instruction": instruction,
        "tone": tone,
        "detail_level": detail_level,
        "audience": audience,
        "can_rewrite": can_rewrite,
        "can_fix_grammar": can_fix_grammar,
        "can_summarize": can_summarize,
        "can_expand": can_expand,
        "use_context": use_context,
        "allowed_context": list(allowed_context),
        "preserve_technical_terms": preserve_technical_terms,
        "keep_first_person": keep_first_person,
        "remove_slang": remove_slang,
        "visible_to_customer": visible_to_customer,
        "is_active": True,
    }


# Instruções de exemplo do enunciado, mais defaults para os demais campos.
FIELDS = [
    _field(
        "customer_report",
        "Relato do cliente",
        "O que o cliente relatou sobre o problema do veículo.",
        "Você está trabalhando no campo Relato do Cliente de uma Ordem de Serviço.\n\n"
        "Preserve fielmente o que o cliente relatou. Não invente sintomas, defeitos, "
        "causas, peças, serviços ou diagnósticos. Não transforme o relato em "
        "diagnóstico técnico. Corrija apenas erros de escrita, pontuação e clareza, "
        "mantendo o sentido original.\n\n"
        "Se o texto estiver em primeira pessoa, preserve a ideia de que foi algo "
        "relatado pelo cliente. O objetivo é deixar o relato mais claro e "
        "organizado, sem alterar o conteúdo.",
        tone="objective",
        audience="attendant",
        can_rewrite=False,
        can_summarize=False,
        can_expand=False,
        use_context=False,
        allowed_context=[],
        keep_first_person=True,
        remove_slang=False,
    ),
    _field(
        "diagnosis",
        "Diagnóstico técnico",
        "O diagnóstico técnico do problema, feito pelo mecânico.",
        "Você está trabalhando no campo Diagnóstico Técnico de uma Ordem de Serviço.\n\n"
        "Reescreva o diagnóstico de forma mais técnica, clara e compreensível para o "
        "cliente. Explique melhor os procedimentos de verificação realizados, os "
        "indícios encontrados e a conclusão técnica, mas use somente as informações "
        "fornecidas pelo mecânico ou já registradas na OS.\n\n"
        "Não invente testes, medições, peças defeituosas, causas, serviços executados "
        "ou recomendações. Se alguma informação estiver incompleta, mantenha o texto "
        "dentro do que foi informado.",
        tone="technical",
        audience="customer",
        allowed_context=["customer_report", "services", "parts", "internal_notes"],
        visible_to_customer=True,
    ),
    _field(
        "internal_notes",
        "Observações internas",
        "Anotações internas da equipe sobre a OS.",
        "Você está trabalhando no campo Observações Internas da oficina.\n\n"
        "Organize o texto para uso da equipe interna, mantendo linguagem objetiva e "
        "técnica. Pode melhorar clareza, separar informações importantes e destacar "
        "cuidados operacionais, mas não deve transformar observação interna em texto "
        "para cliente.\n\n"
        "Não invente pendências, riscos, autorizações, peças, serviços ou decisões "
        "comerciais.",
        tone="technical",
        audience="internal",
        allowed_context=[
            "customer_report", "diagnosis", "services", "parts", "history"
        ],
    ),
    _field(
        "procedures",
        "Procedimentos realizados",
        "Descrição dos procedimentos/serviços executados no veículo.",
        "Você está trabalhando no campo Procedimentos Realizados.\n\n"
        "Organize os procedimentos executados de forma clara e sequencial. Use "
        "linguagem profissional e objetiva. Não adicione serviços, peças, testes ou "
        "etapas que não tenham sido informados.\n\n"
        "Quando possível, deixe o texto adequado para histórico da OS e para "
        "entendimento futuro pela equipe.",
        tone="technical",
        audience="internal",
        allowed_context=["services", "parts", "diagnosis"],
    ),
    _field(
        "recommendations",
        "Recomendações técnicas",
        "Recomendações técnicas para o cliente sobre o veículo.",
        "Você está trabalhando no campo Recomendações Técnicas.\n\n"
        "Transforme as recomendações informadas em um texto claro, profissional e "
        "compreensível para o cliente. Explique a importância da recomendação quando "
        "houver base no texto original, mas não crie recomendações novas.\n\n"
        "Não use tom alarmista. Não prometa resultado. Não invente urgência, prazo, "
        "risco ou consequência que não tenha sido informada.",
        tone="commercial",
        audience="customer",
        allowed_context=["diagnosis", "services", "parts"],
        visible_to_customer=True,
    ),
    _field(
        "customer_notes",
        "Observações para o cliente",
        "Observações destinadas ao cliente (visíveis para ele).",
        "Você está trabalhando em um texto de observações para o cliente.\n\n"
        "Use linguagem clara, cordial e acessível, evitando termos excessivamente "
        "técnicos. Não exponha observações internas nem informações que não devam ser "
        "compartilhadas com o cliente. Não invente informações.",
        tone="friendly",
        audience="customer",
        allowed_context=["customer", "vehicle", "order"],
        visible_to_customer=True,
    ),
    _field(
        "os_summary",
        "Resumo da OS",
        "Resumo geral do atendimento da OS.",
        "Você está gerando um resumo da Ordem de Serviço.\n\n"
        "Resuma de forma fiel o atendimento com base apenas nas informações "
        "presentes. Seja objetivo. Não invente serviços, peças, valores ou etapas.",
        tone="objective",
        audience="internal",
        allowed_context=[
            "order", "customer_report", "diagnosis", "services", "parts", "quote"
        ],
    ),
    _field(
        "quote_text",
        "Texto para orçamento",
        "Texto introdutório/explicativo do orçamento.",
        "Você está redigindo o texto de apresentação de um orçamento ao cliente.\n\n"
        "Escreva de forma clara, profissional e cordial, baseando-se apenas nos itens "
        "e valores já informados no orçamento. Não invente serviços, peças, valores, "
        "descontos ou prazos.",
        tone="commercial",
        audience="customer",
        allowed_context=["quote", "vehicle", "services", "parts"],
        visible_to_customer=True,
    ),
    _field(
        "approval_text",
        "Texto para aprovação do cliente",
        "Texto exibido ao cliente no momento de aprovar a OS/orçamento.",
        "Você está redigindo um texto de solicitação de aprovação ao cliente.\n\n"
        "Seja claro e cordial. Explique o que está sendo aprovado com base apenas nas "
        "informações informadas. Não invente itens, valores ou condições.",
        tone="commercial",
        audience="customer",
        allowed_context=["quote", "order", "services", "parts"],
        visible_to_customer=True,
    ),
    _field(
        "finalization_text",
        "Texto para finalização da OS",
        "Texto de conclusão/entrega da OS ao cliente.",
        "Você está redigindo o texto de finalização/entrega da Ordem de Serviço.\n\n"
        "Escreva de forma cordial e profissional, confirmando a conclusão com base no "
        "que foi realizado. Não invente serviços, garantias, prazos ou resultados.",
        tone="friendly",
        audience="customer",
        allowed_context=["order", "services", "parts", "vehicle"],
        visible_to_customer=True,
    ),
    _field(
        "pdf_text",
        "Texto para PDF/ordem impressa",
        "Texto formal para o documento impresso/PDF da OS.",
        "Você está gerando um texto formal para o documento impresso/PDF da OS.\n\n"
        "Use linguagem formal, clara e objetiva, adequada a um documento oficial da "
        "oficina. Baseie-se apenas nas informações informadas. Não invente conteúdo.",
        tone="formal",
        audience="customer",
        allowed_context=["order", "services", "parts", "diagnosis"],
        visible_to_customer=True,
    ),
    _field(
        "message_text",
        "Comunicação por WhatsApp/e-mail",
        "Mensagem manual enviada ao cliente por WhatsApp ou e-mail.",
        "Você está redigindo uma mensagem para enviar ao cliente por WhatsApp ou "
        "e-mail.\n\n"
        "Use linguagem cordial, clara e adequada ao canal. Baseie-se apenas nas "
        "informações informadas. Não invente dados, valores ou prazos. Não exponha "
        "observações internas.",
        tone="friendly",
        audience="customer",
        allowed_context=["customer", "vehicle", "order"],
        visible_to_customer=True,
    ),
]

FIELD_KEYS = [f["field_key"] for f in FIELDS]
FIELD_CHOICES = [(f["field_key"], f["name"]) for f in FIELDS]
DEFAULT_BY_KEY = {f["field_key"]: f for f in FIELDS}


def default_field(field_key):
    """Cópia dos valores de fábrica de um campo (para semear/restaurar)."""
    return dict(DEFAULT_BY_KEY[field_key])


def action_meta(action_key):
    """(label, instrução, flag_exigida) da ação, ou KeyError se inexistente."""
    return ACTION_MAP[action_key]
