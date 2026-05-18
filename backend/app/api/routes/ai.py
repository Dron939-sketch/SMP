from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.ai import AIAnalysisResult, AIAnalyzeRequest
from app.services.ai_service import AIService

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/analyze", response_model=AIAnalysisResult)
async def analyze(
    payload: AIAnalyzeRequest,
    user: Annotated[User, Depends(get_current_user)],
):
    return await AIService().analyze(payload)
