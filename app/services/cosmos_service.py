from app.services.cosmos.service_branches import CosmosServiceBranches
from app.services.cosmos.service_capabilities import CosmosServiceCapabilities
from app.services.cosmos.service_contracts import CosmosServiceContracts
from app.services.cosmos.service_core import CosmosServiceCore


class CosmosService(
    CosmosServiceCore,
    CosmosServiceBranches,
    CosmosServiceContracts,
    CosmosServiceCapabilities,
):
    pass
