# DAY NIGHT P1 Runtime Evidence

This file documents the protected production evidence workflow for Issue #266.

The workflow deploys and verifies these 17TRACK Edge Functions:

- `register-track17-shipment`
- `sync-track17-shipment`
- `track17-admin`
- `track17-webhook`
- `public-international-tracking`

Secrets, passwords, access tokens, raw webhook payloads, and customer PII must never be committed or uploaded as workflow artifacts.

External 17TRACK dashboard callback tests remain provider-controlled manual acceptance evidence.
