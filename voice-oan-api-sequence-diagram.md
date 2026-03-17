# Voice OAN API — Sequence Diagram

## Overview

This document describes the end-to-end request flow for the `voice-oan-api` service (branch: `amul-dev`), an AI-powered voice assistant API for agricultural support built with FastAPI and pydantic-ai.

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Router as Voice Router<br/>(app/routers/voice.py)
    participant Auth as JWT Auth
    participant Redis as Redis Cache
    participant VoiceSvc as Voice Service<br/>(app/services/voice.py)
    participant FeedbackSvc as Feedback Service
    participant STTSignals as STT Signal Handler
    participant GPT5Mini as GPT-5-mini<br/>(OpenAI)
    participant TranslateGemma as TranslateGemma 27B<br/>(vLLM)
    participant FarmerAPI as Farmer Backend API
    participant Agent as Voice Agent<br/>(pydantic-ai)
    participant LLM as LLM Model
    participant Marqo as Marqo Vector DB
    participant Langfuse as Langfuse<br/>(Observability)
    participant RAYA as RAYA Provider

    Note over Client, RAYA: === REQUEST SETUP ===

    Client->>+Router: GET /api/voice/?query=...&session_id=...&source_lang=gu<br/>[JWT Bearer token, SSE accept]
    Router->>Auth: Validate JWT (public key)
    Auth-->>Router: user_info (phone, claims)
    Router->>Redis: claim_session_request_ownership(session_id)
    Redis-->>Router: SessionRequestOwner(epoch, token)
    Router->>Redis: get message_history(session_id)
    Redis-->>Router: List[ModelMessage]
    Router->>VoiceSvc: stream_voice_message(query, session_id, history, ...)
    Router-->>Client: StreamingResponse (text/event-stream)

    Note over VoiceSvc, Langfuse: === FEEDBACK CHECK (if previously initiated) ===

    alt Feedback was initiated & rating not yet received
        VoiceSvc->>GPT5Mini: parse_feedback_with_llm(query)
        GPT5Mini-->>VoiceSvc: {is_feedback: true, rating: 4}
        VoiceSvc->>Langfuse: create_score(session_id, rating)
        VoiceSvc->>Redis: set_feedback_rating_received(session_id)
        VoiceSvc->>Redis: update_message_history(+feedback Q&A)
        VoiceSvc-->>Client: stream: "ધન્યવાદ! (acknowledgment)"
        Note over VoiceSvc: RETURN EARLY
    end

    Note over VoiceSvc, STTSignals: === STT SIGNAL HANDLING ===

    alt Query is STT signal ("No audio" / "Unclear Speech")
        VoiceSvc->>STTSignals: detect_stt_signal(query)
        STTSignals-->>VoiceSvc: signal = "No audio/User is speaking softly"
        VoiceSvc->>GPT5Mini: generate_stt_signal_response(signal, lang, recent_history)
        GPT5Mini-->>VoiceSvc: "માફ કરશો, ફરીથી બોલો"
        VoiceSvc->>Redis: update_message_history
        VoiceSvc-->>Client: stream: contextual "please repeat" message
        Note over VoiceSvc: RETURN EARLY
    end

    Note over VoiceSvc, RAYA: === MAIN PROCESSING FLOW ===

    par Arm Nudge Timer
        VoiceSvc->>VoiceSvc: create nudge_task<br/>(fires on 1.5s timeout OR tool call)
        Note over VoiceSvc, RAYA: Nudge sends "please wait" to RAYA<br/>Cancelled when first text chunk arrives
    end

    Note over VoiceSvc, TranslateGemma: === QUERY PRE-TRANSLATION (if translation pipeline enabled) ===

    alt source_lang is Gujarati & translation pipeline ON
        VoiceSvc->>GPT5Mini: translate_to_english_with_gpt5_mini(query, "gu")
        GPT5Mini-->>VoiceSvc: English translation of query
        Note over VoiceSvc: processing_lang = "en"
        alt GPT-5-mini fails
            VoiceSvc->>TranslateGemma: translate_text(query, gu→en) [fallback]
            TranslateGemma-->>VoiceSvc: English translation
        end
    end

    Note over VoiceSvc, FarmerAPI: === FARMER CONTEXT LOADING ===

    VoiceSvc->>FarmerAPI: fetch_farmer_info_raw(mobile_number)
    FarmerAPI-->>VoiceSvc: farmer records (name, animals, etc.)
    VoiceSvc->>VoiceSvc: Build FarmerContext deps

    Note over Agent, Marqo: === AGENT EXECUTION (streaming) ===

    VoiceSvc->>VoiceSvc: clean_message_history_for_openai(history)<br/>trim_history(max_tokens=80K)
    VoiceSvc->>+Agent: run_stream(user_prompt, history, deps)
    Agent->>Agent: get_voice_system_prompt(deps)<br/>[dynamic: selects en/gu prompt template + farmer context]
    Agent->>LLM: System prompt + history + user message

    loop Agent Tool Use Loop
        LLM-->>Agent: tool_call (e.g., search_documents)
        Agent->>Agent: fire_tool_call_nudge() → triggers nudge event

        alt search_documents
            Agent->>Marqo: hybrid search(query, e5 prefix, filters)
            Marqo-->>Agent: raw hits
            Agent->>Agent: rerank (BM25lite) + doc diversity
            Agent-->>LLM: formatted search results
        else search_terms (glossary lookup)
            Agent->>Agent: local glossary search
            Agent-->>LLM: matching terms
        else get_farmer_by_mobile
            Agent->>FarmerAPI: fetch farmer data
            FarmerAPI-->>Agent: farmer records
            Agent-->>LLM: farmer info
        else get_animal_by_tag
            Agent->>FarmerAPI: fetch animal by ear tag
            FarmerAPI-->>Agent: animal details
            Agent-->>LLM: animal info
        else get_cvcc_health_details
            Agent->>FarmerAPI: fetch CVCC health data
            FarmerAPI-->>Agent: health records
            Agent-->>LLM: health details
        else signal_conversation_state
            Agent->>Agent: record event (closing/frustration/in_progress)
            Agent-->>LLM: ack
        end
    end

    LLM-->>Agent: streamed text deltas

    Note over VoiceSvc, Client: === RESPONSE STREAMING ===

    alt Translation pipeline OFF (direct streaming)
        loop For each text delta from Agent
            Agent-->>VoiceSvc: chunk (delta=True)
            VoiceSvc->>VoiceSvc: clean_output_by_language(chunk, target_lang)
            VoiceSvc->>VoiceSvc: Cancel nudge on first text chunk
            VoiceSvc-->>Client: stream: cleaned chunk
        end
    else Translation pipeline ON (batched translation)
        loop For each text delta from Agent
            Agent-->>VoiceSvc: chunk (English)
            VoiceSvc->>VoiceSvc: SentenceSegmenter → buffer sentences
            alt Batch ready (15-80 words + sentence boundary)
                VoiceSvc->>TranslateGemma: translate_text_stream_fast(batch, en→gu)<br/>[with mini_glossary injection]
                loop streaming translation tokens
                    TranslateGemma-->>VoiceSvc: translated chunk
                    VoiceSvc->>VoiceSvc: post_normalize_gu_translation + glossary policy
                    VoiceSvc->>VoiceSvc: Cancel nudge on first translated chunk
                    VoiceSvc-->>Client: stream: translated chunk
                end
            end
        end
        Note over VoiceSvc, TranslateGemma: Flush remaining buffer + tail fragment
    end

    deactivate Agent

    Note over VoiceSvc, Redis: === POST-STREAM CLEANUP ===

    VoiceSvc->>Redis: update_message_history(session_id, history + new_messages)

    alt Agent signaled conversation_closing or user_frustration
        VoiceSvc->>Redis: set_feedback_initiated(session_id, trigger)
        VoiceSvc-->>Client: stream: " તમારો અનુભવ કેવો રહ્યો? 1-5 રેટિંગ આપો."
    end

    VoiceSvc->>Redis: release_session_request_ownership(owner)
    VoiceSvc->>Langfuse: trace / spans (automatic via pydantic-ai instrument)
```

## Key Architectural Points

### 3 Early-Exit Paths (before the main agent runs)

1. **Feedback collection** — if the previous turn asked for a rating, the user's reply is parsed by GPT-5-mini as feedback (1-5) rather than routed to the agent
2. **STT signal** — sentinel strings from the speech-to-text pipeline ("No audio", "Unclear Speech") trigger a short contextual "please repeat" via GPT-5-mini
3. **Stale request** — ownership checks throughout abort processing if a newer request has claimed the session

### Translation Pipeline (when enabled)

- **Input**: Gujarati query → GPT-5-mini pre-translates to English (fallback: TranslateGemma)
- **Agent runs in English** with English prompt template
- **Output**: English response → sentence-batched → TranslateGemma 27B streams back to Gujarati with glossary injection + term policy normalization

### Nudge Mechanism

A timer (default 1.5s) or tool-call event fires a "please wait" message to the RAYA provider, cancelled when the first real text/translated chunk reaches the client.

### Session Ownership

Redis-based epoch+token system ensures only the latest request for a session produces output — earlier in-flight requests self-abort.

### Agent Tools

| Tool | Purpose |
|------|---------|
| `search_documents` | Semantic/hybrid search over Marqo veterinary index with reranking |
| `search_terms` | Local glossary term lookup |
| `get_farmer_by_mobile` | Fetch farmer profile from backend API |
| `get_animal_by_tag` | Look up animal details by ear tag |
| `get_cvcc_health_details` | Fetch CVCC health records |
| `signal_conversation_state` | Signal closing/frustration/in_progress events for feedback triggers |
