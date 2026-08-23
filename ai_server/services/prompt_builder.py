# ai_server/services/prompt_builder.py
import os
import json
from ai_server.config import AIConfig

REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "lora_registry.json")

def load_lora_registry() -> dict:
    if os.path.exists(REGISTRY_PATH):
        try:
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load lora_registry.json: {e}")
    return {}

LORA_REGISTRY = load_lora_registry()

def build_prompt_with_lora(user_prompt: str, lora_id: str = None) -> tuple[str, str]:
    """
    Intelligently injects LoRA trigger words and syntax into user prompt.
    Returns (enriched_prompt, lora_syntax_for_forge)
    """
    if not lora_id or lora_id not in LORA_REGISTRY:
        return user_prompt.strip(), ""

    config = LORA_REGISTRY[lora_id]
    trigger = config.get("trigger_words", "")
    weight = config.get("weight", 0.8)
    position = config.get("position", "prefix")
    lora_name = lora_id.replace(".safetensors", "")

    # Forge / A1111 LoRA prompt syntax: <lora:name:weight>
    lora_tag = f"<lora:{lora_name}:{weight}>"

    # Check if user already typed the trigger to prevent duplicate words
    words_to_add = []
    for phrase in [p.strip() for p in trigger.split(",") if p.strip()]:
        if phrase.lower() not in user_prompt.lower():
            words_to_add.append(phrase)
    
    injected_trigger = ", ".join(words_to_add)

    # Assemble enriched prompt
    if position == "prefix" and injected_trigger:
        final_prompt = f"{injected_trigger}, {user_prompt} {lora_tag}".strip()
    elif position == "suffix" and injected_trigger:
        final_prompt = f"{user_prompt}, {injected_trigger} {lora_tag}".strip()
    else:
        final_prompt = f"{user_prompt} {lora_tag}".strip()

    return final_prompt, lora_tag
