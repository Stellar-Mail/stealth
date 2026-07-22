import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

import { runRepositoryContractTests } from "./repository-contract";

// Issue #1494: run the shared repository conformance suite against every adapter.
// Memory adapter runs here; a production adapter registers the same suite via its
// own factory so CI fails when any adapter violates the contract.
runRepositoryContractTests("MemoryApiRepository", () => new MemoryApiRepository());
