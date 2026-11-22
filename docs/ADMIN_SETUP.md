# Administrátorský panel

Panel je dostupný na `https://michalzeidler.github.io/zasedak/admin/` po přihlášení. Ověření role a všechny privilegované operace probíhají v Supabase Edge Function; nikdy nevkládejte service-role klíč do webové aplikace.

## Nasazení

1. Spusťte `supabase/migrations/20261122000000_admin_profiles.sql` v Supabase SQL Editoru (nebo nasazujte migrace přes Supabase CLI). Je idempotentní a zachová existující role; přiřazený admin zůstane adminem.
2. Nasaďte `supabase/functions/admin-api/index.ts` jako Edge Function `admin-api` přes Supabase CLI nebo Dashboard. Vypněte vestavěné JWT ověření funkce pouze tehdy, pokud funkce nemůže sama ověřovat Bearer token; tato implementace ověřuje token přes `auth.getUser()` a roli přes databázový profil.
3. V secrets funkce nastavte `APP_SITE_URL=https://michalzeidler.github.io/zasedak`. Supabase automaticky poskytuje `SUPABASE_URL`, `SUPABASE_ANON_KEY` a `SUPABASE_SERVICE_ROLE_KEY`.
4. Zveřejněte GitHub Pages z větve obsahující soubory `admin/`, `reset-password/` a Edge Function. Edge Function se nenasazuje automaticky pouhým propojením GitHub repozitáře; nasazení proveďte přes Supabase CLI/Dashboard.

Panel umožňuje přehled účtů a tříd, pozvánky, změnu role, smazání třídy a odeslání bezpečného odkazu pro změnu hesla. Heslo se nikdy nezobrazuje ani nenastavuje administrátorem přímo.
