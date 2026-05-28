from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from typing import Any, Dict, Optional
import os

from koudai import load_config, configure_logging, get_logger
from koudai.parser import IntentParser, TradingIntent
from koudai.execution import TradingOrchestrator
from koudai.execution.models import OrderRequest

app = FastAPI(title="Koudai Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

cfg = load_config()
configure_logging(level=cfg.log_level, fmt=cfg.log_format, log_dir=cfg.log_dir)
log = get_logger(__name__)

parser = IntentParser()
orchestrator = TradingOrchestrator(dry_run=cfg.agent_dry_run)

@app.on_event("startup")
async def startup_event():
    await orchestrator.start()
    log.info("fastapi_started", agent_dry_run=cfg.agent_dry_run)

@app.on_event("shutdown")
async def shutdown_event():
    await orchestrator.stop()
    log.info("fastapi_stopped")

class ParseRequest(BaseModel):
    message: str

class ParseResponse(BaseModel):
    intent: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ExecuteRequest(BaseModel):
    intent: Dict[str, Any]

class ExecuteResponse(BaseModel):
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

@app.post("/api/parse", response_model=ParseResponse)
async def parse_endpoint(request: ParseRequest):
    try:
        intent = await parser.parse(request.message)
        return ParseResponse(intent=intent.model_dump())
    except Exception as e:
        log.error("parse_error", error=str(e))
        return ParseResponse(error=str(e))

@app.post("/api/execute", response_model=ExecuteResponse)
async def execute_endpoint(request: ExecuteRequest):
    try:
        intent_model = TradingIntent(**request.intent)
        order_req = OrderRequest(
            order_side=intent_model.action,
            token_symbol=intent_model.token,
            amount=intent_model.amount,
            amount_denom=intent_model.amount_denom,
            order_type=intent_model.order_type,
            limit_price=intent_model.price
        )
        result = await orchestrator.execute_order(order_req)
        return ExecuteResponse(result=result.model_dump())
    except Exception as e:
        log.error("execute_error", error=str(e))
        return ExecuteResponse(error=str(e))

@app.get("/api/wallet")
async def wallet_endpoint():
    wallet_info = await orchestrator.get_wallet_status()
    
    return {
        "address": wallet_info.get("wallet_address", "inj1..."),
        "inj_balance": wallet_info.get("inj_balance", {}).get("available", 1000.0),
        "network": cfg.injective_network,
        "is_connected": True,
        "dry_run": cfg.agent_dry_run
    }
