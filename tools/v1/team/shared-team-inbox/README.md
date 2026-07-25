# Shared Team Inbox (V1)

Isolated architecture contract for the Shared Team Inbox tool.

## Directory Structure

This folder acts as a self-contained mini-product for the V1 Launch Tool.

- `/docs`: Contains `ARCHITECTURE.md` (boundaries and data ownership) and `CONTRACT.md` (contributor guidelines).
- `/components`: Local UI components.
- `/services`: Local business logic and mocked API services.
- `/hooks`: Data and state management hooks.
- `/types`: Type definitions.
- `/tests`: Local unit tests.

## Goal

The goal of this directory is to build the Shared Team Inbox tool so it is ready for launch, but keep the work entirely isolated until an explicit integration issue links it.

Please read `docs/CONTRACT.md` before making any contributions to ensure strict compliance with the isolation requirements.
