"""Format optional IoT sensor payloads for LLM prompts."""


def iot_prompt_block(iot_data: str = "") -> str:
    """Return a prompt section only when the farmer supplied IoT readings."""
    text = (iot_data or "").strip()
    if not text:
        return ""
    return (
        "\n\nIoT FIELD SENSOR DATA (uploaded by farmer — use in your analysis):\n"
        f"{text}\n"
        "Correlate these readings with disease risk, irrigation, and treatment advice when relevant."
    )
