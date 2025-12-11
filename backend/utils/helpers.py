from typing import List

def mask_api_key(api_key: str) -> str:
    """Mask API key for display"""
    if not api_key or len(api_key) < 8:
        return "****"
    return f"{api_key[:4]}...{api_key[-4:]}"

def get_provider_models(provider_type: str) -> List[str]:
    """Get available models for a provider"""
    models_map = {
        "openai": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
        "anthropic": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
        "google": ["gemini-pro", "gemini-pro-vision"]
    }
    return models_map.get(provider_type, [])
