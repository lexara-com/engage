#!/usr/bin/env python3
"""
Engage AI Agent Conversation Validator

This script executes lawyer-approved conversation templates against the live
Engage AI agent using Puppeteer automation, then analyzes the responses using
semantic similarity and NLU to validate agent alignment with legal standards.
"""

import asyncio
import json
import yaml
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import subprocess
import tempfile
import statistics

# NLP and analysis libraries
try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity
    import spacy
    import pandas as pd
except ImportError:
    print("Please install required packages:")
    print("pip install sentence-transformers scikit-learn spacy pandas")
    print("python -m spacy download en_core_web_sm")
    exit(1)

class ConversationTemplate:
    """Represents a lawyer-approved conversation template"""
    
    def __init__(self, template_path: Path):
        with open(template_path, 'r') as f:
            self.data = yaml.safe_load(f)
        
        self.case_type = self.data['case_type']
        self.practice_area = self.data['practice_area']
        self.conversation_flow = self.data['conversation_flow']
        self.validation_criteria = self.data.get('validation_criteria', {})
        self.template_path = template_path

class ConversationValidator:
    """Main validator that executes conversations and analyzes responses"""
    
    def __init__(self, engage_url: str = "https://d7fdb312.engage-ui.pages.dev"):
        self.engage_url = engage_url
        self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.nlp = spacy.load('en_core_web_sm')
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('conversation_validation.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
    async def execute_conversation_template(self, template: ConversationTemplate) -> Dict[str, Any]:
        """Execute a complete conversation template and capture responses"""
        
        self.logger.info(f"Executing conversation template: {template.case_type}")
        
        # Create a Node.js script that uses our existing Puppeteer infrastructure
        puppeteer_script = self._generate_puppeteer_script(template)
        
        # Execute the conversation
        start_time = time.time()
        conversation_result = await self._run_puppeteer_conversation(puppeteer_script)
        execution_time = time.time() - start_time
        
        # Analyze the results
        analysis = self._analyze_conversation(conversation_result, template)
        
        return {
            'template': template.case_type,
            'execution_time': execution_time,
            'conversation_data': conversation_result,
            'analysis': analysis,
            'timestamp': datetime.now().isoformat()
        }
    
    def _generate_puppeteer_script(self, template: ConversationTemplate) -> str:
        """Generate a Node.js script that executes the conversation"""
        
        conversation_turns = []
        for turn in template.conversation_flow:
            user_input = turn['user_input']
            # Replace variables with sample data
            user_input = user_input.replace('{name}', 'John Smith')
            user_input = user_input.replace('{city}', 'San Francisco')
            user_input = user_input.replace('{state}', 'California')
            conversation_turns.append(user_input)
        
        script = f"""
const puppeteer = require('puppeteer');

async function executeConversation() {{
    const browser = await puppeteer.launch({{
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    }});
    
    const page = await browser.newPage();
    await page.setViewport({{ width: 1200, height: 800 }});
    
    const conversation = [];
    
    try {{
        // Navigate to Engage
        await page.goto('{self.engage_url}', {{ waitUntil: 'networkidle0' }});
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Accept disclaimer
        await page.evaluate(() => {{
            const button = document.querySelector('#disclaimer-accept');
            if (button) button.click();
        }});
        
        await page.waitForFunction(
            () => document.querySelector('#disclaimer-modal')?.classList.contains('hidden'),
            {{ timeout: 5000 }}
        );
        
        // Execute conversation turns
        const messages = {json.dumps(conversation_turns)};
        
        for (let i = 0; i < messages.length; i++) {{
            const userMessage = messages[i];
            const turnStart = Date.now();
            
            // Clear input and type message
            await page.evaluate(() => {{
                const input = document.querySelector('#message-input');
                if (input) input.value = '';
            }});
            
            await page.focus('#message-input');
            await page.type('#message-input', userMessage);
            
            const initialCount = await page.$$eval('.message-bubble', msgs => msgs.length);
            
            // Send message
            await page.evaluate(() => {{
                const button = document.querySelector('#send-button');
                if (button) button.click();
            }});
            
            // Wait for user message to appear
            await page.waitForFunction(
                (expectedCount) => document.querySelectorAll('.message-bubble').length > expectedCount,
                {{}},
                initialCount,
                {{ timeout: 10000 }}
            );
            
            // Wait for AI response
            await page.waitForFunction(
                (expectedCount) => document.querySelectorAll('.message-bubble').length >= expectedCount + 2,
                {{}},
                initialCount,
                {{ timeout: 45000 }}
            );
            
            // Wait for typing to finish
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Get AI response
            const aiResponse = await page.evaluate(() => {{
                const messages = document.querySelectorAll('.message-bubble');
                if (messages.length === 0) return '';
                
                const lastMsg = messages[messages.length - 1];
                const text = lastMsg.textContent?.trim() || '';
                
                if (text.toLowerCase().includes('typing') || text.length < 10) {{
                    if (messages.length > 1) {{
                        const secondLastMsg = messages[messages.length - 2];
                        return secondLastMsg.textContent?.trim() || '';
                    }}
                }}
                
                return text;
            }});
            
            const turnTime = Date.now() - turnStart;
            
            conversation.push({{
                turn: i + 1,
                user_input: userMessage,
                ai_response: aiResponse,
                response_time_ms: turnTime,
                timestamp: new Date().toISOString()
            }});
        }}
        
        // Get final conversation state
        const finalState = await page.evaluate(() => {{
            const messages = document.querySelectorAll('.message-bubble');
            return Array.from(messages).map((msg, index) => ({{
                index: index + 1,
                content: msg.textContent?.trim() || '',
                isUser: msg.classList.contains('message-user') || msg.classList.contains('user'),
                isAI: msg.classList.contains('message-ai') || msg.classList.contains('assistant')
            }}));
        }});
        
        console.log(JSON.stringify({{
            success: true,
            conversation: conversation,
            final_state: finalState
        }}));
        
    }} catch (error) {{
        console.log(JSON.stringify({{
            success: false,
            error: error.message,
            conversation: conversation
        }}));
    }} finally {{
        await browser.close();
    }}
}}

executeConversation().catch(console.error);
"""
        return script
    
    async def _run_puppeteer_conversation(self, script: str) -> Dict[str, Any]:
        """Execute the Puppeteer script and return results"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(script)
            script_path = f.name
        
        try:
            # Run the Node.js script
            result = subprocess.run(
                ['node', script_path],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                self.logger.error(f"Puppeteer script failed: {result.stderr}")
                return {'success': False, 'error': result.stderr}
                
        finally:
            Path(script_path).unlink()  # Clean up temp file
    
    def _analyze_conversation(self, conversation_data: Dict[str, Any], template: ConversationTemplate) -> Dict[str, Any]:
        """Analyze AI responses against template expectations"""
        
        if not conversation_data.get('success', False):
            return {'error': 'Conversation execution failed'}
        
        conversation = conversation_data['conversation']
        analysis = {
            'semantic_similarity': {},
            'information_extraction': {},
            'tone_analysis': {},
            'compliance_check': {},
            'performance_metrics': {}
        }
        
        # 1. Semantic Similarity Analysis
        for turn_data in conversation:
            turn_num = turn_data['turn']
            ai_response = turn_data['ai_response']
            
            # Find corresponding template turn
            template_turn = next((t for t in template.conversation_flow if t['turn'] == turn_num), None)
            if not template_turn:
                continue
            
            # Check semantic alignment with expected themes
            expected_themes = template_turn.get('expected_ai_themes', [])
            similarity_scores = self._calculate_semantic_similarity(ai_response, expected_themes)
            
            analysis['semantic_similarity'][f'turn_{turn_num}'] = {
                'expected_themes': expected_themes,
                'similarity_scores': similarity_scores,
                'avg_similarity': statistics.mean(similarity_scores.values()) if similarity_scores else 0
            }
        
        # 2. Information Extraction Analysis
        full_conversation_text = ' '.join([turn['ai_response'] for turn in conversation])
        required_info = template.validation_criteria.get('information_capture', [])
        
        for info_type in required_info:
            extracted = self._extract_information_type(full_conversation_text, info_type)
            analysis['information_extraction'][info_type] = extracted
        
        # 3. Tone and Professionalism Analysis
        tone_requirements = template.validation_criteria.get('tone_requirements', [])
        tone_scores = self._analyze_tone(full_conversation_text, tone_requirements)
        analysis['tone_analysis'] = tone_scores
        
        # 4. Compliance Check
        prohibited_content = template.validation_criteria.get('prohibited_content', [])
        compliance_issues = self._check_compliance(full_conversation_text, prohibited_content)
        analysis['compliance_check'] = {
            'violations': compliance_issues,
            'is_compliant': len(compliance_issues) == 0
        }
        
        # 5. Performance Metrics
        response_times = [turn['response_time_ms'] for turn in conversation]
        analysis['performance_metrics'] = {
            'avg_response_time_ms': statistics.mean(response_times),
            'max_response_time_ms': max(response_times),
            'total_turns': len(conversation),
            'successful_turns': len([t for t in conversation if len(t['ai_response']) > 10])
        }
        
        return analysis
    
    def _calculate_semantic_similarity(self, ai_response: str, expected_themes: List[str]) -> Dict[str, float]:
        """Calculate semantic similarity between AI response and expected themes"""
        
        if not expected_themes:
            return {}
        
        # Get embeddings
        ai_embedding = self.sentence_model.encode([ai_response])
        theme_embeddings = self.sentence_model.encode(expected_themes)
        
        # Calculate similarities
        similarities = cosine_similarity(ai_embedding, theme_embeddings)[0]
        
        return {theme: float(sim) for theme, sim in zip(expected_themes, similarities)}
    
    def _extract_information_type(self, text: str, info_type: str) -> Dict[str, Any]:
        """Extract specific information types from conversation text"""
        
        doc = self.nlp(text)
        
        extraction_patterns = {
            'client_name': {
                'entities': ['PERSON'],
                'keywords': ['name is', 'called', 'my name']
            },
            'location': {
                'entities': ['GPE', 'LOC'],
                'keywords': ['live in', 'from', 'located']
            },
            'accident_details': {
                'keywords': ['accident', 'crash', 'collision', 'hit']
            },
            'fault_determination': {
                'keywords': ['red light', 'fault', 'responsible', 'caused']
            }
        }
        
        pattern = extraction_patterns.get(info_type, {})
        
        # Extract named entities
        entities = []
        if 'entities' in pattern:
            entities = [ent.text for ent in doc.ents if ent.label_ in pattern['entities']]
        
        # Find keyword mentions
        keywords_found = []
        if 'keywords' in pattern:
            text_lower = text.lower()
            keywords_found = [kw for kw in pattern['keywords'] if kw in text_lower]
        
        return {
            'entities_found': entities,
            'keywords_found': keywords_found,
            'extraction_confidence': len(entities) + len(keywords_found),
            'extracted': len(entities) > 0 or len(keywords_found) > 0
        }
    
    def _analyze_tone(self, text: str, tone_requirements: List[str]) -> Dict[str, Any]:
        """Analyze tone and professionalism of AI responses"""
        
        tone_indicators = {
            'professional': ['attorney', 'legal', 'information', 'assist', 'help'],
            'empathetic': ['sorry', 'understand', 'difficult', 'experience'],
            'legally_compliant': ['not legal advice', 'attorney will', 'cannot provide advice']
        }
        
        scores = {}
        text_lower = text.lower()
        
        for requirement in tone_requirements:
            indicators = tone_indicators.get(requirement, [])
            found_indicators = [ind for ind in indicators if ind in text_lower]
            
            scores[requirement] = {
                'indicators_found': found_indicators,
                'score': len(found_indicators) / len(indicators) if indicators else 0,
                'meets_requirement': len(found_indicators) > 0
            }
        
        return scores
    
    def _check_compliance(self, text: str, prohibited_content: List[str]) -> List[str]:
        """Check for prohibited content in AI responses"""
        
        violations = []
        text_lower = text.lower()
        
        for prohibited in prohibited_content:
            if prohibited.lower() in text_lower:
                violations.append(prohibited)
        
        return violations
    
    def generate_report(self, results: List[Dict[str, Any]], output_path: Path):
        """Generate a comprehensive validation report"""
        
        report = {
            'summary': {
                'total_templates_tested': len(results),
                'successful_conversations': len([r for r in results if 'analysis' in r]),
                'avg_execution_time': statistics.mean([r['execution_time'] for r in results]),
                'timestamp': datetime.now().isoformat()
            },
            'detailed_results': results,
            'recommendations': self._generate_recommendations(results)
        }
        
        # Save JSON report
        with open(output_path / 'validation_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        # Generate human-readable summary
        self._generate_summary_report(report, output_path / 'validation_summary.md')
        
        self.logger.info(f"Validation report saved to {output_path}")
    
    def _generate_recommendations(self, results: List[Dict[str, Any]]) -> List[str]:
        """Generate recommendations based on validation results"""
        
        recommendations = []
        
        # Analyze common issues across all conversations
        all_similarities = []
        compliance_issues = []
        
        for result in results:
            if 'analysis' in result:
                analysis = result['analysis']
                
                # Collect similarity scores
                for turn_data in analysis.get('semantic_similarity', {}).values():
                    all_similarities.append(turn_data.get('avg_similarity', 0))
                
                # Collect compliance issues
                compliance_issues.extend(analysis.get('compliance_check', {}).get('violations', []))
        
        # Generate recommendations
        if all_similarities:
            avg_similarity = statistics.mean(all_similarities)
            if avg_similarity < 0.6:
                recommendations.append(f"AI response alignment with expected themes is low ({avg_similarity:.2f}). Consider refining training data or prompts.")
        
        if compliance_issues:
            unique_issues = list(set(compliance_issues))
            recommendations.append(f"Compliance violations detected: {', '.join(unique_issues)}. Review AI boundaries and constraints.")
        
        return recommendations
    
    def _generate_summary_report(self, report: Dict[str, Any], output_path: Path):
        """Generate a human-readable summary report"""
        
        summary = f"""# Engage AI Agent Validation Report

## Summary
- **Templates Tested**: {report['summary']['total_templates_tested']}
- **Successful Conversations**: {report['summary']['successful_conversations']}
- **Average Execution Time**: {report['summary']['avg_execution_time']:.2f} seconds
- **Report Generated**: {report['summary']['timestamp']}

## Recommendations
"""
        
        for rec in report['recommendations']:
            summary += f"- {rec}\n"
        
        summary += "\n## Detailed Results\n"
        
        for result in report['detailed_results']:
            if 'analysis' in result:
                template = result['template']
                analysis = result['analysis']
                
                summary += f"\n### {template}\n"
                summary += f"- **Execution Time**: {result['execution_time']:.2f}s\n"
                
                # Semantic similarity
                similarities = analysis.get('semantic_similarity', {})
                if similarities:
                    avg_sim = statistics.mean([turn['avg_similarity'] for turn in similarities.values()])
                    summary += f"- **Semantic Alignment**: {avg_sim:.2f}\n"
                
                # Compliance
                compliance = analysis.get('compliance_check', {})
                if compliance:
                    summary += f"- **Compliance**: {'✅ Pass' if compliance.get('is_compliant') else '❌ Violations detected'}\n"
        
        with open(output_path, 'w') as f:
            f.write(summary)

async def main():
    """Main execution function"""
    
    # Initialize validator
    validator = ConversationValidator()
    
    # Load conversation templates
    templates_dir = Path('conversation_templates')
    if not templates_dir.exists():
        print(f"Templates directory {templates_dir} not found!")
        print("Please create conversation templates in YAML format.")
        return
    
    template_files = list(templates_dir.glob('*.yaml')) + list(templates_dir.glob('*.yml'))
    
    if not template_files:
        print("No template files found!")
        return
    
    print(f"Found {len(template_files)} conversation templates")
    
    # Execute all templates
    results = []
    for template_file in template_files:
        try:
            template = ConversationTemplate(template_file)
            result = await validator.execute_conversation_template(template)
            results.append(result)
            print(f"✅ Completed: {template.case_type}")
        except Exception as e:
            print(f"❌ Failed: {template_file.name} - {e}")
            results.append({
                'template': template_file.name,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
    
    # Generate report
    output_dir = Path('validation_results')
    output_dir.mkdir(exist_ok=True)
    
    validator.generate_report(results, output_dir)
    print(f"\n📊 Validation complete! Report saved to {output_dir}")

if __name__ == "__main__":
    asyncio.run(main())