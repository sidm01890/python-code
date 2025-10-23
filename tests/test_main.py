"""
Basic tests for the FastAPI application
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_docs_endpoint():
    """Test API documentation endpoint"""
    response = client.get("/api-docs")
    assert response.status_code == 200


def test_redoc_endpoint():
    """Test ReDoc documentation endpoint"""
    response = client.get("/redoc")
    assert response.status_code == 200


def test_auth_login_missing_credentials():
    """Test login endpoint with missing credentials"""
    response = client.post("/api/auth/login", json={})
    assert response.status_code == 422  # Validation error


def test_auth_register_missing_data():
    """Test registration endpoint with missing data"""
    response = client.post("/api/auth/register", json={})
    assert response.status_code == 422  # Validation error
