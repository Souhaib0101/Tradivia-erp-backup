# Canonical files and retained source uploads

The repository contains both the running application and the original files
that were uploaded while the application was being reconstructed. They are not
interchangeable.

## Canonical runtime files

| Purpose | Canonical path |
|---|---|
| React application | `apps/web/src/app/App.jsx` |
| Express API | `apps/api/server.cjs` |
| Document fill worker | `workers/documents/fill_template.py` |
| Invoice merge worker | `workers/documents/merge_invoices.py` |
| Word templates | `workers/documents/templates/*.docx` |

Only these paths are used by the npm startup commands and the active API.

## Retained root uploads

The following root files are preserved as historical inputs/backups and are not
executed by the current system:

- `App.jsx`
- `index.js`
- `fill_template.py`
- `fill_template_old.py`
- `merge_invoices.py`
- the four root-level `.docx` templates

The root template copies matched the canonical worker templates byte for byte
when this inventory was written. They may become stale after future changes.
Do not edit both copies and assume they remain synchronized. Apply production
changes to the canonical paths above and treat the root files as an archive.

Generated logs, browser test profiles, screenshots, databases, uploads, Python
caches, and build output are ignored by Git. Existing tracked runtime data must
be removed from version control deliberately if it was committed in the past;
the ignore file does not rewrite Git history.
