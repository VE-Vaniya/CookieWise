// js/summarizer.js
class PolicySummarizer {
    constructor() {
        this.apiKey = COOKIEWISE_CONFIG.GROQ_API_KEY;
        this.apiUrl = COOKIEWISE_CONFIG.GROQ_API_URL;
    }

    // In summarizer.js, update the summarize method
    async summarize(text, type = 'privacy') {
        if (!this.apiKey || this.apiKey === 'YOUR_API_KEY_HERE') {
            console.error('❌ GROQ API key not configured!');
            return this.getFallbackSummary(type);
        }

        console.log('🔑 Using API key:', this.apiKey.substring(0, 10) + '...');
        console.log('🌐 Using API URL:', this.apiUrl);

        const maxLength = 15000;
        const truncatedText = text.length > maxLength
            ? text.substring(0, maxLength) + '...[truncated]'
            : text;

        const prompt = this.buildPrompt(truncatedText, type);

        // Try up to 3 times with exponential backoff
        for (let attempt = 1; attempt <=1; attempt++) {
            try {
                console.log(`📡 Attempt ${attempt}: Sending ${type} policy to Gemini...`);

                const fullUrl = `${this.apiUrl}?key=${this.apiKey}`;

                const response = await fetch(this.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`   // ← Groq uses Bearer token
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',             // ← fast + free
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
                        response_format: { type: 'json_object' }   // ← forces valid JSON output
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();

                    // If it's a 429 quota error, wait and retry
                    if (response.status === 429) {
                        const waitTime = attempt * 5000; // 5s, 10s, 15s
                        console.log(`⏳ Quota exceeded, waiting ${waitTime / 1000}s before retry ${attempt}...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }

                    console.error('❌ API response not OK:', response.status, errorText);
                    throw new Error(`API error: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                console.log('✅ Gemini response received');

                const resultText = data.choices[0].message.content;

                try {
                    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : resultText;
                    return JSON.parse(jsonStr);
                } catch (e) {
                    console.error('Failed to parse JSON response:', e);
                    return this.getFallbackSummary(type);
                }

            } catch (error) {
                console.error(`❌ Attempt ${attempt} failed:`, error);
                if (attempt === 3) {
                    return this.getFallbackSummary(type);
                }
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

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
    async summarizeBoth(privacyText, termsText) {
        const maxLen = 7000;
        const p = privacyText ? privacyText.substring(0, maxLen) : null;
        const t = termsText ? termsText.substring(0, maxLen) : null;

        // Replace the prompt template string with this:
        const prompt = `Analyze the following documents and return a single JSON object with this exact structure:
{
  "privacy": {
    "summary": "2-3 sentence summary",
    "trackingTechnologies": ["names of tracking tools only, e.g. Google Analytics, Facebook Pixel, cookies, SDKs"],
    "dataCollected": ["short individual items only, max 4 words each, e.g. 'Email address', 'Date of birth', 'IP address', 'Payment details' — one item per array element, never combine multiple items into one string"],    "thirdParties": ["names of companies data is shared with, e.g. Google, Meta, Salesforce — NOT people's names"],
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

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`📡 Attempt ${attempt}: Sending combined policy analysis to Gemini...`);

                // ✅ Groq-style fetch
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

                if (response.status === 429) {
                    const errData = await response.json();
                    const retryInfo = errData?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
                    const wait = retryInfo ? parseInt(retryInfo.retryDelay) + 2 : (attempt * 15);
                    console.warn(`⏳ Rate limited. Waiting ${wait}s before retry ${attempt}...`);
                    const loader = document.getElementById('loading-indicator');
                    if (loader) loader.innerHTML = `⏳ Rate limited — retrying in ${wait}s...`;
                    await new Promise(r => setTimeout(r, wait * 1000));
                    continue;
                }

                if (!response.ok) throw new Error(`API error: ${response.status}`);

                const data = await response.json();
                const resultText = data.choices[0].message.content;
                const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : resultText);
                console.log('✅ Gemini combined analysis:', parsed);
                return parsed;

            } catch (e) {
                console.error(`❌ Attempt ${attempt} failed:`, e.message);
                if (attempt === 3) break;
                await new Promise(r => setTimeout(r, 5000));
            }
        }

        // All retries failed — return fallback for both
        return {
            privacy: privacyText ? this.getFallbackSummary('privacy') : null,
            terms: termsText ? this.getFallbackSummary('terms') : null
        };
    }
}

window.PolicySummarizer = PolicySummarizer;