# 🚀 Testing Guide for Your Friend

## Setup (First Time Only)

### Step 1: Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Step 2: Configure Supabase Credentials
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in YOUR Supabase credentials:
   ```
   SUPABASE_URL=https://vpzcbkrbglutgtwhvjby.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## Testing the RAG System

### Option 1: Quick Test (Automated)
Run the pre-configured test script with 5 sample queries:

```bash
python scripts/test_rag_retrieval.py
```

This will:
- ✅ Test Supabase connection
- ✅ Run 5 pre-built queries
- ✅ Show results with sources
- ✅ Verify data is loaded

---

### Option 2: Interactive Testing (Manual Queries)

Create a file `test_interactive.py` in the `backend` folder:

```python
#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from supabase import create_client

load_dotenv()

# Initialize
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_KEY')
supabase = create_client(url, key)
model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-mpnet-base-v2')

print("="*70)
print("FARMING AI - INTERACTIVE TESTING")
print("="*70)
print("\nEnter your farming questions. Type 'quit' to exit.\n")

while True:
    query = input("🌾 Your question: ").strip()
    
    if query.lower() == 'quit':
        print("Goodbye!")
        break
    
    if not query:
        continue
    
    try:
        # Embed and search
        embedding = model.encode(query).tolist()
        response = supabase.rpc(
            'match_chunks',
            {'query_embedding': embedding, 'match_count': 5}
        ).execute()
        
        if response.data:
            print(f"\n✅ Found {len(response.data)} relevant results:\n")
            
            for i, result in enumerate(response.data, 1):
                print(f"[{i}] {result.get('source_doc', 'Unknown')}")
                print(f"    Relevance: {result.get('similarity', 0):.1%}")
                print(f"    {result.get('content', '')[:150]}...")
                print()
        else:
            print("❌ No matching results found. Try a different question.\n")
            
    except Exception as e:
        print(f"❌ Error: {e}\n")
```

Then run it:
```bash
python test_interactive.py
```

---

## 📝 Sample Queries to Try

### Biofertiliser & Organic Inputs
- "How to prepare jeevamrutha?"
- "What are the ingredients for kunapa jala?"
- "Vermicompost preparation steps"
- "Gau krupa amrutha for organic farming"

### Disease Management
- "How to treat ragi blast disease organically?"
- "Organic treatment for tomato early blight"
- "Chilli anthracnose management"
- "Organic cotton pest control"

### Soil & Nutrients
- "How to correct zinc deficiency in soil?"
- "Soil fertility improvement methods"
- "Micronutrient deficiency symptoms"
- "pH correction in acidic soil"

### Mulching
- "What is gliricidia mulching?"
- "Mulching plants for organic farming"
- "Mulch application schedule"

### Government Schemes
- "What organic farming schemes available in Karnataka?"
- "Subsidy for organic certification"
- "Government support for farmers"

---

## 🔍 Verification Checklist

Before confirming setup is working:

- [ ] `pip install -r requirements.txt` completed without errors
- [ ] `.env` file created with your Supabase credentials
- [ ] `python scripts/test_rag_retrieval.py` runs successfully
- [ ] All 5 sample queries return results
- [ ] Interactive test script works with custom questions

---

## ⚠️ Troubleshooting

### "ERROR: Supabase credentials not found"
→ Make sure `.env` file exists and has `SUPABASE_URL` and `SUPABASE_ANON_KEY` set

### "No results found for any query"
→ Data might not be ingested yet. Ask your development team.

### "ModuleNotFoundError"
→ Run `pip install -r requirements.txt` from the `backend/` folder

### "Connection refused"
→ Check your internet connection and Supabase credentials are correct

---

## 📞 Questions?
Contact your development team with error messages and the query that failed.
