# Monster Day

Three people share one phone page. Each shared day grows a monster. Leg, Chest/Cardio, Back, or Rest/Walk each land one hit. The monster is defeated when all three have checked in before the day resets.

The reset is **8:00** on the **Pacific** clock (`America/Los_Angeles`). Auntie is on China time (`Asia/Shanghai`). The same instant ends the day for both phones. When the US changes daylight saving, the Beijing label moves by an hour. China does not.

## Names

| Id | Name | Clock |
|---|---|---|
| p1 | Auntie | China |
| p2 | Shelby | Pacific |
| p3 | Bernice | Pacific |

## Google Sheet

The sheet stays private. The page only talks to an Apps Script web app.

1. Open the [workout sheet](https://docs.google.com/spreadsheets/d/1C-1jZF_QivTMigTGrF6MoM_9c_y2q13ByX5Jin6HCMM/edit).
2. Extensions → Apps Script.
3. Replace the script with `apps-script/Code.gs`. Use the V8 runtime.
4. Deploy → New deployment → gear icon → Web app.
5. Execute as **Me**. Who has access: **Anyone** (not “Anyone with a Google account”).
6. Copy the web app URL. It ends in `/exec`.
7. Paste it into `scriptUrl` in `config.js`.

The script creates a `Checkins` tab the first time it runs. One row per person per day. Choosing again updates that row.

If you change the script later, open Deploy → Manage deployments → edit → New version. The `/exec` URL stays the same.

## GitHub Pages

Serve the `main` branch from the repository root (`/`). The site is the files at the top of this repo: `index.html`, `styles.css`, `config.js`, `day.js`, `monster.js`, and `app.js`.
