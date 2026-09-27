# Optional local thinking

This helper supplements action decisions. It does not run the world, generate future simulation frames, replace cloud construction design, or change cloud daily allowances. Cloud action eligibility remains every 30 real minutes per person, subject to its existing budgets. Cloud design eligibility remains hourly.

The intended first test is an Ollama `llama3.1:8b` quantized model on Kyle's possible GTX 1080 Ti and 16 GB system RAM. Confirm the GPU in Task Manager first. A 1080 Ti has 11 GB dedicated GPU memory; system RAM is separate. Current Ollama documentation lists driver 570 or newer for this Pascal GPU. Test actual speed and GPU use with `ollama ps`; no throughput is promised. The smaller model is not equivalent to the existing 70B Llama or OpenAI model.

## Setup on the computer

1. Install Ollama from https://ollama.com/download and Node.js 22 or newer from https://nodejs.org/. Keep Ollama bound to its default localhost address. No router forwarding or public tunnel is needed.
2. In PowerShell or a terminal, run `ollama pull llama3.1:8b`. Keep Ollama running.
3. Obtain the repository branch containing this change, then from its directory run `node scripts/local-ai-runner.mjs --check`. This makes one local, synthetic structured decision and reports elapsed seconds. It makes no farm request. Verify `ollama ps` reports GPU use while it runs. This is a basic compatibility check, not evidence of better village behavior.
4. Configure the live Worker's secret `LOCAL_AI_KEY` with a newly generated dedicated random value of at least 24 characters and its variable `LOCAL_AI_MODEL=llama3.1:8b`. Keep the value private; do not send it in chat. This enables only the two local AI endpoints. Without both settings the feature is disabled. Do not use or expose an OpenAI key or the farm's broader owner key.
5. On Windows, enter that same dedicated value for this terminal session without echoing it:

```powershell
$env:OLLAMA_MODEL = 'llama3.1:8b'
$farmSecret = Read-Host 'Dedicated farm local AI key' -AsSecureString
$env:FARM_LOCAL_AI_KEY = [System.Net.NetworkCredential]::new('', $farmSecret).Password
node scripts/local-ai-runner.mjs
```

Close the terminal or press Ctrl+C to stop. Clear the environment variable afterwards with `Remove-Item Env:FARM_LOCAL_AI_KEY`. On macOS/Linux the same Node script works with those environment variables set privately in the shell. Do not commit credentials in a file.

## Behavior and limits

- One queued inference at a time for the whole world; at most one local request per person per two real minutes, only around a decision boundary. This is a ceiling, not guaranteed frequency.
- A request expires after 90 seconds. Local inference stops waiting after 75 seconds. With the computer off, no requests are sent to it and no queue accumulates. The existing cloud schedule remains independently eligible.
- Inputs contain only the person's perceived choices, memories, needs, relationships and home context. The helper posts an action proposal; it has no filesystem, shell, owner-event or arbitrary world-edit tool.
- Invalid, late, duplicate, unavailable or mismatched-model proposals are rejected. Survival and physical availability are checked again when executing the selected action. The model cannot grant resources, move someone instantly, or complete a build.
- Heartbeats and local results do not cause extra immediate database checkpoints. Local counters and pending decisions are included in normal saves; a crash may lose an uncheckpointed counter/proposal, which is acceptable for free supplemental thinking.
- The inspector shows the actual model used for a task and whether the optional helper is available. Cloud budget counters stay separate from local counters.
- Connections use outbound authenticated HTTPS. The dedicated key is not included in public state, prompts, exports or logs. Revoke the Worker secret to disable the helper.

## Evaluation

First compare basic validity, stale/rejected actions and latency. Then observe whether extra decisions lead to completed useful work, actual comfort improvements, fewer repeated failures, and time near chosen companions/home. More calls are not evidence of improvement. Keep cloud construction generation in place until local design quality has separately been demonstrated in the build lab.

Official references: https://docs.ollama.com/gpu , https://docs.ollama.com/api/chat , https://ollama.com/library/llama3.1:8b .
