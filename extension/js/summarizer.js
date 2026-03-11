/**
 * CookieWise Policy Summarizer
 * Handles communication with Groq API to analyze privacy policies and terms of service
 * Returns structured JSON data for dashboard display
 */

class PolicySummarizer {
    /**
     * Initialize the summarizer with API credentials from config
     */
    constructor() {
        this.apiKey = COOKIEWISE_CONFIG.GROQ_API_KEY;
        this.apiUrl = COOKIEWISE_CONFIG.GROQ_API_URL;
    }

    /**
     * Legacy single-policy summarizer (kept for backward compatibility)
     * @param {string} text - Policy text to analyze
     * @param {string} type - 'privacy' or 'terms'
     * @returns {Promise<Object>} Structured policy summary
     */
    async summarize(text, type = 'privacy') {
        // Check if API key is configured
        if (!this.apiKey || this.apiKey === 'YOUR_API_KEY_HERE') {
            console.error('❌ GROQ API key not configured!');
            return this.getFallbackSummary(type);
        }

        console.log('🔑 Using API key:', this.apiKey.substring(0, 10) + '...');
        console.log('🌐 Using API URL:', this.apiUrl);

        // Truncate text to avoid token limits
        const maxLength = 15000;
        const truncatedText = text.length > maxLength
            ? text.substring(0, maxLength) + '...[truncated]'
            : text;

        const prompt = this.buildPrompt(truncatedText, type);

        // Single attempt (legacy method)
        try {
            console.log(`📡 Sending ${type} policy to Groq...`);

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant', // Fast, free model
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a privacy policy analyzer. Always respond with valid JSON only, no markdown, no backticks.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: COOKIEWISE_CONFIG.MODEL_CONFIG.temperature,
                    max_tokens: COOKIEWISE_CONFIG.MODEL_CONFIG.max_tokens,
                    response_format: { type: 'json_object' } // Force JSON output
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API response not OK:', response.status, errorText);
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Groq response received');

            const resultText = data.choices[0].message.content;
            
            // Extract JSON from response (in case of extra text)
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : resultText;
            
            return JSON.parse(jsonStr);

        } catch (error) {
            console.error(`❌ API call failed:`, error);
            return this.getFallbackSummary(type);
        }
    }

    /**
     * Build prompt for single policy analysis
     * @param {string} text - Policy text
     * @param {string} type - Policy type
     * @returns {string} Formatted prompt
     */
    buildPrompt(text, type) {
        const typeName = type === 'privacy' ? 'privacy policy' : 'terms of service';

        return `You are a privacy policy analyzer. Analyze this ${typeName} and return a JSON object with exactly these fields:

{
    "summary": "A 2-3 sentence plain English summary",
    "dataCollected": ["array", "of", "data", "types"],
    "thirdParties": ["array", "of", "who", "data", "is", "shared", "with"],
    "retentionPeriod": "How long data is kept",
    "userControls": ["options", "to", "control", "data"],
    "riskScore": 0-100,
    "warnings": ["concerning", "clauses"]
}

TEXT TO ANALYZE:
${text}

Return ONLY the JSON object, no other text.`;
    }

    /**
     * Provides fallback data when API is unavailable
     * @param {string} type - 'privacy' or 'terms'
     * @returns {Object} Fallback summary object
     */
    getFallbackSummary(type) {
        return {
            summary: `Sample summary for ${type} - This is fallback data while API is being fixed.`,
            dataCollected: ["Email address", "IP address", "Browsing history", "Device info"],
            thirdParties: ["Advertising partners", "Analytics providers", "Social media platforms"],
            retentionPeriod: "Until account deletion or 2 years after last activity",
            userControls: ["Access data", "Delete account", "Opt-out of marketing"],
            riskScore: 65,
            warnings: ["Uses cookies for advertising", "Shares data with third parties"]
        };
    }

    /**
     * Analyzes both privacy policy and terms of service in a single API call
     * Returns structured data for all three dashboard cards
     * @param {string} privacyText - Extracted privacy policy text
     * @param {string} termsText - Extracted terms of service text
     * @returns {Promise<Object>} Combined analysis with privacy and terms sections
     */
    async summarizeBoth(privacyText, termsText) {
        const maxLen = 7000; // Token limit per document
        const p = privacyText ? privacyText.substring(0, maxLen) : null;
        const t = termsText ? termsText.substring(0, maxLen) : null;

        /**
         * PROMPT DESIGN:
         * - trackingTechnologies: For Card 0 - lists actual tracking tools (cookies, pixels, SDKs)
         * - dataCollected: For Card 2 - lists personal data types (short, individual items)
         * - thirdParties: For Card 1 - lists COMPANY names only (filters out people's names)
         */
        const prompt = `Analyze the following documents and return a single JSON object with this exact structure:
{
  "privacy": {
    "summary": "2-3 sentence summary",
    "trackingTechnologies": ["names of tracking tools only, e.g. Google Analytics, Facebook Pixel, cookies, SDKs"],
    "dataCollected": ["short individual items only, max 4 words each, e.g. 'Email address', 'Date of birth', 'IP address', 'Payment details' — one item per array element, never combine multiple items into one string"],
    "thirdParties": ["names of companies data is shared with, e.g. Google, Meta, Salesforce — NOT people's names"],
    "retentionPeriod": "how long data is kept",
    "userControls": ["user options"],
    "riskScore": 65,
    "warnings": ["concerning clauses"]
  },
  "terms": {
    "summary": "2-3 sentence summary",
    "trackingTechnologies": [],
    "dataCollected": ["types of data"],
    "thirdParties": ["company names only"],
    "retentionPeriod": "how long",
    "userControls": ["user options"],
    "riskScore": 65,
    "warnings": ["concerning clauses"]
  }
}

Rules:
- riskScore must be a plain integer 0-100
- thirdParties must contain COMPANY names only, never individual people's names or job titles
- trackingTechnologies must list actual tools/technologies (cookies, pixels, SDKs, analytics tools)
- If a document is not provided, set its key to null
- Return ONLY the JSON, no markdown backticks, no extra text

PRIVACY POLICY:
${p ?? "Not provided"}

TERMS OF SERVICE:
${t ?? "Not provided"}`;

        // Retry loop with exponential backoff for rate limiting
        for (let attempt = 1; attempt <= 1; attempt++) {
            try {
                console.log(`📡 Attempt ${attempt}: Sending combined policy analysis to Groq...`);

                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a privacy policy analyzer. Always respond with valid JSON only, no markdown, no backticks.'
                            },
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        temperature: COOKIEWISE_CONFIG.MODEL_CONFIG.temperature,
                        max_tokens: COOKIEWISE_CONFIG.MODEL_CONFIG.max_tokens,
                        response_format: { type: 'json_object' }
                    })
                });

                // Handle rate limiting (429 errors)
                if (response.status === 429) {
                    const errData = await response.json();
                    const retryInfo = errData?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
                    const wait = retryInfo ? parseInt(retryInfo.retryDelay) + 2 : (attempt * 15);
                    
                    console.warn(`⏳ Rate limited. Waiting ${wait}s before retry ${attempt}...`);
                    
                    // Update loading indicator if present
                    const loader = document.getElementById('loading-indicator');
                    if (loader) loader.innerHTML = `⏳ Rate limited — retrying in ${wait}s...`;
                    
                    await new Promise(r => setTimeout(r, wait * 1000));
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();
                const resultText = data.choices[0].message.content;
                
                // Extract and parse JSON from response
                const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
                
                console.log('✅ Groq combined analysis received');
                return parsed;

            } catch (e) {
                console.error(`❌ Attempt ${attempt} failed:`, e.message);
                
                if (attempt === 3) {
                    console.log('⚠️ All retries failed, using fallback data');
                    break;
                }
                
                await new Promise(r => setTimeout(r, 5000)); // Wait before retry
            }
        }

        // All retries failed — return fallback for both policies
        return {
            privacy: privacyText ? this.getFallbackSummary('privacy') : null,
            terms: termsText ? this.getFallbackSummary('terms') : null
        };
    }
}

// Make class available globally
window.PolicySummarizer = PolicySummarizer;