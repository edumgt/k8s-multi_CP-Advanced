import re
from typing import Any

from fastapi import HTTPException

from app.config import Settings

READ_ONLY_SELECT = re.compile(r"^\s*select\b", re.IGNORECASE)


def _normalized_dbms(settings: Settings) -> str:
    return (settings.teradata_dbms or "teradata").strip().lower()


def teradata_summary(settings: Settings) -> dict[str, str]:
    if settings.teradata_fake_mode or not settings.teradata_host:
        return {
            "mode": "mock",
            "note": "Set PLATFORM_TERADATA_HOST, PLATFORM_TERADATA_USER and PLATFORM_TERADATA_PASSWORD to run live ANSI SQL against Teradata.",
        }

    dbms = _normalized_dbms(settings)
    if dbms == "postgres":
        port_note = f":{settings.teradata_port}" if settings.teradata_port else ""
        return {
            "mode": "postgres-mock-live",
            "note": (
                "Connected to PostgreSQL mock endpoint "
                f"{settings.teradata_host}{port_note}/{settings.teradata_database} for Teradata-like workflow tests."
            ),
        }

    return {
        "mode": "live",
        "note": f"Connected target database: {settings.teradata_database}",
    }


def _postgres_connect_url(settings: Settings):
    from sqlalchemy.engine import URL

    return URL.create(
        "postgresql+psycopg",
        username=settings.teradata_user,
        password=settings.teradata_password,
        host=settings.teradata_host,
        port=settings.teradata_port,
        database=settings.teradata_database,
        query={"sslmode": "require" if settings.teradata_encryptdata else "disable"},
    )


def _is_missing_relation_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "relation" in message and "does not exist" in message


def run_ansi_query(settings: Settings, sql: str, limit: int) -> dict[str, Any]:
    if not READ_ONLY_SELECT.match(sql):
        raise HTTPException(status_code=400, detail="Only read-only ANSI SELECT statements are allowed.")

    normalized_sql = " ".join(sql.split())
    if settings.teradata_fake_mode or not settings.teradata_host:
        rows = [
            {
                "workload_name": "airflow-daily-sync",
                "owner_name": "platform-team",
                "workload_status": "RUNNING",
            },
            {
                "workload_name": "jupyter-eda-session",
                "owner_name": "data-science",
                "workload_status": "IDLE",
            },
            {
                "workload_name": "mongodb-cache-refresh",
                "owner_name": "backend",
                "workload_status": "QUEUED",
            },
        ][:limit]
        return {
            "columns": list(rows[0].keys()) if rows else [],
            "rows": rows,
            "source": "mock",
            "note": f"Mock rows returned for query: {normalized_sql}",
        }

    dbms = _normalized_dbms(settings)
    if dbms == "postgres":
        try:
            from sqlalchemy import create_engine, text
            from sqlalchemy.pool import NullPool
        except ImportError as exc:
            raise HTTPException(status_code=500, detail=f"SQLAlchemy import failed: {exc}") from exc

        engine = None
        try:
            engine = create_engine(
                _postgres_connect_url(settings),
                pool_pre_ping=True,
                poolclass=NullPool,
            )
            with engine.connect() as connection:
                result = connection.execute(text(normalized_sql))
                columns = list(result.keys())
                rows = [dict(item) for item in result.mappings().fetchmany(limit)]
            return {
                "columns": columns,
                "rows": rows,
                "source": "postgres",
                "note": f"Fetched up to {limit} rows from PostgreSQL mock DB via SQLAlchemy.",
            }
        except Exception as exc:  # noqa: BLE001
            if _is_missing_relation_error(exc):
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "PostgreSQL mock schema is not initialized. "
                        "Run '/api/admin/teradata/bootstrap' with dry_run=false first. "
                        f"Original error: {exc}"
                    ),
                ) from exc
            raise HTTPException(status_code=502, detail=f"PostgreSQL mock query failed: {exc}") from exc
        finally:
            if engine is not None:
                engine.dispose()

    if dbms != "teradata":
        raise HTTPException(status_code=400, detail=f"Unsupported PLATFORM_TERADATA_DBMS: {dbms}")

    try:
        import teradatasql
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"teradatasql import failed: {exc}") from exc

    connection = None
    try:
        connection = teradatasql.connect(
            host=settings.teradata_host,
            user=settings.teradata_user,
            password=settings.teradata_password,
            database=settings.teradata_database,
            encryptdata="true" if settings.teradata_encryptdata else "false",
        )
        with connection.cursor() as cursor:
            cursor.execute(normalized_sql)
            columns = [description[0] for description in cursor.description or []]
            rows = [dict(zip(columns, row)) for row in cursor.fetchmany(limit)]
        return {
            "columns": columns,
            "rows": rows,
            "source": "teradata",
            "note": f"Fetched up to {limit} rows from Teradata.",
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Teradata query failed: {exc}") from exc
    finally:
        if connection is not None:
            connection.close()
