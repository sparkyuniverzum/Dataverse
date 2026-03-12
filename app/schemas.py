from __future__ import annotations

# Backward-compatible facade: keep `app.schemas` import path stable while
# schema families are grouped by canonical ontology domains.
from app.domains.auth.schemas import *  # noqa: F401,F403
from app.domains.bonds.schemas import *  # noqa: F401,F403
from app.domains.branches.schemas import *  # noqa: F401,F403
from app.domains.civilizations.schemas import *  # noqa: F401,F403
from app.domains.galaxies.schemas import *  # noqa: F401,F403
from app.domains.imports.schemas import *  # noqa: F401,F403
from app.domains.moons.schemas import *  # noqa: F401,F403
from app.domains.planets.schemas import *  # noqa: F401,F403
from app.domains.shared.schemas import *  # noqa: F401,F403
from app.domains.star_core.schemas import *  # noqa: F401,F403
from app.schema_models.branch_contracts import (  # noqa: F401
    _normalize_contract_dict_list,
    _normalize_contract_string_list,
)
from app.schema_models.execution import (  # noqa: F401
    ParseCommandLexiconResponse,
    ParseCommandPlanResponse,
    ParseCommandPreviewExpectedEvent,
    ParseCommandPreviewOccSignal,
    ParseCommandPreviewResponse,
    ParseCommandPreviewRiskFlags,
    ParseCommandPreviewScope,
    ParseCommandRequest,
    ParseCommandResponse,
    ParserAliasesResponse,
    ParserAliasMutationResponse,
    ParserAliasPatchRequest,
    ParserAliasRecord,
    ParserAliasUpsertRequest,
    ParserLexiconCommand,
    SemanticEffect,
    TaskBatchExecuteRequest,
    TaskBatchExecuteResponse,
    TaskSchema,
)
