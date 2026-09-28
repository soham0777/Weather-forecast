def test_liveness(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_detailed_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "UP"
    assert body["components"]["database"] == "UP"
    assert "NOT A REAL BANKING SYSTEM" in body["disclaimer"]
    assert response.headers["X-Request-ID"]


def test_swagger_redoc_and_openapi_are_served(client):
    assert client.get("/api-docs").status_code == 200
    assert client.get("/redoc").status_code == 200
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    assert "get" in paths["/api/v1/accounts/{account_id}/balance"]
    assert "get" in paths["/api/v1/accounts/{account_id}/transactions"]
    assert "post" in paths["/api/v1/accounts/{account_id}/transfers"]
    assert "get" in paths["/api/v1/transfers/{transfer_id}"]
    assert "get" in paths["/api/v1/health"]
    assert "DemoOAuth2" in spec["components"]["securitySchemes"]


def test_unknown_route_returns_problem_json(client):
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/problem+json")
    assert response.json()["status"] == 404
