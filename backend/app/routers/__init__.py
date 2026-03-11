from app.routers.auth import router as auth_router
from app.routers.analysis import router as analysis_router
from app.routers.history import router as history_router

__all__ = ["auth_router", "analysis_router", "history_router"]
