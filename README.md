# Zasedák

Česká aplikace pro tvorbu zasedacích pořádků ve více třídách. Statická verze je určená pro GitHub Pages a používá Supabase Auth + PostgreSQL s Row Level Security, takže každý přihlášený účet pracuje pouze se svými třídami.

## Připojení GitHub Pages k Supabase

1. V Supabase otevřete **SQL Editor → New query**, vložte celý obsah `supabase/schema.sql` a zvolte **Run**.
2. V Supabase **Authentication → URL Configuration** nastavte Site URL na `https://michalzeidler.github.io` a přidejte Redirect URL `https://michalzeidler.github.io/zasedak/`.
3. V **Authentication → Providers → Email** ponechte e-mailové přihlášení zapnuté. S potvrzováním e-mailu se po registraci přihlaste až po kliknutí na potvrzovací odkaz.
4. Změny v kořeni větve `main` zveřejněte přes GitHub Pages (Settings → Pages). Stránka používá relativní cesty a je připravená pro adresu `/zasedak/`.
5. Otevřete `https://michalzeidler.github.io/zasedak/`, vytvořte si účet a přihlaste se. Třídy se synchronizují mezi zařízeními po přihlášení.

Používá se pouze Supabase publishable key, který je určený pro klientskou aplikaci; ochranu zajišťují RLS policies v SQL. **Nikdy nedávejte `service_role`/secret key ani databázové heslo do webového kódu.** Před zadáním skutečných jmen dětí ověřte, že přihlášený uživatel vidí pouze vlastní data. Zvažte pravidla školy a ochranu osobních údajů.

Lokální Node.js/SQLite verze serveru zůstává dostupná přes `npm install` a `npm start`; GitHub Pages ale spouští pouze statickou verzi v kořeni repozitáře.
