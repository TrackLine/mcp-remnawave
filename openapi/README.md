# Remnawave OpenAPI snapshots

`remnawave-v3.4.3.openapi.json` is the official OpenAPI document downloaded
from `https://cdn.docs.rw/docs/openapi.json` on 2026-09-10. Its SHA-256 is
recorded in the adjacent `.sha256` file:

```
ed9ca9ea55da2b9da266db8f9e1e546e9caf2831a760655a18c1ddf35218c44b
```

Regenerate the derived manifests with `node scripts/generate-v3-operations.mjs`.
The generator verifies both the source checksum and API version before writing.
