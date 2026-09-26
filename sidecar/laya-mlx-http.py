import hmac
import os
import threading

import laya_mlx as laya
from fastapi import FastAPI, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Any

MODEL   = os.environ.get("LAYA_MODEL", "aac6fef/laya-mlx")
DEVICE  = os.environ.get("LAYA_DEVICE", "gpu")
DTYPE   = os.environ.get("LAYA_DTYPE", "float16")
API_KEY = os.environ.get("LAYA_API_KEY", "")

app = FastAPI()
agent = laya.load(MODEL, device=DEVICE, dtype=DTYPE)   # loads once at startup

# Sync handlers run in uvicorn's threadpool; MLX gives no thread-safety
# guarantee, so serialize predict calls over the shared agent.
_predict_lock = threading.Lock()

class PredictReq(BaseModel):
    state: Any
    questions: dict

def require_auth(request: Request):
    if not API_KEY:
        return
    if not hmac.compare_digest(request.headers.get("authorization", ""), f"Bearer {API_KEY}"):
        raise HTTPException(status_code=401, detail="invalid api key")

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL, "device": DEVICE, "dtype": DTYPE}

@app.post("/v1/systemone", dependencies=[Depends(require_auth)])
def systemone(req: PredictReq):
    # laya-serve answers client input errors (bad criteria, option-budget
    # overflow) with 422; agent.predict surfaces them as ValueError.
    try:
        with _predict_lock:
            return agent.predict(req.state, req.questions)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("LAYA_HOST", "127.0.0.1"),
                port=int(os.environ.get("LAYA_PORT", "8000")))