"""
Auth Router — OTP-based phone authentication (Demo OTP only).
Endpoints:
    POST /api/auth/send-otp   — Generate OTP (demo)
    POST /api/auth/verify-otp — Verify OTP and return session token

OTPs expire after 5 minutes.
"""

import time
import random
import hashlib
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix='/api/auth', tags=['auth'])

# ── In-memory OTP store (use Redis/DB in production) ─────────
# { phone_hash: (otp, created_at, attempts) }
_otp_store: dict[str, tuple[str, float, int]] = {}

OTP_EXPIRY = 300       # 5 minutes
MAX_ATTEMPTS = 3


def _hash_phone(phone: str) -> str:
    return hashlib.sha256(phone.encode()).hexdigest()


def _generate_otp() -> str:
    return str(random.randint(100000, 999999))


def _clean_phone(phone: str) -> str:
    """Normalize Indian phone number to 10 digits."""
    phone = phone.strip().replace(' ', '').replace('-', '')
    if phone.startswith('+91'):
        phone = phone[3:]
    elif phone.startswith('91') and len(phone) == 12:
        phone = phone[2:]
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(status_code=400, detail='ದಯವಿಟ್ಟು 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ (Invalid phone number)')
    return phone


# ── Request/Response Models ──────────────────────────────────

class SendOTPRequest(BaseModel):
    phone: str = Field(..., description='10-digit Indian mobile number')

class SendOTPResponse(BaseModel):
    success: bool
    message: str
    dev_otp: str | None = None  # Only in dev mode

class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., description='10-digit Indian mobile number')
    otp: str = Field(..., description='6-digit OTP')

class VerifyOTPResponse(BaseModel):
    success: bool
    message: str
    token: str | None = None


# ── Endpoints ────────────────────────────────────────────────

@router.post('/send-otp', response_model=SendOTPResponse)
async def send_otp(request: SendOTPRequest):
    """Generate a 6-digit OTP for the given Indian mobile number (demo only)."""
    phone = _clean_phone(request.phone)
    phone_hash = _hash_phone(phone)

    # Rate limit: don't resend if OTP was sent < 30 seconds ago
    if phone_hash in _otp_store:
        _, created_at, _ = _otp_store[phone_hash]
        if time.time() - created_at < 30:
            return SendOTPResponse(
                success=False,
                message='OTP ಈಗಾಗಲೇ ಕಳುಹಿಸಲಾಗಿದೆ. 30 ಸೆಕೆಂಡ್ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
            )

    otp = _generate_otp()
    _otp_store[phone_hash] = (otp, time.time(), 0)
    print(f'[Auth][DEMO] OTP for ***{phone[-4:]}: {otp}')
    return SendOTPResponse(
        success=True,
        message=f'[DEMO] OTP: {otp} — ಡೆಮೊ ಮೋಡ್‌ನಲ್ಲಿ SMS ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ.',
        dev_otp=otp,
    )


@router.post('/verify-otp', response_model=VerifyOTPResponse)
async def verify_otp(request: VerifyOTPRequest):
    """Verify the 6-digit OTP and return a session token."""
    phone = _clean_phone(request.phone)
    phone_hash = _hash_phone(phone)

    if phone_hash not in _otp_store:
        return VerifyOTPResponse(
            success=False,
            message='OTP ಅವಧಿ ಮುಗಿದಿದೆ ಅಥವಾ ಕಳುಹಿಸಿಲ್ಲ. ಮತ್ತೆ ಕಳುಹಿಸಿ.',
        )

    stored_otp, created_at, attempts = _otp_store[phone_hash]

    # Check expiry
    if time.time() - created_at > OTP_EXPIRY:
        del _otp_store[phone_hash]
        return VerifyOTPResponse(
            success=False,
            message='OTP ಅವಧಿ ಮುಗಿದಿದೆ (5 ನಿಮಿಷ). ಮತ್ತೆ ಕಳುಹಿಸಿ.',
        )

    # Check attempts
    if attempts >= MAX_ATTEMPTS:
        del _otp_store[phone_hash]
        return VerifyOTPResponse(
            success=False,
            message='ಅತಿ ಹೆಚ್ಚು ಪ್ರಯತ್ನಗಳು. ಮತ್ತೆ OTP ಕಳುಹಿಸಿ.',
        )

    # Verify
    if request.otp.strip() != stored_otp:
        _otp_store[phone_hash] = (stored_otp, created_at, attempts + 1)
        remaining = MAX_ATTEMPTS - attempts - 1
        return VerifyOTPResponse(
            success=False,
            message=f'ತಪ್ಪಾದ OTP. {remaining} ಪ್ರಯತ್ನಗಳು ಉಳಿದಿವೆ.',
        )

    # Success — generate a simple session token
    del _otp_store[phone_hash]
    token = hashlib.sha256(f'{phone}{time.time()}{stored_otp}'.encode()).hexdigest()
    print(f'[Auth] OTP verified for ***{phone[-4:]}')

    return VerifyOTPResponse(
        success=True,
        message='OTP ಪರಿಶೀಲನೆ ಯಶಸ್ವಿ! ✅',
        token=token,
    )
