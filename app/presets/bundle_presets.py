from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class BundleDefinition:
    key: str
    version: int
    name: str
    description: str
    tags: tuple[str, ...]
    manifest: dict[str, Any]


PRESET_BUNDLES: tuple[BundleDefinition, ...] = (
    BundleDefinition(
        key="simple_crm",
        version=1,
        name="Simple CRM",
        description="Clients and meetings bundle with mandatory linkage from meetings to clients.",
        tags=("crm", "sales", "starter"),
        manifest={
            "planets": [
                {
                    "key": "clients",
                    "table_name": "CRM > Clients",
                    "schema_preset_key": "contacts_org",
                },
                {
                    "key": "meetings",
                    "table_name": "CRM > Meetings",
                    "schema_preset_key": "events_calendar",
                },
            ],
            "moons": [
                {
                    "ref": "client_acme",
                    "planet": "clients",
                    "value": "Client ACME",
                    "metadata": {
                        "contact_id": "C-ACME-001",
                        "full_name": "ACME Buying Team",
                        "company": "ACME",
                        "role": "buyer",
                        "email": "acme@example.com",
                        "phone": "+420100200300",
                        "segment": "B2B",
                        "country": "CZ",
                        "status": "active",
                        "source": "bundle",
                    },
                },
                {
                    "ref": "client_globex",
                    "planet": "clients",
                    "value": "Client Globex",
                    "metadata": {
                        "contact_id": "C-GLOBEX-001",
                        "full_name": "Globex Procurement",
                        "company": "Globex",
                        "role": "manager",
                        "email": "globex@example.com",
                        "phone": "+420300200100",
                        "segment": "B2B",
                        "country": "CZ",
                        "status": "active",
                        "source": "bundle",
                    },
                },
                {
                    "ref": "meeting_acme_intro",
                    "planet": "meetings",
                    "value": "Meeting ACME Intro",
                    "metadata": {
                        "event_id": "M-ACME-001",
                        "title": "ACME Intro Call",
                        "event_type": "external",
                        "start_at": "2026-03-11T09:00:00Z",
                        "end_at": "2026-03-11T09:45:00Z",
                        "location": "Online",
                        "organizer": "sales",
                        "capacity": 8,
                        "status": "planned",
                        "reference_url": "https://example.local/meetings/acme-intro",
                    },
                },
            ],
            "bonds": [
                {
                    "source_ref": "meeting_acme_intro",
                    "target_ref": "client_acme",
                    "type": "FLOW",
                },
            ],
            "guardians": [
                {
                    "target_ref": "meeting_acme_intro",
                    "field": "status",
                    "operator": "==",
                    "threshold": "approved",
                    "action": "allow_close",
                },
            ],
        },
    ),
    BundleDefinition(
        key="employee_onboarding",
        version=1,
        name="Employee Onboarding",
        description="Template employee moon plus linked onboarding tasks and approval workflow.",
        tags=("hr", "onboarding", "process"),
        manifest={
            "planets": [
                {
                    "key": "people",
                    "table_name": "HR > People",
                    "schema_preset_key": "contacts_org",
                },
                {
                    "key": "tasks",
                    "table_name": "HR > Onboarding Tasks",
                    "schema_preset_key": "tasks_work",
                },
            ],
            "moons": [
                {
                    "ref": "employee_template",
                    "planet": "people",
                    "value": "New Employee Template",
                    "metadata": {
                        "contact_id": "EMP-TPL-001",
                        "full_name": "Rename Me",
                        "company": "Your Company",
                        "role": "employee",
                        "email": "employee.template@example.com",
                        "phone": "",
                        "segment": "internal",
                        "country": "CZ",
                        "status": "active",
                        "source": "bundle",
                    },
                },
                {
                    "ref": "task_it_setup",
                    "planet": "tasks",
                    "value": "Onboarding Task IT",
                    "metadata": {
                        "task_id": "ONB-TASK-IT",
                        "title": "Prepare IT access",
                        "description": "Create accounts, access rights and hardware handoff.",
                        "state": "todo",
                        "priority": "high",
                        "assignee": "it",
                        "reporter": "hr",
                        "due_date": "2026-03-15",
                        "estimate_h": 2,
                        "spent_h": 0,
                    },
                },
                {
                    "ref": "task_contract",
                    "planet": "tasks",
                    "value": "Onboarding Task Contract",
                    "metadata": {
                        "task_id": "ONB-TASK-CONTRACT",
                        "title": "Sign contract",
                        "description": "Collect legal signatures and archive document.",
                        "state": "todo",
                        "priority": "high",
                        "assignee": "hr",
                        "reporter": "hr",
                        "due_date": "2026-03-16",
                        "estimate_h": 1,
                        "spent_h": 0,
                    },
                },
                {
                    "ref": "task_manager_intro",
                    "planet": "tasks",
                    "value": "Onboarding Task Manager Intro",
                    "metadata": {
                        "task_id": "ONB-TASK-MANAGER",
                        "title": "Manager intro session",
                        "description": "First team sync and expectations setup.",
                        "state": "todo",
                        "priority": "medium",
                        "assignee": "manager",
                        "reporter": "hr",
                        "due_date": "2026-03-17",
                        "estimate_h": 1,
                        "spent_h": 0,
                    },
                },
            ],
            "bonds": [
                {"source_ref": "employee_template", "target_ref": "task_it_setup", "type": "FLOW"},
                {"source_ref": "employee_template", "target_ref": "task_contract", "type": "FLOW"},
                {"source_ref": "employee_template", "target_ref": "task_manager_intro", "type": "FLOW"},
            ],
            "guardians": [
                {
                    "target_ref": "task_contract",
                    "field": "state",
                    "operator": "==",
                    "threshold": "approved",
                    "action": "unlock_employee_active",
                },
            ],
        },
    ),
)


def list_preset_bundles() -> list[BundleDefinition]:
    return list(PRESET_BUNDLES)


def get_preset_bundle(bundle_key: str) -> BundleDefinition | None:
    key = str(bundle_key or "").strip()
    if not key:
        return None
    for bundle in PRESET_BUNDLES:
        if bundle.key == key:
            return bundle
    return None
