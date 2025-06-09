# Engage AI Agent Conversation Validator

## Overview

This system validates the Engage AI agent's conversation quality against lawyer-approved templates using automated browser testing and semantic analysis. It combines Puppeteer automation with natural language processing to ensure the AI agent maintains professional legal standards.

## How It Works

1. **Template Creation**: Lexara's lawyers create conversation templates in YAML format defining expected conversation flows
2. **Automated Execution**: Python script uses Puppeteer to execute conversations against the live AI agent  
3. **Response Capture**: All AI responses are captured and stored for analysis
4. **Semantic Analysis**: AI responses are compared to expected themes using sentence transformers and cosine similarity
5. **Quality Metrics**: System generates comprehensive reports on conversation quality, compliance, and alignment

## Architecture

```
Lawyer Templates → Python Controller → Puppeteer Automation → Live AI Agent → NLP Analysis → Quality Reports
```

## Installation

### Prerequisites
- Node.js (for Puppeteer)
- Python 3.8+
- The existing Engage system running

### Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install spacy language model
python -m spacy download en_core_web_sm

# Ensure Node.js dependencies are available
npm install puppeteer
```

## Usage

### 1. Create Conversation Templates

Create YAML files in the `conversation_templates/` directory. Each template should follow this structure:

```yaml
case_type: "personal_injury_auto"
practice_area: "personal_injury"
description: "Template description"

conversation_flow:
  - turn: 1
    user_input: "User message text"
    expected_ai_themes: 
      - "theme 1"
      - "theme 2"
    required_elements:
      - "element 1"
      - "element 2"

validation_criteria:
  information_capture:
    - client_name
    - location
  tone_requirements:
    - professional
    - empathetic
  prohibited_content:
    - "attorney-client privilege"
```

### 2. Run Validation

```bash
python conversation_validator.py
```

The script will:
- Find all YAML templates in `conversation_templates/`
- Execute each conversation against the live AI agent
- Analyze responses using NLP
- Generate comprehensive reports

### 3. Review Results

Results are saved to `validation_results/`:
- `validation_report.json` - Complete detailed results
- `validation_summary.md` - Human-readable summary
- `conversation_validation.log` - Execution logs

## Template Structure

### Required Fields

- **case_type**: Unique identifier for the conversation type
- **practice_area**: Legal practice area (personal_injury, employment_law, etc.)
- **conversation_flow**: Array of conversation turns with expected AI behavior
- **validation_criteria**: Quality and compliance requirements

### Conversation Flow

Each turn defines:
- **user_input**: What the user will say (supports variables like {name}, {city})
- **expected_ai_themes**: High-level themes the AI should address
- **required_elements**: Specific elements that must be present

### Validation Criteria

- **information_capture**: List of information types the AI should extract
- **tone_requirements**: Required tone characteristics (professional, empathetic, etc.)
- **prohibited_content**: Content that should never appear in responses
- **required_disclaimers**: Legal disclaimers that must be included
- **response_quality**: Length and style requirements

## Analysis Metrics

### 1. Semantic Similarity
- Compares AI responses to expected themes using sentence transformers
- Generates cosine similarity scores (0-1, higher is better)
- Identifies misaligned responses

### 2. Information Extraction
- Uses NLP to detect if required information was captured
- Tracks entities (names, locations) and keywords
- Measures extraction completeness

### 3. Tone Analysis
- Analyzes professional tone indicators
- Checks for empathy and appropriate language
- Validates legal compliance language

### 4. Compliance Checking
- Scans for prohibited content
- Ensures required disclaimers are present
- Flags potential legal/ethical issues

### 5. Performance Metrics
- Response times per conversation turn
- Successful completion rates
- Overall conversation quality scores

## Example Output

```json
{
  "summary": {
    "total_templates_tested": 5,
    "successful_conversations": 5,
    "avg_execution_time": 45.2
  },
  "detailed_results": [
    {
      "template": "personal_injury_auto",
      "analysis": {
        "semantic_similarity": {
          "turn_1": {
            "avg_similarity": 0.84,
            "expected_themes": ["empathy", "information_gathering"]
          }
        },
        "compliance_check": {
          "is_compliant": true,
          "violations": []
        }
      }
    }
  ]
}
```

## Customization

### Adding New Analysis Types

Extend the `_analyze_conversation` method to add new validation types:

```python
def _analyze_new_metric(self, text: str) -> Dict[str, Any]:
    # Custom analysis logic
    return analysis_results
```

### Custom Semantic Models

Replace the sentence transformer model for domain-specific analysis:

```python
self.sentence_model = SentenceTransformer('legal-bert-model')
```

### Template Variables

Support dynamic template variables in conversation flows:

```yaml
user_input: "My name is {name} and I live in {city}, {state}"
```

Variables are automatically replaced with sample data during execution.

## Best Practices

### For Lawyers Creating Templates

1. **Be Specific**: Define clear expected themes and required elements
2. **Cover Edge Cases**: Include templates for unusual scenarios
3. **Set Realistic Expectations**: AI responses won't be identical to human lawyers
4. **Update Regularly**: Review and update templates as AI improves

### For System Integration

1. **Run Regularly**: Execute validation after any AI model updates
2. **Monitor Trends**: Track quality metrics over time
3. **Set Thresholds**: Define minimum acceptable similarity scores
4. **Alert on Regressions**: Automated alerts if quality drops

### For Quality Assurance

1. **Baseline Establishment**: Run initial validation to establish quality baselines
2. **Regression Testing**: Validate that updates don't reduce quality
3. **A/B Testing**: Compare different AI configurations
4. **Continuous Monitoring**: Regular quality checks in production

## Integration with CI/CD

Add to your deployment pipeline:

```bash
# In your CI/CD script
python conversation_validator.py
if [ $? -ne 0 ]; then
  echo "Conversation validation failed"
  exit 1
fi
```

## Troubleshooting

### Common Issues

1. **Puppeteer Timeouts**: Increase timeout values for slow AI responses
2. **Template Parsing Errors**: Validate YAML syntax
3. **Missing Dependencies**: Ensure all Python packages are installed
4. **Browser Issues**: Run with headless=false for debugging

### Debug Mode

Enable verbose logging:

```python
logging.basicConfig(level=logging.DEBUG)
```

Run with visible browser:

```python
browser = await puppeteer.launch({'headless': False})
```

## Future Enhancements

- **Multi-language Support**: Templates and analysis for multiple languages
- **Advanced NLP Models**: Integration with legal-specific language models
- **Real-time Monitoring**: Live conversation quality monitoring
- **Machine Learning**: Automated template generation from successful conversations
- **Integration APIs**: REST API for external quality monitoring systems

## Contributing

When adding new features:

1. Add appropriate tests
2. Update documentation
3. Maintain backward compatibility with existing templates
4. Follow semantic versioning for API changes

This system provides comprehensive validation of AI agent quality against professional legal standards, ensuring consistent, compliant, and high-quality client interactions.