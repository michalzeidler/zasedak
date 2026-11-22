# Zasedák

Jednoduchá česká webová aplikace pro tvorbu a správu zasedacích pořádků ve více třídách. Žáky lze přesouvat přetažením nebo kliknutím; pořádek se ukládá automaticky.

## Spuštění

Vyžaduje Node.js 18 nebo novější.

```bash
npm install
npm start
```

Otevřete <http://localhost:3000>. Data se ukládají do souboru `zasedak.sqlite` ve složce aplikace. Umístění databáze lze změnit proměnnou prostředí `DB_PATH`; port proměnnou `PORT`.

## Co aplikace umí

- spravovat více tříd a samostatné seznamy žáků;
- přidávat, odebírat a přejmenovat třídy;
- upravit počet lavic v řadě (1–8), ve třídě jsou dvě místa u každé lavice;
- přesouvat žáky přetažením nebo výběrem jména a klepnutím na místo;
- náhodně rozmístit žáky nebo všechna místa uvolnit;
- ukládat data trvale do SQLite databáze.

Aplikace zatím nemá přihlašování; databáze patří instanci serveru, na které aplikace běží. Pro sdílený veřejný provoz doporučujeme doplnit autentizaci a zálohování databáze.
