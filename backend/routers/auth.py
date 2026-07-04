"""
Auth Router — Real Supabase Email OTP & Magic Link Authentication with local demo fallback.
Endpoints:
    POST /api/auth/send-otp   — Generate/send OTP
    POST /api/auth/verify-otp — Verify OTP and return session token
"""

import os
import time
import random
import hashlib
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix='/api/auth', tags=['auth'])

# ── Supabase Client Initialization ───────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

_supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[Auth Router] Supabase client initialized successfully")
    except Exception as e:
        print(f"[Auth Router] Failed to initialize Supabase client: {e}")

# ── In-memory OTP store for Demo/Fallback mode ────────────────
# { email_or_phone_hash: (otp, created_at, attempts) }
_otp_store: dict[str, tuple[str, float, int]] = {}

OTP_EXPIRY = 300       # 5 minutes
MAX_ATTEMPTS = 3


def _hash_identifier(val: str) -> str:
    return hashlib.sha256(val.encode()).hexdigest()


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
    model_config = ConfigDict(extra='ignore')  # ignore unknown fields from mobile interceptors
    email: str | None = None
    phone: str | None = None

class SendOTPResponse(BaseModel):
    success: bool
    message: str
    dev_otp: str | None = None  # Only in dev/demo fallback mode

class VerifyOTPRequest(BaseModel):
    model_config = ConfigDict(extra='ignore')
    email: str | None = None
    phone: str | None = None
    otp: str = Field(..., description='6-digit OTP')

class VerifyOTPResponse(BaseModel):
    success: bool
    message: str
    token: str | None = None


# ── Endpoints ────────────────────────────────────────────────

@router.post('/send-otp', response_model=SendOTPResponse)
async def send_otp(request: SendOTPRequest):
    """Generate and send a 6-digit OTP for the given Email or Phone number."""
    email = request.email.strip() if request.email else None
    
    # 1. Email OTP Flow (Primary)
    if email:
        email_hash = _hash_identifier(email)
        try:
            if _supabase:
                # Trigger real Supabase Magic Link / OTP
                res = _supabase.auth.sign_in_with_otp({
                    "email": email,
                    "options": {"should_create_user": True}
                })
                print(f"[Auth] Real Supabase OTP triggered for: {email}")
                return SendOTPResponse(
                    success=True,
                    message="ಲಾಗಿನ್ ಕೋಡ್ ಅನ್ನು ನಿಮ್ಮ ಇಮೇಲ್‌ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ (Real login code sent to your email)."
                )
        except Exception as e:
            print(f"[Auth] Supabase OTP trigger error: {e}")
            # Check if this is a network/DNS error (e.g. offline local dev or sandbox)
            is_dns_error = "nodename nor servname" in str(e) or "dns" in str(e).lower() or "connection" in str(e).lower()
            if is_dns_error or not _supabase:
                # Fall back to in-memory demo mode
                otp = "123456"
                _otp_store[email_hash] = (otp, time.time(), 0)
                print(f"[Auth][DEMO FALLBACK] OTP for {email}: {otp}")
                return SendOTPResponse(
                    success=True,
                    message="ಡೆಮೊ ಮೋಡ್: ಕೋಡ್ '123456' ಬಳಸಿ (Demo Mode: Use code '123456')",
                    dev_otp=otp
                )
            return SendOTPResponse(
                success=False,
                message=f"Supabase Auth Error: {str(e)}"
            )

    # 2. Phone OTP Flow (Demo/Fallback)
    phone = request.phone.strip() if request.phone else None
    if not phone:
        raise HTTPException(status_code=400, detail="ಇಮೇಲ್ ಅಥವಾ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಅಗತ್ಯವಿದೆ (Email or Phone is required)")
    
    phone = _clean_phone(phone)
    phone_hash = _hash_identifier(phone)

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
    print(f"[Auth][DEMO] OTP for phone ***{phone[-4:]}: {otp}")
    return SendOTPResponse(
        success=True,
        message=f"[DEMO] OTP: {otp} — ಡೆಮೊ ಮೋಡ್‌ನಲ್ಲಿ SMS ಕಳುಹಿಸಲಾಗುವುದಿಲ್ಲ.",
        dev_otp=otp,
    )


@router.post('/verify-otp', response_model=VerifyOTPResponse)
async def verify_otp(request: VerifyOTPRequest):
    """Verify the 6-digit OTP and return a session token."""
    email = request.email.strip() if request.email else None
    otp = request.otp.strip()

    # 1. Email OTP Verification Flow
    if email:
        email_hash = _hash_identifier(email)
        
        # Check in-memory demo fallback first
        if email_hash in _otp_store:
            stored_otp, created_at, attempts = _otp_store[email_hash]
            if time.time() - created_at < OTP_EXPIRY:
                if otp == stored_otp:
                    del _otp_store[email_hash]
                    token = hashlib.sha256(f"{email}{time.time()}{stored_otp}".encode()).hexdigest()
                    print(f"[Auth] Demo OTP verified for email: {email}")
                    return VerifyOTPResponse(
                        success=True,
                        message="ಡೆಮೊ ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ (Demo login success)",
                        token=token
                    )
                else:
                    _otp_store[email_hash] = (stored_otp, created_at, attempts + 1)
                    if attempts + 1 >= MAX_ATTEMPTS:
                        del _otp_store[email_hash]
                        return VerifyOTPResponse(success=False, message="ಅತಿ ಹೆಚ್ಚು ಪ್ರಯತ್ನಗಳು. ಮತ್ತೆ OTP ಕಳುಹಿಸಿ.")
                    remaining = MAX_ATTEMPTS - attempts - 1
                    return VerifyOTPResponse(success=False, message=f"ತಪ್ಪಾದ OTP. {remaining} ಪ್ರಯತ್ನಗಳು ಉಳಿದಿವೆ.")

        # Real Supabase Verification
        try:
            if _supabase:
                res = None
                # Try type="email" first
                try:
                    res = _supabase.auth.verify_otp({
                        "email": email,
                        "token": otp,
                        "type": "email"
                    })
                except Exception:
                    # Fallback to type="magiclink"
                    try:
                        res = _supabase.auth.verify_otp({
                            "email": email,
                            "token": otp,
                            "type": "magiclink"
                        })
                    except Exception:
                        # Fallback to type="signup"
                        res = _supabase.auth.verify_otp({
                            "email": email,
                            "token": otp,
                            "type": "signup"
                        })

                if res and res.session:
                    token = res.session.access_token
                    user_id = res.user.id if res.user else ""
                    
                    # Auto-initialize profiles table for this new UUID if it doesn't exist
                    try:
                        profile_res = _supabase.table("profiles").select("id").eq("id", user_id).execute()
                        if not profile_res.data:
                            _supabase.table("profiles").insert({
                                "id": user_id,
                                "farmer_name": email.split("@")[0].capitalize(),
                                "phone_number": None,
                                "district": "Shimoga",
                                "state": "Karnataka"
                            }).execute()
                            print(f"[Auth] Auto-created database profile for user: {user_id}")
                    except Exception as db_err:
                        print(f"[Auth] DB profile auto-create error: {db_err}")

                    print(f"[Auth] Real Supabase OTP verified for: {email}")
                    return VerifyOTPResponse(
                        success=True,
                        message="ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ (Login successful)",
                        token=token
                    )
                else:
                    return VerifyOTPResponse(
                        success=False,
                        message="ಅಮಾನ್ಯವಾದ ಪರಿಶೀಲನೆ ಕೋಡ್ (Invalid verification token)"
                    )
        except Exception as e:
            print(f"[Auth] Supabase verify error: {e}")
            return VerifyOTPResponse(
                success=False,
                message=f"ಲಾಗಿನ್ ಕೋಡ್ ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ: {str(e)}"
            )

    # 2. Phone OTP Verification Flow
    phone = request.phone.strip() if request.phone else None
    if not phone:
        raise HTTPException(status_code=400, detail="ಇಮೇಲ್ ಅಥವಾ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಅಗತ್ಯವಿದೆ (Email or Phone is required)")
    
    phone = _clean_phone(phone)
    phone_hash = _hash_identifier(phone)

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
    if otp != stored_otp:
        _otp_store[phone_hash] = (stored_otp, created_at, attempts + 1)
        remaining = MAX_ATTEMPTS - attempts - 1
        return VerifyOTPResponse(
            success=False,
            message=f'ತಪ್ಪಾದ OTP. {remaining} ಪ್ರಯತ್ನಗಳು ಉಳಿದಿವೆ.',
        )

    # Success
    del _otp_store[phone_hash]
    token = hashlib.sha256(f'{phone}{time.time()}{stored_otp}'.encode()).hexdigest()
    print(f'[Auth] Demo phone OTP verified for ***{phone[-4:]}')

    return VerifyOTPResponse(
        success=True,
        message='OTP ಪರಿಶೀಲನೆ ಯಶಸ್ವಿ! ✅',
        token=token,
    )
