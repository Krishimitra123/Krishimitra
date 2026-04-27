with open('modules/m3_structured_kb.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = """        for ing in ingredients:
            item = ing.get("item", "")
            qty = ing.get("quantity", "")
            unit = ing.get("unit", "")
            qty_str = f"{qty} {unit}".strip() if qty else ""
            if qty_str:
                lines.append(f"  \u2022 {item}: {qty_str}")
            else:
                lines.append(f"  \u2022 {item}")"""

new = """        for ing in ingredients:
            if isinstance(ing, dict):
                item = ing.get("item", "")
                qty = ing.get("quantity", "")
                unit = ing.get("unit", "")
                qty_str = f"{qty} {unit}".strip() if qty else ""
                if qty_str:
                    lines.append(f"  \u2022 {item}: {qty_str}")
                else:
                    lines.append(f"  \u2022 {item}")
            else:
                lines.append(f"  \u2022 {ing}")"""

if old in content:
    content = content.replace(old, new)
    with open('modules/m3_structured_kb.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed ingredients loop successfully!")
else:
    print("Pattern not found - checking steps loop too...")

# Also fix preparation_steps if same issue exists
old2 = """        for i, step in enumerate(steps, 1):
            if isinstance(step, dict):"""

if old2 not in content:
    old3 = "        for i, step in enumerate(steps, 1):"
    new3 = """        for i, step in enumerate(steps, 1):
            if isinstance(step, str):
                lines.append(f"  {i}. {step}")
                continue"""
    if old3 in content:
        content = content.replace(old3, new3)
        with open('modules/m3_structured_kb.py', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed steps loop too!")
