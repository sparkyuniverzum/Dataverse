from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
response = client.post(
    "/civilizations/ingest", json={"value": "foo", "galaxy_id": "84735a83-eec3-4135-9b39-92514555696a"}
)
print("Status:", response.status_code)
print("Body:", response.text)
