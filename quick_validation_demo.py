#!/usr/bin/env python3
"""
Quick demo of the conversation validation system
Shows how semantic similarity analysis would work
"""

import yaml
from pathlib import Path

# Mock the sentence transformer for demo (replace with real implementation)
class MockSentenceTransformer:
    def encode(self, texts):
        # In real implementation, this would return actual embeddings
        import random
        return [[random.random() for _ in range(384)] for _ in texts]

def calculate_cosine_similarity(vec1, vec2):
    # Simplified similarity calculation for demo
    import random
    return random.uniform(0.6, 0.95)  # Mock similarity scores

def demo_semantic_analysis():
    """Demonstrate how semantic analysis would work"""
    
    print("🔬 CONVERSATION VALIDATION DEMO")
    print("=" * 60)
    
    # Load a template
    template_path = Path('conversation_templates/car_accident.yaml')
    if not template_path.exists():
        print(f"Template not found: {template_path}")
        return
    
    with open(template_path, 'r') as f:
        template = yaml.safe_load(f)
    
    print(f"\n📋 Analyzing Template: {template['case_type']}")
    print(f"Practice Area: {template['practice_area']}")
    
    # Mock AI responses (in real implementation, these come from Puppeteer)
    mock_ai_responses = [
        "I'm sorry to hear you were in a car accident. I'm here to help gather information about your situation so our legal team can assist you. Could you please tell me your name and contact information?",
        
        "Thank you for providing that information, John. I've noted your contact details. Can you tell me more about when and where the accident occurred?",
        
        "I understand the other driver ran a red light and hit your vehicle. That must have been very frightening. Were you injured in the accident? Did you receive any medical treatment?",
        
        "I'm glad you sought medical attention for your neck pain. It's important to document injuries from the accident. Can you tell me about your insurance and any damage to your vehicle?",
        
        "Thank you for providing all this information, John. I've gathered the key details about your accident, injuries, and insurance information. An attorney from our team will review your case and contact you within 24 hours to discuss your legal options."
    ]
    
    print(f"\n🤖 Analyzing {len(mock_ai_responses)} AI Responses...")
    
    # Analyze each conversation turn
    model = MockSentenceTransformer()
    
    for i, (turn, ai_response) in enumerate(zip(template['conversation_flow'], mock_ai_responses), 1):
        print(f"\n--- Turn {i} ---")
        print(f"Expected Themes: {turn['expected_ai_themes']}")
        print(f"AI Response: {ai_response[:100]}...")
        
        # Calculate semantic similarity (mock)
        expected_themes = turn['expected_ai_themes']
        similarities = {}
        
        for theme in expected_themes:
            similarity = calculate_cosine_similarity([0.1], [0.2])  # Mock calculation
            similarities[theme] = similarity
            
        avg_similarity = sum(similarities.values()) / len(similarities)
        
        print(f"Semantic Similarities:")
        for theme, score in similarities.items():
            print(f"  • {theme}: {score:.3f}")
        print(f"Average Similarity: {avg_similarity:.3f}")
        
        # Check required elements
        required_elements = turn['required_elements']
        ai_lower = ai_response.lower()
        
        print(f"Required Elements Check:")
        for element in required_elements:
            # Simple keyword-based check (real implementation would be more sophisticated)
            present = any(keyword in ai_lower for keyword in element.split()[:2])
            print(f"  • {element}: {'✅' if present else '❌'}")
    
    # Overall validation criteria analysis
    print(f"\n📊 OVERALL VALIDATION ANALYSIS")
    print("=" * 40)
    
    full_conversation = " ".join(mock_ai_responses).lower()
    
    # Information capture analysis
    print(f"\n📋 Information Capture:")
    info_criteria = template['validation_criteria']['information_capture']
    for info_type in info_criteria:
        # Mock analysis - real implementation would use NLP
        captured = info_type.replace('_', ' ') in full_conversation
        print(f"  • {info_type}: {'✅' if captured else '❌'}")
    
    # Tone requirements
    print(f"\n🎭 Tone Analysis:")
    tone_requirements = template['validation_criteria']['tone_requirements']
    tone_indicators = {
        'professional': ['attorney', 'legal', 'team', 'review'],
        'empathetic': ['sorry', 'understand', 'frightening'],
        'legally_compliant': ['not legal advice', 'attorney will', 'legal options']
    }
    
    for tone in tone_requirements:
        indicators = tone_indicators.get(tone, [])
        found = sum(1 for indicator in indicators if indicator in full_conversation)
        score = found / len(indicators) if indicators else 0
        print(f"  • {tone}: {score:.2f} ({found}/{len(indicators)} indicators)")
    
    # Compliance check
    print(f"\n⚖️ Compliance Check:")
    prohibited = template['validation_criteria']['prohibited_content']
    violations = [item for item in prohibited if item.lower() in full_conversation]
    
    print(f"  • Prohibited Content: {'✅ Clean' if not violations else f'❌ {len(violations)} violations'}")
    if violations:
        for violation in violations:
            print(f"    - Found: {violation}")
    
    # Performance metrics
    print(f"\n⚡ Performance Metrics:")
    print(f"  • Total Conversation Turns: {len(mock_ai_responses)}")
    print(f"  • Average Response Length: {sum(len(r) for r in mock_ai_responses) // len(mock_ai_responses)} chars")
    print(f"  • Information Capture Rate: {len([i for i in info_criteria if i.replace('_', ' ') in full_conversation]) / len(info_criteria):.1%}")
    
    print(f"\n🎉 Validation Complete!")
    print(f"This demonstrates how the system would analyze AI agent conversations")
    print(f"against lawyer-approved templates using semantic similarity and NLP.")

if __name__ == "__main__":
    demo_semantic_analysis()