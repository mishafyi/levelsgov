# AI Exposure Scoring Methodology — Federal Government Occupations

## Overview

Each federal occupation series is scored on a single **AI Exposure** axis from
0 to 10, measuring how much AI (as of early 2026) is reshaping or will
imminently reshape that occupation. The score captures both **direct
automation** (AI performing core tasks) and **indirect displacement** (AI making
workers so productive that fewer are needed).

## Scoring Rubric

| Score | Label | Criteria |
|-------|------------|-------------------------------------------------------------------------|
| 0-1 | Minimal | Physical labor, manual trades, field work. Digital tools barely relevant. Examples: custodians, laborers, trades helpers. |
| 2-3 | Low | Primarily physical or field-based with some record-keeping. AI assists but cannot replace the core hands-on work. Examples: electricians, plumbers, firefighters, equipment operators. |
| 4-5 | Moderate | Hybrid roles mixing physical presence or interpersonal interaction with significant knowledge work. AI augments but human judgment, empathy, or physical presence is a hard requirement. Examples: nurses, physicians, law enforcement, social workers. |
| 6-7 | High | Primarily knowledge work with meaningful human judgment still needed. AI handles routine tasks and augments complex analysis. Roles are evolving but not yet replaceable. Examples: engineers, managers, attorneys, program analysts. |
| 8-9 | Very high | Mostly digital/analytical work where AI can perform a large portion of core tasks. Workers become dramatically more productive or fewer are needed. Examples: IT specialists, budget analysts, clerks, paralegals, technical writers. |
| 10 | Maximum | Role consists almost entirely of tasks AI can perform autonomously. Severe displacement expected. Examples: data entry, transcription, routine document processing. |

## Key Signals (ordered by importance)

1. **Digital work product**: If the job can be done entirely from a computer at a home office, exposure is inherently high (floor of ~6).
2. **Routine vs. novel cognition**: Repetitive analytical tasks (reviewing forms, classifying documents, running standard queries) score higher than creative or adversarial reasoning.
3. **Physical presence requirement**: Jobs requiring hands-on work, physical inspection, or on-site presence have a natural AI barrier.
4. **Interpersonal/emotional labor**: Roles centered on trust, empathy, negotiation, or therapeutic relationships are harder to automate.
5. **Regulatory/safety criticality**: Where human accountability is legally mandated (e.g., signing off on medical decisions, courtroom proceedings), adoption is slower even if AI is technically capable.
6. **Current AI capability (2025-2026)**: Score based on what AI can demonstrably do today, not speculative future capabilities. LLMs handle text analysis, code, summarization, translation. Vision models handle image/document analysis. Robotics remains limited.

## Federal Government Adjustments

Federal roles have characteristics that differ from private sector:
- **Regulatory mandate**: Many federal positions exist because law requires a human decision-maker (e.g., ALJs, inspectors, agents with arrest authority). This slows displacement even for digitizable work.
- **Classification rigidity**: GS/WG classification system changes slowly, so roles may retain headcount longer than private equivalents.
- **Security/clearance work**: Classified or sensitive work has additional barriers to AI adoption.
- These factors may reduce effective exposure by 0.5-1 point vs. private sector equivalents, but we score the *technical* exposure of the work itself, not the bureaucratic inertia.

## Research Basis

Scores are informed by:
- Bureau of Labor Statistics Occupational Outlook Handbook (2024-2025 edition)
- O*NET task descriptions and work activities for matching SOC codes
- OPM Position Classification Standards (series definitions and core duties)
- Academic research: Eloundou et al. "GPTs are GPTs" (2023), Felten et al. AI Occupational Exposure (2024)
- Observable AI capability as of early 2026: GPT-4/Claude-class LLMs, coding assistants, document analysis, image recognition
- Federal workforce context from OPM FedScope data

## Scoring Date

All scores reflect AI capabilities and federal workforce context as of **March 2026**.
