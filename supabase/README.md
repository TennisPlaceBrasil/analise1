Análise de Preços uses the same Supabase project and authorized accounts as Precificador.
The browser contains only the publishable key. RLS enforces confirmed, active, allowlisted accounts.
Catalog imported on 2026-10-19: 21,395 rows plus the CSV header.
The protected catalog is a snapshot. To replace it, import rows through the administrative SQL connection; never add source costs or credentials to this repository.
The collection job uses data/catalog-groups.json (brand and model only), independently of the source spreadsheet's sharing permissions. Regenerate this manifest when adding models.
The original Google Drive file must have General access set to Restricted separately. Removing its link from the frontend does not revoke its public sharing or historical links.
