const COOKIEWISE_CONFIG = {
    GROQ_API_KEY: 'YOUR_GROQ_API',
    GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    MODEL_CONFIG: {
        temperature: 0.2,
        max_tokens: 1024,
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = COOKIEWISE_CONFIG;
}