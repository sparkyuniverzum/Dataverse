import sys
import uuid
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.guardian_service import evaluate_guardians


def test_evaluate_guardians_activates_alerts_from_calculated_values() -> None:
    asteroid_id = uuid.uuid4()
    asteroids = [
        {
            "id": asteroid_id,
            "value": "Projekt",
            "metadata": {
                "_guardians": [
                    {"field": "celkem", "operator": ">", "threshold": 1000, "action": "color_red"},
                    {"field": "celkem", "operator": ">", "threshold": 900, "action": "pulse"},
                ]
            },
            "calculated_values": {"celkem": 1200},
        }
    ]

    evaluated = evaluate_guardians(asteroids)
    assert evaluated[0]["active_alerts"] == ["color_red", "pulse"]


def test_evaluate_guardians_keeps_empty_alerts_for_non_matching_rules() -> None:
    asteroid_id = uuid.uuid4()
    asteroids = [
        {
            "id": asteroid_id,
            "value": "Projekt",
            "metadata": {"_guardians": [{"field": "celkem", "operator": ">", "threshold": 2000, "action": "hide"}]},
            "calculated_values": {"celkem": 1200},
        }
    ]

    evaluated = evaluate_guardians(asteroids)
    assert evaluated[0]["active_alerts"] == []
