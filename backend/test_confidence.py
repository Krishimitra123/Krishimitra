from modules.m4_confidence_guard import compute_confidence

def test_high_confidence():
    skb = {'confidence_level': 'cross_validated', 'primary_source': 'Palekar Vol 1'}
    rag = [{'similarity': 0.82, 'source_doc': 'Palekar Vol 1'}] # +10 bonus for matching source
    report = compute_confidence(skb, rag, None, "This is organic.")
    # 50 (skb) + 30 (rag) + 10 (bonus) = 90
    assert report.score >= 80
    assert report.can_deliver == True
    assert report.chemical_detected == False
    print("Test 1 Passed: High Confidence")

def test_low_confidence_no_skb():
    rag = [{'similarity': 0.55, 'source_doc': 'YouTube'}]
    report = compute_confidence(None, rag, None, "Try this out.")
    assert report.score < 70
    assert report.can_deliver == False
    assert report.chemical_detected == False
    print("Test 2 Passed: Low Confidence")

def test_chemical_block():
    report = compute_confidence(None, [], None, "You should apply urea for better growth.")
    assert report.chemical_detected == True
    assert report.can_deliver == False
    assert report.score == 0
    print("Test 3 Passed: Chemical Block")

if __name__ == "__main__":
    test_high_confidence()
    test_low_confidence_no_skb()
    test_chemical_block()
