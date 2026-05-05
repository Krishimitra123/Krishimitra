"""
Auth Router — OTP-based phone authentication using Fast2SMS.
Endpoints:
  POST /api/auth/send-otp   — Send OTP to Indian mobile number
  POST /api/auth/verify-otp — Verify OTP and return session token

Uses Fast2SMS Quick Transactional SMS route (no website verification needed).
OTPs expire after 5 minutes. Dev mode available when ENVIRONMENT=development.
"""

import os
import time
import random
import hashlib
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix='/api/auth', tags=['auth'])

# ── In-memory OTP store (use Redis/DB in production) ─────────
# { phone_hash: (otp, created_at, attempts) }
_otp_store: dict[str, tuple[str, float, int]] = {}

OTP_EXPIRY = 300       # 5 minutes
MAX_ATTEMPTS = 3
FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2'


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


def _is_dev_mode() -> bool:
    return os.environ.get('ENVIRONMENT', 'development').lower() in ('development', 'dev')


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
    """Send a 6-digit OTP to the given Indian mobile number via Fast2SMS."""
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

    api_key = os.environ.get('FAST2SMS_API_KEY', '').strip()

    # ── DEV MODE: Skip actual SMS, return OTP directly ───────
    if _is_dev_mode() and not api_key:
        print(f'[Auth][DEV] OTP for ***{phone[-4:]}: {otp}')
        return SendOTPResponse(
            success=True,
            message=f'[DEV] OTP: {otp} — ಡೆವ್ ಮೋಡ್‌ನಲ್ಲಿ SMS ಕಳುಹಿಸಲಾಗಿಲ್ಲ.',
            dev_otp=otp,
        )

    if not api_key:
        raise HTTPException(status_code=500, detail='Fast2SMS API key not configured')

    # ── Try Quick Transactional SMS route ─────────────────────
    sms_sent = False
    message_text = f'Your KrishiMitra OTP is {otp}. Valid for 5 minutes. Do not share.'

    # Method 1: Quick Transactional route (route=q)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                FAST2SMS_URL,
                headers={
                    'authorization': api_key,
                    'Content-Type': 'application/json',
                },
                json={
                    'route': 'q',
                    'message': message_text,
                    'flash': '0',
                    'numbers': phone,
                },
            )

        resp_data = resp.json()
        print(f'[Auth] Fast2SMS (route=q) response: {resp.status_code} — {resp_data}')

        if resp.status_code == 200 and resp_data.get('return'):
            sms_sent = True

    except Exception as e:
        print(f'[Auth] Fast2SMS route=q failed: {e}')

    # Method 2: If route=q fails, try the variables route (route=v3)
    if not sms_sent:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    'https://www.fast2sms.com/dev/bulkV2',
                    params={
                        'authorization': api_key,
                        'route': 'v3',
                        'sender_id': 'KMITRA',
                        'message': message_text,
                        'flash': '0',
                        'numbers': phone,
                    },
                    headers={'authorization': api_key},
                )

            resp_data = resp.json()
            print(f'[Auth] Fast2SMS (route=v3) response: {resp.status_code} — {resp_data}')

            if resp.status_code == 200 and resp_data.get('return'):
                sms_sent = True

        except Exception as e:
            print(f'[Auth] Fast2SMS route=v3 also failed: {e}')

    # ── If all SMS routes fail, use DEV fallback ─────────────
    if not sms_sent:
        print(f'[Auth][DEV FALLBACK] OTP for ***{phone[-4:]}: {otp}')
        return SendOTPResponse(
            success=True,
            message=f'SMS ವಿಫಲ — DEV ಮೋಡ್ OTP: {otp}',
            dev_otp=otp,
        )

    print(f'[Auth] OTP sent to ***{phone[-4:]}')
    return SendOTPResponse(
        success=True,
        message=f'OTP ಅನ್ನು ***{phone[-4:]} ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.',
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
