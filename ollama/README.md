# Smith Ollama Execution Kit

Kit standard pentru rularea locală a Ollama, agenți Smith și audit rapid pe Windows/PowerShell și Linux/Termius.

## Obiectiv

- verificare Ollama
- pornire/oprire serviciu
- descărcare modele
- test local API
- backup modele/config
- rulare agenți Smith

## Reguli

1. Nu se pun parole, tokenuri, chei private sau date personale în repo.
2. `.env` rămâne local. În repo există doar `.env.example`.
3. Backup-urile se criptează înainte de urcare în cloud.
4. Orice execuție începe cu `healthcheck`.
5. Orice update începe cu backup.

## Windows PowerShell

```powershell
cd ollama/windows
.\ollama-smith.ps1 healthcheck
.\ollama-smith.ps1 pull
.\ollama-smith.ps1 test
.\ollama-smith.ps1 agents
.\ollama-smith.ps1 backup
```

## Linux / Termius

```bash
cd ollama/linux
chmod +x ollama-smith.sh
./ollama-smith.sh healthcheck
./ollama-smith.sh pull
./ollama-smith.sh test
./ollama-smith.sh agents
./ollama-smith.sh backup
```

## Fișiere

- `models.txt` — modelele standard Smith.
- `Modelfile-smith` — model local Smith peste un model de bază.
- `.env.example` — configurație exemplu.
- `agents/agents.yaml` — agenții de execuție.
- `windows/ollama-smith.ps1` — executor PowerShell.
- `linux/ollama-smith.sh` — executor Termius/Linux.
