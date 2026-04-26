"""
Test script for crop diagnosis.

Usage:
    python3 test_diagnose.py /path/to/crop_image.jpg

This sends the image to the local backend and prints the full response.
"""

import sys
import os
import base64
import json
import httpx
import asyncio

API_URL = "http://127.0.0.1:8000/api/diagnose"


async def test_diagnosis(image_path: str):
    # Read and encode image
    if not os.path.exists(image_path):
        print(f"ERROR: File not found: {image_path}")
        sys.exit(1)

    ext = image_path.lower().split('.')[-1]
    mime_map = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'heic': 'image/heic'}
    mime = mime_map.get(ext, 'image/jpeg')

    with open(image_path, 'rb') as f:
        image_bytes = f.read()

    image_b64 = base64.b64encode(image_bytes).decode('utf-8')

    print(f"Image: {image_path}")
    print(f"Size: {len(image_bytes)} bytes ({len(image_b64)} base64 chars)")
    print(f"MIME: {mime}")
    print(f"Sending to {API_URL}...")
    print("-" * 60)

    payload = {
        'image_base64': image_b64,
        'image_mime': mime,
        'optional_text': 'This crop leaf has disease symptoms',
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(API_URL, json=payload)
        except httpx.ConnectError:
            print("ERROR: Cannot connect to backend. Is it running?")
            print("Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000")
            sys.exit(1)
        except httpx.ReadTimeout:
            print("ERROR: Request timed out (120s). Gemini may be slow.")
            sys.exit(1)

    print(f"Status: {response.status_code}")
    data = response.json()

    # Pretty print
    print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])

    # Summary
    print("\n" + "=" * 60)
    finding = data.get('finding')
    if finding:
        print(f"Disease:     {finding['disease_name']}")
        print(f"Disease KN:  {finding['disease_name_kn']}")
        print(f"Confidence:  {finding['confidence_pct']}%")
        print(f"Cause:       {finding['probable_cause']}")
        print(f"Retake:      {finding['needs_retake']}")
        print(f"Reliable:    {finding['is_reliable']}")
        print(f"Treatments:  {len(finding['organic_treatments'])}")
        for i, t in enumerate(finding['organic_treatments']):
            print(f"  {i+1}. {t[:100]}")
    else:
        print("No finding returned!")

    print(f"\nAudio:   {'YES' if data.get('audio_base64') else 'NO'}")
    print(f"Answer:  {data.get('answer_text_kn', 'N/A')[:200]}")
    if data.get('error'):
        print(f"\nERROR:   {data['error']}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 test_diagnose.py <image_path>")
        print("Example: python3 test_diagnose.py ../images/leaf.jpg")
        sys.exit(1)

    asyncio.run(test_diagnosis(sys.argv[1]))
